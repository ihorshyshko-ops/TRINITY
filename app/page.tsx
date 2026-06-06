"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Mic, Inbox as InboxIcon, Sun, Trash2, ArrowRight,
  Sparkles, Loader2, Check, Clock, CalendarDays,
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
};

type Tab = "capture" | "inbox" | "today" | "week";

/* ── theme ─────────────────────────────────────────────── */
const C = {
  bgOuter: "#E7DFD3",
  bg: "#F7F3ED",
  surface: "#FFFFFF",
  ink: "#221D16",
  inkSoft: "#7B7163",
  line: "#EAE3D7",
  accent: "#E0512C",
  accentDark: "#C2401F",
  mustBg: "#FBE7DF",
  chipBg: "#EFEBE2",
  done: "#2F7A57",
  muted: "#C9BFAF",
};
const fontHead = "'Fraunces', Georgia, 'Times New Roman', serif";
const fontBody = "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif";

const chip: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, lineHeight: 1.4, whiteSpace: "nowrap" };
const cardStyle: React.CSSProperties = { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: "14px 16px" };
const dayBtn: React.CSSProperties = { flex: 1, height: 40, borderRadius: 11, border: "none", background: "#F1ECE3", color: C.ink, fontWeight: 600, fontSize: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", fontFamily: fontBody };
const delBtn: React.CSSProperties = { width: 44, height: 40, borderRadius: 11, border: "none", background: "#F1ECE3", color: C.inkSoft, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 };

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

const EXAMPLE = "треба написати Анні щодо контракту, доробити презу до завтра, забукати переговорку на 2 години, не забути подзвонити Олегу о 15, колись розібрати пошту";

/* ── app ───────────────────────────────────────────────── */
export default function App() {
  const [tab, setTab] = useState<Tab>("capture");
  const [raw, setRaw] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [listening, setListening] = useState(false);
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
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        html, body { margin: 0; }
        textarea { font-family: ${fontBody}; }
        .pk-scroll::-webkit-scrollbar { width: 0; }
        @keyframes pkUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes pkSpin { to { transform: rotate(360deg); } }
        .pk-card { animation: pkUp .28s ease both; }
        .pk-press:active { transform: scale(.97); }
      `}</style>

      <div style={{ width: "100%", maxWidth: 430, height: "100%", background: C.bg, display: "flex", flexDirection: "column", position: "relative", boxShadow: "0 0 60px rgba(0,0,0,.12)", overflow: "hidden" }}>
        <div className="pk-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "26px 20px 16px" }}>
          {tab === "capture" && (
            <Capture raw={raw} setRaw={setRaw} parse={parse} loading={loading}
              listening={listening} toggleVoice={toggleVoice} setExample={() => setRaw(EXAMPLE)} />
          )}
          {tab === "inbox" && (
            <InboxView items={inbox}
              onDay={(id) => { update(id, { status: "today" }); setToast("Закинув у день"); }}
              onDel={remove} goCapture={() => setTab("capture")} />
          )}
          {tab === "today" && (
            <Today active={active} done={done} plannedMin={plannedMin}
              toggle={(t) => update(t.id, { status: t.status === "done" ? "today" : "done" })}
              goInbox={() => setTab(inbox.length ? "inbox" : "capture")} hasInbox={inbox.length > 0} />
          )}
          {tab === "week" && (
            <Week tasks={tasks}
              toggle={(t) => update(t.id, { status: t.status === "done" ? "today" : "done" })}
              goCapture={() => setTab("capture")} />
          )}
        </div>

        <Nav tab={tab} setTab={setTab} inboxCount={inbox.length} />

        {toast && (
          <div style={{ position: "absolute", left: 16, right: 16, bottom: 84, background: C.ink, color: "#fff", padding: "12px 16px", borderRadius: 14, fontSize: 14, fontWeight: 500, textAlign: "center", boxShadow: "0 8px 24px rgba(0,0,0,.2)" }}>
            {toast}
          </div>
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
      <h1 style={{ fontFamily: fontHead, fontSize: 30, lineHeight: 1.05, color: C.ink, margin: "4px 0 6px", fontWeight: 600, letterSpacing: "-0.01em" }}>Що в голові?</h1>
      <p style={{ color: C.inkSoft, fontSize: 15, margin: "0 0 18px", lineHeight: 1.4 }}>Вивали все підряд — текстом або голосом. Я розкладу це на задачі з пріоритетом, часом і дедлайнами.</p>

      <div style={{ flex: 1, minHeight: 220, display: "flex" }}>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="напр.: написати Анні щодо контракту, доробити презу до завтра, подзвонити Олегу о 15…"
          style={{ flex: 1, width: "100%", resize: "none", border: `1px solid ${C.line}`, background: C.surface, borderRadius: 18, padding: 16, fontSize: 16, lineHeight: 1.5, color: C.ink, outline: "none" }}
        />
      </div>

      {!raw && (
        <button className="pk-press" onClick={setExample}
          style={{ alignSelf: "flex-start", marginTop: 12, background: "transparent", border: "none", color: C.accent, fontSize: 14, fontWeight: 600, cursor: "pointer", padding: 4 }}>
          ↳ підставити приклад
        </button>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 16 }}>
        <button className="pk-press" onClick={toggleVoice} aria-label="Голос"
          style={{ width: 56, height: 56, borderRadius: 18, border: `1px solid ${listening ? C.accent : C.line}`, background: listening ? C.accent : C.surface, color: listening ? "#fff" : C.ink, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>
          <Mic size={22} />
        </button>
        <button className="pk-press" onClick={parse} disabled={!ready}
          style={{ flex: 1, height: 56, borderRadius: 18, border: "none", background: ready ? C.accent : "#E7C9BD", color: "#fff", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 9, cursor: ready ? "pointer" : "default", fontFamily: fontBody }}>
          {loading
            ? <><Loader2 size={20} style={{ animation: "pkSpin 1s linear infinite" }} /> Думаю…</>
            : <><Sparkles size={20} /> Розкласти по задачах</>}
        </button>
      </div>
    </div>
  );
}

function InboxView({ items, onDay, onDel, goCapture }: {
  items: Task[];
  onDay: (id: string) => void;
  onDel: (id: string) => void;
  goCapture: () => void;
}) {
  return (
    <div>
      <h1 style={{ fontFamily: fontHead, fontSize: 28, color: C.ink, margin: "4px 0 4px", fontWeight: 600 }}>Inbox</h1>
      <p style={{ color: C.inkSoft, fontSize: 15, margin: "0 0 18px" }}>Залиш, закинь у день або видали.</p>
      {items.length === 0 ? (
        <Empty title="Тут поки порожньо" text="Напиши або надиктуй потік думок — задачі впадуть сюди вже розкладеними." cta="Записати думки" onCta={goCapture} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map(t => (
            <div key={t.id} className="pk-card" style={cardStyle}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ width: 9, height: 9, borderRadius: 999, background: t.priority === "must" ? C.accent : C.muted, marginTop: 7, flexShrink: 0 }} />
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

function Today({ active, done, plannedMin, toggle, goInbox, hasInbox }: {
  active: Task[];
  done: Task[];
  plannedMin: number;
  toggle: (t: Task) => void;
  goInbox: () => void;
  hasInbox: boolean;
}) {
  const total = active.length + done.length;
  const over = plannedMin > 480;
  return (
    <div>
      <h1 style={{ fontFamily: fontHead, fontSize: 28, color: C.ink, margin: "4px 0 4px", fontWeight: 600 }}>Сьогодні</h1>
      {total > 0
        ? <p style={{ color: C.inkSoft, fontSize: 15, margin: "0 0 14px" }}>{done.length}/{total} зроблено{plannedMin ? ` · заплановано ${fmtDur(plannedMin)}` : ""}</p>
        : <p style={{ color: C.inkSoft, fontSize: 15, margin: "0 0 18px" }}>Твій план на день.</p>}

      {over && (
        <div style={{ background: C.mustBg, color: C.accentDark, fontSize: 13, fontWeight: 600, padding: "8px 12px", borderRadius: 12, margin: "0 0 14px" }}>
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
          {active.map(t => <TodayRow key={t.id} t={t} toggle={toggle} />)}
          {done.map(t => <TodayRow key={t.id} t={t} toggle={toggle} />)}
        </div>
      )}
    </div>
  );
}

function TodayRow({ t, toggle }: { t: Task; toggle: (t: Task) => void }) {
  const isDone = t.status === "done";
  return (
    <div className="pk-card" style={{ ...cardStyle, opacity: isDone ? 0.55 : 1, display: "flex", alignItems: "flex-start", gap: 12, borderLeft: t.priority === "must" && !isDone ? `3px solid ${C.accent}` : `3px solid transparent` }}>
      <button className="pk-press" onClick={() => toggle(t)} aria-label="Готово"
        style={{ marginTop: 1, width: 26, height: 26, borderRadius: 999, border: `2px solid ${isDone ? C.done : C.line}`, background: isDone ? C.done : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer", padding: 0 }}>
        {isDone && <Check size={15} color="#fff" />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.ink, lineHeight: 1.3, textDecoration: isDone ? "line-through" : "none" }}>{t.title}</div>
        {!isDone && <Meta t={t} />}
      </div>
    </div>
  );
}

function Week({ tasks, toggle, goCapture }: {
  tasks: Task[];
  toggle: (t: Task) => void;
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
      <h1 style={{ fontFamily: fontHead, fontSize: 28, color: C.ink, margin: "4px 0 4px", fontWeight: 600 }}>Тиждень</h1>
      <p style={{ color: C.inkSoft, fontSize: 15, margin: "0 0 18px" }}>Задачі з дедлайном, розкладені по днях. Тап = виконано.</p>
      {groups.length === 0 ? (
        <Empty title="Поки нема дедлайнів" text="Задачі, де ти згадав день чи час (напр. «у четвер», «завтра о 10»), зʼявляться тут за днями." cta="Записати думки" onCta={goCapture} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {groups.map(g => (
            <div key={g.key}>
              <div style={{ fontFamily: fontHead, fontSize: 16, fontWeight: 600, color: g.key === "Прострочено" ? C.accentDark : C.inkSoft, margin: "0 0 8px 2px" }}>
                {g.key} <span style={{ color: C.muted, fontWeight: 500 }}>· {g.items.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {g.items.map(t => <TodayRow key={t.id} t={t} toggle={toggle} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── bits ──────────────────────────────────────────────── */
function Meta({ t }: { t: Task }) {
  const dur = fmtDur(t.estimateMin);
  const dl = fmtDeadline(t.deadline);
  if (!dur && !dl) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 7, alignItems: "center" }}>
      {dur && <span style={{ ...chip, background: C.chipBg, color: C.inkSoft, display: "inline-flex", alignItems: "center", gap: 4 }}><Clock size={12} /> {dur}</span>}
      {dl && <span style={{ ...chip, background: C.chipBg, color: C.inkSoft }}>{dl}</span>}
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
      <div style={{ width: 64, height: 64, borderRadius: 20, background: C.surface, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
        <Sparkles size={26} color={C.accent} />
      </div>
      <div style={{ fontFamily: fontHead, fontSize: 21, fontWeight: 600, color: C.ink, marginBottom: 7 }}>{title}</div>
      <div style={{ color: C.inkSoft, fontSize: 14.5, lineHeight: 1.45, maxWidth: 280, marginBottom: 20 }}>{text}</div>
      <button className="pk-press" onClick={onCta} style={{ background: C.accent, color: "#fff", border: "none", borderRadius: 13, padding: "12px 20px", fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: fontBody }}>{cta}</button>
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
    <div style={{ flexShrink: 0, display: "flex", borderTop: `1px solid ${C.line}`, background: C.surface, padding: "8px 8px 10px" }}>
      {items.map(({ id, label, Icon, badge }) => {
        const on = tab === id;
        return (
          <button key={id} className="pk-press" onClick={() => setTab(id)}
            style={{ flex: 1, background: "transparent", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "8px 0", cursor: "pointer" }}>
            <div style={{ position: "relative" }}>
              <Icon size={23} color={on ? C.accent : "#A89E8E"} strokeWidth={on ? 2.4 : 2} />
              {badge ? (
                <span style={{ position: "absolute", top: -5, right: -9, background: C.accent, color: "#fff", fontSize: 10.5, fontWeight: 700, minWidth: 16, height: 16, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{badge}</span>
              ) : null}
            </div>
            <span style={{ fontSize: 11, fontWeight: on ? 700 : 500, color: on ? C.accent : "#A89E8E" }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
