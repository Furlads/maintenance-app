// lib/password.ts
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string) {
  const cleanPassword = String(password ?? "");

  if (!cleanPassword) {
    throw new Error("Password cannot be empty.");
  }

  return bcrypt.hash(cleanPassword, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, stored: string) {
  try {
    const cleanPassword = String(password ?? "");
    const cleanStored = String(stored ?? "");

    if (!cleanPassword || !cleanStored) {
      return false;
    }

    return await bcrypt.compare(cleanPassword, cleanStored);
  } catch {
    return false;
  }
}