import fs from "fs";
import path from "path";
import { db, schema } from "@/db";
import { eq, desc, and } from "drizzle-orm";
import { SEED_EXAM } from "./seed-data";
import { generateExamCode } from "./code-generator";

const DATA_FILE = path.join(process.cwd(), "data", "exams_store.json");

interface LocalStore {
  exams: any[];
  attempts: any[];
}

function getLocalStore(): LocalStore {
  try {
    if (!fs.existsSync(path.dirname(DATA_FILE))) {
      fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("Lỗi đọc local store:", e);
  }
  const initial = {
    exams: [SEED_EXAM],
    attempts: [],
  };
  saveLocalStore(initial);
  return initial;
}

function saveLocalStore(store: LocalStore) {
  try {
    if (!fs.existsSync(path.dirname(DATA_FILE))) {
      fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch (e) {
    console.error("Lỗi ghi local store:", e);
  }
}

export async function getAllExams() {
  if (db) {
    try {
      const dbExams = await db.select().from(schema.exams).orderBy(desc(schema.exams.createdAt));
      if (dbExams.length > 0) return dbExams;
    } catch (e) {
      console.warn("Neon DB query failed, falling back to local store:", e);
    }
  }
  return getLocalStore().exams;
}

export async function getExamByCode(code: string) {
  const cleanCode = code.trim().toUpperCase();
  if (db) {
    try {
      const found = await db.query.exams.findFirst({
        where: eq(schema.exams.code, cleanCode),
        with: {
          sections: {
            with: {
              questions: true,
            },
          },
        },
      });
      if (found) {
        if (found.sections) {
          found.sections.sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0));
          found.sections.forEach((s: any) => {
            if (s.questions) {
              s.questions.sort((a: any, b: any) => (a.questionNumber || a.orderIndex || 0) - (b.questionNumber || b.orderIndex || 0));
            }
          });
        }
        return found;
      }
    } catch (e) {
      console.warn("Neon DB getExamByCode failed, checking local store:", e);
    }
  }

  const store = getLocalStore();
  const exam = store.exams.find((e) => e.code.toUpperCase() === cleanCode);
  if (exam && exam.sections) {
    exam.sections.sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0));
    exam.sections.forEach((s: any) => {
      if (s.questions) {
        s.questions.sort((a: any, b: any) => (a.questionNumber || a.orderIndex || 0) - (b.questionNumber || b.orderIndex || 0));
      }
    });
  }
  return exam || null;
}

export async function getExamById(id: string) {
  if (db) {
    try {
      const found = await db.query.exams.findFirst({
        where: eq(schema.exams.id, id),
        with: {
          sections: {
            with: {
              questions: true,
            },
          },
        },
      });
      if (found) {
        if (found.sections) {
          found.sections.sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0));
          found.sections.forEach((s: any) => {
            if (s.questions) {
              s.questions.sort((a: any, b: any) => (a.questionNumber || a.orderIndex || 0) - (b.questionNumber || b.orderIndex || 0));
            }
          });
        }
        return found;
      }
    } catch (e) {
      console.warn("Neon DB getExamById failed:", e);
    }
  }

  const store = getLocalStore();
  const exam = store.exams.find((e) => e.id === id);
  return exam || null;
}

export async function getRandomExam() {
  const exams = await getAllExams();
  if (!exams || exams.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * exams.length);
  const selected = exams[randomIndex];
  return getExamByCode(selected.code);
}

