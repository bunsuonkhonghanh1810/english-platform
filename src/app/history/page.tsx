"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  History, Award, BookOpen, Clock, ChevronRight, CheckCircle2, 
  XCircle, RotateCcw, Eye, ArrowUpRight, BookmarkCheck, ArrowRight, 
  Trash2, AlertCircle 
} from "lucide-react";
import { getUserHistoryAction, deleteExamDraftAction } from "@/actions/exam";

interface Attempt {
  id: string;
  examId: string;
  examCode?: string;
  examTitle?: string;
  attemptNumber?: number;
  status: "draft" | "completed";
  answers: Record<string, { selected?: string; correctionInput?: string }>;
  answeredCount?: number;
  totalQuestions?: number;
  totalCorrect?: number;
  score?: number;
  completedAt?: string;
  updatedAt?: string;
  startedAt?: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState("");

  const loadAllHistory = async () => {
    setIsLoading(true);
    try {
      // 0. Xác định tài khoản hiện tại
      const { getCurrentUserAction } = await import("@/actions/auth");
      const user = await getCurrentUserAction();
      if (!user) {
        router.replace("/login?redirect=/history");
        return;
      }
      const uid = user.id;

      const attemptsMap = new Map<string, Attempt>();

      // 1. Quét từ localStorage của đúng tài khoản này
      const prefix = `draft_${uid}_`;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) {
          const code = k.replace(prefix, "").toUpperCase();
          try {
            const answers = JSON.parse(localStorage.getItem(k) || "{}");
            const count = Object.values(answers).filter(
              (ans: any) => Boolean(ans?.selected) || Boolean(ans?.correctionInput?.trim())
            ).length;
            if (count > 0) {
              const draftKey = `draft_${code}`;
              attemptsMap.set(draftKey, {
                id: draftKey,
                examId: code,
                examCode: code,
                examTitle: code === "J4PRFE" ? "PRACTICE TEST 6 - Đề Thi Tuyển Sinh Tiếng Anh" : `Đề thi mã ${code}`,
                status: "draft",
                answers,
                answeredCount: count,
                totalQuestions: 40,
                updatedAt: new Date().toISOString(),
              });
            }
          } catch {}
        }
      }

      // 2. Tải từ Server Action (Neon DB)
      try {
        const res = await getUserHistoryAction();
        if (res.success && res.history) {
          res.history.forEach((h: any) => {
            if (h.status === "draft") {
              const code = (h.examCode || h.examId || "J4PRFE").toUpperCase();
              const draftKey = `draft_${code}`;
              const existing = attemptsMap.get(draftKey);
              if (existing) {
                // Hợp nhất câu trả lời và số lượng câu đã làm, tuyệt đối không tạo 2 dòng
                const mergedAnswers = { ...existing.answers, ...h.answers };
                const mergedCount = Object.values(mergedAnswers).filter(
                  (ans: any) => Boolean(ans?.selected) || Boolean(ans?.correctionInput?.trim())
                ).length;
                attemptsMap.set(draftKey, {
                  ...existing,
                  ...h,
                  id: draftKey,
                  examCode: code,
                  answers: mergedAnswers,
                  answeredCount: mergedCount,
                  updatedAt: h.updatedAt || existing.updatedAt,
                });
              } else {
                attemptsMap.set(draftKey, {
                  ...h,
                  id: draftKey,
                  examCode: code,
                });
              }
            } else {
              // Bài đã hoàn thành (completed) -> mỗi lần nộp là 1 dòng lịch sử riêng
              attemptsMap.set(h.id, h);
            }
          });
        }
      } catch (e) {
        console.warn("Lỗi tải lịch sử từ server:", e);
      }

      const list = Array.from(attemptsMap.values());
      // Sắp xếp: bài mới nhất lên đầu
      list.sort((a, b) => {
        const timeA = new Date(a.updatedAt || a.completedAt || a.startedAt || 0).getTime();
        const timeB = new Date(b.updatedAt || b.completedAt || b.startedAt || 0).getTime();
        return timeB - timeA;
      });

