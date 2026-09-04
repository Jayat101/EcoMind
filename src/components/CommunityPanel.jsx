import { AnimatePresence, motion } from "framer-motion";
import {
  Award,
  CalendarDays,
  Car,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Crown,
  Flame,
  Loader2,
  MapPin,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  claimCommunityChallenge,
  fetchCommunityChallenge,
  fetchCommunityProfile,
  fetchFriends,
  fetchLeaderboard,
  respondFriendRequest,
  toggleGoingOut
} from "../services/api.js";
import MonthCalendar from "./MonthCalendar.jsx";
import ProfileDrawer from "./ProfileDrawer.jsx";

const riseIn = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1 }
};

const rankStyles = {
  1: { bg: "bg-amber-400 text-black", label: "text-amber-500 dark:text-amber-400" },
  2: { bg: "bg-slate-300 text-black", label: "text-slate-400" },
  3: { bg: "bg-amber-600 text-white", label: "text-amber-600 dark:text-amber-400" }
};

function RankBadge({ rank }) {
  if (rank <= 3) {
    return (
      <span className={`flex h-7 w-7 items-center justify-center rounded-xl text-xs font-bold ${rankStyles[rank].bg}`}>
        {rank}
      </span>
    );
  }
  return <span className="text-sm font-bold text-black/40 dark:text-white/40">{rank}</span>;
}

function Avatar({ picture, name, isYou, size = "h-9 w-9" }) {
  if (picture) {
    return (
      <img
        src={picture}
        alt=""
        onError={(e) => {
          e.currentTarget.style.display = "none";
          e.currentTarget.nextElementSibling.style.display = "flex";
        }}
        className={`${size} shrink-0 rounded-full object-cover`}
      />
    );
  }
  return (
    <div
      className={`flex ${size} shrink-0 items-center justify-center rounded-full text-xs font-bold text-white uppercase ${
        isYou ? "bg-[#0f5132] dark:bg-emerald-600" : "bg-black/20 dark:bg-white/15"
      }`}
    >
      {(name ?? "E").charAt(0)}
    </div>
  );
}

