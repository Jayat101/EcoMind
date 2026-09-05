function round(value, digits = 1) {
  return Number(Number(value).toFixed(digits));
}

import { getStreak } from "./streak.js";

export function buildLeaderboard(state, selfUserId = null) {
  const rows = [];

  for (const userId of Object.keys(state?.users ?? {})) {
    const user = state.users[userId] ?? {};
    const entries = state.entriesByUser?.[userId] ?? [];
    const local = entries.filter((entry) => entry.source !== "seed");
    const recent = local.slice(-7);
    const previous = local.slice(-14, -7);
    const weeklyKg = round(recent.reduce((sum, entry) => sum + entry.totalEmissionsKg, 0));
    const prevKg = round(previous.reduce((sum, entry) => sum + entry.totalEmissionsKg, 0));
    const improvementPercent = prevKg > 0 ? round(((prevKg - weeklyKg) / prevKg) * 100) : 0;
    const streak = getStreak(entries, user.streakFrozenDays ?? []).currentStreak;

    rows.push({
      userId,
      name: user.name ?? "EcoMind User",
      city: user.city ?? "New Delhi",
      picture: user.picture ?? null,
      weeklyKg,
      points: user.rewardPoints ?? 0,
      badges: (user.badges ?? []).length,
      entriesLogged: local.length,
      streak,
      improvementPercent,
      isUser: userId === selfUserId
    });
  }

  const ranked = rows
    .sort((a, b) => {
      const aActive = (a.entriesLogged ?? 0) > 0;
      const bActive = (b.entriesLogged ?? 0) > 0;
      if (aActive !== bActive) return aActive ? -1 : 1;
      // More days logged ranks higher (more active user)
      if ((a.entriesLogged ?? 0) !== (b.entriesLogged ?? 0)) {
        return (b.entriesLogged ?? 0) - (a.entriesLogged ?? 0);
      }
      return (a.weeklyKg ?? 0) - (b.weeklyKg ?? 0);
    })
    .map((row, index) => ({ ...row, rank: index + 1 }));

  const withFootprint = ranked.filter((row) => (row.weeklyKg ?? 0) > 0);
  const median = withFootprint.length ? withFootprint[Math.floor(withFootprint.length / 2)].weeklyKg : 0;
  const yourRow = ranked.find((row) => row.isUser);

  return {
    leaderboard: ranked,
    totalParticipants: ranked.length,
    medianWeeklyKg: round(median),
    yourRank: yourRow?.rank ?? null
  };
}

function userCard(state, userId) {
  const user = state?.users?.[userId];
  if (!user) return null;
  const entries = state?.entriesByUser?.[userId] ?? [];
  const local = entries.filter((entry) => entry.source !== "seed");
  return {
    userId,
    name: user.name ?? "EcoMind User",
    city: user.city ?? "New Delhi",
    picture: user.picture ?? null,
    weeklyKg: round(local.slice(-7).reduce((sum, entry) => sum + entry.totalEmissionsKg, 0)),
    badges: (user.badges ?? []).length,
    streak: getStreak(entries, user.streakFrozenDays ?? []).currentStreak
  };
}

export function buildFriends(state, userId) {
  const user = state?.users?.[userId] ?? {};
  const friends = (user.friends ?? []).map((id) => userCard(state, id)).filter(Boolean);
  const incoming = (user.friendRequests ?? [])
    .filter((req) => req.direction === "incoming")
    .map((req) => ({ ...userCard(state, req.userId), requestedAt: req.createdAt }))
    .filter(Boolean);
  const outgoing = (user.friendRequests ?? [])
    .filter((req) => req.direction === "outgoing")
    .map((req) => ({ ...userCard(state, req.userId), requestedAt: req.createdAt }))
    .filter(Boolean);
  return { friends, incoming, outgoing };
}

