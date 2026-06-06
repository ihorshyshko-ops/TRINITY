import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

// SDK потребує Node-рантайму (не edge).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Task = {
  id: string;
  title: string;
  priority: "high" | "med" | "low";
  category: "work" | "personal";
  estimateMin: number | null;
  deadline: string | null;
  status: "inbox";
  createdAt: string;
};

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return fail("Сервер без ключа ANTHROPIC_API_KEY. Додай його в налаштуваннях Vercel.", 500);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Некоректний запит.");
  }

  const data = body as { text?: unknown; nowIso?: unknown; nowLocal?: unknown };
  const text = typeof data.text === "string" ? data.text.trim() : "";
  if (!text) return fail("Порожній текст.");

  const nowIso = typeof data.nowIso === "string" && data.nowIso ? data.nowIso : new Date().toISOString();
  const nowLocal = typeof data.nowLocal === "string" && data.nowLocal ? data.nowLocal : nowIso;

  const system =
`Зараз ${nowLocal} (ISO: ${nowIso}). Це твоя точка відліку для всіх дедлайнів — спирайся саме на цей день тижня й дату.
Ти — асистент-планувальник. Користувач надиктував потік думок. Перетвори його на конкретні задачі.
Поверни ВИКЛЮЧНО валідний JSON-масив. Без тексту до/після, без markdown, без \`\`\`.
Кожен елемент: {"title": "коротке дієслівне формулювання українською", "priority": "high" | "med" | "low", "category": "work" | "personal", "estimateMin": ціле число хвилин, "deadline": ISO 8601 рядок з датою і часом або null}
Правила:
- Розбивай потік на окремі задачі.
- priority — рівень терміновості: "high" (висока, горить/важливо/жорсткий дедлайн), "med" (середня, звичайна справа), "low" (низька, без тиску, «колись»).
- category — "work" для робочих задач (робота, клієнти, проєкти, зустрічі, звіти), "personal" для особистих (побут, родина, здоровʼя, покупки, дозвілля). Якщо неясно — обери ймовірніше за змістом.
- Дедлайн став ЛИШЕ якщо в тексті є згадка про час або день. Немає згадки → deadline: null (не вигадуй дедлайн).
- "сьогодні"/"о 15" → сьогоднішня дата; "завтра"/"до завтра" → +1 день.
- День тижня ("у четвер", "в пʼятницю") = НАЙБЛИЖЧИЙ майбутній такий день відносно сьогодні. Якщо сьогодні вже той день і час не минув — сьогодні; інакше наступний такий день (може бути наступного тижня). Уважно: порахуй від поточного дня тижня, вказаного вище.
- Якщо день є, а час — ні, постав розумний час (напр. 18:00).
- estimateMin став завжди (оціни реалістично).
- Не вигадуй нічого понад сказане користувачем.`;

  let rawOut = "";
  try {
    const client = new Anthropic();
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: text }],
    });
    for (const block of msg.content) {
      if (block.type === "text") rawOut += block.text;
    }
  } catch {
    return fail("Не вдалося звернутись до Claude. Спробуй ще раз.", 502);
  }

  // Не довіряємо моделі на слово: чистимо обгортки, вирізаємо масив, парсимо.
  let cleaned = rawOut.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) cleaned = cleaned.slice(start, end + 1);

  let arr: unknown;
  try {
    arr = JSON.parse(cleaned);
  } catch {
    return fail("Збій розбору відповіді. Спробуй переформулювати.", 502);
  }
  if (!Array.isArray(arr)) return fail("Збій розбору відповіді. Спробуй переформулювати.", 502);

  const nowCreated = new Date().toISOString();
  const tasks: Task[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const t = item as Record<string, unknown>;
    const title = typeof t.title === "string" ? t.title.trim() : "";
    if (!title) continue;

    const est = Number(t.estimateMin);
    const estimateMin = Number.isFinite(est) && est > 0 ? Math.round(est) : null;
    const deadline = typeof t.deadline === "string" && t.deadline.trim() ? t.deadline.trim() : null;
    const priority = t.priority === "high" || t.priority === "med" || t.priority === "low" ? t.priority : "med";
    const category = t.category === "work" || t.category === "personal" ? t.category : "work";

    tasks.push({
      id: crypto.randomUUID(),
      title,
      priority,
      category,
      estimateMin,
      deadline,
      status: "inbox",
      createdAt: nowCreated,
    });
  }

  return NextResponse.json(tasks);
}
