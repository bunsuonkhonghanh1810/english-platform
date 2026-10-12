"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Upload, Sparkles, Plus, Trash2, Save, CheckCircle2, AlertCircle, 
  RefreshCw, Shield, FileText, ChevronRight, Eye, Users, Layers,
  Check, X, UserX, UserCheck, Clock, BookOpen, ExternalLink, Pencil, Lock
} from "lucide-react";
import { processExamImagesAction, saveExamAction, updateExamAction, getExamAction } from "@/actions/exam";
import { getAllExamsAdminAction, deleteExamAction } from "@/actions/admin-exam";
import { getAllUsersAction, updateUserStatusAction, deleteUserAction, getCurrentUserAction } from "@/actions/auth";
import { generateExamCode } from "@/lib/code-generator";

interface AdminQuestion {
  questionNumber: number;
  questionType: string;
  prompt: string;
  options: { A: string; B: string; C: string; D: string };
  underlinedParts?: Record<string, string>;
  correctAnswer: string;
  correctionText?: string;
  explanation: string;
}

interface AdminSection {
  title: string;
  passageText?: string | null;
  questions: AdminQuestion[];
}

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"exams" | "create" | "users">("exams");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Tab 1: Exams State
  const [examsList, setExamsList] = useState<any[]>([]);
  const [isLoadingExams, setIsLoadingExams] = useState(false);

  // Tab 2: Create / Scan Exam State
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [examTitle, setExamTitle] = useState("PRACTICE TEST - Đề mới");
  const [examCode, setExamCode] = useState("ENG002");
  const [totalQuestions, setTotalQuestions] = useState(40);
  const [sections, setSections] = useState<AdminSection[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [editingExamCode, setEditingExamCode] = useState<string | null>(null);

  // Tab 3: Users State
  const [usersList, setUsersList] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userActionMsg, setUserActionMsg] = useState("");

  useEffect(() => {
    getCurrentUserAction().then((u) => {
      if (!u || u.role !== "admin") {
        router.push("/login?redirect=/admin");
      } else {
        setCurrentUser(u);
        setIsCheckingAuth(false);
      }
    });
    setExamCode(generateExamCode());
    loadExams();
    loadUsers();
  }, [router]);

  const loadExams = async () => {
    setIsLoadingExams(true);
    try {
      const data = await getAllExamsAdminAction();
      setExamsList(data || []);
    } catch (e) {
      console.error("Lỗi loadExams:", e);
    } finally {
      setIsLoadingExams(false);
    }
  };

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const data = await getAllUsersAction();
      setUsersList(data || []);
    } catch (e) {
      console.error("Lỗi loadUsers:", e);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Delete Exam
  const handleDeleteExam = async (examId: string, title: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa đề thi "${title}"?`)) return;
    const res = await deleteExamAction(examId);
    if (res.success) {
      setExamsList((prev) => prev.filter((e) => e.id !== examId));
    } else {
      alert(res.error || "Không thể xóa đề thi.");
    }
  };

  // User Actions (Approve / Reject / Delete)
  const handleUpdateUserStatus = async (userId: string, newStatus: "approved" | "rejected") => {
    const res = await updateUserStatusAction(userId, newStatus);
    if (res.success) {
      setUserActionMsg(
        newStatus === "approved"
          ? "Đã phê duyệt tài khoản học sinh thành công!"
          : "Đã từ chối tài khoản này."
      );
      setTimeout(() => setUserActionMsg(""), 3000);
      loadUsers();
    } else {
      alert(res.error || "Lỗi cập nhật trạng thái user.");
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`Bạn có chắc muốn xóa tài khoản "${username}"?`)) return;
    const res = await deleteUserAction(userId);
    if (res.success) {
      setUsersList((prev) => prev.filter((u) => u.id !== userId));
    } else {
      alert(res.error || "Lỗi xóa user.");
    }
  };

  // OCR & Create Exam Handlers
  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
      setErrorMsg("");
    }
  };

  const fileToBase64 = (file: File): Promise<{ mimeType: string; data: string }> => {
    return new Promise((resolve, reject) => {
      // Nếu không phải file ảnh, đọc trực tiếp
      if (!file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const [header, base64Data] = result.split(",");
          const mimeType = header.match(/:(.*?);/)?.[1] || file.type || "application/octet-stream";
          resolve({ mimeType, data: base64Data });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }

      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const maxDimension = 2048;
        let { width, height } = img;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const [header, base64Data] = result.split(",");
            const mimeType = header.match(/:(.*?);/)?.[1] || "image/jpeg";
            resolve({ mimeType, data: base64Data });
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
          return;
        }

        // Vẽ nền trắng và ảnh, nén JPEG 88% giữ nguyên độ sắc nét chữ viết
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
        const [header, base64Data] = dataUrl.split(",");
        resolve({ mimeType: "image/jpeg", data: base64Data });
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const [header, base64Data] = result.split(",");
          const mimeType = header.match(/:(.*?);/)?.[1] || "image/jpeg";
          resolve({ mimeType, data: base64Data });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      };
      img.src = objectUrl;
    });
  };

  const handleScanWithGemini = async () => {
    if (selectedFiles.length === 0) {
      setErrorMsg("Vui lòng chọn hoặc chụp ít nhất 1 ảnh đề thi.");
      return;
    }

    setIsProcessing(true);
    setErrorMsg("");
    setSuccessMsg("");
    setProcessStatus("Đang nén và tải ảnh lên server...");

    try {
      const imagesBase64 = await Promise.all(selectedFiles.map(fileToBase64));
      setProcessStatus("Gemini AI đang đọc ảnh, nhận diện gạch chân và giải đề...");

      const res = await processExamImagesAction(imagesBase64);
      if (!res.success || !res.data) {
        throw new Error(res.error || "Không thể nhận diện ảnh.");
      }

      setExamTitle(res.data.title || "Đề thi Tiếng Anh");
      setTotalQuestions(res.data.totalQuestions || 40);
      setSections(res.data.sections || []);
      if (!editingExamId && res.suggestedCode) {
        setExamCode(res.suggestedCode);
      }

      setSuccessMsg("Đã nhận diện và giải đề thành công! Bạn có thể tinh chỉnh các câu bên dưới.");
    } catch (e: any) {
      setErrorMsg(e.message || "Lỗi khi quét ảnh đề thi.");
    } finally {
      setIsProcessing(false);
      setProcessStatus("");
    }
  };

  const handleTypeChange = (sIdx: number, qIdx: number, newType: string) => {
    setSections((prev) => {
      const copy = [...prev];
      copy[sIdx].questions[qIdx].questionType = newType;
      return copy;
    });
  };

  const handleQuestionFieldChange = (sIdx: number, qIdx: number, field: string, value: any) => {
    setSections((prev) => {
      const copy = [...prev];
      (copy[sIdx].questions[qIdx] as any)[field] = value;
      return copy;
    });
  };

  const handleOptionChange = (sIdx: number, qIdx: number, optKey: "A" | "B" | "C" | "D", value: string) => {
    setSections((prev) => {
      const copy = [...prev];
      copy[sIdx].questions[qIdx].options[optKey] = value;
      return copy;
    });
  };

  const handleStartEditExam = async (code: string) => {
    setIsProcessing(true);
    setProcessStatus(`Đang tải dữ liệu đề ${code}...`);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await getExamAction(code);
      if (!res.success || !res.exam) {
        throw new Error(res.error || "Không thể nạp dữ liệu đề thi.");
      }

      const exam = res.exam;
      setEditingExamId(exam.id);
      setEditingExamCode(exam.code);
      setExamCode(exam.code);
      setExamTitle(exam.title);
      setTotalQuestions(exam.totalQuestions || 40);

      const mappedSections: AdminSection[] = (exam.sections || []).map((sec: any) => ({
        title: sec.title || "",
        passageText: sec.passageText || "",
        questions: (sec.questions || []).map((q: any) => ({
          questionNumber: q.questionNumber,
          questionType: q.questionType || "multiple_choice",
          prompt: q.prompt || "",
          options: q.options || { A: "", B: "", C: "", D: "" },
          underlinedParts: q.underlinedParts || null,
          correctAnswer: q.correctAnswer || "A",
          correctionText: q.correctionText || "",
          explanation: q.explanation || "",
        })),
      }));

      setSections(mappedSections);
      setSelectedFiles([]);
      setIsSaved(false);
      setActiveTab("create");
      setSuccessMsg(`Đang chỉnh sửa đề [${exam.code}]. Bạn có thể tinh chỉnh các câu hỏi và bấm 'Lưu cập nhật' bên dưới.`);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Lỗi khi tải đề thi để chỉnh sửa.");
    } finally {
      setIsProcessing(false);
      setProcessStatus("");
    }
  };

  const handleCancelEdit = () => {
    setEditingExamId(null);
    setEditingExamCode(null);
    setExamCode(generateExamCode());
    setExamTitle("PRACTICE TEST - Đề mới");
    setTotalQuestions(40);
    setSections([]);
    setSelectedFiles([]);
    setIsSaved(false);
    setErrorMsg("");
    setSuccessMsg("");
  };

  const handleAddQuestion = (sIdx: number) => {
    setSections((prev) => {
      const copy = [...prev];
      const maxNum = copy.flatMap((s) => s.questions).reduce((max, q) => Math.max(max, q.questionNumber || 0), 0);
      copy[sIdx].questions.push({
        questionNumber: maxNum + 1,
        questionType: "multiple_choice",
        prompt: "",
        options: { A: "", B: "", C: "", D: "" },
        correctAnswer: "A",
        correctionText: "",
        explanation: "",
      });
      return copy;
    });
  };

  const handleDeleteQuestion = (sIdx: number, qIdx: number) => {
    if (!confirm("Bạn có chắc muốn xóa câu hỏi này không?")) return;
    setSections((prev) => {
      const copy = [...prev];
      copy[sIdx].questions.splice(qIdx, 1);
      return copy;
    });
  };

  const handleAddSection = () => {
    setSections((prev) => [
      ...prev,
      {
        title: "Phần mới: Hướng dẫn phần thi...",
        passageText: "",
        questions: [],
      },
    ]);
  };

  const handleSaveToDb = async () => {
    if (!examTitle.trim() || sections.length === 0) {
      setErrorMsg("Vui lòng nhập tên đề và có ít nhất 1 phần câu hỏi.");
      return;
    }

    setIsProcessing(true);
    setErrorMsg("");

    try {
      let res;
      if (editingExamId) {
        res = await updateExamAction(editingExamId, {
          title: examTitle,
          code: examCode,
          totalQuestions,
          sections,
        });
      } else {
        res = await saveExamAction({
          title: examTitle,
          code: examCode,
          totalQuestions,
          sections,
        });
      }

      if (res.success) {
        setIsSaved(true);
        setSuccessMsg(
          editingExamId
            ? `Đã cập nhật thành công đề thi [${examCode}] trên CSDL Neon!`
            : `Đã lưu thành công đề thi mới với Mã: ${examCode} vào CSDL Neon!`
        );
        loadExams();
      } else {
        throw new Error(res.error || "Không thể lưu đề.");
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Lỗi khi lưu đề thi vào CSDL.");
    } finally {
      setIsProcessing(false);
    }
  };

  const pendingUsersCount = usersList.filter((u) => u.status === "pending").length;

  if (isCheckingAuth) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-semibold">Đang kiểm tra quyền Quản trị viên...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header with Navigation Tabs */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-1">
              <Shield className="w-4 h-4 text-indigo-600" />
              <span>Bảng Điều Khiển Quản Trị (Admin Hub)</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Quản Lý Hệ Thống Đề Thi & Học Sinh</h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Quản lý danh sách đề thi, số hóa đề từ ảnh qua Gemini, và duyệt tài khoản học sinh.
            </p>
          </div>

          {/* Tab Switcher (Cuộn mượt trên màn hình nhỏ iPhone 12) */}
          <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto scrollbar-none gap-1 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab("exams")}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === "exams"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Quản Lý Đề ({examsList.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("create")}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === "create"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {editingExamId ? (
                <>
                  <Pencil className="w-4 h-4 text-amber-600" />
                  <span className="text-amber-700 font-bold">Sửa Đề ({editingExamCode})</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 text-indigo-600" />
                  <span>Thêm / Quét Đề Mới</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("users")}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 relative ${
                activeTab === "users"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Users className="w-4 h-4 text-emerald-600" />
              <span>Quản Lý User ({usersList.length})</span>
              {pendingUsersCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                  {pendingUsersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* TAB 1: QUẢN LÝ ĐỀ THI */}
        {activeTab === "exams" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-base text-slate-900">Danh sách các đề thi trên CSDL Neon</h2>
                <p className="text-xs text-slate-500">Xem thông tin, làm thử hoặc xóa đề thi</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("create")}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Quét / Tạo đề mới</span>
              </button>
            </div>

            {isLoadingExams ? (
              <div className="p-12 text-center text-slate-500 text-sm">Đang tải danh sách đề thi...</div>
            ) : examsList.length === 0 ? (
              <div className="p-12 text-center text-slate-500 space-y-3">
                <p className="text-sm">Chưa có đề thi nào trong CSDL.</p>
                <button
                  type="button"
                  onClick={() => setActiveTab("create")}
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl"
                >
                  Tải ảnh để tạo đề đầu tiên
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {examsList.map((exam) => (
                  <div key={exam.id} className="p-5 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-700">
                          {exam.code}
                        </span>
                        <h3 className="font-bold text-sm text-slate-900">{exam.title}</h3>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-0.5">
                        <span>Số câu hỏi: <strong>{exam.totalQuestions || 40} câu</strong></span>
                        <span>Lượt học sinh đã làm: <strong>{exam.attemptsCount || 0} lượt</strong></span>
                        <span>Ngày tạo: {exam.createdAt ? new Date(exam.createdAt).toLocaleDateString("vi-VN") : "Gần đây"}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <Link
                        href={`/exam/${exam.code}?mode=test`}
                        className="min-h-[36px] px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Vào làm thử</span>
                      </Link>

                      <Link
                        href={`/exam/${exam.code}?mode=study`}
                        className="min-h-[36px] px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Xem lời giải</span>
                      </Link>

                      <button
                        type="button"
                        onClick={() => handleStartEditExam(exam.code)}
                        className="min-h-[36px] px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border border-amber-200 active:scale-95"
                        title="Chỉnh sửa đề thi này"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Sửa đề</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteExam(exam.id, exam.title)}
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                        title="Xóa đề thi này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: QUÉT & THÊM / SỬA ĐỀ BẰNG GEMINI */}
        {activeTab === "create" && (
          <div className="space-y-6">
            {/* Edit Mode Banner */}
            {editingExamId && (
              <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-850 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200">
                    <Pencil className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                      <span>Đang chỉnh sửa đề thi:</span>
                      <span className="font-mono bg-white px-2.5 py-0.5 rounded-lg border border-amber-300 text-amber-800 font-bold">
                        {editingExamCode}
                      </span>
                    </h3>
                    <p className="text-xs text-amber-700">
                      Bạn đang sửa trực tiếp nội dung đề thi này. Hãy kiểm tra các câu hỏi bên dưới và nhấn &quot;Lưu cập nhật đề&quot; để lưu lại.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold shadow-sm transition-all shrink-0 flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <X className="w-3.5 h-3.5 text-slate-500" />
                  <span>Hủy sửa / Tạo đề mới</span>
                </button>
              </div>
            )}

            {/* Upload Section */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
              <h2 className="text-base font-bold text-slate-900 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-indigo-600" />
                  <span>
                    {editingExamId
                      ? "1. Quét lại từ ảnh nếu muốn ghi đè (Tùy chọn)"
                      : "1. Tải ảnh hoặc chụp đề thi (Nhiều trang cùng lúc)"}
                  </span>
                </span>
                {editingExamId && (
                  <span className="text-xs font-normal text-slate-500">
                    (Đã nạp sẵn {sections.reduce((acc, s) => acc + s.questions.length, 0)} câu hỏi bên dưới)
                  </span>
                )}
              </h2>

              <div className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-2xl p-6 text-center bg-slate-50/50 transition-colors">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFiles}
                  id="admin-file-upload"
                  className="hidden"
                />
                <label
                  htmlFor="admin-file-upload"
                  className="cursor-pointer flex flex-col items-center justify-center gap-2"
                >
                  <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-semibold text-slate-800">
                    Nhấn để chọn ảnh đề thi (hoặc kéo thả vào đây)
                  </span>
                  <span className="text-xs text-slate-500">
                    Hỗ trợ chọn nhiều trang cùng lúc (JPG, PNG, WEBP)
                  </span>
                </label>

                {selectedFiles.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap gap-2 justify-center">
                    {selectedFiles.map((f, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200"
                      >
                        Trang {i + 1}: {f.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  disabled={selectedFiles.length === 0 || isProcessing}
                  onClick={handleScanWithGemini}
                  className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-500/20 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  <Sparkles className={`w-4 h-4 ${isProcessing ? "animate-spin" : ""}`} />
                  <span>{isProcessing ? processStatus || "Đang xử lý..." : "Quét & Giải đề bằng Gemini AI"}</span>
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}
            </div>

            {/* Editor Section */}
            {sections.length > 0 && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      {editingExamId ? "2. Chỉnh sửa Thông tin & Nội dung Đề" : "2. Duyệt & Tinh chỉnh Đề Thi"}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {editingExamId
                        ? `Đang biên tập đề [${editingExamCode}]. Bạn có thể sửa câu hỏi, đáp án đúng và lời giải.`
                        : "Chỉnh sửa tên đề, mã 6 ký tự, dạng bài, đoạn gạch chân và lời giải."}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveToDb}
                      disabled={isProcessing}
                      className={`px-5 py-2.5 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 ${
                        editingExamId
                          ? "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20"
                          : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                      }`}
                    >
                      <Save className="w-4 h-4" />
                      <span>
                        {isProcessing
                          ? "Đang lưu..."
                          : editingExamId
                          ? `Lưu cập nhật đề [${editingExamCode}]`
                          : "Lưu & Xuất bản vào Neon"}
                      </span>
                    </button>

                    {isSaved && (
                      <Link
                        href={`/exam/${examCode}?mode=test`}
                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Làm thử ngay ({examCode})</span>
                      </Link>
                    )}
                  </div>
                </div>

                {/* Exam Meta Info */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Tên Đề Thi</label>
                    <input
                      type="text"
                      value={examTitle}
                      onChange={(e) => setExamTitle(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {editingExamId ? "Mã Đề (Cố định khi sửa)" : "Mã 6 Ký Tự Duy Nhất"}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={examCode}
                        readOnly={Boolean(editingExamId)}
                        disabled={Boolean(editingExamId)}
                        onChange={(e) => !editingExamId && setExamCode(e.target.value.toUpperCase())}
                        maxLength={6}
                        className={`w-full px-3 py-2 text-sm font-bold uppercase tracking-wider rounded-lg border focus:outline-none ${
                          editingExamId
                            ? "bg-slate-100 text-slate-600 border-slate-300 cursor-not-allowed"
                            : "bg-white border-slate-300 focus:ring-1 focus:ring-blue-500"
                        }`}
                      />
                      {editingExamId ? (
                        <div
                          title="Mã đề cố định khi chỉnh sửa đề để bảo toàn kết quả làm bài của học sinh"
                          className="p-2 bg-amber-100 border border-amber-300 rounded-lg text-amber-700 flex items-center justify-center shrink-0 cursor-help"
                        >
                          <Lock className="w-4 h-4" />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setExamCode(generateExamCode())}
                          title="Tạo mã ngẫu nhiên mới"
                          className="p-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-700"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Tổng Số Câu Hỏi (N câu)</label>
                    <input
                      type="number"
                      value={totalQuestions}
                      onChange={(e) => setTotalQuestions(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Sections & Questions Editor */}
                <div className="space-y-8">
                  {sections.map((section, sIdx) => (
                    <div key={sIdx} className="border border-slate-200 rounded-xl p-5 bg-white space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                          Phần {sIdx + 1}: Hướng dẫn phần thi
                        </label>
                        <input
                          type="text"
                          value={section.title}
                          onChange={(e) => {
                            const copy = [...sections];
                            copy[sIdx].title = e.target.value;
                            setSections(copy);
                          }}
                          className="w-full px-3 py-2 text-sm font-medium bg-slate-50 border border-slate-200 rounded-lg"
                        />
                      </div>

                      {section.passageText !== undefined && (
                        <div>
                          <label className="block text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">
                            Đoạn văn đọc hiểu (Nếu có)
                          </label>
                          <textarea
                            rows={5}
                            value={section.passageText || ""}
                            onChange={(e) => {
                              const copy = [...sections];
                              copy[sIdx].passageText = e.target.value;
                              setSections(copy);
                            }}
                            placeholder="Dán hoặc chỉnh sửa đoạn văn đọc hiểu tại đây nếu có..."
                            className="w-full px-3 py-2 text-xs sm:text-sm bg-amber-50/40 border border-amber-200 rounded-lg font-serif"
                          />
                        </div>
                      )}

                      <div className="space-y-4 pt-2">
                        {section.questions.map((q, qIdx) => (
                          <div key={qIdx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold bg-slate-800 text-white px-2 py-0.5 rounded">
                                  Câu {q.questionNumber}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteQuestion(sIdx, qIdx)}
                                  className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                                  title="Xóa câu hỏi này"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div className="flex items-center gap-2">
                                <label className="text-xs font-semibold text-slate-600">Dạng bài:</label>
                                <select
                                  value={q.questionType}
                                  onChange={(e) => handleTypeChange(sIdx, qIdx, e.target.value)}
                                  className="text-xs px-2.5 py-1 bg-white border border-slate-300 rounded-lg font-medium"
                                >
                                  <option value="pronunciation">Phát âm (Pronunciation)</option>
                                  <option value="stress">Trọng âm (Stress)</option>
                                  <option value="error_correction">Tìm lỗi sai (Error Correction)</option>
                                  <option value="multiple_choice">Trắc nghiệm cơ bản</option>
                                  <option value="reading">Đọc hiểu (Reading)</option>
                                  <option value="writing">Viết câu (Writing)</option>
                                  <option value="dialogue">Đối thoại / Tình huống</option>
                                </select>
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">Nội dung câu hỏi</label>
                              <input
                                type="text"
                                value={q.prompt}
                                onChange={(e) => handleQuestionFieldChange(sIdx, qIdx, "prompt", e.target.value)}
                                className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg"
                              />
                            </div>

                            {q.questionType !== "writing" && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {(["A", "B", "C", "D"] as const).map((opt) => (
                                  <div key={opt} className="flex items-center gap-2">
                                    <span className="text-xs font-bold px-2 py-1 rounded bg-slate-200 shrink-0">
                                      {opt}
                                    </span>
                                    <input
                                      type="text"
                                      value={q.options[opt] || ""}
                                      onChange={(e) => handleOptionChange(sIdx, qIdx, opt, e.target.value)}
                                      className="w-full px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg"
                                    />
                                  </div>
                                ))}
                              </div>
                            )}

                            {(q.questionType === "error_correction" || q.questionType === "writing") && (
                              <div className="bg-amber-50/50 p-2.5 rounded-lg border border-amber-200/80">
                                <label className="block text-xs font-bold text-amber-900 mb-1">
                                  {q.questionType === "writing" ? "Câu mẫu chuẩn viết lại:" : "Từ sửa đúng chuẩn:"}
                                </label>
                                <input
                                  type="text"
                                  value={q.correctionText || ""}
                                  onChange={(e) => handleQuestionFieldChange(sIdx, qIdx, "correctionText", e.target.value)}
                                  placeholder="Nhập từ hoặc câu sửa chuẩn..."
                                  className="w-full px-2.5 py-1 text-xs bg-white border border-amber-300 rounded-lg"
                                />
                              </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1">
                              {q.questionType !== "writing" && (
                                <div>
                                  <label className="block text-xs font-bold text-emerald-700 mb-1">Đáp án đúng</label>
                                  <select
                                    value={q.correctAnswer}
                                    onChange={(e) => handleQuestionFieldChange(sIdx, qIdx, "correctAnswer", e.target.value)}
                                    className="w-full px-2.5 py-1 text-xs font-bold bg-white border border-emerald-400 rounded-lg text-emerald-900"
                                  >
                                    <option value="A">A</option>
                                    <option value="B">B</option>
                                    <option value="C">C</option>
                                    <option value="D">D</option>
                                  </select>
                                </div>
                              )}

                              <div className={q.questionType !== "writing" ? "sm:col-span-3" : "sm:col-span-4"}>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Lời giải chi tiết tiếng Việt</label>
                                <input
                                  type="text"
                                  value={q.explanation || ""}
                                  onChange={(e) => handleQuestionFieldChange(sIdx, qIdx, "explanation", e.target.value)}
                                  className="w-full px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Add Question Button */}
                      <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => handleAddQuestion(sIdx)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5 text-blue-600" />
                          <span>Thêm câu hỏi vào Phần {sIdx + 1}</span>
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Add Section & Bottom Save Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={handleAddSection}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors"
                    >
                      <Plus className="w-4 h-4 text-indigo-600" />
                      <span>Thêm Phần Thi Mới</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveToDb}
                      disabled={isProcessing}
                      className={`px-6 py-2.5 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 ${
                        editingExamId
                          ? "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20"
                          : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                      }`}
                    >
                      <Save className="w-4 h-4" />
                      <span>
                        {isProcessing
                          ? "Đang lưu..."
                          : editingExamId
                          ? `Lưu cập nhật đề [${editingExamCode}]`
                          : "Lưu & Xuất bản vào Neon"}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: QUẢN LÝ USER & PHÊ DUYỆT TÀI KHOẢN */}
        {activeTab === "users" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-base text-slate-900">Danh sách Người Dùng & Phê Duyệt Tài Khoản</h2>
                <p className="text-xs text-slate-500">
                  Xác nhận kích hoạt khi học sinh tạo tài khoản hoặc xóa tài khoản vi phạm.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 font-semibold border border-amber-200">
                  Chờ duyệt: {pendingUsersCount}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                  Đã duyệt: {usersList.filter((u) => u.status === "approved").length}
                </span>
              </div>
            </div>

            {userActionMsg && (
              <div className="mx-5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
                ✓ {userActionMsg}
              </div>
            )}

            {isLoadingUsers ? (
              <div className="p-12 text-center text-slate-500 text-sm">Đang tải danh sách người dùng...</div>
            ) : usersList.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-sm">Chưa có người dùng nào đăng ký.</div>
            ) : (
              <div className="divide-y divide-slate-100 overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[580px]">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-3">Học sinh / Người dùng</th>
                      <th className="px-5 py-3">Username</th>
                      <th className="px-5 py-3">Vai trò</th>
                      <th className="px-5 py-3">Trạng thái</th>
                      <th className="px-5 py-3">Ngày tạo</th>
                      <th className="px-5 py-3 text-right">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {usersList.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-4 font-semibold text-slate-900">
                          {user.fullName || user.username}
                          {user.email && <div className="text-[11px] font-normal text-slate-400">{user.email}</div>}
                        </td>
                        <td className="px-5 py-4 font-mono font-medium text-slate-700">{user.username}</td>
                        <td className="px-5 py-4">
                          <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                            user.role === "admin" ? "bg-indigo-100 text-indigo-800" : "bg-slate-100 text-slate-700"
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {user.status === "approved" && (
                            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold text-[10px]">
                              <Check className="w-3 h-3" /> Đã duyệt
                            </span>
                          )}
                          {user.status === "pending" && (
                            <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-bold text-[10px] animate-pulse">
                              <Clock className="w-3 h-3" /> Chờ duyệt
                            </span>
                          )}
                          {user.status === "rejected" && (
                            <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full font-bold text-[10px]">
                              <X className="w-3 h-3" /> Từ chối
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-slate-400">
                          {user.createdAt ? new Date(user.createdAt).toLocaleDateString("vi-VN") : "Gần đây"}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {user.status === "pending" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateUserStatus(user.id, "approved")}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Duyệt</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateUserStatus(user.id, "rejected")}
                                  className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                                >
                                  Từ chối
                                </button>
                              </>
                            )}

                            {user.status === "rejected" && (
                              <button
                                type="button"
                                onClick={() => handleUpdateUserStatus(user.id, "approved")}
                                className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-semibold transition-colors"
                              >
                                Mở khóa lại
                              </button>
                            )}

                            {user.role !== "admin" && (
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(user.id, user.username)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-1"
                                title="Xóa tài khoản này"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
