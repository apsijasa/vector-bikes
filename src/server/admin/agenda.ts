import { asc, eq, gte } from "drizzle-orm";
import { DateTime } from "luxon";
import { z } from "zod";
import { cancelBooking } from "../booking/cancel-booking.ts";
import { missingHolidayYears } from "../booking/holidays.ts";
import { HORIZON_DAYS, TIMEZONE } from "../booking/rules.ts";
import { localToday } from "../booking/slots.ts";
import type { AppDb } from "../db/client.ts";
import { type BlockedPeriod, type Booking, blockedPeriods, bookings } from "../db/schema.ts";

export type AdminAction = "cancelar" | "completar" | "no_show";

export type AdminActionResult =
  | { ok: true; booking: Booking }
  | { ok: false; code: "not_found" | "invalid_transition" };

export const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Completada",
  no_show: "No-show",
};

const uuidSchema = z.uuid();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** `YYYY-MM-DD` válido o `null`. */
export function parseDate(value: string | null | undefined): string | null {
  return dateSchema.safeParse(value).success &&
    DateTime.fromISO(String(value), { zone: TIMEZONE }).isValid
    ? String(value)
    : null;
}

/** Rango local `HH:mm–HH:mm` de la reserva. */
export function timeRange(booking: Booking): string {
  const hhmm = (instant: Date) => DateTime.fromJSDate(instant).setZone(TIMEZONE).toFormat("HH:mm");
  return `${hhmm(booking.startsAt)}–${hhmm(booking.endsAt)}`;
}

/** Todas las reservas del día, en cualquier estado, por hora de inicio. */
export async function agendaForDate(db: AppDb, date: string): Promise<Booking[]> {
  return db
    .select()
    .from(bookings)
    .where(eq(bookings.serviceDate, date))
    .orderBy(asc(bookings.startsAt));
}

export async function bookingDetail(db: AppDb, id: string): Promise<Booking | null> {
  if (!uuidSchema.safeParse(id).success) {
    return null;
  }
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  return booking ?? null;
}

/** `completar` y `no_show` solo desde `confirmed`; sus bloques siguen activos (el cupo se usó). */
async function closeBooking(
  db: AppDb,
  id: string,
  status: "completed" | "no_show",
  now: Date,
): Promise<AdminActionResult> {
  return db.transaction(async (tx) => {
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, id)).for("update");
    if (!booking) {
      return { ok: false, code: "not_found" };
    }
    if (booking.status !== "confirmed") {
      return { ok: false, code: "invalid_transition" };
    }
    const [updated] = await tx
      .update(bookings)
      .set(status === "completed" ? { status, completedAt: now } : { status })
      .where(eq(bookings.id, id))
      .returning();
    if (!updated) {
      throw new Error("la actualización no devolvió la reserva");
    }
    return { ok: true, booking: updated };
  });
}

/** El admin cancela sin correo: el dueño llama al cliente. */
export async function applyAdminAction(
  db: AppDb,
  id: string,
  action: AdminAction,
  now: Date,
): Promise<AdminActionResult> {
  if (!uuidSchema.safeParse(id).success) {
    return { ok: false, code: "not_found" };
  }
  if (action === "completar") {
    return closeBooking(db, id, "completed", now);
  }
  if (action === "no_show") {
    return closeBooking(db, id, "no_show", now);
  }
  const result = await cancelBooking(db, { bookingId: id, by: "admin", now });
  if (result.ok) {
    return result;
  }
  return { ok: false, code: result.code === "not_found" ? "not_found" : "invalid_transition" };
}

export const adminActionSchema = z.enum(["cancelar", "completar", "no_show"]);

export async function listUpcomingBlocks(db: AppDb, fromDate: string): Promise<BlockedPeriod[]> {
  return db
    .select()
    .from(blockedPeriods)
    .where(gte(blockedPeriods.serviceDate, fromDate))
    .orderBy(asc(blockedPeriods.serviceDate), asc(blockedPeriods.startTime));
}

/** `Día completo` o `HH:MM–HH:MM`. */
export function blockRange(block: BlockedPeriod): string {
  if (block.startTime === null || block.endTime === null) {
    return "Día completo";
  }
  return `${block.startTime.slice(0, 5)}–${block.endTime.slice(0, 5)}`;
}

const hhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Usa el formato HH:MM.")
  .nullable();

const blockSchema = z
  .object({
    serviceDate: z.string().refine((value) => parseDate(value) !== null, "Elige una fecha válida."),
    startTime: hhmm,
    endTime: hhmm,
    reason: z.string().trim().min(2, "Escribe el motivo.").max(120, "Escribe el motivo."),
  })
  .superRefine((value, ctx) => {
    const { startTime, endTime } = value;
    if ((startTime === null) !== (endTime === null)) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "Indica desde y hasta, o deja ambas vacías para bloquear el día.",
      });
    } else if (startTime !== null && endTime !== null && startTime >= endTime) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "La hora de término debe ser posterior a la de inicio.",
      });
    }
  });

export type BlockInput = {
  serviceDate: string;
  startTime: string | null;
  endTime: string | null;
  reason: string;
};

export async function createBlock(
  db: AppDb,
  input: BlockInput,
): Promise<{ ok: true } | { ok: false; errors: Record<string, string> }> {
  const parsed = blockSchema.safeParse(input);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[String(issue.path[0] ?? "formulario")] ??= issue.message;
    }
    return { ok: false, errors };
  }
  await db.insert(blockedPeriods).values(parsed.data);
  return { ok: true };
}

export async function deleteBlock(db: AppDb, id: string): Promise<boolean> {
  if (!uuidSchema.safeParse(id).success) {
    return false;
  }
  const deleted = await db
    .delete(blockedPeriods)
    .where(eq(blockedPeriods.id, id))
    .returning({ id: blockedPeriods.id });
  return deleted.length > 0;
}

export function holidayWarning(now: Date): string | null {
  const years = missingHolidayYears(localToday(now), HORIZON_DAYS);
  if (years.length === 0) {
    return null;
  }
  return `Las reservas llegan a ${years.join(", ")} y ese año no tiene feriados cargados. Agrégalos en src/data/feriados-cl.json o bloquea esos días desde Bloqueos.`;
}
