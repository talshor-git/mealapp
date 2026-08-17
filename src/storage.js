// ============================================================
//  שכבת הנתונים היחידה של המוצר.
//  כל הגישה לשמירה/טעינה עוברת דרך כאן — כדי לעבור בעתיד
//  ל-ASP.NET Core + SQLite צריך להחליף רק את שתי הפונקציות האלה.
// ============================================================
const KEY = "beteavon:data:v1";
const AI_KEY = "beteavon:ai:v1";

export function loadData() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveData(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {}
}

export function loadAIConfig() {
  try {
    const raw = localStorage.getItem(AI_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveAIConfig(cfg) {
  try {
    localStorage.setItem(AI_KEY, JSON.stringify(cfg));
  } catch {}
}
