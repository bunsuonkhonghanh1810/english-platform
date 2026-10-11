import fs from "fs";
import path from "path";
import { db, schema } from "@/db";
import { eq, desc } from "drizzle-orm";
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
      if (found) return found;
    } catch (e) {
      console.warn("Neon DB getExamByCode failed, checking local store:", e);
    }
  }

  const store = getLocalStore();
  const exam = store.exams.find((e) => e.code.toUpperCase() === cleanCode);
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
  const newAttempt = {
    id: attemptId,
    userId,
    examId: attemptData.examId,
    attemptNumber: examAttemptsCount + 1,
    status: attemptData.status,
    answers: attemptData.answers,
    totalCorrect: attemptData.totalCorrect || 0,
    score: attemptData.score || 0,
    updatedAt: new Date().toISOString(),
    completedAt: attemptData.status === "completed" ? new Date().toISOString() : null,
  };

  if (existingIndex >= 0) {
    store.attempts[existingIndex] = newAttempt;
  } else {
    store.attempts.push(newAttempt);
  }

  saveLocalStore(store);
  return newAttempt;
}

export async function getAttemptsForExam(userId: string, examId: string) {
  const store = getLocalStore();
  return store.attempts.filter((a) => a.userId === userId && a.examId === examId);
}

export async function getAllUserAttempts(userId: string) {
  const store = getLocalStore();
  return store.attempts.filter((a) => a.userId === userId);
}
