import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import morgan from "morgan";
import {
  appendEntry,
  appendEntries,
  claimChallengeReward,
  deleteEntry,
  getEntries,
  getUser,
  loginGoogleUser,
  loginUserWithPassword,
  redeemItem,
  registerUser,
  replaceUser,
  resetUserData,
  sendVerificationCode,
  setStreakProtection,
  signupGoogleUser,
  updateEntry,
  upsertUser,
  verifyCode,
  getStateSnapshot,
  setGoogleFitTokens,
  getGoogleFitTokens,
  sendForgotPasswordCode,
  resetPasswordWithCode,
  toggleGoingOutDay,
  sendFriendRequest,
  respondFriendRequest,
  removeFriend,
  getTrackedTrips,
  saveTrackedTrip,
  deleteTrackedTrip
} from "./lib/store.js";
import {
  buildForecast,
  buildGoals,
  buildRecommendations,
  buildTrend,
  calculateEntryFromPayload,
  calculateStats,
  evaluateBadges
} from "./lib/engine.js";
import { computePremiumUntil, findShopItem, getShopCatalog } from "../../src/services/shop.js";
import { buildFriends, buildLeaderboard, buildMonthlyChallenge, buildCommunityProfile } from "../../src/services/community.js";
import {
  buildAuthUrl,
  exchangeCodeForTokens,
  fetchActivities,
  getValidAccessToken,
  isGoogleFitConfigured
} from "./lib/googlefit.js";
import { autoFreezeStreak } from "../../src/services/streak.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, "../../dist");

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const app = express();
const port = Number(process.env.PORT ?? 5000);

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  ...(process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(",").map((o) => o.trim()) : [])
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    }
  })
);
app.use(express.json({ limit: "30mb" }));
app.use(morgan("dev"));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, db: process.env.MONGODB_URI ? "mongodb" : "json" });
});

async function ensureUser(userId) {
  const existing = await getUser(userId);
  if (!existing) {
    throw new Error("User not found. Please sign up or log in first.");
  }
  return existing;
}

async function buildDashboard(userId) {
  let profile = await ensureUser(userId);
  const entries = await getEntries(userId);
  const protection = autoFreezeStreak(entries, profile);
  if (protection) {
    await setStreakProtection(userId, protection);
    profile = { ...profile, ...protection };
  }
  const stats = calculateStats(entries, profile.weeklyEmissionTargetKg);
  const recommendations = buildRecommendations(stats.categoryTotals);
  const trend = buildTrend(entries);
  const forecast = buildForecast(entries);
  const localEntries = entries.filter((entry) => entry.source !== "seed");
  const goals = buildGoals(localEntries, profile.badges ?? [], stats, profile.weeklyEmissionTargetKg, profile.streakFrozenDays ?? []);

  return {
    profile,
    stats,
    trend,
    forecast,
    recommendations,
    badges: profile.badges ?? [],
    goals,
    rewardPoints: profile.rewardPoints ?? 0
  };
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "EcoMind API" });
});

// Authentication & Verification Endpoints
app.post("/api/auth/send-verification", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }
    const result = await sendVerificationCode(email);
    res.json({
      success: true,
      sent: result.sent,
      email: result.email,
      message: result.sent
        ? `📧 Verification code sent to ${result.email}! Please check your inbox.`
        : `💡 Email delivery offline. Use verification code: ${result.code} to complete registration.`,
      ...(!result.sent ? { devCode: result.code } : {})
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.post("/api/auth/verify-code", async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ message: "Email and 6-digit code are required." });
    }
    await verifyCode(email, code);
    res.json({ verified: true, message: "Email verified successfully!" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }
    const result = await sendForgotPasswordCode(email);
    res.json({
      success: true,
      sent: result.sent,
      email: result.email,
      message: result.sent
        ? `📧 Password reset code sent to ${result.email}! Please check your inbox.`
        : `💡 Email delivery offline. Use reset code: ${result.code} to reset your password.`,
      ...(!result.sent ? { devCode: result.code } : {})
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ message: "Email, 6-digit code, and new password are required." });
    }
    const user = await resetPasswordWithCode({ email, code, newPassword });
    res.json({ user, message: "Password reset successfully! You are now logged in." });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


