"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Sparkles, Shuffle, BookOpen, Clock, CheckCircle2, ChevronRight, Shield, Award } from "lucide-react";
import { getRandomExamCodeAction } from "@/actions/exam";

export default function HomePage() {
  const router = useRouter();
  const [searchCode, setSearchCode] = useState("");
  const [isLoadingRandom, setIsLoadingRandom] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchCode.trim()) {
      setErrorMsg("Vui lòng nhập mã đề thi 6 ký tự.");
      return;
    }
    setErrorMsg("");
    router.push(`/exam/${searchCode.trim().toUpperCase()}`);
  };

  const handleRandomExam = async () => {
    setIsLoadingRandom(true);
    try {
      const code = await getRandomExamCodeAction();
      router.push(`/exam/${code}`);
    } catch {
      router.push("/exam/ENG001");
    } finally {
      setIsLoadingRandom(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-between">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24">
        {/* Background Gradients */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-blue-400/20 via-indigo-400/20 to-sky-300/20 blur-3xl rounded-full -z-10 pointer-events-none" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-6 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
            <span>Nền tảng Luyện thi & Số hóa Đề trắc nghiệm AI</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.15] mb-4">
            Luyện đề Tiếng Anh <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 bg-clip-text text-transparent">
              Chính xác & Tiện lợi mỗi ngày
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto mb-10">
            Nhập mã 6 ký tự đã ghi trong vở để mở đề, làm bài trên giao diện đề thi trắng tương tác,
            lưu nháp bất cứ lúc nào và xem lời giải chi tiết tức thì.
          </p>

          {/* Search Box Card */}
          <div className="bg-white/95 backdrop-blur-md p-3 sm:p-4 rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-200/80 max-w-xl mx-auto">
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchCode}
                  onChange={(e) => {
                    setSearchCode(e.target.value);
                    setErrorMsg("");
                  }}
                  placeholder="Nhập mã 6 ký tự (Ví dụ: ENG001)"
                  maxLength={10}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-medium text-base tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>

              <button
                type="submit"
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-md shadow-blue-500/25 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <span>Vào Làm Đề</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </form>

            {errorMsg && (
              <p className="text-xs text-red-600 text-left mt-2 pl-2 font-medium">{errorMsg}</p>
            )}

            {/* Quick Actions Under Search */}
            <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 px-1 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                Mã mẫu sẵn có:{" "}
                <button
                  type="button"
                  onClick={() => setSearchCode("ENG001")}
                  className="font-bold text-blue-600 hover:underline px-1 py-0.5 rounded bg-blue-50"
                >
                  ENG001
                </button>
              </span>

              <button
                type="button"
                onClick={handleRandomExam}
                disabled={isLoadingRandom}
                className="inline-flex items-center gap-1.5 font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                <Shuffle className={`w-3.5 h-3.5 ${isLoadingRandom ? "animate-spin" : ""}`} />
                <span>{isLoadingRandom ? "Đang chọn..." : "Làm đề ngẫu nhiên"}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Exams & Quick Access */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 w-full pb-16">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Bộ đề thi tiêu biểu</h2>
            <p className="text-xs sm:text-sm text-slate-500">Các đề đã được số hóa hoàn chỉnh kèm đầy đủ đáp án & lời giải</p>
          </div>
          <Link
            href="/history"
            className="text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            Lịch sử làm bài <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Featured Exam Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-700">
                  Mã: ENG001
                </span>
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> 40 câu hỏi linh hoạt
                </span>
              </div>

              <h3 className="font-bold text-base text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">
                PRACTICE TEST 6 - Đề Thi Tuyển Sinh Tiếng Anh
              </h3>
              <p className="text-xs text-slate-600 line-clamp-2 mb-4">
                Bao gồm trọng âm, phát âm, dạng bài tìm lỗi sai (gạch chân và ô điền sửa lỗi), điền từ và đọc hiểu phân đoạn.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
              <Link
                href="/exam/ENG001?mode=test"
                className="flex-1 py-2 px-3 text-center rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                Làm bài ngay
              </Link>
              <Link
                href="/exam/ENG001?mode=study"
                className="py-2 px-3 text-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors"
              >
                Xem đề & Lời giải
              </Link>
            </div>
          </div>

          {/* Admin Studio Promo Card */}
          <div className="bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-5 rounded-2xl border border-indigo-200/70 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-3">
                <Shield className="w-4 h-4 text-indigo-600" />
                <span>Dành cho Giáo viên & Quản trị</span>
              </div>
              <h3 className="font-bold text-base text-slate-900 mb-1">
                Tải ảnh đề thi & Số hóa tự động với Gemini
              </h3>
              <p className="text-xs text-slate-600 mb-4">
                Chụp nhiều trang đề thi giấy, hệ thống tự động nhận diện gạch chân, trích xuất câu hỏi, tạo đáp án và lời giải chỉ trong vài giây.
              </p>
            </div>

            <Link
              href="/admin"
              className="py-2.5 px-4 text-center rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
            >
              <span>Mở Admin Studio</span>
              <Sparkles className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        <p>© 2026 English Platform. Số hóa thông minh với Neon Serverless Postgres & Google Gemini AI.</p>
      </footer>
    </div>
  );
}
