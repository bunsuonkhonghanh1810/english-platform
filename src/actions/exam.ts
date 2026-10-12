"use server";

import { extractExamFromImages, ExtractedExamData } from "@/lib/gemini";
import { 
  saveExam, 
  updateExam,
  getExamByCode, 
  saveExamAttempt, 
  getRandomExam, 
  getAllExams,
  getExamDraft,
  deleteExamDraft,
  getUserActiveDrafts,
  getAllUserAttempts,
  getAttemptById,
  getLatestCompletedAttempt
} from "@/lib/data-service";
import { generateExamCode } from "@/lib/code-generator";
import { getCurrentUser } from "@/lib/auth";

export async function getExamAction(code: string) {
  try {
    const exam = await getExamByCode(code);
    return { success: true, exam };
  } catch (err: any) {
    console.error("Lỗi getExamAction:", err);
    return { success: false, error: err.message || "Không thể tải đề thi." };
  }
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new Error("Không có quyền thực hiện. Yêu cầu quyền Quản trị viên.");
  }
  return user;
}

export async function processExamImagesAction(imagesBase64: { mimeType: string; data: string }[]) {
  try {
    await requireAdmin();
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
    await requireAdmin();
    const saved = await saveExam(examData);
    return { success: true, exam: saved };
  } catch (err: any) {
    console.error("Lỗi saveExamAction:", err);
    return { success: false, error: err.message || "Không thể lưu đề thi." };
  }
}

export async function updateExamAction(
  examId: string,
  examData: {
    title: string;
    totalQuestions: number;
    code?: string;
    sections: any[];
  }
) {
  try {
    await requireAdmin();
    const updated = await updateExam(examId, examData);
    return { success: true, exam: updated };
  } catch (err: any) {
    console.error("Lỗi updateExamAction:", err);
    return { success: false, error: err.message || "Không thể cập nhật đề thi." };
  }
}

export async function submitExamAttemptAction(data: {
  userId?: string;
  examCode: string;
  answers: Record<string, { selected?: string; correctionInput?: string }>;
  status: "draft" | "completed";
}) {
  try {
    const user = await getCurrentUser();
    const effectiveUserId = data.userId || user?.id || "guest-user";

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
      userId: effectiveUserId,
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

export async function saveExamDraftAction(
  examCode: string, 
  answers: Record<string, { selected?: string; correctionInput?: string }>
) {
  return submitExamAttemptAction({
    examCode,
    answers,
    status: "draft",
  });
}

export async function getExamDraftAction(examCode: string) {
  try {
    const user = await getCurrentUser();
    const userId = user?.id || "guest-user";
    const draft = await getExamDraft(userId, examCode);
    return { success: true, draft };
  } catch (err: any) {
    console.error("Lỗi getExamDraftAction:", err);
    return { success: false, error: err.message || "Không thể đọc bản nháp." };
  }
}

export async function deleteExamDraftAction(examCode: string) {
  try {
    const user = await getCurrentUser();
    const userId = user?.id || "guest-user";
    await deleteExamDraft(userId, examCode);
    return { success: true };
  } catch (err: any) {
    console.error("Lỗi deleteExamDraftAction:", err);
    return { success: false, error: err.message || "Không thể xóa bản nháp." };
  }
}

export async function getUserDraftsAction() {
  try {
    const user = await getCurrentUser();
    const userId = user?.id || "guest-user";
    const drafts = await getUserActiveDrafts(userId);
    return { success: true, drafts };
  } catch (err: any) {
    console.error("Lỗi getUserDraftsAction:", err);
    return { success: false, error: err.message || "Không thể lấy danh sách bài làm dở." };
  }
}

export async function getUserHistoryAction() {
  try {
    const user = await getCurrentUser();
    const userId = user?.id || "guest-user";
    const history = await getAllUserAttempts(userId);
    return { success: true, history };
  } catch (err: any) {
    console.error("Lỗi getUserHistoryAction:", err);
    return { success: false, error: err.message || "Không thể lấy lịch sử làm bài." };
  }
}

export async function getAttemptDetailAction(attemptId?: string, examCode?: string) {
  try {
    const user = await getCurrentUser();
    const userId = user?.id || "guest-user";

    if (attemptId) {
      const attempt = await getAttemptById(attemptId);
      if (attempt) return { success: true, attempt };
    }

    if (examCode) {
      const latest = await getLatestCompletedAttempt(userId, examCode);
      if (latest) return { success: true, attempt: latest };
    }

    return { success: false, error: "Không tìm thấy dữ liệu bài làm." };
  } catch (err: any) {
    console.error("Lỗi getAttemptDetailAction:", err);
    return { success: false, error: err.message || "Không thể đọc dữ liệu bài làm." };
  }
}

export async function getRandomExamCodeAction() {
  const exam = await getRandomExam();
  return exam ? exam.code : "J4PRFE";
}
