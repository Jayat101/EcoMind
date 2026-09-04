import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, CheckCircle2, ChevronRight, Clock, DownloadCloud, Leaf, Plus, RotateCcw, Route, ShoppingBag, Sparkles, Users, X } from "lucide-react";
import { useState } from "react";

const steps = [
  {
    badge: "Welcome to EcoMind",
    icon: Leaf,
    title: "Personal Carbon Intelligence",
    subtitle: "Understand, track, and optimize your daily footprint.",
    description:
      "EcoMind calculates carbon emissions across your travel, home energy use, food choices, and shopping habits, providing daily scores and actionable reduction tips.",
    tips: [
      "Track daily transport, AC running time, and meal patterns.",
      "Receive real-time behavior scores from 0 to 100.",
      "Get priority recommendations tailored to your highest impact category."
    ]
  },
  {
    badge: "Logging & Presets",
    icon: Plus,
    title: "Low-Friction Data Check-ins",
    subtitle: "Log your activities in under 30 seconds.",
    description:
      "Use our quick-start presets (like 'Office & Commute' or 'Home Day') or fill in exact kilometers, AC hours, and meals for precise tracking.",
    tips: [
      "Select vehicle type and distance to compute transport CO2e.",
      "Record AC hours and heavy appliances like dryers or water heaters.",
      "Claim a -0.5 kg discount when recycling or composting waste."
    ]
  },
  {
    badge: "AI Insights & Forecasts",
    icon: BarChart3,
    title: "Emission Trends & 7-Day Outlook",
    subtitle: "See where your emissions are heading.",
    description:
      "View your 7-day trend history and predictive emissions forecast to plan low-carbon days ahead.",
    tips: [
      "Compare your weekly total against your target ceiling.",
      "Review high-priority action tips generated automatically.",
      "Track reduction percentages week over week."
    ]
  },
  {
    badge: "Import Your Activity",
    icon: DownloadCloud,
    title: "Sync From Fitness & Ride Apps",
    subtitle: "Pull real sessions straight into your log.",
    description:
      "Connect Google Fit, Strava, Apple Health, or ride-hailing apps and bring recent trips into EcoMind with one click — no manual data entry needed.",
    tips: [
      "Tap a provider, hit Connect, and review what was found.",
      "Imported trips carry their exact vehicle type and distance.",
      "Great for catching up on a week of travel in seconds."
    ]
  },
  {
    badge: "Travel Smarter",
    icon: Route,
    title: "Greener Ways to Get Around",
    subtitle: "Compare your trip against low-carbon options.",
    description:
      "Open the Travel section, enter a route, and see instant CO2 savings across walking, cycling, bus, metro, EV, and carpooling.",
    tips: [
      "See exactly how much carbon each alternative saves.",
      "Try the suggestions on your regular commute.",
      "Log the greener option to boost your score."
    ]
  },
  {
    badge: "Badges, Rewards & Shop",
    icon: ShoppingBag,
    title: "Earn Points, Redeem Perks",
    subtitle: "Turn green habits into rewards.",
    description:
      "Every check-in earns reward points and milestone badges. Redeem your points in the Shop for premium themes, an eco guidebook, carbon-offset certificates, and more.",
    tips: [
      "Check the Rewards tab for badges and streak bonuses.",
      "Redeem points in the Shop once you have enough.",
      "Custom themes apply to your dashboard instantly."
    ]
  },
  {
    badge: "Community & Challenges",
    icon: Users,
    title: "Leaderboards & Monthly Challenge",
    subtitle: "Compete, collaborate, and earn.",
    description:
      "See where you rank on the weekly leaderboard and take on the monthly challenge — log enough low-carbon days to claim a reward.",
    tips: [
      "Your ranking updates as you log entries.",
      "The monthly challenge rewards low-carbon consistency.",
      "Claim your reward the moment you hit 100%."
    ]
  },
  {
    badge: "History, Reports & Account",
    icon: Clock,
    title: "Everything Else, In One Place",
    subtitle: "Review, export, and stay synced.",
    description:
      "Browse every activity you've logged in History and export a report. Sign up with your email (6-digit verification code) or Google to keep your data synced.",
    tips: [
      "History lists every logged activity with its emissions.",
      "Download an export to review or share your progress.",
      "Create an account to save your data across devices."
    ]
  }
];

