import { motion } from "framer-motion";
import {
  Award,
  Car,
  Check,
  CheckCircle2,
  Clock,
  Flame,
  Loader2,
  MapPin,
  Sparkles,
  UserCheck,
  UserMinus,
  UserPlus,
  X
} from "lucide-react";
import { useEffect, useState } from "react";
import { fetchCommunityProfile, removeFriend, respondFriendRequest, sendFriendRequest, toggleGoingOut } from "../services/api.js";
import MonthCalendar from "./MonthCalendar.jsx";

const TIER_STYLES = {
  sprout: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25",
  green: "bg-lime-50 text-lime-700 border-lime-200 dark:bg-lime-500/10 dark:text-lime-300 dark:border-lime-500/25",
  leaf: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-500/25",
  forest: "bg-green-100 text-green-800 border-green-300 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30",
  guardian: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/25"
};

function formatDay(day) {
  const date = new Date(`${day}T00:00:00`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function monthsFrom(currentIndex, count) {
  const months = [];
  for (let offset = -2; offset <= count; offset += 1) {
    const idx = currentIndex + offset;
    months.push({ year: Math.floor(idx / 12), month: idx % 12 });
  }
  return months;
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl bg-[#f7faf5] dark:bg-[#222832] p-4 border border-black/5 dark:border-white/10">
      <div className="flex items-center gap-1.5 text-black/45 dark:text-white/45">
        <Icon size={13} />
        <p className="text-[10px] font-semibold uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold leading-none text-black dark:text-white">{value}</p>
    </div>
  );
}

function FriendActions({ status, busy, onSend, onAccept, onDecline, onRemove, onClose }) {
  if (status === "pending") {
    return (
      <div className="inline-flex items-center gap-2 rounded-2xl bg-amber-100 px-4 py-2.5 text-sm font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
        <Clock size={15} />
        Request sent — waiting for response
      </div>
    );
  }
  if (status === "requested") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onAccept}
          className="inline-flex h-10 items-center gap-2 rounded-2xl bg-[#0f5132] px-4 text-sm font-semibold text-white transition hover:bg-[#0b3d26] dark:bg-emerald-600 dark:hover:bg-emerald-700"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          Accept request
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onDecline}
          className="inline-flex h-10 items-center gap-2 rounded-2xl bg-black/5 px-4 text-sm font-semibold text-black/60 transition hover:bg-black/10 dark:bg-white/10 dark:text-white/60 dark:hover:bg-white/15"
        >
          Decline
        </button>
      </div>
    );
  }
  if (status === "friends") {
    return (
      <div className="inline-flex items-center gap-3">
        <div className="inline-flex items-center gap-2 rounded-2xl bg-[#0f5132]/10 px-4 py-2.5 text-sm font-semibold text-[#0f5132] dark:bg-emerald-500/20 dark:text-emerald-400">
          <UserCheck size={15} />
          Friends
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-black/40 transition hover:text-red-500 dark:text-white/40"
        >
          <UserMinus size={13} />
          Remove
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onSend}
      className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#0f5132] px-5 text-sm font-semibold text-white transition hover:bg-[#0b3d26] dark:bg-emerald-600 dark:hover:bg-emerald-700"
    >
      {busy ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
      Add friend
    </button>
  );
}