export async function saveExam(examData: {
  title: string;
  totalQuestions: number;
  code?: string;
  sections: any[];
}) {
  const code = examData.code ? examData.code.toUpperCase() : generateExamCode();
  const examId = "exam-" + Date.now();

  const formattedExam = {
    id: examId,
    code,
    title: examData.title,
    totalQuestions: examData.totalQuestions || 40,
    createdAt: new Date().toISOString(),
    sections: examData.sections.map((sec, secIdx) => ({
      id: "sec-" + examId + "-" + secIdx,
      title: sec.title,
      passageText: sec.passageText || null,
      orderIndex: secIdx + 1,
      questions: sec.questions.map((q: any, qIdx: number) => ({
        id: "q-" + examId + "-" + (q.questionNumber || qIdx + 1),
        questionNumber: q.questionNumber || qIdx + 1,
        questionType: q.questionType || "multiple_choice",
        prompt: q.prompt,
        options: q.options,
        underlinedParts: q.underlinedParts || null,
        correctAnswer: q.correctAnswer || "A",
        correctionText: q.correctionText || null,
        explanation: q.explanation || "",
        orderIndex: qIdx + 1,
      })),
    })),
  };

  // Lưu vào Neon DB nếu có
  if (db) {
    try {
      await db.insert(schema.exams).values({
        id: examId,
        code,
        title: examData.title,
        totalQuestions: examData.totalQuestions || 40,
      });

      for (const [secIdx, sec] of examData.sections.entries()) {
        const secId = "sec-" + examId + "-" + secIdx;
        await db.insert(schema.sections).values({
          id: secId,
          examId,
          title: sec.title,
          passageText: sec.passageText || null,
          orderIndex: secIdx + 1,
        });

        for (const [qIdx, q] of sec.questions.entries()) {
          await db.insert(schema.questions).values({
            id: "q-" + examId + "-" + (q.questionNumber || qIdx + 1),
            sectionId: secId,
            questionNumber: q.questionNumber || qIdx + 1,
            questionType: q.questionType || "multiple_choice",
            prompt: q.prompt,
            options: q.options,
            underlinedParts: q.underlinedParts || null,
            correctAnswer: q.correctAnswer || "A",
            correctionText: q.correctionText || null,
            explanation: q.explanation || "",
            orderIndex: qIdx + 1,
          });
        }
      }
    } catch (e) {
      console.warn("Neon DB insert failed, saving to local store:", e);
    }
  }

  // Luôn lưu bản sao vào local store
  const store = getLocalStore();
  store.exams.unshift(formattedExam);
  saveLocalStore(store);

  return formattedExam;
}

export async function updateExam(
  examId: string,
  examData: {
    title: string;
    totalQuestions: number;
    code?: string;
    sections: any[];
  }
) {
  const code = examData.code ? examData.code.toUpperCase() : undefined;

  let targetExamId = examId;
  if (db) {
    try {
      // Tìm exam theo id hoặc code
      let existing = await db.query.exams.findFirst({
        where: eq(schema.exams.id, examId),
      });

      if (!existing && code) {
        existing = await db.query.exams.findFirst({
          where: eq(schema.exams.code, code),
        });
      }

      if (existing) {
        targetExamId = existing.id;
        // 1. Cập nhật bảng exams
        await db
          .update(schema.exams)
          .set({
            title: examData.title,
            totalQuestions: examData.totalQuestions || 40,
            ...(code ? { code } : {}),
          })
          .where(eq(schema.exams.id, targetExamId));

        // 2. Xóa các sections cũ (cascade sẽ xóa toàn bộ câu hỏi liên quan)
        await db.delete(schema.sections).where(eq(schema.sections.examId, targetExamId));

        // 3. Chèn lại các sections và questions mới
        for (const [secIdx, sec] of examData.sections.entries()) {
          const secId = `sec-${targetExamId}-${secIdx}-${Date.now()}`;
          await db.insert(schema.sections).values({
            id: secId,
            examId: targetExamId,
            title: sec.title,
            passageText: sec.passageText || null,
            orderIndex: secIdx + 1,
          });

          for (const [qIdx, q] of sec.questions.entries()) {
            const qId = `q-${targetExamId}-${q.questionNumber || qIdx + 1}-${Date.now()}`;
            await db.insert(schema.questions).values({
              id: qId,
              sectionId: secId,
              questionNumber: q.questionNumber || qIdx + 1,
              questionType: q.questionType || "multiple_choice",
              prompt: q.prompt,
              options: q.options,
              underlinedParts: q.underlinedParts || null,
              correctAnswer: q.correctAnswer || "A",
              correctionText: q.correctionText || null,
              explanation: q.explanation || "",
              orderIndex: qIdx + 1,
            });
          }
        }
      }
    } catch (e) {
      console.warn("Neon DB updateExam failed, fallback updating local store:", e);
    }
  }

  const formattedExam = {
    id: targetExamId,
    code: code || "",
    title: examData.title,
    totalQuestions: examData.totalQuestions || 40,
    sections: examData.sections.map((sec, secIdx) => ({
      id: sec.id || `sec-${targetExamId}-${secIdx}`,
      title: sec.title,
      passageText: sec.passageText || null,
      orderIndex: secIdx + 1,
      questions: sec.questions.map((q: any, qIdx: number) => ({
        id: q.id || `q-${targetExamId}-${q.questionNumber || qIdx + 1}`,
        questionNumber: q.questionNumber || qIdx + 1,
        questionType: q.questionType || "multiple_choice",
        prompt: q.prompt,
        options: q.options,
        underlinedParts: q.underlinedParts || null,
        correctAnswer: q.correctAnswer || "A",
        correctionText: q.correctionText || null,
        explanation: q.explanation || "",
        orderIndex: qIdx + 1,
      })),
    })),
  };

  // Cập nhật local store
  const store = getLocalStore();
  const idx = store.exams.findIndex((e) => e.id === targetExamId || (code && e.code.toUpperCase() === code));
  if (idx !== -1) {
    store.exams[idx] = {
      ...store.exams[idx],
      ...formattedExam,
    };
  } else {
    store.exams.unshift(formattedExam);
  }
  saveLocalStore(store);

  return formattedExam;
}