app.post("/api/auth/signup", async (req, res, next) => {
  try {
    const { name, email, password, city, weeklyEmissionTargetKg } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required." });
    }
    const user = await registerUser({ name, email, password, city, weeklyEmissionTargetKg });
    res.status(201).json({ user, message: "Account created successfully!" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }
    const user = await loginUserWithPassword({ email, password });
    res.json({ user, message: "Logged in successfully!" });
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
});

app.post("/api/auth/google", async (req, res, next) => {
  try {
    const { email, name, picture, sub } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Google profile email is required." });
    }
    const user = await loginGoogleUser({ email, name, picture, sub });
    res.json({ user, message: "Google Sign-In successful!" });
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
});

app.post("/api/auth/google/signup", async (req, res, next) => {
  try {
    const { email, name, picture, sub, city, weeklyEmissionTargetKg } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Google profile email is required." });
    }
    const user = await signupGoogleUser({ email, name, picture, sub, city, weeklyEmissionTargetKg });
    res.json({ user, message: "Google account created successfully!" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.post("/api/users", async (req, res, next) => {
  try {
    const { userId, name, email, city, weeklyEmissionTargetKg, picture } = req.body;
    if (!userId || !name) {
      return res.status(400).json({ message: "userId and name are required" });
    }

    const user = await upsertUser({
      userId,
      name,
      email,
      city,
      picture,
      weeklyEmissionTargetKg: weeklyEmissionTargetKg ?? 85
    });

    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

app.get("/api/users/:userId", async (req, res, next) => {
  try {
    const user = await getUser(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
});

app.post("/api/carbon/log", async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    const profile = await ensureUser(userId);
    const entry = await calculateEntryFromPayload(req.body);
    await appendEntry(userId, entry);

    const entries = await getEntries(userId);
    const stats = calculateStats(entries, profile.weeklyEmissionTargetKg);
    const newlyEarned = evaluateBadges(
      entries.filter((item) => item.source !== "seed"),
      profile.badges ?? [],
      stats,
      profile
    );

    const nextProfile = {
      ...profile,
      badges: [...(profile.badges ?? []), ...newlyEarned],
      rewardPoints: (profile.rewardPoints ?? 0) + newlyEarned.reduce((sum, badge) => sum + badge.points, 0)
    };

    await replaceUser(userId, nextProfile);

    res.status(201).json({
      entry,
      earnedBadges: newlyEarned,
      rewardPoints: nextProfile.rewardPoints
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/carbon/dashboard/:userId", async (req, res, next) => {
  try {
    const dashboard = await buildDashboard(req.params.userId);
    res.json(dashboard);
  } catch (error) {
    next(error);
  }
});

app.get("/api/carbon/entries/:userId", async (req, res, next) => {
  try {
    const entries = await getEntries(req.params.userId);
    res.json(entries);
  } catch (error) {
    next(error);
  }
});

app.put("/api/carbon/entries/:userId/:entryId", async (req, res, next) => {
  try {
    const { userId, entryId } = req.params;
    await ensureUser(userId);
    const entry = await calculateEntryFromPayload({ ...req.body, id: entryId });
    const updated = await updateEntry(userId, entryId, entry);
    const dashboard = await buildDashboard(userId);
    res.json({ entry: updated, dashboard });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/carbon/entries/:userId/:entryId", async (req, res, next) => {
  try {
    const { userId, entryId } = req.params;
    await ensureUser(userId);
    const entries = await deleteEntry(userId, entryId);
    const dashboard = await buildDashboard(userId);
    res.json({ entryId, entries, dashboard });
  } catch (error) {
    next(error);
  }
});

app.post("/api/carbon/reset/:userId", async (req, res, next) => {
  try {
    const userId = req.params.userId;
    await resetUserData(userId);
    const dashboard = await buildDashboard(userId);
    res.json(dashboard);
  } catch (error) {
    next(error);
  }
});

// Community — Leaderboard & Monthly Challenge
app.get("/api/community/leaderboard", async (req, res, next) => {
  try {
    const snapshot = await getStateSnapshot();
    const board = buildLeaderboard(snapshot, req.query.userId ?? null);
    res.json(board);
  } catch (error) {
    next(error);
  }
});

app.get("/api/community/challenge", async (req, res, next) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }
    const snapshot = await getStateSnapshot();
    res.json(buildMonthlyChallenge(snapshot, userId));
  } catch (error) {
    next(error);
  }
});

// Community — profiles, friends & going-out (carpool)
app.get("/api/community/profile/:profileId", async (req, res, next) => {
  try {
    const viewerId = String(req.query.viewer ?? "");
    const snapshot = await getStateSnapshot();
    const profile = buildCommunityProfile(snapshot, viewerId, req.params.profileId);
    if (!profile) {
      return res.status(404).json({ message: "Profile not found." });
    }
    res.json(profile);
  } catch (error) {
    next(error);
  }
});

app.get("/api/community/friends/:userId", async (req, res, next) => {
  try {
    const snapshot = await getStateSnapshot();
    res.json(buildFriends(snapshot, req.params.userId));
  } catch (error) {
    next(error);
  }
});

app.post("/api/community/friends/request", async (req, res, next) => {
  try {
    const { fromUserId, toUserId } = req.body;
    if (!fromUserId || !toUserId) {
      return res.status(400).json({ message: "fromUserId and toUserId are required." });
    }
    await sendFriendRequest(fromUserId, toUserId);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.post("/api/community/friends/respond", async (req, res, next) => {
  try {
    const { userId, requesterId, accept } = req.body;
    if (!userId || !requesterId) {
      return res.status(400).json({ message: "userId and requesterId are required." });
    }
    const result = await respondFriendRequest(userId, requesterId, Boolean(accept));
    res.json({ ok: true, accepted: result.accepted });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.post("/api/community/friends/remove", async (req, res, next) => {
  try {
    const { userId, friendId } = req.body;
    if (!userId || !friendId) {
      return res.status(400).json({ message: "userId and friendId are required." });
    }
    const result = await removeFriend(userId, friendId);
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.post("/api/community/going-out", async (req, res, next) => {
  try {
    const { userId, date } = req.body;
    if (!userId || !date) {
      return res.status(400).json({ message: "userId and date are required." });
    }
    const result = await toggleGoingOutDay(userId, date);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.post("/api/community/challenge/claim", async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }
    await ensureUser(userId);
    const result = await claimChallengeReward(userId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Import — bulk activity sync from fitness / ride apps
app.post("/api/import/activities", async (req, res, next) => {
  try {
    const { userId, activities } = req.body;
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }
    if (!Array.isArray(activities) || activities.length === 0) {
      return res.status(400).json({ message: "activities array is required" });
    }

    const profile = await ensureUser(userId);
    const entries = [];

    for (const activity of activities) {
      const entry = await calculateEntryFromPayload({
        date: activity.date,
        transportation: {
          vehicleType: activity.vehicleType ?? "walk",
          distanceKm: Number(activity.distanceKm ?? 0)
        },
        energy: { acHours: 0, heavyAppliance: "none" },
        lifestyle: { dietType: "none", takeoutMeals: 0, newGoodsPurchased: "none", recycledOrComposted: false },
        notes: activity.name ?? "Imported activity"
      });
      entry.source = "import";
      entry.importedFrom = activity.source ?? "external";
      entries.push(entry);
    }

    await appendEntries(userId, entries);

    const allEntries = await getEntries(userId);
    const stats = calculateStats(allEntries, profile.weeklyEmissionTargetKg);
    const newlyEarned = evaluateBadges(
      allEntries.filter((entry) => entry.source !== "seed"),
      profile.badges ?? [],
      stats,
      profile
    );

    const nextProfile = {
      ...profile,
      badges: [...(profile.badges ?? []), ...newlyEarned],
      rewardPoints: (profile.rewardPoints ?? 0) + newlyEarned.reduce((sum, badge) => sum + badge.points, 0)
    };
    await replaceUser(userId, nextProfile);

    const dashboard = await buildDashboard(userId);
    const importedKg = Number(
      entries.reduce((sum, entry) => sum + entry.totalEmissionsKg, 0).toFixed(2)
    );

    res.status(201).json({
      imported: entries.length,
      totalEmissionsKg: importedKg,
      earnedBadges: newlyEarned,
      rewardPoints: nextProfile.rewardPoints,
      dashboard
    });
} catch (error) {
    next(error);
  }
});

// --- GPS trip tracking (live map / location tracker) ---

app.get("/api/integrations/tracking/trips/:userId", async (req, res, next) => {
  try {
    const trips = await getTrackedTrips(req.params.userId);
    res.json({ trips });
  } catch (error) {
    next(error);
  }
});

app.post("/api/integrations/tracking/save", async (req, res, next) => {
  try {
    const { userId, trip } = req.body;
    if (!userId || !trip?.id) {
      return res.status(400).json({ message: "userId and a trip with an id are required." });
    }
    await ensureUser(userId);
    const saved = await saveTrackedTrip(userId, trip);
    res.status(201).json({ trip: saved });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.delete("/api/integrations/tracking/trips/:userId/:tripId", async (req, res, next) => {
  try {
    const { userId, tripId } = req.params;
    await deleteTrackedTrip(userId, tripId);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Log a GPS-tracked trip as a carbon entry (same path as /api/carbon/log)
app.post("/api/carbon/tracked", async (req, res, next) => {
  try {
    const { userId, trip } = req.body;
    if (!userId || !trip?.distanceKm) {
      return res.status(400).json({ message: "userId and a trip with distanceKm are required." });
    }

    const profile = await ensureUser(userId);
    const entry = await calculateEntryFromPayload({
      userId,
      date: trip.date ?? new Date().toISOString().slice(0, 10),
      transportation: {
        vehicleType: trip.vehicleType ?? "walk",
        distanceKm: Number(trip.distanceKm ?? 0)
      },
      energy: { acHours: 0, heavyAppliance: "none" },
      lifestyle: { dietType: "none", takeoutMeals: 0, newGoodsPurchased: "none", recycledOrComposted: false },
      notes: trip.notes ?? `GPS-tracked trip of ${trip.distanceKm ?? 0} km`
    });
    entry.source = "tracked";
    await appendEntry(userId, entry);

    const entries = await getEntries(userId);
    const stats = calculateStats(entries, profile.weeklyEmissionTargetKg);
    const newlyEarned = evaluateBadges(
      entries.filter((item) => item.source !== "seed"),
      profile.badges ?? [],
      stats,
      profile
    );

    const nextProfile = {
      ...profile,
      badges: [...(profile.badges ?? []), ...newlyEarned],
      rewardPoints: (profile.rewardPoints ?? 0) + newlyEarned.reduce((sum, badge) => sum + badge.points, 0)
    };
    await replaceUser(userId, nextProfile);

    res.status(201).json({
      entry,
      earnedBadges: newlyEarned,
      rewardPoints: nextProfile.rewardPoints,
      dashboard: await buildDashboard(userId)
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/shop/items", async (req, res, next) => {
  try {
    res.json({ items: getShopCatalog() });
  } catch (error) {
    next(error);
  }
});

// --- Google Fit (real) integration ---
app.get("/api/integrations/googlefit/auth", (req, res) => {
  const userId = String(req.query.userId ?? "").trim();
  if (!isGoogleFitConfigured()) {
    return res.status(400).json({ message: "Google Fit is not configured on the server." });
  }
  if (!userId) {
    return res.status(400).json({ message: "userId is required" });
  }
  res.redirect(buildAuthUrl(userId));
});

app.post("/api/integrations/googlefit/callback", async (req, res) => {
  try {
    const { code, state } = req.body;
    if (!code || !state) {
      return res.status(400).json({ message: "Missing Google Fit authorization code." });
    }
    const tokens = await exchangeCodeForTokens(code);
    const connected = await setGoogleFitTokens(String(state), tokens);
    res.json({ ok: connected, user: await getUser(String(state)) });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.post("/api/integrations/googlefit/fetch", async (req, res) => {
  try {
    const { userId, days } = req.body;
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }
    const tokens = await getGoogleFitTokens(userId);
    if (!tokens) {
      return res.status(400).json({ message: "Google Fit is not connected for this account." });
    }
    const result = await fetchActivities(tokens, Number(days) || 14);
    if (result.refreshed) {
      await setGoogleFitTokens(userId, result.refreshed);
    }
    res.json({ activities: result.activities });
  } catch (error) {
    if (error.status === 401 || error.status === 403 || /revoked|reconnect/i.test(error.message)) {
      return res.status(401).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/integrations/googlefit/disconnect", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }
    await setGoogleFitTokens(userId, null);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.post("/api/shop/redeem", async (req, res, next) => {
  try {
    const { userId, itemId } = req.body;
    if (!userId || !itemId) {
      return res.status(400).json({ message: "userId and itemId are required" });
    }

    const item = findShopItem(itemId);
    if (!item) {
      return res.status(404).json({ message: "Shop item not found." });
    }

    await ensureUser(userId);
    const premiumUntil = item.type === "premium" ? computePremiumUntil(item.durationDays) : null;
    const { user, redemption } = await redeemItem(userId, item, premiumUntil);

    res.status(201).json({ redemption, user });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.get("/api/admin/users", async (req, res, next) => {
  try {
    const snapshot = await getStateSnapshot();
    const safeUsers = Object.values(snapshot.users).map(({ passwordHash, ...user }) => user);
    res.json({
      totalUsers: safeUsers.length,
      users: safeUsers,
      activitiesByUser: snapshot.entriesByUser
    });
  } catch (error) {
    next(error);
  }
});

// In production (Render), serve the built React app (dist/) so a single
// Express process handles both the API and the frontend.
if (process.env.NODE_ENV === "production" || process.env.SERVE_STATIC === "1") {
  app.use(express.static(distDir));
  app.get(/^(?!\/(api)\/).*/, (req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
}

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ message: error.message ?? "Unexpected server error" });
});

app.listen(port, () => {
  console.log(`EcoMind API running on http://localhost:${port}`);
});


















