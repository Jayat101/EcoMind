import { demoDashboard } from "../../../src/services/demoData.js";
import { buildGoals, evaluateBadges } from "../../../src/services/badges.js";
import { fetchClimatiqTransportEmissions } from "./climatiq.js";

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
    mixed: 5.0,
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

export function createEntryId() {
  return `ent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createSeedEntries() {
  return [];
}

export function createDefaultUser(overrides = {}) {
  return {
    userId: demoDashboard.profile.userId,
    name: demoDashboard.profile.name,
    city: demoDashboard.profile.city,
    weeklyEmissionTargetKg: demoDashboard.profile.weeklyEmissionTargetKg,
    rewardPoints: 0,
    badges: [],
    streakFreezes: 0,
    streakFrozenDays: [],
    ...overrides
  };
}

export async function calculateEntryFromPayload(payload) {
  const vehicleType = payload.transportation?.vehicleType ?? "walk";
  const distanceKm = Number(payload.transportation?.distanceKm ?? 0);

  let transportEmissions = null;
  if (process.env.CLIMATIQ_API_KEY) {
    transportEmissions = await fetchClimatiqTransportEmissions(vehicleType, distanceKm);
  }

  if (transportEmissions === null) {
    transportEmissions = round(
      distanceKm * (EMISSION_FACTORS.vehicle[vehicleType] ?? 0)
    );
  } else {
    transportEmissions = round(transportEmissions);
  }

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
      vehicleType,
      distanceKm,
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
    source: "remote",
    calculationEngine: process.env.CLIMATIQ_API_KEY ? "Climatiq API (DEFRA/IPCC)" : "Internal IPCC/DEFRA Engine"
  };
}

export function calculateStats(entries, weeklyTargetKg) {
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
  const improvementPercent = previousTotal > 0 ? ((previousTotal - recentTotal) / previousTotal) * 100 : 0;
  const overage = weeklyTargetKg > 0 ? Math.max(0, recentTotal / weeklyTargetKg - 1) : 0;
  const targetProgress = weeklyTargetKg > 0 ? Math.max(0, 1 - recentTotal / weeklyTargetKg) : 0;
  // Normalized behavioral score, anchor-derived (dot)
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

export function buildRecommendations(categoryTotals) {
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

export function buildForecast(entries) {
  const recent = entries.slice(-7);
  const average = recent.length ? recent.reduce((sum, entry) => sum + entry.totalEmissionsKg, 0) / recent.length : 0;
  return Array.from({ length: 7 }, (_, index) => ({
    date: `Day ${index + 1}`,
    predictedKg: round(Math.max(0, average > 0 ? average - index * 0.3 + Math.sin(index) * 0.4 : 0)),
    model: "ARIMA/LSTM mock"
  }));
}

export function buildTrend(entries) {
  if (!entries || entries.length === 0) {
    return [];
  }
  return entries.slice(-7).map((entry) => ({
    date: entry.date,
    totalKg: entry.totalEmissionsKg,
    transportation: entry.transportation.emissionsKg,
    energy: entry.energy.emissionsKg,
    lifestyle: entry.lifestyle.emissionsKg
  }));
}

export { buildGoals, evaluateBadges };