      setAttempts(list);
    } catch (e) {
      console.error("Lỗi đọc lịch sử:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllHistory();
  }, []);

  const handleDeleteDraft = async (examCode: string) => {
    const ok = window.confirm(`Bạn có chắc muốn xóa bản nháp của đề ${examCode} không?`);
    if (!ok) return;

    try {
      const { getCurrentUserAction } = await import("@/actions/auth");
      const user = await getCurrentUserAction();
      const uid = user?.id || "guest";
      localStorage.removeItem(`draft_${uid}_${examCode}`);
    } catch {}
    localStorage.removeItem(`draft_${examCode}`);
    setAttempts((prev) => prev.filter((a) => !(a.examCode === examCode && a.status === "draft")));
    setActionMsg(`Đã xóa bản nháp đề ${examCode}!`);
    setTimeout(() => setActionMsg(""), 3000);

    try {
      await deleteExamDraftAction(examCode);
    } catch (e) {
      console.warn("Lỗi xóa nháp:", e);
    }
  };

  // Tách riêng Drafts và Completed
  const draftAttempts = attempts.filter((a) => a.status === "draft");
  const completedAttempts = attempts.filter((a) => a.status === "completed");

  const averageScore = completedAttempts.length > 0
    ? (completedAttempts.reduce((acc, a) => acc + (a.score || 0), 0) / completedAttempts.length).toFixed(1)
    : "0.0";
  const bestScore = completedAttempts.length > 0
    ? Math.max(...completedAttempts.map((a) => a.score || 0)).toFixed(1)
    : "0.0";

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-blue-700 text-xs font-bold uppercase tracking-wider mb-1">
              <History className="w-4 h-4" />
              <span>Tiến độ học tập</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Lịch Sử Làm Bài & Bản Nháp Đang Làm Dở</h1>
            <p className="text-sm text-slate-500">Quản lý các đề thi đang làm dở, xem lại kết quả đã nộp và theo dõi sự tiến bộ.</p>
          </div>

          <Link
            href="/"
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-sm flex items-center gap-1.5"
          >
            <span>Luyện thêm đề mới</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {actionMsg && (
          <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2.5 rounded-xl text-xs font-semibold">
            ✓ {actionMsg}
          </div>
        )}

        {/* SECTION 1: BÀI THI ĐANG LÀM DỞ (BẢN NHÁP) */}
        <div className="bg-white rounded-2xl border border-amber-200/90 shadow-sm overflow-hidden">
          <div className="p-5 bg-gradient-to-r from-amber-50/80 to-orange-50/60 border-b border-amber-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                <BookmarkCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-base text-slate-900">Bài thi đang làm dở (Bản nháp lưu tạm)</h2>
                <p className="text-xs text-slate-500">Các đề bạn chưa nộp bài, hệ thống đã lưu lại toàn bộ câu trả lời.</p>
              </div>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-200/80 text-amber-900">
              {draftAttempts.length} đề
            </span>
          </div>

          {draftAttempts.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <p className="text-sm font-medium">Hiện không có bài thi nào đang làm dở.</p>
              <p className="text-xs text-slate-400 mt-1">
                Khi bạn mở bất kỳ đề nào và chọn đáp án, hệ thống sẽ tự động lưu nháp tại đây để bạn làm tiếp bất cứ lúc nào.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {draftAttempts.map((draft) => {
                const code = draft.examCode || "ENG001";
                const total = draft.totalQuestions || 40;
                const answered = draft.answeredCount || Object.values(draft.answers || {}).filter(
                  (a) => Boolean(a.selected) || Boolean(a.correctionInput?.trim())
                ).length;
                const percent = Math.round((answered / total) * 100);

                return (
                  <div key={draft.id} className="p-5 hover:bg-amber-50/20 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-xs font-extrabold bg-blue-100 text-blue-700">
                          {code}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900">
                          {draft.examTitle || `Đề thi mã ${code}`}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                          Đang làm dở
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="max-w-md">
                        <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                          <span>Tiến độ: <strong className="text-amber-700">{answered}/{total} câu</strong> ({percent}%)</span>
                          {draft.updatedAt && (
                            <span className="text-[11px] text-slate-400">
                              Cập nhật: {new Date(draft.updatedAt).toLocaleString("vi-VN")}
                            </span>
                          )}
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDeleteDraft(code)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                        title="Xóa bản nháp này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <Link
                        href={`/exam/${code}?mode=test`}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
                      >
                        <span>Tiếp tục làm ngay</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Tổng số lượt đã nộp bài</p>
              <p className="text-2xl font-bold text-slate-900">{completedAttempts.length}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Điểm số cao nhất</p>
              <p className="text-2xl font-bold text-emerald-600">{bestScore} / 10</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Điểm trung bình</p>
              <p className="text-2xl font-bold text-indigo-600">{averageScore} / 10</p>
            </div>
          </div>
        </div>

        {/* SECTION 2: LỊCH SỬ CÁC LẦN ĐÃ NỘP BÀI */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-base text-slate-900">Lịch sử bài thi đã nộp & Chấm điểm</h2>
              <p className="text-xs text-slate-500">Xem lại bài làm, đối chiếu câu đúng / sai và học lời giải chi tiết.</p>
            </div>
            <span className="text-xs text-slate-400">Mới nhất lên đầu</span>
          </div>

          {completedAttempts.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <p className="text-sm font-medium">Chưa có bài thi nào được nộp hoàn chỉnh.</p>
              <Link href="/exam/J4PRFE?mode=test" className="text-xs text-blue-600 font-bold hover:underline mt-2 inline-block">
                Bắt đầu làm đề thi thử ngay &rarr;
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {completedAttempts.map((att, idx) => {
                const code = att.examCode || "J4PRFE";
                return (
                  <div key={att.id || idx} className="p-5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700">
                          {code}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900">
                          {att.examTitle || `Lần làm thứ ${att.attemptNumber || idx + 1}`}
                        </h3>
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                          Đã hoàn thành
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Thời gian nộp: {att.completedAt ? new Date(att.completedAt).toLocaleString("vi-VN") : "Đã hoàn thành"}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="flex sm:block items-baseline justify-between sm:text-right gap-2">
                        <div>
                          <span className="text-xl font-extrabold text-blue-600">{att.score}</span>
                          <span className="text-xs text-slate-500 font-medium"> / 10đ</span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium">
                          Đúng {att.totalCorrect || 0}/{att.totalQuestions || 40} câu
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/exam/${code}?mode=review&attemptId=${att.id}`}
                          className="flex-1 sm:flex-none text-center px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-95"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Xem lại bài làm</span>
                        </Link>

                        <Link
                          href={`/exam/${code}?mode=study`}
                          className="flex-1 sm:flex-none text-center px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-95"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Xem đáp án đề</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
