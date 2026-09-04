import { AnimatePresence, motion } from "framer-motion";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Bike, Bus, Car, Footprints, Play, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { computeTripStats } from "../services/tracking.js";

const MODE_ICONS = {
  walk: Footprints,
  bicycle: Bike,
  bus: Bus,
  gasoline_car: Car
};

const riseIn = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1 }
};

function formatDate(ts) {
  return new Date(ts).toLocaleString([], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDuration(sec) {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}m`;
}

function ReplayMap({ points }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!points?.length || !ref.current) return;
    const map = L.map(ref.current).setView([points[0].lat, points[0].lng], 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    L.polyline(
      points.map((p) => [p.lat, p.lng]),
      { color: "#b3552e", weight: 4, opacity: 0.9 }
    ).addTo(map);
    L.circleMarker([points[0].lat, points[0].lng], {
      radius: 6,
      fillColor: "#b3552e",
      color: "#ffffff",
      weight: 2,
      fillOpacity: 1
    }).addTo(map);
    L.circleMarker([points[points.length - 1].lat, points[points.length - 1].lng], {
      radius: 6,
      fillColor: "#0f5132",
      color: "#ffffff",
      weight: 2,
      fillOpacity: 1
    }).addTo(map);
    return () => map.remove();
  }, [points]);

  return <div ref={ref} className="h-52 w-full rounded-2xl border border-black/10 dark:border-white/10" />;
}

export default function TripHistory({ trips = [], onDelete }) {
  const [replayingId, setReplayingId] = useState(null);

  return (
    <motion.section variants={riseIn} className="workspace-card">
      <div className="mb-5">
        <p className="field-label">Tracked Trips</p>
        <h2 className="mt-1 text-2xl font-medium text-black dark:text-white">Your travel history</h2>
        <p className="mt-1 text-sm text-black/45 dark:text-white/50">
          Every trip you tracked with GPS, with the distance you travelled.
        </p>
      </div>

      {trips.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-black/15 text-center p-6 dark:border-white/15">
          <p className="text-sm font-semibold text-black/70 dark:text-white/70">No tracked trips yet</p>
          <p className="mt-1 text-xs text-black/45 dark:text-white/45">
            Use the Live GPS tracker to record your first trip.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {trips.map((trip) => {
            const stats = computeTripStats(trip.points ?? []);
            const Icon = MODE_ICONS[trip.vehicleType] ?? Car;
            const replayOpen = replayingId === trip.id;
            return (
              <motion.article
                key={trip.id}
                layout
                className="rounded-[24px] bg-white p-5 border border-black/5 dark:bg-[#222832] dark:border-white/10"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0f5132]/10 text-[#0f5132] dark:bg-emerald-500/20 dark:text-emerald-400">
                      <Icon size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold capitalize text-black dark:text-white">
                        {(trip.vehicleType ?? "trip").replace("_", " ")}
                      </p>
                      <p className="text-[11px] text-black/45 dark:text-white/45">
                        {formatDate(trip.startTime ?? trip.endTime)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-center">
                      <p className="text-xl font-semibold text-black dark:text-white">{stats.distanceKm}</p>
                      <p className="text-[10px] text-black/45 dark:text-white/45">km</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-semibold text-black dark:text-white">
                        {formatDuration(trip.endTime ? (trip.endTime - (trip.startTime ?? trip.endTime)) / 1000 : stats.durationSec)}
                      </p>
                      <p className="text-[10px] text-black/45 dark:text-white/45">dur</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setReplayingId(replayOpen ? null : trip.id)}
                      title={replayOpen ? "Hide map" : "Replay on map"}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-black/60 transition hover:bg-[#0f5132]/10 hover:text-[#0f5132] dark:bg-white/10 dark:text-white/60 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-400"
                    >
                      <Play size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete?.(trip.id)}
                      title="Delete trip"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-black/60 transition hover:bg-red-50 hover:text-red-600 dark:bg-white/10 dark:text-white/60 dark:hover:bg-red-500/20 dark:hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {replayOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4">
                        <ReplayMap points={trip.points ?? []} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.article>
            );
          })}
        </div>
      )}
    </motion.section>
  );
}