import crypto from "node:crypto";
import dns from "node:dns/promises";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";
import { createDefaultUser, createSeedEntries } from "./engine.js";
import { buildMonthlyChallenge } from "../../../src/services/community.js";
import { sendEmailVerificationCode } from "./mailer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../data");
const dataFile = path.join(dataDir, "db.json");

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

function verifyPassword(password, storedHash) {
  if (!password || !storedHash) return false;
  if (storedHash.startsWith("scrypt$")) {
    const parts = storedHash.split("$");
    if (parts.length !== 3) return false;
    const derived = crypto.scryptSync(password, parts[1], 64);
    const expected = Buffer.from(parts[2], "hex");
    if (expected.length !== derived.length) return false;
    return crypto.timingSafeEqual(expected, derived);
  }
  const legacyHash = crypto.createHash("sha256").update(password).digest("hex");
  if (legacyHash.length !== storedHash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(legacyHash, "hex"), Buffer.from(storedHash, "hex"));
}

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, googleFit, ...safe } = user;
  return { ...safe, googleFitConnected: Boolean(googleFit?.refreshToken || googleFit?.accessToken) };
}

const initialState = {
  users: {},
  entriesByUser: {},
  verificationCodes: {},
  trackedTrips: {}
};

let cache = null;
let writeChain = Promise.resolve();

const MONGODB_URI = process.env.MONGODB_URI ?? "";
const MONGODB_DB = process.env.MONGODB_DB ?? "ecomind";

// Each top-level key of `state` maps to a MongoDB collection of {_id, data} docs.
const COLLECTIONS = {
  users: "users",
  entriesByUser: "entriesByUser",
  verificationCodes: "verificationCodes",
  trackedTrips: "trackedTrips"
};

let mongoClient = null;
let mongoDb = null;
let mongoReady = false;

async function connectMongo() {
  if (!MONGODB_URI) return false;
  if (mongoClient) return true;
  try {
    mongoClient = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    await mongoClient.connect();
    mongoDb = mongoClient.db(MONGODB_DB);
    mongoReady = true;
    console.log("[STORE] Connected to MongoDB Atlas");
    return true;
  } catch (err) {
    console.error(`[STORE] MongoDB connection failed: ${err.message}. Falling back to JSON file.`);
    mongoClient = null;
    mongoDb = null;
    mongoReady = false;
    return false;
  }
}

// ------------------------------------------------------------------
// JSON (file) persistence — fallback when no MONGODB_URI is set
// ------------------------------------------------------------------

async function ensureDataFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify(initialState, null, 2));
  }
}

async function loadStateFile() {
  await ensureDataFile();
  const raw = await fs.readFile(dataFile, "utf8");
  return JSON.parse(raw);
}

async function saveStateFile(nextState) {
  await fs.writeFile(dataFile, JSON.stringify(nextState, null, 2));
}

// ------------------------------------------------------------------
// MongoDB persistence — replaces the JSON file when MONGODB_URI is set
// ------------------------------------------------------------------

async function loadCollection(name) {
  const col = mongoDb.collection(name);
  const docs = await col.find({}).toArray();
  const map = {};
  for (const doc of docs) {
    map[doc._id] = doc.data;
  }
  return map;
}

// Replaces a whole collection: upsert every key present, prune keys that
// no longer exist. Ordered false so a single bad doc can't block the rest.
async function saveCollection(name, map) {
  const col = mongoDb.collection(name);
  const keys = Object.keys(map ?? {});
  const writes = keys.map((key) => ({
    replaceOne: { filter: { _id: key }, replacement: { _id: key, data: map[key] }, upsert: true }
  }));

  if (keys.length > 0) {
    const existing = await col.find({ _id: { $nin: keys } }, { projection: { _id: 1 } }).toArray();
    if (existing.length > 0) {
      writes.push({ deleteMany: { filter: { _id: { $in: existing.map((e) => e._id) } } } });
    }
  } else {
    writes.push({ deleteMany: { filter: {} } });
  }

  await col.bulkWrite(writes, { ordered: false });
}

async function loadStateMongo() {
  return {
    users: await loadCollection(COLLECTIONS.users),
    entriesByUser: await loadCollection(COLLECTIONS.entriesByUser),
    verificationCodes: await loadCollection(COLLECTIONS.verificationCodes),
    trackedTrips: await loadCollection(COLLECTIONS.trackedTrips)
  };
}

