// ============================================================
//  שליחה ישירה למנוע Gemini מהאפליקציה.
//  הקריאה נעשית ישירות מהדפדפן עם מפתח ה-API של המשתמשת.
//  רשימת המודלים קבועה מראש בקוד (MODEL_OPTIONS) ולא נטענת דינמית.
// ============================================================
export async function sendToModel(prompt, apiKey, model) {
  const m = model && model.trim();
  if (!m) throw new Error("לא נבחר מודל. בחרי מודל בעמוד הפרופיל.");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 },
    }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const e = await res.json();
      detail = e?.error?.message || "";
    } catch {}
    throw new Error(detail || `שגיאה מהשרת (${res.status})`);
  }

  const data = await res.json();
  const text = (data?.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || "").join("").trim();
  if (!text) throw new Error("המודל לא החזיר תשובה");
  return text;
}