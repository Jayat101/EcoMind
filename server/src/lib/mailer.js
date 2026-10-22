import nodemailer from "nodemailer";
import dotenv from "dotenv";
import dns from "node:dns/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

// Some container hosts resolve AAAA records but have no IPv6 route, so
// Nodemailer connects to the IPv6 address and fails with ENETUNREACH.
// Resolve an A record up front and connect to the literal IPv4 address.
async function resolveIPv4(hostname) {
  if (!hostname || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return hostname;
  }
  try {
    const { address } = await dns.lookup(hostname, { family: 4 });
    if (address) return address;
  } catch {
    // fall through to resolve4
  }
  try {
    const addresses = await dns.resolve4(hostname);
    if (addresses?.length) return addresses[0];
  } catch {
    // fall back to the original hostname
  }
  return hostname;
}

async function buildTransport({ host, port, secure, user, pass }) {
  const connectHost = await resolveIPv4(host);
  const useTls = secure || port === 465 || port === 587 || host.includes("gmail.com");

  return nodemailer.createTransport({
    host: connectHost,
    port,
    secure: secure || port === 465,
    auth: { user, pass },
    ...(useTls
      ? {
          tls: {
            servername: host,
            rejectUnauthorized: false
          }
        }
      : {}),
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 25000
  });
}

async function getTransporter() {
  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  // Gmail app passwords are often pasted as "abcd efgh ijkl mnop" — strip
  // every space so a copy-paste from the Google account page still works.
  const user = (process.env.SMTP_USER || process.env.EMAIL_USER || "").trim();
  const pass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || "").replace(/\s+/g, "");
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587);

  if (!user || !pass) {
    return null;
  }

  // Explicit host provided
  if (host) {
    return buildTransport({ host, port, secure: port === 465, user, pass });
  }

  // Auto-detect service by email domain
  const cleanUser = user.trim().toLowerCase();
  if (cleanUser.endsWith("@gmail.com")) {
    return buildTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      user,
      pass
    });
  }

  if (cleanUser.endsWith("@outlook.com") || cleanUser.endsWith("@hotmail.com")) {
    return buildTransport({
      host: "smtp-mail.outlook.com",
      port: 587,
      secure: false,
      user,
      pass
    });
  }

  if (cleanUser.endsWith("@yahoo.com")) {
    return buildTransport({
      host: "smtp.mail.yahoo.com",
      port: 587,
      secure: false,
      user,
      pass
    });
  }

  // Generic SMTP fallback using host smtp.[domain]
  const domain = cleanUser.split("@")[1];
  if (domain) {
    return buildTransport({
      host: `smtp.${domain}`,
      port,
      secure: port === 465,
      user,
      pass
    });
  }

  return null;
}

// Classifies an SMTP failure into a short, non-sensitive reason so ops can
// tell "wrong password" apart from "network blocked" without leaking secrets.
function classifyMailError(err) {
  const code = String(err?.code ?? "").toUpperCase();
  const message = String(err?.message ?? "").toLowerCase();
  if (code === "EAUTH" || message.includes("invalid login") || message.includes("authentication failed") || message.includes("535") || message.includes("credential")) {
    return "auth_failed";
  }
  if (code === "ETIMEDOUT" || code === "ESOCKETTIMEDOUT" || message.includes("timeout")) {
    return "timeout";
  }
  if (code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "EAI_AGAIN" || code === "ECONNRESET") {
    return "network";
  }
  if (message.includes("blocked") || message.includes("unauthenticated")) {
    return "blocked";
  }
  return "smtp_error";
}

function parseSender(from) {
  const match = /^\s*(?:"?([^"<]*)"?\s*)?<([^>]+)>\s*$/.exec(from || "");
  if (match) {
    return {
      name: (match[1] || "EcoMind Verification").trim() || "EcoMind Verification",
      email: match[2].trim()
    };
  }
  return {
    name: "EcoMind Verification",
    email: String(from || "").trim()
  };
}

