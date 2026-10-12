# EnglishExam AI Pro 🎓
> Nền tảng luyện thi trắc nghiệm tiếng Anh & số hóa đề thi tự động với Google Gemini AI và Neon Serverless Postgres.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/Neon-Postgres-00E599?logo=postgresql)](https://neon.tech/)
[![Google Gemini](https://img.shields.io/badge/Gemini-AI-4285F4?logo=google)](https://deepmind.google/technologies/gemini/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)

---

## 🌟 Tính Năng Nổi Bật

- **Luyện thi tương tác thông minh**:
  - Hỗ trợ đầy đủ các dạng bài thi tiếng Anh: Phát âm, Trọng âm, Tìm lỗi sai (gạch chân và điền từ sửa lại), Điền từ, Đọc hiểu phân đoạn và Viết lại câu.
  - Tự động lưu bản nháp bài làm dở theo tài khoản học sinh lên CSDL Neon & Local Storage, không sợ mất bài khi vô tình tắt trình duyệt.
  - Chấm điểm tự động tức thì kèm lời giải thích chi tiết cho từng câu hỏi.

- **Số hóa đề thi từ ảnh với Google Gemini AI**:
  - Chụp hoặc tải ảnh đề thi giấy (hỗ trợ tải nhiều trang cùng lúc).
  - Tự động nhận diện cấu trúc đề, trích xuất đoạn văn đọc hiểu, tách câu hỏi, đáp án đúng và sinh lời giải thích chi tiết chuẩn sư phạm.

- **Admin Hub & Quản lý người dùng**:
  - Quản trị viên: Xem danh sách đề thi, vào làm thử, sửa trực tiếp nội dung đề thi, xóa đề.
  - Quy trình phê duyệt tài khoản học sinh (Pending / Approved / Rejected) bảo mật.

- **Tối ưu trải nghiệm Responsive đa thiết bị (Chuẩn UI/UX Pro Max)**:
  - **iPhone 12 (390px)**: Bảng câu hỏi dạng Slide-up Bottom Sheet Drawer mở nhanh, touch target ≥ 44px, nút xem nhanh đoạn văn đọc hiểu không mất vị trí làm bài, chống iOS auto-zoom trên các ô nhập liệu.
  - **iPad Air 3 (834px dọc / 1112px ngang)**: Chế độ ngang tự động chia đôi 2 cột (bài đọc hiểu ghim cố định bên trái, câu hỏi bên phải).
  - **Laptop tiêu chuẩn (1366x768 - 1920x1080)**: Giao diện 3 cột rộng rãi, thanh bảng câu hỏi cố định bên phải màn hình.

---

## 🛠️ Công Nghệ Sử Dụng

- **Frontend & Fullstack**: Next.js 16 (Turbopack, Server Actions), React 19, Tailwind CSS.
- **Database & ORM**: Neon Serverless Postgres, Drizzle ORM.
- **AI Engine**: Google Gemini API (`gemini-2.5-flash` / `gemini-1.5-flash`).
- **Icons & UI**: Lucide React.

---

## ⚙️ Biến Môi Trường (Environment Variables)

Khi triển khai trên **Vercel** hoặc môi trường cục bộ (`.env.local`), cần cấu hình các biến sau:

```env
DATABASE_URL="postgresql://<user>:<password>@<host>/<database>?sslmode=require"
DIRECT_URL="postgresql://<user>:<password>@<host-direct>/<database>?sslmode=require"
GEMINI_API_KEY="your-google-gemini-api-key"
JWT_SECRET="your-jwt-secret-key"
```

---

## 🚀 Hướng Dẫn Chạy Cục Bộ (Local Development)

1. **Cài đặt thư viện**:
   ```bash
   npm install
   ```

2. **Chạy server phát triển**:
   ```bash
   npm run dev
   ```

3. **Truy cập ứng dụng**:
   Mở trình duyệt tại [http://localhost:3000](http://localhost:3000).
