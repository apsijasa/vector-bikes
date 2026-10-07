import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { normalizeRut } from "../../lib/rut.ts";
import { normalizePhone } from "../api/handlers.ts";
import type { SessionUser } from "../auth/admin-auth.ts";
import { can } from "../auth/permissions.ts";
import type { AppDb } from "../db/client.ts";
import { customers } from "../db/schema-taller.ts";

export const searchQuerySchema = z.string().trim().min(1).max(80);
type CustomerHit = Pick<typeof customers.$inferSelect, "id" | "name" | "phoneE164" | "rut">;
type SearchResult = { customers: CustomerHit[]; orders: never[] };

function searchFilter(q: string) {
  const rut = normalizeRut(q);
  if (rut) return eq(customers.rut, rut);
  const phone = normalizePhone(q);
  if (phone) return eq(customers.phoneE164, phone);
  const pattern = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
  return sql`${customers.name} ilike ${pattern} escape ${"\\"}`;
}

export async function searchTaller(
  db: AppDb,
  actor: SessionUser,
  q: string,
): Promise<SearchResult> {
  const empty: SearchResult = { customers: [], orders: [] };
  if (!can(actor.role, "customers.manage") && !can(actor.role, "reception.perform")) return empty;
  const parsed = searchQuerySchema.safeParse(q);
  if (!parsed.success) return empty;
  const matches = await db
    .select({
      id: customers.id,
      name: customers.name,
      phoneE164: customers.phoneE164,
      rut: customers.rut,
    })
    .from(customers)
    .where(and(eq(customers.branchId, actor.branchId), searchFilter(parsed.data)))
    .orderBy(asc(customers.name))
    .limit(20);
  // F1-23: búsqueda por número de orden
  return { customers: matches, orders: [] };
}
