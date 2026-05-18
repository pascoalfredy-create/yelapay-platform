import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const SECRET = process.env.SESSION_SECRET;
if (!SECRET) throw new Error("SESSION_SECRET env var must be set");

const SALT_ROUNDS = 10;
const TOKEN_TTL = "7d";

export interface JwtPayload {
  userId: number;
  role: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET!, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET!) as JwtPayload;
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, SALT_ROUNDS);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}
