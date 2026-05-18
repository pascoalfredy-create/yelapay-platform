import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import {
  db,
  tripsTable,
  tripPaymentsTable,
  transactionsTable,
  walletsTable,
  routesTable,
} from "@workspace/db";
import {
  ListTripsQueryParams,
  CreateTripBody,
  GetTripParams,
  UpdateTripBody,
  UpdateTripParams,
  PayForTripBody,
  PayForTripParams,
  ListTripPaymentsParams,
} from "@workspace/api-zod";
import { randomUUID } from "crypto";

const router: IRouter = Router();

const serializeTrip = (t: typeof tripsTable.$inferSelect) => ({
  ...t,
  totalCollected: parseFloat(t.totalCollected),
  endedAt: t.endedAt?.toISOString() ?? null,
});

router.get("/trips", async (req, res): Promise<void> => {
  const query = ListTripsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { routeId, driverId, vehicleId, status, limit, offset } = query.data;
  const conditions = [];
  if (routeId) conditions.push(eq(tripsTable.routeId, routeId));
  if (driverId) conditions.push(eq(tripsTable.driverId, driverId));
  if (vehicleId) conditions.push(eq(tripsTable.vehicleId, vehicleId));
  if (status) conditions.push(eq(tripsTable.status, status));

  const trips = await db
    .select()
    .from(tripsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(tripsTable.createdAt)
    .limit(limit ?? 50)
    .offset(offset ?? 0);

  res.json(trips.map(serializeTrip));
});

router.post("/trips", async (req, res): Promise<void> => {
  const parsed = CreateTripBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [trip] = await db
    .insert(tripsTable)
    .values({
      vehicleId: parsed.data.vehicleId,
      routeId: parsed.data.routeId,
      driverId: parsed.data.driverId,
      status: "active",
    })
    .returning();

  res.status(201).json(serializeTrip(trip));
});

router.get("/trips/:id", async (req, res): Promise<void> => {
  const params = GetTripParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [trip] = await db
    .select()
    .from(tripsTable)
    .where(eq(tripsTable.id, params.data.id));

  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  res.json(serializeTrip(trip));
});

router.patch("/trips/:id", async (req, res): Promise<void> => {
  const params = UpdateTripParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateTripBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "completed" || parsed.data.status === "cancelled") {
    updateData.endedAt = new Date();
  }

  const [trip] = await db
    .update(tripsTable)
    .set(updateData)
    .where(eq(tripsTable.id, params.data.id))
    .returning();

  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  res.json(serializeTrip(trip));
});

router.post("/trips/:id/pay", requireAuth, async (req, res): Promise<void> => {
  const params = PayForTripParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = PayForTripBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [trip] = await db
    .select()
    .from(tripsTable)
    .where(eq(tripsTable.id, params.data.id));

  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  if (trip.status !== "active") {
    res.status(400).json({ error: "Trip is not active" });
    return;
  }

  // Get fare from route if amount not provided
  let fare = parsed.data.amount;
  if (fare == null) {
    const [route] = await db
      .select()
      .from(routesTable)
      .where(eq(routesTable.id, trip.routeId));
    fare = route ? parseFloat(route.fare) : 0;
  }

  // Get passenger wallet
  const [passengerWallet] = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.userId, parsed.data.passengerId));

  if (!passengerWallet) {
    res.status(404).json({ error: "Passenger wallet not found" });
    return;
  }

  if (parseFloat(passengerWallet.balance) < fare) {
    res.status(400).json({ error: "Insufficient wallet balance" });
    return;
  }

  // Get driver wallet
  const [driverWallet] = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.userId, trip.driverId));

  if (!driverWallet) {
    res.status(404).json({ error: "Driver wallet not found" });
    return;
  }

  // Debit passenger
  await db
    .update(walletsTable)
    .set({ balance: sql`${walletsTable.balance} - ${fare}` })
    .where(eq(walletsTable.id, passengerWallet.id));

  // Credit driver
  await db
    .update(walletsTable)
    .set({ balance: sql`${walletsTable.balance} + ${fare}` })
    .where(eq(walletsTable.id, driverWallet.id));

  // Record transaction
  const [txn] = await db
    .insert(transactionsTable)
    .values({
      fromWalletId: passengerWallet.id,
      toWalletId: driverWallet.id,
      amount: String(fare),
      type: "payment",
      status: "completed",
      reference: randomUUID(),
      description: `Trip #${trip.id} fare payment`,
    })
    .returning();

  // Record trip payment
  const [tripPayment] = await db
    .insert(tripPaymentsTable)
    .values({
      tripId: trip.id,
      passengerId: parsed.data.passengerId,
      amount: String(fare),
      status: "completed",
      transactionId: txn.id,
    })
    .returning();

  // Update trip totals
  await db
    .update(tripsTable)
    .set({
      passengerCount: sql`${tripsTable.passengerCount} + 1`,
      totalCollected: sql`${tripsTable.totalCollected} + ${fare}`,
    })
    .where(eq(tripsTable.id, trip.id));

  res.status(201).json({
    ...tripPayment,
    amount: parseFloat(tripPayment.amount),
  });
});

router.get("/trips/:id/payments", async (req, res): Promise<void> => {
  const params = ListTripPaymentsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [trip] = await db
    .select()
    .from(tripsTable)
    .where(eq(tripsTable.id, params.data.id));

  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  const payments = await db
    .select()
    .from(tripPaymentsTable)
    .where(eq(tripPaymentsTable.tripId, params.data.id))
    .orderBy(tripPaymentsTable.createdAt);

  res.json(payments.map((p) => ({ ...p, amount: parseFloat(p.amount) })));
});

export default router;
