import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export interface SessionUser {
  id: string;
  username: string;
  role: "admin" | "user";
}

const SESSION_COOKIE_NAME = "english_platform_session";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function setSessionCookie(user: SessionUser) {
  const cookieStore = await cookies();
  const value = Buffer.from(JSON.stringify(user)).toString("base64");
  cookieStore.set(SESSION_COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
    if (!sessionCookie?.value) return null;

    const decoded = Buffer.from(sessionCookie.value, "base64").toString("utf-8");
    const sessionUser: SessionUser = JSON.parse(decoded);
    if (!sessionUser?.id) return null;

    // BẢO MẬT: Kiểm tra lại với Neon DB để xác minh quyền và trạng thái thực tế
    if (db) {
      const dbUser = await db.query.users.findFirst({
        where: eq(schema.users.id, sessionUser.id),
      });
      if (!dbUser || dbUser.status !== "approved") {
        return null;
      }
      return {
        id: dbUser.id,
        username: dbUser.username,
        role: dbUser.role as "admin" | "user",
      };
    }

    return sessionUser;
  } catch {
    return null;
  }
}