// Render's free tier blocks outbound SMTP (ports 25/465/587), so production
// uses an HTTPS endpoint instead. Google Apps Script is the preferred path:
// it sends through the account owner's real Gmail without OAuth token expiry.
async function sendViaAppsScript({ toEmail, subject, htmlContent, textContent }) {
  const url = (process.env.GMAIL_SCRIPT_URL || "").trim();
  const secret = (process.env.GMAIL_SCRIPT_SECRET || "").trim();
  if (!url) {
    return null;
  }
  if (!secret) {
    return {
      success: false,
      sent: false,
      reason: "provider_config",
      detail: "Set GMAIL_SCRIPT_SECRET to the same value used in the Apps Script."
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json"
      },
      body: JSON.stringify({
        secret,
        to: toEmail,
        subject,
        html: htmlContent,
        text: textContent
      }),
      redirect: "follow",
      signal: controller.signal
    });

    const rawBody = await response.text();
    let parsed = null;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      // Apps Script returns an HTML sign-in page when the deployment is not
      // shared with "Anyone".
    }

    if (!response.ok) {
      const reason =
        response.status === 401 || response.status === 403
          ? "provider_auth"
          : response.status === 429
            ? "provider_rate_limited"
            : "provider_error";
      const detail = `Apps Script HTTP ${response.status}: ${rawBody}`.slice(0, 400);
      console.error(`[MAILER ERROR] Apps Script delivery failed (${reason}): ${detail}`);
      return { success: false, sent: false, reason, detail };
    }

    if (!parsed) {
      const detail =
        "Apps Script returned HTML instead of JSON. Redeploy the web app with access set to Anyone.";
      console.error(`[MAILER ERROR] Apps Script delivery failed (provider_config): ${detail}`);
      return { success: false, sent: false, reason: "provider_config", detail };
    }

    if (!parsed.ok) {
      const reason =
        parsed.error === "unauthorized" ? "provider_auth" : "provider_error";
      const detail = `Apps Script: ${parsed.error || "unknown error"}`.slice(0, 400);
      console.error(`[MAILER ERROR] Apps Script rejected message (${reason}): ${detail}`);
      return { success: false, sent: false, reason, detail };
    }

    console.log(
      `[MAILER SUCCESS] 📧 Apps Script sent verification email to ${toEmail}. Remaining quota: ${parsed.remaining ?? "unknown"}.`
    );
    return { success: true, sent: true };
  } catch (err) {
    const reason = err?.name === "AbortError" ? "timeout" : "provider_network";
    const detail = [err?.name, err?.message].filter(Boolean).join(" | ").slice(0, 400);
    console.error(`[MAILER ERROR] Apps Script delivery exception (${reason}): ${detail || "Unknown error"}`);
    return { success: false, sent: false, reason, detail };
  } finally {
    clearTimeout(timer);
  }
}

// Render's free tier blocks outbound SMTP (ports 25/465/587), so production
// uses an HTTPS email API instead. Mailjet is preferred; Brevo is kept as an
// alternative. SMTP remains the local/paid-instance path.
async function sendViaMailjet({ toEmail, subject, htmlContent, textContent, from }) {
  const apiKey = (process.env.MAILJET_API_KEY || "").trim();
  const secretKey = (process.env.MAILJET_SECRET_KEY || "").trim();
  if (!apiKey && !secretKey) {
    return null;
  }
  if (!apiKey || !secretKey) {
    return {
      success: false,
      sent: false,
      reason: "provider_config",
      detail: "Set both MAILJET_API_KEY and MAILJET_SECRET_KEY."
    };
  }

  const sender = parseSender(
    process.env.MAILJET_SENDER_EMAIL
      ? `"EcoMind Verification" <${process.env.MAILJET_SENDER_EMAIL.trim()}>`
      : from
  );
  if (!sender.email) {
    return {
      success: false,
      sent: false,
      reason: "provider_config",
      detail: "Set MAILJET_SENDER_EMAIL or EMAIL_USER to a sender verified in Mailjet."
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  const auth = Buffer.from(`${apiKey}:${secretKey}`).toString("base64");

  try {
    const response = await fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST",
      headers: {
        authorization: `Basic ${auth}`,
        "content-type": "application/json",
        accept: "application/json"
      },
      body: JSON.stringify({
        Messages: [
          {
            From: sender,
            To: [{ Email: toEmail }],
            Subject: subject,
            TextPart: textContent,
            HTMLPart: htmlContent
          }
        ]
      }),
      signal: controller.signal
    });

    const rawBody = await response.text();
    let parsed = null;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      // keep raw body
    }

    if (!response.ok) {
      const message =
        parsed?.ErrorMessage || parsed?.message || rawBody || response.statusText;
      const reason =
        response.status === 401 || response.status === 403
          ? "provider_auth"
          : response.status === 429
            ? "provider_rate_limited"
            : "provider_error";
      const detail = `Mailjet HTTP ${response.status}: ${message}`.slice(0, 400);
      console.error(`[MAILER ERROR] Mailjet delivery failed (${reason}): ${detail}`);
      return { success: false, sent: false, reason, detail };
    }

    const status = parsed?.Messages?.[0]?.Status;
    if (status && status !== "success") {
      const detail = `Mailjet status ${status}: ${JSON.stringify(
        parsed.Messages[0].Errors || parsed.Messages[0]
      )}`.slice(0, 400);
      console.error(`[MAILER ERROR] Mailjet rejected message: ${detail}`);
      return { success: false, sent: false, reason: "provider_error", detail };
    }

    console.log(`[MAILER SUCCESS] 📧 Mailjet accepted verification email to ${toEmail}.`);
    return { success: true, sent: true };
  } catch (err) {
    const reason = err?.name === "AbortError" ? "timeout" : "provider_network";
    const detail = [err?.name, err?.message].filter(Boolean).join(" | ").slice(0, 400);
    console.error(`[MAILER ERROR] Mailjet delivery exception (${reason}): ${detail || "Unknown error"}`);
    return { success: false, sent: false, reason, detail };
  } finally {
    clearTimeout(timer);
  }
}

