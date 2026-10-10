import { cookies } from "next/headers";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  SESSION_COOKIE_MAX_AGE,
  SESSION_COOKIE_NAME,
} from "@/lib/config/env";

/**
 * Guest sessions.
 *
 * A session is a random 32-byte token bound to a participant.
 * Only its SHA-256 hash is stored in PocketBase; the token
 * itself lives in an httpOnly cookie. Refreshing the page keeps
 * the session; room expiry is enforced server-side.
 */

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function newRoomToken(): string {
  return randomBytes(9).toString("base64url"); // 12 chars
}

export function newSlugSuffix(): string {
  return randomBytes(2).toString("base64url"); // 4 chars
}

export interface Session {
  participantId: string;
  token: string;
}

export async function setSessionCookie(
  participantId: string,
  token: string,
): Promise<void> {
  (await cookies()).set(SESSION_COOKIE_NAME, `${participantId}.${token}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE_NAME);
}

export async function getSession(): Promise<Session | null> {
  const raw = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;
  const dot = raw.indexOf(".");
  if (dot < 1 || dot === raw.length - 1) return null;
  return {
    participantId: raw.slice(0, dot),
    token: raw.slice(dot + 1),
  };
}