function Leaderboard({ board, onSelectRow }) {
  const rows = board?.leaderboard ?? [];
  return (
    <motion.section variants={riseIn} className="workspace-card">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="field-label">Community</p>
          <h2 className="mt-1 text-2xl font-medium text-black dark:text-white">Weekly leaderboard</h2>
        </div>
        <span className="rounded-full bg-[#0f5132]/10 dark:bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-[#0f5132] dark:text-emerald-400">
          Lowest footprint wins
        </span>
      </div>

      <div className="space-y-2">
        {rows.map((row, index) => {
          const isYou = row.isUser;
          return (
            <motion.div
              key={row.userId ?? row.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
              onClick={() => onSelectRow?.(row)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectRow?.(row);
                }
              }}
              className={`flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 border transition hover:shadow-md ${
                isYou
                  ? "bg-[#f7faf5] border-[#0f5132]/40 dark:bg-[#222832] dark:border-emerald-500/40"
                  : "bg-white border-black/5 dark:bg-[#181d24] dark:border-white/10"
              }`}
            >
              <RankBadge rank={row.rank} />

              <Avatar picture={row.picture} name={row.name} isYou={isYou} />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-semibold text-black dark:text-white">{row.name}</p>
                  {row.streak > 0 ? (
                    <span
                      className="inline-flex items-center gap-0.5 rounded-full bg-orange-500/15 dark:bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-bold text-orange-600 dark:text-orange-400"
                      title={`${row.streak}-day streak`}
                    >
                      <Flame size={11} />
                      {row.streak}
                    </span>
                  ) : null}
                  {isYou ? (
                    <span className="rounded-full bg-[#0f5132] dark:bg-emerald-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                      You
                    </span>
                  ) : null}
                  {row.rank === 1 && !isYou ? <Crown size={13} className="text-amber-500" /> : null}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-black/45 dark:text-white/45">
                  <MapPin size={10} />
                  {row.city}
                  <span className="mx-0.5">·</span>
                  <Award size={10} />
                  {row.badges ?? 0} badges
                </div>
              </div>

              <div className="hidden items-center gap-1 sm:flex">
                {row.improvementPercent > 0 ? (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-[#0f5132] dark:text-emerald-400">
                    <TrendingDown size={11} />
                    {Math.abs(row.improvementPercent)}%
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-red-50 dark:bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
                    <TrendingUp size={11} />
                    {Math.abs(row.improvementPercent)}%
                  </span>
                )}
              </div>

              <div className="w-20 text-right">
                <p className="text-sm font-bold leading-none text-black dark:text-white">{row.weeklyKg}</p>
                <p className="text-[10px] text-black/40 dark:text-white/40">kg / week</p>
              </div>

              <div className="hidden w-16 text-right md:block">
                <p className="text-sm font-semibold leading-none text-[#0f5132] dark:text-emerald-400">{row.points}</p>
                <p className="text-[10px] text-black/40 dark:text-white/40">pts</p>
              </div>

              <ChevronRight size={15} className="shrink-0 text-black/25 dark:text-white/25" />
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
}

function ChallengeCard({ challenge, onClaimed }) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function handleClaim() {
    setBusy(true);
    setFeedback("");
    try {
      await onClaimed();
    } catch (error) {
      setFeedback(error.message ?? "Could not claim reward.");
    } finally {
      setBusy(false);
    }
  }

  if (!challenge) {
    return (
      <motion.section variants={riseIn} className="workspace-card">
        <div className="flex h-40 items-center justify-center">
          <Loader2 size={20} className="animate-spin text-black/30 dark:text-white/30" />
        </div>
      </motion.section>
    );
  }

  const pct = Math.min(100, challenge.progressPct ?? 0);

  return (
    <motion.section variants={riseIn} className="workspace-card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="field-label">Monthly Challenge</p>
          <h2 className="mt-1 text-xl font-medium text-black dark:text-white">{challenge.monthLabel}</h2>
        </div>
        <span className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 px-3 py-1 text-xs font-semibold inline-flex items-center gap-1">
          <Target size={12} />
          {challenge.rewardPoints} pts
        </span>
      </div>

      <h3 className="text-sm font-semibold text-black dark:text-white">{challenge.title}</h3>
      <p className="mt-1 text-xs leading-5 text-black/50 dark:text-white/55">{challenge.description}</p>

      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <p className="font-semibold text-black dark:text-white">
            {challenge.progressKg} <span className="text-black/40 dark:text-white/40">of {challenge.targetKg} kg</span>
          </p>
          <p className="text-black/45 dark:text-white/45">{pct}%</p>
        </div>
        <div className="h-3 rounded-full bg-black/8 dark:bg-white/10">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, pct)}%` }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className={`h-full rounded-full ${
              challenge.completed ? "bg-[#0f5132] dark:bg-emerald-500" : "bg-amber-400"
            }`}
          />
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-black/45 dark:text-white/45">
          <CalendarDays size={12} />
          {challenge.daysLeft > 0 ? `${challenge.daysLeft} days left this month` : "Last day of the month"}
          <span className="mx-1">·</span>
          {challenge.daysLogged ?? challenge.totalDaysLogged}/{challenge.minDaysLogged ?? 20} days logged
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-black/45 dark:text-white/45">
          <Clock size={12} />
          {challenge.accountAgeDays ?? 0}/{challenge.minAccountAgeDays ?? 30} days account age
        </p>
      </div>

      <div className="mt-5">
        {challenge.claimed ? (
          <div className="inline-flex items-center gap-2 rounded-2xl bg-[#0f5132]/10 dark:bg-emerald-500/20 px-4 py-3 text-sm font-semibold text-[#0f5132] dark:text-emerald-400">
            <CheckCircle2 size={16} />
            Reward claimed for this month
          </div>
        ) : challenge.completed ? (
          <button
            type="button"
            disabled={busy}
            onClick={handleClaim}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#0f5132] text-white transition hover:bg-[#0b3d26] dark:bg-emerald-600 dark:hover:bg-emerald-700"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Claim {challenge.rewardPoints} points
          </button>
        ) : (
          <p className="rounded-2xl bg-black/5 dark:bg-white/10 px-4 py-3 text-xs font-medium text-black/50 dark:text-white/50">
            Stay under {challenge.targetKg} kg, log at least {challenge.minDaysLogged ?? 20} days this month, and have an account at least {(challenge.minAccountAgeDays ?? 30) / 30} month(s) old to unlock {challenge.rewardPoints} points.
          </p>
        )}
      </div>

      <AnimatePresence>
        {feedback ? (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 text-xs font-semibold text-[#0f5132] dark:text-emerald-400"
          >
            {feedback}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </motion.section>
  );
}

function FriendsCard({ friends, onOpenProfile, onRespond }) {
  const [busyId, setBusyId] = useState(null);
  const incoming = friends?.incoming ?? [];
  const outgoing = friends?.outgoing ?? [];
  const friendRows = friends?.friends ?? [];

  async function handleRespond(friend, accept) {
    setBusyId(friend.userId);
    try {
      await onRespond(friend.userId, accept);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <motion.section variants={riseIn} className="workspace-card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="field-label">Friends</p>
          <h2 className="mt-1 text-xl font-medium text-black dark:text-white">Your circle</h2>
        </div>
        <span className="rounded-full bg-black/5 dark:bg-white/10 px-2.5 py-1 text-xs font-semibold text-black/50 dark:text-white/50">
          {friendRows.length}
        </span>
      </div>

      {incoming.length > 0 ? (
        <div className="mb-4 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            Friend requests ({incoming.length})
          </p>
          {incoming.map((friend) => (
            <div
              key={friend.userId}
              className="flex items-center gap-2 rounded-2xl border border-black/5 bg-white px-3 py-2 dark:border-white/10 dark:bg-[#181d24]"
            >
              <Avatar picture={friend.picture} name={friend.name} />
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => onOpenProfile(friend)}
                  className="block truncate text-sm font-semibold text-black hover:underline dark:text-white"
                >
                  {friend.name}
                </button>
                <p className="text-[11px] text-black/40 dark:text-white/40">{friend.city}</p>
              </div>
              <button
                type="button"
                disabled={busyId === friend.userId}
                onClick={() => handleRespond(friend, true)}
                className="inline-flex h-8 items-center gap-1 rounded-xl bg-[#0f5132] px-2.5 text-xs font-semibold text-white transition hover:bg-[#0b3d26] dark:bg-emerald-600 dark:hover:bg-emerald-700"
              >
                {busyId === friend.userId ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Accept
              </button>
              <button
                type="button"
                disabled={busyId === friend.userId}
                onClick={() => handleRespond(friend, false)}
                className="inline-flex h-8 items-center rounded-xl bg-black/5 px-2.5 text-xs font-semibold text-black/50 transition hover:bg-black/10 dark:bg-white/10 dark:text-white/50 dark:hover:bg-white/15"
              >
                Decline
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {outgoing.length > 0 ? (
        <div className="mb-4 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">Sent</p>
          {outgoing.map((friend) => (
            <div
              key={friend.userId}
              className="flex items-center gap-2 rounded-2xl border border-black/5 bg-white px-3 py-2 dark:border-white/10 dark:bg-[#181d24]"
            >
              <Avatar picture={friend.picture} name={friend.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-black/60 dark:text-white/60">{friend.name}</p>
                <p className="text-[11px] text-black/40 dark:text-white/40">{friend.city}</p>
              </div>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                Sent
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-2">
        {friendRows.length > 0 ? (
          friendRows.map((friend) => (
            <button
              type="button"
              key={friend.userId}
              onClick={() => onOpenProfile(friend)}
              className="flex w-full items-center gap-2 rounded-2xl border border-black/5 bg-white px-3 py-2 text-left transition hover:shadow-md dark:border-white/10 dark:bg-[#181d24]"
            >
              <Avatar picture={friend.picture} name={friend.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-black dark:text-white">{friend.name}</p>
                <p className="text-[11px] text-black/40 dark:text-white/40">
                  {friend.city} · {friend.weeklyKg} kg/wk
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#0f5132]/10 px-2 py-0.5 text-[10px] font-bold text-[#0f5132] dark:bg-emerald-500/20 dark:text-emerald-400">
                <UserCheck size={10} />
                Friends
              </span>
            </button>
          ))
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-black/5 dark:bg-white/10 px-4 py-6 text-center">
            <Users size={18} className="text-black/30 dark:text-white/30" />
            <p className="text-xs font-medium text-black/45 dark:text-white/45">
              No friends yet. Tap anyone on the leaderboard to send a request.
            </p>
          </div>
        )}
      </div>
    </motion.section>
  );
}

function GoingOutCard({ goingOutDays, onToggle }) {
  const now = new Date();
  const currentIndex = now.getFullYear() * 12 + now.getMonth();
  const months = [0, 1].map((offset) => {
    const idx = currentIndex + offset;
    return { year: Math.floor(idx / 12), month: idx % 12 };
  });
  const monthLabel = (year, month) =>
    new Date(year, month, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });

  return (
    <motion.section variants={riseIn} className="workspace-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="field-label">Carpool planner</p>
          <h2 className="mt-1 text-xl font-medium text-black dark:text-white">Going out</h2>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0f5132]/10 px-3 py-1 text-xs font-semibold text-[#0f5132] dark:bg-emerald-500/20 dark:text-emerald-400">
          <Car size={12} />
          {goingOutDays.length} days
        </span>
      </div>
      <p className="mb-4 text-xs leading-5 text-black/45 dark:text-white/45">
        Tap the days you'll be going out. Friends can then see your calendar and spot common days to carpool.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {months.map(({ year, month }) => (
          <div key={`${year}-${month}`}>
            <p className="mb-2 text-xs font-semibold text-black/60 dark:text-white/60">{monthLabel(year, month)}</p>
            <MonthCalendar year={year} month={month} selected={goingOutDays} selectable onToggle={onToggle} />
          </div>
        ))}
      </div>
    </motion.section>
  );
}

function StatTile({ icon: Icon, label, value, suffix }) {
  return (
    <motion.div variants={riseIn} className="rounded-[28px] bg-[#f7faf5] dark:bg-[#222832] p-5 border border-black/5 dark:border-white/10">
      <div className="flex items-center gap-2 text-black/45 dark:text-white/45">
        <Icon size={14} />
        <p className="text-[11px] font-semibold uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-3 text-3xl font-semibold leading-none text-black dark:text-white">
        {value}
        {suffix ? <span className="text-sm font-normal text-black/45 dark:text-white/45">{suffix}</span> : null}
      </p>
    </motion.div>
  );
}

export default function CommunityPanel({ userId, onChallengeClaimed }) {
  const [board, setBoard] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const [friends, setFriends] = useState(null);
  const [goingOutDays, setGoingOutDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRow, setSelectedRow] = useState(null);

  async function load() {
    if (!userId) return;
    setLoading(true);
    const [boardData, challengeData, friendsData, selfProfile] = await Promise.all([
      fetchLeaderboard(userId),
      fetchCommunityChallenge(userId),
      fetchFriends(userId),
      fetchSelfProfile(userId)
    ]);
    setBoard(boardData);
    setChallenge(challengeData);
    setFriends(friendsData);
    setGoingOutDays(selfProfile?.goingOutDays ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function handleClaim() {
    await claimCommunityChallenge(userId);
    await load();
    onChallengeClaimed?.();
  }

  async function handleToggleGoingOut(date) {
    const result = await toggleGoingOut(userId, date);
    setGoingOutDays(result.goingOutDays ?? []);
  }

  async function handleRespond(requesterId, accept) {
    await respondFriendRequest(userId, requesterId, accept);
    await load();
  }

  function openProfileFromRow(row) {
    setSelectedRow(row);
  }

  function openProfileFromFriend(friend) {
    setSelectedRow({ userId: friend.userId, name: friend.name, city: friend.city, picture: friend.picture });
  }

  if (loading) {
    return (
      <motion.div variants={riseIn} className="workspace-card flex h-64 items-center justify-center">
        <Loader2 size={22} className="animate-spin text-black/30 dark:text-white/30" />
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile icon={Crown} label="Your rank" value={board?.yourRank ?? "—"} suffix={board?.yourRank ? ` / ${board.totalParticipants}` : ""} />
        <StatTile icon={TrendingDown} label="Community median" value={board?.medianWeeklyKg ?? "—"} suffix=" kg / week" />
        <StatTile icon={Users} label="Participants" value={board?.totalParticipants ?? 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-4">
          <ChallengeCard challenge={challenge} onClaimed={handleClaim} />
          <FriendsCard friends={friends} onOpenProfile={openProfileFromFriend} onRespond={handleRespond} />
        </div>
        <div className="space-y-6 lg:col-span-8">
          <Leaderboard board={board} onSelectRow={openProfileFromRow} />
          <GoingOutCard goingOutDays={goingOutDays} onToggle={handleToggleGoingOut} />
        </div>
      </div>

      <AnimatePresence>
        {selectedRow ? (
          <ProfileDrawer
            viewerId={userId}
            profileId={selectedRow.userId}
            initialRow={selectedRow}
            onClose={() => setSelectedRow(null)}
            onChanged={load}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

async function fetchSelfProfile(userId) {
  const data = await fetchCommunityProfile(userId, userId);
  return data && data.user ? data : null;
}
