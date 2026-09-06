import { AnimatePresence, motion } from "framer-motion";
import { Award, BarChart3, BookOpen, Bot, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Clock, Download, DownloadCloud, HelpCircle, Leaf, Loader2, Lock, LogIn, LogOut, Map as MapIcon, Palette, Plus, RotateCcw, Send, ShoppingBag, Snowflake, Sparkles, Star, Trophy, UserCheck, Users } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";

import ActivityHistory from "./components/ActivityHistory.jsx";
import AboutMissionModal from "./components/AboutMissionModal.jsx";
import AuthModal from "./components/AuthModal.jsx";
import DataEntryForm from "./components/DataEntryForm.jsx";
import EditProfileModal from "./components/EditProfileModal.jsx";
import LandingPage from "./components/LandingPage.jsx";
import OnboardingModal from "./components/OnboardingModal.jsx";
import ThemeToggle from "./components/ThemeToggle.jsx";
import { usePremiumTheme } from "./hooks/usePremiumTheme.js";
import { fetchDashboard, fetchEntries, resetUser, upsertUser, fetchUser, deleteCarbonEntry, redeemItem, prestigeUser, equipTitle, sendChatMessage, handleGoogleFitCallback, getTrackedTrips, saveTrackedTrip, deleteTrackedTrip, logTrackedTripToCarbon } from "./services/api.js";


const TravelAlternativesPanel = lazy(() => import("./components/TravelAlternativesPanel.jsx"));
const CommunityPanel = lazy(() => import("./components/CommunityPanel.jsx"));
const ImportPanel = lazy(() => import("./components/ImportPanel.jsx"));
const TripTracker = lazy(() => import("./components/TripTracker.jsx"));
const TripHistory = lazy(() => import("./components/TripHistory.jsx"));
import { getBadgeCatalog, prestigeMultiplier, prestigeTitle, TOTAL_BADGE_COUNT } from "./services/badges.js";
import { demoDashboard } from "./services/demoData.js";
import { downloadItemPdf } from "./services/pdf.js";
import { findShopItem, SHOP_ITEMS } from "./services/shop.js";

const DEMO_USER = {
  userId: "demo-user",
  name: "Aarav Mehta",
  city: "New Delhi",
  weeklyEmissionTargetKg: 85
};

const sections = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "log", label: "Log", icon: ClipboardList },
  { id: "history", label: "History", icon: Clock },
  { id: "insights", label: "Insights", icon: Bot },
  { id: "travel", label: "Travel", icon: MapIcon },
  { id: "rewards", label: "Rewards", icon: Trophy },
  { id: "shop", label: "Shop", icon: ShoppingBag },
  { id: "community", label: "Community", icon: Users },
  { id: "import", label: "Import", icon: DownloadCloud }
];

const sectionMeta = {
  overview: {
    title: "Managing Your Carbon",
    subtitle: "A focused view of score, weekly footprint, trend, and priority actions."
  },
  log: {
    title: "Log Daily Activity",
    subtitle: "Capture transportation and lifestyle activity in a quick, low-friction flow."
  },
  history: {
    title: "Activity History",
    subtitle: "Review all your recorded daily check-ins, travel details, energy usage, and food habits."
  },
  insights: {
    title: "AI Carbon Insights",
    subtitle: "Review recommendations and the seven-day emissions outlook."
  },
  travel: {
    title: "Greener Travel",
    subtitle: "Compare ride options side-by-side and see exactly how much CO2 a smarter choice avoids."
  },
  rewards: {
    title: "Rewards and Progress",
    subtitle: "Track badges, points, and progress toward lower-emission habits."
  },
  shop: {
    title: "Rewards Shop",
    subtitle: "Spend your engagement points on perks, premium insights, and impact actions."
  },
  community: {
    title: "Community",
    subtitle: "See how you rank this week and take on the monthly low-carbon challenge."
  },
  import: {
    title: "Import Activity",
    subtitle: "Sync sessions from Google Fit directly into your carbon log."
  }

};

const stagger = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.07
    }
  }
};

const riseIn = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1 }
};

function SectionLoader() {
  return (
    <div className="workspace-card flex h-64 items-center justify-center">
      <Loader2 size={22} className="animate-spin text-black/30 dark:text-white/30" />
    </div>
  );
}

function CapsuleMeter({ filled = 5, total = 8, tone = "dark" }) {
  return (
    <div className="mt-5 flex gap-1.5">
      {Array.from({ length: total }, (_, index) => {
        const active = index < filled;
        return (
          <motion.span
            key={index}
            initial={{ height: 12, opacity: 0 }}
            animate={{ height: 48, opacity: 1 }}
            transition={{ delay: index * 0.04, type: "spring", stiffness: 260, damping: 22 }}
            className={`w-6 rounded-full border border-dashed ${
              tone === "light"
                ? active
                  ? "border-white/80 bg-white"
                  : "border-white/35 bg-transparent"
                : active
                  ? "border-black/20 bg-[#15171b] dark:border-white/25 dark:bg-white"
                  : "border-black/20 bg-transparent dark:border-white/25"
            }`}
          />
        );
      })}
    </div>
  );
}

