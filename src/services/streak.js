const DAY_MS = 86400000;

function toLocalKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function shiftKey(key, delta) {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return toLocalKey(d);
}

function dayNumber(date) {
  const d = typeof date === "string" ? new Date(`${date}T00:00:00`) : date;
  return Math.floor(d.getTime() / DAY_MS);
}

export function getStreak(entries = [], frozenDays = []) {
  const uniqueDays = new Set();
  entries.forEach((entry) => {
    if (entry?.date) uniqueDays.add(String(entry.date).slice(0, 10));
  });

  const present = new Set([...uniqueDays].map(dayNumber));
  (Array.isArray(frozenDays) ? frozenDays : []).forEach((day) => present.add(dayNumber(day)));

  const ordered = [...present].sort((a, b) => a - b);
  let bestStreak = 0;
  let run = 0;
  ordered.forEach((d, index) => {
    if (index > 0 && d - ordered[index - 1] === 1) {
      run += 1;
    } else {
      run = 1;
    }
    bestStreak = Math.max(bestStreak, run);
  });

  const today = Math.floor(Date.now() / DAY_MS);
  let cursor = present.has(today) ? today : today - 1;
  let currentStreak = 0;
  while (present.has(cursor)) {
    currentStreak += 1;
    cursor -= 1;
  }

  return { currentStreak, bestStreak, loggedDays: uniqueDays.size };
}

export function autoFreezeStreak(entries = [], { streakFreezes = 0, streakFrozenDays = [] } = {}) {
  const frozen = new Set((Array.isArray(streakFrozenDays) ? streakFrozenDays : []).map((d) => String(d).slice(0, 10)));
  const logged = new Set(entries.map((e) => (e?.date ? String(e.date).slice(0, 10) : null)).filter(Boolean));
  if (logged.size === 0) return null;

  let freezesLeft = Math.max(0, Number(streakFreezes) || 0);
  if (freezesLeft === 0) return null;

  const present = new Set([...logged, ...frozen]);
  const today = toLocalKey(new Date());
  const edge = present.has(today) ? today : shiftKey(today, -1);

  let cursor = edge;
  while (present.has(cursor)) {
    cursor = shiftKey(cursor, -1);
  }

  const gapStart = cursor;
  let gapLen = 0;
  while (!present.has(cursor) && gapLen <= freezesLeft) {
    gapLen += 1;
    cursor = shiftKey(cursor, -1);
  }
  if (gapLen === 0 || gapLen > freezesLeft) return null;

  const added = [];
  let day = gapStart;
  for (let i = 0; i < gapLen; i += 1) {
    if (day >= today) return null;
    frozen.add(day);
    added.push(day);
    day = shiftKey(day, 1);
  }

  return { streakFreezes: freezesLeft - gapLen, streakFrozenDays: [...frozen] };
}

export function buildHeatmap(entries = [], weeks = 12) {
  const totalsByDate = new Map();
  entries.forEach((entry) => {
    if (!entry?.date) return;
    const key = String(entry.date).slice(0, 10);
    totalsByDate.set(key, (totalsByDate.get(key) ?? 0) + Number(entry.totalEmissionsKg ?? 0));
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const gridStart = new Date(today);
  gridStart.setDate(today.getDate() - today.getDay() - (weeks - 1) * 7);

  const cells = [];
  for (let i = 0; i < weeks * 7; i += 1) {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + i);
    const key = toLocalKey(day);
    cells.push({
      date: key,
      emissionsKg: totalsByDate.get(key) ?? 0,
      logged: totalsByDate.has(key),
      isFuture: day.getTime() > today.getTime(),
      isToday: key === toLocalKey(today)
    });
  }

  const weeksData = [];
  for (let w = 0; w < weeks; w += 1) {
    weeksData.push(cells.slice(w * 7, w * 7 + 7));
  }

  return { weeks: weeksData, startDate: toLocalKey(gridStart), endDate: toLocalKey(today) };
}

export function heatLevel(emissionsKg) {
  if (emissionsKg <= 0) return null;
  if (emissionsKg < 5) return "low";
  if (emissionsKg < 10) return "mid";
  if (emissionsKg < 15) return "high";
  return "very-high";
}
