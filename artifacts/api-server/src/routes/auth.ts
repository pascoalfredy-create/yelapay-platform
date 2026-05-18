import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { LoginBody, SetPinBody, SetupPinBody } from "@workspace/api-zod";
import { signToken, hashPin, verifyPin } from "../lib/auth";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

function stripPin<T extends { pin?: string | null }>(user: T): Omit<T, "pin"> {
  const { pin: _pin, ...safe } = user;
  return safe;
}

/**
 * POST /auth/login
 * Authenticate with phone + PIN, returns a JWT.
 */
router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { phone, pin } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.phone, phone));

  if (!user) {
    res.status(401).json({ error: "Invalid phone or PIN" });
    return;
  }

  if (!user.pin) {
    res.status(401).json({ error: "No PIN set. Use /auth/setup-pin to create one." });
    return;
  }

  if (user.status === "suspended") {
    res.status(401).json({ error: "Account is suspended" });
    return;
  }

  const valid = await verifyPin(pin, user.pin);
  if (!valid) {
    res.status(401).json({ error: "Invalid phone or PIN" });
    return;
  }

  const token = signToken({ userId: user.id, role: user.role });
  res.json({ token, user: stripPin(user) });
});

/**
 * POST /auth/setup-pin
 * Set a PIN for the first time (no existing PIN on account).
 * Returns a JWT so the user is immediately logged in.
 */
router.post("/auth/setup-pin", async (req, res): Promise<void> => {
  const parsed = SetupPinBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { phone, pin } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.phone, phone));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (user.pin) {
    res.status(400).json({ error: "PIN already set. Use /auth/set-pin to change it." });
    return;
  }

  if (user.status === "suspended") {
    res.status(400).json({ error: "Account is suspended" });
    return;
  }

  const hashedPin = await hashPin(pin);
  const [updated] = await db
    .update(usersTable)
    .set({ pin: hashedPin })
    .where(eq(usersTable.id, user.id))
    .returning();

  const token = signToken({ userId: updated.id, role: updated.role });
  res.json({ token, user: stripPin(updated) });
});

/**
 * GET /auth/me
 * Return the currently authenticated user.
 */
router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId));

  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json(stripPin(user));
});

/**
 * POST /auth/set-pin
 * Change an existing PIN. Requires Bearer token + current PIN.
 */
router.post("/auth/set-pin", requireAuth, async (req, res): Promise<void> => {
  const parsed = SetPinBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId));

  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  if (!user.pin) {
    res.status(400).json({ error: "No PIN set. Use /auth/setup-pin first." });
    return;
  }

  const validCurrent = await verifyPin(parsed.data.currentPin, user.pin);
  if (!validCurrent) {
    res.status(400).json({ error: "currentPin is incorrect" });
    return;
  }

  const hashedPin = await hashPin(parsed.data.pin);
  const [updated] = await db
    .update(usersTable)
    .set({ pin: hashedPin })
    .where(eq(usersTable.id, req.user!.userId))
    .returning();

  res.json(stripPin(updated));
});

export default router;