async function saveStateMongo(nextState) {
  await saveCollection(COLLECTIONS.users, nextState.users ?? {});
  await saveCollection(COLLECTIONS.entriesByUser, nextState.entriesByUser ?? {});
  await saveCollection(COLLECTIONS.verificationCodes, nextState.verificationCodes ?? {});
  await saveCollection(COLLECTIONS.trackedTrips, nextState.trackedTrips ?? {});
}

export async function loadState() {
  if (cache) {
    return cache;
  }

  if (mongoReady || (await connectMongo())) {
    cache = await loadStateMongo();
    return cache;
  }

  cache = await loadStateFile();
  return cache;
}

export async function saveState(nextState) {
  cache = nextState;
  if (MONGODB_URI && !mongoReady) {
    await connectMongo();
  }
  writeChain = writeChain.then(() =>
    mongoReady ? saveStateMongo(nextState) : saveStateFile(nextState)
  );
  await writeChain;
  return cache;
}

export async function getUser(userId) {
  const state = await loadState();
  return sanitizeUser(state.users[userId]) ?? null;
}

export async function upsertUser(profile) {
  const state = await loadState();
  const existing = state.users[profile.userId];
  if (!existing) {
    const newUser = createDefaultUser({
      userId: profile.userId,
      name: profile.name,
      email: profile.email,
      city: profile.city || "New Delhi",
      picture: profile.picture ?? null,
      weeklyEmissionTargetKg: Number(profile.weeklyEmissionTargetKg) || 85,
      provider: profile.provider ?? "email",
      createdAt: new Date().toISOString()
    });
    state.users[profile.userId] = newUser;
    state.entriesByUser[profile.userId] = [];
    await saveState(state);
    return sanitizeUser(state.users[profile.userId]);
  }
  state.users[profile.userId] = {
    ...existing,
    ...profile,
    badges: existing.badges ?? [],
    rewardPoints: existing.rewardPoints ?? profile.rewardPoints ?? 0,
    redemptions: existing.redemptions ?? [],
    premiumUntil: existing.premiumUntil ?? profile.premiumUntil ?? null,
    streakFreezes: existing.streakFreezes ?? profile.streakFreezes ?? 0,
    streakFrozenDays: existing.streakFrozenDays ?? profile.streakFrozenDays ?? []
  };
  if (!state.entriesByUser[profile.userId]) {
    state.entriesByUser[profile.userId] = [];
  }
  await saveState(state);
  return sanitizeUser(state.users[profile.userId]);
}

export async function setStreakProtection(userId, { streakFreezes, streakFrozenDays }) {
  const state = await loadState();
  const user = state.users[userId];
  if (!user) return null;
  user.streakFreezes = streakFreezes;
  user.streakFrozenDays = streakFrozenDays;
  await saveState(state);
  return sanitizeUser(user);
}

export async function redeemItem(userId, item, premiumUntil) {
  const state = await loadState();
  const user = state.users[userId];
  if (!user) {
    throw new Error("User not found.");
  }

  const balance = user.rewardPoints ?? 0;
  if (balance < item.points) {
    throw new Error(`Not enough points. You need ${item.points}, you have ${balance}.`);
  }

  const redemption = {
    itemId: item.id,
    name: item.name,
    points: item.points,
    type: item.type,
    redeemedAt: new Date().toISOString()
  };

  user.rewardPoints = balance - item.points;
  user.redemptions = [...(user.redemptions ?? []), redemption];
  if (item.type === "premium" && premiumUntil) {
    user.premiumUntil = premiumUntil;
  }
  if (item.id === "streak_freeze") {
    user.streakFreezes = (user.streakFreezes ?? 0) + 1;
  }

  await saveState(state);
  return { user: sanitizeUser(user), redemption };
}

