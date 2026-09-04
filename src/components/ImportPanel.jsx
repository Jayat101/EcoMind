import { AnimatePresence, motion } from "framer-motion";
import { Activity, AlertCircle, Check, CheckCircle2, ChevronRight, DownloadCloud, Loader2, Lock, RefreshCw, Route, ShieldCheck, Smartphone, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { disconnectGoogleFit, fetchGoogleFitActivities, importActivities } from "../services/api.js";
import { MODE_FACTORS } from "../services/alternatives.js";
import { generateImportActivities, IMPORT_SOURCES } from "../services/importData.js";

const riseIn = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1 }
};

const sourceIcons = {
  google_fit: Activity,
  strava: Route,
  apple_health: Activity,
  ride_apps: Smartphone
};

function round(value) {
  return Number(Number(value).toFixed(2));
}

function activityEmissions(activity) {
  return round((MODE_FACTORS[activity.vehicleType] ?? 0) * Number(activity.distanceKm ?? 0));
}

function ConnectModal({ source, userId, userName, userEmail, onClose, onConnected }) {
  const [confirming, setConfirming] = useState(false);
  const [email, setEmail] = useState(userEmail ?? "");
  const [touched, setTouched] = useState(false);

  async function handleConnect() {
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!valid) {
      setTouched(true);
      return;
    }
    setConfirming(true);

    if (source.id === "google_fit") {
      const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";
      window.location.href = `${apiBase}/integrations/googlefit/auth?userId=${encodeURIComponent(userId ?? "")}`;
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 700));
    onConnected();
    setConfirming(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-2xl border border-black/8 dark:bg-[#222832] dark:border-white/10"
      >
        <div className="flex h-20 items-center justify-between px-6" style={{ backgroundColor: source.color }}>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 text-white">
              {(() => {
                const Icon = sourceIcons[source.id] ?? Activity;
                return <Icon size={22} />;
              })()}
            </div>
            <div>
              <p className="text-lg font-bold leading-none text-white">Connect {source.label}</p>
              <p className="mt-1 text-xs text-white/80">Secured by EcoMind Sync</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-white/80 transition hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-2 rounded-2xl bg-black/5 dark:bg-white/5 px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0f5132] text-xs font-bold text-white uppercase">
              {(userName ?? "U").trim()[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-black dark:text-white">{userName}</p>
              <input
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setTouched(true);
                }}
                placeholder="you@example.com"
                aria-label="Email to sync"
                className="w-full rounded-md border border-transparent bg-transparent text-xs text-black/55 outline-none transition focus:border-[#0f5132]/40 focus:bg-white/60 dark:text-white/55 dark:focus:border-emerald-500/40 dark:focus:bg-black/20"
              />
            </div>
            <Check size={15} className="shrink-0 text-[#0f5132] dark:text-emerald-400" />
          </div>

          <p className="mt-3 text-[11px] leading-4 text-black/40 dark:text-white/40">
            {touched && !email ? "Enter the email for the account you want to sync." : "Edit the email to sync a different account."}
          </p>

          <p className="mt-4 text-xs leading-5 text-black/55 dark:text-white/60">
            EcoMind will import your recent {source.label.toLowerCase()} activities so they count toward your carbon log,
            badges, and streaks. You stay in control — only checked-in activities are synced.
          </p>

          <div className="mt-4 flex items-center gap-2 text-[11px] text-black/40 dark:text-white/40">
            <ShieldCheck size={13} />
            Your data stays private. No posting to your profile.
          </div>

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-2xl border border-black/15 dark:border-white/15 px-4 py-3 text-sm font-semibold text-black/70 dark:text-white/80 transition hover:bg-black/5 dark:hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={confirming}
              onClick={handleConnect}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-60"
              style={{ backgroundColor: source.color }}
            >
              {confirming ? <Loader2 size={15} className="animate-spin" /> : <Lock size={14} />}
              {confirming ? "Redirecting..." : `Connect ${source.label}`}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function ImportPanel({ userId, profile = {}, onImported }) {
  const [connected, setConnected] = useState(() => ({
    google_fit: Boolean(profile?.googleFitConnected)
  }));
  const [oauthSource, setOauthSource] = useState(null);
  const [rangeDays, setRangeDays] = useState(14);
  const [activities, setActivities] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [fetching, setFetching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const userName = profile.name ?? "EcoMind User";
  const userEmail = profile.email ?? "";

  useEffect(() => {
    setConnected((prev) => ({
      ...prev,
      google_fit: Boolean(profile?.googleFitConnected)
    }));
  }, [profile?.googleFitConnected]);

  useEffect(() => {
    setSelected(new Set(activities.map((activity) => activity.id)));
  }, [activities]);

  const connectedCount = Object.values(connected).filter(Boolean).length;
  const selectedActivities = useMemo(() => activities.filter((activity) => selected.has(activity.id)), [activities, selected]);
  const selectedEmissions = round(selectedActivities.reduce((sum, activity) => sum + activityEmissions(activity), 0));

  function handleConnected() {
    if (oauthSource) {
      setConnected((current) => ({ ...current, [oauthSource.id]: true }));
    }
    setOauthSource(null);
  }

  async function handleDisconnect(sourceId) {
    if (sourceId === "google_fit") {
      try {
        await disconnectGoogleFit(userId);
        setConnected((curr) => ({ ...curr, google_fit: false }));
        setActivities([]);
        onImported?.();
      } catch (err) {
        console.error("Failed to disconnect Google Fit", err);
      }
    } else {
      setConnected((curr) => ({ ...curr, [sourceId]: false }));
    }
  }

  async function handleFetch() {
    setFetching(true);
    setResult(null);
    setError(null);
    let fetched = [];

    const sourceIds = Object.keys(connected).filter((id) => connected[id]);
    for (const sourceId of sourceIds) {
      if (sourceId === "google_fit") {
        try {
          const res = await fetchGoogleFitActivities(userId, rangeDays);
          if (Array.isArray(res?.activities)) {
            fetched.push(...res.activities);
          }
        } catch (err) {
          console.error("Failed to fetch Google Fit activities", err);
          const msg = err?.response?.data?.message || err?.message || "Failed to fetch Google Fit activities.";
          setError(msg);
          if (err?.response?.status === 401 || err?.response?.status === 403 || /reconnect|revoked/i.test(msg)) {
            setConnected((curr) => ({ ...curr, google_fit: false }));
          }
        }
      } else {
        fetched.push(...generateImportActivities(sourceId, rangeDays));
      }
    }

    setActivities(fetched);
    setFetching(false);
  }

  function toggleActivity(id) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((current) => (current.size === activities.length ? new Set() : new Set(activities.map((a) => a.id))));
  }

  async function handleImport() {
    if (selectedActivities.length === 0) return;
    setImporting(true);
    setResult(null);
    try {
      const payload = selectedActivities.map((activity) => ({
        date: activity.date,
        vehicleType: activity.vehicleType,
        distanceKm: activity.distanceKm,
        name: activity.name,
        source: activity.source
      }));
      const data = await importActivities(userId, payload);
      setResult(data);
      setActivities([]);
      onImported?.();
    } finally {
      setImporting(false);
    }
  }

  const hasAnyConnected = connectedCount > 0;

  return (
    <div className="space-y-6">
      <motion.section variants={riseIn} className="workspace-card">
        <div className="mb-6">
          <p className="field-label">Import & Sync</p>
          <h2 className="mt-1 text-2xl font-medium text-black dark:text-white">Bring your activity data in</h2>
          <p className="mt-1 text-sm text-black/45 dark:text-white/50">
            Connect your Google Fit account and import recent walking, running, and cycling sessions straight into your carbon log.
          </p>

        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {IMPORT_SOURCES.map((source) => {
            const Icon = sourceIcons[source.id] ?? Activity;
            const isConnected = Boolean(connected[source.id]);
            return (
              <motion.article
                key={source.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className={`relative rounded-[24px] p-5 border transition ${
                  isConnected
                    ? "bg-[#f7faf5] border-[#0f5132]/40 dark:bg-[#222832] dark:border-emerald-500/40"
                    : "bg-white border-black/5 dark:bg-[#181d24] dark:border-white/10"
                }`}
              >
                {isConnected ? (
                  <span className="absolute -top-2 right-3 rounded-full bg-[#0f5132] dark:bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Connected
                  </span>
                ) : null}
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: source.color }}>
                    <Icon size={18} />
                  </div>
                  {isConnected ? (
                    <button
                      type="button"
                      onClick={() => handleDisconnect(source.id)}
                      className="text-[11px] font-semibold text-black/45 transition hover:text-red-500 dark:text-white/45 dark:hover:text-red-400"
                    >
                      Disconnect
                    </button>
                  ) : null}
                </div>
                <h4 className="mt-3 text-sm font-semibold text-black dark:text-white">{source.label}</h4>
                <p className="mt-1 text-xs leading-5 text-black/50 dark:text-white/55">{source.description}</p>
                <button
                  type="button"
                  onClick={() => {
                    if (source.id === "google_fit" && !isConnected) {
                      const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";
                      window.location.href = `${apiBase}/integrations/googlefit/auth?userId=${encodeURIComponent(userId ?? "")}`;
                    } else {
                      setOauthSource(source);
                    }
                  }}
                  className="mt-4 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-2xl text-xs font-semibold text-white transition hover:brightness-110"
                  style={{ backgroundColor: source.color }}
                >
                  {isConnected ? <RefreshCw size={13} /> : <ChevronRight size={13} />}
                  {isConnected ? "Re-sync source" : "Connect"}
                </button>
              </motion.article>
            );
          })}
        </div>
      </motion.section>

      {error ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-2xl bg-red-50 dark:bg-red-950/30 p-4 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-medium"
        >
          <AlertCircle size={16} className="shrink-0" />
          <p className="flex-1">{error}</p>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss error">
            <X size={14} />
          </button>
        </motion.div>
      ) : null}

      {hasAnyConnected ? (
        <motion.section variants={riseIn} className="workspace-card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="field-label">Sync window</p>
              <h2 className="mt-1 text-xl font-medium text-black dark:text-white">Fetch recent activities</h2>
              <p className="mt-1 text-xs text-black/45 dark:text-white/45">
                {connectedCount} source{connectedCount > 1 ? "s" : ""} connected · preview, then import what you want.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {[7, 14, 30].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setRangeDays(days)}
                  className={`rounded-2xl px-4 py-2.5 text-xs font-semibold transition ${
                    rangeDays === days
                      ? "bg-[#15171b] text-white dark:bg-emerald-600"
                      : "bg-white text-black/60 dark:bg-[#252c37] dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10"
                  }`}
                >
                  {days} days
                </button>
              ))}
              <button
                type="button"
                onClick={handleFetch}
                disabled={fetching}
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#0f5132] px-5 text-xs font-semibold text-white transition hover:bg-[#0b3d26] disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-700"
              >
                {fetching ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {fetching ? "Fetching…" : "Fetch activities"}
              </button>
            </div>
          </div>

          {activities.length > 0 ? (
            <>
              <div className="mt-6 rounded-[24px] border border-black/5 dark:border-white/10 bg-white dark:bg-[#181d24] overflow-hidden">
                <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={toggleAll}
                      aria-label="Select all"
                      className={`flex h-5 w-5 items-center justify-center rounded-md border transition ${
                        selected.size === activities.length && activities.length > 0
                          ? "bg-[#0f5132] border-[#0f5132] text-white dark:bg-emerald-600 dark:border-emerald-600"
                          : "border-black/20 dark:border-white/25"
                      }`}
                    >
                      {selected.size === activities.length && activities.length > 0 ? <Check size={12} /> : null}
                    </button>
                    <p className="text-sm font-semibold text-black dark:text-white">
                      {selected.size} of {activities.length} activities
                    </p>
                  </div>
                  <p className="text-xs text-black/45 dark:text-white/45">
                    ≈ {selectedEmissions} kg CO2e
                  </p>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {activities.map((activity) => {
                    const isSelected = selected.has(activity.id);
                    const emissions = activityEmissions(activity);
                    return (
                      <button
                        key={activity.id}
                        type="button"
                        onClick={() => toggleActivity(activity.id)}
                        className="flex w-full items-center gap-3 border-b border-black/5 dark:border-white/10 px-4 py-2.5 text-left transition hover:bg-black/[0.03] dark:hover:bg-white/5"
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                            isSelected
                              ? "bg-[#0f5132] border-[#0f5132] text-white dark:bg-emerald-600 dark:border-emerald-600"
                              : "border-black/20 dark:border-white/25"
                          }`}
                        >
                          {isSelected ? <Check size={12} /> : null}
                        </span>
                        <span className="text-lg">{activity.emoji}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-black dark:text-white">{activity.name}</span>
                          <span className="block text-[11px] text-black/45 dark:text-white/45">
                            {activity.date} · {activity.sourceLabel}
                          </span>
                        </span>
                        <span className="hidden w-20 text-right sm:block">
                          <span className="block text-sm font-semibold text-black dark:text-white">{activity.distanceKm} km</span>
                          <span className="block text-[10px] text-black/40 dark:text-white/40">~{activity.durationMin} min</span>
                        </span>
                        <span
                          className={`w-16 rounded-full px-2.5 py-1 text-center text-[11px] font-bold ${
                            emissions === 0
                              ? "bg-emerald-50 text-[#0f5132] dark:bg-emerald-500/15 dark:text-emerald-400"
                              : "bg-black/5 text-black/60 dark:bg-white/10 dark:text-white/60"
                          }`}
                        >
                          {emissions === 0 ? "0 kg" : `${emissions} kg`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={handleImport}
                disabled={importing || selectedActivities.length === 0}
                className="mt-4 inline-flex h-11 items-center gap-2 rounded-2xl bg-[#15171b] px-6 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-700"
              >
                {importing ? <Loader2 size={16} className="animate-spin" /> : <DownloadCloud size={16} />}
                {importing ? "Importing…" : `Import ${selectedActivities.length} to your log`}
              </button>
            </>
          ) : (
            <p className="mt-6 rounded-2xl bg-black/5 dark:bg-white/10 px-4 py-6 text-center text-sm text-black/50 dark:text-white/50">
              {fetching ? "Fetching your recent activity…" : "Pick a sync window and fetch activities to preview them here."}
            </p>
          )}

          {result ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 flex flex-wrap items-center gap-3 rounded-[24px] bg-[#0f5132] p-5 text-white shadow-md dark:bg-emerald-700"
            >
              <CheckCircle2 size={20} className="text-amber-300" />
              <div>
                <p className="font-semibold">
                  Imported {result.imported} activities · {result.totalEmissionsKg} kg CO2e
                </p>
                <p className="text-xs text-white/75">
                  {result.earnedBadges?.length
                    ? `New badges: ${result.earnedBadges.map((badge) => badge.label).join(", ")}!`
                    : "Your log and streaks are updated."}
                </p>
              </div>
              <Sparkles size={16} className="ml-auto text-amber-300" />
            </motion.div>
          ) : null}
        </motion.section>
      ) : null}

      <AnimatePresence>
        {oauthSource ? (
          <ConnectModal
            source={oauthSource}
            userId={userId}
            userName={userName}
            userEmail={userEmail}
            onClose={() => setOauthSource(null)}
            onConnected={handleConnected}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

