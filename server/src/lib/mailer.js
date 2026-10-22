import nodemailer from "nodemailer";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

function getTransporter() {
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
    const isGmail = host.includes("gmail.com");
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      ...(isGmail || port === 587 ? { tls: { rejectUnauthorized: false } } : {}),
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 8000
    });
  }

  // Auto-detect service by email domain
  const cleanUser = user.trim().toLowerCase();
  if (cleanUser.endsWith("@gmail.com")) {
    return nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 25000
    });
  }

  if (cleanUser.endsWith("@outlook.com") || cleanUser.endsWith("@hotmail.com")) {
    return nodemailer.createTransport({
      service: "hotmail",
      auth: { user, pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });
  }

  if (cleanUser.endsWith("@yahoo.com")) {
    return nodemailer.createTransport({
      service: "yahoo",
      auth: { user, pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });
  }

  // Generic SMTP fallback using host smtp.[domain]
  const domain = cleanUser.split("@")[1];
  if (domain) {
    return nodemailer.createTransport({
      host: `smtp.${domain}`,
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
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

export async function sendEmailVerificationCode(toEmail, code) {
  const defaultFrom = process.env.EMAIL_USER
    ? `"EcoMind Verification" <${process.env.EMAIL_USER}>`
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

  const transporter = getTransporter();

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
        console.warn(`[MAILER TIMEOUT] SMTP delivery to ${toEmail} timed out after 12s. Using dev fallback code.`);
        return { success: false, sent: false, reason: "timeout" };
      } else if (result.success) {
        console.log(`[MAILER SUCCESS] 📧 Sent verification code to ${toEmail}. Message ID: ${result.info.messageId}`);
        return { success: true, sent: true };
      } else {
        const reason = classifyMailError(result.err);
        console.error(`[MAILER ERROR] Direct delivery failed (${reason}): ${result.err?.message ?? "Unknown error"}`);
        return { success: false, sent: false, reason, detail: String(result.err?.message ?? "").slice(0, 300) };
      }
    } catch (err) {
      const reason = classifyMailError(err);
      console.error(`[MAILER ERROR] Direct delivery exception (${reason}): ${err.message}`);
      return { success: false, sent: false, reason };
    }
  }

  console.log(`[MAILER DEV] 💡 Verification code for ${toEmail}: ${code}`);
  console.log("[MAILER BACKUP] SMTP delivery unavailable — verification code generated for dev mode.");
  return { success: true, sent: false, reason: "not_configured" };
}

