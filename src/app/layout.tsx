import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import Navbar from "@/components/Navbar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "English Platform - Hệ thống Luyện đề & Số hóa Đề thi",
  description: "Số hóa đề thi tiếng Anh bằng Gemini AI, luyện đề tương tác, theo dõi tiến độ và lưu trữ trên Neon Postgres.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <Suspense fallback={<div className="h-16 border-b border-slate-200 bg-white" />}>
          <Navbar />
        </Suspense>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
