import { AnimatePresence, motion } from "framer-motion";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Bike,
  Bus,
  Car,
  CheckCircle2,
  Crosshair,
  DownloadCloud,
  Flag,
  Footprints,
  Locate,
  MapPin,
  Pause,
  Play
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { detectVehicleType, localActiveTrip, computeTripStats, segmentSpeedKmh } from "../services/tracking.js";

const MODE_OPTIONS = [
  { id: "walk", label: "Walk", icon: Footprints },
  { id: "bicycle", label: "Cycle", icon: Bike },
  { id: "bus", label: "Bus", icon: Bus },
  { id: "gasoline_car", label: "Car", icon: Car }
];

const riseIn = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1 }
};

const DEFAULT_POSITION = { lat: 28.6139, lng: 77.209 };

function formatDuration(sec) {
  const s = Math.max(0, Math.round(sec ?? 0));
  const m = Math.floor(s / 60);
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}m`;
}

// Animated user-location blip as an inline SVG (no image assets needed).
function buildBlipIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36">
      <defs>
        <style>
          .ring { transform-origin: 18px 18px; animation: blip-ring 1.6s ease-out infinite; }
          @keyframes blip-ring { 0% { r: 14; opacity: 0.5; } 100% { r: 30; opacity: 0; } }
        </style>
      </defs>
      <circle class="ring" cx="18" cy="18" r="14" fill="none" stroke="#0f5132" stroke-width="2"/>
      <circle cx="18" cy="18" r="13" fill="#0f5132" stroke="#ffffff" stroke-width="3"/>
      <circle cx="18" cy="18" r="5" fill="#ffffff"/>
    </svg>`;
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  return L.divIcon({
    html: `<img src="${url}" style="width:36px;height:36px;" alt=""/>`,
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });
}

function MapView({ points, location }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const blipRef = useRef(null);
  const lineRef = useRef(null);

  // Create the Leaflet map once.
  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const initial = location ?? (points.length ? points[0] : null) ?? DEFAULT_POSITION;

    const map = L.map(ref.current, { zoomControl: true }).setView(
      [initial.lat, initial.lng],
      16
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    blipRef.current = L.marker([initial.lat, initial.lng], { icon: buildBlipIcon() })
      .addTo(map)
      .bindTooltip("Your location", { direction: "top", offset: [0, -18] });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      blipRef.current = null;
      lineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update the blip + polyline whenever the live location or points change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (location) {
      blipRef.current?.setLatLng([location.lat, location.lng]);
      map.panTo([location.lat, location.lng], { animate: true });
    }

    lineRef.current?.remove();
    lineRef.current = null;

    if (points.length >= 2) {
      lineRef.current = L.polyline(
        points.map((p) => [p.lat, p.lng]),
        { color: "#0f5132", weight: 4, opacity: 0.9 }
      ).addTo(map);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, points]);

  return (
    <div ref={ref} className="h-72 w-full rounded-2xl border border-black/10 dark:border-white/10" />
  );
}

