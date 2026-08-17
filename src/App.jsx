import { useState, useEffect, useRef, useMemo } from "react";
import {
  Plus, X, ChevronRight, ChevronLeft, Sunrise, Sun, Moon, Cookie,
  BookOpen, CalendarDays, LayoutGrid, User, Sparkles, Copy, Check,
  Star, Trash2, Download, Upload, ArrowRight, ArrowLeft, Pencil, Save,
  ListChecks, Text, Send, Loader2,
} from "lucide-react";
import { loadData, saveData, loadAIConfig, saveAIConfig } from "./storage.js";
import { sendToModel } from "./ai.js";

/* ============================================================
   בְּתֵאָבוֹן — יומן ארוחות בעברית
   מיושם לפי מסמך האפיון + מערכת העיצוב (קורל→ורוד→סגול)
   ============================================================ */

// ---- Design tokens (from the design system) ----
const T = {
  coral: "#FF7E5F", rose: "#FF4E7E", violet: "#8B44E8",
  gradPrimary: "linear-gradient(135deg,#FF7E5F 0%,#FF4E7E 48%,#8B44E8 100%)",
  gradWarm: "linear-gradient(135deg,#FF9A5A,#FF5E7E)",
  protein: "#0E9E76", carbs: "#F59700", fat: "#D6337E",
  proteinL: "#E6F6EF", carbsL: "#FCF0DA", fatL: "#FBE4EF",
  ink: "#1C1826", text2: "#4A4458", text3: "#9A93A8",
  border: "#EEECF3", surface: "#FFFFFF", page: "#F7F7FB",
  shCard: "0 6px 16px rgba(20,16,31,.05)",
  shRaised: "0 8px 20px rgba(20,16,31,.06)",
  shGlow: "0 14px 34px rgba(255,78,126,.34)",
  shFab: "0 10px 22px rgba(255,78,126,.42)",
};

const MEAL_TYPES = {
  breakfast: { label: "ארוחת בוקר", icon: Sunrise, emoji: "🍳" },
  lunch: { label: "ארוחת צהריים", icon: Sun, emoji: "🥗" },
  dinner: { label: "ארוחת ערב", icon: Moon, emoji: "🍽️" },
  snack: { label: "נשנוש", icon: Cookie, emoji: "🍪" },
};
const TYPE_ORDER = ["breakfast", "lunch", "dinner", "snack"];
const MODEL_OPTIONS = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-pro", "gemini-2.5-flash", "gemini-2.5-pro"];
const UNITS = ["גרם", "מ״ל", "יחידה", "כף", "כוס", "פרוסה"];
const HE_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const HE_MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

// ---- date helpers ----
const key = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const parseKey = (k) => { const [y,m,dd]=k.split("-").map(Number); return new Date(y,m-1,dd); };
const addDays = (d,n) => { const x=new Date(d); x.setDate(x.getDate()+n); return x; };
const startOfWeek = (d) => addDays(d, -d.getDay());
const isSameDay = (a,b) => key(a)===key(b);
const uid = () => Math.random().toString(36).slice(2,10);


// ---- nutrition math ----
const macroCals = (n) => (n ? (n.protein||0)*4 + (n.carbs||0)*4 + (n.fat||0)*9 : 0);
const dayTotals = (day) => {
  const meals = day?.meals || [];
  const t = { calories:0, protein:0, fat:0, carbs:0, healthSum:0, healthN:0 };
  meals.forEach(m => {
    const n = m.nutrition || {};
    t.calories += n.calories||0; t.protein += n.protein||0;
    t.fat += n.fat||0; t.carbs += n.carbs||0;
    if (n.health) { t.healthSum += n.health; t.healthN++; }
  });
  t.health = t.healthN ? t.healthSum/t.healthN : 0;
  return t;
};

// ============================================================
//  THE PLATE — dual ring (outer: calories vs goal, inner: macros)
// ============================================================
function Plate({ totals, goal }) {
  const consumed = Math.round(totals.calories);
  const ratio = goal ? consumed/goal : 0;
  const R_OUT = 82, R_IN = 60, C_OUT = 2*Math.PI*R_OUT, C_IN = 2*Math.PI*R_IN;
  const outFill = Math.min(ratio,1) * C_OUT;

  const pC = totals.protein*4, cC = totals.carbs*4, fC = totals.fat*9;
  const mTotal = pC+cC+fC;
  const segs = mTotal>0 ? [
    { color:T.protein, len:(pC/mTotal)*C_IN },
    { color:T.carbs,   len:(cC/mTotal)*C_IN },
    { color:T.fat,     len:(fC/mTotal)*C_IN },
  ] : [];
  let acc = 0;

  return (
    <div style={{ position:"relative", width:200, height:200 }}>
      <svg viewBox="0 0 200 200" width="200" height="200" style={{ transform:"rotate(-90deg)" }}>
        <defs>
          <linearGradient id="plateGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={T.coral}/><stop offset="100%" stopColor={T.violet}/>
          </linearGradient>
        </defs>
        {/* outer track + progress */}
        <circle cx="100" cy="100" r={R_OUT} fill="none" stroke={T.border} strokeWidth="14"/>
        <circle cx="100" cy="100" r={R_OUT} fill="none" stroke="url(#plateGrad)" strokeWidth="14"
          strokeLinecap="round" strokeDasharray={`${outFill} ${C_OUT-outFill}`}/>
        {/* inner track */}
        <circle cx="100" cy="100" r={R_IN} fill="none" stroke="#F3F1F7" strokeWidth="12"/>
        {/* inner macro arcs */}
        {segs.map((s,i)=>{
          const el = (
            <circle key={i} cx="100" cy="100" r={R_IN} fill="none" stroke={s.color} strokeWidth="12"
              strokeLinecap="butt"
              strokeDasharray={`${Math.max(s.len-1.5,0)} ${C_IN-Math.max(s.len-1.5,0)}`}
              strokeDashoffset={-acc}/>
          );
          acc += s.len; return el;
        })}
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
        <span style={{ fontSize:34, fontWeight:700, color:T.ink, lineHeight:1 }}>{consumed}</span>
        <span style={{ fontSize:12, color:T.text3, marginTop:2 }}>מתוך {goal} קק״ל</span>
      </div>
    </div>
  );
}

function Stars({ value, size=18, onChange }) {
  const full = Math.round(value||0);
  return (
    <div style={{ display:"flex", gap:3, direction:"ltr" }}>
      {[1,2,3,4,5].map(i=>(
        <Star key={i} size={size}
          onClick={onChange ? ()=>onChange(i) : undefined}
          style={{ cursor:onChange?"pointer":"default", color:i<=full?"#F5B301":"#E4E0EA", fill:i<=full?"#F5B301":"none" }}/>
      ))}
    </div>
  );
}

function MacroGoalInput({ color, label, value, onChange }) {
  return (
    <div>
      <label style={{ ...lbl, fontSize:12, color, marginBottom:5 }}>{label}</label>
      <input style={{ ...input, textAlign:"center", padding:"10px 6px" }} inputMode="numeric"
        value={value} onChange={e=>onChange(parseInt(e.target.value)||0)}/>
    </div>
  );
}

function MacroLegend({ totals, user }) {
  const items = [
    { label:"חלבון", color:T.protein, val:totals.protein, goal:user.goalProtein },
    { label:"פחמימות", color:T.carbs, val:totals.carbs, goal:user.goalCarbs },
    { label:"שומן", color:T.fat, val:totals.fat, goal:user.goalFat },
  ];
  return (
    <div style={{ display:"flex", gap:8, width:"100%" }}>
      {items.map(it=>(
        <div key={it.label} style={{ flex:1, background:"#fff", borderRadius:14, padding:"10px 8px",
          boxShadow:T.shCard, textAlign:"center" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:5, marginBottom:4 }}>
            <span style={{ width:8, height:8, borderRadius:"50%", background:it.color }}/>
            <span style={{ fontSize:12, fontWeight:500, color:it.color }}>{it.label}</span>
          </div>
          <p style={{ margin:0, fontSize:14, fontWeight:500, color:T.ink }}>
            {Math.round(it.val)}<span style={{ fontSize:11, color:T.text3 }}> / {it.goal||0} ג׳</span>
          </p>
        </div>
      ))}
    </div>
  );
}

