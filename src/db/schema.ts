import { pgTable, text, varchar, integer, timestamp, jsonb, numeric, index } from "drizzle-orm/pg-core";

// 1. Người dùng & Phân quyền
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  fullName: varchar("full_name", { length: 100 }),
  email: varchar("email", { length: 255 }).unique(),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 20 }).notNull().default("user"), // 'admin' | 'user'
  status: varchar("status", { length: 20 }).notNull().default("pending"), // 'pending' | 'approved' | 'rejected'
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 2. Đề thi (Dynamic N questions)
export const exams = pgTable(
  "exams",
  {
    id: text("id").primaryKey(),
    code: varchar("code", { length: 6 }).notNull().unique(), // Mã 6 ký tự như K8X2M9
    title: varchar("title", { length: 255 }).notNull(),
    totalQuestions: integer("total_questions").notNull().default(40),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("exams_code_idx").on(table.code)]
);

// 3. Các phần thi & Bài đọc hiểu
export const sections = pgTable("sections", {
  id: text("id").primaryKey(),
  examId: text("exam_id")
    .notNull()
    .references(() => exams.id, { onDelete: "cascade" }),
  title: text("title").notNull(), // Tiêu đề phần, e.g. "Mark the letter A, B, C, or D..."
  passageText: text("passage_text"), // Đoạn văn đọc hiểu dài nếu có
  orderIndex: integer("order_index").notNull().default(0),
});

// 4. Chi tiết từng câu hỏi
export const questions = pgTable("questions", {
  id: text("id").primaryKey(),
  sectionId: text("section_id")
    .notNull()
    .references(() => sections.id, { onDelete: "cascade" }),
  questionNumber: integer("question_number").notNull(), // 1 .. N
  questionType: varchar("question_type", { length: 50 }).notNull().default("multiple_choice"), // 'pronunciation', 'stress', 'error_correction', 'multiple_choice', 'reading', 'dialogue'
  prompt: text("prompt").notNull(),
  options: jsonb("options").$type<{ A: string; B: string; C: string; D: string }>().notNull(),
  underlinedParts: jsonb("underlined_parts").$type<Record<string, string>>(), // { A?: string, B?: string, C?: string, D?: string, target?: string }
  correctAnswer: varchar("correct_answer", { length: 2 }).notNull(), // 'A' | 'B' | 'C' | 'D'
  correctionText: text("correction_text"), // Từ sửa đúng cho câu tìm lỗi sai
  explanation: text("explanation"), // Lời giải thích tiếng Việt
  orderIndex: integer("order_index").notNull().default(0),
});

// 5. Tiến trình làm bài, Lưu nháp & Lịch sử
export const examAttempts = pgTable(
  "exam_attempts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    examId: text("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull().default(1),
    status: varchar("status", { length: 20 }).notNull().default("draft"), // 'draft' | 'completed'
    answers: jsonb("answers")
      .$type<Record<string, { selected?: string; correctionInput?: string }>>()
      .notNull()
      .default({}),
    totalCorrect: integer("total_correct").default(0),
    score: numeric("score", { precision: 4, scale: 2 }).default("0.00"),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("attempts_user_exam_idx").on(table.userId, table.examId),
  ]
);

export type User = typeof users.$inferSelect;
export type Exam = typeof exams.$inferSelect;
export type Section = typeof sections.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type ExamAttempt = typeof examAttempts.$inferSelect;
