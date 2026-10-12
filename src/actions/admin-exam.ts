"use server";

import { db, schema } from "@/db";
import { eq, desc } from "drizzle-orm";
import { getAllExams } from "@/lib/data-service";
import { getCurrentUser } from "@/lib/auth";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new Error("Không có quyền thực hiện. Yêu cầu quyền Quản trị viên.");
  }
  return user;
}

export async function getAllExamsAdminAction() {
  try {
    await requireAdmin();
  } catch {
    return [];
  }

  if (!db) {
    const local = await getAllExams();
    return local.map((e) => ({
      ...e,
      sectionsCount: e.sections?.length || 0,
      attemptsCount: 0,
    }));
  }

  try {
    const list = await db.select().from(schema.exams).orderBy(desc(schema.exams.createdAt));
    const results = [];
    for (const exam of list) {
      const sects = await db.select().from(schema.sections).where(eq(schema.sections.examId, exam.id));
      const atts = await db.select().from(schema.examAttempts).where(eq(schema.examAttempts.examId, exam.id));
      results.push({
        ...exam,
        sectionsCount: sects.length,
        attemptsCount: atts.length,
      });
    }
    return results;
  } catch (e) {
    console.error("Lỗi getAllExamsAdminAction:", e);
    return [];
  }
}

export async function deleteExamAction(examId: string) {
  try {
    await requireAdmin();
    if (!db) return { success: false, error: "Chưa kết nối CSDL." };
    await db.delete(schema.exams).where(eq(schema.exams.id, examId));
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || "Lỗi xóa đề thi." };
  }
}