// ============================================================
//  COMPANION — chef with a mood-based message
// ============================================================
function Companion({ character, ratio, name }) {
  const emoji = character === "chef_f" ? "👩‍🍳" : "👨‍🍳";
  let mood = "😊", msg = `יום נהדר להתחיל בו, ${name}!`;
  if (ratio === 0) { mood="🙂"; msg="הצלחת עוד ריקה — מה נאכל היום?"; }
  else if (ratio < 0.5) { mood="🙂"; msg="יש עוד הרבה מקום בצלחת. קדימה!"; }
  else if (ratio < 0.85) { mood="😊"; msg="אתה בכיוון מצוין, ממשיכים ככה."; }
  else if (ratio <= 1.05) { mood="😄"; msg="כמעט ביעד — יופי של יום!"; }
  else { mood="😅"; msg="עברנו קצת את היעד. מחר יום חדש 💛"; }
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
      <div style={{ width:52, height:52, borderRadius:"50%", background:T.gradWarm,
        display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, flexShrink:0,
        boxShadow:"0 6px 14px rgba(255,94,126,.3)" }}>{emoji}</div>
      <div style={{ background:"#fff", border:`1px solid ${T.border}`, borderRadius:16,
        borderTopRightRadius:4, padding:"10px 14px", boxShadow:T.shCard, flex:1 }}>
        <span style={{ fontSize:14, color:T.text2 }}>{mood} {msg}</span>
      </div>
    </div>
  );
}