// Render's free tier blocks outbound SMTP (ports 25/465/587), so production
// uses Brevo's HTTPS API instead. SMTP remains the local/paid-instance path.
async function sendViaBrevo({ toEmail, subject, htmlContent, textContent, from }) {
  const apiKey = (process.env.BREVO_API_KEY || "").trim();
  if (!apiKey) {
    return null;
  }

  const sender = parseSender(
    process.env.BREVO_SENDER_EMAIL
      ? `"EcoMind Verification" <${process.env.BREVO_SENDER_EMAIL.trim()}>`
      : from
  );
  if (!sender.email) {
    return {
      success: false,
      sent: false,
      reason: "provider_config",
      detail: "Set BREVO_SENDER_EMAIL or EMAIL_USER to a sender verified in Brevo."
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json"
      },
      body: JSON.stringify({
        sender,
        to: [{ email: toEmail }],
        subject,
        htmlContent,
        textContent
      }),
      signal: controller.signal
    });

    const rawBody = await response.text();
    if (!response.ok) {
      let message = rawBody;
      try {
        const parsed = JSON.parse(rawBody);
        message = parsed.message || parsed.error || rawBody;
      } catch {
        // keep raw body
      }
      const reason =
        response.status === 401 || response.status === 403
          ? "provider_auth"
          : response.status === 429
            ? "provider_rate_limited"
            : "provider_error";
      const detail = `Brevo HTTP ${response.status}: ${message}`.slice(0, 400);
      console.error(`[MAILER ERROR] Brevo delivery failed (${reason}): ${detail}`);
      return { success: false, sent: false, reason, detail };
    }

    console.log(`[MAILER SUCCESS] 📧 Brevo accepted verification email to ${toEmail}.`);
    return { success: true, sent: true };
  } catch (err) {
    const reason = err?.name === "AbortError" ? "timeout" : "provider_network";
    const detail = [err?.name, err?.message].filter(Boolean).join(" | ").slice(0, 400);
    console.error(`[MAILER ERROR] Brevo delivery exception (${reason}): ${detail || "Unknown error"}`);
    return { success: false, sent: false, reason, detail };
  } finally {
    clearTimeout(timer);
  }
}

