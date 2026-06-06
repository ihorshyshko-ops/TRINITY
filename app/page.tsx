"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Mic, Inbox as InboxIcon, Sun, Trash2, ArrowRight,
  Sparkles, Loader2, Check, Clock, CalendarDays, X, StickyNote,
} from "lucide-react";

/* ── types ─────────────────────────────────────────────── */
type Task = {
  id: string;
  title: string;
  priority: "must" | "nice";
  estimateMin: number | null;
  deadline: string | null;
  status: "inbox" | "today" | "done";
  createdAt: string;
  note?: string;
};

type Tab = "capture" | "inbox" | "today" | "week";

/* ── theme (dark / purple glass) ───────────────────────── */
const C = {
  bgOuter: "#060410",
  bg: "#0E0B18",
  surface: "rgba(255,255,255,0.05)",
  surfaceSolid: "#17131F",
  ink: "#F3F1FA",
  inkSoft: "#A39FB4",
  line: "rgba(255,255,255,0.09)",
  accent: "#8B5CF6",
  accentDark: "#7C3AED",
  accentGrad: "linear-gradient(135deg, #8B5CF6 0%, #B292F8 100%)",
  must: "#F472B6",
  mustBg: "rgba(244,114,182,0.13)",
  chipBg: "rgba(255,255,255,0.07)",
  done: "#34D399",
  danger: "#F26D6D",
  muted: "#6E6982",
};
const fontHead = "'Inter', system-ui, -apple-system, sans-serif";
const fontBody = "'Inter', system-ui, -apple-system, sans-serif";

