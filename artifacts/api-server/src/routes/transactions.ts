import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, transactionsTable, walletsTable } from "@workspace/db";
import {
  ListTransactionsQueryParams,
  GetTransactionParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/transactions", async (req, res): Promise<void> => {
  const query = ListTransactionsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { walletId, userId, type, status, limit, offset } = query.data;
  const conditions: ReturnType<typeof eq>[] = [];

  if (type) conditions.push(eq(transactionsTable.type, type));
  if (status) conditions.push(eq(transactionsTable.status, status));

  if (userId) {
    const wallets = await db
      .select({ id: walletsTable.id })
      .from(walletsTable)
      .where(eq(walletsTable.userId, userId));
    const wid = wallets[0]?.id;
    if (wid) conditions.push(eq(transactionsTable.toWalletId, wid));
  } else if (walletId) {
    conditions.push(eq(transactionsTable.toWalletId, walletId));
  }

  const txns = await db
    .select()
    .from(transactionsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(transactionsTable.createdAt))
    .limit(limit ?? 50)
    .offset(offset ?? 0);

  res.json(
    txns.map((t) => ({
      ...t,
      amount: parseFloat(t.amount),
    })),
  );
});

router.get("/transactions/:id", async (req, res): Promise<void> => {
  const params = GetTransactionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [txn] = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.id, params.data.id));

  if (!txn) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }

  res.json({ ...txn, amount: parseFloat(txn.amount) });
});

export default router;
