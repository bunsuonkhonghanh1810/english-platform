export interface ExtractedQuestion {
  questionNumber: number;
  questionType: "pronunciation" | "stress" | "error_correction" | "multiple_choice" | "reading" | "dialogue";
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
const PRIMARY_MODEL = "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-1.5-flash";

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
4. PRONUNCIATION / STRESS (PHÁT ÂM / TRỌNG ÂM):
   - In prompt or options, clearly mark underlined/bold letters being tested.
5. SOLVE AND EXPLAIN:
   - For every question, determine the correct answer ('A', 'B', 'C', or 'D').
   - Provide a clear, pedagogical 'explanation' in Vietnamese explaining why this answer is correct and why other choices are incorrect.

OUTPUT FORMAT: Return ONLY a valid JSON object with this exact TypeScript structure:
{
  "title": "string (Exam Title, e.g. 'Practice Test 6')",
  "totalQuestions": number,
  "sections": [
    {
      "title": "string (Instructions, e.g. 'Mark the letter A, B, C, or D...')",
      "passageText": "string or null (Full reading passage if applicable)",
      "questions": [
        {
          "questionNumber": number,
          "questionType": "pronunciation" | "stress" | "error_correction" | "multiple_choice" | "reading" | "dialogue",
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
    parts.push({
      inline_data: {
        mime_type: img.mimeType || "image/jpeg",
        data: img.data,
      },
    });
  }

  const modelsToTry = [PRIMARY_MODEL, FALLBACK_MODEL];
  let lastError: any = null;

  for (const model of modelsToTry) {
    const url = `${GEMINI_API_BASE}/${model}:generateContent`;
    try {
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
        throw new Error(`Gemini API error (${response.status}): ${errorText}`);
      }

      const json = await response.json();
      const candidate = json.candidates?.[0];
      const textOutput = candidate?.content?.parts?.[0]?.text;

      if (!textOutput) {
        throw new Error("Không nhận được nội dung từ Gemini.");
      }

      // Clean fences if present
      const cleaned = textOutput
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      const parsed: ExtractedExamData = JSON.parse(cleaned);
      return parsed;
    } catch (err: any) {
      console.warn(`[Gemini OCR] Model ${model} failed:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error("Không thể trích xuất đề thi từ ảnh.");
}
