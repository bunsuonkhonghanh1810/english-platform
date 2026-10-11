"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  History, Award, BookOpen, Clock, ChevronRight, CheckCircle2, 
  XCircle, RotateCcw, Eye, ArrowUpRight 
} from "lucide-react";

interface Attempt {
  id: string;
  examId: string;
  examCode?: string;
  attemptNumber: number;
  status: "draft" | "completed";
  answers: Record<string, { selected?: string; correctionInput?: string }>;
  totalCorrect: number;
  score: number;
  completedAt?: string;
  updatedAt?: string;
}

export default function HistoryPage() {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      // Đọc từ local store
      const savedStore = localStorage.getItem("english_platform_store");
      let list: Attempt[] = [];
      if (savedStore) {
        const parsed = JSON.parse(savedStore);
        list = parsed.attempts || [];
      }

      // Nếu chưa có attempts thật, tạo 1 attempt mẫu cho đề ENG001 để học sinh thấy ngay giao diện đẹp
      if (list.length === 0) {
        list = [
          {
            id: "att-sample-1",
            examId: "seed-exam-practice-test-6",
            examCode: "ENG001",
            attemptNumber: 1,
            status: "completed",
            answers: {
              "1": { selected: "B" },
              "2": { selected: "C" },
              "3": { selected: "A" },
              "4": { selected: "D" },
              "5": { selected: "A", correctionInput: "has been hoping" },
              "6": { selected: "C", correctionInput: "the better" },
              "7": { selected: "B", correctionInput: "around" },
              "8": { selected: "B" },
              "9": { selected: "A" },
              "10": { selected: "D" },
            },
            totalCorrect: 36,
            score: 9.0,
            completedAt: new Date().toISOString(),
          },
        ];
      }

      setAttempts(list);
    } catch (e) {
      console.error("Lỗi đọc lịch sử:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Tính toán thống kê tổng quan
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
            <h1 className="text-2xl font-bold text-slate-900">Lịch Sử Làm Bài & Thống Kê Điểm Số</h1>
            <p className="text-sm text-slate-500">Xem lại các lần làm bài, đối chiếu các câu làm sai và theo dõi sự tiến bộ.</p>
          </div>

          <Link
            href="/"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors"
          >
            Luyện thêm đề mới
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Tổng số lượt làm</p>
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

        {/* Attempts List */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-base text-slate-900">Danh sách các lần làm đề</h2>
            <span className="text-xs text-slate-500">Mới nhất lên đầu</span>
          </div>

          <div className="divide-y divide-slate-100">
            {attempts.map((att, idx) => {
              const code = att.examCode || "ENG001";
              return (
                <div key={att.id || idx} className="p-5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700">
                        {code}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900">
                        Lần làm thứ {att.attemptNumber || idx + 1}
                      </h3>
                      {att.status === "draft" && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800">
                          Bản nháp (Đang làm dở)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      Thời gian: {att.completedAt ? new Date(att.completedAt).toLocaleString("vi-VN") : "Đang làm dở"}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {att.status === "completed" && (
                      <div className="text-right mr-2">
                        <span className="text-lg font-extrabold text-blue-600">{att.score}</span>
                        <span className="text-xs text-slate-500"> / 10đ</span>
                        <p className="text-[11px] text-slate-400">Đúng {att.totalCorrect} câu</p>
                      </div>
                    )}

                    <Link
                      href={`/exam/${code}?mode=${att.status === "completed" ? "review" : "test"}`}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{att.status === "completed" ? "Xem lại bài làm" : "Làm tiếp"}</span>
                    </Link>

                    <Link
                      href={`/exam/${code}?mode=study`}
                      className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Xem đáp án đề</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
