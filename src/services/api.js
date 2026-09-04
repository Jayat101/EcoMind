import axios from "axios";
import { demoDashboard } from "./demoData.js";
import { buildLeaderboard, buildMonthlyChallenge } from "./community.js";
import {
  claimLocalChallenge,
  deleteLocalEntry,
  getLocalCommunityContext,
  getLocalCommunityProfile,
  getLocalDashboard,
  getLocalEntries,
  getLocalFriends,
  importLocalActivities,
  logLocalEntry,
  redeemLocalItem,
  removeLocalFriend,
  resetLocalUser,
  respondLocalFriendRequest,
  sendLocalFriendRequest,
  toggleLocalGoingOutDay,
  updateLocalEntry,
  upsertLocalUser
} from "./gamification.js";
import { findShopItem } from "./shop.js";
import { localTrips } from "./tracking.js";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:5000/api",
  timeout: 15000
});

export async function fetchDashboard(userId) {
  try {
    const { data } = await api.get(`/carbon/dashboard/${userId}`);
    return { ...data, _source: "remote" };
  } catch {
    return { ...getLocalDashboard(), _source: "local" };
  }
}

export async function logCarbonEntry(payload) {
  try {
    const { data } = await api.post("/carbon/log", payload);
    return { ...data, _source: "remote" };
  } catch {
    return { ...logLocalEntry(payload), _source: "local" };
  }
}

export async function upsertUser(payload) {
  try {
    const { data } = await api.post("/users", payload);
    return { ...data, _source: "remote" };
  } catch {
    return { ...upsertLocalUser(payload), _source: "local" };
  }
}

export async function fetchUser(userId) {
  try {
    const { data } = await api.get(`/users/${userId}`);
    return { ...data, _source: "remote" };
  } catch {
    return null;
  }
}

export async function resetUser(userId) {
  try {
    const { data } = await api.post(`/carbon/reset/${userId}`);
    return { ...data, _source: "remote" };
  } catch {
    return { ...resetLocalUser(), _source: "local" };
  }
}

export async function fetchEntries(userId) {
  try {
    const { data } = await api.get(`/carbon/entries/${userId}`);
    return data;
  } catch {
    return getLocalEntries();
  }
}

export async function updateCarbonEntry(userId, entryId, payload) {
  try {
    const { data } = await api.put(`/carbon/entries/${userId}/${entryId}`, payload);
    return { ...data, _source: "remote" };
  } catch {
    return { ...updateLocalEntry({ entryId, ...payload }), _source: "local" };
  }
}

export async function deleteCarbonEntry(userId, entryId) {
  try {
    const { data } = await api.delete(`/carbon/entries/${userId}/${entryId}`);
    return { ...data, _source: "remote" };
  } catch {
    return { ...deleteLocalEntry(entryId), _source: "local" };
  }
}

