import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { SessionUser } from "../auth/admin-auth.ts";
import { can } from "../auth/permissions.ts";
import type { AppDb } from "../db/client.ts";
import { workOrderApprovals, workOrders } from "../db/schema-orders.ts";
import { recordAudit } from "./audit.ts";
import type { AuditAction } from "./audit.ts";
import { recordStatusChange } from "./orders.ts";
import type { OrderStatus } from "./rules.ts";
import { hashShareToken, newShareToken } from "./share-tokens.ts";
import { canAccessOrder } from "./status.ts";

export const approvalFormSchema = z.object({
  description: z.string().trim().min(5).max(500),
  recommendation: z.string().trim().min(5).max(500),
  priceClp: z.coerce.number().int().min(1).max(10_000_000),
});
type ApprovalInput = z.infer<typeof approvalFormSchema>;

function orderFilter(actor: SessionUser, orderId: string) {
  return and(
    eq(workOrders.branchId, actor.branchId),
    eq(workOrders.id, orderId),
    isNull(workOrders.voidedAt),
  );
}

async function accessOrder(db: AppDb, actor: SessionUser, orderId: string, lock = false) {
  const query = db.select().from(workOrders).where(orderFilter(actor, orderId));
  const [order] = await (lock ? query.for("update") : query);
  if (!order) return { ok: false, code: "not_found" } as const;
  if (!canAccessOrder(actor, order)) return { ok: false, code: "forbidden" } as const;
  return { ok: true, order } as const;
}

function allowsProposal(status: string) {
  return ["diagnostico", "en_reparacion", "esperando_repuesto", "esperando_aprobacion"].includes(
    status,
  );
}

async function waitForApproval(
  db: AppDb,
  actor: SessionUser,
  orderId: string,
  from: OrderStatus,
  now: Date,
) {
  if (from === "esperando_aprobacion") return;
  await db
    .update(workOrders)
    .set({ status: "esperando_aprobacion", updatedAt: now })
    .where(orderFilter(actor, orderId));
  const recorded = await recordStatusChange(
    db,
    {
      branchId: actor.branchId,
      orderId,
      from,
      to: "esperando_aprobacion",
      actorUserId: actor.id,
      note: "Propuesta de adicional",
    },
    now,
  );
  if (!recorded.ok) throw new Error("Transición de propuesta no válida.");
}

async function auditApproval(
  db: AppDb,
  actor: SessionUser,
  orderId: string,
  action: AuditAction,
  details: Record<string, unknown>,
  now: Date,
) {
  await recordAudit(
    db,
    {
      branchId: actor.branchId,
      actorUserId: actor.id,
      action,
      entity: "work_order",
      entityId: orderId,
      details,
    },
    now,
  );
}

export async function createApproval(
  db: AppDb,
  actor: SessionUser,
  orderId: string,
  input: ApprovalInput,
  now: Date,
) {
  if (!can(actor.role, "approvals.create")) return { ok: false, code: "forbidden" } as const;
  const parsed = approvalFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "validation_error" } as const;
  const access = await accessOrder(db, actor, orderId);
  if (!access.ok) return access;
  if (!allowsProposal(access.order.status)) return { ok: false, code: "invalid_status" } as const;
  return db.transaction(async (tx) => {
    const locked = await accessOrder(tx, actor, orderId, true);
    if (!locked.ok) return locked;
    if (!allowsProposal(locked.order.status)) return { ok: false, code: "invalid_status" } as const;
    const token = newShareToken();
    const [approval] = await tx
      .insert(workOrderApprovals)
      .values({
        ...parsed.data,
        branchId: actor.branchId,
        workOrderId: orderId,
        tokenHash: hashShareToken(token),
        createdBy: actor.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: workOrderApprovals.id });
    if (!approval) throw new Error("No se pudo crear la propuesta de adicional.");
    await waitForApproval(tx, actor, orderId, locked.order.status as OrderStatus, now);
    await auditApproval(
      tx,
      actor,
      orderId,
      "approval.created",
      { approvalId: approval.id, priceClp: parsed.data.priceClp },
      now,
    );
    return { ok: true, approvalId: approval.id, token } as const;
  });
}

export function approvalLink(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/aprobacion/${token}`;
}

export function whatsappShareLink(phoneE164: string, text: string): string {
  return `https://wa.me/${phoneE164.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

function pendingApproval(actor: SessionUser, approvalId: string) {
  return and(
    eq(workOrderApprovals.branchId, actor.branchId),
    eq(workOrderApprovals.id, approvalId),
    isNull(workOrderApprovals.decidedAt),
    isNull(workOrderApprovals.voidedAt),
  );
}

export async function regenerateApprovalLink(
  db: AppDb,
  actor: SessionUser,
  approvalId: string,
  now: Date,
) {
  if (!can(actor.role, "approvals.create")) return { ok: false, code: "forbidden" } as const;
  return db.transaction(async (tx) => {
    const [approval] = await tx
      .select({ workOrderId: workOrderApprovals.workOrderId })
      .from(workOrderApprovals)
      .where(pendingApproval(actor, approvalId));
    if (!approval) return { ok: false, code: "not_found" } as const;
    const access = await accessOrder(tx, actor, approval.workOrderId);
    if (!access.ok) return access;
    const token = newShareToken();
    const [updated] = await tx
      .update(workOrderApprovals)
      .set({ tokenHash: hashShareToken(token), updatedAt: now })
      .where(pendingApproval(actor, approvalId))
      .returning({ id: workOrderApprovals.id });
    if (!updated) return { ok: false, code: "not_found" } as const;
    await auditApproval(
      tx,
      actor,
      approval.workOrderId,
      "approval.link_regenerated",
      { approvalId },
      now,
    );
    return { ok: true, token } as const;
  });
}

export async function listApprovals(db: AppDb, actor: SessionUser, orderId: string) {
  const access = await accessOrder(db, actor, orderId);
  if (!access.ok) return [];
  return db
    .select({
      id: workOrderApprovals.id,
      description: workOrderApprovals.description,
      recommendation: workOrderApprovals.recommendation,
      priceClp: workOrderApprovals.priceClp,
      decision: workOrderApprovals.decision,
      decidedAt: workOrderApprovals.decidedAt,
      createdAt: workOrderApprovals.createdAt,
    })
    .from(workOrderApprovals)
    .where(
      and(
        eq(workOrderApprovals.branchId, actor.branchId),
        eq(workOrderApprovals.workOrderId, orderId),
        isNull(workOrderApprovals.voidedAt),
      ),
    )
    .orderBy(desc(workOrderApprovals.createdAt), desc(workOrderApprovals.id));
}