export function buildCommunityProfile(state, viewerId, profileId) {
  const user = state?.users?.[profileId];
  if (!user) return null;

  const entries = state?.entriesByUser?.[profileId] ?? [];
  const local = entries.filter((entry) => entry.source !== "seed");
  const distinctDays = [
    ...new Set(local.map((entry) => String(entry.date ?? "").slice(0, 10)).filter(Boolean))
  ].sort();
  const streak = getStreak(entries, user.streakFrozenDays ?? []);
  const weeklyKg = round(local.slice(-7).reduce((sum, entry) => sum + entry.totalEmissionsKg, 0));

  const viewer = state?.users?.[viewerId];
  const isSelf = viewerId === profileId;
  const isFriends = (user.friends ?? []).includes(viewerId);

  let friendshipStatus = "none";
  if (isSelf) {
    friendshipStatus = "self";
  } else if (isFriends) {
    friendshipStatus = "friends";
  } else {
    const request = (user.friendRequests ?? []).find((req) => req.userId === viewerId);
    if (request) {
      friendshipStatus = request.direction === "incoming" ? "pending" : "requested";
    }
  }

  const goingOutDays = Array.isArray(user.goingOutDays) ? user.goingOutDays : [];
  const commonGoingOutDays = isFriends
    ? goingOutDays.filter((day) => (viewer?.goingOutDays ?? []).includes(day)).sort()
    : [];
  const fullAccess = isSelf || isFriends;

  return {
    user: {
      userId: user.userId,
      name: user.name ?? "EcoMind User",
      city: user.city ?? "New Delhi",
      picture: user.picture ?? null,
      rewardPoints: user.rewardPoints ?? 0,
      weeklyEmissionTargetKg: user.weeklyEmissionTargetKg ?? 85,
      createdAt: user.createdAt ?? null,
      prestigeLevel: user.prestigeLevel ?? 0,
      titles: user.titles ?? [],
      equippedTitle: user.equippedTitle ?? null
    },
    isSelf,
    isFriends,
    friendshipStatus,
    stats: {
      currentStreak: streak.currentStreak,
      bestStreak: streak.bestStreak,
      totalDaysLogged: distinctDays.length,
      weeklyKg,
      badgesCount: (user.badges ?? []).length
    },
    loggedDays: distinctDays.slice(-120),
    goingOutDays,
    commonGoingOutDays,
    badges: fullAccess ? (user.badges ?? []) : []
  };
}

export function buildMonthlyChallenge(state, userId) {
  const user = state?.users?.[userId] ?? {};
  const entries = state?.entriesByUser?.[userId] ?? [];

  const now = new Date();
  const year = now.getFullYear();
  const monthIndex = now.getMonth();
  const monthKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

  const monthEntries = entries.filter((entry) => (entry.date ?? "").startsWith(monthKey));
  const progressKg = round(monthEntries.reduce((sum, entry) => sum + entry.totalEmissionsKg, 0), 2);

  const weeklyTarget = user.weeklyEmissionTargetKg ?? 85;
  const targetKg = round(weeklyTarget * 4.35, 1);
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const daysLeft = Math.max(0, lastDay - now.getDate());
  const monthLabel = now.toLocaleString("en-US", { month: "long" });

  // Distinct days the user logged this month
  const daysLogged = new Set(
    monthEntries.map((entry) => (entry.date ?? "").slice(0, 10)).filter(Boolean)
  ).size;

  // Account "age": prefer createdAt, otherwise the date of the first logged entry.
  const MIN_ACCOUNT_AGE_DAYS = 30;
  const MIN_DAYS_LOGGED = 20;
  let accountStart = null;
  if (user.createdAt) {
    const t = new Date(user.createdAt).getTime();
    if (!Number.isNaN(t)) accountStart = t;
  }
  if (accountStart === null) {
    const firstDate = entries.map((entry) => entry.date ?? "").filter(Boolean).sort()[0];
    const t = firstDate ? new Date(`${firstDate.slice(0, 10)}T00:00:00`).getTime() : null;
    if (t && !Number.isNaN(t)) accountStart = t;
  }
  const accountAgeDays = accountStart ? Math.max(0, Math.floor((now.getTime() - accountStart) / 86400000)) : 0;

  const underBudget = progressKg <= targetKg;
  const completed = Boolean(
    underBudget && daysLogged >= MIN_DAYS_LOGGED && accountAgeDays >= MIN_ACCOUNT_AGE_DAYS
  );
  const claimed = Boolean(user.challengeClaims?.[monthKey]);
  const pct = monthEntries.length > 0 ? Math.min(100, Math.round((progressKg / targetKg) * 100)) : 0;

  return {
    id: "monthly_target",
    monthKey,
    monthLabel: `${monthLabel} ${year}`,
    title: "Stay under your monthly budget",
    description: `Keep this month's footprint under ${targetKg} kg CO2e, log at least ${MIN_DAYS_LOGGED} days, and have an account at least a month old to claim ${150} points.`,
    targetKg,
    progressKg,
    daysLeft,
    completed,
    claimed,
    rewardPoints: 150,
    totalDaysLogged: monthEntries.length,
    daysLogged,
    minDaysLogged: MIN_DAYS_LOGGED,
    accountAgeDays,
    minAccountAgeDays: MIN_ACCOUNT_AGE_DAYS,
    underBudget,
    progressPct: pct
  };
}
