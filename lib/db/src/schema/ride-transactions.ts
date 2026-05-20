import { pgTable, serial, integer, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const rideTransactionsTable = pgTable("ride_transactions", {
  id: serial("id").primaryKey(),
  reference: text("reference"),
  driverId: integer("driver_id"),
  driverName: text("driver_name"),
  driverPlate: text("driver_plate"),
  passengerId: integer("passenger_id"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  commission: numeric("commission", { precision: 14, scale: 2 }),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 4 }),
  channel: text("channel"),
  model: text("model"),
  status: text("status").notNull().default("pending"),
  pax: integer("pax"),
  valPerPax: numeric("val_per_pax", { precision: 14, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRideTransactionSchema = createInsertSchema(rideTransactionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertRideTransaction = z.infer<typeof insertRideTransactionSchema>;
export type RideTransaction = typeof rideTransactionsTable.$inferSelect;
