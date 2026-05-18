import { Router, type IRouter } from "express";
import { eq, ilike, or, and } from "drizzle-orm";
import { db, usersTable, walletsTable } from "@workspace/db";
import {
  CreateUserBody,
  UpdateUserBody,
  GetUserParams,
  UpdateUserParams,
  DeleteUserParams,
  GetUserWalletParams,
  ListUsersQueryParams,
} from "@workspace/api-zod";
import { hashPin } from "../lib/auth";

const router: IRouter = Router();

function stripPin<T extends { pin?: string | null }>(user: T): Omit<T, "pin"> {
  const { pin: _pin, ...safe } = user;
  return safe;
}

router.get("/users", async (req, res): Promise<void> => {
  const query = ListUsersQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { role, status, search } = query.data;

  const conditions = [];
  if (role) conditions.push(eq(usersTable.role, role));
  if (status) conditions.push(eq(usersTable.status, status));
  if (search) {
    conditions.push(
      or(
        ilike(usersTable.name, `%${search}%`),
        ilike(usersTable.phone, `%${search}%`),
      )!,
    );
  }

  const users = await db
    .select()
    .from(usersTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(usersTable.createdAt);

  res.json(users.map(stripPin));
});

router.post("/users", async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.phone, parsed.data.phone));
  if (existing.length > 0) {
    res.status(409).json({ error: "Phone number already registered" });
    return;
  }

  const values: typeof parsed.data = { ...parsed.data };
  if (values.pin) {
    values.pin = await hashPin(values.pin);
  }

  const [user] = await db.insert(usersTable).values(values).returning();

  // Auto-create a wallet for the new user
  await db.insert(walletsTable).values({ userId: user.id, balance: "0.00" });

  res.status(201).json(stripPin(user));
});

router.get("/users/:id", async (req, res): Promise<void> => {
  const params = GetUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, params.data.id));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(stripPin(user));
});

router.patch("/users/:id", async (req, res): Promise<void> => {
  const params = UpdateUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: typeof parsed.data = { ...parsed.data };
  if (updateData.pin) {
    updateData.pin = await hashPin(updateData.pin);
  }

  const [user] = await db
    .update(usersTable)
    .set(updateData)
    .where(eq(usersTable.id, params.data.id))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(stripPin(user));
});

router.delete("/users/:id", async (req, res): Promise<void> => {
  const params = DeleteUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [user] = await db
    .delete(usersTable)
    .where(eq(usersTable.id, params.data.id))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/users/:userId/wallet", async (req, res): Promise<void> => {
  const params = GetUserWalletParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [wallet] = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.userId, params.data.userId));

  if (!wallet) {
    res.status(404).json({ error: "Wallet not found for user" });
    return;
  }

  res.json({
    ...wallet,
    balance: parseFloat(wallet.balance),
  });
});

export default router;
