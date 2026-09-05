import { getStreak } from "./streak.js";

export const LOW_CARBON_VEHICLES = new Set(["walk", "bicycle", "bus", "ev"]);
const CAR_VEHICLES = new Set(["gasoline_car", "motorbike"]);

export const BADGE_TIERS = {
  sprout: { code: "sprout", label: "Sprout", blurb: "Easy wins for your first week" },
  green: { code: "green", label: "Green", blurb: "Build the everyday habit" },
  leaf: { code: "leaf", label: "Leaf", blurb: "Committed low-carbon living" },
  forest: { code: "forest", label: "Forest", blurb: "Advanced & disciplined" },
  guardian: { code: "guardian", label: "Guardian", blurb: "Elite lifetime achievements" }
};

const TIER_ORDER = ["sprout", "green", "leaf", "forest", "guardian"];

function isoWeekKey(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day + 3);
  const isoYear = d.getFullYear();
  const firstThursday = new Date(isoYear, 0, 4);
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000) / 7);
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

function todayKey() {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

function buildContext(localEntries, stats, profile) {
  const entries = Array.isArray(localEntries) ? localEntries : [];
  const uniqueDays = new Set();
  const weekTotals = new Map();
  const weekend = new Set([0, 6]);

  let walkBikeDays = 0;
  let transitDays = 0;
  let lowCarbonDays = 0;
  let carDays = 0;
  let carFreeDays = 0;
  let shortCarDays = 0;
  let recycleDays = 0;
  let plantDays = 0;
  let noTakeoutDays = 0;
  let noGoodsDays = 0;
  let lowAcDays = 0;
  let veryLowAcDays = 0;
  let lowCarbonKm = 0;
  let cumulativeKg = 0;
  let anyLowImpactDay = false;

  // Group entries by calendar day so "day" counters reflect real days and
  // can't be farmed with multiple same-day logs. Entries without a date
  // each form their own group. Presence behaviors (walked, recycled…)
  // count a day when ANY entry shows them; absence behaviors (no takeout,
  // no goods, car-free) count only when EVERY entry that day shows them.
  // Cumulative sums (km, kg) still add up per entry.
  const byDay = new Map();
  entries.forEach((entry) => {
    const dateStr = entry.date ? String(entry.date).slice(0, 10) : null;
    const key = dateStr ?? `undated_${byDay.size}`;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(entry);
    if (dateStr) uniqueDays.add(dateStr);

    const t = entry.transportation ?? {};
    if (t.vehicleType === "walk" || t.vehicleType === "bicycle") {
      lowCarbonKm += Number(t.distanceKm ?? 0);
    } else if (t.vehicleType === "bus" || t.vehicleType === "ev") {
      lowCarbonKm += Number(t.distanceKm ?? 0);
    }

    const total = Number(entry.totalEmissionsKg ?? 0);
    cumulativeKg += total;
    if (total > 0 && total <= 10) anyLowImpactDay = true;

    if (dateStr) {
      const key2 = isoWeekKey(dateStr);
      if (key2) weekTotals.set(key2, (weekTotals.get(key2) ?? 0) + total);
    }
  });

  byDay.forEach((dayEntries) => {
    const vehicleOf = (entry) => (entry.transportation ?? {}).vehicleType;
    const lifestyleOf = (entry) => (entry.lifestyle ?? {});
    const acOf = (entry) => Number((entry.energy ?? {}).acHours ?? 0);
    const has = (fn) => dayEntries.some(fn);
    const all = (fn) => dayEntries.every(fn);

    if (has((e) => vehicleOf(e) === "walk" || vehicleOf(e) === "bicycle")) walkBikeDays += 1;
    if (has((e) => vehicleOf(e) === "bus" || vehicleOf(e) === "ev")) transitDays += 1;
    if (has((e) => LOW_CARBON_VEHICLES.has(vehicleOf(e)))) lowCarbonDays += 1;
    if (has((e) => CAR_VEHICLES.has(vehicleOf(e)))) carDays += 1;
    if (
      has(
        (e) =>
          CAR_VEHICLES.has(vehicleOf(e)) &&
          Number((e.transportation ?? {}).distanceKm ?? 0) > 0 &&
          Number((e.transportation ?? {}).distanceKm ?? 0) <= 5
      )
    ) {
      shortCarDays += 1;
    }
    if (all((e) => !CAR_VEHICLES.has(vehicleOf(e)))) carFreeDays += 1;

    if (has((e) => lifestyleOf(e).recycledOrComposted)) recycleDays += 1;
    if (has((e) => lifestyleOf(e).dietType === "vegan" || lifestyleOf(e).dietType === "vegetarian")) plantDays += 1;
    if (all((e) => Number(lifestyleOf(e).takeoutMeals ?? 0) === 0)) noTakeoutDays += 1;
    if (all((e) => lifestyleOf(e).newGoodsPurchased === "none" || Number(lifestyleOf(e).shoppingItems ?? 0) === 0)) {
      noGoodsDays += 1;
    }

    if (has((e) => acOf(e) < 4)) lowAcDays += 1;
    if (has((e) => acOf(e) < 3)) veryLowAcDays += 1;
  });

  const target = Number(profile?.weeklyEmissionTargetKg ?? 0);
  const currentWeek = isoWeekKey(todayKey());
  let weeksUnderTarget = 0;
  weekTotals.forEach((total, key) => {
    if (key !== currentWeek && target > 0 && total <= target) weeksUnderTarget += 1;
  });

  const count = entries.length;
  const avgOf = (list) =>
    list.length ? list.reduce((sum, entry) => sum + Number(entry.totalEmissionsKg ?? 0), 0) / list.length : 0;
  const last7 = entries.slice(-7);
  const last15 = entries.slice(-15);

  return {
    count,
    uniqueDays: uniqueDays.size,
    bestStreak: getStreak(entries, profile?.streakFrozenDays).bestStreak,
    weekendDays: [...uniqueDays].filter((d) => weekend.has(new Date(`${d}T00:00:00`).getDay())).length,
    walkBikeDays,
    transitDays,
    lowCarbonDays,
    carDays,
    carFreeDays,
    shortCarDays,
    recycleDays,
    plantDays,
    noTakeoutDays,
    noGoodsDays,
    lowAcDays,
    veryLowAcDays,
    lowCarbonKm,
    cumulativeKg,
    anyLowImpactDay,
    avgTotalKg: count ? cumulativeKg / count : 0,
    recent7Avg: avgOf(last7),
    recent15Avg: avgOf(last15),
    weeksUnderTarget,
    improvementPercent: Number(stats?.improvementPercent ?? 0),
    recentWeeklyKg: Number(stats?.recentWeeklyKg ?? 0),
    target
  };
}

export const BADGE_RULES = [
  // ---- Sprout (easy, first week) ----
  { tier: "sprout", code: "first_manual_log", label: "First Log", description: "Completed your first EcoMind check-in.", points: 35, isEarned: (c) => c.count >= 1 },
  { tier: "sprout", code: "welcome_walker", label: "Welcome Walker", description: "Logged a day traveling by foot or bike.", points: 30, isEarned: (c) => c.walkBikeDays >= 1 },
  { tier: "sprout", code: "transit_rider", label: "Transit Rider", description: "Took public transit or an EV for a logged trip.", points: 30, isEarned: (c) => c.transitDays >= 1 },
  { tier: "sprout", code: "light_footprint", label: "Light Footprint", description: "Logged a day under 10 kg CO2e.", points: 30, isEarned: (c) => c.anyLowImpactDay },
  { tier: "sprout", code: "mindful_cart", label: "Mindful Cart", description: "Logged a day without buying new retail goods.", points: 25, isEarned: (c) => c.noGoodsDays >= 1 },
  { tier: "sprout", code: "sort_it_out", label: "Sort It Out", description: "Recycled or composted for the first time.", points: 25, isEarned: (c) => c.recycleDays >= 1 },
  { tier: "sprout", code: "green_plate", label: "Green Plate", description: "Logged a plant-based (vegan or vegetarian) day.", points: 30, isEarned: (c) => c.plantDays >= 1 },
  { tier: "sprout", code: "home_cook", label: "Home Cook", description: "Logged a day with zero takeout orders.", points: 25, isEarned: (c) => c.noTakeoutDays >= 1 },
  { tier: "sprout", code: "energy_watcher", label: "Energy Watcher", description: "Logged two days with under 4 hours of AC or heating.", points: 25, isEarned: (c) => c.lowAcDays >= 2 },
  { tier: "sprout", code: "eco_weekend", label: "Eco Weekend", description: "Logged on a Saturday or Sunday.", points: 30, isEarned: (c) => c.weekendDays >= 1 },
  { tier: "sprout", code: "everyday_checkin", label: "Everyday Check-in", description: "Logged on two consecutive days.", points: 40, isEarned: (c) => c.bestStreak >= 2 },
  { tier: "sprout", code: "consistent_three", label: "Consistency 3", description: "Logged activity on three different days.", points: 50, isEarned: (c) => c.uniqueDays >= 3 },
  { tier: "sprout", code: "three_rhythm", label: "Three-Day Rhythm", description: "Built a 3-day logging streak.", points: 60, isEarned: (c) => c.bestStreak >= 3 },
  { tier: "sprout", code: "first_green_mile", label: "First Green Miles", description: "Traveled 5 km by foot, bike, or transit.", points: 25, isEarned: (c) => c.lowCarbonKm >= 5 },
  { tier: "sprout", code: "short_trip", label: "Short & Sweet", description: "Logged a car or motorbike trip under 5 km.", points: 40, isEarned: (c) => c.shortCarDays >= 1 },

  // ---- Green (building the habit) ----
  { tier: "green", code: "five_day_foundation", label: "Five-Day Foundation", description: "Logged on five different days.", points: 90, isEarned: (c) => c.uniqueDays >= 5 },
  { tier: "green", code: "transit_trio", label: "Transit Trio", description: "Used low-carbon transport on three logged days.", points: 95, isEarned: (c) => c.lowCarbonDays >= 3 },
  { tier: "green", code: "commute_shifter", label: "Commute Shifter", description: "Walked or biked on three logged days.", points: 100, isEarned: (c) => c.walkBikeDays >= 3 },
  { tier: "green", code: "recycle_regular", label: "Recycle Regular", description: "Recycled or composted on three days.", points: 100, isEarned: (c) => c.recycleDays >= 3 },
  { tier: "green", code: "plant_powered_week", label: "Plant-Powered Week", description: "Logged plant-based days five times.", points: 105, isEarned: (c) => c.plantDays >= 5 },
  { tier: "green", code: "retail_detox", label: "Retail Detox", description: "Logged five days with no new retail goods.", points: 105, isEarned: (c) => c.noGoodsDays >= 5 },
  { tier: "green", code: "takeout_breaker", label: "Takeout Breaker", description: "Logged five days with zero takeout.", points: 95, isEarned: (c) => c.noTakeoutDays >= 5 },
  { tier: "green", code: "ac_minimizer", label: "AC Minimizer", description: "Logged three days with under 3 hours of AC or heating.", points: 100, isEarned: (c) => c.veryLowAcDays >= 3 },
  { tier: "green", code: "target_keeper", label: "Target Keeper", description: "Kept your recent weekly footprint at or under target for at least a week of logs.", points: 120, isEarned: (c) => c.target > 0 && c.recentWeeklyKg <= c.target && c.count >= 7 },
  { tier: "green", code: "seven_day_streak", label: "7-Day Streak", description: "Logged seven consecutive days.", points: 140, isEarned: (c) => c.bestStreak >= 7 },

  // ---- Leaf (committed) ----
  { tier: "leaf", code: "double_digit_logger", label: "Double-Digit Logger", description: "Logged on ten different days.", points: 160, isEarned: (c) => c.uniqueDays >= 10 },
  { tier: "leaf", code: "fortnight_streak", label: "Fortnight Streak", description: "Logged fourteen consecutive days.", points: 210, isEarned: (c) => c.bestStreak >= 14 },
  { tier: "leaf", code: "transit_ten", label: "Transit Ten", description: "Used low-carbon transport on ten logged days.", points: 190, isEarned: (c) => c.lowCarbonDays >= 10 },
  { tier: "leaf", code: "compost_champion", label: "Compost Champion", description: "Recycled or composted on ten days.", points: 190, isEarned: (c) => c.recycleDays >= 10 },
  { tier: "leaf", code: "green_gourmet", label: "Green Gourmet", description: "Logged plant-based days ten times.", points: 190, isEarned: (c) => c.plantDays >= 10 },
  { tier: "leaf", code: "energy_ninja", label: "Energy Ninja", description: "Logged ten days with under 3 hours of AC or heating.", points: 180, isEarned: (c) => c.veryLowAcDays >= 10 },
  { tier: "leaf", code: "green_hundred", label: "Century of Green Miles", description: "Traveled 100 km by foot, bike, or transit.", points: 200, isEarned: (c) => c.lowCarbonKm >= 100 },
  { tier: "leaf", code: "target_streak", label: "Target Streak", description: "Kept three completed weeks at or under target.", points: 220, isEarned: (c) => c.weeksUnderTarget >= 3 },
  { tier: "leaf", code: "lean_week", label: "Lean Week", description: "Averaged under 8 kg per day over your last seven logs.", points: 170, isEarned: (c) => c.count >= 7 && c.recent7Avg <= 8 },
  { tier: "leaf", code: "zero_shopping_fortnight", label: "Zero-Shopping Fortnight", description: "Logged ten days with no new retail goods.", points: 195, isEarned: (c) => c.noGoodsDays >= 10 },

  // ---- Forest (advanced) ----
  { tier: "forest", code: "thirty_day_veteran", label: "Thirty-Day Veteran", description: "Logged on thirty different days.", points: 270, isEarned: (c) => c.uniqueDays >= 30 },
  { tier: "forest", code: "thirty_day_streak", label: "30-Day Streak", description: "Logged thirty consecutive days.", points: 350, isEarned: (c) => c.bestStreak >= 30 },
  { tier: "forest", code: "transit_master", label: "Transit Master", description: "Used low-carbon transport on twenty-five logged days.", points: 300, isEarned: (c) => c.lowCarbonDays >= 25 },
  { tier: "forest", code: "recycling_hero", label: "Recycling Hero", description: "Recycled or composted on twenty-five days.", points: 300, isEarned: (c) => c.recycleDays >= 25 },
  { tier: "forest", code: "plant_champion", label: "Plant-Powered Champion", description: "Logged plant-based days twenty-five times.", points: 300, isEarned: (c) => c.plantDays >= 25 },
  { tier: "forest", code: "target_guardian", label: "Target Guardian", description: "Kept five completed weeks at or under target.", points: 340, isEarned: (c) => c.weeksUnderTarget >= 5 },
  { tier: "forest", code: "green_marathon", label: "Green Miles Marathon", description: "Traveled 250 km by foot, bike, or transit.", points: 330, isEarned: (c) => c.lowCarbonKm >= 250 },
  { tier: "forest", code: "lean_machine", label: "Lean Machine", description: "Averaged under 6 kg per day over your last fifteen logs.", points: 320, isEarned: (c) => c.count >= 15 && c.recent15Avg <= 6 },
  { tier: "forest", code: "half_it", label: "Half It", description: "Cut your weekly footprint 50% versus the previous week.", points: 350, isEarned: (c) => c.improvementPercent >= 50 },
  { tier: "forest", code: "car_free_month", label: "Car-Free Month", description: "Logged twenty days without a gasoline car or motorbike.", points: 320, isEarned: (c) => c.carFreeDays >= 20 },

  // ---- Guardian (mastery) ----
  { tier: "guardian", code: "eco_veteran", label: "Eco Veteran", description: "Logged on sixty different days.", points: 420, isEarned: (c) => c.uniqueDays >= 60 },
  { tier: "guardian", code: "century_logger", label: "Century Logger", description: "Logged on a hundred different days.", points: 500, isEarned: (c) => c.uniqueDays >= 100 },
  { tier: "guardian", code: "planet_pedaler", label: "Planet Pedaler", description: "Traveled 500 km by foot, bike, or transit.", points: 450, isEarned: (c) => c.lowCarbonKm >= 500 },
  { tier: "guardian", code: "guardian_of_loop", label: "Guardian of the Loop", description: "Recycled or composted on fifty days.", points: 450, isEarned: (c) => c.recycleDays >= 50 },
  { tier: "guardian", code: "carbon_minimalist", label: "Carbon Minimalist", description: "Kept cumulative footprint under 300 kg while logging 60+ days.", points: 500, isEarned: (c) => c.count >= 60 && c.cumulativeKg <= 300 }
];

export function evaluateBadges(localEntries, existingBadges, stats, profile) {
  const context = buildContext(localEntries, stats, profile);
  const existingCodes = new Set(existingBadges.map((badge) => badge.code));

  return BADGE_RULES.filter((rule) => !existingCodes.has(rule.code) && rule.isEarned(context)).map((rule) => ({
    code: rule.code,
    tier: rule.tier,
    label: rule.label,
    description: rule.description,
    points: rule.points,
    earnedAt: new Date().toISOString()
  }));
}

const GOAL_CODES = [
  "consistent_three",
  "five_day_foundation",
  "double_digit_logger",
  "transit_trio",
  "recycle_regular",
  "plant_powered_week",
  "seven_day_streak",
  "target_keeper"
];

export function buildGoals(localEntries, earnedBadges, stats, weeklyTargetKg, frozenDays = []) {
  const ctx = buildContext(localEntries, stats, { weeklyEmissionTargetKg: weeklyTargetKg, streakFrozenDays: frozenDays });
  const earnedCodes = new Set(earnedBadges.map((badge) => badge.code));

  const defs = {
    consistent_three: { title: "Log 3 days", target: 3, progress: () => Math.min(ctx.uniqueDays, 3) },
    five_day_foundation: { title: "Log 5 days", target: 5, progress: () => Math.min(ctx.uniqueDays, 5) },
    double_digit_logger: { title: "Log 10 days", target: 10, progress: () => Math.min(ctx.uniqueDays, 10) },
    transit_trio: { title: "Green transport days", target: 3, progress: () => Math.min(ctx.lowCarbonDays, 3) },
    recycle_regular: { title: "Recycling days", target: 3, progress: () => Math.min(ctx.recycleDays, 3) },
    plant_powered_week: { title: "Plant-based days", target: 5, progress: () => Math.min(ctx.plantDays, 5) },
    seven_day_streak: { title: "Day streak", target: 7, progress: () => Math.min(ctx.bestStreak, 7) },
    target_keeper: {
      title: "Weekly target",
      target: weeklyTargetKg,
      progress: () => {
        if (ctx.count < 7) return 0;
        return Math.max(0, Math.min(weeklyTargetKg, weeklyTargetKg - Math.max(0, ctx.recentWeeklyKg - weeklyTargetKg)));
      }
    }
  };

  return GOAL_CODES.map((code) => {
    const def = defs[code];
    const progress = def.progress();
    return {
      code,
      title: def.title,
      progress,
      target: def.target,
      complete: earnedCodes.has(code) || progress >= def.target
    };
  });
}

export function getBadgeCatalog() {
  return TIER_ORDER.map((tier) => ({
    ...BADGE_TIERS[tier],
    tier,
    badges: BADGE_RULES.filter((rule) => rule.tier === tier)
  }));
}

// ---- Endgame: completion bonus + prestige loop ----
export const TOTAL_BADGE_COUNT = BADGE_RULES.length;
export const COMPLETION_BONUS_POINTS = 1000;
export const COMPLETION_TITLE = "EcoMaster";
export const PRESTIGE_POINT_STEP = 0.25;

export function prestigeMultiplier(level) {
  return 1 + PRESTIGE_POINT_STEP * Math.max(0, Number(level ?? 0));
}

export function prestigeTitle(level) {
  return `EcoMaster ${Math.max(1, Number(level ?? 1))}`;
}

export function canPrestige(profile) {
  return (profile?.badges ?? []).length >= TOTAL_BADGE_COUNT;
}

// Credits newly earned badge points (scaled by the profile's prestige
// multiplier) and awards the one-time completion bonus when the collection
// hits TOTAL_BADGE_COUNT. Returns everything the server needs to persist.
export function applyBadgeEarnings(profile, newlyEarned) {
  const multiplier = prestigeMultiplier(profile?.prestigeLevel);
  const creditedBadges = (newlyEarned ?? []).map((badge) => ({
    ...badge,
    points: Math.round(badge.points * multiplier)
  }));
  const total = (profile?.badges ?? []).length + creditedBadges.length;
  const completionBonus =
    !profile?.allBadgesBonusAwarded && total >= TOTAL_BADGE_COUNT ? COMPLETION_BONUS_POINTS : 0;
  return {
    badges: [...(profile?.badges ?? []), ...creditedBadges],
    rewardPoints:
      (profile?.rewardPoints ?? 0) +
      creditedBadges.reduce((sum, badge) => sum + badge.points, 0) +
      completionBonus,
    allBadgesBonusAwarded: Boolean(profile?.allBadgesBonusAwarded) || completionBonus > 0,
    completionBonus,
    creditedBadges,
    multiplier
  };
}