export async function sendVerificationCode(email) {
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Format validation
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(normalizedEmail)) {
    throw new Error("Invalid email address. Please enter a valid email format (e.g., user@gmail.com).");
  }

  // 2. Known fake / invalid domain check
  const domain = normalizedEmail.split("@")[1];
  if (DISPOSABLE_DOMAINS.has(domain)) {
    throw new Error(`Invalid email address. The domain @${domain} does not exist or is not allowed.`);
  }

  // 3. DNS MX Record Lookup (soft check — network failures or timeouts should not block signup)
  try {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("DNS_TIMEOUT")), 2500);
    });

    const mxRecords = await Promise.race([
      dns.resolveMx(domain).finally(() => clearTimeout(timer)),
      timeoutPromise
    ]);

    if (Array.isArray(mxRecords) && mxRecords.length === 0) {
      throw new Error(`Invalid email address. The domain @${domain} has no active mail server.`);
    }
  } catch (err) {
    if (err.message && err.message.startsWith("Invalid email")) {
      throw err;
    }
    console.warn(`[MAILER WARNING] MX lookup skipped/failed for ${domain}: ${err.message}. Continuing verification flow.`);
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 mins

  const state = await loadState();

  const existingUser = Object.values(state.users).find(
    (u) => u.email && u.email.trim().toLowerCase() === normalizedEmail
  );
  if (existingUser) {
    throw new Error("An account already exists with this email. Please sign in instead.");
  }

  state.verificationCodes = state.verificationCodes ?? {};
  state.verificationCodes[normalizedEmail] = { code, expiresAt, verified: false };
  await saveState(state);

  // 4. Send email via Nodemailer
  const result = await sendEmailVerificationCode(normalizedEmail, code);

  return { email: normalizedEmail, expiresAt, sent: result.sent, code };
}

export async function verifyCode(email, code) {
  const normalizedEmail = email.trim().toLowerCase();
  const state = await loadState();
  const codes = state.verificationCodes ?? {};
  const record = codes[normalizedEmail];

  if (!record) {
    throw new Error("No verification code sent to this email. Please request a code first.");
  }

  if (Date.now() > record.expiresAt) {
    delete codes[normalizedEmail];
    await saveState(state);
    throw new Error("Verification code has expired. Please request a new code.");
  }

  if (record.code !== String(code).trim()) {
    throw new Error("Incorrect 6-digit verification code. Please check your code and try again.");
  }

  record.verified = true;
  codes[normalizedEmail] = record;
  await saveState(state);
  return true;
}

export async function isEmailVerified(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const state = await loadState();
  const record = (state.verificationCodes ?? {})[normalizedEmail];
  return Boolean(record && record.verified);
}
const DISPOSABLE_DOMAINS = new Set([
  "test.com", "example.com", "fake.com", "invalid.com", "domain.com", "asdf.com",
  "mailinator.com", "tempmail.com", "trashmail.com", "10minutemail.com", "dispostable.com",
  "yopmail.com", "guerrillamail.com", "sharklasers.com", "throwawaymail.com", "fakeinbox.com",
  "abc.com", "foo.com", "bar.com"
]);

export async function registerUser({ name, email, password, city, weeklyEmissionTargetKg }) {
  const state = await loadState();
  const normalizedEmail = email.trim().toLowerCase();
  const cleanName = typeof name === "string" ? name.trim() : "";

  if (!cleanName) {
    throw new Error("Full name is required.");
  }

  if (!password || typeof password !== "string" || password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    throw new Error("Invalid email address. Please enter a real email (e.g., name@gmail.com).");
  }

  if (!(await isEmailVerified(normalizedEmail))) {
    throw new Error("Email not verified. Please verify your email with the 6-digit verification code before signing up.");
  }

  const existingUser = Object.values(state.users).find(
    (u) => u.email && u.email.trim().toLowerCase() === normalizedEmail
  );

  if (existingUser) {
    throw new Error("An account with this email already exists. Please sign in instead.");
  }

  const userId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const newUser = createDefaultUser({
    userId,
    name: cleanName,
    email: normalizedEmail,
    city: city || "New Delhi",
    weeklyEmissionTargetKg: Number(weeklyEmissionTargetKg) || 85,
    passwordHash: hashPassword(password),
    provider: "email",
    createdAt: new Date().toISOString()
  });

  state.users[userId] = newUser;
  state.entriesByUser[userId] = [];
  await saveState(state);

  return sanitizeUser(newUser);
}