export default function OnboardingModal({ isOpen, onClose, onResetData, onStartLogging }) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const step = steps[currentStep];
  const Icon = step.icon;
  const isLast = currentStep === steps.length - 1;

  function handleNext() {
    if (isLast) {
      onClose();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  }

  function handlePrev() {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  }

  return (
    <AnimatePresence>
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
          className="relative w-full max-w-xl overflow-hidden rounded-[32px] bg-[#f7faf5] dark:bg-[#181d24] dark:border dark:border-white/10 p-6 shadow-2xl sm:p-8"
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#0f5132]/10 dark:bg-emerald-500/20 px-3.5 py-1 text-xs font-semibold text-[#0f5132] dark:text-emerald-400">
              <Sparkles size={14} />
              {step.badge}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/5 dark:bg-white/10 text-black/60 dark:text-white/70 transition hover:bg-black/10 dark:hover:bg-white/20 hover:text-black dark:hover:text-white"
              aria-label="Close guide"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body Content */}
          <div className="mt-6">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0f5132] dark:bg-emerald-600 text-white shadow-[0_12px_24px_rgba(15,81,50,0.25)]">
              <Icon size={28} />
            </div>

            <h2 className="text-2xl font-semibold tracking-tight text-black dark:text-white sm:text-3xl">
              {step.title}
            </h2>
            <p className="mt-1 text-sm font-medium text-black/55 dark:text-white/60 sm:text-base">
              {step.subtitle}
            </p>

            <p className="mt-4 text-sm leading-relaxed text-black/70 dark:text-white/80 sm:text-base">
              {step.description}
            </p>

            <div className="mt-5 space-y-2.5 rounded-2xl bg-white dark:bg-[#222832] p-4 shadow-[0_8px_20px_rgba(20,22,26,0.04)] dark:shadow-none border border-black/5 dark:border-white/10">
              {step.tips.map((tip) => (
                <div key={tip} className="flex items-start gap-2.5 text-xs text-black/75 dark:text-white/80 sm:text-sm">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#0f5132] dark:text-emerald-400" />
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stepper Dots & Navigation Footer */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-black/8 dark:border-white/10 pt-5">
            {/* Step Dots */}
            <div className="flex gap-2">
              {steps.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setCurrentStep(index)}
                  className={`h-2.5 rounded-full transition-all ${
                    index === currentStep
                      ? "w-8 bg-[#0f5132] dark:bg-emerald-400"
                      : "w-2.5 bg-black/15 dark:bg-white/20 hover:bg-black/30 dark:hover:bg-white/40"
                  }`}
                  aria-label={`Go to step ${index + 1}`}
                />
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {onResetData ? (
                <button
                  type="button"
                  onClick={() => {
                    onResetData();
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-black/15 dark:border-white/15 bg-white dark:bg-[#222832] px-3.5 py-2.5 text-xs font-semibold text-black/70 dark:text-white/80 transition hover:bg-black/5 dark:hover:bg-white/10"
                  title="Clear entries and start completely fresh"
                >
                  <RotateCcw size={14} />
                  Reset to Fresh
                </button>
              ) : null}

              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="rounded-2xl bg-black/5 dark:bg-white/10 px-4 py-2.5 text-sm font-semibold text-black/70 dark:text-white/80 transition hover:bg-black/10 dark:hover:bg-white/20"
                >
                  Back
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (isLast && onStartLogging) {
                    onStartLogging();
                  }
                  handleNext();
                }}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-[#15171b] dark:bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#0f5132] dark:hover:bg-emerald-500"
              >
                {isLast ? "Start App & Log Entry" : "Next"}
                {!isLast && <ChevronRight size={16} />}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
