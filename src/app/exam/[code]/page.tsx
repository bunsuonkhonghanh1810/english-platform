"use client";

import { useState, useEffect, use, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  CheckCircle2, AlertCircle, Bookmark, Save, Send, Eye, RefreshCw, 
  ChevronLeft, Award, HelpCircle, Filter, ArrowRight 
} from "lucide-react";
import { submitExamAttemptAction } from "@/actions/exam";
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

  const initialMode = searchParams.get("mode") === "study" ? "study" : "test";
  const [mode, setMode] = useState<"test" | "study" | "review">(initialMode);
  const [exam, setExam] = useState<ExamData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // User Answers State: { [qNum]: { selected: 'A', correctionInput: 'were' } }
  const [answers, setAnswers] = useState<Record<string, { selected?: string; correctionInput?: string }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [scoreResult, setScoreResult] = useState<{ totalCorrect: number; totalQuestions: number; score: number } | null>(null);
  const [showOnlyWrong, setShowOnlyWrong] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");

  // Load Exam Data & Drafts
  useEffect(() => {
    // Ưu tiên load từ local store hoặc mock seed
    try {
      const savedStore = localStorage.getItem("english_platform_store");
      let foundExam: ExamData | null = null;

      if (savedStore) {
        const parsed = JSON.parse(savedStore);
        foundExam = parsed.exams?.find((e: any) => e.code?.toUpperCase() === examCode);
      }

      if (!foundExam && examCode === "ENG001") {
        foundExam = SEED_EXAM as unknown as ExamData;
      }

      if (foundExam) {
        setExam(foundExam);
      } else {
        // Fallback demo exam
        setExam(SEED_EXAM as unknown as ExamData);
      }

      // Khôi phục bản nháp (Draft) nếu có trong localStorage
      const draftKey = `draft_${examCode}`;
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        setAnswers(JSON.parse(savedDraft));
      }
    } catch (e) {
      console.error("Lỗi tải đề thi:", e);
      setExam(SEED_EXAM as unknown as ExamData);
    } finally {
      setIsLoading(false);
    }
  }, [examCode]);

  // Handle Option Select
  const handleSelectOption = (qNum: number, optionLetter: string) => {
    if (mode === "review") return;
    const key = String(qNum);
    setAnswers((prev) => {
      const updated = {
        ...prev,
        [key]: {
          ...prev[key],
          selected: optionLetter,
        },
      };
      // Auto-save nháp vào localStorage
      localStorage.setItem(`draft_${examCode}`, JSON.stringify(updated));
      return updated;
    });
    setSubmitError("");
  };

  // Handle Error Correction Input
  const handleCorrectionTextChange = (qNum: number, text: string) => {
    if (mode === "review") return;
    const key = String(qNum);
    setAnswers((prev) => {
      const updated = {
        ...prev,
        [key]: {
          ...prev[key],
          correctionInput: text,
        },
      };
      localStorage.setItem(`draft_${examCode}`, JSON.stringify(updated));
      return updated;
    });
  };

  // Save Draft Manually
  const handleSaveDraft = async () => {
    localStorage.setItem(`draft_${examCode}`, JSON.stringify(answers));
    setSaveSuccessMsg("Đã lưu bài làm dở thành công!");
    setTimeout(() => setSaveSuccessMsg(""), 3000);

    // Sync to backend attempt
    await submitExamAttemptAction({
      examCode,
      answers,
      status: "draft",
    });
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
        localStorage.removeItem(`draft_${examCode}`);
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
      <div className="sticky top-16 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm py-3 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700">
                  {exam.code}
                </span>
                <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate max-w-[280px] sm:max-w-md">
                  {exam.title}
                </h1>
              </div>
              <p className="text-xs text-slate-500">
                Đã làm: <span className="font-semibold text-blue-600">{answeredCount}/{totalQuestions} câu</span>
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {mode === "test" && (
              <>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Lưu bài làm</span>
                </button>

                <button
                  type="button"
                  onClick={handleSubmitExam}
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? "Đang chấm..." : "Nộp bài & Xem kết quả"}</span>
                </button>
              </>
            )}

            {mode === "study" && (
              <button
                type="button"
                onClick={() => setMode("test")}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Chuyển sang Làm bài thi
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
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Làm lại đề này</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {saveSuccessMsg && (
          <div className="max-w-7xl mx-auto mt-2 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-md border border-emerald-200">
            ✓ {saveSuccessMsg}
          </div>
        )}

        {submitError && (
          <div className="max-w-7xl mx-auto mt-2 text-xs font-semibold text-red-600 bg-red-50 px-3 py-1 rounded-md border border-red-200">
            ⚠️ {submitError}
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Exam Questions Column */}
        <div className="lg:col-span-9 space-y-8">
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

              {/* Layout: Nếu có bài đọc hiểu (Reading Passage), hiển thị 2 cột hoặc block bài đọc */}
              <div className={section.passageText ? "grid grid-cols-1 xl:grid-cols-12 gap-6" : ""}>
                {section.passageText && (
                  <div className="xl:col-span-5 bg-amber-50/60 border border-amber-200/80 rounded-xl p-4 sm:p-5 text-sm leading-relaxed text-slate-800 xl:sticky xl:top-36 h-fit max-h-[75vh] overflow-y-auto">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-800 mb-2.5">
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>Đoạn văn đọc hiểu</span>
                    </div>
                    <div className="whitespace-pre-line text-slate-700 text-sm leading-relaxed font-serif">
                      {section.passageText}
                    </div>
                  </div>
                )}

                {/* Questions List */}
                <div className={section.passageText ? "xl:col-span-7 space-y-6" : "space-y-6"}>
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
                        className={`p-4 sm:p-5 rounded-xl border transition-all ${
                          mode === "review"
                            ? isCorrect
                              ? "bg-emerald-50/30 border-emerald-200"
                              : "bg-red-50/30 border-red-200"
                            : "bg-slate-50/50 border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {/* Question Prompt */}
                        <div className="flex items-start gap-2.5 mb-3">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap ${
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
                              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-serif"
                            />
                            {(mode === "review" || mode === "study") && q.correctionText && (
                              <div className="mt-2.5 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                                <span className="font-bold">✨ Câu mẫu chuẩn:</span> {q.correctionText}
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Options Grid for Multiple Choice / Pronunciation / Stress */
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                            {(["A", "B", "C", "D"] as const).map((optKey) => {
                              const optText = q.options[optKey];
                              if (!optText) return null;

                              const isChosen = currentSelected === optKey;
                              const isAnswerKey = q.correctAnswer?.toUpperCase() === optKey;

                              let optStyle = "bg-white border-slate-200 text-slate-800 hover:border-blue-300";
                              if (mode === "test") {
                                if (isChosen) {
                                  optStyle = "bg-blue-50 border-blue-600 text-blue-900 font-semibold ring-1 ring-blue-600";
                                }
                              } else {
                                // Study or Review mode
                                if (isAnswerKey) {
                                  optStyle = "bg-emerald-100 border-emerald-600 text-emerald-950 font-bold ring-1 ring-emerald-600";
                                } else if (isChosen && !isAnswerKey) {
                                  optStyle = "bg-red-100 border-red-500 text-red-950 line-through opacity-80";
                                }
                              }

                              return (
                                <button
                                  key={optKey}
                                  type="button"
                                  disabled={mode === "review"}
                                  onClick={() => handleSelectOption(q.questionNumber, optKey)}
                                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-left text-sm transition-all ${optStyle}`}
                                >
                                  <span className="font-bold text-xs px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 shrink-0">
                                    {optKey}
                                  </span>
                                  <span
                                    className="leading-snug"
                                    dangerouslySetInnerHTML={{ __html: optText }}
                                  />
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Dạng bài tìm lỗi sai: Thêm ô nhập từ sửa lại của học sinh */}
                        {q.questionType === "error_correction" && (
                          <div className="mt-3.5 pt-3 border-t border-slate-200/80">
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              ✏️ Cách sửa lại của bạn (Ví dụ: &apos;were&apos;, &apos;around&apos;...):
                            </label>
                            <input
                              type="text"
                              disabled={mode === "review"}
                              value={answers[qKey]?.correctionInput || ""}
                              onChange={(e) => handleCorrectionTextChange(q.questionNumber, e.target.value)}
                              placeholder="Nhập từ hoặc cụm từ bạn muốn sửa thành..."
                              className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />

                            {/* Trong chế độ review, hiện từ sửa chuẩn */}
                            {(mode === "review" || mode === "study") && q.correctionText && (
                              <div className="mt-2 text-xs text-emerald-800 bg-emerald-50 p-2 rounded border border-emerald-200">
                                <span className="font-bold">Từ sửa chuẩn:</span> {q.correctionText}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Explanation in Review / Study Mode */}
                        {(mode === "review" || mode === "study") && q.explanation && (
                          <div className="mt-3.5 p-3 rounded-lg bg-slate-100 border border-slate-200 text-xs sm:text-sm text-slate-800 leading-relaxed">
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

        {/* Dynamic Question Palette Sidebar (1 .. N) */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sticky top-36">
            <h3 className="font-bold text-sm text-slate-900 mb-2">Bảng câu hỏi ({totalQuestions} câu)</h3>
            <p className="text-xs text-slate-500 mb-4">
              Bấm vào số câu để nhảy nhanh đến câu hỏi.
            </p>

            <div className="grid grid-cols-5 gap-1.5 max-h-[60vh] overflow-y-auto p-1">
              {allQuestions.map((q) => {
                const qKey = String(q.questionNumber);
                const isAnswered = Boolean(answers[qKey]?.selected);
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
                    onClick={() => {
                      const el = document.getElementById(`q-${q.questionNumber}`);
                      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
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
          </div>
        </div>
      </div>
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