export async function loginUserWithPassword({ email, password }) {
  const state = await loadState();
  const normalizedEmail = email.trim().toLowerCase();

  const user = Object.values(state.users).find(
    (u) => u.email && u.email.trim().toLowerCase() === normalizedEmail
  );

  if (!user) {
    throw new Error("No account found with this email address. Please sign up.");
  }

  if (user.provider === "google" && !user.passwordHash) {
    throw new Error("This account was created with Google Sign-In. Please click 'Continue with Google'.");
  }

  if (!verifyPassword(password, user.passwordHash)) {
    throw new Error("Invalid password. Please try again.");
  }

  return sanitizeUser(user);
}

export async function loginGoogleUser({ email, name, picture, sub }) {
  const state = await loadState();
  const normalizedEmail = email.trim().toLowerCase();

  state.verificationCodes = state.verificationCodes ?? {};
  state.verificationCodes[normalizedEmail] = {
    code: "GOOGLE_OAUTH",
    expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
    verified: true
  };

  const user = Object.values(state.users).find(
    (u) => u.email && u.email.trim().toLowerCase() === normalizedEmail
  );

  if (!user) {
    return signupGoogleUser({ email, name, picture, sub });
  }

  if (picture) user.picture = picture;
  if (name) user.name = name;
  if (sub) user.googleId = sub;
  if (!user.provider || user.provider === "email") {
    user.googleId = sub || user.googleId || `google_${Date.now()}`;
  }
  state.users[user.userId] = user;

  await saveState(state);
  return sanitizeUser(user);
}

export async function signupGoogleUser({ email, name, picture, sub, city, weeklyEmissionTargetKg }) {
  const state = await loadState();
  const normalizedEmail = email.trim().toLowerCase();
  const cleanName = typeof name === "string" && name.trim() ? name.trim() : "Google User";

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    throw new Error("Invalid email address from Google profile.");
  }

  state.verificationCodes = state.verificationCodes ?? {};
  state.verificationCodes[normalizedEmail] = {
    code: "GOOGLE_OAUTH",
    expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
    verified: true
  };

  const existingUser = Object.values(state.users).find(
    (u) => u.email && u.email.trim().toLowerCase() === normalizedEmail
  );

  if (existingUser) {
    throw new Error("An account already exists with this email. Please sign in instead.");
  }

  const userId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const newUser = createDefaultUser({
    userId,
    name: cleanName,
    email: normalizedEmail,
    city: city || "New Delhi",
    weeklyEmissionTargetKg: Number(weeklyEmissionTargetKg) || 85,
    provider: "google",
    googleId: sub || `google_${Date.now()}`,
    picture: picture || null,
    createdAt: new Date().toISOString()
  });

  state.users[userId] = newUser;
  state.entriesByUser[userId] = [];
  await saveState(state);

  return sanitizeUser(newUser);
}

export async function appendEntry(userId, entry) {
  const state = await loadState();
  if (!state.entriesByUser[userId]) {
    state.entriesByUser[userId] = [];
  }
  state.entriesByUser[userId].push(entry);
  await saveState(state);
  return entry;
}

export async function appendEntries(userId, entries) {
  const state = await loadState();
  if (!state.entriesByUser[userId]) {
    state.entriesByUser[userId] = [];
  }
  state.entriesByUser[userId].push(...entries);
  await saveState(state);
  return state.entriesByUser[userId];
}

export async function claimChallengeReward(userId) {
  const state = await loadState();
  const challenge = buildMonthlyChallenge(state, userId);
  if (!challenge.completed) {
    throw new Error("Challenge not completed yet. Keep logging low-carbon days.");
  }
  if (challenge.claimed) {
    throw new Error("You already claimed this month's reward.");
  }

  const user = state.users[userId];
  if (!user) {
    throw new Error("User not found.");
  }

  user.rewardPoints = (user.rewardPoints ?? 0) + challenge.rewardPoints;
  user.challengeClaims = { ...(user.challengeClaims ?? {}), [challenge.monthKey]: true };
  await saveState(state);

  return { challenge: { ...challenge, claimed: true }, rewardPoints: user.rewardPoints };
}