export async function saveExamAttempt(attemptData: {
  userId?: string;
  examId: string;
  status: "draft" | "completed";
  answers: Record<string, { selected?: string; correctionInput?: string }>;
  totalCorrect?: number;
  score?: number;
}) {
  const store = getLocalStore();
  const userId = attemptData.userId || "guest-user";

  const existingIndex = store.attempts.findIndex(
    (a) => a.userId === userId && a.examId === attemptData.examId && a.status === "draft"
  );

  const examAttemptsCount = store.attempts.filter(
    (a) => a.userId === userId && a.examId === attemptData.examId && a.status === "completed"
  ).length;

  const attemptId = existingIndex >= 0 ? store.attempts[existingIndex].id : "att-" + Date.now();
  const now = new Date();
  const newAttempt = {
    id: attemptId,
    userId,
    examId: attemptData.examId,
    attemptNumber: examAttemptsCount + 1,
    status: attemptData.status,
    answers: attemptData.answers,
    totalCorrect: attemptData.totalCorrect || 0,
    score: attemptData.score || 0,
    startedAt: store.attempts[existingIndex]?.startedAt || now.toISOString(),
    updatedAt: now.toISOString(),
    completedAt: attemptData.status === "completed" ? now.toISOString() : null,
  };

  // 1. Lưu vào Neon DB nếu có kết nối
  if (db) {
    try {
      if (attemptData.status === "draft") {
        // Tìm TẤT CẢ bản nháp hiện có của user này cho exam này
        const allDrafts = await db.query.examAttempts.findMany({
          where: and(
            eq(schema.examAttempts.userId, userId),
            eq(schema.examAttempts.examId, attemptData.examId),
            eq(schema.examAttempts.status, "draft")
          ),
          orderBy: desc(schema.examAttempts.updatedAt),
        });

        if (allDrafts.length > 0) {
          const keepDraft = allDrafts[0];
          // Cập nhật bản nháp duy nhất
          await db
            .update(schema.examAttempts)
            .set({
              answers: attemptData.answers,
              updatedAt: now,
            })
            .where(eq(schema.examAttempts.id, keepDraft.id));

          // Xóa triệt để mọi bản nháp thừa nếu có
          if (allDrafts.length > 1) {
            for (let i = 1; i < allDrafts.length; i++) {
              await db
                .delete(schema.examAttempts)
                .where(eq(schema.examAttempts.id, allDrafts[i].id));
            }
          }
        } else {
          // Chưa có bản nháp nào -> tạo bản nháp mới
          await db.insert(schema.examAttempts).values({
            id: attemptId,
            userId,
            examId: attemptData.examId,
            attemptNumber: examAttemptsCount + 1,
            status: "draft",
            answers: attemptData.answers,
            totalCorrect: attemptData.totalCorrect || 0,
            score: String(attemptData.score || 0),
            startedAt: now,
            updatedAt: now,
            completedAt: null,
          });
        }
      } else {
        // Hoàn thành bài thi (status === "completed")
        // Xóa sạch bản nháp (nếu có) để không còn lưu bài dở
        await db
          .delete(schema.examAttempts)
          .where(
            and(
              eq(schema.examAttempts.userId, userId),
              eq(schema.examAttempts.examId, attemptData.examId),
              eq(schema.examAttempts.status, "draft")
            )
          );

        // Tạo bài làm nộp mới
        await db.insert(schema.examAttempts).values({
          id: attemptId,
          userId,
          examId: attemptData.examId,
          attemptNumber: examAttemptsCount + 1,
          status: "completed",
          answers: attemptData.answers,
          totalCorrect: attemptData.totalCorrect || 0,
          score: String(attemptData.score || 0),
          startedAt: store.attempts[existingIndex]?.startedAt || now,
          updatedAt: now,
          completedAt: now,
        });
      }
    } catch (e) {
      console.warn("Neon DB saveExamAttempt error, falling back to local store:", e);
    }
  }

  // 2. Lưu vào local store (Đảm bảo chỉ có tối đa 1 draft duy nhất cho mỗi đề)
  store.attempts = store.attempts.filter(
    (a) => !(a.userId === userId && a.examId === attemptData.examId && a.status === "draft")
  );
  store.attempts.push(newAttempt);
  saveLocalStore(store);

  return newAttempt;
}

