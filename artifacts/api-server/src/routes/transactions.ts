import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, rideTransactionsTable } from "@workspace/db";
import {
  ListTransactionsQueryParams,
  CreateTransactionBody,
  GetTransactionParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeRideTxn(t: typeof rideTransactionsTable.$inferSelect) {
  return {
    id: t.id,
    reference: t.reference,
    driver_id: t.driverId,
    driver_name: t.driverName,
    driver_plate: t.driverPlate,
    passenger_id: t.passengerId,
    amount: parseFloat(t.amount),
    commission: t.commission != null ? parseFloat(t.commission) : null,
    commission_rate: t.commissionRate != null ? parseFloat(t.commissionRate) : null,
    channel: t.channel,
    model: t.model,
    status: t.status,
    pax: t.pax,
    val_per_pax: t.valPerPax != null ? parseFloat(t.valPerPax) : null,
    created_at: t.createdAt,
  };
}

router.get("/transactions", async (req, res): Promise<void> => {
  const query = ListTransactionsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { status, driverId, passengerId, channel, model, limit, offset } = query.data;
  const conditions: ReturnType<typeof eq>[] = [];

  if (status) conditions.push(eq(rideTransactionsTable.status, status));
  if (driverId) conditions.push(eq(rideTransactionsTable.driverId, driverId));
  if (passengerId) conditions.push(eq(rideTransactionsTable.passengerId, passengerId));
  if (channel) conditions.push(eq(rideTransactionsTable.channel, channel));
  if (model) conditions.push(eq(rideTransactionsTable.model, model));

  const txns = await db
    .select()
    .from(rideTransactionsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(rideTransactionsTable.createdAt))
    .limit(limit ?? 50)
    .offset(offset ?? 0);

  res.json(txns.map(serializeRideTxn));
});

router.post("/transactions", async (req, res): Promise<void> => {
  const body = CreateTransactionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const {
    reference,
    driver_id,
    driver_name,
    driver_plate,
    passenger_id,
    amount,
    commission,
    commission_rate,
    channel,
    model,
    status,
    pax,
    val_per_pax,
  } = body.data;

  const [created] = await db
    .insert(rideTransactionsTable)
    .values({
      reference: reference ?? null,
      driverId: driver_id ?? null,
      driverName: driver_name ?? null,
      driverPlate: driver_plate ?? null,
      passengerId: passenger_id ?? null,
      amount: String(amount),
      commission: commission != null ? String(commission) : null,
      commissionRate: commission_rate != null ? String(commission_rate) : null,
      channel: channel ?? null,
      model: model ?? null,
      status: status ?? "pending",
      pax: pax ?? null,
      valPerPax: val_per_pax != null ? String(val_per_pax) : null,
    })
    .returning();

  res.status(201).json(serializeRideTxn(created));
});

router.get("/transactions/:id", async (req, res): Promise<void> => {
  const params = GetTransactionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [txn] = await db
    .select()
    .from(rideTransactionsTable)
    .where(eq(rideTransactionsTable.id, params.data.id));

  if (!txn) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }

  res.json(serializeRideTxn(txn));
});

export default router;
