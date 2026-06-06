"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Mic, Inbox as InboxIcon, Sun, Trash2, ArrowRight,
  Sparkles, Loader2, Check, Clock, CalendarDays, X, StickyNote, Archive,
} from "lucide-react";

/* ── types ─────────────────────────────────────────────── */
type Priority = "high" | "med" | "low";
type Category = "work" | "personal";
type Status = "inbox" | "today" | "done";

type Task = {
  id: string;
  title: string;
  priority: Priority;
  category: Category;
  estimateMin: number | null;
  deadline: string | null;
  status: Status;
  createdAt: string;
  note?: string;
};

type Tab = "capture" | "inbox" | "today" | "week" | "archive";
type CatFilterValue = "all" | Category;

/* ── theme (TRINITY — deep indigo / teal glow) ─────────── */
const C = {
  bgOuter: "#09081C",
  bg: "#141233",
  surface: "rgba(255,255,255,0.055)",
  surfaceSolid: "#1E1B40",
  ink: "#EAF1F6",
  inkSoft: "#959DBC",
  line: "rgba(255,255,255,0.10)",
  accent: "#2FE0C9",
  accentDark: "#1CB7A4",
  accentGrad: "linear-gradient(135deg, #28D8C4 0%, #5BEAD9 100%)",
  chipBg: "rgba(255,255,255,0.07)",
  done: "#2FE0C9",
  danger: "#FB7185",
  muted: "#5F6590",
};
const TEAL = "47,224,201"; // rgb for glow/shadow rgba()
const fontHead = "'Inter', system-ui, -apple-system, sans-serif";
const fontBody = "'Inter', system-ui, -apple-system, sans-serif";

const PRIO: Record<Priority, { full: string; short: string; color: string }> = {
  high: { full: "Висока терміновість", short: "Висока", color: "#FB7185" },
  med: { full: "Середня терміновість", short: "Середня", color: "#FBBF24" },
  low: { full: "Низька терміновість", short: "Низька", color: "#34D399" },
};
const CAT: Record<Category, { label: string; color: string }> = {
  work: { label: "Робота", color: "#60A5FA" },
  personal: { label: "Особисте", color: "#C084FC" },
};

const chip: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, lineHeight: 1.4, whiteSpace: "nowrap" };
const cardStyle: React.CSSProperties = { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: "14px 16px", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" };
const dayBtn: React.CSSProperties = { flex: 1, height: 40, borderRadius: 11, border: `1px solid ${C.line}`, background: "rgba(255,255,255,0.06)", color: C.ink, fontWeight: 600, fontSize: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", fontFamily: fontBody };
const delBtn: React.CSSProperties = { width: 44, height: 40, borderRadius: 11, border: `1px solid ${C.line}`, background: "rgba(255,255,255,0.06)", color: C.inkSoft, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 };
const fieldStyle: React.CSSProperties = { width: "100%", background: C.surfaceSolid, border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 14px", fontSize: 15, color: C.ink, outline: "none", fontFamily: fontBody };
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: C.inkSoft, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 7px 2px" };

/* ── brand ─────────────────────────────────────────────── */
function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none"
      style={{ filter: `drop-shadow(0 0 6px rgba(${TEAL},0.75))`, flexShrink: 0 }}>
      <g stroke={C.accent} strokeWidth="3.4" strokeLinecap="round">
        <circle cx="50" cy="37" r="21" />
        <circle cx="33" cy="64" r="21" />
        <circle cx="67" cy="64" r="21" />
      </g>
    </svg>
  );
}

function BrandBar() {
  return (
    <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", gap: 11, padding: "14px 20px 4px" }}>
      <Logo size={28} />
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
        <span style={{ fontFamily: fontHead, fontWeight: 800, fontSize: 17, letterSpacing: "0.2em", color: C.ink }}>TRINITY</span>
        <span style={{ fontSize: 10.5, color: C.accent, letterSpacing: "0.04em", marginTop: 4 }}>Твій потік пріоритетів</span>
      </div>
    </div>
  );
}

function WaveBg() {
  return (
    <svg aria-hidden viewBox="0 0 430 920" preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none" }}>
      <path d="M-20 250 Q 110 208 215 250 T 450 250" fill="none" stroke={`rgba(${TEAL},0.11)`} strokeWidth="1.4" />
      <path d="M-20 410 Q 130 366 215 410 T 450 410" fill="none" stroke={`rgba(${TEAL},0.08)`} strokeWidth="1.4" />
      <path d="M-20 600 Q 95 552 215 600 T 450 600" fill="none" stroke="rgba(124,108,246,0.08)" strokeWidth="1.4" />
      <path d="M-20 770 Q 140 726 215 770 T 450 770" fill="none" stroke={`rgba(${TEAL},0.06)`} strokeWidth="1.4" />
    </svg>
  );
}

/* ── helpers ───────────────────────────────────────────── */
function fmtDur(min: number | null): string {
  if (!min || min <= 0) return "";
  if (min < 60) return `${min} хв`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} год ${m} хв` : `${h} год`;
}
function fmtDeadline(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const days = Math.round((startOf(d).getTime() - startOf(now).getTime()) / 86400000);
  const t = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (days === 0) return `сьогодні ${t}`;
  if (days === 1) return `завтра ${t}`;
  if (days === -1) return `вчора ${t}`;
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")} ${t}`;
}
function plural(n: number): string {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return "задача";
  if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return "задачі";
  return "задач";
}
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STORAGE_KEY = "trinity.tasks.v1";

