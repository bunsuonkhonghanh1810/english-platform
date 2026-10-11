"use server";

import { extractExamFromImages, ExtractedExamData } from "@/lib/gemini";
import { saveExam, getExamByCode, saveExamAttempt, getRandomExam, getAllExams } from "@/lib/data-service";
import { generateExamCode } from "@/lib/code-generator";

export async function processExamImagesAction(imagesBase64: { mimeType: string; data: string }[]) {
  try {
    if (!imagesBase64 || imagesBase64.length === 0) {
      return { success: false, error: "Vui lòng chọn ít nhất 1 ảnh đề thi." };
    }
    const data = await extractExamFromImages(imagesBase64);
    const suggestedCode = generateExamCode();
    return { success: true, data, suggestedCode };
  } catch (err: any) {
    console.error("Lỗi processExamImagesAction:", err);
    return { success: false, error: err.message || "Không thể phân tích ảnh qua Gemini." };
  }
}

export async function saveExamAction(examData: {
  title: string;
  totalQuestions: number;
  code?: string;
  sections: any[];
}) {
  try {
    const saved = await saveExam(examData);
    return { success: true, exam: saved };
  } catch (err: any) {
    console.error("Lỗi saveExamAction:", err);
    return { success: false, error: err.message || "Không thể lưu đề thi." };
  }
}

export async function submitExamAttemptAction(data: {
  userId?: string;
  examCode: string;
  answers: Record<string, { selected?: string; correctionInput?: string }>;
  status: "draft" | "completed";
}) {
  try {
    const exam = await getExamByCode(data.examCode);
    if (!exam) {
      return { success: false, error: "Không tìm thấy đề thi." };
    }

    let totalCorrect = 0;
    let allQuestions: any[] = [];
    for (const sec of exam.sections) {
      allQuestions = allQuestions.concat(sec.questions);
    }

    const totalQuestions = exam.totalQuestions || allQuestions.length || 40;

    for (const q of allQuestions) {
      const qNum = String(q.questionNumber);
      const studentAns = data.answers[qNum]?.selected?.toUpperCase();
      if (studentAns && studentAns === q.correctAnswer?.toUpperCase()) {
        totalCorrect++;
      }
    }

    const score = Number(((totalCorrect / totalQuestions) * 10).toFixed(2));

    const attempt = await saveExamAttempt({
      userId: data.userId || "guest-student",
      examId: exam.id,
      status: data.status,
      answers: data.answers,
      totalCorrect,
      score,
    });

    return {
      success: true,
      attempt,
      totalCorrect,
      totalQuestions,
      score,
    };
  } catch (err: any) {
    console.error("Lỗi submitExamAttemptAction:", err);
    return { success: false, error: err.message || "Không thể lưu kết quả làm bài." };
  }
}

export async function getRandomExamCodeAction() {
  const exam = await getRandomExam();
  return exam ? exam.code : "ENG001";
}
