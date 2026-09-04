import { motion } from "framer-motion";
import { ArrowRight, Bike, Bus, Footprints, Sparkles, TrainFront, Users, Zap } from "lucide-react";
import { useMemo } from "react";
import { suggestAlternatives } from "../services/alternatives.js";

const iconMap = {
  walk: Footprints,
  bicycle: Bike,
  bus: Bus,
  metro: TrainFront,
  ev: Zap,
  carpool: Users
};

export default function AlternativeStrip({ distanceKm = 0, vehicleType = "gasoline_car", onUseMode }) {
  const isCarLike = vehicleType === "gasoline_car" || vehicleType === "motorbike";
  const result = useMemo(
    () => (isCarLike && distanceKm > 0 ? suggestAlternatives(distanceKm, vehicleType) : null),
    [isCarLike, distanceKm, vehicleType]
  );

  if (!result) return null;

  const picks = result.suggestions.slice(0, 3);
  const maxSaved = Math.max(...picks.map((s) => s.savedKg), 0.01);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      transition={{ duration: 0.25 }}
      className="overflow-hidden"
    >
      <div className="mt-3 rounded-[24px] bg-[#f7faf5] dark:bg-[#222832] p-4 border border-[#0f5132]/20 dark:border-emerald-500/20">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[#0f5132] dark:text-emerald-400" />
          <p className="text-xs font-semibold text-black dark:text-white">
            Greener swap for a {distanceKm} km {vehicleType === "gasoline_car" ? "car" : "motorbike"} trip
          </p>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {picks.map((mode, index) => {
            const Icon = iconMap[mode.id] ?? Footprints;
            const pct = Math.max(4, Math.round((mode.savedKg / maxSaved) * 100));
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => onUseMode?.(mode.id, distanceKm)}
                className={`group flex items-center gap-3 rounded-2xl p-3 text-left transition ${
                  index === 0
                    ? "bg-[#0f5132]/10 dark:bg-emerald-500/20"
                    : "bg-white dark:bg-[#181d24] hover:bg-black/[0.03] dark:hover:bg-white/5"
                }`}
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${index === 0 ? "bg-[#0f5132] text-white dark:bg-emerald-600" : "bg-[#0f5132]/10 text-[#0f5132] dark:bg-emerald-500/20 dark:text-emerald-400"}`}>
                  <Icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-black dark:text-white">{mode.label}</p>
                  <div className="mt-1 h-1.5 rounded-full bg-black/8 dark:bg-white/10">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.1 + index * 0.05, duration: 0.5 }}
                      className="h-full rounded-full bg-[#0f5132] dark:bg-emerald-500"
                    />
                  </div>
                  <p className="mt-1 text-[10px] font-semibold text-black/55 dark:text-white/55">
                    save {mode.savedKg} kg · {mode.timeMinutes} min
                  </p>
                </div>
                <ArrowRight size={14} className="shrink-0 text-black/30 transition group-hover:translate-x-0.5 group-hover:text-[#0f5132] dark:text-white/30 dark:group-hover:text-emerald-400" />
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
