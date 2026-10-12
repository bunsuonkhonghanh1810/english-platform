"use server";

import { db, schema } from "@/db";
import { eq, desc } from "drizzle-orm";
import { hashPassword, verifyPassword, setSessionCookie, clearSessionCookie, getCurrentUser, SessionUser } from "@/lib/auth";

export async function loginAction(formData: { username: string; password: string }) {
  const username = formData.username.trim();
  const password = formData.password;

  if (!username || !password) {
    return { success: false, error: "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu." };
  }

  if (!db) {
    return { success: false, error: "CSDL chưa sẵn sàng. Vui lòng thử lại sau." };
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

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new Error("Không có quyền truy cập. Yêu cầu tài khoản Quản trị viên.");
  }
  return user;
}

export async function getAllUsersAction() {
  try {
    await requireAdmin();
    if (!db) return [];
    // BẢO MẬT: Chỉ select các trường công khai, TUYỆT ĐỐI KHÔNG trả về passwordHash
    return await db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        fullName: schema.users.fullName,
        email: schema.users.email,
        role: schema.users.role,
        status: schema.users.status,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .orderBy(desc(schema.users.createdAt));
  } catch (e) {
    console.error("Lỗi getAllUsersAction:", e);
    return [];
  }
}

export async function updateUserStatusAction(userId: string, newStatus: "approved" | "rejected" | "pending") {
  try {
    const admin = await requireAdmin();
    if (admin.id === userId) {
      return { success: false, error: "Không thể tự thay đổi trạng thái của chính tài khoản Quản trị đang đăng nhập." };
    }
    if (!db) return { success: false, error: "Chưa kết nối CSDL." };
    await db.update(schema.users).set({ status: newStatus }).where(eq(schema.users.id, userId));
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || "Lỗi cập nhật trạng thái người dùng." };
  }
}

export async function deleteUserAction(userId: string) {
  try {
    const admin = await requireAdmin();
    if (admin.id === userId) {
      return { success: false, error: "Không thể tự xóa tài khoản Quản trị đang đăng nhập." };
    }
    if (!db) return { success: false, error: "Chưa kết nối CSDL." };
    await db.delete(schema.users).where(eq(schema.users.id, userId));
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || "Lỗi xóa người dùng." };
  }
}

export async function getCurrentUserAction() {
  return await getCurrentUser();
}
