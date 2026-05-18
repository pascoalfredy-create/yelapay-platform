import { Router, type IRouter } from "express";
import { eq, count, sum } from "drizzle-orm";
import {
  db,
  usersTable,
  vehiclesTable,
  routesTable,
  tripsTable,
  transactionsTable,
  walletsTable,
} from "@workspace/db";

const router: IRouter = Router();

router.get("/stats", async (_req, res): Promise<void> => {
  const [totalUsersRow] = await db.select({ total: count() }).from(usersTable);
  const [driversRow] = await db
    .select({ total: count() })
    .from(usersTable)
    .where(eq(usersTable.role, "driver"));
  const [passengersRow] = await db
    .select({ total: count() })
    .from(usersTable)
    .where(eq(usersTable.role, "passenger"));
  const [vehiclesRow] = await db.select({ total: count() }).from(vehiclesTable);
  const [routesRow] = await db.select({ total: count() }).from(routesTable);
  const [activeTripsRow] = await db
    .select({ total: count() })
    .from(tripsTable)
    .where(eq(tripsTable.status, "active"));
  const [completedTripsRow] = await db
    .select({ total: count() })
    .from(tripsTable)
    .where(eq(tripsTable.status, "completed"));
  const [txnRow] = await db.select({ total: count() }).from(transactionsTable);
  const [volumeRow] = await db
    .select({ total: sum(transactionsTable.amount) })
    .from(transactionsTable)
    .where(eq(transactionsTable.status, "completed"));
  const [balanceRow] = await db
    .select({ total: sum(walletsTable.balance) })
    .from(walletsTable);

  res.json({
    totalUsers: totalUsersRow?.total ?? 0,
    totalDrivers: driversRow?.total ?? 0,
    totalPassengers: passengersRow?.total ?? 0,
    totalVehicles: vehiclesRow?.total ?? 0,
    totalRoutes: routesRow?.total ?? 0,
    activeTrips: activeTripsRow?.total ?? 0,
    completedTrips: completedTripsRow?.total ?? 0,
    totalTransactions: txnRow?.total ?? 0,
    totalVolume: parseFloat(volumeRow?.total ?? "0"),
    totalWalletBalance: parseFloat(balanceRow?.total ?? "0"),
  });
});

export default router;
