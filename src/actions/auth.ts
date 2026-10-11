"use server";

import { db, schema } from "@/db";
import { eq, desc } from "drizzle-orm";
import { hashPassword, verifyPassword, setSessionCookie, clearSessionCookie, getCurrentUser, SessionUser } from "@/lib/auth";

export async function seedAdminIfNotExist() {
  if (!db) return;
  try {
    const existing = await db.select().from(schema.users).where(eq(schema.users.role, "admin")).limit(1);
    if (existing.length === 0) {
      const pwd = await hashPassword("admin123");
      await db.insert(schema.users).values({
        id: "admin-" + Date.now(),
        username: "admin",
        fullName: "Quản trị viên Hệ thống",
        email: "admin@englishplatform.com",
        passwordHash: pwd,
        role: "admin",
        status: "approved",
      });
      console.log("Seeded default admin user: admin / admin123");
    }
  } catch (e) {
    console.error("Lỗi seedAdminIfNotExist:", e);
  }
}

export async function loginAction(formData: { username: string; password: string }) {
  await seedAdminIfNotExist();
  const username = formData.username.trim();
  const password = formData.password;

  if (!username || !password) {
    return { success: false, error: "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu." };
  }

  if (!db) {
    // Local memory fallback login
    if (username === "admin" && password === "admin123") {
      const user: SessionUser = { id: "local-admin", username: "admin", role: "admin" };
      await setSessionCookie(user);
      return { success: true, user };
    }
    return { success: false, error: "CSDL chưa sẵn sàng. Vui lòng đăng nhập bằng admin / admin123." };
  }

  try {
    const found = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1);
    if (found.length === 0) {
      return { success: false, error: "Tên đăng nhập hoặc mật khẩu không chính xác." };
    }

    const user = found[0];
    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return { success: false, error: "Tên đăng nhập hoặc mật khẩu không chính xác." };
    }

    if (user.status === "pending") {
      return {
        success: false,
        error: "Tài khoản của bạn đang trong trạng thái CHỜ DUYỆT. Vui lòng liên hệ Quản trị viên để được phê duyệt kích hoạt.",
      };
    }

    if (user.status === "rejected") {
      return {
        success: false,
        error: "Tài khoản này đã bị từ chối truy cập. Vui lòng liên hệ Quản trị viên.",
      };
    }

    const sessionUser: SessionUser = {
      id: user.id,
      username: user.username,
      role: user.role as "admin" | "user",
    };

    await setSessionCookie(sessionUser);
    return { success: true, user: sessionUser };
  } catch (err: any) {
    console.error("Lỗi loginAction:", err);
    return { success: false, error: "Đã xảy ra lỗi khi đăng nhập. Vui lòng thử lại." };
  }
}

export async function registerAction(formData: {
  username: string;
  fullName?: string;
  email?: string;
  password: string;
}) {
  await seedAdminIfNotExist();
  const username = formData.username.trim();
  const password = formData.password;
  const fullName = formData.fullName?.trim() || username;
  const email = formData.email?.trim() || null;

  if (!username || !password) {
    return { success: false, error: "Vui lòng nhập tên đăng nhập và mật khẩu." };
  }
  if (password.length < 6) {
    return { success: false, error: "Mật khẩu phải có ít nhất 6 ký tự." };
  }

  if (!db) {
    return { success: false, error: "Chưa kết nối CSDL Neon Postgres." };
  }

  try {
    const existing = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1);
    if (existing.length > 0) {
      return { success: false, error: "Tên đăng nhập này đã có người sử dụng. Vui lòng chọn tên khác." };
    }

    const pwdHash = await hashPassword(password);
    const userId = "user-" + Date.now();

    await db.insert(schema.users).values({
      id: userId,
      username,
      fullName,
      email,
      passwordHash: pwdHash,
      role: "user",
      status: "pending", // Mặc định chờ admin duyệt!
    });

    return {
      success: true,
      message: "Đăng ký thành công! Tài khoản của bạn đang chờ Quản trị viên phê duyệt trước khi có thể đăng nhập.",
    };
  } catch (err: any) {
    console.error("Lỗi registerAction:", err);
    return { success: false, error: "Không thể đăng ký tài khoản. Vui lòng thử lại." };
  }
}

export async function logoutAction() {
  await clearSessionCookie();
  return { success: true };
}

export async function getAllUsersAction() {
  if (!db) return [];
  try {
    return await db.select().from(schema.users).orderBy(desc(schema.users.createdAt));
  } catch (e) {
    console.error("Lỗi getAllUsersAction:", e);
    return [];
  }
}

export async function updateUserStatusAction(userId: string, newStatus: "approved" | "rejected" | "pending") {
  if (!db) return { success: false, error: "Chưa kết nối CSDL." };
  try {
    await db.update(schema.users).set({ status: newStatus }).where(eq(schema.users.id, userId));
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function deleteUserAction(userId: string) {
  if (!db) return { success: false, error: "Chưa kết nối CSDL." };
  try {
    await db.delete(schema.users).where(eq(schema.users.id, userId));
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getCurrentUserAction() {
  await seedAdminIfNotExist();
  return await getCurrentUser();
}
