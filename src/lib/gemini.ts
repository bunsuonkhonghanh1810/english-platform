export interface ExtractedQuestion {
  questionNumber: number;
  questionType: "pronunciation" | "stress" | "error_correction" | "multiple_choice" | "reading" | "writing" | "dialogue";
  prompt: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  underlinedParts?: Record<string, string>;
  correctAnswer: "A" | "B" | "C" | "D";
  correctionText?: string;
  explanation: string;
}

export interface ExtractedSection {
  title: string;
  passageText?: string;
  questions: ExtractedQuestion[];
}

export interface ExtractedExamData {
  title: string;
  totalQuestions: number;
  sections: ExtractedSection[];
}

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function normalizeImageMimeType(mime?: string): string {
  if (!mime) return "image/jpeg";
  const m = mime.toLowerCase().trim();
  if (m === "image/jpg" || m === "image/pjpeg" || m === "image/jfif" || m.includes("jpeg") || m.includes("jpg")) return "image/jpeg";
  if (m === "image/png") return "image/png";
  if (m === "image/webp") return "image/webp";
  if (m === "image/heic" || m === "image/heif") return "image/heic";
  return "image/jpeg";
}

function cleanBase64(raw: string): string {
  if (!raw) return "";
  const commaIdx = raw.indexOf(",");
  const clean = commaIdx !== -1 ? raw.slice(commaIdx + 1) : raw;
  return clean.replace(/\s+/g, "");
}

// Danh sách các mô hình Vision khả dụng thực tế của Google (xếp theo độ ổn định & tốc độ cao nhất)
const CANDIDATE_MODELS = [
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-3.5-flash",
  "gemini-flash-lite-latest",
];

export async function extractExamFromImages(
  imagesBase64: { mimeType: string; data: string }[],
  apiKey?: string
): Promise<ExtractedExamData> {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("Chưa cấu hình GEMINI_API_KEY.");
  }

  const prompt = `You are an elite expert in English examination digitizing, OCR, linguistics, and test solving.
Examine all provided exam photos in order and extract the complete examination into a structured JSON object.

RULES FOR ACCURACY:
1. DYNAMIC NUMBER OF QUESTIONS: Count and extract ALL questions present (e.g. 30, 40, or 50 questions). Do NOT omit any question.
2. READING PASSAGES: If questions belong to a reading comprehension passage, extract the reading passage into 'passageText' of that section.
3. ERROR CORRECTION (DẠNG TÌM LỖI SAI):
   - In question prompt, show the sentence with 4 underlined parts: <u>word</u> (A) ... <u>word</u> (B) ... <u>word</u> (C) ... <u>word</u> (D).
   - In 'underlinedParts', map: { "A": "word_A", "B": "word_B", "C": "word_C", "D": "word_D" }.
   - In 'correctionText', provide the correct replacement word/phrase for the erroneous part (e.g., if A is wrong, write the correct word it should be changed to).
4. WRITING / SENTENCE TRANSFORMATION:
   - For sentence rewriting or sentence combining questions (often questions 33 to 40), set 'questionType' to 'writing'. Leave options empty or dummy, and set 'correctionText' to the complete model target sentence.
5. PRONUNCIATION / STRESS (PHÁT ÂM / TRỌNG ÂM):
   - In prompt or options, clearly mark underlined/bold letters being tested using <u>...</u>.
6. SOLVE AND EXPLAIN:
   - For every question, determine the correct answer ('A', 'B', 'C', or 'D').
   - Provide a clear, pedagogical 'explanation' in Vietnamese explaining why this answer is correct and why other choices are incorrect.

OUTPUT FORMAT: Return ONLY a valid JSON object with this exact TypeScript structure:
{
  "title": "string (Exam Title, e.g. 'PRACTICE TEST 6')",
  "totalQuestions": number,
  "sections": [
    {
      "title": "string (Instructions, e.g. 'Mark the letter A, B, C, or D...')",
      "passageText": "string or null (Full reading passage if applicable)",
      "questions": [
        {
          "questionNumber": number,
          "questionType": "pronunciation" | "stress" | "error_correction" | "multiple_choice" | "reading" | "writing" | "dialogue",
          "prompt": "string",
          "options": {
            "A": "string",
            "B": "string",
            "C": "string",
            "D": "string"
          },
          "underlinedParts": { "A": "...", "B": "...", "C": "...", "D": "..." } or null,
          "correctAnswer": "A" | "B" | "C" | "D",
          "correctionText": "string or null",
          "explanation": "string (giải thích chi tiết bằng tiếng Việt)"
        }
      ]
    }
  ]
}
Do not include markdown backticks around the JSON. Output raw JSON only.`;

  const parts: any[] = [{ text: prompt }];
  for (const img of imagesBase64) {
    const mimeType = normalizeImageMimeType(img.mimeType);
    const data = cleanBase64(img.data);
    if (!data) continue;
    parts.push({
      inlineData: {
        mimeType,
        data,
      },
    });
  }

  let lastError: any = null;

  for (const model of CANDIDATE_MODELS) {
    const url = `${GEMINI_API_BASE}/${model}:generateContent`;
    try {
      console.log(`[Gemini OCR] Đang thử gọi mô hình: ${model}...`);
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": key,
        },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 16384,
            responseMimeType: "application/json",
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[Gemini OCR] Mô hình ${model} trả về lỗi ${response.status}:`, errorText);
        throw new Error(`Gemini API error (${response.status}) on model ${model}: ${errorText}`);
      }

      const json = await response.json();
      const candidate = json.candidates?.[0];
      const textOutput = candidate?.content?.parts?.[0]?.text;

      if (!textOutput) {
        throw new Error(`Không nhận được nội dung từ Gemini (${model}).`);
      }

      // Clean markdown code fences if present
      let cleaned = textOutput.trim();
      const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) {
        cleaned = match[1].trim();
      } else {
        cleaned = cleaned.replace(/```json/gi, "").replace(/```/g, "").trim();
      }

      const parsed: ExtractedExamData = JSON.parse(cleaned);
      console.log(`[Gemini OCR] Thành công với mô hình: ${model}, trích xuất được ${parsed.totalQuestions || "N"} câu hỏi.`);
      return parsed;
    } catch (err: any) {
      console.warn(`[Gemini OCR] Lỗi với mô hình ${model}:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error("Không thể trích xuất đề thi từ ảnh sau khi thử tất cả mô hình.");
}
