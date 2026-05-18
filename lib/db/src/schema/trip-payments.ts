import { pgTable, serial, integer, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tripsTable } from "./trips";
import { usersTable } from "./users";
import { transactionsTable } from "./transactions";

export const tripPaymentsTable = pgTable("trip_payments", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => tripsTable.id),
  passengerId: integer("passenger_id").notNull().references(() => usersTable.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("completed"), // pending | completed | failed
  transactionId: integer("transaction_id").references(() => transactionsTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTripPaymentSchema = createInsertSchema(tripPaymentsTable).omit({ id: true, createdAt: true });
export type InsertTripPayment = z.infer<typeof insertTripPaymentSchema>;
export type TripPayment = typeof tripPaymentsTable.$inferSelect;
