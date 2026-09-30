// ============================================================
//  שליחת פרומפט למנוע AI מהאפליקציה.
//  תומך בשני ספקים:
//    • OpenRouter  — מפתח בסגנון sk-or-…  (מודלים בסגנון vendor/model)
//    • Gemini      — מפתח בסגנון AIza…
//  הספק נקבע לפי המודל שנבחר (מודל OpenRouter מכיל "/"), והמפתח נבדק להתאמה.
//  ב-OpenRouter מאמץ החשיבה (reasoning effort) תמיד "high".
// ============================================================

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_REASONING_EFFORT = "high";

const geminiUrl = (m, key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(key)}`;

const isOpenRouterModel = (m) => (m || "").includes("/");
const isOpenRouterKey = (k) => /^sk-or-/i.test((k || "").trim());
const isGeminiKey = (k) => /^AIza/i.test((k || "").trim());

async function errorText(res, provider) {
  let detail = "";
  try {
    const e = await res.json();
    const raw = e?.error?.message ?? e?.error ?? e?.message;
    if (typeof raw === "string") detail = raw;
  } catch {}
  return detail || `שגיאה מהשרת (${provider} ${res.status})`;
}

async function callOpenRouter(prompt, key, model, effort) {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "X-Title": "Beteavon",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      // מאמץ חשיבה נבחר (נתמך במודלי reasoning, מתעלמים אחרים)
      reasoning: { effort: effort || DEFAULT_REASONING_EFFORT },
    }),
  });
  if (!res.ok) throw new Error(await errorText(res, "OpenRouter"));

  const data = await res.json();
  const msg = data?.choices?.[0]?.message;
  const text = typeof msg?.content === "string"
    ? msg.content
    : Array.isArray(msg?.content)
      ? msg.content.map((p) => p?.text || "").join("")
      : "";
  if (!text.trim()) throw new Error("המודל לא החזיר תשובה");
  return text.trim();
}

async function callGemini(prompt, key, model) {
  const res = await fetch(geminiUrl(model, key), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 },
    }),
  });
  if (!res.ok) throw new Error(await errorText(res, "Gemini"));

  const data = await res.json();
  const text = (data?.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || "").join("").trim();
  if (!text) throw new Error("המודל לא החזיר תשובה");
  return text;
}

export async function sendToModel(prompt, apiKey, model, effort) {
  const key = (apiKey || "").trim();
  const m = (model || "").trim();
  if (!m) throw new Error("לא נבחר מודל. בחרי מודל בעמוד הפרופיל.");
  if (!key) throw new Error("לא הוגדר מפתח API. הוסיפי אותו בעמוד הפרופיל.");

  const openRouter = isOpenRouterModel(m);

  // בדיקת התאמה בין המפתח למודל — הודעות ברורות במקום שגיאת שרת סתומה
  if (openRouter && isGeminiKey(key)) {
    throw new Error("המודל שנבחר הוא של OpenRouter, אבל המפתח נראה של Gemini. בחרי מודל של Gemini, או הזיני מפתח OpenRouter (sk-or-…).");
  }
  if (!openRouter && isOpenRouterKey(key)) {
    throw new Error("המפתח הוא של OpenRouter, אבל המודל שנבחר הוא של Gemini. בחרי מודל של OpenRouter (למשל DeepSeek V4.1 Flash).");
  }

  return openRouter ? callOpenRouter(prompt, key, m, effort) : callGemini(prompt, key, m);
}