export async function sendEmailVerificationCode(toEmail, code) {
  const senderEmail = (
    process.env.MAILJET_SENDER_EMAIL ||
    process.env.BREVO_SENDER_EMAIL ||
    process.env.EMAIL_USER ||
    ""
  ).trim();
  const defaultFrom = senderEmail
    ? `"EcoMind Verification" <${senderEmail}>`
    : '"EcoMind Verification" <no-reply@ecomind.org>';
  const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || defaultFrom;
  const subject = `Your EcoMind Verification Code: ${code}`;

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; background-color: #f7faf5; border-radius: 16px; border: 1px solid #e0e7df;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #0f5132; margin: 0; font-size: 26px; font-weight: 700;">EcoMind</h1>
        <p style="color: #666666; font-size: 13px; margin-top: 4px;">Personal Carbon Intelligence</p>
      </div>
      <div style="background-color: #ffffff; padding: 28px; border-radius: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); text-align: center;">
        <p style="font-size: 15px; color: #333333; margin-top: 0; text-align: left;">Hello,</p>
        <p style="font-size: 14px; color: #555555; text-align: left;">Your 6-digit email verification code for EcoMind registration is:</p>
        <div style="margin: 28px 0;">
          <span style="font-family: 'Courier New', monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #0f5132; background-color: #eaf4eb; padding: 14px 28px; border-radius: 10px; display: inline-block; border: 1px solid #c3e6cb;">${code}</span>
        </div>
        <p style="font-size: 13px; color: #777777; margin-bottom: 0; text-align: left;">This code is valid for 10 minutes. If you did not request this verification code, please ignore this email.</p>
      </div>
      <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #888888;">
        <p>© ${new Date().getFullYear()} EcoMind. Secure Carbon Accounting System.</p>
      </div>
    </div>
  `;

  const textContent = `Your EcoMind verification code is: ${code}\n\nThis code expires in 10 minutes.`;

  const appsScriptResult = await sendViaAppsScript({
    toEmail,
    subject,
    htmlContent,
    textContent
  });
  if (appsScriptResult) {
    return appsScriptResult;
  }

  const mailjetResult = await sendViaMailjet({
    toEmail,
    subject,
    htmlContent,
    textContent,
    from
  });
  if (mailjetResult) {
    return mailjetResult;
  }

  const brevoResult = await sendViaBrevo({
    toEmail,
    subject,
    htmlContent,
    textContent,
    from
  });
  if (brevoResult) {
    return brevoResult;
  }

  const transporter = await getTransporter();

  if (transporter) {
    const sendMailWithTimeout = async () => {
      let timer;
      // Cold SMTP handshakes from a cloud container (DNS + TCP + STARTTLS +
      // auth) can take well over 10s, so allow a generous budget before
      // treating delivery as failed.
      const timeout = new Promise((resolve) => {
        timer = setTimeout(() => resolve({ success: false, timedOut: true }), 30000);
      });
      const attempt = transporter
        .sendMail({
          from,
          to: toEmail,
          subject,
          text: textContent,
          html: htmlContent
        })
        .then((info) => ({ success: true, info }))
        .catch((err) => ({ success: false, err }))
        .finally(() => clearTimeout(timer));

      return Promise.race([attempt, timeout]);
    };

    try {
      const result = await sendMailWithTimeout();
      if (result.timedOut) {
        console.warn(`[MAILER TIMEOUT] SMTP delivery to ${toEmail} timed out after 30s. Using dev fallback code.`);
        return { success: false, sent: false, reason: "timeout" };
      } else if (result.success) {
        console.log(`[MAILER SUCCESS] 📧 Sent verification code to ${toEmail}. Message ID: ${result.info.messageId}`);
        return { success: true, sent: true };
      } else {
        const reason = classifyMailError(result.err);
        const detail = [
          result.err?.code,
          result.err?.command,
          result.err?.responseCode,
          result.err?.message
        ]
          .filter(Boolean)
          .join(" | ")
          .slice(0, 400);
        console.error(`[MAILER ERROR] Direct delivery failed (${reason}): ${detail || "Unknown error"}`);
        return { success: false, sent: false, reason, detail };
      }
    } catch (err) {
      const reason = classifyMailError(err);
      const detail = [err?.code, err?.command, err?.responseCode, err?.message]
        .filter(Boolean)
        .join(" | ")
        .slice(0, 400);
      console.error(`[MAILER ERROR] Direct delivery exception (${reason}): ${detail || "Unknown error"}`);
      return { success: false, sent: false, reason, detail };
    }
  }

  console.log(`[MAILER DEV] 💡 Verification code for ${toEmail}: ${code}`);
  console.log("[MAILER BACKUP] SMTP delivery unavailable — verification code generated for dev mode.");
  return { success: true, sent: false, reason: "not_configured" };
}

