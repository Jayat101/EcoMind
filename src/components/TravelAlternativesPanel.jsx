import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Bike, Bus, Footprints, Minus, Plus, Sparkles, TrainFront, Users, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { suggestAlternatives } from "../services/alternatives.js";

const iconMap = {
  walk: Footprints,
  bicycle: Bike,
  bus: Bus,
  metro: TrainFront,
  ev: Zap,
  carpool: Users
};

const riseIn = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1 }
};

function round(value) {
  return Number(value.toFixed(1));
}

export default function TravelAlternativesPanel({ onUseMode }) {
  const [distance, setDistance] = useState(8);
  const [fromMode, setFromMode] = useState("gasoline_car");

  const result = useMemo(() => suggestAlternatives(distance, fromMode), [distance, fromMode]);
  const maxSaved = Math.max(...result.suggestions.map((s) => s.savedKg), 0.01);

  function adjust(delta) {
    setDistance((current) => Math.max(0, Math.min(60, Math.round(current + delta))));
  }

  return (
    <motion.section variants={riseIn} className="workspace-card">
      <div className="mb-6">
        <p className="field-label">Greener Routes</p>
        <h2 className="mt-1 text-2xl font-medium text-black dark:text-white">Swap your next trip</h2>
        <p className="mt-1 text-sm text-black/45 dark:text-white/50">
          See how much a smarter choice saves compared to the ride you planned.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto] lg:grid-cols-[auto_1fr]">
        <div className="rounded-[24px] bg-[#f7faf5] dark:bg-[#222832] p-5 border border-black/5 dark:border-white/10">
          <p className="field-label">Trip distance</p>
          <div className="mt-3 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => adjust(-1)}
              aria-label="Decrease distance"
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef1ed] dark:bg-[#181d24] text-black dark:text-white transition hover:bg-black hover:text-white dark:hover:bg-emerald-600"
            >
              <Minus size={16} />
            </button>
            <div className="text-center">
              <p className="text-4xl font-medium leading-none text-black dark:text-white">{distance}</p>
              <p className="mt-1 text-xs text-black/45 dark:text-white/45">km</p>
            </div>
            <button
              type="button"
              onClick={() => adjust(1)}
              aria-label="Increase distance"
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef1ed] dark:bg-[#181d24] text-black dark:text-white transition hover:bg-black hover:text-white dark:hover:bg-emerald-600"
            >
              <Plus size={16} />
            </button>
          </div>
          <input
            type="range"
            min="0"
            max="60"
            value={distance}
            onChange={(event) => setDistance(Number(event.target.value))}
            className="mt-4 w-full accent-[#0f5132] dark:accent-emerald-500"
            aria-label="Trip distance slider"
          />
        </div>

        <div className="rounded-[24px] bg-[#f7faf5] dark:bg-[#222832] p-5 border border-black/5 dark:border-white/10">
          <p className="field-label">Instead of</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              { label: "Car", value: "gasoline_car" },
              { label: "Motorbike", value: "motorbike" }
            ].map((option) => {
              const active = fromMode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFromMode(option.value)}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    active
                      ? "bg-[#15171b] text-white shadow-md dark:bg-emerald-600"
                      : "bg-white text-black/64 hover:bg-black/[0.04] dark:bg-[#252c37] dark:text-white/70 dark:hover:bg-white/10"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <div className="mt-5 rounded-2xl bg-white dark:bg-[#181d24] px-4 py-3 border border-black/5 dark:border-white/10">
            <p className="text-xs text-black/45 dark:text-white/45">Your {fromMode === "gasoline_car" ? "car" : "motorbike"} trip would emit</p>
            <p className="mt-0.5 text-2xl font-semibold text-black dark:text-white">
              {result.baselineKg} <span className="text-sm font-normal text-black/45 dark:text-white/45">kg CO2e</span>
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2">
        <Sparkles size={15} className="text-[#0f5132] dark:text-emerald-400" />
        <p className="text-sm font-semibold text-black dark:text-white">Alternatives ranked for this distance</p>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {result.suggestions.map((mode, index) => {
          const Icon = iconMap[mode.id] ?? Footprints;
          const pct = Math.max(4, Math.round((mode.savedKg / maxSaved) * 100));
          const recommended = index === 0 && mode.practical && mode.savedKg > 0;
          return (
            <motion.article
              key={mode.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ y: -4 }}
              className={`relative flex flex-col rounded-[24px] p-5 border transition ${
                recommended
                  ? "bg-[#f7faf5] border-[#0f5132]/40 dark:bg-[#222832] dark:border-emerald-500/40"
                  : "bg-white border-black/5 dark:bg-[#181d24] dark:border-white/10"
              }`}
            >
              {recommended ? (
                <span className="absolute -top-2 right-4 rounded-full bg-[#0f5132] dark:bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                  Best swap
                </span>
              ) : null}
              <div className="flex items-center justify-between gap-2">
                <div className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0f5132]/10 text-[#0f5132] dark:bg-emerald-500/20 dark:text-emerald-400`}>
                  <Icon size={18} />
                </div>
                <span className="text-xs font-semibold text-black/45 dark:text-white/45">{mode.tagline}</span>
              </div>

              <h4 className="mt-3 text-sm font-semibold text-black dark:text-white">{mode.label}</h4>

              <div className="mt-4 flex items-baseline gap-1.5">
                <p className="text-3xl font-semibold leading-none text-black dark:text-white">{mode.savedKg}</p>
                <p className="text-xs text-black/45 dark:text-white/45">kg CO2e saved</p>
              </div>
              <div className="mt-2 h-2 rounded-full bg-black/8 dark:bg-white/10">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ delay: 0.15 + index * 0.05, duration: 0.6, ease: "easeOut" }}
                  className="h-full rounded-full bg-[#0f5132] dark:bg-emerald-500"
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5 text-[11px]">
                <span className="rounded-full bg-black/5 px-2.5 py-1 font-semibold text-black/60 dark:bg-white/10 dark:text-white/60">
                  {mode.timeMinutes > 0 ? `~${mode.timeMinutes} min` : "Instant"}
                </span>
                {mode.kcal > 0 ? (
                  <span className="rounded-full bg-black/5 px-2.5 py-1 font-semibold text-black/60 dark:bg-white/10 dark:text-white/60">
                    {mode.kcal} kcal
                  </span>
                ) : null}
                {mode.costSaving > 0 ? (
                  <span className="rounded-full bg-black/5 px-2.5 py-1 font-semibold text-black/60 dark:bg-white/10 dark:text-white/60">
                    saves ~₹{mode.costSaving}
                  </span>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => onUseMode?.(mode.id, distance)}
                className="mt-4 inline-flex h-9 items-center justify-center gap-1.5 rounded-2xl bg-[#0f5132] text-white transition hover:bg-[#0b3d26] dark:bg-emerald-600 dark:hover:bg-emerald-700"
              >
                Use in Log
                <ArrowRight size={13} />
              </button>
            </motion.article>
          );
        })}
      </div>

      <AnimatePresence>
        {result.best && result.best.savedKg > 0 ? (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 text-sm text-black/45 dark:text-white/45"
          >
            {result.distance > 0
              ? `Switching to ${result.best.label.toLowerCase()} on this trip alone would avoid ${result.best.savedKg} kg CO2e.`
              : "Enter a distance to see your savings."}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </motion.section>
  );
}