export default function TripTracker({ userId, onLogged }) {
  const [trip, setTrip] = useState(() => localActiveTrip.get() ?? null);
  const [watchId, setWatchId] = useState(null);
  const [paused, setPaused] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [logStatus, setLogStatus] = useState(""); // "saving" | "done" | "error"
  const [manualMode, setManualMode] = useState("auto");
  const [lastPoint, setLastPoint] = useState(null);
  const [liveLocation, setLiveLocation] = useState(null);
  const watchRef = useRef(null);
  const liveWatchRef = useRef(null);

  // Keep a lightweight live-location watch running so the map blip
  // always shows where the user is, even before a trip is started.
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    liveWatchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setLiveLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => {
        // Non-fatal for just showing a blip; ignore live-location errors.
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
    return () => {
      if (liveWatchRef.current != null) {
        navigator.geolocation.clearWatch(liveWatchRef.current);
        liveWatchRef.current = null;
      }
    };
  }, []);

  const stats = useMemo(() => computeTripStats(trip?.points ?? []), [trip]);
  const liveSpeed = segmentSpeedKmh(
    trip?.points?.[trip.points.length - 2],
    trip?.points?.[trip.points.length - 1]
  );
  const effectiveMode = manualMode !== "auto" ? manualMode : detectVehicleType(stats.avgSpeedKmh);

  function stopWatching() {
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
  }

  function handlePosition(position) {
    const { latitude: lat, longitude: lng } = position.coords;
    const point = { lat, lng, ts: Date.now() };
    setLastPoint(point);
    setTrip((current) => {
      if (!current) return current;
      const next = { ...current, points: [...current.points, point] };
      localActiveTrip.set(next);
      return next;
    });
  }

  function handleError(error) {
    setGeoError(
      error?.message ??
        (error?.code === 1
          ? "Location access was denied. Allow location in your browser to track trips."
          : error?.code === 2
            ? "Location is currently unavailable."
            : "Location request timed out. Please try again.")
    );
    setPaused(true);
    stopWatching();
  }

  function startTrip() {
    setGeoError("");
    setLogStatus("");
    if (!("geolocation" in navigator)) {
      setGeoError("Geolocation is not supported by this browser.");
      return;
    }
    const startTime = Date.now();
    const fresh = {
      id: `trip_${startTime}_${Math.random().toString(36).slice(2, 6)}`,
      userId,
      startTime,
      endTime: null,
      vehicleType: effectiveMode,
      points: [],
      source: "tracked"
    };
    localActiveTrip.set(fresh);
    setTrip(fresh);
    setPaused(false);
    setManualMode("auto");
    watchRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  }

  function pauseTrip() {
    setPaused(true);
    stopWatching();
  }

  function resumeTrip() {
    setPaused(false);
    setGeoError("");
    watchRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  }

  function endTrip() {
    stopWatching();
    setPaused(false);
    if (!trip) return;
    const finalized = {
      ...trip,
      endTime: Date.now(),
      vehicleType: effectiveMode,
      ...stats
    };
    localActiveTrip.set(null);
    setTrip(finalized);
    autoLogToCarbon(finalized);
  }

  async function autoLogToCarbon(finalized) {
    if (!finalized || finalized.distanceKm <= 0) {
      setLogStatus("done");
      return;
    }
    setLogStatus("saving");
    try {
      await onLogged?.(finalized);
      setLogStatus("done");
    } catch {
      setLogStatus("error");
    }
  }

  async function logToCarbon() {
    if (!trip) return;
    setLogStatus("saving");
    try {
      await onLogged?.(trip);
      setLogStatus("done");
    } catch {
      setLogStatus("error");
    }
  }

  const mapCenter = trip?.points?.[0] ?? lastPoint ?? null;

  return (
    <motion.section variants={riseIn} className="workspace-card">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="field-label">Live GPS Tracker</p>
          <h2 className="mt-1 text-2xl font-medium text-black dark:text-white">
            Track your trip distance
          </h2>
          <p className="mt-1 text-sm text-black/45 dark:text-white/50">
            Move around and we measure the real distance you travel.
          </p>
        </div>
      </div>

      <div className="mb-4">
          <MapView points={trip?.points ?? []} location={liveLocation ?? lastPoint ?? mapCenter} />
        </div>

      {geoError && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex items-start gap-2 rounded-2xl bg-red-50 p-3.5 text-xs text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20"
        >
          <Crosshair size={16} className="mt-0.5 shrink-0" />
          <span>{geoError}</span>
        </motion.div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-[24px] bg-[#f7faf5] dark:bg-[#222832] p-5 border border-black/5 dark:border-white/10">
          <p className="field-label">Distance</p>
          <p className="mt-2 text-4xl font-medium leading-none text-black dark:text-white">
            {stats.distanceKm}
          </p>
          <p className="mt-1 text-xs text-black/45 dark:text-white/45">km</p>
        </div>
        <div className="rounded-[24px] bg-[#f7faf5] dark:bg-[#222832] p-5 border border-black/5 dark:border-white/10">
          <p className="field-label">Duration</p>
          <p className="mt-2 text-4xl font-medium leading-none text-black dark:text-white">
            {formatDuration(trip?.endTime && !trip.points.length ? 0 : stats.durationSec)}
          </p>
          <p className="mt-1 text-xs text-black/45 dark:text-white/45">
            {liveSpeed > 0 ? `${liveSpeed.toFixed(1)} km/h now` : "idle"}
          </p>
        </div>
        <div className="rounded-[24px] bg-[#f7faf5] dark:bg-[#222832] p-5 border border-black/5 dark:border-white/10">
          <p className="field-label">Mode</p>
          <div className="mt-2 flex items-center gap-2">
            <p className="text-2xl font-semibold capitalize text-black dark:text-white">
              {effectiveMode.replace("_", " ")}
            </p>
          </div>
          <p className="mt-1 text-xs text-black/45 dark:text-white/45">
            ~{stats.avgSpeedKmh.toFixed(1)} km/h avg
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {MODE_OPTIONS.map((mode) => {
          const Icon = mode.icon;
          const active = effectiveMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => setManualMode(mode.id)}
              disabled={!!trip && !trip.endTime}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-semibold transition disabled:opacity-50 ${
                active
                  ? "bg-[#0f5132] text-white dark:bg-emerald-600"
                  : "bg-white text-black/70 hover:bg-black/5 dark:bg-[#181d24] dark:text-white/70 dark:hover:bg-white/10"
              }`}
            >
              <Icon size={15} />
              {mode.label}
              {active ? <CheckCircle2 size={13} /> : null}
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        {!trip || trip.endTime ? (
          <button
            type="button"
            onClick={startTrip}
            className="executive-button"
          >
            <Play size={16} />
            {trip ? "Start new trip" : "Start tracking"}
          </button>
        ) : paused ? (
          <button
            type="button"
            onClick={resumeTrip}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#0f5132] px-4 text-sm font-semibold text-white transition hover:bg-[#0b3d26] dark:bg-emerald-600 dark:hover:bg-emerald-700"
          >
            <Play size={16} />
            Resume
          </button>
        ) : (
          <button
            type="button"
            onClick={pauseTrip}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#15171b] px-4 text-sm font-semibold text-white transition hover:bg-black dark:bg-white dark:text-black dark:hover:bg-white/80"
          >
            <Pause size={16} />
            Pause
          </button>
        )}

        {trip && !trip.endTime ? (
          <button
            type="button"
            onClick={endTrip}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#0f5132]/40 px-4 text-sm font-semibold text-[#0f5132] transition hover:bg-[#0f5132]/10 dark:border-emerald-500/40 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
          >
            <Flag size={16} />
            End trip
          </button>
        ) : null}

        {trip?.endTime && stats.distanceKm > 0 && logStatus === "error" ? (
          <button
            type="button"
            onClick={logToCarbon}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#0f5132] px-4 text-sm font-semibold text-white transition hover:bg-[#0b3d26] dark:bg-emerald-600 dark:hover:bg-emerald-700"
          >
            <DownloadCloud size={16} />
            Retry log
          </button>
        ) : null}
      </div>

      {paused && trip && !trip.endTime ? (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 flex items-center gap-2 text-xs font-semibold text-black/50 dark:text-white/50"
        >
          <Locate size={14} />
          Tracking paused — resume to keep recording.
        </motion.p>
      ) : null}

      {(trip?.endTime || logStatus) && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 rounded-2xl bg-[#0f5132]/10 dark:bg-emerald-500/20 px-4 py-3 text-xs font-semibold text-[#0f5132] dark:text-emerald-400"
          >
            {trip?.endTime ? (
              <>
                {stats.distanceKm > 0
                  ? "Trip complete — logged to your carbon log and history automatically."
                  : "Trip complete — no movement detected, so nothing was logged."}
              </>
            ) : null}
            {logStatus === "done" ? " Saved to your carbon log and history." : ""}
          </motion.div>
        </AnimatePresence>
      )}

      <p className="mt-5 flex items-center gap-1.5 text-[11px] text-black/40 dark:text-white/40">
        <MapPin size={12} />
        Trip points are stored locally and synced to your account when the server is online.
      </p>
    </motion.section>
  );
}