import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { bikes, customers } from "./schema-taller.ts";
import { bookings, branches, createdAt, instant, updatedAt, users } from "./schema.ts";

export const workOrders = pgTable(
  "work_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    number: integer("number").notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    bikeId: uuid("bike_id")
      .notNull()
      .references(() => bikes.id, { onDelete: "restrict" }),
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("reservada"),
    requestedService: text("requested_service").notNull(),
    diagnosis: text("diagnosis"),
    observations: text("observations"),
    notes: text("notes"),
    assignedMechanicId: uuid("assigned_mechanic_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    estimatedDeliveryDate: date("estimated_delivery_date", { mode: "string" }),
    deliveryDateConfirmedAt: instant("delivery_date_confirmed_at"),
    estimatedMinutes: integer("estimated_minutes").notNull().default(0),
    totalClp: integer("total_clp").notNull().default(0),
    paidClp: integer("paid_clp").notNull().default(0),
    qcApprovedAt: instant("qc_approved_at"),
    qcApprovedBy: uuid("qc_approved_by").references(() => users.id, { onDelete: "restrict" }),
    qcSelfChecked: boolean("qc_self_checked").notNull().default(false),
    warrantyOfOrderId: uuid("warranty_of_order_id").references((): AnyPgColumn => workOrders.id, {
      onDelete: "restrict",
    }),
    taxDocType: text("tax_doc_type"),
    taxDocNumber: text("tax_doc_number"),
    taxDocDate: date("tax_doc_date", { mode: "string" }),
    receivedAt: instant("received_at"),
    deliveredAt: instant("delivered_at"),
    voidedAt: instant("voided_at"),
    voidedBy: uuid("voided_by").references(() => users.id, { onDelete: "restrict" }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("uq_work_orders_branch_number").on(t.branchId, t.number),
    uniqueIndex("uq_work_orders_booking").on(t.bookingId),
    index("idx_work_orders_branch_status").on(t.branchId, t.status),
    index("idx_work_orders_mechanic_status").on(t.assignedMechanicId, t.status),
    index("idx_work_orders_bike").on(t.bikeId),
    index("idx_work_orders_customer").on(t.customerId),
    index("idx_work_orders_branch_delivery_date").on(t.branchId, t.estimatedDeliveryDate),
    check("work_orders_number_check", sql`number >= 1`),
    check(
      "work_orders_status_check",
      sql`status in ('reservada', 'recibida', 'diagnostico', 'esperando_aprobacion', 'esperando_repuesto', 'en_reparacion', 'control_calidad', 'lista_para_retirar', 'entregada', 'cancelada', 'trabajo_rechazado')`,
    ),
    check(
      "work_orders_non_negative_check",
      sql`total_clp >= 0 and paid_clp >= 0 and estimated_minutes >= 0`,
    ),
    check("work_orders_delivered_paid_check", sql`status <> 'entregada' or paid_clp = total_clp`),
    check(
      "work_orders_qc_check",
      sql`status not in ('lista_para_retirar', 'entregada') or qc_approved_at is not null`,
    ),
    check(
      "work_orders_tax_doc_type_check",
      sql`tax_doc_type is null or tax_doc_type in ('boleta', 'factura')`,
    ),
  ],
);

export const workOrderStatusHistory = pgTable(
  "work_order_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    workOrderId: uuid("work_order_id")
      .notNull()
      .references(() => workOrders.id, { onDelete: "restrict" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "restrict" }),
    note: text("note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("idx_work_order_status_history_order_created").on(t.workOrderId, t.createdAt)],
);

export const orderTables = [workOrders, workOrderStatusHistory] as const;
export type WorkOrder = typeof workOrders.$inferSelect;
