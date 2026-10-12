import { jsonrepair } from "jsonrepair";

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
  if (m === "image/heic" || m === "image/heif" || m.includes("heic") || m.includes("heif")) return "image/heic";
  if (m === "image/png") return "image/png";
  if (m === "image/webp") return "image/webp";
  if (m === "image/jpg" || m === "image/pjpeg" || m === "image/jfif" || m.includes("jpeg") || m.includes("jpg")) return "image/jpeg";
  return "image/jpeg";
}

function cleanBase64(raw: string): string {
  if (!raw) return "";
  const commaIdx = raw.indexOf(",");
  const clean = commaIdx !== -1 ? raw.slice(commaIdx + 1) : raw;
  return clean.replace(/\s+/g, "");
}

// Danh sách các mô hình Vision khả dụng thực tế của Google (ưu tiên các mô hình Vision mạnh mẽ nhất)
const CANDIDATE_MODELS = [
  "gemini-2.5-flash",
  "gemini-3.1-pro-preview",
  "gemini-3-flash-preview",
  "gemini-flash-latest",
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
   - Provide a concise, clear 'explanation' in Vietnamese (1-2 sentences explaining why the answer is correct). Keep explanations concise and focused so the complete exam fits comfortably into the JSON output.

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
          "explanation": "string (giải thích ngắn gọn 1-2 câu bằng tiếng Việt)"
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

  const modelErrors: string[] = [];

  for (const model of CANDIDATE_MODELS) {
    const url = `${GEMINI_API_BASE}/${model}:generateContent`;
    try {
      console.log(`[Gemini OCR] Đang thử gọi mô hình: ${model}...`);
      const payload = {
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 32768,
          responseMimeType: "application/json",
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_NONE" },
        ],
      };

      let response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": key,
        },
        body: JSON.stringify(payload),
      });

      // Nếu gặp lỗi 503 quá tải tạm thời, đợi 1.5 giây và thử lại 1 lần
      if (response.status === 503) {
        console.warn(`[Gemini OCR] Mô hình ${model} bị 503, đang đợi 1.5s và thử lại...`);
        await new Promise((r) => setTimeout(r, 1500));
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-goog-api-key": key,
          },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[Gemini OCR] Mô hình ${model} trả về lỗi ${response.status}:`, errorText);
        throw new Error(`Gemini API error (${response.status}): ${errorText}`);
      }

      const json = await response.json();
      const candidate = json.candidates?.[0];
      const rawParts = candidate?.content?.parts || [];
      const textParts = rawParts
        .filter((p: any) => typeof p.text === "string" && !p.thought)
        .map((p: any) => p.text);
      const textOutput = textParts.join("\n").trim() || rawParts[0]?.text?.trim();

      if (!textOutput) {
        const finishReason = candidate?.finishReason || "UNKNOWN";
        const blockReason = json.promptFeedback?.blockReason;
        throw new Error(`Mô hình ${model} không xuất nội dung (Lý do: ${finishReason}${blockReason ? `, Block: ${blockReason}` : ""}).`);
      }

      // Clean markdown code fences if present
      let cleaned = textOutput.trim();
      const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) {
        cleaned = match[1].trim();
      } else {
        cleaned = cleaned.replace(/```json/gi, "").replace(/```/g, "").trim();
      }

      let parsed: ExtractedExamData;
      try {
        parsed = JSON.parse(cleaned);
      } catch (parseErr: any) {
        console.warn(`[Gemini OCR] Parse JSON gốc bị lỗi (${parseErr.message}), đang tự động phục hồi cấu trúc bằng jsonrepair...`);
        const repaired = jsonrepair(cleaned);
        parsed = JSON.parse(repaired);
        console.log(`[Gemini OCR] Phục hồi cấu trúc JSON thành công bằng jsonrepair!`);
      }

      console.log(`[Gemini OCR] Thành công với mô hình: ${model}, trích xuất được ${parsed.totalQuestions || "N"} câu hỏi.`);
      return parsed;
    } catch (err: any) {
      console.warn(`[Gemini OCR] Lỗi với mô hình ${model}:`, err.message);
      modelErrors.push(`[${model}]: ${err.message}`);
    }
  }

  throw new Error(`Không thể trích xuất đề thi: ${modelErrors.join(" | ")}`);
}
