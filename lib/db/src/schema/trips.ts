import { pgTable, serial, integer, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { vehiclesTable } from "./vehicles";
import { routesTable } from "./routes";
import { usersTable } from "./users";

export const tripsTable = pgTable("trips", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id").notNull().references(() => vehiclesTable.id),
  routeId: integer("route_id").notNull().references(() => routesTable.id),
  driverId: integer("driver_id").notNull().references(() => usersTable.id),
  status: text("status").notNull().default("active"), // active | completed | cancelled
  passengerCount: integer("passenger_count").notNull().default(0),
  totalCollected: numeric("total_collected", { precision: 14, scale: 2 }).notNull().default("0.00"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTripSchema = createInsertSchema(tripsTable).omit({ id: true, createdAt: true, passengerCount: true, totalCollected: true });
export type InsertTrip = z.infer<typeof insertTripSchema>;
export type Trip = typeof tripsTable.$inferSelect;
