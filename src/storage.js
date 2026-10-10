// ============================================================
//  שכבת הנתונים היחידה של המוצר.
//  כל הגישה לשמירה/טעינה עוברת דרך כאן — כדי לעבור בעתיד
//  ל-ASP.NET Core + SQLite צריך להחליף רק את שתי הפונקציות האלה.
// ============================================================
const KEY = "beteavon:data:v1";
const AI_KEY = "beteavon:ai:v1";
const THEME_KEY = "beteavon:theme:v1";
export const THEME_MODES = ["system", "light", "dark"];

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

export function loadTheme() {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    return THEME_MODES.includes(raw) ? raw : "system";
  } catch {
    return "system";
  }
}

export function saveTheme(mode) {
  try {
    localStorage.setItem(THEME_KEY, THEME_MODES.includes(mode) ? mode : "system");
  } catch {}
}
