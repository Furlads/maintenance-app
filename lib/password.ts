// lib/password.ts
import crypto from "crypto";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEYLEN = 32;

function b64(input: Buffer) {
  return input.toString("base64");
}
function unb64(input: string) {
  return Buffer.from(input, "base64");
}

/**
 * Stored format:
 * scrypt$N$r$p$saltBase64$hashBase64
 */
export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const key = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey as Buffer);
    });
  });

  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${b64(salt)}$${b64(key)}`;
}

export async function verifyPassword(password: string, stored: string) {
  try {
    const parts = stored.split("$");
    if (parts.length !== 6) return false;

    const [algo, nStr, rStr, pStr, saltB64, hashB64] = parts;
    if (algo !== "scrypt") return false;

    const N = Number(nStr);
    const r = Number(rStr);
    const p = Number(pStr);

    const salt = unb64(saltB64);
    const expected = unb64(hashB64);

    const key = await new Promise<Buffer>((resolve, reject) => {
      crypto.scrypt(password, salt, expected.length, { N, r, p }, (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey as Buffer);
      });
    });

    if (key.length !== expected.length) return false;
    return crypto.timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}