export async function toggleGoingOutDay(userId, dateStr) {
  const state = await loadState();
  const user = state.users[userId];
  if (!user) {
    throw new Error("User not found.");
  }
  const cleanDate = String(dateStr ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
    throw new Error("Invalid date. Expected YYYY-MM-DD.");
  }
  user.goingOutDays = Array.isArray(user.goingOutDays) ? user.goingOutDays : [];
  const exists = user.goingOutDays.includes(cleanDate);
  user.goingOutDays = exists
    ? user.goingOutDays.filter((day) => day !== cleanDate)
    : [...user.goingOutDays, cleanDate].sort();
  await saveState(state);
  return { goingOutDays: user.goingOutDays, added: !exists };
}

function settleFriendRequest(state, userId, requesterId, accept) {
  const user = state.users[userId];
  const requester = state.users[requesterId];
  if (!user || !requester) {
    throw new Error("User not found.");
  }

  user.friends = user.friends ?? [];
  requester.friends = requester.friends ?? [];
  user.friendRequests = Array.isArray(user.friendRequests) ? user.friendRequests : [];
  requester.friendRequests = Array.isArray(requester.friendRequests) ? requester.friendRequests : [];

  const incoming = user.friendRequests.find(
    (req) => req.userId === requesterId && req.direction === "incoming"
  );
  const outgoing = requester.friendRequests.find(
    (req) => req.userId === userId && req.direction === "outgoing"
  );

  if (!incoming || !outgoing) {
    throw new Error("No pending friend request to respond to.");
  }

  user.friendRequests = user.friendRequests.filter((req) => req.userId !== requesterId);
  requester.friendRequests = requester.friendRequests.filter((req) => req.userId !== userId);

  if (accept) {
    if (!user.friends.includes(requesterId)) user.friends.push(requesterId);
    if (!requester.friends.includes(userId)) requester.friends.push(userId);
  }

  return { accepted: Boolean(accept) };
}

export async function sendFriendRequest(fromUserId, toUserId) {
  const state = await loadState();
  const from = state.users[fromUserId];
  const to = state.users[toUserId];
  if (!from || !to) {
    throw new Error("User not found.");
  }
  if (fromUserId === toUserId) {
    throw new Error("You cannot send a friend request to yourself.");
  }
  if ((to.friends ?? []).includes(fromUserId) || (from.friends ?? []).includes(toUserId)) {
    throw new Error("You are already friends with this user.");
  }

  from.friendRequests = Array.isArray(from.friendRequests) ? from.friendRequests : [];
  to.friendRequests = Array.isArray(to.friendRequests) ? to.friendRequests : [];

  const existingOutgoing = from.friendRequests.find((req) => req.userId === toUserId);
  if (existingOutgoing) {
    throw new Error("Friend request already sent.");
  }
  const reverseIncoming = to.friendRequests.find(
    (req) => req.userId === fromUserId && req.direction === "incoming"
  );
  if (reverseIncoming) {
    throw new Error("This user already sent you a request. Accept it from your requests list.");
  }

  from.friendRequests.push({ userId: toUserId, direction: "outgoing", createdAt: new Date().toISOString() });
  to.friendRequests.push({ userId: fromUserId, direction: "incoming", createdAt: new Date().toISOString() });
  await saveState(state);
  return { ok: true };
}

export async function respondFriendRequest(userId, requesterId, accept) {
  const state = await loadState();
  const result = settleFriendRequest(state, userId, requesterId, Boolean(accept));
  await saveState(state);
  return { ok: true, ...result };
}

export async function removeFriend(userId, friendId) {
  const state = await loadState();
  const user = state.users[userId];
  const friend = state.users[friendId];
  if (!user || !friend) {
    throw new Error("User not found.");
  }
  user.friends = (user.friends ?? []).filter((id) => id !== friendId);
  friend.friends = (friend.friends ?? []).filter((id) => id !== userId);
  await saveState(state);
  return { ok: true };
}

export async function replaceUser(userId, user) {
  const state = await loadState();
  state.users[userId] = user;
  await saveState(state);
  return sanitizeUser(user);
}

export async function getEntries(userId) {
  const state = await loadState();
  const entries = state.entriesByUser[userId] ?? [];

  let changed = false;
  const next = entries.map((entry, index) => {
    if (!entry.id) {
      changed = true;
      return { ...entry, id: `legacy_${index}_${Date.now().toString(36)}` };
    }
    return entry;
  });

  if (changed) {
    state.entriesByUser[userId] = next;
    await saveState(state);
  }

  return next;
}