export async function getExamDraft(userId: string = "guest-user", examIdOrCode: string) {
  // Tìm exam theo code hoặc id
  let exam = await getExamByCode(examIdOrCode);
  const examId = exam ? exam.id : examIdOrCode;

  if (db) {
    try {
      const dbDraft = await db.query.examAttempts.findFirst({
        where: and(
          eq(schema.examAttempts.userId, userId),
          eq(schema.examAttempts.examId, examId),
          eq(schema.examAttempts.status, "draft")
        ),
        with: {
          exam: true,
        },
      });

      if (dbDraft) {
        const answers = dbDraft.answers as Record<string, { selected?: string; correctionInput?: string }>;
        const answeredCount = Object.values(answers).filter(
          (a) => Boolean(a.selected) || Boolean(a.correctionInput?.trim())
        ).length;

        return {
          id: dbDraft.id,
          userId: dbDraft.userId,
          examId: dbDraft.examId,
          examCode: dbDraft.exam?.code || (exam ? exam.code : examIdOrCode),
          examTitle: dbDraft.exam?.title || (exam ? exam.title : "Đề thi"),
          status: "draft" as const,
          answers,
          answeredCount,
          totalQuestions: dbDraft.exam?.totalQuestions || exam?.totalQuestions || 40,
          updatedAt: dbDraft.updatedAt?.toISOString() || dbDraft.startedAt?.toISOString(),
        };
      }
    } catch (e) {
      console.warn("Neon DB getExamDraft error:", e);
    }
  }

  // Local fallback
  const store = getLocalStore();
  const localDraft = store.attempts.find(
    (a) => a.userId === userId && (a.examId === examId || a.examCode === examIdOrCode) && a.status === "draft"
  );

  if (localDraft) {
    const answers = localDraft.answers || {};
    const answeredCount = Object.values(answers).filter(
      (a: any) => Boolean(a.selected) || Boolean(a.correctionInput?.trim())
    ).length;
    return {
      id: localDraft.id,
      userId: localDraft.userId,
      examId: localDraft.examId,
      examCode: localDraft.examCode || (exam ? exam.code : examIdOrCode),
      examTitle: exam ? exam.title : "Đề thi",
      status: "draft" as const,
      answers,
      answeredCount,
      totalQuestions: exam?.totalQuestions || 40,
      updatedAt: localDraft.updatedAt || localDraft.startedAt || new Date().toISOString(),
    };
  }

  return null;
}

export async function deleteExamDraft(userId: string = "guest-user", examIdOrCode: string) {
  let exam = await getExamByCode(examIdOrCode);
  const examId = exam ? exam.id : examIdOrCode;

  if (db) {
    try {
      await db
        .delete(schema.examAttempts)
        .where(
          and(
            eq(schema.examAttempts.userId, userId),
            eq(schema.examAttempts.examId, examId),
            eq(schema.examAttempts.status, "draft")
          )
        );
    } catch (e) {
      console.warn("Neon DB deleteExamDraft error:", e);
    }
  }

  const store = getLocalStore();
  store.attempts = store.attempts.filter(
    (a) => !(a.userId === userId && (a.examId === examId || a.examCode === examIdOrCode) && a.status === "draft")
  );
  saveLocalStore(store);
  return { success: true };
}

