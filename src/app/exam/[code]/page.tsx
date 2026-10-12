"use client";

import { useState, useEffect, use, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  CheckCircle2, AlertCircle, Bookmark, Save, Send, Eye, RefreshCw, 
  ChevronLeft, Award, HelpCircle, Filter, ArrowRight, ArrowDown, 
  Clock, Check, Trash2, BookmarkCheck, History, CheckCheck, X
} from "lucide-react";
import { 
  getExamAction, 
  getExamDraftAction, 
  saveExamDraftAction, 
  deleteExamDraftAction, 
  submitExamAttemptAction,
  getAttemptDetailAction
} from "@/actions/exam";
import { getCurrentUserAction } from "@/actions/auth";
import { SEED_EXAM } from "@/lib/seed-data";

interface Question {
  id: string;
  questionNumber: number;
  questionType: string;
  prompt: string;
  options: { A: string; B: string; C: string; D: string };
  underlinedParts?: Record<string, string>;
  correctAnswer: string;
  correctionText?: string;
  explanation: string;
}

interface Section {
  id: string;
  title: string;
  passageText?: string | null;
  questions: Question[];
}

interface ExamData {
  id: string;
  code: string;
  title: string;
  totalQuestions: number;
  sections: Section[];
}

function ExamContent({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = use(params);
  const examCode = resolvedParams.code.toUpperCase();
  const searchParams = useSearchParams();
  const router = useRouter();

  const queryMode = searchParams.get("mode");
  const effectiveMode: "test" | "study" | "review" = 
    queryMode === "study" 
      ? "study" 
      : queryMode === "review" 
      ? "review" 
      : "test";
  const [mode, setMode] = useState<"test" | "study" | "review">(effectiveMode);

  // Tự động đồng bộ mode khi URL query thay đổi (?mode=test <-> ?mode=study)
  useEffect(() => {
    setMode(effectiveMode);
  }, [effectiveMode]);
  const [exam, setExam] = useState<ExamData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("guest");

  // User Answers State: { [qNum]: { selected: 'A', correctionInput: 'were' } }
  const [answers, setAnswers] = useState<Record<string, { selected?: string; correctionInput?: string }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [scoreResult, setScoreResult] = useState<{ totalCorrect: number; totalQuestions: number; score: number } | null>(null);
  const [showOnlyWrong, setShowOnlyWrong] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");

  // Draft specific state
  const [isDraftRestored, setIsDraftRestored] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string>("");
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [readingPassageModal, setReadingPassageModal] = useState<{ title: string; text: string } | null>(null);

  // Load Exam Data & User-scoped Drafts / Review attempts
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      try {
        // 0. Xác định tài khoản hiện tại
        const user = await getCurrentUserAction();
        const uid = user?.id || "guest";
        if (isMounted) setCurrentUserId(uid);

        let loadedExam: ExamData | null = null;

        // 1. Thử tải đề từ Server Action (Neon DB)
        const examRes = await getExamAction(examCode);
        if (examRes.success && examRes.exam) {
          loadedExam = examRes.exam as ExamData;
        }

        // 2. Fallback sang local store nếu không thấy trên DB
        if (!loadedExam) {
          const savedStore = localStorage.getItem("english_platform_store");
          if (savedStore) {
            const parsed = JSON.parse(savedStore);
            loadedExam = parsed.exams?.find((e: any) => e.code?.toUpperCase() === examCode);
          }
        }

        // 3. Fallback sang SEED_EXAM
        if (!loadedExam && (examCode === "J4PRFE" || examCode === "ENG001")) {
          loadedExam = SEED_EXAM as unknown as ExamData;
        }

        if (isMounted) {
          setExam(loadedExam || (SEED_EXAM as unknown as ExamData));
        }

        // 4. Xử lý dữ liệu đáp án theo Mode
        if (mode === "review") {
          // CHẾ ĐỘ XEM LẠI BÀI ĐÃ NỘP: Chỉ tải đáp án của lần nộp đó, KHÔNG đụng đến bản nháp!
          const attemptId = searchParams.get("attemptId");
          const attRes = await getAttemptDetailAction(attemptId || undefined, examCode);
          if (attRes.success && attRes.attempt) {
            if (isMounted) {
              setAnswers(attRes.attempt.answers || {});
              setScoreResult({
                totalCorrect: attRes.attempt.totalCorrect || 0,
                totalQuestions: attRes.attempt.totalQuestions || 40,
                score: attRes.attempt.score || 0,
              });
            }
          }
          if (isMounted) setIsDraftRestored(false);
        } else if (mode === "study") {
          // CHẾ ĐỘ XEM ĐỀ & LỜI GIẢI: Không tải nháp
          if (isMounted) {
            setAnswers({});
            setIsDraftRestored(false);
          }
        } else {
          // CHẾ ĐỘ LÀM BÀI: Tải bản nháp được SCOPED RIÊNG theo user ID
          const draftKey = `draft_${uid}_${examCode}`;
          let restoredAnswers: Record<string, { selected?: string; correctionInput?: string }> = {};
          let savedTime = "";

          // Kiểm tra localStorage của đúng user này
          const localDraft = localStorage.getItem(draftKey);
          if (localDraft) {
            try {
              restoredAnswers = JSON.parse(localDraft);
              savedTime = "gần đây (trên máy)";
            } catch {}
          }

          // Kiểm tra trên Server (Neon DB) của đúng user này
          const draftRes = await getExamDraftAction(examCode);
          if (draftRes.success && draftRes.draft && draftRes.draft.answers) {
            const dbAnswers = draftRes.draft.answers;
            if (Object.keys(dbAnswers).length >= Object.keys(restoredAnswers).length) {
              restoredAnswers = { ...restoredAnswers, ...dbAnswers };
              if (draftRes.draft.updatedAt) {
                savedTime = new Date(draftRes.draft.updatedAt).toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
              }
            }
          }

          if (isMounted && Object.keys(restoredAnswers).length > 0) {
            setAnswers(restoredAnswers);
            setIsDraftRestored(true);
            setLastSavedTime(savedTime || "vừa xong");
          }
        }
      } catch (e) {
        console.error("Lỗi tải đề thi & bài dở:", e);
        if (isMounted) {
          setExam(SEED_EXAM as unknown as ExamData);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [examCode, mode]);

  // Handle Option Select with immediate user-scoped local save & debounced server sync
  const handleSelectOption = (qNum: number, optionLetter: string) => {
    if (mode === "review") return;
    const key = String(qNum);
    const updated = {
      ...answers,
      [key]: {
        ...answers[key],
        selected: optionLetter,
      },
    };
    setAnswers(updated);
    setSubmitError("");
    setIsDraftRestored(true);

    // Lưu scoped theo tài khoản
    const draftKey = `draft_${currentUserId}_${examCode}`;
    localStorage.setItem(draftKey, JSON.stringify(updated));
    const nowTime = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLastSavedTime(nowTime);

    // Đồng bộ nền lên server
    setIsAutoSaving(true);
    saveExamDraftAction(examCode, updated)
      .finally(() => setIsAutoSaving(false));
  };

  // Handle Error Correction Input
  const handleCorrectionTextChange = (qNum: number, text: string) => {
    if (mode === "review") return;
    const key = String(qNum);
    const updated = {
      ...answers,
      [key]: {
        ...answers[key],
        correctionInput: text,
      },
    };
    setAnswers(updated);
    setIsDraftRestored(true);

    const draftKey = `draft_${currentUserId}_${examCode}`;
    localStorage.setItem(draftKey, JSON.stringify(updated));
    const nowTime = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLastSavedTime(nowTime);

    saveExamDraftAction(examCode, updated);
  };

  // Save Draft Manually
  const handleSaveDraft = async () => {
    setIsAutoSaving(true);
    const draftKey = `draft_${currentUserId}_${examCode}`;
    localStorage.setItem(draftKey, JSON.stringify(answers));
    const nowTime = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLastSavedTime(nowTime);

    try {
      await saveExamDraftAction(examCode, answers);
      setSaveSuccessMsg(`Đã lưu bài làm dở thành công lúc ${nowTime}! Bạn có thể tạm dừng và tiếp tục sau.`);
    } catch {
      setSaveSuccessMsg("Đã lưu bài làm dở vào trình duyệt của bạn!");
    } finally {
      setIsAutoSaving(false);
      setTimeout(() => setSaveSuccessMsg(""), 4000);
    }
  };

  // Reset Draft / Làm lại từ đầu
  const handleResetDraft = async () => {
    const confirmReset = window.confirm(
      "Bạn có chắc chắn muốn xóa bản nháp bài làm dở này và làm lại từ đầu không? Toàn bộ các câu đã chọn sẽ bị xóa."
    );
    if (!confirmReset) return;

    setAnswers({});
    setIsDraftRestored(false);
    const draftKey = `draft_${currentUserId}_${examCode}`;
    localStorage.removeItem(draftKey);
    setSaveSuccessMsg("Đã xóa bản nháp. Bạn có thể bắt đầu làm lại từ đầu!");
    setTimeout(() => setSaveSuccessMsg(""), 3000);

    try {
      await deleteExamDraftAction(examCode);
    } catch (e) {
      console.warn("Lỗi xóa nháp trên server:", e);
    }
  };

  // Jump to specific question with smooth scroll and highlight animation
  const jumpToQuestion = (qNum: number) => {
    setIsPaletteOpen(false);
    const el = document.getElementById(`q-${qNum}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-blue-500", "ring-offset-2");
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-blue-500", "ring-offset-2");
      }, 1500);
    }
  };

  // Scroll to first unanswered question
  const scrollToNextUnanswered = () => {
    setIsPaletteOpen(false);
    if (!exam) return;
    const allQuestions: Question[] = [];
    exam.sections.forEach((s) => allQuestions.push(...s.questions));

    for (const q of allQuestions) {
      const isWriting = q.questionType === "writing";
      const ans = isWriting
        ? answers[String(q.questionNumber)]?.correctionInput?.trim()
        : answers[String(q.questionNumber)]?.selected;
      if (!ans) {
        jumpToQuestion(q.questionNumber);
        return;
      }
    }
  };

  // Submit Exam
  const handleSubmitExam = async () => {
    if (!exam) return;

    // Lấy danh sách tất cả câu hỏi
    const allQuestions: Question[] = [];
    exam.sections.forEach((s) => allQuestions.push(...s.questions));
    const total = exam.totalQuestions || allQuestions.length;

    // Kiểm tra đã làm đủ N câu chưa
    const unansweredList: number[] = [];
    allQuestions.forEach((q) => {
      const isWriting = q.questionType === "writing";
      const ans = isWriting
        ? answers[String(q.questionNumber)]?.correctionInput?.trim()
        : answers[String(q.questionNumber)]?.selected;
      if (!ans) {
        unansweredList.push(q.questionNumber);
      }
    });

    if (unansweredList.length > 0) {
      setSubmitError(
        `Bạn chưa hoàn thành hết ${total} câu hỏi! Còn thiếu câu: ${unansweredList.slice(0, 10).join(", ")}${
          unansweredList.length > 10 ? "..." : ""
        }. Vui lòng làm đủ để nộp bài.`
      );
      // Cuộn tới câu đầu tiên chưa làm
      const firstEl = document.getElementById(`q-${unansweredList[0]}`);
      if (firstEl) firstEl.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const res = await submitExamAttemptAction({
        examCode,
        answers,
        status: "completed",
      });

      if (res.success && res.score !== undefined) {
        setScoreResult({
          totalCorrect: res.totalCorrect || 0,
          totalQuestions: res.totalQuestions || total,
          score: res.score,
        });
        setMode("review");
        // Xóa bản nháp khi đã nộp
        localStorage.removeItem(`draft_${currentUserId}_${examCode}`);
        localStorage.removeItem(`draft_${examCode}`);
        setIsDraftRestored(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setSubmitError(res.error || "Không thể nộp bài.");
      }
    } catch (e: any) {
      setSubmitError(e.message || "Lỗi khi nộp bài.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-600 font-medium text-sm">Đang tải đề thi {examCode}...</p>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">Không tìm thấy mã đề {examCode}</h2>
        <p className="text-sm text-slate-600 mb-6">Mã đề này không tồn tại hoặc chưa được lưu trên hệ thống.</p>
        <Link href="/" className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold">
          Quay lại trang chủ
        </Link>
      </div>
    );
  }

  // Thu thập tất cả câu hỏi để tính toán thống kê
  const allQuestions: Question[] = [];
  exam.sections.forEach((s) => allQuestions.push(...s.questions));
  const totalQuestions = exam.totalQuestions || allQuestions.length;
  const answeredCount = allQuestions.filter((q) => {
    const isWriting = q.questionType === "writing";
    return isWriting
      ? Boolean(answers[String(q.questionNumber)]?.correctionInput?.trim())
      : Boolean(answers[String(q.questionNumber)]?.selected);
  }).length;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Top Floating Header */}
      <div className="sticky top-16 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm py-2.5 px-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link
              href="/"
              className="p-2 -ml-1 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
              aria-label="Về trang chủ"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 shrink-0">
                  {exam.code}
                </span>
                <h1 className="text-xs sm:text-base font-bold text-slate-900 truncate max-w-[140px] xs:max-w-[200px] sm:max-w-md">
                  {exam.title}
                </h1>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                  Đã làm: <span className="font-semibold text-blue-600">{answeredCount}/{totalQuestions} câu</span>
                </p>
                {lastSavedTime && mode === "test" && (
                  <span className="hidden sm:inline-flex text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full bg-emerald-500 ${isAutoSaving ? "animate-ping" : ""}`} />
                    <span>Đã lưu {lastSavedTime}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons (Hiển thị đầy đủ trên Laptop & Màn hình lớn) */}
          <div className="hidden lg:flex items-center gap-2">
            {mode === "test" && (
              <>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={isAutoSaving}
                  className="px-3.5 py-1.5 text-xs font-bold rounded-xl border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                  title="Lưu bản nháp bài làm vào thiết bị và hệ thống để lần sau làm tiếp"
                >
                  <Save className="w-3.5 h-3.5 text-amber-700" />
                  <span>{isAutoSaving ? "Đang lưu..." : "Lưu bài làm dở"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSubmitExam}
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5 active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? "Đang chấm..." : "Nộp bài & Xem kết quả"}</span>
                </button>
              </>
            )}

            {mode === "study" && (
              <button
                type="button"
                onClick={() => {
                  setMode("test");
                  router.replace(`/exam/${examCode}?mode=test`);
                }}
                className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
              >
                <span>Chuyển sang Làm bài thi</span>
              </button>
            )}

            {mode === "review" && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowOnlyWrong(!showOnlyWrong)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 ${
                    showOnlyWrong
                      ? "bg-red-50 border-red-300 text-red-700"
                      : "bg-white border-slate-300 text-slate-700"
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>{showOnlyWrong ? "Hiện tất cả câu" : "Chỉ xem câu sai"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAnswers({});
                    setMode("test");
                    setScoreResult(null);
                    router.replace(`/exam/${examCode}?mode=test`);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Làm lại đề này</span>
                </button>
              </div>
            )}
          </div>

          {/* Quick Palette Button on Mobile & Tablet Top Bar */}
          <div className="lg:hidden flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsPaletteOpen(true)}
              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
              title="Mở bảng câu hỏi"
            >
              <span>📑 Bảng câu</span>
              <span className="font-extrabold bg-blue-600 text-white px-1.5 py-0.5 rounded-md text-[10px]">
                {answeredCount}/{totalQuestions}
              </span>
            </button>
          </div>
        </div>

        {saveSuccessMsg && (
          <div className="max-w-7xl mx-auto mt-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5 animate-fadeIn">
            <CheckCheck className="w-4 h-4 text-emerald-600" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {submitError && (
          <div className="max-w-7xl mx-auto mt-2 text-xs font-semibold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 animate-fadeIn">
            ⚠️ {submitError}
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Exam Questions Column */}
        <div className="lg:col-span-9 space-y-6">
          {/* Prominent Draft Resume Banner */}
          {mode === "test" && answeredCount > 0 && (
            <div className="bg-gradient-to-r from-amber-50 via-orange-50/40 to-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl mt-0.5 shrink-0 shadow-sm">
                    <BookmarkCheck className="w-5 h-5 text-amber-700" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                        Đang tiếp tục bài làm dở
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-200/80 text-amber-900">
                        Đã làm {answeredCount}/{totalQuestions} câu ({Math.round((answeredCount / totalQuestions) * 100)}%)
                      </span>
                      {lastSavedTime && (
                        <span className="text-xs text-slate-500 font-medium">
                          • Lưu lúc {lastSavedTime}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Mọi câu trả lời của bạn đều được tự động lưu. Bạn có thể tạm dừng hoặc tắt trình duyệt và quay lại làm tiếp bất cứ lúc nào.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={handleResetDraft}
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-colors flex items-center gap-1.5 shadow-sm"
                    title="Xóa nháp và bắt đầu lại từ đầu"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-slate-500 hover:text-red-600" />
                    <span>Làm lại từ đầu</span>
                  </button>

                  <button
                    type="button"
                    onClick={scrollToNextUnanswered}
                    className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-colors flex items-center gap-1.5"
                  >
                    <span>Làm tiếp câu trống</span>
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Review Banner if Submitted */}
          {mode === "review" && scoreResult && (
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white p-6 rounded-2xl shadow-lg">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-3xl font-extrabold">
                    {scoreResult.score}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Kết quả bài làm</h2>
                    <p className="text-sm text-blue-100">
                      Đúng <span className="font-bold text-white">{scoreResult.totalCorrect}</span> trên tổng số{" "}
                      <span className="font-bold text-white">{scoreResult.totalQuestions}</span> câu (Thang điểm 10: {scoreResult.score}đ)
                    </p>
                  </div>
                </div>

                <div className="text-xs bg-white/10 px-4 py-2.5 rounded-xl backdrop-blur-sm">
                  {scoreResult.score >= 8
                    ? "🎉 Xuất sắc! Bạn nắm rất vững kiến thức."
                    : scoreResult.score >= 5
                    ? "👍 Khá tốt! Hãy rà soát lại các câu sai bên dưới."
                    : "💪 Cần luyện thêm! Đọc kỹ lời giải chi tiết từng câu nhé."}
                </div>
              </div>
            </div>
          )}

          {/* Sections Render */}
          {exam.sections.map((section, sIdx) => (
            <div key={section.id || sIdx} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-7">
              {/* Section Header */}
              <div className="border-b border-slate-100 pb-4 mb-6">
                <h2 className="text-sm sm:text-base font-bold text-slate-800 leading-snug">
                  {section.title}
                </h2>
              </div>

              {/* Layout: Nếu có bài đọc hiểu (Reading Passage), hiển thị 2 cột trên laptop & iPad ngang */}
              <div className={section.passageText ? "grid grid-cols-1 lg:grid-cols-12 gap-6" : ""}>
                {section.passageText && (
                  <div className="lg:col-span-5 bg-amber-50/70 border border-amber-200/90 rounded-2xl p-4 sm:p-5 text-sm leading-relaxed text-slate-800 lg:sticky lg:top-36 h-fit max-h-[calc(100vh-10rem)] overflow-y-auto shadow-sm">
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-amber-800 mb-2.5">
                      <div className="flex items-center gap-1.5">
                        <Bookmark className="w-3.5 h-3.5" />
                        <span>Đoạn văn đọc hiểu</span>
                      </div>
                      <span className="text-[10px] text-amber-600 font-normal lg:hidden">
                        (Kéo xuống xem các câu hỏi)
                      </span>
                    </div>
                    <div className="whitespace-pre-line text-slate-800 text-sm sm:text-base lg:text-sm leading-relaxed font-serif">
                      {section.passageText}
                    </div>
                  </div>
                )}

                {/* Questions List */}
                <div className={section.passageText ? "lg:col-span-7 space-y-6" : "space-y-6"}>
                  {section.questions.map((q) => {
                    const qKey = String(q.questionNumber);
                    const currentSelected = answers[qKey]?.selected;
                    const isCorrect = currentSelected?.toUpperCase() === q.correctAnswer?.toUpperCase();
                    const isAnswered = Boolean(currentSelected);

                    // Filter mode: chỉ xem câu sai
                    if (mode === "review" && showOnlyWrong && isCorrect) {
                      return null;
                    }

                    return (
                      <div
                        id={`q-${q.questionNumber}`}
                        key={q.id || q.questionNumber}
                        className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                          mode === "review"
                            ? isCorrect
                              ? "bg-emerald-50/30 border-emerald-200"
                              : "bg-red-50/30 border-red-200"
                            : "bg-slate-50/50 border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {/* Mobile: Nút xem lại bài đọc nếu câu hỏi thuộc phần đọc hiểu */}
                        {section.passageText && (
                          <div className="lg:hidden mb-2.5">
                            <button
                              type="button"
                              onClick={() => setReadingPassageModal({ title: section.title, text: section.passageText! })}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors border border-amber-300/80 active:scale-95"
                            >
                              <Bookmark className="w-3 h-3 text-amber-700" />
                              <span>📖 Xem lại đoạn văn đọc hiểu</span>
                            </button>
                          </div>
                        )}

                        {/* Question Prompt */}
                        <div className="flex items-start gap-2.5 mb-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-lg text-xs font-bold whitespace-nowrap mt-0.5 shrink-0 ${
                              mode === "review"
                                ? isCorrect
                                  ? "bg-emerald-600 text-white"
                                  : "bg-red-600 text-white"
                                : "bg-slate-800 text-white"
                            }`}
                          >
                            Câu {q.questionNumber}
                          </span>

                          <div
                            className="text-sm sm:text-base font-medium text-slate-900 leading-snug"
                            dangerouslySetInnerHTML={{ __html: q.prompt }}
                          />
                        </div>

                        {/* Question Input / Options based on questionType */}
                        {q.questionType === "writing" ? (
                          <div className="mt-3 bg-white p-3.5 rounded-xl border border-slate-200">
                            <label className="block text-xs font-bold text-indigo-900 mb-1.5">
                              ✍️ Viết lại câu hoàn chỉnh của bạn:
                            </label>
                            <textarea
                              rows={2}
                              disabled={mode === "review"}
                              value={answers[qKey]?.correctionInput || ""}
                              onChange={(e) => handleCorrectionTextChange(q.questionNumber, e.target.value)}
                              placeholder="Nhập toàn bộ câu viết lại hoàn chỉnh của bạn vào đây..."
                              className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-serif leading-relaxed"
                            />
                            {(mode === "review" || mode === "study") && q.correctionText && (
                              <div className="mt-2.5 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                                <span className="font-bold">✨ Câu mẫu chuẩn:</span> {q.correctionText}
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Options Grid for Multiple Choice / Pronunciation / Stress */
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3">
                            {(["A", "B", "C", "D"] as const).map((optKey) => {
                              const optText = q.options[optKey];
                              if (!optText) return null;

                              const isChosen = currentSelected === optKey;
                              const isAnswerKey = q.correctAnswer?.toUpperCase() === optKey;

                              let optStyle = "bg-white border-slate-200 text-slate-800 hover:border-blue-300 hover:bg-slate-50/50";
                              if (mode === "test") {
                                if (isChosen) {
                                  optStyle = "bg-blue-50/90 border-blue-600 text-blue-900 font-semibold ring-1 ring-blue-600 shadow-xs";
                                }
                              } else if (mode === "study") {
                                if (isAnswerKey) {
                                  optStyle = "bg-emerald-50 border-emerald-600 text-emerald-950 font-bold ring-1 ring-emerald-600 shadow-xs";
                                } else {
                                  optStyle = "bg-white border-slate-200 text-slate-600";
                                }
                              } else if (mode === "review") {
                                if (isAnswerKey && isChosen) {
                                  optStyle = "bg-emerald-100/90 border-emerald-600 text-emerald-950 font-bold ring-2 ring-emerald-500 shadow-sm";
                                } else if (isChosen && !isAnswerKey) {
                                  optStyle = "bg-red-100/90 border-red-500 text-red-950 line-through ring-1 ring-red-400";
                                } else if (isAnswerKey && !isChosen) {
                                  optStyle = "bg-emerald-50 border-dashed border-2 border-emerald-500 text-emerald-900 font-bold";
                                } else {
                                  optStyle = "bg-slate-50/50 border-slate-200 text-slate-400 opacity-60";
                                }
                              }

                              return (
                                <button
                                  key={optKey}
                                  type="button"
                                  disabled={mode === "review"}
                                  onClick={() => handleSelectOption(q.questionNumber, optKey)}
                                  className={`flex items-start justify-between gap-2.5 min-h-[48px] p-3 sm:p-3.5 rounded-xl border text-left text-sm transition-all select-none touch-manipulation active:scale-[0.99] ${optStyle}`}
                                >
                                  <div className="flex items-start gap-2.5">
                                    <span className="w-6 h-6 rounded-lg font-bold text-xs bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center mt-0.5">
                                      {optKey}
                                    </span>
                                    <span
                                      className="leading-snug text-sm sm:text-base lg:text-sm"
                                      dangerouslySetInnerHTML={{ __html: optText }}
                                    />
                                  </div>

                                  {mode === "review" && (
                                    <div className="shrink-0 text-xs font-bold pl-2">
                                      {isAnswerKey && isChosen && (
                                        <span className="text-emerald-700">✓ Chọn đúng</span>
                                      )}
                                      {isChosen && !isAnswerKey && (
                                        <span className="text-red-600">✗ Chọn sai</span>
                                      )}
                                      {isAnswerKey && !isChosen && (
                                        <span className="text-emerald-700">★ Đáp án đúng</span>
                                      )}
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Dạng bài tìm lỗi sai: Thêm ô nhập từ sửa lại của học sinh */}
                        {q.questionType === "error_correction" && (
                          <div className="mt-3.5 pt-3 border-t border-slate-200/80">
                            {mode === "review" ? (
                              <div className="space-y-1.5 text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-600 font-medium">Từ bạn đã sửa:</span>
                                  <span className="font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
                                    {answers[qKey]?.correctionInput || "(Chưa nhập câu sửa)"}
                                  </span>
                                </div>
                                {q.correctionText && (
                                  <div className="text-emerald-800 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                                    <span className="font-bold">Từ sửa chuẩn của đề:</span> {q.correctionText}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                  ✏️ Cách sửa lại của bạn (Ví dụ: &apos;were&apos;, &apos;around&apos;...):
                                </label>
                                <input
                                  type="text"
                                  value={answers[qKey]?.correctionInput || ""}
                                  onChange={(e) => handleCorrectionTextChange(q.questionNumber, e.target.value)}
                                  placeholder="Nhập từ hoặc cụm từ bạn muốn sửa thành..."
                                  className="w-full px-3.5 py-2 text-base sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                {mode === "study" && q.correctionText && (
                                  <div className="mt-2 text-xs text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                                    <span className="font-bold">Từ sửa chuẩn:</span> {q.correctionText}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}

                        {/* Explanation in Review / Study Mode */}
                        {(mode === "review" || mode === "study") && q.explanation && (
                          <div className="mt-3.5 p-3 rounded-xl bg-slate-100 border border-slate-200 text-xs sm:text-sm text-slate-800 leading-relaxed">
                            <span className="font-bold text-blue-700 block mb-1">💡 Lời giải chi tiết:</span>
                            {q.explanation}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Dynamic Question Palette Sidebar (Chỉ hiển thị trên Laptop & Màn hình lớn >= 1024px) */}
        <div className="hidden lg:block lg:col-span-3">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sticky top-36">
            <h3 className="font-bold text-sm text-slate-900 mb-2">Bảng câu hỏi ({totalQuestions} câu)</h3>
            <p className="text-xs text-slate-500 mb-4">
              Bấm vào số câu để nhảy nhanh đến câu hỏi.
            </p>

            <div className="grid grid-cols-5 gap-1.5 max-h-[55vh] overflow-y-auto p-1">
              {allQuestions.map((q) => {
                const qKey = String(q.questionNumber);
                const isWriting = q.questionType === "writing";
                const isAnswered = isWriting
                  ? Boolean(answers[qKey]?.correctionInput?.trim())
                  : Boolean(answers[qKey]?.selected);
                const isCorrect = answers[qKey]?.selected?.toUpperCase() === q.correctAnswer?.toUpperCase();

                let btnClass = "bg-slate-100 text-slate-600 hover:bg-slate-200";
                if (mode === "test") {
                  if (isAnswered) {
                    btnClass = "bg-blue-600 text-white font-bold";
                  }
                } else {
                  if (isCorrect) {
                    btnClass = "bg-emerald-600 text-white font-bold";
                  } else if (isAnswered && !isCorrect) {
                    btnClass = "bg-red-500 text-white font-bold";
                  } else {
                    btnClass = "bg-slate-200 text-slate-500";
                  }
                }

                return (
                  <button
                    key={q.questionNumber}
                    type="button"
                    onClick={() => jumpToQuestion(q.questionNumber)}
                    className={`h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-all ${btnClass}`}
                  >
                    {q.questionNumber}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-blue-600 shrink-0" />
                <span>Đã làm ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-slate-100 border border-slate-300 shrink-0" />
                <span>Chưa làm ({totalQuestions - answeredCount})</span>
              </div>
            </div>

            {/* Draft status in sidebar */}
            {mode === "test" && (
              <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">Bản nháp:</span>
                  <span className="text-emerald-700 font-bold flex items-center gap-1 text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {lastSavedTime ? `Đã lưu ${lastSavedTime}` : "Đã bật tự động"}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.round((answeredCount / totalQuestions) * 100)}%` }}
                  />
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={isAutoSaving}
                    className="flex-1 py-1.5 px-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow-sm active:scale-95"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Lưu bài ngay</span>
                  </button>
                  {answeredCount > 0 && (
                    <button
                      type="button"
                      onClick={handleResetDraft}
                      className="py-1.5 px-2 bg-slate-100 hover:bg-red-50 hover:text-red-600 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition-colors"
                      title="Xóa nháp làm lại từ đầu"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Sticky Action Bar (Tối ưu cho iPhone 12 & iPad Air 3 dọc) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl z-30 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIsPaletteOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 text-xs font-bold active:scale-95 transition-all"
        >
          <span>📑 Câu hỏi:</span>
          <span className="text-blue-600 font-extrabold">{answeredCount}/{totalQuestions}</span>
        </button>

        <div className="flex items-center gap-1.5">
          {mode === "test" && (
            <>
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isAutoSaving}
                className="px-3 py-2 text-xs font-bold rounded-xl border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors flex items-center gap-1 active:scale-95 shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isAutoSaving ? "Lưu..." : "Lưu nháp"}</span>
              </button>
              <button
                type="button"
                onClick={handleSubmitExam}
                disabled={isSubmitting}
                className="px-3.5 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-colors flex items-center gap-1 active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? "Chấm..." : "Nộp bài"}</span>
              </button>
            </>
          )}

          {mode === "study" && (
            <button
              type="button"
              onClick={() => {
                setMode("test");
                router.replace(`/exam/${examCode}?mode=test`);
              }}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-1 active:scale-95"
            >
              <span>Vào Làm bài thi</span>
            </button>
          )}

          {mode === "review" && (
            <>
              <button
                type="button"
                onClick={() => setShowOnlyWrong(!showOnlyWrong)}
                className={`px-2.5 py-2 text-xs font-semibold rounded-xl border transition-colors flex items-center gap-1 ${
                  showOnlyWrong
                    ? "bg-red-50 border-red-300 text-red-700"
                    : "bg-white border-slate-300 text-slate-700"
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>{showOnlyWrong ? "Tất cả" : "Câu sai"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAnswers({});
                  setMode("test");
                  setScoreResult(null);
                  router.replace(`/exam/${examCode}?mode=test`);
                }}
                className="px-3 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-1 shadow-sm active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Làm lại</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Slide-Up Question Palette Drawer Modal (Dành cho Mobile iPhone 12 & iPad Air 3) */}
      {isPaletteOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsPaletteOpen(false)}
          />

          {/* Drawer Body */}
          <div className="relative z-10 bg-white rounded-t-3xl shadow-2xl border-t border-slate-200 max-h-[85vh] flex flex-col overflow-hidden pb-[max(1rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-200">
            {/* Grab indicator */}
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 mb-1" />

            {/* Drawer Header */}
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Bảng câu hỏi ({totalQuestions} câu)
                </h3>
                <p className="text-xs text-slate-500">
                  Đã làm: <span className="font-bold text-blue-600">{answeredCount}/{totalQuestions} câu</span> ({Math.round((answeredCount / totalQuestions) * 100)}%)
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsPaletteOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions & Progress */}
            <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round((answeredCount / totalQuestions) * 100)}%` }}
                />
              </div>

              {mode === "test" && answeredCount < totalQuestions && (
                <button
                  type="button"
                  onClick={scrollToNextUnanswered}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shrink-0 active:scale-95"
                >
                  <span>Câu chưa làm</span>
                  <ArrowDown className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Questions Grid (5 cột trên Phone, 8 cột trên Tablet) */}
            <div className="p-4 overflow-y-auto max-h-[50vh]">
              <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                {allQuestions.map((q) => {
                  const qKey = String(q.questionNumber);
                  const isWriting = q.questionType === "writing";
                  const isAnswered = isWriting
                    ? Boolean(answers[qKey]?.correctionInput?.trim())
                    : Boolean(answers[qKey]?.selected);
                  const isCorrect = answers[qKey]?.selected?.toUpperCase() === q.correctAnswer?.toUpperCase();

                  let btnClass = "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200";
                  if (mode === "test") {
                    if (isAnswered) {
                      btnClass = "bg-blue-600 text-white font-bold border-blue-600 shadow-xs";
                    }
                  } else {
                    if (isCorrect) {
                      btnClass = "bg-emerald-600 text-white font-bold border-emerald-600";
                    } else if (isAnswered && !isCorrect) {
                      btnClass = "bg-red-500 text-white font-bold border-red-500";
                    } else {
                      btnClass = "bg-slate-200 text-slate-500 border-slate-200";
                    }
                  }

                  return (
                    <button
                      key={q.questionNumber}
                      type="button"
                      onClick={() => jumpToQuestion(q.questionNumber)}
                      className={`min-h-[44px] min-w-[44px] rounded-xl text-sm font-bold flex items-center justify-center transition-all active:scale-95 ${btnClass}`}
                    >
                      {q.questionNumber}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Drawer Legend & Actions */}
            <div className="px-5 pt-3 pb-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-blue-600 shrink-0" />
                  <span>Đã làm ({answeredCount})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-slate-200 border border-slate-300 shrink-0" />
                  <span>Chưa làm ({totalQuestions - answeredCount})</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsPaletteOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors ml-auto active:scale-95"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reading Comprehension Modal (Xem toàn màn hình trên Mobile khi đang làm câu hỏi) */}
      {readingPassageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setReadingPassageModal(null)}
          />
          <div className="relative z-10 bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-amber-50/70">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-sm sm:text-base">
                <Bookmark className="w-4 h-4 text-amber-700" />
                <span>Đoạn văn đọc hiểu ({readingPassageModal.title})</span>
              </div>
              <button
                type="button"
                onClick={() => setReadingPassageModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg transition-colors"
                aria-label="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto whitespace-pre-line text-slate-800 text-sm sm:text-base leading-relaxed font-serif bg-white">
              {readingPassageModal.text}
            </div>

            <div className="p-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setReadingPassageModal(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors active:scale-95"
              >
                Đã hiểu, quay lại làm tiếp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExamPage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ExamContent params={params} />
    </Suspense>
  );
}
