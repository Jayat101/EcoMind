export const IMPORT_SOURCES = [
  {
    id: "google_fit",
    label: "Google Fit",
    description: "Steps, walks, runs and cycling sessions",
    icon: "activity",
    color: "#4285F4",
    probability: 0.62,
    kinds: [
      { kind: "walking", weight: 5, range: [1.5, 6], name: ["Morning walk", "Lunchtime stroll", "Evening walk", "Neighborhood walk"] },
      { kind: "running", weight: 3, range: [3, 10], name: ["Morning run", "Evening run", "Park loop"] },
      { kind: "cycling", weight: 2, range: [6, 24], name: ["Cycle to work", "Weekend cycle", "Bike errand"] }
    ]
  }
];


export const KIND_META = {
  walking: { label: "Walk", vehicleType: "walk", emoji: "🚶" },
  running: { label: "Run", vehicleType: "walk", emoji: "🏃" },
  cycling: { label: "Cycle", vehicleType: "bicycle", emoji: "🚴" },
  transit: { label: "Transit", vehicleType: "bus", emoji: "🚌" },
  car: { label: "Car", vehicleType: "gasoline_car", emoji: "🚗" },
  ev: { label: "EV", vehicleType: "ev", emoji: "⚡" },
  motorbike: { label: "Motorbike", vehicleType: "motorbike", emoji: "🏍" }
};

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dateKey(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function pickWeighted(rand, kinds) {
  const total = kinds.reduce((sum, kind) => sum + kind.weight, 0);
  let roll = rand() * total;
  for (const kind of kinds) {
    roll -= kind.weight;
    if (roll <= 0) return kind;
  }
  return kinds[0];
}

function rangeValue(rand, [min, max]) {
  return Number((min + rand() * (max - min)).toFixed(1));
}

export function generateImportActivities(sourceId, days = 14) {
  const source = IMPORT_SOURCES.find((item) => item.id === sourceId) ?? IMPORT_SOURCES[0];
  const rand = mulberry32(hashSeed(`${sourceId}-${days}-community`));
  const activities = [];

  for (let offset = 0; offset < days; offset += 1) {
    const date = dateKey(offset);
    let count = 0;
    if (rand() < source.probability) count = 1;
    if (count === 1 && rand() < 0.28) count = 2;

    for (let i = 0; i < count; i += 1) {
      const kind = pickWeighted(rand, source.kinds);
      const meta = KIND_META[kind.kind];
      const distanceKm = rangeValue(rand, kind.range);
      const names = kind.name;
      const name = names[Math.floor(rand() * names.length)];
      const durationMin = Math.max(5, Math.round((distanceKm / 14) * 60 + rand() * 15));

      activities.push({
        id: `${sourceId}_${date}_${i}`,
        date,
        source: sourceId,
        sourceLabel: source.label,
        kind: kind.kind,
        name: `${name} · ${meta.label}`,
        vehicleType: meta.vehicleType,
        distanceKm,
        durationMin,
        emoji: meta.emoji
      });
    }
  }

  return activities.sort((a, b) => (a.date < b.date ? 1 : -1));
}
