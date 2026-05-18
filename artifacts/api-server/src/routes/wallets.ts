import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, walletsTable, transactionsTable } from "@workspace/db";
import {
  TopUpWalletBody,
  TopUpWalletParams,
  TransferFundsBody,
} from "@workspace/api-zod";
import { randomUUID } from "crypto";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

router.post("/wallets/:id/topup", requireAuth, async (req, res): Promise<void> => {
  const params = TopUpWalletParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = TopUpWalletBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [wallet] = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.id, params.data.id));

  if (!wallet) {
    res.status(404).json({ error: "Wallet not found" });
    return;
  }

  const amount = parsed.data.amount;

  const [updated] = await db
    .update(walletsTable)
    .set({ balance: sql`${walletsTable.balance} + ${amount}` })
    .where(eq(walletsTable.id, wallet.id))
    .returning();

  await db.insert(transactionsTable).values({
    toWalletId: wallet.id,
    amount: String(amount),
    type: "topup",
    status: "completed",
    reference: randomUUID(),
    description: `Top-up of ${amount} AOA`,
  });

  res.json({ ...updated, balance: parseFloat(updated.balance) });
});

router.post("/wallets/transfer", requireAuth, async (req, res): Promise<void> => {
  const parsed = TransferFundsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { fromWalletId, toWalletId, amount, description } = parsed.data;

  if (fromWalletId === toWalletId) {
    res.status(400).json({ error: "Cannot transfer to the same wallet" });
    return;
  }

  const [fromWallet] = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.id, fromWalletId));

  if (!fromWallet) {
    res.status(404).json({ error: "Source wallet not found" });
    return;
  }

  const [toWallet] = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.id, toWalletId));

  if (!toWallet) {
    res.status(404).json({ error: "Destination wallet not found" });
    return;
  }

  if (parseFloat(fromWallet.balance) < amount) {
    res.status(400).json({ error: "Insufficient wallet balance" });
    return;
  }

  await db
    .update(walletsTable)
    .set({ balance: sql`${walletsTable.balance} - ${amount}` })
    .where(eq(walletsTable.id, fromWalletId));

  await db
    .update(walletsTable)
    .set({ balance: sql`${walletsTable.balance} + ${amount}` })
    .where(eq(walletsTable.id, toWalletId));

  const [transaction] = await db
    .insert(transactionsTable)
    .values({
      fromWalletId,
      toWalletId,
      amount: String(amount),
      type: "transfer",
      status: "completed",
      reference: randomUUID(),
      description: description ?? `Transfer of ${amount} AOA`,
    })
    .returning();

  res.json({
    ...transaction,
    amount: parseFloat(transaction.amount),
  });
});

export default router;