const chip: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, lineHeight: 1.4, whiteSpace: "nowrap" };
const cardStyle: React.CSSProperties = { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: "14px 16px", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" };
const dayBtn: React.CSSProperties = { flex: 1, height: 40, borderRadius: 11, border: `1px solid ${C.line}`, background: "rgba(255,255,255,0.06)", color: C.ink, fontWeight: 600, fontSize: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", fontFamily: fontBody };
const delBtn: React.CSSProperties = { width: 44, height: 40, borderRadius: 11, border: `1px solid ${C.line}`, background: "rgba(255,255,255,0.06)", color: C.inkSoft, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 };
const fieldStyle: React.CSSProperties = { width: "100%", background: C.surfaceSolid, border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 14px", fontSize: 15, color: C.ink, outline: "none", fontFamily: fontBody };
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: C.inkSoft, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 7px 2px" };

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
// ISO → значення для <input type="datetime-local"> у локальному часі
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
  const recRef = useRef<any>(null);
  const baseRef = useRef("");

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const inbox = tasks.filter(t => t.status === "inbox");
  const dayTasks = tasks.filter(t => t.status !== "inbox");
  const active = dayTasks.filter(t => t.status === "today");
  const done = dayTasks.filter(t => t.status === "done");
  const plannedMin = dayTasks.reduce((s, t) => s + (t.estimateMin || 0), 0);
  const editing = editId ? tasks.find(t => t.id === editId) ?? null : null;

  const update = (id: string, patch: Partial<Task>) =>
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)));
  const remove = (id: string) => setTasks(prev => prev.filter(t => t.id !== id));

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
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
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
        @keyframes pkPulse { 0% { box-shadow: 0 0 0 0 rgba(139,92,246,.55); } 70% { box-shadow: 0 0 0 18px rgba(139,92,246,0); } 100% { box-shadow: 0 0 0 0 rgba(139,92,246,0); } }
        @keyframes pkBlink { 0%, 100% { opacity: 1; } 50% { opacity: .25; } }
        .pk-card { animation: pkUp .28s ease both; }
        .pk-sheet { animation: pkSheet .26s cubic-bezier(.2,.7,.3,1) both; }
        .pk-press:active { transform: scale(.97); }
        .pk-rec { animation: pkPulse 1.4s ease-out infinite; }
        .pk-blink { animation: pkBlink 1s ease-in-out infinite; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 430, height: "100%", background: C.bg, display: "flex", flexDirection: "column", position: "relative", boxShadow: "0 0 80px rgba(0,0,0,.5)", overflow: "hidden" }}>
        <div aria-hidden style={{ position: "absolute", top: -140, left: "50%", transform: "translateX(-50%)", width: 460, height: 340, background: "radial-gradient(circle at center, rgba(139,92,246,0.40), rgba(139,92,246,0) 68%)", pointerEvents: "none", zIndex: 0 }} />

        <div className="pk-scroll" style={{ position: "relative", zIndex: 1, flex: 1, minHeight: 0, overflowY: "auto", padding: "26px 20px 16px" }}>
          {tab === "capture" && (
            <Capture raw={raw} setRaw={setRaw} parse={parse} loading={loading}
              listening={listening} toggleVoice={toggleVoice} setExample={() => setRaw(EXAMPLE)} />
          )}
          {tab === "inbox" && (
            <InboxView items={inbox}
              onDay={(id) => { update(id, { status: "today" }); setToast("Закинув у день"); }}
              onDel={remove} onOpen={setEditId} goCapture={() => setTab("capture")} />
          )}
          {tab === "today" && (
            <Today active={active} done={done} plannedMin={plannedMin}
              toggle={(t) => update(t.id, { status: t.status === "done" ? "today" : "done" })}
              onOpen={setEditId}
              goInbox={() => setTab(inbox.length ? "inbox" : "capture")} hasInbox={inbox.length > 0} />
          )}
          {tab === "week" && (
            <Week tasks={tasks}
              toggle={(t) => update(t.id, { status: t.status === "done" ? "today" : "done" })}
              onOpen={setEditId}
              goCapture={() => setTab("capture")} />
          )}
        </div>

        <Nav tab={tab} setTab={setTab} inboxCount={inbox.length} />

        {toast && (
          <div style={{ position: "absolute", left: 16, right: 16, bottom: 88, zIndex: 5, background: "#241F38", color: C.ink, border: `1px solid ${C.line}`, padding: "12px 16px", borderRadius: 14, fontSize: 14, fontWeight: 500, textAlign: "center", boxShadow: "0 12px 32px rgba(0,0,0,.45)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
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
      <h1 style={{ fontFamily: fontHead, fontSize: 30, lineHeight: 1.08, color: C.ink, margin: "4px 0 6px", fontWeight: 700, letterSpacing: "-0.02em" }}>Що в голові?</h1>
      <p style={{ color: C.inkSoft, fontSize: 15, margin: "0 0 18px", lineHeight: 1.45 }}>Вивали все підряд — текстом або голосом. Я розкладу це на задачі з пріоритетом, часом і дедлайнами.</p>

      {listening && (
        <div style={{ display: "flex", alignItems: "center", gap: 9, background: "rgba(242,109,109,0.12)", border: `1px solid rgba(242,109,109,0.3)`, borderRadius: 12, padding: "10px 14px", margin: "0 0 14px" }}>
          <span className="pk-blink" style={{ width: 10, height: 10, borderRadius: 999, background: C.danger, flexShrink: 0, boxShadow: `0 0 8px ${C.danger}` }} />
          <span style={{ color: C.ink, fontSize: 14, fontWeight: 600 }}>Слухаю… говоріть, текст зʼявляється нижче</span>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 220, display: "flex" }}>
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
          style={{ width: 68, height: 68, borderRadius: 22, border: `1px solid ${listening ? C.accent : C.line}`, background: listening ? C.accentGrad : C.surfaceSolid, color: listening ? "#fff" : C.ink, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>
          <Mic size={28} />
        </button>
        <button className="pk-press" onClick={parse} disabled={!ready}
          style={{ flex: 1, height: 56, borderRadius: 18, border: "none", background: ready ? C.accentGrad : "rgba(255,255,255,0.07)", color: ready ? "#fff" : C.muted, fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 9, cursor: ready ? "pointer" : "default", fontFamily: fontBody, boxShadow: ready ? "0 10px 28px rgba(139,92,246,.4)" : "none" }}>
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
                <span style={{ width: 9, height: 9, borderRadius: 999, background: t.priority === "must" ? C.must : C.muted, marginTop: 7, flexShrink: 0, boxShadow: t.priority === "must" ? `0 0 8px ${C.must}` : "none" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: C.ink, lineHeight: 1.3 }}>{t.title}</div>
                  <Meta t={t} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button className="pk-press" onClick={() => onDay(t.id)} style={dayBtn}><ArrowRight size={16} /> У день</button>
                <button className="pk-press" onClick={() => onDel(t.id)} aria-label="Видалити" style={delBtn}><Trash2 size={17} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Today({ active, done, plannedMin, toggle, onOpen, goInbox, hasInbox }: {
  active: Task[];
  done: Task[];
  plannedMin: number;
  toggle: (t: Task) => void;
  onOpen: (id: string) => void;
  goInbox: () => void;
  hasInbox: boolean;
}) {
  const total = active.length + done.length;
  const over = plannedMin > 480;
  return (
    <div>
      <h1 style={{ fontFamily: fontHead, fontSize: 28, color: C.ink, margin: "4px 0 4px", fontWeight: 700, letterSpacing: "-0.02em" }}>Сьогодні</h1>
      {total > 0
        ? <p style={{ color: C.inkSoft, fontSize: 15, margin: "0 0 14px" }}>{done.length}/{total} зроблено{plannedMin ? ` · заплановано ${fmtDur(plannedMin)}` : ""}</p>
        : <p style={{ color: C.inkSoft, fontSize: 15, margin: "0 0 18px" }}>Твій план на день.</p>}

      {over && (
        <div style={{ background: C.mustBg, color: C.must, fontSize: 13, fontWeight: 600, padding: "8px 12px", borderRadius: 12, margin: "0 0 14px", border: `1px solid ${C.line}` }}>
          Більше 8 годин на день — щось перенести?
        </div>
      )}

      {total === 0 ? (
        <Empty
          title="На сьогодні ще нічого"
          text={hasInbox ? "Обери задачі в Inbox і закинь у день." : "Спершу запиши думки — потім закинеш потрібне в день."}
          cta={hasInbox ? "Відкрити Inbox" : "Записати думки"}
          onCta={goInbox}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
          {active.map(t => <TodayRow key={t.id} t={t} toggle={toggle} onOpen={onOpen} />)}
          {done.map(t => <TodayRow key={t.id} t={t} toggle={toggle} onOpen={onOpen} />)}
        </div>
      )}
    </div>
  );
}

function TodayRow({ t, toggle, onOpen }: { t: Task; toggle: (t: Task) => void; onOpen: (id: string) => void }) {
  const isDone = t.status === "done";
  const hasNote = !!(t.note && t.note.trim());
  return (
    <div className="pk-card" style={{ ...cardStyle, opacity: isDone ? 0.5 : 1, display: "flex", alignItems: "flex-start", gap: 12, borderLeft: t.priority === "must" && !isDone ? `3px solid ${C.must}` : `1px solid ${C.line}` }}>
      <button className="pk-press" onClick={() => toggle(t)} aria-label="Готово"
        style={{ marginTop: 1, width: 26, height: 26, borderRadius: 999, border: `2px solid ${isDone ? C.done : C.line}`, background: isDone ? C.done : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer", padding: 0 }}>
        {isDone && <Check size={15} color="#0E0B18" />}
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
              <div style={{ fontFamily: fontHead, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: g.key === "Прострочено" ? C.must : C.inkSoft, margin: "0 0 8px 2px" }}>
                {g.key} <span style={{ color: C.muted, fontWeight: 600 }}>· {g.items.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {g.items.map(t => <TodayRow key={t.id} t={t} toggle={toggle} onOpen={onOpen} />)}
              </div>
            </div>
          ))}
        </div>
      )}
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
  const [priority, setPriority] = useState<Task["priority"]>(task.priority);
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
      deadline: deadlineLocal ? new Date(deadlineLocal).toISOString() : null,
      estimateMin: Number.isFinite(est) && est > 0 ? est : null,
      note: note.trim() ? note.trim() : "",
    });
  }

  return (
    <div onClick={onClose}
      style={{ position: "absolute", inset: 0, zIndex: 10, background: "rgba(4,2,12,0.62)", display: "flex", flexDirection: "column", justifyContent: "flex-end", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }}>
      <div className="pk-sheet pk-scroll" onClick={(e) => e.stopPropagation()}
        style={{ background: "#14101E", borderTop: `1px solid ${C.line}`, borderRadius: "22px 22px 0 0", padding: "10px 20px calc(20px + env(safe-area-inset-bottom))", maxHeight: "92%", overflowY: "auto", boxShadow: "0 -20px 60px rgba(0,0,0,.5)" }}>
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
              placeholder="Що треба зробити?"
              style={{ ...fieldStyle, resize: "none", lineHeight: 1.4 }} />
          </div>

          <div>
            <div style={labelStyle}>Пріоритет</div>
            <div style={{ display: "flex", gap: 8 }}>
              <SegBtn active={priority === "must"} onClick={() => setPriority("must")} color={C.must} label="Важливо" />
              <SegBtn active={priority === "nice"} onClick={() => setPriority("nice")} color={C.accent} label="Звичайне" />
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
              placeholder="Деталі, посилання, контекст…"
              style={{ ...fieldStyle, resize: "none", lineHeight: 1.45 }} />
          </div>

          <button className="pk-press" onClick={onDelete}
            style={{ background: "rgba(242,109,109,0.12)", color: C.danger, border: `1px solid rgba(242,109,109,0.25)`, borderRadius: 12, padding: "12px 14px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: fontBody, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 2 }}>
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
      style={{ flex: 1, height: 44, borderRadius: 12, border: `1px solid ${active ? color : C.line}`, background: active ? `${color}22` : C.surfaceSolid, color: active ? color : C.inkSoft, fontWeight: 700, fontSize: 14.5, cursor: "pointer", fontFamily: fontBody }}>
      {label}
    </button>
  );
}

/* ── bits ──────────────────────────────────────────────── */
function Meta({ t }: { t: Task }) {
  const dur = fmtDur(t.estimateMin);
  const dl = fmtDeadline(t.deadline);
  const hasNote = !!(t.note && t.note.trim());
  if (!dur && !dl && !hasNote) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 7, alignItems: "center" }}>
      {dur && <span style={{ ...chip, background: C.chipBg, color: C.inkSoft, display: "inline-flex", alignItems: "center", gap: 4 }}><Clock size={12} /> {dur}</span>}
      {dl && <span style={{ ...chip, background: C.chipBg, color: C.inkSoft }}>{dl}</span>}
      {hasNote && (
        <span aria-label="Є примітка" title="Є примітка"
          style={{ ...chip, background: "rgba(139,92,246,0.15)", color: C.accent, padding: "3px 7px", display: "inline-flex", alignItems: "center", gap: 4 }}>
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
      <div style={{ width: 64, height: 64, borderRadius: 20, background: C.surfaceSolid, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18, boxShadow: `0 0 28px rgba(139,92,246,.25)` }}>
        <Sparkles size={26} color={C.accent} />
      </div>
      <div style={{ fontFamily: fontHead, fontSize: 21, fontWeight: 700, color: C.ink, marginBottom: 7 }}>{title}</div>
      <div style={{ color: C.inkSoft, fontSize: 14.5, lineHeight: 1.45, maxWidth: 280, marginBottom: 20 }}>{text}</div>
      <button className="pk-press" onClick={onCta} style={{ background: C.accentGrad, color: "#fff", border: "none", borderRadius: 13, padding: "12px 20px", fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: fontBody, boxShadow: "0 10px 28px rgba(139,92,246,.4)" }}>{cta}</button>
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
  ];
  return (
    <div style={{ position: "relative", zIndex: 2, flexShrink: 0, display: "flex", borderTop: `1px solid ${C.line}`, background: "rgba(14,11,24,0.82)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", padding: "8px 8px 10px" }}>
      {items.map(({ id, label, Icon, badge }) => {
        const on = tab === id;
        return (
          <button key={id} className="pk-press" onClick={() => setTab(id)}
            style={{ flex: 1, background: "transparent", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "8px 0", cursor: "pointer" }}>
            <div style={{ position: "relative" }}>
              <Icon size={23} color={on ? C.accent : C.muted} strokeWidth={on ? 2.4 : 2} />
              {badge ? (
                <span style={{ position: "absolute", top: -5, right: -9, background: C.accent, color: "#fff", fontSize: 10.5, fontWeight: 700, minWidth: 16, height: 16, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{badge}</span>
              ) : null}
            </div>
            <span style={{ fontSize: 11, fontWeight: on ? 700 : 500, color: on ? C.accent : C.muted }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
