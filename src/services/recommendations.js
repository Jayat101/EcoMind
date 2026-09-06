import { getStreak } from "./streak.js";

function round1(value) {
  return Math.round(Number(value ?? 0) * 10) / 10;
}

function vehicleOf(entry) {
  return (entry.transportation ?? {}).vehicleType;
}

function lifestyleOf(entry) {
  return entry.lifestyle ?? {};
}

// Builds priority actions computed from the user's own logs — every number
// in every card comes from their entries, never from generic advice.
// Returns [] when there is nothing logged yet (callers show an
// explicit "not enough data" state instead of fake tips).
export function buildPersonalRecommendations(entries, stats = {}, profile = {}) {
  const logs = (Array.isArray(entries) ? entries : []).filter((entry) => entry && entry.source !== "seed");
  if (logs.length === 0) return [];

  const dayKeys = logs.map((entry) => String(entry.date ?? "").slice(0, 10)).filter(Boolean);
  const dayCount = Math.max(new Set(dayKeys).size, 1);

  let carKm = 0;
  let carKg = 0;
  let carTrips = 0;
  let transitKm = 0;
  let acHours = 0;
  let takeoutMeals = 0;
  let takeoutKg = 0;
  let goodsKg = 0;
  let goodsIncidents = 0;
  let transportKg = 0;
  let energyKg = 0;
  let lifestyleKg = 0;
  let plantKg = 0;
  let plantEntries = 0;
  let nonPlantKg = 0;
  let nonPlantEntries = 0;

  const byDay = new Map();
  logs.forEach((entry) => {
    const key = String(entry.date ?? "").slice(0, 10) || `undated_${byDay.size}`;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(entry);

    const t = entry.transportation ?? {};
    const km = Number(t.distanceKm ?? 0);
    const ekg = Number((entry.transportation ?? {}).emissionsKg ?? 0);
    transportKg += ekg;
    energyKg += Number((entry.energy ?? {}).emissionsKg ?? 0);
    const lkg = Number((entry.lifestyle ?? {}).emissionsKg ?? 0);
    lifestyleKg += lkg;

    const type = vehicleOf(entry);
    if (type === "gasoline_car" || type === "motorbike") {
      carKm += km;
      carKg += ekg;
      carTrips += 1;
    }
    if (type === "bus" || type === "ev") transitKm += km;
    acHours += Number((entry.energy ?? {}).acHours ?? 0);

    const lifestyle = lifestyleOf(entry);
    const takeout = Number(lifestyle.takeoutMeals ?? 0);
    takeoutMeals += takeout;
    if (takeout > 0) takeoutKg += lkg;
    if (lifestyle.newGoodsPurchased && lifestyle.newGoodsPurchased !== "none") {
      goodsIncidents += 1;
      goodsKg += lkg;
    }
    if (lifestyle.dietType === "vegan" || lifestyle.dietType === "vegetarian") {
      plantKg += lkg;
      plantEntries += 1;
    } else {
      nonPlantKg += lkg;
      nonPlantEntries += 1;
    }
  });

  const dayHas = (fn) => {
    let count = 0;
    byDay.forEach((dayEntries) => {
      if (dayEntries.some(fn)) count += 1;
    });
    return count;
  };
  const walkBikeDays = dayHas((e) => vehicleOf(e) === "walk" || vehicleOf(e) === "bicycle");
  const plantDays = dayHas((e) => {
    const diet = lifestyleOf(e).dietType;
    return diet === "vegan" || diet === "vegetarian";
  });
  const takeoutDays = dayHas((e) => Number(lifestyleOf(e).takeoutMeals ?? 0) > 0);
  const recycleDays = dayHas((e) => lifestyleOf(e).recycledOrComposted);

  const totalKg = transportKg + energyKg + lifestyleKg;
  const share = (value) => (totalKg > 0 ? Math.round((value / totalKg) * 100) : 0);
  const target = Number(profile?.weeklyEmissionTargetKg ?? 0);
  const recentWeeklyKg = Number(stats?.recentWeeklyKg ?? 0);
  const improvement = Number(stats?.improvementPercent ?? 0);
  const streak = getStreak(logs, profile?.streakFrozenDays ?? []);
  const avgAc = logs.length ? acHours / logs.length : 0;
  const avgDailyKg = totalKg / dayCount;

  const cards = [];

  if (carKm > 0) {
    const swapKm = round1(Math.min(carKm, Math.max(carKm / dayCount, 1)));
    const saving = round1(carKg * 0.4);
    cards.push({
      key: "car-lever",
      category: "transportation",
      saving,
      title: "Your car is the biggest lever",
      insight: `Car and bike trips cover ${round1(carKm)} km across ${carTrips} logged ${carTrips === 1 ? "trip" : "trips"} — ${share(carKg)}% of everything you've logged.`,
      tips: [
        `Swap ~${swapKm} km a week to bus or metro to save roughly ${round1(carKg * 0.25)} kg CO₂e.`,
        walkBikeDays > 0
          ? `You already walk or cycle on ${walkBikeDays} ${walkBikeDays === 1 ? "day" : "days"} — extend that habit to one more car trip.`
          : "Start with your shortest regular car trip and walk, cycle, or share it."
      ]
    });
  }

  if (acHours > 0) {
    const rate = acHours > 0 ? energyKg / acHours : 0;
    const saving = round1(rate * Math.max(dayCount, 1) * 0.5);
    cards.push({
      key: "ac-use",
      category: "energy",
      saving,
      title: "Cooling hours add up",
      insight: `AC or heating runs about ${round1(avgAc)} h per logged day, totalling ${round1(acHours)} h.`,
      tips: [
        `One hour less a day saves roughly ${round1(rate * dayCount)} kg CO₂e over ${dayCount} ${dayCount === 1 ? "day" : "days"} at your current rate.`,
        "Pre-cool the room, then switch to fan-only for the last hour before sleep."
      ]
    });
  }

  if (takeoutMeals > 0) {
    const saving = round1(takeoutKg * 0.5);
    cards.push({
      key: "takeout",
      category: "lifestyle",
      saving,
      title: "Takeout is your food lever",
      insight: `${takeoutMeals} takeout ${takeoutMeals === 1 ? "meal" : "meals"} across ${takeoutDays} ${takeoutDays === 1 ? "day" : "days"} (~${round1(takeoutKg)} kg CO₂e).`,
      tips: [
        `Cooking half of those at home saves roughly ${saving} kg CO₂e.`,
        "Keep one go-to 15-minute home meal for busy days."
      ]
    });
  }

  if (plantEntries > 0 && plantDays < dayCount) {
    const plantAvg = plantKg / plantEntries;
    const nonPlantAvg = nonPlantEntries > 0 ? nonPlantKg / nonPlantEntries : plantAvg;
    const gap = Math.max(0, round1(nonPlantAvg - plantAvg));
    const addDays = Math.min(dayCount - plantDays, 2);
    cards.push({
      key: "plant-gap",
      category: "lifestyle",
      saving: round1(gap * addDays),
      title: "More plant days, less footprint",
      insight: `Plant-based on ${plantDays} of ${dayCount} logged ${dayCount === 1 ? "day" : "days"} — those days average ${round1(plantAvg)} kg vs ${round1(nonPlantAvg)} kg otherwise.`,
      tips: [
        addDays > 0 && gap > 0
          ? `Add ${addDays} more plant ${addDays === 1 ? "day" : "days"} to save roughly ${round1(gap * addDays)} kg CO₂e.`
          : "Try two plant-based days and compare your daily average — your logs will show the difference."
      ]
    });
  }

  if (goodsIncidents > 0) {
    const saving = round1(goodsKg * 0.5);
    cards.push({
      key: "shopping",
      category: "lifestyle",
      saving,
      title: "Shopping leaves a mark",
      insight: `${goodsIncidents} logged ${goodsIncidents === 1 ? "purchase" : "purchases"} (~${round1(goodsKg)} kg CO₂e).`,
      tips: [
        "Give non-urgent buys a 24-hour pause — skipped carts save the full amount.",
        "Batch essentials into one order instead of several small ones."
      ]
    });
  }

  if (target > 0 && recentWeeklyKg > 0) {
    const diff = round1(recentWeeklyKg - target);
    cards.push({
      key: "target",
      category: "progress",
      saving: Math.abs(diff),
      title: diff <= 0 ? "Inside your weekly budget" : "Over your weekly budget",
      insight:
        diff <= 0
          ? `${round1(recentWeeklyKg)} kg this week vs your ${target} kg target — ${round1(Math.abs(diff))} kg of headroom.`
          : `${round1(recentWeeklyKg)} kg this week vs your ${target} kg target — ${round1(Math.abs(diff))} kg over.`,
      tips: [
        diff <= 0
          ? "Hold the pattern: repeat your lowest-emission day twice more this week."
          : `Cut ${round1(Math.abs(diff))} kg: your transport share (${share(transportKg)}%) is the fastest place to find it.`
      ]
    });
  }

  if (improvement > 5 || improvement < -5) {
    const recent = logs.slice(-7);
    const previous = logs.slice(-14, -7);
    const sumCat = (list, pick) => list.reduce((sum, e) => sum + Number(pick(e) ?? 0), 0);
    const drivers = [
      { label: "transport", delta: sumCat(recent, (e) => e.transportation?.emissionsKg) - sumCat(previous, (e) => e.transportation?.emissionsKg) },
      { label: "energy", delta: sumCat(recent, (e) => e.energy?.emissionsKg) - sumCat(previous, (e) => e.energy?.emissionsKg) },
      { label: "lifestyle", delta: sumCat(recent, (e) => e.lifestyle?.emissionsKg) - sumCat(previous, (e) => e.lifestyle?.emissionsKg) }
    ].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    const driver = drivers[0] && Math.abs(drivers[0].delta) > 0.05 ? drivers[0].label : null;
    cards.push({
      key: "momentum",
      category: "progress",
      saving: Math.abs(round1(recentWeeklyKg * (improvement / 100))) || 0.5,
      title: improvement > 0 ? "Footprint falling — keep it up" : "Footprint rising — here's the driver",
      insight:
        improvement > 0
          ? `Down ${round1(improvement)}% versus the previous 7 logs${driver ? `, led by ${driver}` : ""} (about ${round1(avgDailyKg)} kg a day).`
          : `Up ${round1(Math.abs(improvement))}% versus the previous 7 logs${driver ? `, driven by ${driver}` : ""}.`,
      tips: [
        improvement > 0
          ? "Protect the win: repeat whatever changed on your best day this week."
          : `Pull ${driver ?? "transport"} back to last week's level to recover roughly ${round1(Math.abs(drivers[0]?.delta ?? 0))} kg.`
      ]
    });
  }

  if (streak.currentStreak >= 2) {
    cards.push({
      key: "streak",
      category: "progress",
      saving: 0.4,
      title: `${streak.currentStreak}-day logging streak`,
      insight: `You've logged ${streak.currentStreak} days in a row — streaks are how the bigger badges unlock.`,
      tips: ["Log today, even a small entry, to extend it."]
    });
  }

  if (transitKm > 0 && carKm === 0) {
    cards.push({
      key: "transit-habit",
      category: "transportation",
      saving: 0.6,
      title: "Clean commute locked in",
      insight: `${round1(transitKm)} km by bus, EV, foot, or bike with no car trips logged — transport is ${share(transportKg)}% of your footprint.`,
      tips: ["Keep the pattern on your longest weekly trip — that's where car-free pays most."]
    });
  }

  if (recycleDays >= 2) {
    cards.push({
      key: "recycle-habit",
      category: "lifestyle",
      saving: 0.3,
      title: "Recycling is becoming routine",
      insight: `Recycled or composted on ${recycleDays} logged ${recycleDays === 1 ? "day" : "days"}.`,
      tips: ["Add food scraps next if you haven't — it's the highest-impact sort."]
    });
  }

  const ranked = cards.filter((card) => card.saving >= 0.1).sort((a, b) => b.saving - a.saving).slice(0, 3);
  const priorities = ["High", "Next", "Steady"];
  return ranked.map((card, index) => ({
    category: card.category,
    priority: priorities[index] ?? "Steady",
    title: card.title,
    insight: card.insight,
    tips: card.tips
  }));
}
