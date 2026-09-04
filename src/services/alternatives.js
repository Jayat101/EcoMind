export const MODE_FACTORS = {
  gasoline_car: 0.192,
  motorbike: 0.103,
  bus: 0.089,
  ev: 0.05,
  metro: 0.028,
  carpool: 0.096,
  bicycle: 0,
  walk: 0
};

export const ALTERNATIVE_MODES = [
  {
    id: "walk",
    label: "Walk",
    tagline: "Zero emissions",
    kgPerKm: 0,
    speedKmh: 4.5,
    kcalPerKm: 48,
    costPerKm: 0,
    maxKm: 4
  },
  {
    id: "bicycle",
    label: "Cycle",
    tagline: "Zero emissions",
    kgPerKm: 0,
    speedKmh: 15,
    kcalPerKm: 32,
    costPerKm: 0,
    maxKm: 12
  },
  {
    id: "bus",
    label: "Bus / Transit",
    tagline: "Up to 54% cleaner",
    kgPerKm: 0.089,
    speedKmh: 18,
    kcalPerKm: 0,
    costPerKm: 0.45
  },
  {
    id: "metro",
    label: "Metro / Rail",
    tagline: "Up to 85% cleaner",
    kgPerKm: 0.028,
    speedKmh: 32,
    kcalPerKm: 0,
    costPerKm: 0.55
  },
  {
    id: "ev",
    label: "EV / E-Rickshaw",
    tagline: "Up to 74% cleaner",
    kgPerKm: 0.05,
    speedKmh: 25,
    kcalPerKm: 0,
    costPerKm: 0.6
  },
  {
    id: "carpool",
    label: "Carpool",
    tagline: "Share a ride, halve it",
    kgPerKm: 0.096,
    speedKmh: 26,
    kcalPerKm: 0,
    costPerKm: 0.9
  }
];

function round(value, digits = 1) {
  return Number(value.toFixed(digits));
}

export function suggestAlternatives(distanceKm, fromMode = "gasoline_car") {
  const baselineFactor = MODE_FACTORS[fromMode] ?? MODE_FACTORS.gasoline_car;
  const distance = Math.max(0, Number(distanceKm) || 0);

  const suggestions = ALTERNATIVE_MODES.filter((mode) => mode.id !== fromMode)
    .map((mode) => {
      const savedKg = round(Math.max(0, baselineFactor - mode.kgPerKm) * distance);
      const timeMinutes = distance > 0 ? Math.max(1, Math.round((distance / mode.speedKmh) * 60)) : 0;
      const kcal = round((mode.kcalPerKm ?? 0) * distance, 0);
      const costSaving = round(Math.max(0, (mode.costPerKm > 0 ? 1.6 : 0) - mode.costPerKm) * distance, 1);
      const practical = !mode.maxKm || distance <= mode.maxKm;
      return { ...mode, savedKg, timeMinutes, kcal, costSaving, practical };
    })
    .sort((a, b) => {
      if (a.practical !== b.practical) return a.practical ? -1 : 1;
      if (distance <= 2 && a.practical) {
        const order = { walk: 0, bicycle: 1, bus: 2, metro: 3, ev: 4, carpool: 5 };
        return (order[a.id] ?? 9) - (order[b.id] ?? 9);
      }
      return b.savedKg - a.savedKg;
    });

  return {
    distance,
    baselineFactor,
    baselineKg: round(baselineFactor * distance),
    suggestions,
    best: suggestions[0] ?? null
  };
}
