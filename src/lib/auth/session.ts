import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/env";
import type { UserRecord } from "@/lib/db/models";
import * as repo from "@/lib/db/repository";

export const SESSION_COOKIE_NAME = "arr_hub_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const secretKey = new TextEncoder().encode(env.SESSION_SECRET);

/**
 * Sessions are DB-backed (survive a process restart, no sticky-session
 * requirement) — the cookie only carries a signed reference to the DB row's
 * id, so a session can be revoked server-side (logout, admin action)
 * independent of whether the client still holds the cookie.
 */
export async function createSessionCookie(userId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const sessionId = await repo.createSession(userId, expiresAt);
  const jwt = await new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secretKey);

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

async function readSessionIdFromCookie(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    const { payload } = await jwtVerify(raw, secretKey);
    return typeof payload.sid === "string" ? payload.sid : null;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<UserRecord | null> {
  const sessionId = await readSessionIdFromCookie();
  if (!sessionId) return null;
  const session = await repo.getSession(sessionId);
  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  return repo.getUserById(session.userId);
}

/** For use at the top of a server component/page: redirects to /login when there's no valid session. */
export async function requireUser(): Promise<UserRecord> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function destroySessionCookie(): Promise<void> {
  const sessionId = await readSessionIdFromCookie();
  if (sessionId) await repo.deleteSession(sessionId);
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}