function StatTile({ title, value, unit, progress, accent = "white", helper }) {
  const forest = accent === "forest";

  return (
    <motion.article
      variants={riseIn}
      whileHover={{ y: -5 }}
      className={`rounded-[28px] p-6 shadow-[0_18px_42px_rgba(20,22,26,0.07)] ${
        forest ? "bg-[#0f5132] text-white" : "bg-[#f7faf5] dark:bg-[#222832] dark:shadow-none"
      }`}
    >
      <p className={`font-semibold ${forest ? "text-white" : "text-black dark:text-white"}`}>{title}</p>
      <div className="mt-8 flex items-end gap-2">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={`text-5xl font-bold leading-none ${forest ? "text-white" : "text-black dark:text-white"}`}
        >
          {value}
        </motion.p>
        <p className={`pb-1 text-sm ${forest ? "text-white/70" : "text-black/45 dark:text-white/45"}`}>{unit}</p>
      </div>
      <div className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${forest ? "bg-white/15 text-white" : "bg-white/80 text-black dark:bg-white/15 dark:text-white"}`}>
        {progress}% target
      </div>
      <CapsuleMeter filled={Math.max(0, Math.round((progress / 100) * 8))} tone={forest ? "light" : "dark"} />
      <p className={`mt-4 text-sm ${forest ? "text-white/70" : "text-black/50 dark:text-white/50"}`}>{helper}</p>
    </motion.article>
  );
}

function StatisticsPanel({ trend = [] }) {
  const chartData = trend.length ? trend.slice(-7) : [];
  const max = chartData.length ? Math.max(...chartData.map((item) => item.totalKg), 1) : 1;
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // Compute SVG smooth curve path points
  const points = chartData.map((item, index) => {
    const x = (index + 0.5) * (100 / Math.max(chartData.length, 1));
    const normalized = Math.max(0.1, item.totalKg / max);
    const y = 100 - normalized * 70; // Map to 0-100 viewBox space
    return { x, y, kg: item.totalKg };
  });

  const pathD = points.reduce((acc, point, index, array) => {
    if (index === 0) return `M ${point.x},${point.y}`;
    const prev = array[index - 1];
    const cp1x = prev.x + (point.x - prev.x) / 2;
    const cp1y = prev.y;
    const cp2x = prev.x + (point.x - prev.x) / 2;
    const cp2y = point.y;
    return `${acc} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${point.x},${point.y}`;
  }, "");

  const areaD = points.length
    ? `${pathD} L ${points[points.length - 1].x},100 L ${points[0].x},100 Z`
    : "";

  return (
    <motion.section variants={riseIn} className="relative rounded-[28px] bg-[#e8eee8] p-6 shadow-[0_18px_42px_rgba(20,22,26,0.06)] overflow-hidden dark:bg-[#181d24] dark:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="field-label">Statistics</p>
          <h2 className="mt-1 text-2xl font-medium text-black dark:text-white">Emission trend</h2>
        </div>
        <div className="flex items-center gap-4 text-sm text-black/70 font-medium dark:text-white/70">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#15171b] dark:bg-white" />
            Emissions
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#0f5132]" />
            Savings
          </span>
        </div>
      </div>

      {chartData.length > 0 ? (
        <div className="relative mt-8 border-t border-black/5 pt-8 dark:border-white/10">
          {/* Smooth SVG Trend Line Overlay */}
          <div className="absolute inset-x-0 top-8 bottom-10 pointer-events-none z-10 px-2 sm:px-4">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
              <defs>
                <linearGradient id="trendAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0f5132" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#0f5132" stopOpacity="0" />
                </linearGradient>
              </defs>
              <motion.path
                d={areaD}
                fill="url(#trendAreaGradient)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8 }}
              />
              <motion.path
                d={pathD}
                fill="none"
                stroke="#0f5132"
                strokeWidth="2"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.2, ease: "easeInOut" }}
              />
            </svg>
          </div>

          <div className="grid h-64 grid-cols-7 items-end gap-2 sm:gap-4 relative z-20">
            {chartData.map((item, index) => {
              const isHovered = hoveredIndex === index;
              const height = Math.max(28, (item.totalKg / max) * 185);
              const savingsKg = Number((item.totalKg * (0.35 + (index % 3) * 0.1)).toFixed(1));
              const savingsHeight = Math.max(18, height * (0.35 + (index % 3) * 0.1));

              return (
                <div
                  key={`${item.date}-${index}`}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className="group relative flex h-full flex-col items-center justify-end gap-3 cursor-pointer"
                >
                  {/* Floating Hover Tooltip */}
                  <AnimatePresence>
                    {isHovered && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.9 }}
                        className="absolute bottom-[calc(100%+8px)] z-30 flex flex-col items-center pointer-events-none"
                      >
                        <div className="rounded-2xl bg-[#15171b] px-3.5 py-2 text-white shadow-xl text-center border border-white/10 whitespace-nowrap">
                          <p className="text-[11px] font-medium opacity-60">{item.date}</p>
                          <p className="text-sm font-bold text-emerald-400">{item.totalKg} kg CO2e</p>
                          <p className="text-[10px] text-white/70">{savingsKg} kg saved</p>
                        </div>
                        <div className="h-1.5 w-1.5 rotate-45 bg-[#15171b] -mt-1" />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Animated Bar Column */}
                  <div className="relative flex h-[190px] w-8 sm:w-10 items-end justify-center">
                    {/* Background Pillar Highlight */}
                    <div
                      className={`absolute inset-0 rounded-full transition-all duration-300 ${
                        isHovered ? "bg-black/5 scale-110 dark:bg-white/10" : "bg-transparent"
                      }`}
                    />

                    {/* Emission Base Bar */}
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height }}
                      transition={{
                        type: "spring",
                        stiffness: 140,
                        damping: 16,
                        delay: index * 0.06
                      }}
                      className={`absolute bottom-0 w-8 sm:w-10 rounded-full transition-all duration-300 ${
                        isHovered ? "bg-black shadow-lg scale-x-105 dark:bg-white" : "bg-[#15171b] dark:bg-white/90"
                      }`}
                    />

                    {/* Savings Overlay Bar */}
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: savingsHeight }}
                      transition={{
                        type: "spring",
                        stiffness: 140,
                        damping: 16,
                        delay: 0.15 + index * 0.06
                      }}
                      className={`absolute bottom-0 w-8 sm:w-10 rounded-full transition-all duration-300 ${
                        isHovered ? "bg-[#0b3d26] shadow-md dark:bg-emerald-400" : "bg-[#0f5132] dark:bg-emerald-500"
                      }`}
                    />

                    {/* Peak Glowing Indicator Dot */}
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.4 + index * 0.05 }}
                      className={`absolute top-2.5 h-3 w-3 rounded-full border-2 transition-all duration-300 ${
                        isHovered ? "bg-emerald-400 scale-125 shadow-[0_0_12px_rgba(52,211,153,0.9)]" : "bg-white dark:bg-[#181d24] dark:border-white/60"
                      }`}
                    />
                  </div>

                  <p
                    className={`text-xs font-semibold transition-colors duration-200 ${
                      isHovered ? "text-[#0f5132] font-bold scale-110 dark:text-emerald-400" : "text-black/50 dark:text-white/50"
                    }`}
                  >
                    {item.date}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-8 flex h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-black/15 text-center p-6 dark:border-white/15">
          <p className="text-[#0f5132] font-semibold text-base dark:text-emerald-400">Fresh start — No trend data yet</p>
          <p className="mt-1 text-sm text-black/50 dark:text-white/50">Log your first daily entry to generate your emission trend chart.</p>
        </div>
      )}
    </motion.section>
  );
}

function Recommendations({ recommendations = [], onAction }) {
  const hasData = recommendations.length > 0;
  return (
    <motion.section variants={riseIn} className="workspace-card">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="field-label">AI Recommendations</p>
          <h2 className="mt-1 text-2xl font-medium text-black dark:text-white">Priority actions</h2>
        </div>
        <span className={`rounded-full px-3.5 py-1 text-xs font-semibold text-white shadow-sm ${hasData ? "bg-[#0f5132] dark:bg-emerald-600" : "bg-black/30 dark:bg-white/20"}`}>
          {hasData ? "Live" : "Waiting for data"}
        </span>
      </div>
      {hasData ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {recommendations.map((item) => (
            <article key={`${item.category}-${item.priority}-${item.title ?? ""}`} className="rounded-[24px] bg-white p-5 border border-black/5 dark:bg-[#222832] dark:border-white/10">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="font-semibold text-black dark:text-white">{item.title ?? item.category}</h3>
                <span className="shrink-0 rounded-full bg-[#15171b] px-3 py-1 text-xs font-semibold text-white dark:bg-emerald-600">{item.priority}</span>
              </div>
              {item.insight ? (
                <p className="mb-3 text-xs leading-5 text-[#0f5132] dark:text-emerald-400">{item.insight}</p>
              ) : null}
              <ul className="space-y-2 text-sm text-black/55 dark:text-white/60">
                {item.tips.map((tip) => (
                  <li key={tip} className="flex gap-2">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#0f5132]" />
                    {tip}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-[24px] border border-dashed border-black/15 p-6 text-center dark:border-white/15">
          <Sparkles size={20} className="text-[#0f5132] dark:text-emerald-400" />
          <p className="mt-2 text-sm font-semibold text-black dark:text-white">Not enough data yet</p>
          <p className="mt-1 max-w-sm text-xs leading-5 text-black/50 dark:text-white/50">
            Recommendations are built from your own logs — nothing generic. Log your first days of activity and your personal plan appears here.
          </p>
          {onAction ? (
            <button
              type="button"
              onClick={onAction}
              className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-2xl bg-[#15171b] px-5 text-xs font-semibold text-white transition hover:bg-black active:scale-95 dark:bg-emerald-600 dark:hover:bg-emerald-700"
            >
              <Plus size={14} />
              Log your first entry
            </button>
          ) : null}
        </div>
      )}
    </motion.section>
  );
}

function ForecastPanel({ forecast = [] }) {
  const data = forecast.length ? forecast : [];
  const max = data.length ? Math.max(...data.map((item) => item.predictedKg), 1) : 1;

  return (
    <motion.section variants={riseIn} className="workspace-card">
      <div className="mb-6">
        <p className="field-label">Forecast</p>
        <h2 className="mt-1 text-2xl font-medium text-black dark:text-white">Next seven days</h2>
      </div>
      {data.length > 0 && Math.max(...data.map((item) => item.predictedKg)) > 0 ? (
        <div className="grid grid-cols-7 items-end gap-3">
          {data.map((item, index) => (
            <div key={`${item.date}-${index}`} className="flex flex-col items-center gap-3">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: Math.max(22, (item.predictedKg / max) * 170) }}
                transition={{ delay: index * 0.06, duration: 0.7, ease: "easeOut" }}
                className="w-full rounded-full bg-[#15171b] dark:bg-white/90"
              />
              <p className="text-center text-[11px] text-black/45 font-medium dark:text-white/45">{item.date}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-black/15 p-4 text-center dark:border-white/15">
          <p className="text-sm font-semibold text-black/70 dark:text-white/70">Forecast ready for new entries</p>
          <p className="mt-1 text-xs text-black/45 dark:text-white/45">Forecast models populate as you log daily activities.</p>
        </div>
      )}
    </motion.section>
  );
}

function ChatPanel({ userId, isPremium, dailyLimit }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [remaining, setRemaining] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, busy]);

  const left = remaining ?? dailyLimit;

  async function send(question) {
    const clean = String(question ?? "").trim().slice(0, 500);
    if (!clean || busy || !userId) return;
    setNotice("");
    const next = [...messages, { role: "user", text: clean }];
    setMessages(next);
    setDraft("");
    setBusy(true);
    try {
      const history = next.slice(-7, -1).map((msg) => ({ role: msg.role, text: msg.text }));
      const res = await sendChatMessage(userId, clean, history);
      setMessages((current) => [...current, { role: "coach", text: res.reply }]);
      if (typeof res?.remaining === "number") setRemaining(res.remaining);
    } catch (err) {
      if (err?.status === 429) {
        setNotice(err.message ?? "Daily question limit reached.");
        if (typeof err?.remaining === "number") setRemaining(err.remaining);
      } else {
        setMessages((current) => [
          ...current,
          { role: "coach", text: err?.message ?? "The AI coach is unavailable right now.", failed: true }
        ]);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.section variants={riseIn} className="workspace-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#0f5132]/10 text-[#0f5132] dark:bg-emerald-500/20 dark:text-emerald-400">
            <Bot size={17} />
          </span>
          <div>
            <p className="field-label">AI Coach Chat</p>
            <h2 className="text-xl font-medium text-black dark:text-white">Ask EcoMind</h2>
          </div>
        </div>
        <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-black/60 dark:bg-white/10 dark:text-white/60">
          {left} of {dailyLimit} left today
        </span>
      </div>

      <div className="max-h-80 space-y-2.5 overflow-y-auto rounded-2xl bg-black/[0.02] p-3 dark:bg-white/[0.03]">
        {messages.length === 0 ? (
          <div className="flex flex-col items-start gap-2 py-2">
            <p className="text-xs leading-5 text-black/50 dark:text-white/50">
              Ask anything about your footprint — answers come from your own logs, not generic tips.
            </p>
            <button
              type="button"
              onClick={() => send("Why did my footprint change this week?")}
              className="rounded-full border border-[#0f5132]/30 px-3.5 py-2 text-xs font-semibold text-[#0f5132] transition hover:bg-[#0f5132]/10 active:scale-95 dark:border-emerald-500/30 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
            >
              Why did my footprint change this week?
            </button>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <p
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-5 ${
                  msg.role === "user"
                    ? "bg-[#15171b] text-white dark:bg-emerald-600"
                    : msg.failed
                      ? "border border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
                      : "border border-black/5 bg-white text-black/75 dark:border-white/10 dark:bg-[#222832] dark:text-white/80"
                }`}
              >
                {msg.text}
              </p>
            </div>
          ))
        )}
        {busy ? (
          <div className="flex justify-start">
            <p className="rounded-2xl border border-black/5 bg-white px-3.5 py-2.5 text-xs text-black/45 dark:border-white/10 dark:bg-[#222832] dark:text-white/45">
              Thinking…
            </p>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {notice ? <p className="mt-2 text-xs font-semibold text-amber-600 dark:text-amber-400">{notice}</p> : null}

      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          send(draft);
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={500}
          placeholder="Ask about your footprint…"
          aria-label="Ask the AI coach"
          className="field-input min-w-0 flex-1"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          aria-label="Send question"
          className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl bg-[#15171b] text-white transition hover:bg-black active:scale-95 disabled:opacity-40 dark:bg-emerald-600 dark:hover:bg-emerald-700"
        >
          <Send size={17} />
        </button>
      </form>
      {!isPremium ? (
        <p className="mt-2 text-[11px] text-black/45 dark:text-white/45">
          Free plan: {dailyLimit} questions a day. Premium doubles it to 10.
        </p>
      ) : null}
    </motion.section>
  );
}

function RewardsPanel({ badges = [], rewardPoints = 0, goals = [], prestigeLevel = 0, onPrestige }) {
  const catalog = getBadgeCatalog();
  const earnedByCode = new Map(badges.map((badge) => [badge.code, badge]));
  const [pickedTier, setPickedTier] = useState(null);
  const [slideDir, setSlideDir] = useState(1);
  const [confirmPrestige, setConfirmPrestige] = useState(false);
  const [prestigeBusy, setPrestigeBusy] = useState(false);
  const prestigeEligible = earnedByCode.size >= TOTAL_BADGE_COUNT;
  const multiplier = prestigeMultiplier(prestigeLevel);

  useEffect(() => {
    if (badges.length === 0) {
      setPickedTier(null);
      setConfirmPrestige(false);
    }
  }, [badges.length]);

  async function handlePrestigeClick() {
    if (!confirmPrestige) {
      setConfirmPrestige(true);
      return;
    }
    if (prestigeBusy) return;
    setPrestigeBusy(true);
    try {
      await onPrestige?.();
      setConfirmPrestige(false);
    } finally {
      setPrestigeBusy(false);
    }
  }

  const tierStats = catalog.map((group) => {
    const unlockedCount = group.badges.filter((badge) => earnedByCode.has(badge.code)).length;
    return { ...group, unlockedCount, complete: unlockedCount === group.badges.length };
  });
  const foundOpen = tierStats.findIndex((group) => !group.complete);
  const activeIndex = pickedTier ?? (foundOpen === -1 ? tierStats.length - 1 : foundOpen);
  const active = tierStats[Math.min(Math.max(activeIndex, 0), tierStats.length - 1)] ?? tierStats[0];

  function goTo(index, dir) {
    if (tierStats.length === 0) return;
    setSlideDir(dir);
    setPickedTier((index + tierStats.length) % tierStats.length);
  }

  return (
    <motion.section variants={riseIn} className="workspace-card">
      <div className="mb-6">
        <p className="field-label">Rewards</p>
        <h2 className="mt-1 text-2xl font-medium text-black dark:text-white">Badges and points</h2>
      </div>
      <div className="mb-5 rounded-[24px] bg-[#0f5132] p-6 text-white shadow-md dark:bg-emerald-700">
        <p className="text-5xl font-medium">{rewardPoints}</p>
        <p className="mt-1 text-sm text-white/65">engagement points</p>
      </div>
      <div className="mb-5 grid gap-3 md:grid-cols-2">
        {goals.map((goal) => {
          const percent = goal.target > 0 ? Math.min(100, Math.round((goal.progress / goal.target) * 100)) : 0;
          return (
            <article key={goal.code} className="rounded-[24px] bg-white p-5 border border-black/5 dark:bg-[#222832] dark:border-white/10">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="font-semibold text-black dark:text-white">{goal.title}</p>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${goal.complete ? "bg-[#0f5132] text-white dark:bg-emerald-600" : "bg-black/5 text-black/60 dark:bg-white/10 dark:text-white/60"}`}>
                  {goal.complete ? "Unlocked" : `${percent}%`}
                </span>
              </div>
              <div className="h-2 rounded-full bg-black/8 dark:bg-white/10">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percent}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="h-full rounded-full bg-[#0f5132] dark:bg-emerald-500"
                />
              </div>
              <p className="mt-2 text-sm text-black/45 dark:text-white/45">
                {goal.progress} / {goal.target}
              </p>
            </article>
          );
        })}
      </div>

      <div className="mb-4 rounded-[24px] bg-white p-5 border border-black/5 dark:bg-[#222832] dark:border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold text-black dark:text-white">Badge Collection</p>
          <span className="rounded-full bg-[#0f5132]/10 dark:bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-[#0f5132] dark:text-emerald-400">
            {earnedByCode.size} / {TOTAL_BADGE_COUNT} unlocked
          </span>
        </div>
        <p className="mt-1 text-sm text-black/45 dark:text-white/45">
          Earn points and climb from Sprout to Guardian. Easy milestones unlock first, then the challenges get harder.
        </p>
      </div>

      {prestigeLevel > 0 || prestigeEligible ? (
        <div className="mb-4 rounded-[24px] border border-[#0f5132]/25 bg-[#f7faf5] p-5 dark:border-emerald-500/25 dark:bg-[#222832]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Trophy size={16} className="text-[#0f5132] dark:text-emerald-400" />
              <p className="font-semibold text-black dark:text-white">
                {prestigeLevel > 0 ? `Prestige ${prestigeLevel}` : "Prestige available"}
              </p>
            </div>
            {prestigeLevel > 0 ? (
              <span className="rounded-full bg-[#0f5132]/10 dark:bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-[#0f5132] dark:text-emerald-400">
                ×{multiplier} badge points
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-black/45 dark:text-white/45">
            {prestigeEligible
              ? `Collection complete. Reset all badges and re-earn them forever at +25% points per prestige level (next: ×${prestigeMultiplier(prestigeLevel + 1)}), plus the "${prestigeTitle(prestigeLevel + 1)}" profile title. Points and shop items are kept.`
              : `Re-earn the full collection at ×${multiplier}. Complete all ${TOTAL_BADGE_COUNT} badges to prestige again.`}
          </p>
          {prestigeEligible ? (
            <button
              type="button"
              onClick={handlePrestigeClick}
              disabled={prestigeBusy}
              className="mt-3 inline-flex h-11 items-center gap-2 rounded-2xl bg-[#15171b] px-5 text-sm font-semibold text-white transition hover:bg-black active:scale-95 disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-700"
            >
              <Trophy size={15} />
              {prestigeBusy ? "Prestiging…" : confirmPrestige ? "Tap again to confirm reset" : `Prestige to level ${prestigeLevel + 1}`}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => goTo(activeIndex - 1, -1)}
          aria-label="Previous reward tier"
          title="Previous tier"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-black/70 shadow-sm transition hover:bg-black/5 active:scale-95 dark:border-white/10 dark:bg-[#222832] dark:text-white/80 dark:hover:bg-white/10"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex flex-1 gap-2 overflow-x-auto py-1" role="tablist" aria-label="Reward tiers">
          {tierStats.map((group, index) => {
            const selected = index === activeIndex;
            return (
              <button
                key={group.tier}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => goTo(index, index > activeIndex ? 1 : -1)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition active:scale-95 ${
                  selected
                    ? "bg-[#15171b] text-white shadow-md dark:bg-emerald-600"
                    : "bg-black/5 text-black/60 hover:bg-black/10 dark:bg-white/10 dark:text-white/60 dark:hover:bg-white/15"
                }`}
              >
                {group.label}
                <span className={selected ? "text-white/70 dark:text-white/80" : "text-black/40 dark:text-white/40"}>
                  {group.unlockedCount}/{group.badges.length}
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => goTo(activeIndex + 1, 1)}
          aria-label="Next reward tier"
          title="Next tier"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-black/70 shadow-sm transition hover:bg-black/5 active:scale-95 dark:border-white/10 dark:bg-[#222832] dark:text-white/80 dark:hover:bg-white/10"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={active.tier}
          initial={{ opacity: 0, x: 48 * slideDir }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -48 * slideDir }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          <div className="mb-3 mt-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className={`text-lg font-semibold ${active.complete ? "text-[#0f5132] dark:text-emerald-400" : "text-black dark:text-white"}`}>
                {active.label} <span className="text-sm font-medium text-black/40 dark:text-white/40">• {active.blurb}</span>
              </h3>
              <p className="text-xs text-black/45 dark:text-white/45">
                {active.unlockedCount} of {active.badges.length} unlocked
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${active.complete ? "bg-[#0f5132] text-white dark:bg-emerald-600" : "bg-black/5 text-black/60 dark:bg-white/10 dark:text-white/60"}`}>
              {active.complete ? "Complete" : "In progress"}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {active.badges.map((badge) => {
              const earned = earnedByCode.get(badge.code);
              return (
                <motion.article
                  key={badge.code}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: active.badges.indexOf(badge) * 0.03 }}
                  className={`relative rounded-[24px] p-5 border transition ${
                    earned
                      ? "bg-[#f7faf5] border-[#0f5132]/40 dark:bg-[#222832] dark:border-emerald-500/40"
                      : "bg-white border-black/5 dark:bg-[#181d24] dark:border-white/10 opacity-75"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                      earned
                        ? "bg-[#0f5132] text-white dark:bg-emerald-600"
                        : "bg-black/5 text-black/40 dark:bg-white/10 dark:text-white/40"
                    }`}>
                      {earned ? <Award size={18} /> : <Lock size={16} />}
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      earned
                        ? "bg-[#0f5132]/10 text-[#0f5132] dark:bg-emerald-500/20 dark:text-emerald-400"
                        : "bg-black/5 text-black/50 dark:bg-white/10 dark:text-white/50"
                    }`}>
                      +{badge.points} pts
                    </span>
                  </div>
                  <h4 className="mt-3 text-sm font-semibold text-black dark:text-white">{badge.label}</h4>
                  <p className="mt-1 text-xs leading-5 text-black/50 dark:text-white/55">{badge.description}</p>
                  {earned ? (
                    <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#0f5132]/10 dark:bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-[#0f5132] dark:text-emerald-400">
                      <Sparkles size={11} /> Unlocked
                    </p>
                  ) : (
                    <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-black/30 dark:text-white/30">Locked</p>
                  )}
                </motion.article>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.section>
  );
}

const shopIconMap = {
  sparkles: Sparkles,
  star: Star,
  book: BookOpen,
  palette: Palette,
  certificate: Award,
  snowflake: Snowflake
};

function ThemePackCard({ item, unlocked, enabled, affordable, busy, onToggle, onRedeem }) {
  const palette = item?.theme?.palette ?? ["#b3552e", "#8a3a1c", "#e8b892", "#f9f3e8", "#2b251d"];
  const themeName = item?.theme?.name ?? "Sienna Earth";

  return (
    <>
      <div className="mt-3 flex items-center gap-1.5">
        {palette.map((color) => (
          <span
            key={color}
            className="h-5 w-5 rounded-full border border-black/10 shadow-sm dark:border-white/15"
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
        <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">
          {themeName}
        </span>
      </div>
      {unlocked ? (
        <div className="mt-4 flex items-center justify-between gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              enabled
                ? "bg-[#0f5132] text-white dark:bg-emerald-600"
                : "bg-black/5 text-black/60 dark:bg-white/10 dark:text-white/60"
            }`}
          >
            {enabled ? "Active" : "Off"}
          </span>
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={enabled}
            aria-label={enabled ? "Turn premium theme off" : "Turn premium theme on"}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
              enabled ? "bg-[#0f5132] dark:bg-emerald-600" : "bg-black/10 dark:bg-white/15"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy || !affordable}
          onClick={() => onRedeem(item)}
          className={`mt-4 inline-flex h-9 items-center justify-center gap-1.5 rounded-2xl px-3 text-xs font-semibold transition ${
            affordable
              ? "bg-[#0f5132] text-white hover:bg-[#0b3d26] dark:bg-emerald-600 dark:hover:bg-emerald-700"
              : "bg-black/5 text-black/40 dark:bg-white/10 dark:text-white/40 cursor-not-allowed"
          }`}
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          {affordable ? "Redeem" : "Need more points"}
        </button>
      )}
    </>
  );
}

function ShopPanel({ rewardPoints = 0, profile = {}, onRedeem, theme = {} }) {
  const [busyId, setBusyId] = useState(null);
  const [feedback, setFeedback] = useState("");
  const redemptions = profile?.redemptions ?? [];
  const premiumUntil = profile?.premiumUntil ?? null;
  const isPremiumActive = Boolean(premiumUntil && new Date(premiumUntil).getTime() > Date.now());
  const redeemedItemIds = new Set(redemptions.map((redemption) => redemption.itemId));
  const themeUnlocked = theme?.isThemeUnlocked ?? false;
  const themeEnabled = theme?.isEnabled ?? false;

  async function handleDownload(item) {
    try {
      await downloadItemPdf(item, profile?.name ?? "EcoMind User", redemptions.find((r) => r.itemId === item.id)?.redeemedAt);
    } catch (error) {
      setFeedback(error.message ?? "Could not generate the PDF.");
    }
  }

  async function handleRedeem(item) {
    if (!onRedeem) return;
    setBusyId(item.id);
    setFeedback("");
    try {
      const message = await onRedeem(item);
      setFeedback(message);
    } catch (error) {
      setFeedback(error.message ?? "Could not redeem item.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <motion.section variants={riseIn} className="workspace-card">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="field-label">Points balance</p>
            <h2 className="mt-1 text-2xl font-medium text-black dark:text-white">Your engagement points</h2>
          </div>
          <div className="rounded-[24px] bg-[#0f5132] p-5 text-white shadow-md dark:bg-emerald-700">
            <p className="text-4xl font-medium">{rewardPoints}</p>
            <p className="mt-1 text-xs text-white/65">points available</p>
          </div>
        </div>

        <div className="mb-6 rounded-[24px] bg-[#f7faf5] p-5 border border-black/5 dark:bg-[#222832] dark:border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-black dark:text-white">Premium status</p>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isPremiumActive ? "bg-[#0f5132] text-white dark:bg-emerald-600" : "bg-black/5 text-black/60 dark:bg-white/10 dark:text-white/60"}`}>
              {isPremiumActive ? "Active" : "Inactive"}
            </span>
          </div>
          <p className="mt-1 text-sm text-black/45 dark:text-white/45">
            {isPremiumActive
              ? `Premium insights unlocked until ${new Date(premiumUntil).toLocaleDateString()}.`
              : "Premium insights unlock an extended 14-day forecast and a category deep dive."}
          </p>
        </div>

        <div className="mb-3">
          <p className="field-label">Catalog</p>
          <h3 className="mt-1 text-xl font-medium text-black dark:text-white">Spend your points</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SHOP_ITEMS.map((item) => {
            const Icon = shopIconMap[item.icon] ?? Sparkles;
            const affordable = rewardPoints >= item.points;
            const busy = busyId === item.id;
            return (
              <motion.article
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: SHOP_ITEMS.indexOf(item) * 0.04 }}
                className="flex flex-col rounded-[24px] bg-white p-5 border border-black/5 dark:bg-[#222832] dark:border-white/10"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${item.type === "premium" ? "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400" : "bg-[#0f5132]/10 text-[#0f5132] dark:bg-emerald-500/20 dark:text-emerald-400"}`}>
                    <Icon size={18} />
                  </div>
                  <span className="rounded-full bg-black/5 px-2.5 py-0.5 text-[11px] font-semibold text-black/60 dark:bg-white/10 dark:text-white/60">
                    {item.points} pts
                  </span>
                </div>
                <h4 className="mt-3 text-sm font-semibold text-black dark:text-white">{item.name}</h4>
                <p className="mt-1 flex-1 text-xs leading-5 text-black/50 dark:text-white/55">{item.description}</p>
                {item.id === "custom_theme" ? (
                  <ThemePackCard
                    item={item}
                    unlocked={themeUnlocked}
                    enabled={themeEnabled}
                    affordable={affordable}
                    busy={busy}
                    onToggle={() => theme?.setEnabled?.(!themeEnabled)}
                    onRedeem={handleRedeem}
                  />
                ) : (
                  <button
                    type="button"
                    disabled={busy || !affordable}
                    onClick={() => handleRedeem(item)}
                    className={`mt-4 inline-flex h-9 items-center justify-center gap-1.5 rounded-2xl px-3 text-xs font-semibold transition ${
                      affordable
                        ? "bg-[#0f5132] text-white hover:bg-[#0b3d26] dark:bg-emerald-600 dark:hover:bg-emerald-700"
                        : "bg-black/5 text-black/40 dark:bg-white/10 dark:text-white/40 cursor-not-allowed"
                    }`}
                  >
                    {busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    {affordable ? "Redeem" : "Need more points"}
                  </button>
                )}
                {item.id === "streak_freeze" && (profile?.streakFreezes ?? 0) > 0 ? (
                  <span className="mt-2 inline-flex items-center gap-1.5 self-start rounded-full bg-[#0f5132]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#0f5132] dark:bg-emerald-500/20 dark:text-emerald-400">
                    <Snowflake size={11} />
                    {profile.streakFreezes} freeze{profile.streakFreezes === 1 ? "" : "s"} owned
                  </span>
                ) : null}
                {item.content && redeemedItemIds.has(item.id) ? (
                  <button
                    type="button"
                    onClick={() => handleDownload(item)}
                    className="mt-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-2xl border border-[#0f5132]/30 dark:border-emerald-500/30 px-3 text-xs font-semibold text-[#0f5132] dark:text-emerald-400 transition hover:bg-[#0f5132]/10 dark:hover:bg-emerald-500/10"
                  >
                    <Download size={13} />
                    Download PDF
                  </button>
                ) : null}
              </motion.article>
            );
          })}
        </div>

        {feedback ? (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-2xl bg-[#0f5132]/10 dark:bg-emerald-500/20 px-4 py-3 text-sm font-semibold text-[#0f5132] dark:text-emerald-400"
          >
            {feedback}
          </motion.p>
        ) : null}
      </motion.section>

      {redemptions.length > 0 ? (
        <motion.section variants={riseIn} className="workspace-card">
          <div className="mb-5">
            <p className="field-label">History</p>
            <h2 className="mt-1 text-2xl font-medium text-black dark:text-white">Redemption history</h2>
          </div>
          <div className="space-y-2">
            {[...redemptions].reverse().map((redemption, index) => (
              <div
                key={`${redemption.itemId}-${index}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white px-4 py-3 border border-black/5 dark:bg-[#222832] dark:border-white/10"
              >
                <div>
                  <p className="text-sm font-semibold text-black dark:text-white">{redemption.name}</p>
                  <p className="text-[11px] text-black/45 dark:text-white/45">
                    {new Date(redemption.redeemedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {(() => {
                    const item = findShopItem(redemption.itemId);
                    return item?.content ? (
                      <button
                        type="button"
                        onClick={() => handleDownload(item)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#0f5132]/30 dark:border-emerald-500/30 px-3 text-[11px] font-semibold text-[#0f5132] dark:text-emerald-400 transition hover:bg-[#0f5132]/10 dark:hover:bg-emerald-500/10"
                      >
                        <Download size={12} />
                        PDF
                      </button>
                    ) : null;
                  })()}
                  <span className="rounded-full bg-black/5 px-2.5 py-0.5 text-[11px] font-semibold text-black/60 dark:bg-white/10 dark:text-white/60">
                    -{redemption.points} pts
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      ) : null}
    </div>
  );
}

function buildExtendedForecast(trend) {
  const recent = (trend ?? []).slice(-7);
  const average = recent.length ? recent.reduce((sum, item) => sum + item.totalKg, 0) / recent.length : 10;
  return Array.from({ length: 14 }, (_, index) => ({
    day: index + 1,
    predictedKg: Math.max(0, Number((average - index * 0.2 + Math.sin(index) * 0.35).toFixed(1)))
  }));
}

function PremiumBanner({ premiumUntil }) {
  const until = new Date(premiumUntil);
  return (
    <motion.div variants={riseIn} className="rounded-[28px] bg-[linear-gradient(135deg,#0f5132,#166534)] p-6 text-white shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-amber-300" />
          <h3 className="text-lg font-bold">Premium Insights Active</h3>
        </div>
        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
          Expires {until.toLocaleDateString()}
        </span>
      </div>
      <p className="mt-2 text-sm text-white/80">Extended forecast, category deep dive, and priority tips unlocked.</p>
    </motion.div>
  );
}

function ExtendedForecastPanel({ trend = [] }) {
  const data = buildExtendedForecast(trend);
  const max = Math.max(...data.map((item) => item.predictedKg), 1);

  return (
    <motion.section variants={riseIn} className="workspace-card">
      <div className="mb-6">
        <p className="field-label">Premium Forecast</p>
        <h2 className="mt-1 text-2xl font-medium text-black dark:text-white">Extended 14-day outlook</h2>
      </div>
      <div className="grid grid-cols-7 items-end gap-3">
        {data.map((item, index) => (
          <div key={`${item.day}-${index}`} className="flex flex-col items-center gap-2">
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: Math.max(20, (item.predictedKg / max) * 150) }}
              transition={{ delay: index * 0.04, duration: 0.6, ease: "easeOut" }}
              className="w-full rounded-full bg-[#15171b] dark:bg-white/90"
            />
            <p className="text-center text-[10px] text-black/45 font-medium dark:text-white/45">D{item.day}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-black/45 dark:text-white/45">
        Projection based on your recent daily footprint.
      </p>
    </motion.section>
  );
}

function CategoryDeepDive({ stats = {} }) {
  const totals = stats.categoryTotals ?? {};
  const entries = Object.entries(totals);
  const total = entries.reduce((sum, [, value]) => sum + Number(value ?? 0), 0) || 1;
  const categoryMeta = {
    transportation: { label: "Transportation", color: "#0f5132" },
    energy: { label: "Home Energy", color: "#166534" },
    lifestyle: { label: "Lifestyle & Food", color: "#5f8f73" }
  };

  return (
    <motion.section variants={riseIn} className="workspace-card">
      <div className="mb-6">
        <p className="field-label">Premium Deep Dive</p>
        <h2 className="mt-1 text-2xl font-medium text-black dark:text-white">Where your emissions live</h2>
      </div>
      <div className="space-y-5">
        {entries.map(([key, value]) => {
          const meta = categoryMeta[key] ?? { label: key, color: "#0f5132" };
          const num = Number(value ?? 0);
          const pct = Math.round((num / total) * 100);
          return (
            <div key={key}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <p className="font-semibold text-black dark:text-white capitalize">{meta.label}</p>
                <p className="text-black/55 dark:text-white/60">{num} kg · {pct}%</p>
              </div>
              <div className="h-2 rounded-full bg-black/8 dark:bg-white/10">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{ background: meta.color }}
                />
              </div>
            </div>
          );
        })}
        <p className="text-xs leading-5 text-black/45 dark:text-white/45">
          Focus reduction efforts on the largest bar — even small daily changes there shrink your weekly footprint fastest.
        </p>
      </div>
    </motion.section>
  );
}

function PremiumTeaser({ rewardPoints, onUnlock }) {
  const premiumWeek = SHOP_ITEMS.find((item) => item.id === "premium_week") ?? { points: 500 };
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function handleUnlock() {
    setBusy(true);
    setFeedback("");
    try {
      await onUnlock();
      setFeedback("Premium unlocked!");
    } catch (error) {
      setFeedback(error.message ?? "Could not unlock premium.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.section variants={riseIn} className="workspace-card">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-xl">
          <p className="field-label">Premium Insights</p>
          <h2 className="mt-1 text-2xl font-medium text-black dark:text-white">See 14 more days, go deeper</h2>
          <p className="mt-2 text-sm text-black/55 dark:text-white/60">
            Unlock an extended 14-day forecast and a category-by-category breakdown of your footprint.
          </p>
        </div>
        <button
          type="button"
          disabled={busy || rewardPoints < premiumWeek.points}
          onClick={handleUnlock}
          className="executive-button"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          Unlock for {premiumWeek.points} pts
        </button>
      </div>
      {feedback ? (
        <p className="mt-3 text-sm font-semibold text-[#0f5132] dark:text-emerald-400">{feedback}</p>
      ) : null}
      {rewardPoints < premiumWeek.points ? (
        <p className="mt-2 text-xs text-black/45 dark:text-white/45">
          You need {premiumWeek.points} points. Keep logging to earn more.
        </p>
      ) : null}
    </motion.section>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem("ecomind_user_v1");
    return saved ? JSON.parse(saved) : null;
  });

  const [dashboard, setDashboard] = useState(null);
  const [entriesList, setEntriesList] = useState([]);
  const [status, setStatus] = useState("demo");
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeSection, setActiveSection] = useState("overview");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [logPrefill, setLogPrefill] = useState(null);
  const [trackedTrips, setTrackedTrips] = useState([]);
  const [travelTab, setTravelTab] = useState("track");
  const [oauthStatus, setOauthStatus] = useState(null);
  const handledCodeRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");

    if (code && state && handledCodeRef.current !== code) {
      handledCodeRef.current = code;
      const cleanPath = window.location.pathname === "/auth/googlefit/callback" ? "/" : window.location.pathname;
      window.history.replaceState({}, document.title, cleanPath);

      async function completeGoogleFitAuth() {
        setOauthStatus({ type: "loading", message: "Connecting Google Fit account..." });
        try {
          const res = await handleGoogleFitCallback(code, state);
          if (res?.user) {
            setCurrentUser(res.user);
            localStorage.setItem("ecomind_user_v1", JSON.stringify(res.user));
          }
          setOauthStatus({ type: "success", message: "Google Fit connected successfully! Click 'Fetch activities' below to import your sessions." });
          setActiveSection("import");
          setRefreshKey((k) => k + 1);
        } catch (err) {
          console.error("Google Fit OAuth callback failed", err);
          setOauthStatus({
            type: "error",
            message: err?.response?.data?.message || err?.message || "Failed to connect Google Fit."
          });
        }
      }

      completeGoogleFitAuth();
    }
  }, []);



  const activeUserId = currentUser?.userId;

  const stats = dashboard?.stats ?? {
    carbonScore: 0,
    recentWeeklyKg: 0,
    totalEmissionsKg: 0,
    improvementPercent: 0,
    categoryTotals: { transportation: 0, energy: 0, lifestyle: 0 }
  };
  const profile = dashboard?.profile ?? currentUser ?? DEMO_USER;
  const recommendations = dashboard?.recommendations ?? demoDashboard.recommendations;
  const badges = dashboard?.badges ?? [];
  const goals = dashboard?.goals ?? [];
  const meta = sectionMeta[activeSection];

  useEffect(() => {
    if (!currentUser) return;
    let active = true;

    async function load() {
      let user = await fetchUser(activeUserId);
      if (!user?.userId) {
        user = await upsertUser(currentUser);
      }
      if (user?.userId) {
        const changed =
          user.picture !== currentUser.picture ||
          user.name !== currentUser.name ||
          user.city !== currentUser.city;
        if (changed) {
          setCurrentUser(user);
          setAvatarFailed(false);
          try {
            localStorage.setItem("ecomind_user_v1", JSON.stringify(user));
          } catch {
            console.warn("Could not cache profile locally (image may be too large).");
          }
        }
      }
      const data = await fetchDashboard(activeUserId);
      const list = await fetchEntries(activeUserId);
      if (active) {
        setDashboard(data);
        setEntriesList(list ?? []);
        setStatus(data._source === "remote" && user?._source === "remote" ? "live" : "demo");
      }
    }

    load();

    const hasSeenGuide = localStorage.getItem("ecomind_onboarded_v1");
    if (!hasSeenGuide) {
      setShowOnboarding(true);
    }

    return () => {
      active = false;
    };
  }, [refreshKey, activeUserId, currentUser]);

  function closeOnboarding() {
    localStorage.setItem("ecomind_onboarded_v1", "true");
    setShowOnboarding(false);
  }

  function handleAuthenticated(user) {
    setAvatarFailed(false);
    setCurrentUser(user);
    try {
      localStorage.setItem("ecomind_user_v1", JSON.stringify(user));
    } catch {
      console.warn("Could not cache profile locally (image may be too large).");
    }
    setRefreshKey((key) => key + 1);
  }

  function handleLogout() {
    localStorage.removeItem("ecomind_user_v1");
    setCurrentUser(null);
    setUserMenuOpen(false);
  }

  async function handleUpdateProfile({ name, city, picture }) {
    if (!activeUserId) return;
    try {
      const updated = await upsertUser({
        userId: activeUserId,
        name,
        city,
        email: currentUser.email,
        picture,
        weeklyEmissionTargetKg: currentUser.weeklyEmissionTargetKg ?? 85
      });
      setCurrentUser((prev) => ({ ...prev, ...updated, name, city, picture }));
      setAvatarFailed(false);
      try {
        localStorage.setItem(
          "ecomind_user_v1",
          JSON.stringify({ ...currentUser, ...updated, name, city, picture })
        );
      } catch {
        console.warn("Could not cache profile locally (image may be too large).");
      }
      setRefreshKey((key) => key + 1);
    } catch (err) {
      console.error("Failed to update profile", err);
    } finally {
      setShowEditProfile(false);
    }
  }

  async function handleResetData() {
    if (!activeUserId) return;
    const data = await resetUser(activeUserId);
    setDashboard(data);
    setEntriesList([]);
    setRefreshKey((key) => key + 1);
  }

  function goToLog() {
    setEditingEntry(null);
    setActiveSection("log");
  }

  function changeSection(id) {
    setActiveSection(id);
    if (id === "log") {
      setEditingEntry(null);
    } else {
      setLogPrefill(null);
    }
  }

  function handleUseMode(modeId, distance) {
    setLogPrefill({ vehicleType: modeId, distanceKm: distance });
    goToLog();
  }

  function handleImported() {
    setRefreshKey((key) => key + 1);
  }

  useEffect(() => {
    if (!activeUserId) return;
    let active = true;
    getTrackedTrips(activeUserId)
      .then((res) => {
        if (active) setTrackedTrips(res?.trips ?? []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [activeUserId, refreshKey]);

  async function handleTripSaved(trip) {
    const saved = await saveTrackedTrip(activeUserId, trip);
    const kept = saved?.trip ?? trip;
    setTrackedTrips((current) => [kept, ...current.filter((t) => t.id !== kept.id)]);
  }

  async function handleTripLogged(trip) {
    await logTrackedTripToCarbon(activeUserId ?? "", trip);
    await handleTripSaved(trip);
    setRefreshKey((key) => key + 1);
  }

  async function handleTripDeleted(tripId) {
    await deleteTrackedTrip(activeUserId, tripId);
    setTrackedTrips((current) => current.filter((t) => t.id !== tripId));
    setRefreshKey((key) => key + 1);
  }

  function handleChallengeClaimed() {
    setRefreshKey((key) => key + 1);
  }

  const rewardPoints = dashboard?.rewardPoints ?? dashboard?.profile?.rewardPoints ?? 0;
  const premiumUntil = profile?.premiumUntil ?? null;
  const isPremium = Boolean(premiumUntil && new Date(premiumUntil).getTime() > Date.now());
  const isThemeUnlocked = (profile?.redemptions ?? []).some((redemption) => redemption.itemId === "custom_theme");
  const theme = usePremiumTheme({ unlocked: isThemeUnlocked });

  async function handlePrestige() {
    if (!activeUserId) return;
    await prestigeUser(activeUserId);
    setRefreshKey((key) => key + 1);
  }

  async function handleEquipTitle(title) {
    if (!activeUserId) return;
    await equipTitle(activeUserId, title);
    setRefreshKey((key) => key + 1);
  }

  async function handleRedeem(item) {
    if (!activeUserId) return;
    await redeemItem(activeUserId, item.id);
    setRefreshKey((key) => key + 1);
    if (item.id === "custom_theme") {
      return "Eco Theme Pack unlocked — the premium Sienna earth theme is now active!";
    }
    if (item.id === "streak_freeze") {
      return "Streak Freeze purchased — your streak is now protected for one missed day!";
    }
    return `Redeemed ${item.name} for ${item.points} points!`;
  }

  // Render Landing Page if User is Not Logged In
  if (!currentUser) {
    return <LandingPage onAuthenticated={handleAuthenticated} />;
  }

  const isFreshAccount = (stats.carbonScore === 0 || stats.carbonScore == null) && (stats.recentWeeklyKg === 0 || stats.recentWeeklyKg == null);

  return (
    <main className="app-shell min-h-screen overflow-hidden p-2 text-black sm:p-4 transition-colors duration-300 dark:text-white">
      <div className="ambient-core" />
      <div className="ambient-orbit" />

      <OnboardingModal
        isOpen={showOnboarding}
        onClose={closeOnboarding}
        onResetData={handleResetData}
        onStartLogging={goToLog}
      />

      <AboutMissionModal isOpen={showAboutModal} onClose={() => setShowAboutModal(false)} />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthenticated={handleAuthenticated}
      />

      <EditProfileModal
        isOpen={showEditProfile}
        user={currentUser}
        titles={profile?.titles ?? []}
        equippedTitle={profile?.equippedTitle ?? null}
        onClose={() => setShowEditProfile(false)}
        onSave={handleUpdateProfile}
        onEquipTitle={handleEquipTitle}
      />

      <div className="grid min-h-[calc(100vh-0.5rem)] grid-cols-[64px_minmax(0,1fr)] gap-2 p-1.5 sm:min-h-[calc(100vh-2rem)] sm:grid-cols-[78px_minmax(0,1fr)] sm:gap-4 sm:p-2">
        <motion.aside
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          className="sticky top-1.5 flex h-[calc(100vh-0.75rem)] flex-col items-center rounded-[28px] bg-[#15171b] p-1.5 text-white sm:top-4 sm:h-[calc(100vh-2rem)] sm:p-3 shadow-xl"
        >
          <button
            type="button"
            onClick={() => changeSection("overview")}
            className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 transition hover:bg-white/10 sm:mb-6 sm:h-12 sm:w-12"
            aria-label="Go to overview"
            title="Overview"
          >
            <img src="/favicon.svg" alt="EcoMind" className="h-9 w-9 sm:h-10 sm:w-10" />
          </button>

          <nav className="nav-scroll flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto" aria-label="Main sections">
            {sections.map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => changeSection(item.id)}
                  className={`group relative flex h-11 w-11 items-center justify-center rounded-2xl transition sm:h-12 sm:w-12 ${
                    active
                      ? "bg-[#0f5132] text-white shadow-[0_6px_20px_rgba(15,81,50,0.4)]"
                      : "text-white/72 hover:bg-white/12 hover:text-white"
                  }`}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  title={item.label}
                >
                  <Icon size={18} />
                  {active ? (
                    <motion.span
                      layoutId="sidebar-active-dot"
                      className="absolute -right-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-[#0f5132] shadow-[0_0_10px_rgba(15,81,50,0.8)]"
                    />
                  ) : null}
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => setShowOnboarding(true)}
            className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white transition hover:bg-white/25 sm:h-12 sm:w-12"
            title="Open Guided Tour"
            aria-label="Guided Tour"
          >
            <HelpCircle size={20} />
          </button>

          <button
            type="button"
            onClick={() => setShowAboutModal(true)}
            className="mb-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f5132,#5f8f73)] p-1 transition hover:brightness-110 sm:h-11 sm:w-11"
            title="Our Mission & Motto"
            aria-label="Our Mission & Motto"
          >
            <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-[#15171b] text-white">
              <Leaf size={20} />
            </div>
          </button>
        </motion.aside>

        <section className="min-w-0">
          <motion.header
            variants={stagger}
            initial="hidden"
            animate="show"
            className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto]"
          >
            <motion.div variants={riseIn}>
              <h1 className="max-w-3xl text-3xl font-medium leading-[0.94] tracking-[-0.04em] text-black sm:text-5xl md:text-7xl dark:text-white">
                {meta.title}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-black/52 dark:text-white/52">{meta.subtitle}</p>
            </motion.div>

            <motion.div variants={riseIn} className="flex flex-wrap items-start gap-2.5">
              {/* User Account / Sign In Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((open) => !open)}
                  className="inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-3.5 text-sm font-semibold text-black shadow-[0_10px_28px_rgba(20,22,26,0.05)] transition hover:bg-black/5 dark:bg-[#222832] dark:text-white dark:shadow-none dark:hover:bg-white/10"
                >
                  {currentUser.picture && !avatarFailed ? (
                    <img
                      src={currentUser.picture}
                      alt=""
                      onError={() => setAvatarFailed(true)}
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0f5132] text-xs font-bold text-white uppercase">
                      {currentUser.name?.[0] ?? "U"}
                    </div>
                  )}
                  <span className="max-w-[110px] truncate">{currentUser.name}</span>
                  <ChevronDown size={14} className="text-black/45 dark:text-white/45" />
                </button>

                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      className="absolute right-0 top-14 z-30 w-64 rounded-3xl bg-white p-3 shadow-2xl border border-black/8 dark:bg-[#222832] dark:border-white/10"
                    >
                      <div className="mb-2 rounded-2xl bg-black/5 p-3 dark:bg-white/5">
                        <p className="text-xs font-semibold text-black truncate dark:text-white">{currentUser.name}</p>
                        <p className="text-[11px] text-black/50 truncate dark:text-white/50">{currentUser.email}</p>
                        <div className="mt-2 flex items-center justify-between border-t border-black/8 pt-2 text-[11px] dark:border-white/10">
                          <span className="text-black/60 dark:text-white/60">City</span>
                          <span className="font-semibold text-[#0f5132] dark:text-emerald-400">{currentUser.city ?? "New Delhi"}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          setShowEditProfile(true);
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-black/75 transition hover:bg-black/5 dark:text-white/75 dark:hover:bg-white/10"
                      >
                        <UserCheck size={15} />
                        Edit Profile
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          setShowAuthModal(true);
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-black/75 transition hover:bg-black/5 dark:text-white/75 dark:hover:bg-white/10"
                      >
                        <UserCheck size={15} />
                        Switch or Create Account
                      </button>

                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:hover:bg-red-500/10"
                      >
                        <LogOut size={15} />
                        Sign Out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>





              {/* Theme Toggle */}
              <ThemeToggle className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-black/10 bg-white text-black/70 shadow-sm transition hover:bg-black/5 hover:text-black dark:border-white/10 dark:bg-[#222832] dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white" />

              {/* Quick Tour Button */}
              <button
                type="button"
                onClick={() => setShowOnboarding(true)}
                className="inline-flex h-12 items-center gap-1.5 rounded-2xl border border-black/10 bg-white px-3.5 text-xs font-semibold text-black/70 shadow-sm transition hover:bg-black/5 hover:text-black dark:border-white/10 dark:bg-[#222832] dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <HelpCircle size={14} />
                <span className="hidden sm:inline">Guide</span>
              </button>

              {/* Log Entry Action Button */}
              <button
                type="button"
                onClick={goToLog}
                className="executive-button"
              >
                <Plus size={16} />
                Log Entry
              </button>
            </motion.div>
          </motion.header>

          {oauthStatus ? (
            <div className={`mt-4 flex items-center justify-between rounded-2xl p-4 text-xs font-semibold shadow-sm ${
              oauthStatus.type === "success"
                ? "bg-emerald-100 text-[#0f5132] dark:bg-emerald-950/50 dark:text-emerald-300"
                : oauthStatus.type === "error"
                  ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
            }`}>
              <span>{oauthStatus.message}</span>
              <button type="button" onClick={() => setOauthStatus(null)} className="ml-2 text-sm font-bold opacity-60 hover:opacity-100">✕</button>
            </div>
          ) : null}

          <AnimatePresence mode="wait">

            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.22 }}
              className="mt-4 sm:mt-6"
            >
              {activeSection === "overview" && (
                <div className="space-y-6">
                  {/* Fresh Account Banner */}
                  {isFreshAccount && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] bg-[linear-gradient(135deg,#0f5132,#166534)] p-6 text-white shadow-xl"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Sparkles size={18} className="text-amber-300" />
                          <h3 className="text-lg font-bold">Welcome to EcoMind!</h3>
                        </div>
                        <p className="text-sm text-white/80 max-w-xl">
                          Your account starts fresh with 0 score. Log your daily travel, AC hours, or meals to generate your carbon footprint and unlock eco badges!
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={goToLog}
                        className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-xs font-bold text-[#0f5132] shadow-md transition hover:bg-emerald-50 active:scale-95"
                      >
                        <Plus size={16} />
                        Log Your First Entry
                      </button>
                    </motion.div>
                  )}

                  <div className="grid gap-4 md:grid-cols-3 sm:gap-6">
                    <StatTile
                      title="Carbon Score"
                      value={stats.carbonScore ?? 0}
                      unit="/ 100"
                      progress={stats.carbonScore ?? 0}
                      helper="Behavior-adjusted status"
                    />
                    <StatTile
                      title="Weekly Footprint"
                      value={stats.recentWeeklyKg ?? 0}
                      unit="kg CO2e"
                      progress={profile.weeklyEmissionTargetKg > 0 ? Math.min(100, Math.round(((stats.recentWeeklyKg ?? 0) / profile.weeklyEmissionTargetKg) * 100)) : 0}
                      accent="forest"
                      helper={`${profile.weeklyEmissionTargetKg} kg weekly ceiling`}
                    />
                    <StatTile
                      title="Reduction"
                      value={`${stats.improvementPercent ?? 0}%`}
                      unit="saved"
                      progress={Math.max(0, stats.improvementPercent ?? 0)}
                      helper="Change versus previous week"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    <div className="lg:col-span-8">
                      <StatisticsPanel trend={dashboard?.trend ?? []} />
                    </div>
                    <div className="lg:col-span-4">
                      <Recommendations recommendations={recommendations} onAction={goToLog} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    <div className="lg:col-span-6">
                      <ForecastPanel forecast={dashboard?.forecast ?? []} />
                    </div>
                    <div className="lg:col-span-6">
                      <RewardsPanel badges={badges} rewardPoints={rewardPoints} goals={goals} prestigeLevel={profile?.prestigeLevel ?? 0} onPrestige={handlePrestige} />
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "log" && (
                <DataEntryForm
                  userId={activeUserId}
                  editingEntry={editingEntry}
                  prefill={logPrefill}
                  onCancelEdit={() => setEditingEntry(null)}
                  onSubmitted={() => {
                    setEditingEntry(null);
                    setLogPrefill(null);
                    setRefreshKey((key) => key + 1);
                    setActiveSection("overview");
                  }}
                />
              )}

              {activeSection === "history" && (
                <ActivityHistory
                  entries={entriesList}
                  frozenDays={profile?.streakFrozenDays ?? []}
                  onEdit={(entry) => {
                    setEditingEntry(entry);
                    setActiveSection("log");
                  }}
                  onDelete={async (entry) => {
                    if (!entry?.id || !activeUserId) return;
                    await deleteCarbonEntry(activeUserId, entry.id);
                    setRefreshKey((key) => key + 1);
                  }}
                />
              )}

              {activeSection === "insights" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    <div className="lg:col-span-6">
                      <Recommendations recommendations={recommendations} onAction={goToLog} />
                    </div>
                    <div className="lg:col-span-6">
                      <ForecastPanel forecast={dashboard?.forecast ?? []} />
                    </div>
                  </div>
                  <ChatPanel userId={activeUserId} isPremium={isPremium} dailyLimit={isPremium ? 10 : 5} />
                  {isPremium ? (
                    <>
                      <PremiumBanner premiumUntil={premiumUntil} />
                      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                        <div className="lg:col-span-6">
                          <ExtendedForecastPanel trend={dashboard?.trend ?? []} />
                        </div>
                        <div className="lg:col-span-6">
                          <CategoryDeepDive stats={stats} />
                        </div>
                      </div>
                    </>
                  ) : (
                    <PremiumTeaser rewardPoints={rewardPoints} onUnlock={() => handleRedeem(SHOP_ITEMS.find((item) => item.id === "premium_week"))} />
                  )}
                </div>
              )}

              {activeSection === "travel" && (
                <Suspense fallback={<SectionLoader />}>
                  <div className="mb-4 flex flex-wrap items-center gap-2 sm:mb-5">
                    <button
                      type="button"
                      onClick={() => setTravelTab("track")}
                      className={`rounded-2xl px-3 py-2 text-xs font-semibold transition sm:px-4 sm:py-2 sm:text-sm ${
                        travelTab === "track"
                          ? "bg-[#0f5132] text-white dark:bg-emerald-600"
                          : "bg-white text-black/60 hover:bg-black/5 dark:bg-[#222832] dark:text-white/60 dark:hover:bg-white/10"
                      }`}
                    >
                      Live track
                    </button>
                    <button
                      type="button"
                      onClick={() => setTravelTab("alternatives")}
                      className={`rounded-2xl px-3 py-2 text-xs font-semibold transition sm:px-4 sm:py-2 sm:text-sm ${
                        travelTab === "alternatives"
                          ? "bg-[#0f5132] text-white dark:bg-emerald-600"
                          : "bg-white text-black/60 hover:bg-black/5 dark:bg-[#222832] dark:text-white/60 dark:hover:bg-white/10"
                      }`}
                    >
                      Greener options
                    </button>
                    <button
                      type="button"
                      onClick={() => setTravelTab("history")}
                      className={`rounded-2xl px-3 py-2 text-xs font-semibold transition sm:px-4 sm:py-2 sm:text-sm ${
                        travelTab === "history"
                          ? "bg-[#0f5132] text-white dark:bg-emerald-600"
                          : "bg-white text-black/60 hover:bg-black/5 dark:bg-[#222832] dark:text-white/60 dark:hover:bg-white/10"
                      }`}
                    >
                      Trip history
                    </button>
                  </div>
                  {travelTab === "track" && (
                    <TripTracker userId={activeUserId} onLogged={handleTripLogged} />
                  )}
                  {travelTab === "alternatives" && <TravelAlternativesPanel onUseMode={handleUseMode} />}
                  {travelTab === "history" && (
                    <TripHistory trips={trackedTrips ?? []} onDelete={handleTripDeleted} />
                  )}
                </Suspense>
              )}

              {activeSection === "rewards" && (
                <RewardsPanel badges={badges} rewardPoints={rewardPoints} goals={goals} prestigeLevel={profile?.prestigeLevel ?? 0} onPrestige={handlePrestige} />
              )}

              {activeSection === "shop" && (
                <ShopPanel rewardPoints={rewardPoints} profile={profile} onRedeem={handleRedeem} theme={theme} />
              )}

              {activeSection === "community" && (
                <Suspense fallback={<SectionLoader />}>
                  <CommunityPanel userId={activeUserId} onChallengeClaimed={handleChallengeClaimed} />
                </Suspense>
              )}

              {activeSection === "import" && (
                <Suspense fallback={<SectionLoader />}>
                  <ImportPanel userId={activeUserId} profile={profile} onImported={handleImported} />
                </Suspense>
              )}
            </motion.div>
          </AnimatePresence>
        </section>
      </div>
    </main>
  );
}
