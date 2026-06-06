# AI-планер дня

Мобільний AI-планер: вивалюєш потік думок → Claude розкладає його на структуровані
задачі (пріоритет, оцінка часу, дедлайн) → план на сьогодні. Три екрани: **Думки →
Inbox → Сьогодні**.

## Стек

- Next.js (App Router) + TypeScript + Tailwind
- Виклик до Anthropic — лише із серверного роуту `app/api/parse/route.ts` (офіційний `@anthropic-ai/sdk`)
- Збереження задач — `localStorage` (без логіну в MVP)

## Локальний запуск

```bash
npm install
cp .env.local.example .env.local   # встав свій ANTHROPIC_API_KEY
npm run dev
```

## Деплой

Підключений до Vercel. Авто-деплой на `git push` у головну гілку.
Ключ `ANTHROPIC_API_KEY` живе у Vercel → Project Settings → Environment Variables,
а локально — у `.env.local` (у git не потрапляє).
