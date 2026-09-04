// Live GPS trip tracking utilities.
// Pure logic + a localStorage fallback store, mirroring the app's
// remote-first / offline-demo resilience pattern.

const TRIPS_KEY = "ecomind_tracked_trips_v1";
const ACTIVE_KEY = "ecomind_active_trip_v1";

// Earth radius in kilometers
const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two lat/lng points in km (haversine). */
export function haversineKm(a, b) {
  if (!a || !b) return 0;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Cumulative length of a points array in km (skips small jitter). */
export function polylineDistanceKm(points) {
  if (!points || points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineKm(points[i - 1], points[i]);
  }
  return total;
}

/** Filter out points that drift less than minGapMeters from the previous accepted point. */
export function decimatePoints(points, minGapMeters = 8) {
  if (!points || points.length === 0) return [];
  const minGapKm = minGapMeters / 1000;
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    if (haversineKm(out[out.length - 1], points[i]) >= minGapKm) {
      out.push(points[i]);
    }
  }
  return out;
}

/** Distance in km between the last two points' timestamps (for live HUD). */
export function segmentSpeedKmh(prev, curr) {
  if (!prev || !curr) return 0;
  const dist = haversineKm(prev, curr); // km
  const hours = (curr.ts - prev.ts) / 3600000;
  if (hours <= 0) return 0;
  return dist / hours;
}

/**
 * Best-effort transport-mode detection from average speed (km/h).
 * Returns one of the shared vehicleType ids used across the app.
 */
export function detectVehicleType(avgSpeedKmh) {
  const s = avgSpeedKmh;
  if (s > 0 && s < 5) return "walk";
  if (s >= 5 && s < 16) return "bicycle";
  if (s >= 16 && s < 32) return "bus";
  return "gasoline_car";
}

/** Summarize a raw points array into trip statistics. */
export function computeTripStats(points) {
  const cleaned = decimatePoints(points || []);
  const distanceKm = polylineDistanceKm(cleaned);

  let maxSpeedKmh = 0;
  for (let i = 1; i < cleaned.length; i++) {
    maxSpeedKmh = Math.max(maxSpeedKmh, segmentSpeedKmh(cleaned[i - 1], cleaned[i]));
  }

  const durationSec =
    cleaned.length >= 2 ? Math.round((cleaned[cleaned.length - 1].ts - cleaned[0].ts) / 1000) : 0;
  const durationHours = durationSec / 3600;
  const avgSpeedKmh = durationHours > 0 ? distanceKm / durationHours : 0;

  return {
    distanceKm: Number(distanceKm.toFixed(2)),
    durationSec,
    avgSpeedKmh: Number(avgSpeedKmh.toFixed(1)),
    maxSpeedKmh: Number(maxSpeedKmh.toFixed(1))
  };
}

function readTrips() {
  try {
    const raw = localStorage.getItem(TRIPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeTrips(trips) {
  try {
    localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
  } catch {
    // storage may be unavailable / full — fail silently
  }
}

/** Local (offline) trip store, persisted per user id. */
export const localTrips = {
  get(userId) {
    const all = readTrips();
    return (all[userId] ?? []).map((trip) => ({ ...trip }));
  },
  append(userId, trip) {
    const all = readTrips();
    all[userId] = all[userId] ?? [];
    all[userId].unshift(trip);
    writeTrips(all);
    return trip;
  },
  remove(userId, tripId) {
    const all = readTrips();
    if (!all[userId]) return;
    all[userId] = all[userId].filter((trip) => trip.id !== tripId);
    writeTrips(all);
  }
};

/** Local active-trip persistence so a refresh can resume a live session. */
export const localActiveTrip = {
  get() {
    try {
      const raw = localStorage.getItem(ACTIVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  set(trip) {
    try {
      if (trip) localStorage.setItem(ACTIVE_KEY, JSON.stringify(trip));
      else localStorage.removeItem(ACTIVE_KEY);
    } catch {
      // ignore
    }
  }
};