export default function ProfileDrawer({ viewerId, profileId, initialRow, onClose, onChanged }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const data = await fetchCommunityProfile(viewerId, profileId);
    if (!data || !data.user) {
      setError("Profile not found.");
      setLoading(false);
      return;
    }
    setProfile(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerId, profileId]);

  async function runAction(action, ...args) {
    setBusy(true);
    setError("");
    try {
      await action(...args);
      onChanged?.();
      await load();
    } catch (err) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const now = new Date();
  const currentIndex = now.getFullYear() * 12 + now.getMonth();

  const fullAccess = profile?.isSelf || profile?.isFriends;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
        <motion.aside
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
          className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white dark:bg-[#14181f] shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <header className="flex items-center justify-between border-b border-black/5 dark:border-white/10 px-5 py-4">
            <div className="flex items-center gap-3">
              {initialRow?.picture || profile?.user?.picture ? (
                <img
                  src={initialRow?.picture ?? profile?.user?.picture}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0f5132] text-sm font-bold text-white uppercase dark:bg-emerald-600">
                  {(initialRow?.name ?? profile?.user?.name ?? "E").charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-black dark:text-white">
                  {initialRow?.name ?? profile?.user?.name}
                </h3>
                <p className="flex items-center gap-1 text-xs text-black/45 dark:text-white/45">
                  <MapPin size={10} />
                  {initialRow?.city ?? profile?.user?.city ?? "New Delhi"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-black/40 transition hover:bg-black/5 hover:text-black dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label="Close profile"
            >
              <X size={18} />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            {loading ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 size={20} className="animate-spin text-black/30 dark:text-white/30" />
              </div>
            ) : error ? (
              <div className="flex h-48 flex-col items-center justify-center gap-2 text-sm text-black/45 dark:text-white/45">
                <UserMinus size={20} />
                {error}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-sm font-bold text-black dark:text-white">
                      <Award size={14} className="text-[#0f5132] dark:text-emerald-400" />
                      {profile.stats.badgesCount} badges
                    </div>
                    <div className="flex items-center gap-1.5 text-sm font-bold text-[#0f5132] dark:text-emerald-400">
                      <Sparkles size={14} />
                      {profile.user.rewardPoints} pts
                    </div>
                  </div>
                  <FriendActions
                    status={profile.friendshipStatus}
                    busy={busy}
                    onSend={() => runAction(sendFriendRequest, viewerId, profileId)}
                    onAccept={() => runAction(respondFriendRequest, viewerId, profileId, true)}
                    onDecline={() => runAction(respondFriendRequest, viewerId, profileId, false)}
                    onRemove={() => runAction(removeFriend, viewerId, profileId)}
                    onClose={onClose}
                  />
                </div>

                {error ? <p className="text-xs font-semibold text-red-500">{error}</p> : null}

                {!fullAccess ? (
                  <div className="rounded-2xl bg-black/5 dark:bg-white/10 px-4 py-4 text-xs font-medium leading-5 text-black/50 dark:text-white/50">
                    Become friends to see {profile.user.name}'s streak, logged-day calendar, badges, and going-out days for carpooling.
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <Stat icon={Flame} label="Streak" value={profile.stats.currentStreak} />
                      <Stat icon={CheckCircle2} label="Best" value={profile.stats.bestStreak} />
                      <Stat icon={CalendarDays} label="Days" value={profile.stats.totalDaysLogged} />
                    </div>

                    <section>
                      <p className="field-label">Logged days</p>
                      <p className="mb-3 mt-1 text-xs text-black/45 dark:text-white/45">
                        Amber dots mark days {profile.isSelf ? "you" : profile.user.name} logged a check-in.
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        {monthsFrom(currentIndex, 1).map(({ year, month }) => (
                          <div key={`${year}-${month}`}>
                            <p className="mb-2 text-xs font-semibold text-black/60 dark:text-white/60">{monthLabel(year, month)}</p>
                            <MonthCalendar year={year} month={month} marked={profile.loggedDays} />
                          </div>
                        ))}
                      </div>
                    </section>

                    <section>
                      <p className="field-label">Going out</p>
                      <p className="mb-3 mt-1 text-xs text-black/45 dark:text-white/45">
                        {profile.isSelf ? (
                          <>Tap days you'll be going out so friends can plan carpools.</>
                        ) : (
                          <>Days {profile.user.name} is planning to go out.</>
                        )}
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        {monthsFrom(currentIndex, 1).map(({ year, month }) => (
                          <div key={`${year}-${month}`}>
                            <p className="mb-2 text-xs font-semibold text-black/60 dark:text-white/60">{monthLabel(year, month)}</p>
                            <MonthCalendar
                              year={year}
                              month={month}
                              selected={profile.goingOutDays}
                              selectable={profile.isSelf}
                              onToggle={async (date) => {
                                const result = await toggleGoingOut(viewerId, date);
                                setProfile({ ...profile, goingOutDays: result.goingOutDays });
                                onChanged?.();
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </section>

                    {profile.isFriends ? (
                      <section className="rounded-[28px] bg-[#f7faf5] dark:bg-[#222832] border border-black/5 dark:border-white/10 p-5">
                        <p className="flex items-center gap-2 text-sm font-semibold text-black dark:text-white">
                          <Car size={14} className="text-[#0f5132] dark:text-emerald-400" />
                          Carpool together
                        </p>
                        {profile.commonGoingOutDays.length > 0 ? (
                          <>
                            <p className="mt-1 text-xs text-black/45 dark:text-white/45">
                              Common going-out days with {profile.user.name} — great opportunities to share a ride.
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {profile.commonGoingOutDays.map((day) => (
                                <span
                                  key={day}
                                  className="inline-flex items-center gap-1.5 rounded-full bg-[#0f5132]/10 dark:bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-[#0f5132] dark:text-emerald-400"
                                >
                                  <Car size={11} />
                                  {formatDay(day)}
                                </span>
                              ))}
                            </div>
                          </>
                        ) : (
                          <p className="mt-1 text-xs text-black/45 dark:text-white/45">
                            No overlapping going-out days yet. Log your going-out days and check back soon.
                          </p>
                        )}
                      </section>
                    ) : null}

                    <section>
                      <p className="field-label">Badges</p>
                      {profile.badges.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {profile.badges.map((badge) => (
                            <span
                              key={badge.code}
                              title={badge.description}
                              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${TIER_STYLES[badge.tier] ?? TIER_STYLES.sprout}`}
                            >
                              <Award size={11} />
                              {badge.label}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-black/45 dark:text-white/45">No badges earned yet.</p>
                      )}
                    </section>
                  </>
                )}
              </div>
            )}
          </div>
        </motion.aside>
    </motion.div>
  );
}
