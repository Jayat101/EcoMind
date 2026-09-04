import { demoDashboard } from "./demoData.js";
import { buildGoals, evaluateBadges } from "./badges.js";
import { buildMonthlyChallenge } from "./community.js";
import { autoFreezeStreak, getStreak } from "./streak.js";

const STORAGE_KEY = "ecomind-gamification-v1";

const EMISSION_FACTORS = {
  vehicle: {
    walk: 0,
    bicycle: 0,
    bus: 0.089,
    ev: 0.05,
    gasoline_car: 0.192,
    motorbike: 0.103
  },
  diet: {
    none: 0,
    vegan: 2.9,
    vegetarian: 3.8,
    mixed: 5,
    meat_heavy: 7.2
  },
  appliances: {
    none: 0,
    laundry: 1.2,
    water_heater: 1.8,
    both: 3.0
  },
  goods: {
    none: 0,
    general: 3.5,
    clothing: 10.0,
    electronics: 25.0
  }
};

function round(value) {
  return Number(value.toFixed(2));
}

function createEntryId() {
  return `ent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function defaultState() {
  return { localEntries: [], earnedBadges: [], redemptions: [], spentPoints: 0, premiumUntil: null, challengeBonus: 0, challengeClaims: {}, streakFreezes: 0, streakFrozenDays: [], goingOutDays: [] };
}

function readState() {
  if (typeof window === "undefined") {
    return defaultState();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultState();
    }
    const parsed = JSON.parse(raw);
    const localEntries = Array.isArray(parsed.localEntries) ? parsed.localEntries : [];

    let changed = false;
    const nextEntries = localEntries.map((entry, index) => {
      if (!entry.id) {
        changed = true;
        return { ...entry, id: `legacy_${index}_${Date.now().toString(36)}` };
      }
      return entry;
    });

    const nextState = {
      localEntries: nextEntries,
      earnedBadges: Array.isArray(parsed.earnedBadges) ? parsed.earnedBadges : [],
      redemptions: Array.isArray(parsed.redemptions) ? parsed.redemptions : [],
      spentPoints: Number(parsed.spentPoints ?? 0),
      premiumUntil: parsed.premiumUntil ?? null,
      challengeBonus: Number(parsed.challengeBonus ?? 0),
      challengeClaims: parsed.challengeClaims && typeof parsed.challengeClaims === "object" ? parsed.challengeClaims : {},
      streakFreezes: Number(parsed.streakFreezes ?? 0),
      streakFrozenDays: Array.isArray(parsed.streakFrozenDays) ? parsed.streakFrozenDays : [],
      goingOutDays: Array.isArray(parsed.goingOutDays) ? parsed.goingOutDays : []
    };

    if (changed || !Array.isArray(parsed.redemptions) || parsed.challengeBonus === undefined) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    }

    return nextState;
  } catch {
    return defaultState();
  }
}

function writeState(state) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function seedEntries() {
  return [];
}

function calculateEntryFromPayload(payload) {
  const transportEmissions = round(
    Number(payload.transportation?.distanceKm ?? 0) * (EMISSION_FACTORS.vehicle[payload.transportation?.vehicleType] ?? 0)
  );

  const acEmissions = Number(payload.energy?.acHours ?? 0) * 0.75;
  const applianceEmissions = EMISSION_FACTORS.appliances[payload.energy?.heavyAppliance] ?? 0;
  const energyEmissions = round(acEmissions + applianceEmissions);

  const dietEmissions = EMISSION_FACTORS.diet[payload.lifestyle?.dietType] ?? 0;
  const takeoutEmissions = Number(payload.lifestyle?.takeoutMeals ?? 0) * 0.85;
  const goodsEmissions = EMISSION_FACTORS.goods[payload.lifestyle?.newGoodsPurchased] ?? 0;
  const recyclingDiscount = payload.lifestyle?.recycledOrComposted ? -0.5 : 0;
  const lifestyleEmissions = round(Math.max(0, dietEmissions + takeoutEmissions + goodsEmissions + recyclingDiscount));

  const totalEmissionsKg = round(transportEmissions + energyEmissions + lifestyleEmissions);

  return {
    id: payload.id ?? createEntryId(),
    date: payload.date ?? new Date().toISOString().slice(0, 10),
    transportation: {
      vehicleType: payload.transportation?.vehicleType ?? "walk",
      distanceKm: Number(payload.transportation?.distanceKm ?? 0),
      emissionsKg: transportEmissions
    },
    energy: {
      acHours: Number(payload.energy?.acHours ?? 0),
      heavyAppliance: payload.energy?.heavyAppliance ?? "none",
      emissionsKg: energyEmissions
    },
    lifestyle: {
      dietType: payload.lifestyle?.dietType ?? "none",
      takeoutMeals: Number(payload.lifestyle?.takeoutMeals ?? 0),
      newGoodsPurchased: payload.lifestyle?.newGoodsPurchased ?? "none",
      recycledOrComposted: Boolean(payload.lifestyle?.recycledOrComposted),
      emissionsKg: lifestyleEmissions
    },
    totalEmissionsKg,
    source: "local"
  };
}

function calculateStats(entries, weeklyTargetKg) {
  if (!entries || entries.length === 0) {
    return {
      categoryTotals: { transportation: 0, energy: 0, lifestyle: 0 },
      totalEmissionsKg: 0,
      recentWeeklyKg: 0,
      previousWeeklyKg: 0,
      carbonScore: 0,
      improvementPercent: 0
    };
  }

  const totals = entries.reduce(
    (acc, entry) => {
      acc.transportation += entry.transportation.emissionsKg;
      acc.energy += entry.energy.emissionsKg;
      acc.lifestyle += entry.lifestyle.emissionsKg;
      acc.total += entry.totalEmissionsKg;
      return acc;
    },
    { transportation: 0, energy: 0, lifestyle: 0, total: 0 }
  );

  const recentEntries = entries.slice(-7);
  const recentTotal = recentEntries.reduce((sum, entry) => sum + entry.totalEmissionsKg, 0);
  const previousEntries = entries.slice(-14, -7);
  const previousTotal = previousEntries.reduce((sum, entry) => sum + entry.totalEmissionsKg, 0);
  const overage = weeklyTargetKg > 0 ? Math.max(0, recentTotal / weeklyTargetKg - 1) : 0;
  const improvementPercent = previousTotal > 0 ? ((previousTotal - recentTotal) / previousTotal) * 100 : 0;
  const targetProgress = weeklyTargetKg > 0 ? Math.max(0, 1 - recentTotal / weeklyTargetKg) : 0;
  // Normalized behavioral score, anchor-derived
  //  - 55 = baseline: exactly meeting the weekly budget with no trend change
  //  - +35 = credit for full headroom under budget (zero-emission week -> ~90)
  //  - -35 = penalty for full overage over budget (drops below the 55 baseline)
  //  - +0.4 per improvement %-point (a 25% reduction adds 10 pts); clamped to cap
  const carbonScore = Math.min(100, Math.max(1, Math.round(55 + targetProgress * 35 - overage * 35 + Math.max(0, improvementPercent) * 0.4)));

  return {
    categoryTotals: {
      transportation: round(totals.transportation),
      energy: round(totals.energy),
      lifestyle: round(totals.lifestyle)
    },
    totalEmissionsKg: round(totals.total),
    recentWeeklyKg: round(recentTotal),
    previousWeeklyKg: round(previousTotal),
    carbonScore,
    improvementPercent: round(improvementPercent)
  };
}

function buildRecommendations(categoryTotals) {
  const ranked = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a);
  const top = ranked[0]?.[0] ?? "transportation";
  const next = ranked[1]?.[0] ?? "lifestyle";

  const tips = {
    transportation: [
      "Replace one short car trip with walking, cycling, or transit this week.",
      "Combine errands into one route to cut extra kilometers."
    ],
    lifestyle: [
      "Choose one more plant-forward meal this week.",
      "Delay impulse shopping by a day and batch essentials."
    ],
    energy: [
      "Shift a high-energy task out of peak evening hours.",
      "Turn off standby-heavy devices before bed."
    ]
  };

  return [
    { category: top, priority: "High", tips: tips[top] ?? tips.transportation },
    { category: next, priority: "Next", tips: [tips[next]?.[0] ?? tips.lifestyle[0]] }
  ];
}

function buildForecast(entries) {
  const recent = entries.slice(-7);
  const average = recent.length ? recent.reduce((sum, entry) => sum + entry.totalEmissionsKg, 0) / recent.length : 10;
  return Array.from({ length: 7 }, (_, index) => ({
    date: `Aug ${4 + index}`,
    predictedKg: round(Math.max(0, average - index * 0.3 + Math.sin(index) * 0.4)),
    model: "ARIMA/LSTM mock"
  }));
}

function buildTrend(entries) {
  return entries.slice(-7).map((entry) => ({
    date: entry.date,
    totalKg: entry.totalEmissionsKg,
    transportation: entry.transportation.emissionsKg,
    energy: entry.energy.emissionsKg,
    lifestyle: entry.lifestyle.emissionsKg
  }));
}

export function getLocalDashboard() {
  let state = readState();
  const protection = autoFreezeStreak(state.localEntries, {
    streakFreezes: state.streakFreezes,
    streakFrozenDays: state.streakFrozenDays
  });
  if (protection) {
    state = { ...state, ...protection };
    writeState(state);
  }

  const baseEntries = seedEntries();
  const profile = {
    ...demoDashboard.profile,
    badges: [...demoDashboard.badges, ...state.earnedBadges],
    redemptions: state.redemptions,
    premiumUntil: state.premiumUntil,
    challengeClaims: state.challengeClaims,
    streakFreezes: state.streakFreezes,
    streakFrozenDays: state.streakFrozenDays
  };
  const rewardPointsAdded = state.earnedBadges.reduce((sum, badge) => sum + (badge.points ?? 0), 0);
  profile.rewardPoints = demoDashboard.profile.rewardPoints + rewardPointsAdded - state.spentPoints + (state.challengeBonus ?? 0);

  const allEntries = [...baseEntries, ...state.localEntries];
  const stats = calculateStats(allEntries, profile.weeklyEmissionTargetKg);
  const recommendations = buildRecommendations(stats.categoryTotals);
  const trend = buildTrend(allEntries);
  const forecast = buildForecast(allEntries);
  const goals = buildGoals(state.localEntries, state.earnedBadges, stats, profile.weeklyEmissionTargetKg, state.streakFrozenDays ?? []);

  return {
    profile,
    stats,
    trend,
    forecast,
    recommendations,
    badges: profile.badges,
    goals,
    rewardPoints: profile.rewardPoints
  };
}

export function upsertLocalUser(payload) {
  const dashboard = getLocalDashboard();
  return {
    ...dashboard.profile,
    ...payload
  };
}

export function logLocalEntry(payload) {
  const state = readState();
  const entry = calculateEntryFromPayload(payload);
  const localEntries = [...state.localEntries, entry];
  const dashboardBeforeSave = getLocalDashboard();
  const profile = dashboardBeforeSave.profile;
  const baseBadges = [...demoDashboard.badges, ...state.earnedBadges];
  const allEntries = [...seedEntries(), ...localEntries];
  const stats = calculateStats(allEntries, profile.weeklyEmissionTargetKg);
  const newlyEarned = evaluateBadges(localEntries, baseBadges, stats, profile);

  const nextState = {
    localEntries,
    earnedBadges: [...state.earnedBadges, ...newlyEarned]
  };

  writeState(nextState);

  return {
    entry,
    earnedBadges: newlyEarned,
    rewardPoints: demoDashboard.profile.rewardPoints + nextState.earnedBadges.reduce((sum, badge) => sum + (badge.points ?? 0), 0) - (state.spentPoints ?? 0),
    dashboard: getLocalDashboard()
  };
}

export function resetLocalUser() {
  localStorage.removeItem(STORAGE_KEY);
  return getLocalDashboard();
}

export function getLocalEntries() {
  return readState().localEntries;
}

export function updateLocalEntry(payload) {
  const { entryId, ...formPayload } = payload;
  const entry = { ...calculateEntryFromPayload(formPayload), id: entryId };

  const state = readState();
  const localEntries = state.localEntries.map((item) => (item.id === entryId ? entry : item));
  const nextState = { localEntries, earnedBadges: state.earnedBadges };
  writeState(nextState);

  return { entry, dashboard: getLocalDashboard() };
}

export function deleteLocalEntry(entryId) {
  const state = readState();
  const localEntries = state.localEntries.filter((item) => item.id !== entryId);
  const nextState = { ...state, localEntries };
  writeState(nextState);

  return { entryId, entries: localEntries, dashboard: getLocalDashboard() };
}

export function redeemLocalItem(userId, item) {
  const state = readState();
  const profile = getLocalDashboard().profile;

  if (profile.rewardPoints < item.points) {
    throw new Error(`Not enough points. You need ${item.points}, you have ${profile.rewardPoints}.`);
  }

  const redemption = {
    itemId: item.id,
    name: item.name,
    points: item.points,
    type: item.type,
    redeemedAt: new Date().toISOString()
  };

  const nextState = {
    ...state,
    streakFreezes: (state.streakFreezes ?? 0) + (item.id === "streak_freeze" ? 1 : 0),
    redemptions: [...(state.redemptions ?? []), redemption],
    spentPoints: (state.spentPoints ?? 0) + item.points,
    premiumUntil:
      item.type === "premium"
        ? new Date(Date.now() + item.durationDays * 86400000).toISOString()
        : state.premiumUntil ?? null
  };

  writeState(nextState);

  return { redemption, user: getLocalDashboard().profile };
}

export function importLocalActivities(userId, activities) {
  const state = readState();
  const entries = activities.map((activity) => ({
    ...calculateEntryFromPayload({
      date: activity.date,
      transportation: {
        vehicleType: activity.vehicleType ?? "walk",
        distanceKm: Number(activity.distanceKm ?? 0)
      },
      energy: { acHours: 0, heavyAppliance: "none" },
      lifestyle: { dietType: "none", takeoutMeals: 0, newGoodsPurchased: "none", recycledOrComposted: false },
      notes: activity.name ?? "Imported activity"
    }),
    source: "import",
    importedFrom: activity.source ?? "external"
  }));

  const localEntries = [...state.localEntries, ...entries];
  const dashboardBeforeSave = getLocalDashboard();
  const profile = dashboardBeforeSave.profile;
  const baseBadges = [...demoDashboard.badges, ...state.earnedBadges];
  const allEntries = [...seedEntries(), ...localEntries];
  const stats = calculateStats(allEntries, profile.weeklyEmissionTargetKg);
  const newlyEarned = evaluateBadges(localEntries, baseBadges, stats, profile);

  const nextState = {
    localEntries,
    earnedBadges: [...state.earnedBadges, ...newlyEarned]
  };

  writeState(nextState);

  return {
    imported: entries.length,
    totalEmissionsKg: Number(entries.reduce((sum, entry) => sum + entry.totalEmissionsKg, 0).toFixed(2)),
    earnedBadges: newlyEarned,
    rewardPoints:
      demoDashboard.profile.rewardPoints +
      nextState.earnedBadges.reduce((sum, badge) => sum + (badge.points ?? 0), 0) -
      (state.spentPoints ?? 0) +
      (state.challengeBonus ?? 0),
    dashboard: getLocalDashboard()
  };
}

export function getLocalCommunityContext(userId) {
  const state = readState();
  const profile = {
    ...getLocalDashboard().profile,
    challengeClaims: state.challengeClaims ?? {}
  };
  return {
    users: { [userId]: profile },
    entriesByUser: { [userId]: state.localEntries }
  };
}

export function claimLocalChallenge(userId) {
  const state = readState();
  const context = getLocalCommunityContext(userId);
  const challenge = buildMonthlyChallenge(context, userId);

  if (!challenge.completed) {
    throw new Error("Challenge not completed yet. Keep logging low-carbon days.");
  }
  if (challenge.claimed) {
    throw new Error("You already claimed this month's reward.");
  }

  const nextState = {
    ...state,
    challengeBonus: (state.challengeBonus ?? 0) + challenge.rewardPoints,
    challengeClaims: { ...(state.challengeClaims ?? {}), [challenge.monthKey]: true }
  };
  writeState(nextState);

  return {
    challenge: { ...challenge, claimed: true },
    rewardPoints: getLocalDashboard().profile.rewardPoints
  };
}

export function toggleLocalGoingOutDay(userId, dateStr) {
  const state = readState();
  const cleanDate = String(dateStr ?? "").slice(0, 10);
  const goingOutDays = Array.isArray(state.goingOutDays) ? state.goingOutDays : [];
  const exists = goingOutDays.includes(cleanDate);
  const next = exists ? goingOutDays.filter((day) => day !== cleanDate) : [...goingOutDays, cleanDate].sort();
  writeState({ ...state, goingOutDays: next });
  return { goingOutDays: next, added: !exists };
}

export function getLocalCommunityProfile(viewerId, profileId) {
  if (viewerId !== profileId) {
    return null;
  }
  const state = readState();
  const dashboard = getLocalDashboard();
  const profile = dashboard.profile;
  const entries = state.localEntries;
  const distinctDays = [
    ...new Set(entries.map((entry) => String(entry.date ?? "").slice(0, 10)).filter(Boolean))
  ].sort();
  const streak = getStreak(entries, state.streakFrozenDays ?? []);

  return {
    user: {
      userId: profileId,
      name: profile.name,
      city: profile.city,
      picture: profile.picture ?? null,
      rewardPoints: profile.rewardPoints ?? 0,
      weeklyEmissionTargetKg: profile.weeklyEmissionTargetKg ?? 85,
      createdAt: profile.createdAt ?? null
    },
    isSelf: true,
    isFriends: false,
    friendshipStatus: "self",
    stats: {
      currentStreak: streak.currentStreak,
      bestStreak: streak.bestStreak,
      totalDaysLogged: distinctDays.length,
      weeklyKg: round(entries.slice(-7).reduce((sum, entry) => sum + entry.totalEmissionsKg, 0)),
      badgesCount: dashboard.badges.length
    },
    loggedDays: distinctDays.slice(-120),
    goingOutDays: Array.isArray(state.goingOutDays) ? state.goingOutDays : [],
    commonGoingOutDays: [],
    badges: dashboard.badges
  };
}

export function getLocalFriends() {
  return { friends: [], incoming: [], outgoing: [] };
}

export function sendLocalFriendRequest() {
  return { ok: true };
}

export function respondLocalFriendRequest() {
  return { ok: true, accepted: false };
}

export function removeLocalFriend() {
  return { ok: true };
}
