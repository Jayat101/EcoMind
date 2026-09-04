import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, HeartHandshake, Leaf, LineChart, Target, X } from "lucide-react";

const pillars = [
  {
    icon: BarChart3,
    title: "Measure",
    text: "Log your daily travel, energy, meals, and shopping in under 30 seconds to see your real carbon footprint in kg CO2e."
  },
  {
    icon: LineChart,
    title: "Reduce",
    text: "Compare weekly totals against your personal target ceiling and get AI tips ranked by your highest-impact habits."
  },
  {
    icon: HeartHandshake,
    title: "Sustain",
    text: "Build streaks, earn badges and reward points, and redeem them in the Shop to keep eco habits going long term."
  }
];

export default function AboutMissionModal({ isOpen, onClose }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className="relative w-full max-w-lg overflow-hidden rounded-[32px] bg-[#f7faf5] dark:bg-[#181d24] dark:border dark:border-white/10 p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#0f5132]/10 dark:bg-emerald-500/20 px-3.5 py-1 text-xs font-semibold text-[#0f5132] dark:text-emerald-400">
                <Leaf size={14} />
                Our Mission
              </span>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-black/5 dark:bg-white/10 text-black/60 dark:text-white/70 transition hover:bg-black/10 dark:hover:bg-white/20 hover:text-black dark:hover:text-white"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 text-center">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f5132,#5f8f73)] p-1">
                <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-[#15171b] text-white">
                  <Leaf size={22} />
                </div>
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-black dark:text-white">Our Motto</h2>
              <p className="mt-2 text-base font-medium italic text-[#0f5132] dark:text-emerald-400">
                &ldquo;Measure your footprint. Reduce your impact. Sustain the planet.&rdquo;
              </p>
              <p className="mt-3 text-sm leading-6 text-black/60 dark:text-white/60">
                EcoMind turns confusing emissions data into simple daily actions, so everyone can understand their
                carbon impact and do something about it.
              </p>
            </div>

            <div className="mt-6 grid gap-3">
              {pillars.map((pillar) => (
                <motion.div
                  key={pillar.title}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 }}
                  className="flex items-start gap-3 rounded-2xl border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-[#222832]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0f5132]/10 text-[#0f5132] dark:bg-emerald-500/20 dark:text-emerald-400">
                    <pillar.icon size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-black dark:text-white">{pillar.title}</p>
                    <p className="mt-1 text-xs leading-5 text-black/55 dark:text-white/55">{pillar.text}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between rounded-2xl bg-[#0f5132]/5 px-4 py-3 dark:bg-emerald-500/10">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0f5132] dark:text-emerald-400">
                <Target size={15} />
                Daily log = lower footprint
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0f5132] dark:text-emerald-400">
                <BarChart3 size={15} />
                Score capped at 100
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