export async function redeemItem(userId, itemId) {
  const item = findShopItem(itemId);
  if (!item) {
    throw new Error("Shop item not found.");
  }
  try {
    const { data } = await api.post("/shop/redeem", { userId, itemId });
    return { ...data, _source: "remote" };
  } catch (error) {
    if (error?.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    return { ...redeemLocalItem(userId, item), _source: "local" };
  }
}

export async function sendVerificationCode(email) {
  const { data } = await api.post("/auth/send-verification", { email }, { timeout: 20000 });
  return data;
}

export async function verifyEmailCode(email, code) {
  const { data } = await api.post("/auth/verify-code", { email, code });
  return data;
}

export async function signupUser(payload) {
  const { data } = await api.post("/auth/signup", payload);
  return data.user;
}

export async function loginUser(payload) {
  const { data } = await api.post("/auth/login", payload);
  return data.user;
}

export async function googleLogin(payload) {
  const { data } = await api.post("/auth/google", payload);
  return data.user;
}

export async function googleSignup(payload) {
  const { data } = await api.post("/auth/google/signup", payload);
  return data.user;
}

export async function importActivities(userId, activities) {
  try {
    const { data } = await api.post("/import/activities", { userId, activities });
    return { ...data, _source: "remote" };
  } catch {
    return { ...importLocalActivities(userId, activities), _source: "local" };
  }
}

export async function fetchLeaderboard(userId) {
  try {
    const { data } = await api.get("/community/leaderboard", { params: { userId } });
    return { ...data, _source: "remote" };
  } catch {
    const context = getLocalCommunityContext(userId);
    return { ...buildLeaderboard(context, userId), _source: "local" };
  }
}

export async function fetchCommunityChallenge(userId) {
  try {
    const { data } = await api.get("/community/challenge", { params: { userId } });
    return { ...data, _source: "remote" };
  } catch {
    const context = getLocalCommunityContext(userId);
    return { ...buildMonthlyChallenge(context, userId), _source: "local" };
  }
}

export async function fetchCommunityProfile(viewerId, profileId) {
  try {
    const { data } = await api.get(`/community/profile/${profileId}`, { params: { viewer: viewerId } });
    return { ...data, _source: "remote" };
  } catch {
    const data = getLocalCommunityProfile(viewerId, profileId);
    return { ...(data ?? {}), _source: "local" };
  }
}

export async function fetchFriends(userId) {
  try {
    const { data } = await api.get(`/community/friends/${userId}`);
    return { ...data, _source: "remote" };
  } catch {
    return { ...getLocalFriends(), _source: "local" };
  }
}

export async function sendFriendRequest(fromUserId, toUserId) {
  try {
    const { data } = await api.post("/community/friends/request", { fromUserId, toUserId });
    return { ...data, _source: "remote" };
  } catch (error) {
    if (error?.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    return { ...sendLocalFriendRequest(), _source: "local" };
  }
}

export async function respondFriendRequest(userId, requesterId, accept) {
  try {
    const { data } = await api.post("/community/friends/respond", { userId, requesterId, accept });
    return { ...data, _source: "remote" };
  } catch (error) {
    if (error?.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    return { ...respondLocalFriendRequest(), _source: "local" };
  }
}

export async function removeFriend(userId, friendId) {
  try {
    const { data } = await api.post("/community/friends/remove", { userId, friendId });
    return { ...data, _source: "remote" };
  } catch {
    return { ...removeLocalFriend(), _source: "local" };
  }
}

export async function toggleGoingOut(userId, date) {
  try {
    const { data } = await api.post("/community/going-out", { userId, date });
    return { ...data, _source: "remote" };
  } catch {
    return { ...toggleLocalGoingOutDay(userId, date), _source: "local" };
  }
}

export async function claimCommunityChallenge(userId) {
  try {
    const { data } = await api.post("/community/challenge/claim", { userId });
    return { ...data, _source: "remote" };
  } catch (error) {
    if (error?.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    return { ...claimLocalChallenge(userId), _source: "local" };
  }
}

export async function handleGoogleFitCallback(code, state) {
  const { data } = await api.post("/integrations/googlefit/callback", { code, state });
  return data;
}

export async function fetchGoogleFitActivities(userId, days = 14) {
  const { data } = await api.post("/integrations/googlefit/fetch", { userId, days });
  return data;
}

export async function disconnectGoogleFit(userId) {
  const { data } = await api.post("/integrations/googlefit/disconnect", { userId });
  return data;
}

export async function sendForgotPasswordCode(email) {
  const { data } = await api.post("/auth/forgot-password", { email });
  return data;
}

export async function resetPasswordWithCode(email, code, newPassword) {
  const { data } = await api.post("/auth/reset-password", { email, code, newPassword });
  return data.user;
}

export async function getTrackedTrips(userId) {
  try {
    const { data } = await api.get(`/integrations/tracking/trips/${userId}`);
    return { trips: data.trips ?? [], _source: "remote" };
  } catch (error) {
    if (error?.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    return { trips: localTrips.get(userId), _source: "local" };
  }
}

export async function saveTrackedTrip(userId, trip) {
  try {
    const { data } = await api.post("/integrations/tracking/save", { userId, trip });
    return { ...data, _source: "remote" };
  } catch (error) {
    if (error?.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    localTrips.append(userId, trip);
    return { trip, _source: "local" };
  }
}

export async function deleteTrackedTrip(userId, tripId) {
  try {
    const { data } = await api.delete(`/integrations/tracking/trips/${userId}/${tripId}`);
    return { ...data, _source: "remote" };
  } catch (error) {
    if (error?.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    localTrips.remove(userId, tripId);
    return { ok: true, _source: "local" };
  }
}

export async function logTrackedTripToCarbon(userId, trip) {
  const payload = {
    userId,
    date: trip.date ?? new Date().toISOString().slice(0, 10),
    transportation: {
      vehicleType: trip.vehicleType ?? "walk",
      distanceKm: trip.distanceKm ?? 0
    },
    energy: { acHours: 0, heavyAppliance: 0 },
    lifestyle: { dietType: "none", takeoutMeals: 0, newGoodsPurchased: 0, recycledOrComposted: false },
    source: "tracked",
    notes: `GPS-tracked trip of ${trip.distanceKm ?? 0} km`
  };
  try {
    const { data } = await api.post("/carbon/tracked", { userId, trip });
    return { ...data, _source: "remote" };
  } catch (error) {
    if (error?.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    return { ...logLocalEntry(payload), entry: payload, _source: "local" };
  }
}

export { demoDashboard };


