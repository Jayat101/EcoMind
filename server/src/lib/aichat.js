const GEMINI_MODEL = "gemini-3.6-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export const FREE_DAILY_QUESTIONS = 5;
export const PREMIUM_DAILY_QUESTIONS = 10;
export const MAX_QUESTION_CHARS = 500;
export const MAX_HISTORY_TURNS = 6;

function round1(value) {
  return Math.round(Number(value ?? 0) * 10) / 10;
}

export function utcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function dailyQuestionLimit(profile) {
  const premiumUntil = profile?.premiumUntil ?? null;
  const isPremium = Boolean(premiumUntil && new Date(premiumUntil).getTime() > Date.now());
  return isPremium ? PREMIUM_DAILY_QUESTIONS : FREE_DAILY_QUESTIONS;
}

// How many questions the user may still ask today. Pure + unit-testable.
export function questionsRemaining(profile, dateKey = utcDateKey()) {
  const limit = dailyQuestionLimit(profile);
  const usage = profile?.aiChat ?? {};
  const used = usage.date === dateKey ? Number(usage.used ?? 0) : 0;
  return { remaining: Math.max(0, limit - used), limit, used };
}

// Aggregates only — no names, emails, or raw logs leave the server.
// Shared shape with the recommendations engine output.
export function buildChatDigest(entries, stats = {}, profile = {}) {
  const logs = (Array.isArray(entries) ? entries : []).filter((entry) => entry && entry.source !== "seed");
  if (logs.length === 0) return null;

  const dayCount = Math.max(new Set(logs.map((e) => String(e.date ?? "").slice(0, 10)).filter(Boolean)).size, 1);

  let carKm = 0;
  let transitKm = 0;
  let acHours = 0;
  let takeoutMeals = 0;
  let plantDays = 0;
  let goodsIncidents = 0;
  let transportKg = 0;
  let energyKg = 0;
  let lifestyleKg = 0;

  const plantDaySet = new Set();
  logs.forEach((entry) => {
    const day = String(entry.date ?? "").slice(0, 10);
    const t = entry.transportation ?? {};
    const type = t.vehicleType;
    const km = Number(t.distanceKm ?? 0);
    if (type === "gasoline_car" || type === "motorbike") carKm += km;
    if (type === "bus" || type === "ev" || type === "walk" || type === "bicycle") transitKm += km;
    acHours += Number((entry.energy ?? {}).acHours ?? 0);
    takeoutMeals += Number((entry.lifestyle ?? {}).takeoutMeals ?? 0);
    const diet = (entry.lifestyle ?? {}).dietType;
    if ((diet === "vegan" || diet === "vegetarian") && day) plantDaySet.add(day);
    if ((entry.lifestyle ?? {}).newGoodsPurchased && (entry.lifestyle ?? {}).newGoodsPurchased !== "none") {
      goodsIncidents += 1;
    }
    transportKg += Number(t.emissionsKg ?? 0);
    energyKg += Number((entry.energy ?? {}).emissionsKg ?? 0);
    lifestyleKg += Number((entry.lifestyle ?? {}).emissionsKg ?? 0);
  });

  plantDays = plantDaySet.size;
  const totalKg = transportKg + energyKg + lifestyleKg;
  const share = (value) => (totalKg > 0 ? Math.round((value / totalKg) * 100) : 0);

  return {
    daysLogged: dayCount,
    logCount: logs.length,
    totalKg: round1(totalKg),
    avgDailyKg: round1(totalKg / dayCount),
    sharesPct: {
      transportation: share(transportKg),
      energy: share(energyKg),
      lifestyle: share(lifestyleKg)
    },
    carKm: round1(carKm),
    transitKm: round1(transitKm),
    acHoursTotal: round1(acHours),
    takeoutMeals,
    plantDaySharePct: dayCount > 0 ? Math.round((plantDays / dayCount) * 100) : 0,
    goodsIncidents,
    recentWeeklyKg: round1(stats?.recentWeeklyKg ?? 0),
    targetKg: Number(profile?.weeklyEmissionTargetKg ?? 0),
    improvementPercent: round1(stats?.improvementPercent ?? 0)
  };
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((msg) => msg && (msg.role === "user" || msg.role === "coach") && typeof msg.text === "string")
    .slice(-MAX_HISTORY_TURNS)
    .map((msg) => ({ role: msg.role, text: msg.text.slice(0, 600) }));
}

function buildChatRequest(digest, cards, history, question) {
  const systemInstruction = {
    parts: [
      {
        text: [
          "You are EcoMind, a friendly carbon coach inside a footprint-tracking app.",
          "You will receive PRECOMPUTED data about the user — treat every number as fact.",
          "Rules:",
          "- Answer the user's question in plain conversational sentences (2-4 sentences). Never output JSON, never repeat the data block.",
          "- Use ONLY the numbers given. Never invent statistics, comparisons with other people, or new figures.",
          "- Do NOT do math; reuse the provided figures exactly as written.",
          "- If the data cannot answer the question, say so briefly and name the specific log that would fix it.",
          "- Tone: encouraging and concrete, no guilt-tripping."
        ].join("\n")
      }
    ]
  };

  const trimmedCards = (cards ?? []).map((card) => ({ title: card.title, insight: card.insight }));
  const contextText = [
    `USER DATA: ${JSON.stringify(digest)}`,
    `PRECOMPUTED PRIORITY ACTIONS (you may mention these): ${JSON.stringify(trimmedCards)}`
  ].join("\n");

  const turns = [];
  sanitizeHistory(history).forEach((msg) => {
    turns.push({ role: msg.role === "coach" ? "model" : "user", text: msg.text });
  });
  turns.push({ role: "user", text: `QUESTION: ${String(question).slice(0, MAX_QUESTION_CHARS)}` });

  // Gemini requires strict user/model alternation starting with user:
  // fold the data block into the first user turn and merge any doubles.
  if (turns.length > 0 && turns[0].role === "user") {
    turns[0] = { role: "user", text: `${contextText}\n\n${turns[0].text}` };
  } else {
    turns.unshift({ role: "user", text: contextText });
  }
  const contents = [];
  turns.forEach((turn) => {
    const last = contents[contents.length - 1];
    if (last && last.role === turn.role) {
      last.parts[0].text += `\n\n${turn.text}`;
    } else {
      contents.push({ role: turn.role, parts: [{ text: turn.text }] });
    }
  });

  return { systemInstruction, contents };
}

// Sends one grounded question to the LLM. Returns { reply } or { error } —
// never throws, so the endpoint can always degrade gracefully.
export async function askCoach({ digest, cards, history, question, fetchImpl = fetch, timeoutMs = 20000 }) {
  const apiKey = process.env.GEMINI_API_KEY ?? "";
  if (!apiKey) return { error: "unconfigured" };
  if (!digest) return { error: "no-data" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { systemInstruction, contents } = buildChatRequest(digest, cards, history, question);
    const response = await fetchImpl(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction,
        contents,
        // NOTE: gemini-3.x spends several hundred hidden thinking tokens per
        // call, so the cap must leave room for them plus the visible reply.
        generationConfig: { temperature: 0.3, maxOutputTokens: 1200 }
      })
    });
    if (response.status === 429) return { error: "rate-limited" };
    if (!response.ok) return { error: "provider" };
    const data = await response.json();
    const text = (data?.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? "").join("").trim();
    if (!text) return { error: "provider" };
    return { reply: text.slice(0, 2000) };
  } catch {
    return { error: "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}
