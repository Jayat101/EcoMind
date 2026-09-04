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
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
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
      connectionTimeout: 12000,
      greetingTimeout: 12000,
      socketTimeout: 15000
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
      const timeout = new Promise((resolve) => {
        timer = setTimeout(() => resolve({ success: false, timedOut: true }), 12000);
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
      } else if (result.success) {
        console.log(`[MAILER SUCCESS] 📧 Sent verification code to ${toEmail}. Message ID: ${result.info.messageId}`);
        return { success: true, sent: true };
      } else {
        console.error(`[MAILER ERROR] Direct delivery failed: ${result.err?.message ?? "Unknown error"}`);
      }
    } catch (err) {
      console.error(`[MAILER ERROR] Direct delivery exception: ${err.message}`);
    }
  }

  console.log(`[MAILER DEV] 💡 Verification code for ${toEmail}: ${code}`);
  console.log("[MAILER BACKUP] SMTP delivery unavailable — verification code generated for dev mode.");
  return { success: true, sent: false };
}