export async function getAllUserAttempts(userId: string = "guest-user") {
  if (db) {
    try {
      const attempts = await db.query.examAttempts.findMany({
        where: eq(schema.examAttempts.userId, userId),
        with: {
          exam: true,
        },
        orderBy: desc(schema.examAttempts.updatedAt),
      });

      if (attempts && attempts.length > 0) {
        // Lọc bản nháp duy nhất: mỗi examId chỉ giữ đúng 1 bản draft mới nhất
        const seenDraftExams = new Set<string>();
        const deduplicated = attempts.filter((a) => {
          if (a.status === "draft") {
            if (seenDraftExams.has(a.examId)) return false;
            seenDraftExams.add(a.examId);
            return true;
          }
          return true;
        });

        return deduplicated.map((a) => {
          const answers = a.answers as Record<string, { selected?: string; correctionInput?: string }>;
          const answeredCount = Object.values(answers || {}).filter(
            (ans) => Boolean(ans.selected) || Boolean(ans.correctionInput?.trim())
          ).length;

          return {
            id: a.id,
            userId: a.userId,
            examId: a.examId,
            examCode: a.exam?.code || "ENG001",
            examTitle: a.exam?.title || "Đề thi",
            totalQuestions: a.exam?.totalQuestions || 40,
            attemptNumber: a.attemptNumber,
            status: a.status as "draft" | "completed",
            answers,
            answeredCount,
            totalCorrect: a.totalCorrect || 0,
            score: Number(a.score || 0),
            startedAt: a.startedAt?.toISOString(),
            updatedAt: a.updatedAt?.toISOString() || a.startedAt?.toISOString(),
            completedAt: a.completedAt?.toISOString(),
          };
        });
      }
    } catch (e) {
      console.warn("Neon DB getAllUserAttempts error:", e);
    }
  }

  const store = getLocalStore();
  return store.attempts.filter((a) => a.userId === userId);
}

export async function getUserActiveDrafts(userId: string = "guest-user") {
  const attempts = await getAllUserAttempts(userId);
  return attempts.filter((a: any) => a.status === "draft");
}

export async function getAttemptById(attemptId: string) {
  if (db) {
    try {
      const attempt = await db.query.examAttempts.findFirst({
        where: eq(schema.examAttempts.id, attemptId),
        with: {
          exam: true,
        },
      });
      if (attempt) {
        return {
          id: attempt.id,
          userId: attempt.userId,
          examId: attempt.examId,
          examCode: attempt.exam?.code || "J4PRFE",
          examTitle: attempt.exam?.title || "Đề thi",
          totalQuestions: attempt.exam?.totalQuestions || 40,
          status: attempt.status,
          answers: attempt.answers,
          totalCorrect: attempt.totalCorrect || 0,
          score: Number(attempt.score || 0),
          completedAt: attempt.completedAt?.toISOString(),
          updatedAt: attempt.updatedAt?.toISOString(),
        };
      }
    } catch (e) {
      console.warn("Neon DB getAttemptById error:", e);
    }
  }

  const store = getLocalStore();
  const found = store.attempts.find((a) => a.id === attemptId);
  return found || null;
}

export async function getLatestCompletedAttempt(userId: string, examCodeOrId: string) {
  let exam = await getExamByCode(examCodeOrId);
  const examId = exam ? exam.id : examCodeOrId;

  if (db) {
    try {
      const attempt = await db.query.examAttempts.findFirst({
        where: and(
          eq(schema.examAttempts.userId, userId),
          eq(schema.examAttempts.examId, examId),
          eq(schema.examAttempts.status, "completed")
        ),
        orderBy: desc(schema.examAttempts.completedAt),
        with: {
          exam: true,
        },
      });
      if (attempt) {
        return {
          id: attempt.id,
          userId: attempt.userId,
          examId: attempt.examId,
          examCode: attempt.exam?.code || examCodeOrId,
          examTitle: attempt.exam?.title || "Đề thi",
          totalQuestions: attempt.exam?.totalQuestions || 40,
          status: attempt.status,
          answers: attempt.answers,
          totalCorrect: attempt.totalCorrect || 0,
          score: Number(attempt.score || 0),
          completedAt: attempt.completedAt?.toISOString(),
        };
      }
    } catch (e) {
      console.warn("Neon DB getLatestCompletedAttempt error:", e);
    }
  }

  const store = getLocalStore();
  const completed = store.attempts.filter(
    (a) => a.userId === userId && (a.examId === examId || a.examCode === examCodeOrId) && a.status === "completed"
  );
  return completed[completed.length - 1] || null;
}
