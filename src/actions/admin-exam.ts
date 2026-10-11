"use server";

import { db, schema } from "@/db";
import { eq, desc } from "drizzle-orm";
import { getAllExams } from "@/lib/data-service";

export async function getAllExamsAdminAction() {
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
  if (!db) return { success: false, error: "Chưa kết nối CSDL." };
  try {
    await db.delete(schema.exams).where(eq(schema.exams.id, examId));
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