export async function updateEntry(userId, entryId, entry) {
  const state = await loadState();
  const entries = state.entriesByUser[userId] ?? [];
  const index = entries.findIndex((item) => item.id === entryId);

  if (index === -1) {
    throw new Error("Entry not found.");
  }

  entries[index] = { ...entry, id: entryId };
  await saveState(state);
  return entries[index];
}

export async function deleteEntry(userId, entryId) {
  const state = await loadState();
  const entries = state.entriesByUser[userId] ?? [];
  state.entriesByUser[userId] = entries.filter((item) => item.id !== entryId);
  await saveState(state);
  return state.entriesByUser[userId];
}

export async function resetUserData(userId) {
  const state = await loadState();
  state.entriesByUser[userId] = [];
  if (state.users[userId]) {
    state.users[userId].badges = [];
    state.users[userId].rewardPoints = 0;
    state.users[userId].redemptions = [];
    state.users[userId].premiumUntil = null;
  }
  await saveState(state);
  return { user: sanitizeUser(state.users[userId]), entries: [] };
}

export async function getStateSnapshot() {
  const state = await loadState();
  return structuredClone(state);
}

export async function setGoogleFitTokens(userId, tokens) {
  const state = await loadState();
  if (!state.users[userId]) {
    throw new Error("User not found.");
  }
  const next = tokens && tokens.accessToken ? { ...tokens } : null;
  state.users[userId].googleFit = next;
  await saveState(state);
  return Boolean(next);
}

export async function getGoogleFitTokens(userId) {
  const state = await loadState();
  return state.users[userId]?.googleFit ?? null;
}

export async function sendForgotPasswordCode(email) {
  const normalizedEmail = email.trim().toLowerCase();

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(normalizedEmail)) {
    throw new Error("Invalid email address format.");
  }

  const state = await loadState();
  const existingUser = Object.values(state.users).find(
    (u) => u.email && u.email.trim().toLowerCase() === normalizedEmail
  );

  if (!existingUser) {
    throw new Error("No account found with this email address. Please check your email or sign up.");
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000;

  state.verificationCodes = state.verificationCodes ?? {};
  state.verificationCodes[normalizedEmail] = { code, expiresAt, verified: false };
  await saveState(state);

  const result = await sendEmailVerificationCode(normalizedEmail, code);
  return { email: normalizedEmail, expiresAt, sent: result.sent, code };
}

export async function resetPasswordWithCode({ email, code, newPassword }) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
    throw new Error("New password must be at least 6 characters long.");
  }

  await verifyCode(normalizedEmail, code);

  const state = await loadState();
  const user = Object.values(state.users).find(
    (u) => u.email && u.email.trim().toLowerCase() === normalizedEmail
  );

  if (!user) {
    throw new Error("User account not found.");
  }

  user.passwordHash = hashPassword(newPassword);
  state.users[user.userId] = user;
  await saveState(state);

  return sanitizeUser(user);
}

// ------------------------------------------------------------------
// GPS TRIP TRACKING
// Stored per-user under the top-level `trackedTrips` key.
// ------------------------------------------------------------------

export async function getTrackedTrips(userId) {
  const state = await loadState();
  return state.trackedTrips && Array.isArray(state.trackedTrips[userId])
    ? state.trackedTrips[userId]
    : [];
}

export async function saveTrackedTrip(userId, trip) {
  if (!userId || !trip || !trip.id) {
    throw new Error("userId and a trip with an id are required.");
  }
  const state = await loadState();
  state.trackedTrips = state.trackedTrips ?? {};
  state.trackedTrips[userId] = state.trackedTrips[userId] ?? [];

  const index = state.trackedTrips[userId].findIndex((item) => item.id === trip.id);
  if (index >= 0) {
    state.trackedTrips[userId][index] = trip;
  } else {
    state.trackedTrips[userId].unshift(trip);
  }

  await saveState(state);
  return trip;
}

export async function deleteTrackedTrip(userId, tripId) {
  const state = await loadState();
  state.trackedTrips = state.trackedTrips ?? {};
  state.trackedTrips[userId] = state.trackedTrips[userId] ?? [];
  state.trackedTrips[userId] = state.trackedTrips[userId].filter((item) => item.id !== tripId);
  await saveState(state);
  return { ok: true };
}

