const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const FITNESS_API = "https://fitness.googleapis.com/fitness/v1";

const SCOPE = "https://www.googleapis.com/auth/fitness.activity.read";

const ACTIVITY_MAP = {
  1: { vehicleType: "walk", label: "Walk", speedKmh: 4.8 },
  5: { vehicleType: "bicycle", label: "Cycle", speedKmh: 16 },
  7: { vehicleType: "walk", label: "Walk", speedKmh: 4.8 },
  8: { vehicleType: "walk", label: "Run", speedKmh: 9.7 },
  9: { vehicleType: "walk", label: "Walk", speedKmh: 4.8 },
  12: { vehicleType: "walk", label: "Stair climb", speedKmh: 3.2 },
  19: { vehicleType: "walk", label: "Walk", speedKmh: 4.8 },
  20: { vehicleType: "walk", label: "Walk", speedKmh: 4.8 },
  21: { vehicleType: "bicycle", label: "Cycle", speedKmh: 14 },
  34: { vehicleType: "walk", label: "Walk", speedKmh: 5.5 },
  35: { vehicleType: "bicycle", label: "Cycle", speedKmh: 18 },
  36: { vehicleType: "bicycle", label: "Cycle", speedKmh: 18 },
  42: { vehicleType: "bicycle", label: "Cycle", speedKmh: 18 }
};

const DEFAULT_ACTIVITY = { vehicleType: "walk", label: "Activity", speedKmh: 5 };

function getConfig() {
  const clientId = process.env.GOOGLE_FIT_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_FIT_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_FIT_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google Fit is not configured on the server (missing GOOGLE_FIT_* env vars).");
  }
  return { clientId, clientSecret, redirectUri };
}

export function isGoogleFitConfigured() {
  return Boolean(process.env.GOOGLE_FIT_CLIENT_ID && process.env.GOOGLE_FIT_CLIENT_SECRET);
}

export function buildAuthUrl(userId) {
  const { clientId, redirectUri } = getConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: String(userId)
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code) {
  const { clientId, clientSecret, redirectUri } = getConfig();
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code"
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    const message = data.error_description ?? data.error ?? "Google OAuth token exchange failed.";
    throw new Error(message);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: Date.now() + Number(data.expires_in ?? 3600) * 1000,
    scope: data.scope ?? SCOPE
  };
}

async function refreshAccessToken(refreshToken) {
  const { clientId, clientSecret } = getConfig();
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token"
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    const message = data.error_description ?? data.error ?? "Google OAuth token refresh failed.";
    throw new Error(message);
  }

  return {
    ...data,
    accessToken: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in ?? 3600) * 1000,
    refreshToken: data.refresh_token ?? refreshToken
  };
}

export async function getValidAccessToken(tokens) {
  if (!tokens?.accessToken) {
    throw new Error("No Google Fit access token stored. Please reconnect.");
  }
  if (tokens.expiresAt && Date.now() < tokens.expiresAt - 60 * 1000) {
    return tokens;
  }
  if (!tokens.refreshToken) {
    throw new Error("Google Fit access expired and no refresh token is available. Please reconnect.");
  }
  return refreshAccessToken(tokens.refreshToken);
}

function toDateKey(ms) {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

async function fetchSessions(accessToken, startMs, endMs) {
  const startTime = new Date(startMs).toISOString();
  const endTime = new Date(endMs).toISOString();
  const url = `${FITNESS_API}/users/me/sessions?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}&includeDeleted=false`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (response.status === 401 || response.status === 403) {
    const err = new Error("Google Fit access revoked or insufficient permissions. Please reconnect.");
    err.status = response.status;
    throw err;
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message = data?.error?.message ?? `Google Fit API error (${response.status}).`;
    console.error("[Google Fit API error]", data);
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }

  const data = await response.json().catch(() => ({}));
  return Array.isArray(data.session) ? data.session : [];
}


export async function fetchActivities(tokens, days = 14) {
  const valid = await getValidAccessToken(tokens);
  const endMs = Date.now();
  const startMs = endMs - Math.max(1, Number(days) || 1) * 24 * 60 * 60 * 1000;

  const sessions = await fetchSessions(valid.accessToken, startMs, endMs);

  const activities = sessions
    .map((session) => {
      const start = Number(session.startTimeMillis);
      const end = Number(session.endTimeMillis ?? start);
      const meta = ACTIVITY_MAP[Number(session.activityType)] ?? DEFAULT_ACTIVITY;

      const durationHours = (end - start) / 3600000;
      const distanceKm = Number((meta.speedKmh * durationHours).toFixed(2));

      return {
        id: session.id ?? `googlefit_${start}`,
        date: toDateKey(start),
        source: "google_fit",
        sourceLabel: "Google Fit",
        kind: meta.label.toLowerCase().replace(/\s+/g, "_"),
        name: (session.name && session.name.trim() ? session.name.trim() : `${meta.label} session`),
        vehicleType: meta.vehicleType,
        distanceKm: Math.max(0, distanceKm),
        durationMin: Math.max(1, Math.round((end - start) / 60000)),
        emoji: meta.vehicleType === "bicycle" ? "🚴" : "🚶"
      };
    })
    .filter((activity) => activity.durationMin >= 1)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return { activities, refreshed: valid.accessToken !== tokens.accessToken ? valid : null };
}