// Захищена нормалізація збережених даних → масив валідних Task (з міграцією старих полів).
function coerceTasks(input: unknown): Task[] {
  if (!Array.isArray(input)) return [];
  const out: Task[] = [];
  for (const it of input) {
    if (!it || typeof it !== "object") continue;
    const t = it as Record<string, unknown>;
    const title = typeof t.title === "string" ? t.title : "";
    if (!title.trim()) continue;
    const status: Status = t.status === "today" || t.status === "done" ? t.status : "inbox";
    const est = Number(t.estimateMin);
    // міграція старого priority "must"/"nice" → high/low
    let priority: Priority = "med";
    if (t.priority === "high" || t.priority === "med" || t.priority === "low") priority = t.priority;
    else if (t.priority === "must") priority = "high";
    else if (t.priority === "nice") priority = "low";
    const category: Category = t.category === "personal" ? "personal" : "work";
    out.push({
      id: typeof t.id === "string" && t.id ? t.id : crypto.randomUUID(),
      title,
      priority,
      category,
      estimateMin: Number.isFinite(est) && est > 0 ? Math.round(est) : null,
      deadline: typeof t.deadline === "string" && t.deadline ? t.deadline : null,
      status,
      createdAt: typeof t.createdAt === "string" && t.createdAt ? t.createdAt : new Date().toISOString(),
      note: typeof t.note === "string" ? t.note : undefined,
    });
  }
  return out;
}

const EXAMPLE = "треба написати Анні щодо контракту, доробити презу до завтра, забукати переговорку на 2 години, не забути подзвонити Олегу о 15, колись розібрати пошту";