// ============================================================
//  MEAL CARD
// ============================================================
function MealCard({ meal, onDelete, onEdit, onClick }) {
  const type = MEAL_TYPES[meal.type] || MEAL_TYPES.snack;
  const n = meal.nutrition || {};
  return (
    <div onClick={onClick} style={{ background:"#fff", borderRadius:20, padding:14, boxShadow:T.shRaised,
      display:"flex", alignItems:"center", gap:13, marginBottom:11, cursor:onClick?"pointer":"default" }}>
      <div style={{ width:46, height:46, borderRadius:15, background:T.gradWarm, display:"flex",
        alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0,
        boxShadow:"0 6px 14px rgba(255,94,126,.32)" }}>{meal.emoji || type.emoji}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <p style={{ margin:0, fontSize:15, fontWeight:500, color:T.ink }}>{meal.name}</p>
          {n.health ? <Stars value={n.health} size={12}/> : null}
        </div>
        <p style={{ margin:"3px 0 0", fontSize:12, color:T.text3, whiteSpace:"nowrap",
          overflow:"hidden", textOverflow:"ellipsis" }}>
          חלבון {Math.round(n.protein||0)}ג׳ · פחמימות {Math.round(n.carbs||0)}ג׳ · שומן {Math.round(n.fat||0)}ג׳
        </p>
      </div>
      <div style={{ textAlign:"left" }}>
        <p style={{ margin:0, fontSize:16, fontWeight:500, color:T.ink }}>{Math.round(n.calories||0)}</p>
        <p style={{ margin:"1px 0 0", fontSize:10, color:T.text3 }}>קק״ל</p>
      </div>
      {(onEdit || onDelete) && (
        <div style={{ display:"flex", gap:2 }}>
          {onEdit && (
            <button onClick={(e)=>{ e.stopPropagation(); onEdit(); }} aria-label="עריכה" style={iconBtn}>
              <Pencil size={16} color={T.text3}/>
            </button>
          )}
          {onDelete && (
            <button onClick={(e)=>{ e.stopPropagation(); onDelete(); }} aria-label="מחיקה" style={iconBtn}>
              <Trash2 size={16} color={T.text3}/>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const iconBtn = { background:"transparent", border:"none", cursor:"pointer", padding:6, borderRadius:10, display:"flex" };

// ============================================================
//  MEAL DETAILS MODAL — view what was entered
// ============================================================
function MealDetailsModal({ meal, onClose, onEdit }) {
  const type = MEAL_TYPES[meal.type] || MEAL_TYPES.snack;
  const n = meal.nutrition || {};
  const ings = meal.ingredients || [];
  return (
    <div style={overlay} onClick={onClose}>
      <div style={sheet} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
          <h3 style={{ margin:0, fontSize:19, fontWeight:700, color:T.ink }}>פרטי הארוחה</h3>
          <button onClick={onClose} aria-label="סגירה" style={iconBtn}><X size={22} color={T.text2}/></button>
        </div>

        <div style={{ overflowY:"auto", paddingLeft:2, marginTop:14 }}>
          <div style={{ background:T.gradPrimary, borderRadius:22, padding:18, color:"#fff",
            boxShadow:T.shGlow, marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:30 }}>{meal.emoji || type.emoji}</span>
              <div>
                <p style={{ margin:0, fontSize:17, fontWeight:500 }}>{meal.name}</p>
                <p style={{ margin:"2px 0 0", fontSize:12, opacity:.9 }}>{type.label}</p>
              </div>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:16, textAlign:"center" }}>
              {[["calories","קק״ל"],["protein","חלבון"],["carbs","פחמ׳"],["fat","שומן"]].map(([k,l])=>(
                <div key={k}>
                  <p style={{ margin:0, fontSize:20, fontWeight:700 }}>{Math.round(n[k]||0)}</p>
                  <p style={{ margin:"2px 0 0", fontSize:11, opacity:.9 }}>{l}</p>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", justifyContent:"center", marginTop:14 }}>
              <Stars value={n.health}/>
            </div>
          </div>

          {(ings.length>0 || (meal.freeText||"").trim()) && (
            <div style={{ ...card2, marginBottom:16 }}>
              <p style={{ margin:"0 0 6px", fontSize:15, fontWeight:500, color:T.ink }}>רכיבים</p>
              {ings.map((ing,i)=>(
                <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0",
                  borderBottom: i<ings.length-1 ? `1px solid ${T.border}` : "none" }}>
                  <span style={{ fontSize:14, color:T.ink, flex:1, textAlign:"right" }}>{ing.name}</span>
                  <span style={{ fontSize:13, color:T.text3 }}>{[ing.qty, ing.unit].filter(Boolean).join(" ")}</span>
                </div>
              ))}
              {(meal.freeText||"").trim() && ings.length===0 && (
                <p style={{ margin:0, fontSize:14, color:T.ink, lineHeight:1.6 }}>{meal.freeText}</p>
              )}
            </div>
          )}

          <button onClick={onEdit} style={{ ...primaryBtn, width:"100%" }}>
            <Pencil size={16}/> עריכת ארוחה
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
//  ADD-MEAL MODAL (3-step wizard)
// ============================================================
const emptyMeal = (type="breakfast") => ({ id:uid(), name:"", type, emoji:"", ingredients:[{ name:"", qty:"", unit:"גרם" }], freeText:"", nutrition:null, source:null });

function buildPrompt(meal) {
  const list = (meal.freeText||"").trim()
    ? meal.freeText.trim()
    : meal.ingredients.filter(i=>i.name.trim())
        .map(i=>`${i.qty||""} ${i.unit} ${i.name}`.trim()).join(", ");
  return `אתה מחשבון תזונה מדויק. עבור הארוחה הבאה החזר אך ורק אובייקט JSON תקין, ללא טקסט נוסף, במבנה:
{"calories": מספר, "protein": מספר, "fat": מספר, "carbs": מספר, "health": מספר בין 1 ל-5}
כאשר health הוא דירוג בריאותיות כללי (1=לא בריא, 5=בריא מאוד).
שם הארוחה: ${meal.name}
רכיבים: ${list}`;
}

function parseNutrition(text) {
  const clean = text.replace(/```json|```/g,"").trim();
  try {
    const o = JSON.parse(clean);
    return normalize(o);
  } catch {
    const num = (re)=>{ const m=clean.match(re); return m?parseFloat(m[1]):0; };
    return normalize({
      calories:num(/calories["':\s]+(\d+\.?\d*)/i) || num(/קלוריות[:\s]+(\d+)/),
      protein:num(/protein["':\s]+(\d+\.?\d*)/i) || num(/חלבון[:\s]+(\d+)/),
      fat:num(/fat["':\s]+(\d+\.?\d*)/i) || num(/שומן[:\s]+(\d+)/),
      carbs:num(/carbs["':\s]+(\d+\.?\d*)/i) || num(/פחמימ[^:]*[:\s]+(\d+)/),
      health:num(/health["':\s]+(\d+\.?\d*)/i) || 3,
    });
  }
}
const normalize = (o)=>({
  calories:Math.round(+o.calories||0), protein:Math.round(+o.protein||0),
  fat:Math.round(+o.fat||0), carbs:Math.round(+o.carbs||0),
  health:Math.min(5,Math.max(1,Math.round(+o.health||3))),
});

function AddMealModal({ onClose, onAddToDay, onSaveMeal, savedMeals, initialMeal, initialType, onUpdate, aiConfig }) {
  const isEdit = !!initialMeal;
  const [step, setStep] = useState(1);
  const [meal, setMeal] = useState(
    initialMeal
      ? { ...initialMeal, ingredients: initialMeal.ingredients?.length ? initialMeal.ingredients : [{ name:"", qty:"", unit:"גרם" }] }
      : emptyMeal(initialType)
  );
  const [source, setSource] = useState(null);         // 'ai' | 'manual'
  const [ingredientsDirty, setDirty] = useState(false);
  const [pastedAnswer, setPasted] = useState("");
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState({ calories:"", protein:"", fat:"", carbs:"", health:3 });
  const [savedReminder, setSavedReminder] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [ingMode, setIngMode] = useState(
    initialMeal && (initialMeal.freeText||"").trim() && !(initialMeal.ingredients||[]).some(i=>i.name.trim())
      ? "text" : "list"
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const setField = (k,v)=> setMeal(m=>({ ...m, [k]:v }));
  const setIng = (i,k,v)=> setMeal(m=>{ const ing=[...m.ingredients]; ing[i]={...ing[i],[k]:v}; return {...m,ingredients:ing}; });
  const addIng = ()=> setMeal(m=>({ ...m, ingredients:[...m.ingredients,{name:"",qty:"",unit:"גרם"}] }));
  const rmIng = (i)=> setMeal(m=>({ ...m, ingredients:m.ingredients.filter((_,x)=>x!==i) }));

  const validStep1 = meal.name.trim() && (
    ingMode==="text" ? (meal.freeText||"").trim() : meal.ingredients.some(i=>i.name.trim())
  );

  // business rule: editing ingredients invalidates derived values
  const onIngredientChange = (i,k,v)=>{ setIng(i,k,v); if (meal.nutrition){ setDirty(true); } };
  const onFreeTextChange = (e)=>{ setField("freeText", e.target.value); if (meal.nutrition){ setDirty(true); } };

  // switching modes clears the other mode so the prompt never mixes the two
  const switchIngMode = (mode)=>{
    if (mode===ingMode) return;
    setIngMode(mode);
    if (mode==="text") setMeal(m=>({ ...m, ingredients:[{ name:"", qty:"", unit:"גרם" }] }));
    else setMeal(m=>({ ...m, freeText:"" }));
    if (meal.nutrition) setDirty(true);
  };

  const goCheckValues = ()=>{
    if (meal.source && ingredientsDirty) {
      if (meal.source === "manual") { setSavedReminder(true); setStep(3); return; }
      setMeal(m=>({ ...m, nutrition:null, source:null })); setDirty(false);
    }
    if (meal.nutrition && !ingredientsDirty) { setStep(3); return; }
    setStep(2);
  };

  const processPasted = ()=>{
    if (!pastedAnswer.trim()) return;
    const n = parseNutrition(pastedAnswer);
    setMeal(m=>({ ...m, nutrition:n, source:"ai" })); setDirty(false); setStep(3);
  };

  const sendAI = async ()=>{
    if (!aiConfig?.apiKey) {
      setAiError("לא הוגדר מפתח API — הוסיפי אותו בעמוד הפרופיל.");
      return;
    }
    setAiLoading(true); setAiError("");
    try {
      const text = await sendToModel(buildPrompt(meal), aiConfig.apiKey, aiConfig.model);
      const n = parseNutrition(text);
      setMeal(m=>({ ...m, nutrition:n, source:"ai" })); setDirty(false); setStep(3);
    } catch (err) {
      setAiError(err?.message || "השליחה למודל נכשלה, נסי שוב.");
    } finally {
      setAiLoading(false);
    }
  };

  const submitManual = ()=>{
    const n = normalize(manual);
    setMeal(m=>({ ...m, nutrition:n, source:"manual" })); setDirty(false); setStep(3);
  };

  const loadSaved = (sm)=>{
    setMeal({ ...sm, id:uid(), ingredients: sm.ingredients?.length?sm.ingredients:[{name:"",qty:"",unit:"גרם"}] });
    setIngMode((sm.freeText||"").trim() ? "text" : "list");
    setSource(sm.source); setShowLibrary(false); setDirty(false); setStep(3);
  };

  const copyPrompt = async ()=>{
    const text = buildPrompt(meal);
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch {}
    if (!ok) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed"; ta.style.top = "0"; ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus(); ta.select(); ta.setSelectionRange(0, text.length);
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {}
    }
    setCopied(true); setTimeout(()=>setCopied(false),1600);
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={sheet} onClick={e=>e.stopPropagation()}>
        {/* header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {step>1 && (
              <button onClick={()=>setStep(step-1)} aria-label="חזרה" style={iconBtn}>
                <ArrowRight size={20} color={T.text2}/>
              </button>
            )}
            <h3 style={{ margin:0, fontSize:19, fontWeight:700, color:T.ink }}>
              {step===1?(isEdit?"עריכת ארוחה":"הוספת ארוחה"):step===2?"בחירת מקור הערכים":"אישור והוספה"}
            </h3>
          </div>
          <button onClick={onClose} aria-label="סגירה" style={iconBtn}><X size={22} color={T.text2}/></button>
        </div>
        <StepDots step={step}/>

        <div style={{ overflowY:"auto", paddingLeft:2, marginTop:14 }}>
        {/* ---------- STEP 1 ---------- */}
        {step===1 && (
          <div>
            {savedMeals.length>0 && (
              <button onClick={()=>setShowLibrary(v=>!v)} style={{ ...pill, width:"100%", justifyContent:"center", marginBottom:14 }}>
                <BookOpen size={16}/> טעינת ארוחה שמורה
              </button>
            )}
            {showLibrary && (
              <div style={{ background:T.page, borderRadius:14, padding:10, marginBottom:14, maxHeight:170, overflowY:"auto" }}>
                {savedMeals.map(sm=>(
                  <button key={sm.id} onClick={()=>loadSaved(sm)} style={savedRow}>
                    <span style={{ fontSize:20 }}>{sm.emoji||"🍽️"}</span>
                    <span style={{ flex:1, textAlign:"right", fontSize:14, color:T.ink }}>{sm.name}</span>
                    <span style={{ fontSize:12, color:T.text3 }}>{Math.round(sm.nutrition?.calories||0)} קק״ל</span>
                  </button>
                ))}
              </div>
            )}

            <label style={lbl}>שם הארוחה</label>
            <input style={input} value={meal.name} onChange={e=>setField("name",e.target.value)} placeholder="לדוגמה: אומלט ירקות"/>

            <label style={{ ...lbl, marginTop:16 }}>סוג הארוחה</label>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
              {TYPE_ORDER.map(t=>{
                const Ic = MEAL_TYPES[t].icon, active = meal.type===t;
                return (
                  <button key={t} onClick={()=>setField("type",t)} style={{
                    ...typeBtn, ...(active?{ background:T.gradPrimary, color:"#fff", borderColor:"transparent", boxShadow:T.shGlow }:{}) }}>
                    <Ic size={18}/><span style={{ fontSize:11 }}>{MEAL_TYPES[t].label.replace("ארוחת ","")}</span>
                  </button>
                );
              })}
            </div>

            <label style={{ ...lbl, marginTop:16 }}>רכיבים</label>
            <div style={{ display:"flex", gap:8, marginBottom:12 }}>
              <button onClick={()=>switchIngMode("list")} style={{ ...segBtn, ...(ingMode==="list"?segActive:{}) }}>
                <ListChecks size={15}/> רשימת רכיבים
              </button>
              <button onClick={()=>switchIngMode("text")} style={{ ...segBtn, ...(ingMode==="text"?segActive:{}) }}>
                <Text size={15}/> טקסט חופשי
              </button>
            </div>
            {ingMode==="text" ? (
              <textarea value={meal.freeText||""} onChange={onFreeTextChange}
                placeholder="לדוגמה: 2 ביצים, 100 גרם שיבולת שועל, כוס חלב…"
                style={{ ...input, height:96, resize:"none", fontSize:14, lineHeight:1.6 }}/>
            ) : (
              <>
                {meal.ingredients.map((ing,i)=>(
                  <div key={i} style={{ display:"flex", gap:6, marginBottom:8 }}>
                    <input style={{ ...input, flex:2 }} value={ing.name} onChange={e=>onIngredientChange(i,"name",e.target.value)} placeholder="רכיב"/>
                    <input style={{ ...input, width:60 }} value={ing.qty} onChange={e=>onIngredientChange(i,"qty",e.target.value)} placeholder="כמות" inputMode="numeric"/>
                    <select style={{ ...input, width:78, padding:"10px 8px" }} value={ing.unit} onChange={e=>onIngredientChange(i,"unit",e.target.value)}>
                      {UNITS.map(u=><option key={u}>{u}</option>)}
                    </select>
                    {meal.ingredients.length>1 && (
                      <button onClick={()=>rmIng(i)} aria-label="הסרה" style={iconBtn}><X size={16} color={T.text3}/></button>
                    )}
                  </div>
                ))}
                <button onClick={addIng} style={{ ...ghostBtn, width:"100%", marginTop:4 }}>
                  <Plus size={16}/> רכיב נוסף
                </button>
              </>
            )}

            <button disabled={!validStep1} onClick={goCheckValues}
              style={{ ...primaryBtn, width:"100%", marginTop:20, opacity:validStep1?1:.45, cursor:validStep1?"pointer":"not-allowed" }}>
              <Sparkles size={18}/> בדיקת ערכים
            </button>
          </div>
        )}

        {/* ---------- STEP 2 ---------- */}
        {step===2 && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {/* AI path — copy prompt → external engine → paste answer back */}
            <div style={card2}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                <div style={miniBadge(T.gradPrimary)}><Sparkles size={16} color="#fff"/></div>
                <span style={{ fontSize:15, fontWeight:500, color:T.ink }}>חישוב לפי הרכיבים</span>
              </div>
              <p style={{ margin:"0 0 14px", fontSize:13, color:T.text2 }}>
                השליכי ישירות למודל, או העתיקי את הבקשה והדביקי כאן את התשובה.
              </p>

              <button onClick={sendAI} disabled={aiLoading || !aiConfig?.apiKey}
                style={{ ...primaryBtn, width:"100%", opacity:aiLoading||!aiConfig?.apiKey?.trim()?.length ? .5 : 1,
                  cursor:aiLoading ? "wait" : (aiConfig?.apiKey ? "pointer" : "not-allowed") }}>
                {aiLoading ? <Loader2 size={17} className="spin"/> : <Send size={17}/>}
                {aiLoading ? "שולחת למודל…" : "שליחה למודל"}
              </button>
              {!aiConfig?.apiKey && (
                <p style={{ margin:"6px 0 12px", fontSize:12, color:T.text3, textAlign:"center" }}>
                  הוסיפי מפתח API של Gemini בעמוד הפרופיל כדי לשלוח ישירות.
                </p>
              )}
              {aiError && (
                <p style={{ margin:"0 0 12px", fontSize:12, color:T.fat, background:"#FBE4EF",
                  borderRadius:10, padding:"8px 12px", textAlign:"center" }}>{aiError}</p>
              )}

              <div style={{ display:"flex", alignItems:"center", gap:10, margin:"10px 0 12px" }}>
                <div style={{ flex:1, height:1, background:T.border }}/>
                <span style={{ fontSize:12, color:T.text3 }}>או שיטה ידנית</span>
                <div style={{ flex:1, height:1, background:T.border }}/>
              </div>

              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                <span style={stepChip}>1</span>
                <span style={{ fontSize:13, fontWeight:500, color:T.ink }}>העתקת הבקשה</span>
              </div>

              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                <span style={stepChip}>1</span>
                <span style={{ fontSize:13, fontWeight:500, color:T.ink }}>העתקת הבקשה</span>
              </div>
              <div style={{ position:"relative" }}>
                <textarea readOnly value={buildPrompt(meal)}
                  style={{ ...input, height:112, resize:"none", fontSize:12, lineHeight:1.55, background:T.page }}/>
                <button onClick={copyPrompt} style={{ ...pill, position:"absolute", top:8, left:8, padding:"6px 11px", fontSize:12 }}>
                  {copied?<><Check size={13}/> הועתק</>:<><Copy size={13}/> העתקה</>}
                </button>
              </div>

              <div style={{ display:"flex", alignItems:"center", gap:6, margin:"14px 0 6px" }}>
                <span style={stepChip}>2</span>
                <span style={{ fontSize:13, fontWeight:500, color:T.ink }}>הדבקת התשובה</span>
              </div>
              <textarea value={pastedAnswer} onChange={e=>setPasted(e.target.value)}
                placeholder="הדביקי כאן את תשובת המנוע…"
                style={{ ...input, height:80, resize:"none", fontSize:12 }}/>
              <button onClick={processPasted} disabled={!pastedAnswer.trim()}
                style={{ ...primaryBtn, width:"100%", marginTop:10, opacity:pastedAnswer.trim()?1:.45,
                  cursor:pastedAnswer.trim()?"pointer":"not-allowed" }}>
                <Sparkles size={16}/> חילוץ הערכים
              </button>
            </div>

            {/* Manual package path */}
            <div style={card2}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                <div style={miniBadge(T.gradWarm)}><Pencil size={15} color="#fff"/></div>
                <span style={{ fontSize:15, fontWeight:500, color:T.ink }}>כתוב על האריזה</span>
              </div>
              <p style={{ margin:"0 0 12px", fontSize:13, color:T.text2 }}>הזנה ידנית של הערכים המודפסים על המוצר.</p>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {[["calories","קלוריות"],["protein","חלבון (ג׳)"],["carbs","פחמימות (ג׳)"],["fat","שומן (ג׳)"]].map(([k,l])=>(
                  <div key={k}>
                    <label style={{ ...lbl, fontSize:12 }}>{l}</label>
                    <input style={input} inputMode="numeric" value={manual[k]}
                      onChange={e=>setManual(s=>({ ...s, [k]:e.target.value }))}/>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:12 }}>
                <label style={{ ...lbl, fontSize:12 }}>דירוג בריאות</label>
                <Stars value={manual.health} onChange={v=>setManual(s=>({ ...s, health:v }))}/>
              </div>
              <button onClick={submitManual} style={{ ...softBtn, width:"100%", marginTop:14 }}>המשך</button>
            </div>
          </div>
        )}

        {/* ---------- STEP 3 ---------- */}
        {step===3 && meal.nutrition && (
          <div>
            {savedReminder && (
              <div style={{ background:"#FFF9F2", borderRight:`4px solid ${T.carbs}`, borderRadius:"0 12px 12px 0",
                padding:"10px 14px", fontSize:13, color:T.text2, marginBottom:14 }}>
                שינית רכיבים — כדאי לוודא שהערכים מהאריזה עדיין מתאימים.
              </div>
            )}
            <div style={{ background:T.gradPrimary, borderRadius:22, padding:18, color:"#fff",
              boxShadow:T.shGlow, marginBottom:16 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:30 }}>{meal.emoji || MEAL_TYPES[meal.type].emoji}</span>
                <div><p style={{ margin:0, fontSize:17, fontWeight:500 }}>{meal.name}</p>
                <p style={{ margin:"2px 0 0", fontSize:12, opacity:.9 }}>{MEAL_TYPES[meal.type].label}</p></div>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:16, textAlign:"center" }}>
                {[["calories","קק״ל"],["protein","חלבון"],["carbs","פחמ׳"],["fat","שומן"]].map(([k,l])=>(
                  <div key={k}>
                    <p style={{ margin:0, fontSize:20, fontWeight:700 }}>{Math.round(meal.nutrition[k])}</p>
                    <p style={{ margin:"2px 0 0", fontSize:11, opacity:.9 }}>{l}</p>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", justifyContent:"center", marginTop:14 }}>
                <Stars value={meal.nutrition.health}/>
              </div>
            </div>

            {/* emoji for saving */}
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
              <label style={{ ...lbl, margin:0 }}>אמוג׳י לספרייה</label>
              <input value={meal.emoji} onChange={e=>setField("emoji",e.target.value)}
                placeholder={MEAL_TYPES[meal.type].emoji} maxLength={2}
                style={{ ...input, width:58, textAlign:"center", fontSize:20 }}/>
            </div>

            {isEdit ? (
              <button onClick={()=>onUpdate(meal)} style={{ ...primaryBtn, width:"100%" }}>
                <Save size={16}/> שמירת שינויים
              </button>
            ) : (
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={()=>onSaveMeal(meal)} style={{ ...softBtn, flex:1 }}>
                  <Save size={16}/> שמירת ארוחה
                </button>
                <button onClick={()=>onAddToDay(meal)} style={{ ...primaryBtn, flex:1 }}>
                  <Plus size={16}/> הוספה ליומן
                </button>
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

function StepDots({ step }) {
  return (
    <div style={{ display:"flex", gap:6, marginTop:2 }}>
      {[1,2,3].map(s=>(
        <div key={s} style={{ height:4, flex:1, borderRadius:4,
          background: s<=step ? T.gradPrimary : T.border }}/>
      ))}
    </div>
  );
}

// ============================================================
//  DAILY VIEW
// ============================================================
function DailyView({ date, setDate, day, user, onAdd, onDeleteMeal, onViewMeal, onEditMeal }) {
  const totals = dayTotals(day);
  const ratio = user.goal ? totals.calories/user.goal : 0;
  const meals = day?.meals || [];
  const today = isSameDay(date, new Date());

  return (
    <div style={{ padding:"0 18px 120px" }}>
      {/* date nav */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 4px 10px" }}>
        <button onClick={()=>setDate(addDays(date,1))} style={iconBtn}><ChevronRight size={22} color={T.text2}/></button>
        <div style={{ textAlign:"center" }}>
          <p style={{ margin:0, fontSize:17, fontWeight:500, color:T.ink }}>
            {today ? "היום" : `יום ${HE_DAYS[date.getDay()]}`}
          </p>
          <p style={{ margin:"2px 0 0", fontSize:12, color:T.text3 }}>{date.getDate()} ב{HE_MONTHS[date.getMonth()]}</p>
        </div>
        <button onClick={()=>setDate(addDays(date,-1))} disabled={today}
          style={{ ...iconBtn, opacity:today?.3:1 }}><ChevronLeft size={22} color={T.text2}/></button>
      </div>

      {/* the plate */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12, padding:"12px 0 18px" }}>
        <Plate totals={totals} goal={user.goal}/>
        <Stars value={totals.health}/>
        <MacroLegend totals={totals} user={user}/>
      </div>

      {/* companion */}
      <div style={{ marginBottom:18 }}>
        <Companion character={user.character} ratio={ratio} name={user.name}/>
      </div>

      {/* meals by type */}
      {TYPE_ORDER.map(t=>{
        const list = meals.filter(m=>m.type===t);
        const Ic = MEAL_TYPES[t].icon;
        const sub = list.reduce((s,m)=>s+(m.nutrition?.calories||0),0);
        return (
          <div key={t} style={{ marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
              <span style={{ display:"flex", alignItems:"center", gap:7, fontSize:15, fontWeight:500, color:T.ink }}>
                <Ic size={17} color={T.coral}/> {MEAL_TYPES[t].label}
              </span>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                {list.length>0 && <span style={{ fontSize:13, color:T.text3 }}>{Math.round(sub)} קק״ל</span>}
                <button onClick={()=>onAdd(t)} aria-label={`הוספת ${MEAL_TYPES[t].label}`}
                  style={{ ...iconBtn, background:"#FFF1F5" }}>
                  <Plus size={16} color={T.rose}/>
                </button>
              </div>
            </div>
            {list.map(m=><MealCard key={m.id} meal={m} onClick={()=>onViewMeal(m)}
              onEdit={()=>onEditMeal(m)} onDelete={()=>onDeleteMeal(m.id)}/>)}
            {list.length===0 && (
              <button onClick={()=>onAdd(t)} style={emptyState}>
                <Plus size={16}/> הוספת {MEAL_TYPES[t].label}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
//  CALENDAR VIEW (week / month)
// ============================================================
function CalendarView({ days, user, onPick }) {
  const [mode, setMode] = useState("week");
  const [anchor, setAnchor] = useState(new Date());

  return (
    <div style={{ padding:"14px 18px 120px" }}>
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        {[["week","שבועי"],["month","חודשי"]].map(([m,l])=>(
          <button key={m} onClick={()=>setMode(m)} style={{ ...segBtn, ...(mode===m?segActive:{}) }}>{l}</button>
        ))}
      </div>
      {mode==="week"
        ? <WeekGrid anchor={anchor} setAnchor={setAnchor} days={days} user={user} onPick={onPick}/>
        : <MonthGrid anchor={anchor} setAnchor={setAnchor} days={days} user={user} onPick={onPick}/>}
    </div>
  );
}

function WeekGrid({ anchor, setAnchor, days, user, onPick }) {
  const start = startOfWeek(anchor);
  const week = Array.from({length:7},(_,i)=>addDays(start,i));
  return (
    <div>
      <NavRow onPrev={()=>setAnchor(addDays(anchor,7))} onNext={()=>setAnchor(addDays(anchor,-7))}
        label={`${start.getDate()}–${addDays(start,6).getDate()} ב${HE_MONTHS[start.getMonth()]}`}/>
      <div style={{ display:"flex", flexDirection:"column", gap:10, marginTop:14 }}>
        {week.map(d=>{
          const day = days[key(d)]; const t = dayTotals(day);
          const pct = user.goal ? Math.min(t.calories/user.goal,1) : 0;
          const emojis = (day?.meals||[]).slice(0,5).map(m=>m.emoji||MEAL_TYPES[m.type].emoji).join(" ");
          return (
            <button key={key(d)} onClick={()=>onPick(d)} style={weekRow}>
              <div style={{ width:44, textAlign:"center" }}>
                <p style={{ margin:0, fontSize:12, color:T.text3 }}>{HE_DAYS[d.getDay()]}</p>
                <p style={{ margin:"2px 0 0", fontSize:18, fontWeight:500, color:T.ink }}>{d.getDate()}</p>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:16, minHeight:20 }}>{emojis || <span style={{ color:T.text3, fontSize:13 }}>—</span>}</div>
                <div style={{ height:6, background:T.border, borderRadius:4, marginTop:6, overflow:"hidden" }}>
                  <div style={{ width:`${pct*100}%`, height:6, background:T.gradPrimary }}/>
                </div>
              </div>
              <div style={{ textAlign:"left", width:70 }}>
                <p style={{ margin:0, fontSize:14, fontWeight:500, color:T.ink }}>{Math.round(t.calories)}</p>
                <p style={{ margin:0, fontSize:10, color:T.text3 }}>/ {user.goal}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MonthGrid({ anchor, setAnchor, days, user, onPick }) {
  const y=anchor.getFullYear(), mo=anchor.getMonth();
  const first=new Date(y,mo,1), startPad=first.getDay();
  const total=new Date(y,mo+1,0).getDate();
  const cells=[...Array(startPad).fill(null), ...Array.from({length:total},(_,i)=>new Date(y,mo,i+1))];
  return (
    <div>
      <NavRow onPrev={()=>setAnchor(new Date(y,mo+1,1))} onNext={()=>setAnchor(new Date(y,mo-1,1))}
        label={`${HE_MONTHS[mo]} ${y}`}/>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4, marginTop:14 }}>
        {HE_DAYS.map(d=><div key={d} style={{ textAlign:"center", fontSize:11, color:T.text3, paddingBottom:4 }}>{d[0]}</div>)}
        {cells.map((d,i)=>{
          if(!d) return <div key={i}/>;
          const day=days[key(d)]; const t=dayTotals(day);
          const pct=user.goal?Math.min(t.calories/user.goal,1):0;
          const has=(day?.meals||[]).length>0;
          const isToday=isSameDay(d,new Date());
          return (
            <button key={key(d)} onClick={()=>onPick(d)} style={{ ...monthCell, ...(isToday?{ border:`1.5px solid ${T.rose}` }:{}) }}>
              <span style={{ fontSize:12, color:T.ink, fontWeight:isToday?700:400 }}>{d.getDate()}</span>
              {has ? (
                <div style={{ width:22, height:22, borderRadius:"50%", marginTop:3,
                  background:`conic-gradient(${T.rose} ${pct*360}deg, ${T.border} 0deg)`,
                  display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <div style={{ width:14, height:14, borderRadius:"50%", background:"#fff",
                    fontSize:8, display:"flex", alignItems:"center", justifyContent:"center", color:T.text3 }}>
                    {(day.meals||[]).length}
                  </div>
                </div>
              ) : <div style={{ height:22, marginTop:3 }}/>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NavRow({ onPrev, onNext, label }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
      <button onClick={onPrev} style={iconBtn}><ChevronRight size={20} color={T.text2}/></button>
      <span style={{ fontSize:15, fontWeight:500, color:T.ink }}>{label}</span>
      <button onClick={onNext} style={iconBtn}><ChevronLeft size={20} color={T.text2}/></button>
    </div>
  );
}

// ============================================================
//  LIBRARY VIEW
// ============================================================
function LibraryView({ savedMeals, onQuickAdd, onDelete }) {
  return (
    <div style={{ padding:"14px 18px 120px" }}>
      <h2 style={{ fontSize:22, fontWeight:700, color:T.ink, margin:"6px 0 4px" }}>ספריית ארוחות</h2>
      <p style={{ fontSize:14, color:T.text2, margin:"0 0 18px" }}>ארוחות חוזרות — הוספה ליום בלחיצה אחת, בלי חישוב מחדש.</p>
      {savedMeals.length===0 && (
        <div style={{ ...emptyState, cursor:"default", flexDirection:"column", gap:6, padding:"28px 16px" }}>
          <BookOpen size={26}/><span>אין עדיין ארוחות שמורות. שמרי ארוחה מזרימת ההוספה.</span>
        </div>
      )}
      {savedMeals.map(sm=>(
        <div key={sm.id} style={{ background:"#fff", borderRadius:18, padding:14, boxShadow:T.shCard,
          display:"flex", alignItems:"center", gap:13, marginBottom:11 }}>
          <div style={{ width:44, height:44, borderRadius:14, background:T.proteinL, display:"flex",
            alignItems:"center", justifyContent:"center", fontSize:22 }}>{sm.emoji||"🍽️"}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ margin:0, fontSize:15, fontWeight:500, color:T.ink }}>{sm.name}</p>
            <p style={{ margin:"3px 0 0", fontSize:12, color:T.text3 }}>
              {Math.round(sm.nutrition?.calories||0)} קק״ל · {MEAL_TYPES[sm.type]?.label}
            </p>
          </div>
          <button onClick={()=>onQuickAdd(sm)} style={{ ...pill, padding:"7px 12px" }}><Plus size={14}/> הוספה</button>
          <button onClick={()=>onDelete(sm.id)} aria-label="מחיקה" style={iconBtn}><Trash2 size={16} color={T.text3}/></button>
        </div>
      ))}
    </div>
  );
}

// ============================================================
//  PROFILE VIEW
// ============================================================
function ProfileView({ user, setUser, onExport, onImport, onReset, aiConfig, onSaveAIConfig }) {
  const fileRef = useRef();
  const [aiKey, setAiKey] = useState(aiConfig?.apiKey || "");
  const [aiModel, setAiModel] = useState(
    aiConfig?.model && MODEL_OPTIONS.includes(aiConfig.model) ? aiConfig.model : MODEL_OPTIONS[0]
  );
  const [aiSaved, setAiSaved] = useState(false);

  const saveAI = ()=>{
    onSaveAIConfig({ apiKey: aiKey.trim(), model: aiModel });
    setAiSaved(true); setTimeout(()=>setAiSaved(false), 1600);
  };

  return (
    <div style={{ padding:"14px 18px 120px" }}>
      <h2 style={{ fontSize:22, fontWeight:700, color:T.ink, margin:"6px 0 18px" }}>הפרופיל שלי</h2>

      <div style={{ background:"#fff", borderRadius:18, padding:16, boxShadow:T.shCard, marginBottom:16 }}>
        <label style={lbl}>שם</label>
        <input style={input} value={user.name} onChange={e=>setUser({ ...user, name:e.target.value })}/>
        <label style={{ ...lbl, marginTop:14 }}>יעד קלורי יומי</label>
        <input style={input} inputMode="numeric" value={user.goal}
          onChange={e=>setUser({ ...user, goal:parseInt(e.target.value)||0 })}/>
        <label style={{ ...lbl, marginTop:14 }}>יעדי מאקרו יומיים (גרם)</label>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
          <MacroGoalInput color={T.protein} label="חלבון" value={user.goalProtein||0} onChange={v=>setUser({ ...user, goalProtein:v })}/>
          <MacroGoalInput color={T.carbs} label="פחמימות" value={user.goalCarbs||0} onChange={v=>setUser({ ...user, goalCarbs:v })}/>
          <MacroGoalInput color={T.fat} label="שומן" value={user.goalFat||0} onChange={v=>setUser({ ...user, goalFat:v })}/>
        </div>
        <label style={{ ...lbl, marginTop:14 }}>דמות מלווה</label>
        <div style={{ display:"flex", gap:10 }}>
          {[["chef_m","👨‍🍳","שף"],["chef_f","👩‍🍳","שפית"]].map(([v,e,l])=>(
            <button key={v} onClick={()=>setUser({ ...user, character:v })}
              style={{ ...typeBtn, flex:1, ...(user.character===v?{ background:T.gradPrimary, color:"#fff", borderColor:"transparent" }:{}) }}>
              <span style={{ fontSize:24 }}>{e}</span><span style={{ fontSize:12 }}>{l}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ background:"#fff", borderRadius:18, padding:16, boxShadow:T.shCard, marginBottom:16 }}>
        <p style={{ margin:"0 0 4px", fontSize:15, fontWeight:500, color:T.ink }}>חיבור למנוע AI</p>
        <p style={{ margin:"0 0 14px", fontSize:12, color:T.text3 }}>
          כדי לשלוח את הפרומפט ישירות מהאפליקציה למודל Gemini.
        </p>
        <label style={lbl}>מפתח API (Gemini)</label>
        <input style={input} type="password" value={aiKey}
          onChange={e=>setAiKey(e.target.value)}
          placeholder="AIza…" autoComplete="off"/>

        <label style={{ ...lbl, marginTop:12 }}>מודל</label>
        <select style={input} value={aiModel} onChange={e=>setAiModel(e.target.value)}>
          {MODEL_OPTIONS.map(m=>(
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <p style={{ margin:"6px 0 0", fontSize:11, color:T.text3 }}>
          רשימת המודלים נתמכת וקבועה מראש — לא צריך לטעון אותה.
        </p>
        <button onClick={saveAI} disabled={!aiKey.trim()}
          style={{ ...primaryBtn, width:"100%", marginTop:14, opacity:aiKey.trim()?1:.45,
            cursor:aiKey.trim()?"pointer":"not-allowed" }}>
          {aiSaved ? <><Check size={16}/> נשמר</> : <><Save size={16}/> שמירת הגדרות</>}
        </button>
        <p style={{ margin:"10px 0 0", fontSize:11, color:T.text3 }}>
          המפתח נשמר מקומית במכשיר בלבד, ואינו חלק מגיבוי הנתונים.
        </p>
      </div>

      <div style={{ background:"#fff", borderRadius:18, padding:16, boxShadow:T.shCard }}>
        <p style={{ margin:"0 0 12px", fontSize:15, fontWeight:500, color:T.ink }}>גיבוי הנתונים</p>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onExport} style={{ ...softBtn, flex:1 }}><Download size={16}/> ייצוא לקובץ</button>
          <button onClick={()=>fileRef.current?.click()} style={{ ...ghostBtn, flex:1 }}><Upload size={16}/> ייבוא</button>
          <input ref={fileRef} type="file" accept="application/json" style={{ display:"none" }}
            onChange={e=>{ const f=e.target.files?.[0]; if(f) onImport(f); e.target.value=""; }}/>
        </div>
        <p style={{ margin:"12px 0 0", fontSize:12, color:T.text3 }}>
          הנתונים נשמרים מקומית במכשיר. ייצוא מאפשר גיבוי והעברה בין מכשירים.
        </p>
      </div>

      <button onClick={onReset} style={{ ...linkBtn, marginTop:20, color:T.fat }}>איפוס כל הנתונים</button>
    </div>
  );
}

// ============================================================
//  ONBOARDING
// ============================================================
function Onboarding({ onDone }) {
  const [name, setName] = useState("");
  const [character, setChar] = useState("chef_f");
  const [goal, setGoal] = useState(1800);
  const [gp, setGp] = useState(120);
  const [gc, setGc] = useState(200);
  const [gf, setGf] = useState(60);
  return (
    <div style={{ minHeight:"100dvh", background:T.gradPrimary, display:"flex", flexDirection:"column",
      justifyContent:"center", padding:"40px 26px", color:"#fff" }}>
      <p style={{ fontSize:15, fontWeight:500, opacity:.9, margin:0 }}>ברוכים הבאים ל־</p>
      <h1 style={{ fontSize:44, fontWeight:700, margin:"4px 0 8px" }}>בְּתֵאָבוֹן</h1>
      <p style={{ fontSize:16, opacity:.94, margin:"0 0 28px", maxWidth:320 }}>
        יומן הארוחות שמחשב עבורך — פשוט כותבים מה אכלתם.
      </p>
      <div style={{ background:"#fff", borderRadius:24, padding:20, color:T.ink, boxShadow:"0 20px 50px rgba(0,0,0,.2)" }}>
        <label style={lbl}>איך לקרוא לך?</label>
        <input style={input} value={name} onChange={e=>setName(e.target.value)} placeholder="השם שלך"/>
        <label style={{ ...lbl, marginTop:16 }}>בחרי דמות מלווה</label>
        <div style={{ display:"flex", gap:10 }}>
          {[["chef_m","👨‍🍳","שף"],["chef_f","👩‍🍳","שפית"]].map(([v,e,l])=>(
            <button key={v} onClick={()=>setChar(v)}
              style={{ ...typeBtn, flex:1, padding:"14px 8px", ...(character===v?{ background:T.gradPrimary, color:"#fff", borderColor:"transparent" }:{}) }}>
              <span style={{ fontSize:30 }}>{e}</span><span style={{ fontSize:13 }}>{l}</span>
            </button>
          ))}
        </div>
        <label style={{ ...lbl, marginTop:16 }}>יעד קלורי יומי</label>
        <input style={input} inputMode="numeric" value={goal} onChange={e=>setGoal(parseInt(e.target.value)||0)}/>
        <label style={{ ...lbl, marginTop:16 }}>יעדי מאקרו יומיים (גרם)</label>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
          <MacroGoalInput color={T.protein} label="חלבון" value={gp} onChange={setGp}/>
          <MacroGoalInput color={T.carbs} label="פחמימות" value={gc} onChange={setGc}/>
          <MacroGoalInput color={T.fat} label="שומן" value={gf} onChange={setGf}/>
        </div>
        <button disabled={!name.trim()} onClick={()=>onDone({ name:name.trim(), character, goal, goalProtein:gp, goalCarbs:gc, goalFat:gf })}
          style={{ ...primaryBtn, width:"100%", marginTop:20, opacity:name.trim()?1:.45 }}>
          בואו נתחיל <ArrowLeft size={18}/>
        </button>
      </div>
    </div>
  );
}

// ============================================================
//  ROOT
// ============================================================
export default function App() {
  const [data, setData] = useState(null);   // null = loading
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("daily");
  const [date, setDate] = useState(new Date());
  const [modal, setModal] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [detailsMeal, setDetailsMeal] = useState(null);
  const [editMeal, setEditMeal] = useState(null);
  const [aiConfig, setAiConfig] = useState(null);

  // load once
  useEffect(()=>{
    const d = loadData();
    setData(d || { user:null, days:{}, savedMeals:[] });
    setAiConfig(loadAIConfig());
    setReady(true);
  },[]);

  // persist on change
  useEffect(()=>{ if(ready && data) saveData(data); },[data,ready]);

  if(!ready) return <div style={{ ...frame, minHeight:"100dvh", display:"flex", alignItems:"center", justifyContent:"center", color:T.text3 }}>טוען…</div>;

  // onboarding
  if(!data.user) return (
    <div style={frame}>
      <Onboarding onDone={(user)=>setData(d=>({ ...d, user }))}/>
    </div>
  );

  const dKey = key(date);
  const day = data.days[dKey];

  const addMealToDay = (meal)=> setData(d=>{
    const days={ ...d.days };
    const cur=days[dKey]?{ ...days[dKey], meals:[...days[dKey].meals] }:{ meals:[] };
    cur.meals.push({ ...meal, id:uid() });
    days[dKey]=cur; return { ...d, days };
  });
  const saveMeal = (meal)=> setData(d=>{
    const exists=d.savedMeals.some(s=>s.name===meal.name);
    const sm={ id:uid(), name:meal.name, emoji:meal.emoji||MEAL_TYPES[meal.type].emoji,
      type:meal.type, ingredients:meal.ingredients, freeText:meal.freeText,
      nutrition:meal.nutrition, source:meal.source };
    return { ...d, savedMeals: exists?d.savedMeals:[sm,...d.savedMeals] };
  });
  const deleteMeal = (id)=> setData(d=>{
    const days={ ...d.days }; if(!days[dKey]) return d;
    days[dKey]={ ...days[dKey], meals:days[dKey].meals.filter(m=>m.id!==id) };
    return { ...d, days };
  });
  const updateMeal = (updated)=> setData(d=>{
    const days={ ...d.days }; if(!days[dKey]) return d;
    days[dKey]={ ...days[dKey], meals:days[dKey].meals.map(m=>m.id===updated.id?{ ...updated }:m) };
    return { ...d, days };
  });
  const quickAddSaved = (sm)=>{ addMealToDay({ ...sm }); setTab("daily"); };

  const exportData = ()=>{
    const blob=new Blob([JSON.stringify(data,null,2)],{ type:"application/json" });
    const url=URL.createObjectURL(blob); const a=document.createElement("a");
    a.href=url; a.download=`beteavon-${key(new Date())}.json`; a.click(); URL.revokeObjectURL(url);
  };
  const importData = (file)=>{ const r=new FileReader();
    r.onload=()=>{ try{ const d=JSON.parse(r.result); if(d.user&&d.days) setData(d); }catch{} };
    r.readAsText(file);
  };
  const reset = ()=>{ if(confirm("לאפס את כל הנתונים?")) setData({ user:null, days:{}, savedMeals:[] }); };

  const openAdd = (type)=>{ setModalType(type); setModal(true); };

  return (
    <div style={frame}>
      <div style={{ background:T.page, animation:"rise .3s ease" }}>
        {tab==="daily" && <DailyView date={date} setDate={setDate} day={day} user={data.user}
          onAdd={openAdd} onDeleteMeal={deleteMeal} onViewMeal={setDetailsMeal} onEditMeal={setEditMeal}/>}
        {tab==="calendar" && <CalendarView days={data.days} user={data.user}
          onPick={(d)=>{ setDate(d); setTab("daily"); }}/>}
        {tab==="library" && <LibraryView savedMeals={data.savedMeals}
          onQuickAdd={quickAddSaved} onDelete={(id)=>setData(d=>({ ...d, savedMeals:d.savedMeals.filter(s=>s.id!==id) }))}/>}
        {tab==="profile" && <ProfileView user={data.user}
          setUser={(u)=>setData(d=>({ ...d, user:u }))} onExport={exportData} onImport={importData} onReset={reset}
          aiConfig={aiConfig} onSaveAIConfig={(cfg)=>{ saveAIConfig(cfg); setAiConfig(cfg); }}/>}
      </div>

      {/* bottom nav */}
      <div style={navBar}>
        <NavItem icon={BookOpen} label="יומן" active={tab==="daily"} onClick={()=>setTab("daily")}/>
        <NavItem icon={CalendarDays} label="לוח שנה" active={tab==="calendar"} onClick={()=>setTab("calendar")}/>
        <button onClick={()=>openAdd(null)} aria-label="הוספת ארוחה" style={fab}><Plus size={28} color="#fff"/></button>
        <NavItem icon={LayoutGrid} label="ספרייה" active={tab==="library"} onClick={()=>setTab("library")}/>
        <NavItem icon={User} label="פרופיל" active={tab==="profile"} onClick={()=>setTab("profile")}/>
      </div>

      {modal && (
        <AddMealModal savedMeals={data.savedMeals} initialType={modalType} aiConfig={aiConfig}
          onClose={()=>setModal(false)}
          onAddToDay={(m)=>{ addMealToDay(m); setModal(false); setTab("daily"); }}
          onSaveMeal={(m)=>{ saveMeal(m); }}/>
      )}

      {detailsMeal && (
        <MealDetailsModal meal={detailsMeal} onClose={()=>setDetailsMeal(null)}
          onEdit={()=>{ const m=detailsMeal; setDetailsMeal(null); setEditMeal(m); }}/>
      )}

      {editMeal && (
        <AddMealModal savedMeals={data.savedMeals} initialMeal={editMeal} aiConfig={aiConfig}
          onClose={()=>setEditMeal(null)}
          onUpdate={(m)=>{ updateMeal(m); setEditMeal(null); }}/>
      )}
    </div>
  );
}

function NavItem({ icon:Icon, label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ background:"none", border:"none", cursor:"pointer",
      display:"flex", flexDirection:"column", alignItems:"center", gap:3, padding:4 }}>
      <Icon size={23} color={active?T.violet:"#B7B1C4"} strokeWidth={active?2.4:2}/>
      <span style={{ fontSize:10, fontWeight:active?500:400, color:active?T.violet:"#B7B1C4" }}>{label}</span>
    </button>
  );
}

// ============================================================
//  shared style objects
// ============================================================
const frame = { direction:"rtl", fontFamily:"'Heebo',system-ui,sans-serif", width:"100%",
  maxWidth:480, minHeight:"100dvh", margin:"0 auto", background:T.page,
  position:"relative", overflowX:"hidden",
  boxShadow:"0 0 60px rgba(124,58,237,.08)" };

const navBar = { position:"fixed", bottom:0, left:0, right:0, margin:"0 auto", maxWidth:480, height:74,
  background:"rgba(255,255,255,.92)", backdropFilter:"blur(12px)", borderTop:`1px solid ${T.border}`,
  display:"flex", alignItems:"center", justifyContent:"space-around", padding:"0 20px", zIndex:40 };

const fab = { width:56, height:56, borderRadius:20, background:T.gradPrimary, border:"4px solid "+T.page,
  display:"flex", alignItems:"center", justifyContent:"center", marginTop:-26, cursor:"pointer",
  boxShadow:T.shFab };

const overlay = { position:"fixed", inset:0, background:"rgba(28,24,38,.4)", backdropFilter:"blur(3px)",
  display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:50 };
const sheet = { background:T.page, width:"100%", maxWidth:480, maxHeight:"92dvh", borderRadius:"28px 28px 0 0",
  padding:"20px 18px 22px", display:"flex", flexDirection:"column", animation:"rise .28s ease" };

const lbl = { display:"block", fontSize:13, fontWeight:500, color:T.text2, marginBottom:7 };
const input = { width:"100%", fontSize:15, padding:"11px 14px", border:`1.5px solid ${T.border}`,
  borderRadius:12, background:"#fff", outline:"none", textAlign:"right", color:T.ink };

const primaryBtn = { display:"inline-flex", alignItems:"center", justifyContent:"center", gap:8,
  border:"none", fontSize:15, fontWeight:500, padding:"13px 20px", borderRadius:999,
  background:T.gradPrimary, color:"#fff", cursor:"pointer", boxShadow:T.shGlow };
const softBtn = { display:"inline-flex", alignItems:"center", justifyContent:"center", gap:7,
  border:"none", fontSize:15, fontWeight:500, padding:"13px 20px", borderRadius:999,
  background:"#FFF1F5", color:T.rose, cursor:"pointer" };
const ghostBtn = { display:"inline-flex", alignItems:"center", justifyContent:"center", gap:7,
  fontSize:14, fontWeight:500, padding:"11px 18px", borderRadius:999,
  background:"transparent", color:T.violet, border:`1.5px solid ${T.violet}`, cursor:"pointer" };
const pill = { display:"inline-flex", alignItems:"center", gap:6, border:"none", fontSize:13,
  fontWeight:500, padding:"9px 14px", borderRadius:999, background:"#F1ECFB", color:T.violet, cursor:"pointer" };
const linkBtn = { background:"none", border:"none", color:T.violet, fontSize:13, fontWeight:500,
  cursor:"pointer", padding:0 };

const typeBtn = { display:"flex", flexDirection:"column", alignItems:"center", gap:5, padding:"12px 6px",
  border:`1.5px solid ${T.border}`, borderRadius:14, background:"#fff", color:T.text2, cursor:"pointer" };

const emptyState = { width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8,
  background:"linear-gradient(135deg,#FFF6F2,#FDF0F6)", border:`1.5px dashed #FFB3A0`,
  borderRadius:20, padding:15, color:T.fat, fontSize:14, fontWeight:500, cursor:"pointer" };

const card2 = { background:"#fff", borderRadius:18, padding:16, boxShadow:T.shCard };
const miniBadge = (bg)=>({ width:30, height:30, borderRadius:10, background:bg, display:"flex", alignItems:"center", justifyContent:"center" });
const savedRow = { width:"100%", display:"flex", alignItems:"center", gap:10, padding:"9px 8px",
  background:"none", border:"none", cursor:"pointer", borderRadius:10 };
const stepChip = { width:20, height:20, borderRadius:"50%", background:T.gradPrimary, color:"#fff",
  fontSize:12, fontWeight:500, display:"inline-flex", alignItems:"center", justifyContent:"center", flexShrink:0 };

const segBtn = { flex:1, padding:"10px", borderRadius:12, border:`1.5px solid ${T.border}`,
  background:"#fff", color:T.text2, fontSize:14, fontWeight:500, cursor:"pointer" };
const segActive = { background:T.gradPrimary, color:"#fff", borderColor:"transparent", boxShadow:T.shGlow };

const weekRow = { display:"flex", alignItems:"center", gap:12, width:"100%", background:"#fff",
  border:`1px solid ${T.border}`, borderRadius:16, padding:"12px 14px", cursor:"pointer", boxShadow:T.shCard };
const monthCell = { display:"flex", flexDirection:"column", alignItems:"center", background:"#fff",
  border:`1px solid ${T.border}`, borderRadius:12, padding:"6px 2px", cursor:"pointer", minHeight:52 };
