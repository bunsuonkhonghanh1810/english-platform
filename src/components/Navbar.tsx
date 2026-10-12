"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, History, Shield, LogIn, LogOut, UserCheck } from "lucide-react";
import { getCurrentUserAction, logoutAction } from "@/actions/auth";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<{ username: string; role: string } | null>(null);

  useEffect(() => {
    getCurrentUserAction().then((u) => {
      if (u) setCurrentUser(u);
      else setCurrentUser(null);
    });
  }, [pathname]);

  const handleLogout = async () => {
    await logoutAction();
    setCurrentUser(null);
    router.push("/");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-slate-200 shadow-sm transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-600 bg-clip-text text-transparent">
                EnglishExam
              </span>
              <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                AI Pro
              </span>
            </div>
            <p className="text-[11px] text-slate-500 -mt-0.5 hidden sm:block">Hệ thống luyện đề & Số hóa thông minh</p>
          </div>
        </Link>

        {/* Navigation Items */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/"
            className={`min-h-[40px] px-2.5 sm:px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 ${
              pathname === "/"
                ? "bg-blue-50 text-blue-700 font-semibold"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <BookOpen className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Luyện đề</span>
          </Link>

          <Link
            href="/history"
            className={`min-h-[40px] px-2.5 sm:px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 ${
              pathname === "/history"
                ? "bg-blue-50 text-blue-700 font-semibold"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <History className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Lịch sử & Điểm số</span>
          </Link>

          {/* Admin link (Chỉ hiển thị khi đã đăng nhập với tài khoản admin) */}
          {currentUser?.role === "admin" && (
            <Link
              href="/admin"
              className={`min-h-[40px] px-2.5 sm:px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 ${
                pathname.startsWith("/admin")
                  ? "bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Shield className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="hidden sm:inline">Quản Trị</span>
            </Link>
          )}

          {/* User Account / Auth Status */}
          <div className="ml-1 sm:ml-2 pl-1 sm:pl-2 border-l border-slate-200 flex items-center gap-1">
            {currentUser ? (
              <div className="flex items-center gap-1 sm:gap-2">
                <span className="text-xs font-semibold text-slate-700 hidden md:inline">
                  {currentUser.username}
                  <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                    currentUser.role === "admin" ? "bg-indigo-100 text-indigo-800" : "bg-emerald-100 text-emerald-800"
                  }`}>
                    {currentUser.role}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Đăng xuất"
                  aria-label="Đăng xuất"
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-all flex items-center gap-1.5 shadow-sm"
              >
                <LogIn className="w-3.5 h-3.5 shrink-0" />
                <span>Đăng nhập</span>
              </Link>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