/* ── app ───────────────────────────────────────────────── */
export default function App() {
  const [tab, setTab] = useState<Tab>("capture");
  const [raw, setRaw] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [listening, setListening] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [catFilter, setCatFilter] = useState<CatFilterValue>("all");
  const recRef = useRef<any>(null);
  const baseRef = useRef("");

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) setTasks(coerceTasks(JSON.parse(s)));
    } catch { /* ignore corrupt storage */ }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch { /* ignore quota / private mode */ }
  }, [tasks, loaded]);

  const byCat = (arr: Task[]) => (catFilter === "all" ? arr : arr.filter(t => t.category === catFilter));

  const inbox = byCat(tasks.filter(t => t.status === "inbox"));
  const active = byCat(tasks.filter(t => t.status === "today"));
  const archived = byCat(tasks.filter(t => t.status === "done"));
  const weekTasks = byCat(tasks.filter(t => t.status !== "done"));
  const inboxCount = tasks.filter(t => t.status === "inbox").length;
  const editing = editId ? tasks.find(t => t.id === editId) ?? null : null;

  const update = (id: string, patch: Partial<Task>) =>
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)));
  const remove = (id: string) => setTasks(prev => prev.filter(t => t.id !== id));
  const toggle = (t: Task) => update(t.id, { status: t.status === "done" ? "today" : "done" });

  async function parse() {
    const text = raw.trim();
    if (!text || loading) return;
    setLoading(true);
    try {
      const now = new Date();
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          nowIso: now.toISOString(),
          nowLocal: now.toLocaleString("uk-UA", {
            weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
          }),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setToast(err.error || "Збій розбору. Спробуй ще раз.");
        return;
      }

      const parsed = (await res.json()) as Task[];
      if (!Array.isArray(parsed) || !parsed.length) {
        setToast("Не вдалося виділити задачі — переформулюй?");
        return;
      }

      setTasks(prev => [...parsed, ...prev]);
      setRaw("");
      setTab("inbox");
      setToast(`Готово: ${parsed.length} ${plural(parsed.length)}`);
    } catch {
      setToast("Збій розбору. Спробуй ще раз.");
    } finally {
      setLoading(false);
    }
  }

  function toggleVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setToast("Голос недоступний у цьому браузері — друкуй текстом."); return; }
    if (listening) { try { recRef.current && recRef.current.stop(); } catch { /* ignore */ } return; }
    try {
      const r = new SR();
      r.lang = "uk-UA"; r.interimResults = true; r.continuous = true;
      baseRef.current = raw ? raw + " " : "";
      r.onresult = (ev: any) => {
        let s = "";
        for (let i = 0; i < ev.results.length; i++) s += ev.results[i][0].transcript;
        setRaw(baseRef.current + s);
      };
      r.onerror = () => { setListening(false); setToast("Мікрофон недоступний — друкуй текстом."); };
      r.onend = () => setListening(false);
      recRef.current = r;
      r.start();
      setListening(true);
    } catch {
      setListening(false);
      setToast("Мікрофон недоступний — друкуй текстом.");
    }
  }

  return (
    <div style={{ height: "100vh", width: "100%", background: C.bgOuter, display: "flex", justifyContent: "center", fontFamily: fontBody }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        html, body { margin: 0; background: ${C.bgOuter}; }
        textarea, input { font-family: ${fontBody}; }
        textarea::placeholder, input::placeholder { color: ${C.muted}; }
        .pk-scroll::-webkit-scrollbar { width: 0; }
        @keyframes pkUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes pkSheet { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: none; } }
        @keyframes pkSpin { to { transform: rotate(360deg); } }
        @keyframes pkPulse { 0% { box-shadow: 0 0 0 0 rgba(${TEAL},.55); } 70% { box-shadow: 0 0 0 18px rgba(${TEAL},0); } 100% { box-shadow: 0 0 0 0 rgba(${TEAL},0); } }
        @keyframes pkBlink { 0%, 100% { opacity: 1; } 50% { opacity: .25; } }
        .pk-card { animation: pkUp .28s ease both; }
        .pk-sheet { animation: pkSheet .26s cubic-bezier(.2,.7,.3,1) both; }
        .pk-press:active { transform: scale(.97); }
        .pk-rec { animation: pkPulse 1.4s ease-out infinite; }
        .pk-blink { animation: pkBlink 1s ease-in-out infinite; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 430, height: "100%", background: C.bg, display: "flex", flexDirection: "column", position: "relative", boxShadow: "0 0 80px rgba(0,0,0,.5)", overflow: "hidden" }}>
        <div aria-hidden style={{ position: "absolute", top: -150, left: "50%", transform: "translateX(-50%)", width: 480, height: 360, background: `radial-gradient(circle at center, rgba(${TEAL},0.30), rgba(${TEAL},0) 68%)`, pointerEvents: "none", zIndex: 0 }} />
        <WaveBg />

        <BrandBar />
        {tab !== "capture" && <CatFilter value={catFilter} onChange={setCatFilter} />}

        <div className="pk-scroll" style={{ position: "relative", zIndex: 1, flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 20px 16px" }}>
          {tab === "capture" && (
            <Capture raw={raw} setRaw={setRaw} parse={parse} loading={loading}
              listening={listening} toggleVoice={toggleVoice} setExample={() => setRaw(EXAMPLE)} />
          )}
          {tab === "inbox" && (
            <InboxView items={inbox}
              onDay={(id) => { update(id, { status: "today" }); setToast("Додано в сьогодні"); }}
              onDel={remove} onOpen={setEditId} goCapture={() => setTab("capture")} />
          )}
          {tab === "today" && (
            <Today active={active} toggle={toggle} onOpen={setEditId}
              goInbox={() => setTab(inboxCount ? "inbox" : "capture")} hasInbox={inboxCount > 0} />
          )}
          {tab === "week" && (
            <Week tasks={weekTasks} toggle={toggle} onOpen={setEditId} goCapture={() => setTab("capture")} />
          )}
          {tab === "archive" && (
            <ArchiveView items={archived} toggle={toggle} onOpen={setEditId}
              onClear={() => { setTasks(prev => prev.filter(t => t.status !== "done")); setToast("Архів очищено"); }} />
          )}
        </div>

        <Nav tab={tab} setTab={setTab} inboxCount={inboxCount} />

        {toast && (
          <div style={{ position: "absolute", left: 16, right: 16, bottom: 88, zIndex: 5, background: "#241F47", color: C.ink, border: `1px solid ${C.line}`, padding: "12px 16px", borderRadius: 14, fontSize: 14, fontWeight: 500, textAlign: "center", boxShadow: "0 12px 32px rgba(0,0,0,.45)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
            {toast}
          </div>
        )}

        {editing && (
          <Editor
            task={editing}
            onSave={(patch) => { update(editing.id, patch); setEditId(null); setToast("Збережено"); }}
            onDelete={() => { remove(editing.id); setEditId(null); setToast("Видалено"); }}
            onClose={() => setEditId(null)}
          />
        )}
      </div>
    </div>
  );
}

/* ── category filter ───────────────────────────────────── */
function CatFilter({ value, onChange }: { value: CatFilterValue; onChange: (v: CatFilterValue) => void }) {
  const opts: { id: CatFilterValue; label: string }[] = [
    { id: "all", label: "Усі" },
    { id: "work", label: "Робота" },
    { id: "personal", label: "Особисте" },
  ];
  return (
    <div style={{ position: "relative", zIndex: 2, display: "flex", gap: 7, padding: "6px 20px 8px" }}>
      {opts.map(o => {
        const on = value === o.id;
        return (
          <button key={o.id} className="pk-press" onClick={() => onChange(o.id)}
            style={{ padding: "7px 15px", borderRadius: 999, border: `1px solid ${on ? C.accent : C.line}`, background: on ? `rgba(${TEAL},0.14)` : "transparent", color: on ? C.accent : C.inkSoft, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: fontBody }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── screens ───────────────────────────────────────────── */
function Capture({ raw, setRaw, parse, loading, listening, toggleVoice, setExample }: {
  raw: string;
  setRaw: (v: string) => void;
  parse: () => void;
  loading: boolean;
  listening: boolean;
  toggleVoice: () => void;
  setExample: () => void;
}) {
  const ready = raw.trim() && !loading;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <h1 style={{ fontFamily: fontHead, fontSize: 30, lineHeight: 1.08, color: C.ink, margin: "4px 0 6px", fontWeight: 700, letterSpacing: "-0.02em" }}>Який план?</h1>
      <p style={{ color: C.inkSoft, fontSize: 15, margin: "0 0 18px", lineHeight: 1.45 }}>Вивали все підряд — текстом або голосом. Я розкладу це на задачі з пріоритетом, часом і дедлайнами.</p>

      {listening && (
        <div style={{ display: "flex", alignItems: "center", gap: 9, background: "rgba(251,113,133,0.12)", border: `1px solid rgba(251,113,133,0.3)`, borderRadius: 12, padding: "10px 14px", margin: "0 0 14px" }}>
          <span className="pk-blink" style={{ width: 10, height: 10, borderRadius: 999, background: C.danger, flexShrink: 0, boxShadow: `0 0 8px ${C.danger}` }} />
          <span style={{ color: C.ink, fontSize: 14, fontWeight: 600 }}>Слухаю… говоріть, текст зʼявляється нижче</span>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 200, display: "flex" }}>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="напр.: написати Анні щодо контракту, доробити презу до завтра, подзвонити Олегу о 15…"
          style={{ flex: 1, width: "100%", resize: "none", border: `1px solid ${C.line}`, background: C.surfaceSolid, borderRadius: 18, padding: 16, fontSize: 16, lineHeight: 1.5, color: C.ink, outline: "none" }}
        />
      </div>

      {!raw && (
        <button className="pk-press" onClick={setExample}
          style={{ alignSelf: "flex-start", marginTop: 12, background: "transparent", border: "none", color: C.accent, fontSize: 14, fontWeight: 600, cursor: "pointer", padding: 4 }}>
          ↳ підставити приклад
        </button>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 16 }}>
        <button className={`pk-press ${listening ? "pk-rec" : ""}`} onClick={toggleVoice} aria-label={listening ? "Зупинити запис" : "Голос"}
          style={{ width: 68, height: 68, borderRadius: 22, border: `1px solid ${listening ? C.accent : C.line}`, background: listening ? C.accentGrad : C.surfaceSolid, color: listening ? "#06231F" : C.ink, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>
          <Mic size={28} />
        </button>
        <button className="pk-press" onClick={parse} disabled={!ready}
          style={{ flex: 1, height: 56, borderRadius: 18, border: "none", background: ready ? C.accentGrad : "rgba(255,255,255,0.07)", color: ready ? "#06231F" : C.muted, fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 9, cursor: ready ? "pointer" : "default", fontFamily: fontBody, boxShadow: ready ? `0 10px 28px rgba(${TEAL},.4)` : "none" }}>
          {loading
            ? <><Loader2 size={20} style={{ animation: "pkSpin 1s linear infinite" }} /> Думаю…</>
            : <><Sparkles size={20} /> Розкласти по задачах</>}
        </button>
      </div>
    </div>
  );
}

function InboxView({ items, onDay, onDel, onOpen, goCapture }: {
  items: Task[];
  onDay: (id: string) => void;
  onDel: (id: string) => void;
  onOpen: (id: string) => void;
  goCapture: () => void;
}) {
  return (
    <div>
      <h1 style={{ fontFamily: fontHead, fontSize: 28, color: C.ink, margin: "4px 0 4px", fontWeight: 700, letterSpacing: "-0.02em" }}>Inbox</h1>
      <p style={{ color: C.inkSoft, fontSize: 15, margin: "0 0 18px" }}>Тапни задачу, щоб відредагувати. Або закинь у день / видали.</p>
      {items.length === 0 ? (
        <Empty title="Тут поки порожньо" text="Напиши або надиктуй потік думок — задачі впадуть сюди вже розкладеними." cta="Записати думки" onCta={goCapture} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map(t => (
            <div key={t.id} className="pk-card" style={cardStyle}>
              <div onClick={() => onOpen(t.id)} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <span style={{ width: 9, height: 9, borderRadius: 999, background: PRIO[t.priority].color, marginTop: 7, flexShrink: 0, boxShadow: t.priority === "high" ? `0 0 8px ${PRIO.high.color}` : "none" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: C.ink, lineHeight: 1.3 }}>{t.title}</div>
                  <Meta t={t} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button className="pk-press" onClick={() => onDay(t.id)} style={dayBtn}><ArrowRight size={16} /> Зробити сьогодні</button>
                <button className="pk-press" onClick={() => onDel(t.id)} aria-label="Видалити" style={delBtn}><Trash2 size={17} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Today({ active, toggle, onOpen, goInbox, hasInbox }: {
  active: Task[];
  toggle: (t: Task) => void;
  onOpen: (id: string) => void;
  goInbox: () => void;
  hasInbox: boolean;
}) {
  const plannedMin = active.reduce((s, t) => s + (t.estimateMin || 0), 0);
  const over = plannedMin > 480;
  return (
    <div>
      <h1 style={{ fontFamily: fontHead, fontSize: 28, color: C.ink, margin: "4px 0 4px", fontWeight: 700, letterSpacing: "-0.02em" }}>Сьогодні</h1>
      {active.length > 0
        ? <p style={{ color: C.inkSoft, fontSize: 15, margin: "0 0 14px" }}>{active.length} {plural(active.length)}{plannedMin ? ` · заплановано ${fmtDur(plannedMin)}` : ""}</p>
        : <p style={{ color: C.inkSoft, fontSize: 15, margin: "0 0 18px" }}>Твій план на день.</p>}

      {over && (
        <div style={{ background: "rgba(251,113,133,0.12)", color: PRIO.high.color, fontSize: 13, fontWeight: 600, padding: "8px 12px", borderRadius: 12, margin: "0 0 14px", border: `1px solid ${C.line}` }}>
          Більше 8 годин на день — щось перенести?
        </div>
      )}

      {active.length === 0 ? (
        <Empty
          title="На сьогодні ще нічого"
          text={hasInbox ? "Обери задачі в Inbox і закинь у день." : "Спершу запиши думки — потім закинеш потрібне в день."}
          cta={hasInbox ? "Відкрити Inbox" : "Записати думки"}
          onCta={goInbox}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
          {active.map(t => <TaskRow key={t.id} t={t} toggle={toggle} onOpen={onOpen} />)}
        </div>
      )}
    </div>
  );
}

function Week({ tasks, toggle, onOpen, goCapture }: {
  tasks: Task[];
  toggle: (t: Task) => void;
  onOpen: (id: string) => void;
  goCapture: () => void;
}) {
  const today0 = (() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime(); })();

  const dated = tasks
    .map(t => {
      const d = t.deadline ? new Date(t.deadline) : null;
      if (!d || isNaN(d.getTime())) return null;
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const days = Math.round((dayStart - today0) / 86400000);
      return { t, d, days, ts: d.getTime() };
    })
    .filter((x): x is { t: Task; d: Date; days: number; ts: number } => x !== null)
    .sort((a, b) => a.ts - b.ts);

  const labelFor = (days: number, d: Date) => {
    if (days < 0) return "Прострочено";
    if (days === 0) return "Сьогодні";
    if (days === 1) return "Завтра";
    if (days <= 7) {
      const wd = d.toLocaleDateString("uk-UA", { weekday: "long" });
      return wd.charAt(0).toUpperCase() + wd.slice(1);
    }
    return "Пізніше";
  };

  const groups: { key: string; items: Task[] }[] = [];
  for (const x of dated) {
    const key = labelFor(x.days, x.d);
    let g = groups.find(g => g.key === key);
    if (!g) { g = { key, items: [] }; groups.push(g); }
    g.items.push(x.t);
  }

  return (
    <div>
      <h1 style={{ fontFamily: fontHead, fontSize: 28, color: C.ink, margin: "4px 0 4px", fontWeight: 700, letterSpacing: "-0.02em" }}>Тиждень</h1>
      <p style={{ color: C.inkSoft, fontSize: 15, margin: "0 0 18px" }}>Задачі з дедлайном, розкладені по днях. Тап по тексту — редагувати.</p>
      {groups.length === 0 ? (
        <Empty title="Поки нема дедлайнів" text="Задачі, де ти згадав день чи час (напр. «у четвер», «завтра о 10»), зʼявляться тут за днями." cta="Записати думки" onCta={goCapture} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {groups.map(g => (
            <div key={g.key}>
              <div style={{ fontFamily: fontHead, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: g.key === "Прострочено" ? PRIO.high.color : C.accent, margin: "0 0 8px 2px" }}>
                {g.key} <span style={{ color: C.muted, fontWeight: 600 }}>· {g.items.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {g.items.map(t => <TaskRow key={t.id} t={t} toggle={toggle} onOpen={onOpen} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ArchiveView({ items, toggle, onOpen, onClear }: {
  items: Task[];
  toggle: (t: Task) => void;
  onOpen: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <div>
      <h1 style={{ fontFamily: fontHead, fontSize: 28, color: C.ink, margin: "4px 0 4px", fontWeight: 700, letterSpacing: "-0.02em" }}>Архів</h1>
      <p style={{ color: C.inkSoft, fontSize: 15, margin: "0 0 18px" }}>Виконані задачі. Тап по кружечку — повернути в роботу.</p>
      {items.length === 0 ? (
        <Empty title="Архів порожній" text="Виконані задачі (із «Сьогодні» чи «Тиждень») складатимуться сюди." cta="" onCta={() => {}} />
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {items.map(t => <TaskRow key={t.id} t={t} toggle={toggle} onOpen={onOpen} />)}
          </div>
          <button className="pk-press" onClick={onClear}
            style={{ marginTop: 18, width: "100%", background: "transparent", color: C.inkSoft, border: `1px solid ${C.line}`, borderRadius: 12, padding: "11px 14px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: fontBody, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Trash2 size={16} /> Очистити архів
          </button>
        </>
      )}
    </div>
  );
}

function TaskRow({ t, toggle, onOpen }: { t: Task; toggle: (t: Task) => void; onOpen: (id: string) => void }) {
  const isDone = t.status === "done";
  const hasNote = !!(t.note && t.note.trim());
  return (
    <div className="pk-card" style={{ ...cardStyle, opacity: isDone ? 0.5 : 1, display: "flex", alignItems: "flex-start", gap: 12, borderLeft: !isDone ? `3px solid ${PRIO[t.priority].color}` : `1px solid ${C.line}` }}>
      <button className="pk-press" onClick={() => toggle(t)} aria-label="Готово"
        style={{ marginTop: 1, width: 26, height: 26, borderRadius: 999, border: `2px solid ${isDone ? C.done : C.line}`, background: isDone ? C.done : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer", padding: 0 }}>
        {isDone && <Check size={15} color="#06231F" />}
      </button>
      <div onClick={() => onOpen(t.id)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.ink, lineHeight: 1.3, textDecoration: isDone ? "line-through" : "none" }}>{t.title}</div>
        {!isDone && <Meta t={t} />}
        {!isDone && hasNote && (
          <div style={{ marginTop: 6, fontSize: 13, color: C.inkSoft, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {t.note}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── editor ────────────────────────────────────────────── */
function Editor({ task, onSave, onDelete, onClose }: {
  task: Task;
  onSave: (patch: Partial<Task>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [category, setCategory] = useState<Category>(task.category);
  const [deadlineLocal, setDeadlineLocal] = useState(isoToLocalInput(task.deadline));
  const [estimate, setEstimate] = useState(task.estimateMin != null ? String(task.estimateMin) : "");
  const [note, setNote] = useState(task.note ?? "");

  const canSave = title.trim().length > 0;

  function save() {
    if (!canSave) return;
    const est = parseInt(estimate, 10);
    onSave({
      title: title.trim(),
      priority,
      category,
      deadline: deadlineLocal ? new Date(deadlineLocal).toISOString() : null,
      estimateMin: Number.isFinite(est) && est > 0 ? est : null,
      note: note.trim() ? note.trim() : "",
    });
  }

  return (
    <div onClick={onClose}
      style={{ position: "absolute", inset: 0, zIndex: 10, background: "rgba(5,4,18,0.66)", display: "flex", flexDirection: "column", justifyContent: "flex-end", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }}>
      <div className="pk-sheet pk-scroll" onClick={(e) => e.stopPropagation()}
        style={{ background: "#1A1740", borderTop: `1px solid ${C.line}`, borderRadius: "22px 22px 0 0", padding: "10px 20px calc(20px + env(safe-area-inset-bottom))", maxHeight: "92%", overflowY: "auto", boxShadow: "0 -20px 60px rgba(0,0,0,.5)" }}>
        <div style={{ width: 40, height: 4, borderRadius: 999, background: C.line, margin: "0 auto 14px" }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <button className="pk-press" onClick={onClose} style={{ background: "transparent", border: "none", color: C.inkSoft, fontSize: 15, fontWeight: 600, cursor: "pointer", padding: 4, fontFamily: fontBody }}>Скасувати</button>
          <span style={{ fontFamily: fontHead, fontSize: 16, fontWeight: 700, color: C.ink }}>Задача</span>
          <button className="pk-press" onClick={save} disabled={!canSave}
            style={{ background: "transparent", border: "none", color: canSave ? C.accent : C.muted, fontSize: 15, fontWeight: 700, cursor: canSave ? "pointer" : "default", padding: 4, fontFamily: fontBody }}>Зберегти</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <div style={labelStyle}>Опис</div>
            <textarea value={title} onChange={(e) => setTitle(e.target.value)} rows={2}
              placeholder="Що треба зробити?" style={{ ...fieldStyle, resize: "none", lineHeight: 1.4 }} />
          </div>

          <div>
            <div style={labelStyle}>Терміновість</div>
            <div style={{ display: "flex", gap: 8 }}>
              {(["high", "med", "low"] as Priority[]).map(p => (
                <SegBtn key={p} active={priority === p} onClick={() => setPriority(p)} color={PRIO[p].color} label={PRIO[p].short} />
              ))}
            </div>
          </div>

          <div>
            <div style={labelStyle}>Категорія</div>
            <div style={{ display: "flex", gap: 8 }}>
              <SegBtn active={category === "work"} onClick={() => setCategory("work")} color={CAT.work.color} label={CAT.work.label} />
              <SegBtn active={category === "personal"} onClick={() => setCategory("personal")} color={CAT.personal.color} label={CAT.personal.label} />
            </div>
          </div>

          <div>
            <div style={labelStyle}>Дедлайн</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="datetime-local" value={deadlineLocal} onChange={(e) => setDeadlineLocal(e.target.value)}
                style={{ ...fieldStyle, flex: 1, colorScheme: "dark" }} />
              {deadlineLocal && (
                <button className="pk-press" onClick={() => setDeadlineLocal("")} aria-label="Прибрати дедлайн"
                  style={{ ...delBtn, width: 46 }}><X size={18} /></button>
              )}
            </div>
            {!deadlineLocal && <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6, marginLeft: 2 }}>Без дедлайну</div>}
          </div>

          <div>
            <div style={labelStyle}>Оцінка часу (хв)</div>
            <input type="number" inputMode="numeric" min={0} value={estimate}
              onChange={(e) => setEstimate(e.target.value)} placeholder="напр. 30"
              style={{ ...fieldStyle, colorScheme: "dark" }} />
          </div>

          <div>
            <div style={labelStyle}>Примітки</div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4}
              placeholder="Деталі, посилання, контекст…" style={{ ...fieldStyle, resize: "none", lineHeight: 1.45 }} />
          </div>

          <button className="pk-press" onClick={onDelete}
            style={{ background: "rgba(251,113,133,0.12)", color: C.danger, border: `1px solid rgba(251,113,133,0.28)`, borderRadius: 12, padding: "12px 14px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: fontBody, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 2 }}>
            <Trash2 size={17} /> Видалити задачу
          </button>
        </div>
      </div>
    </div>
  );
}

function SegBtn({ active, onClick, color, label }: { active: boolean; onClick: () => void; color: string; label: string }) {
  return (
    <button className="pk-press" onClick={onClick}
      style={{ flex: 1, height: 44, borderRadius: 12, border: `1px solid ${active ? color : C.line}`, background: active ? `${color}22` : C.surfaceSolid, color: active ? color : C.inkSoft, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: fontBody, padding: "0 4px" }}>
      {label}
    </button>
  );
}

/* ── bits ──────────────────────────────────────────────── */
function Meta({ t }: { t: Task }) {
  const dur = fmtDur(t.estimateMin);
  const dl = fmtDeadline(t.deadline);
  const hasNote = !!(t.note && t.note.trim());
  const p = PRIO[t.priority];
  const c = CAT[t.category];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 7, alignItems: "center" }}>
      <span style={{ ...chip, background: `${p.color}22`, color: p.color }}>{p.short}</span>
      <span style={{ ...chip, background: `${c.color}22`, color: c.color }}>{c.label}</span>
      {dur && <span style={{ ...chip, background: C.chipBg, color: C.inkSoft, display: "inline-flex", alignItems: "center", gap: 4 }}><Clock size={12} /> {dur}</span>}
      {dl && <span style={{ ...chip, background: C.chipBg, color: C.inkSoft }}>{dl}</span>}
      {hasNote && (
        <span aria-label="Є примітка" title="Є примітка"
          style={{ ...chip, background: `rgba(${TEAL},0.15)`, color: C.accent, padding: "3px 7px", display: "inline-flex", alignItems: "center", gap: 4 }}>
          <StickyNote size={12} />
        </span>
      )}
    </div>
  );
}

function Empty({ title, text, cta, onCta }: {
  title: string;
  text: string;
  cta: string;
  onCta: () => void;
}) {
  return (
    <div style={{ textAlign: "center", padding: "44px 18px 24px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: 64, height: 64, borderRadius: 20, background: C.surfaceSolid, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18, boxShadow: `0 0 28px rgba(${TEAL},.25)` }}>
        <Sparkles size={26} color={C.accent} />
      </div>
      <div style={{ fontFamily: fontHead, fontSize: 21, fontWeight: 700, color: C.ink, marginBottom: 7 }}>{title}</div>
      <div style={{ color: C.inkSoft, fontSize: 14.5, lineHeight: 1.45, maxWidth: 280, marginBottom: 20 }}>{text}</div>
      {cta && (
        <button className="pk-press" onClick={onCta} style={{ background: C.accentGrad, color: "#06231F", border: "none", borderRadius: 13, padding: "12px 20px", fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: fontBody, boxShadow: `0 10px 28px rgba(${TEAL},.4)` }}>{cta}</button>
      )}
    </div>
  );
}

function Nav({ tab, setTab, inboxCount }: {
  tab: Tab;
  setTab: (t: Tab) => void;
  inboxCount: number;
}) {
  const items: { id: Tab; label: string; Icon: typeof Mic; badge?: number }[] = [
    { id: "capture", label: "Думки", Icon: Mic },
    { id: "inbox", label: "Inbox", Icon: InboxIcon, badge: inboxCount },
    { id: "today", label: "Сьогодні", Icon: Sun },
    { id: "week", label: "Тиждень", Icon: CalendarDays },
    { id: "archive", label: "Архів", Icon: Archive },
  ];
  return (
    <div style={{ position: "relative", zIndex: 2, flexShrink: 0, display: "flex", borderTop: `1px solid ${C.line}`, background: "rgba(20,18,51,0.82)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", padding: "8px 4px 10px" }}>
      {items.map(({ id, label, Icon, badge }) => {
        const on = tab === id;
        return (
          <button key={id} className="pk-press" onClick={() => setTab(id)}
            style={{ flex: 1, background: "transparent", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 0", cursor: "pointer" }}>
            <div style={{ position: "relative" }}>
              <Icon size={22} color={on ? C.accent : C.muted} strokeWidth={on ? 2.4 : 2} />
              {badge ? (
                <span style={{ position: "absolute", top: -5, right: -9, background: C.accent, color: "#06231F", fontSize: 10, fontWeight: 700, minWidth: 15, height: 15, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{badge}</span>
              ) : null}
            </div>
            <span style={{ fontSize: 10.5, fontWeight: on ? 700 : 500, color: on ? C.accent : C.muted }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
