import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, ChevronDown, KeyRound, Loader2, Lock, Mail, MapPin, Target, User, X } from "lucide-react";
import { useEffect, useState } from "react";
import { INDIAN_CITIES } from "../constants/cities.js";
import { googleLogin, googleSignup, loginUser, resetPasswordWithCode, sendForgotPasswordCode, sendVerificationCode, signupUser, verifyEmailCode } from "../services/api.js";

// SVG Google Logo
function GoogleLogoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export default function AuthModal({ isOpen, onClose, onAuthenticated }) {
  const [mode, setMode] = useState("signin"); // "signin", "signup", or "forgot"
  const [signupStep, setSignupStep] = useState("details"); // "details" or "verify"
  const [forgotStep, setForgotStep] = useState("request"); // "request" or "reset"
  const [otpInput, setOtpInput] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    city: "New Delhi",
    weeklyEmissionTargetKg: 85
  });

  // Dynamically load Google GSI script if not loaded
  useEffect(() => {
    if (typeof window === "undefined" || window.google) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {};
    document.head.appendChild(script);
  }, []);

  const [showGooglePrompt, setShowGooglePrompt] = useState(false);
  const [gmailInput, setGmailInput] = useState("");

  if (!isOpen) return null;

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleInputChange(event) {
    const { name, value } = event.target;
    setField(name, value);
  }

  async function handleSendVerification() {
    const cleanEmail = form.email.trim().toLowerCase();
    if (!form.name.trim()) throw new Error("Please enter your name.");
    if (!cleanEmail) throw new Error("Please enter your email.");
    if (!form.password || form.password.length < 6) throw new Error("Password must be at least 6 characters.");

    const data = await sendVerificationCode(cleanEmail);
    const msg = data.message ?? (data.sent
      ? `📧 Verification code sent to ${cleanEmail}! Please check your inbox.`
      : `💡 Email delivery offline. Use verification code: ${data.devCode} to complete sign-up.`);
    setSuccessMsg(msg);
    setSignupStep("verify");
  }

  async function handleRequestResetCode() {
    const cleanEmail = form.email.trim().toLowerCase();
    if (!cleanEmail) throw new Error("Please enter your registered email address.");

    const data = await sendForgotPasswordCode(cleanEmail);
    const msg = data.message ?? (data.sent
      ? `📧 Password reset code sent to ${cleanEmail}! Please check your inbox.`
      : `💡 Email delivery offline. Use reset code: ${data.devCode} to reset your password.`);
    setSuccessMsg(msg);
    setForgotStep("reset");
  }

  async function handleResetPassword() {
    const cleanEmail = form.email.trim().toLowerCase();
    if (!cleanEmail) throw new Error("Please enter your email address.");
    if (!forgotCode.trim() || forgotCode.trim().length !== 6) throw new Error("Please enter the 6-digit reset code.");
    if (!form.password || form.password.length < 6) throw new Error("New password must be at least 6 characters.");
    if (form.password !== confirmPassword) throw new Error("Passwords do not match. Please verify your new password.");

    const user = await resetPasswordWithCode(cleanEmail, forgotCode.trim(), form.password);
    onAuthenticated(user);
    onClose();
  }

  async function handleResendCode() {
    const cleanEmail = form.email.trim().toLowerCase();
    setError("");
    setSuccessMsg("");
    setLoading(true);
    try {
      if (mode === "forgot") {
        const data = await sendForgotPasswordCode(cleanEmail);
        const msg = data.message ?? (data.sent
          ? `📧 A new reset code was sent to ${cleanEmail}.`
          : `💡 Email delivery offline. Use reset code: ${data.devCode}`);
        setSuccessMsg(msg);
      } else {
        const data = await sendVerificationCode(cleanEmail);
        const msg = data.message ?? (data.sent
          ? `📧 A new verification code was sent to ${cleanEmail}.`
          : `💡 Email delivery offline. Use verification code: ${data.devCode}`);
        setSuccessMsg(msg);
      }
    } catch (err) {
      setError(err.response?.data?.message ?? err.message ?? "Failed to resend code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    const cleanEmail = form.email.trim().toLowerCase();

    try {
      if (mode === "forgot") {
        if (forgotStep === "request") {
          await handleRequestResetCode();
        } else {
          await handleResetPassword();
        }
      } else if (mode === "signup") {
        if (signupStep === "details") {
          await handleSendVerification();
        } else {
          if (!otpInput.trim() || otpInput.trim().length !== 6) {
            throw new Error("Please enter the 6-digit verification code.");
          }
          await verifyEmailCode(cleanEmail, otpInput.trim());
          const user = await signupUser({ ...form, email: cleanEmail });
          onAuthenticated(user);
          onClose();
        }
      } else {
        if (!cleanEmail) throw new Error("Please enter your email.");
        if (!form.password) throw new Error("Please enter your password.");

        const user = await loginUser({ email: cleanEmail, password: form.password });
        onAuthenticated(user);
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message ?? err.message ?? "Authentication failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError("");
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!clientId || clientId.startsWith("demo-")) {
      setShowGooglePrompt(true);
      return;
    }

    setLoading(true);

    const waitForGoogle = (retries = 50) =>
      new Promise((resolve) => {
        const check = () => {
          if (window.google?.accounts?.oauth2) return resolve(true);
          if (retries <= 0) return resolve(false);
          setTimeout(() => check(retries - 1), 100);
        };
        check();
      });

    const ready = await waitForGoogle();
    if (!ready) {
      setLoading(false);
      setError("Could not load Google Sign-In. Please check your connection and reload.");
      return;
    }

    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "openid email profile",
        callback: async (tokenResponse) => {
          try {
            if (tokenResponse.error) {
              setError("Google Sign-In was cancelled or failed.");
              setLoading(false);
              return;
            }

            const userInfo = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
            }).then((r) => r.json());

            const user =
              mode === "signup"
                ? await googleSignup({
                    email: userInfo.email,
                    name: userInfo.name,
                    picture: userInfo.picture,
                    sub: userInfo.sub,
                    city: form.city,
                    weeklyEmissionTargetKg: form.weeklyEmissionTargetKg
                  })
                : await googleLogin({
                    email: userInfo.email,
                    name: userInfo.name,
                    picture: userInfo.picture,
                    sub: userInfo.sub
                  });
            onAuthenticated(user);
            onClose();
          } catch (err) {
            setError(err.response?.data?.message ?? err.message ?? "Google Sign-In failed.");
          } finally {
            setLoading(false);
          }
        },
        error_callback: () => {
          setLoading(false);
          setError("Google Sign-In was cancelled or blocked. Please allow popups and try again.");
        }
      });
      tokenClient.requestAccessToken();
    } catch (err) {
      setLoading(false);
      setError("Google Sign-In failed to initialize. Please try again.");
    }
  }

  async function confirmGoogleAuth(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const email = gmailInput.trim().toLowerCase();
      if (!email || !email.endsWith("@gmail.com")) {
        throw new Error("Please enter a valid Gmail address.");
      }
      const username = email.split("@")[0] ?? "Google User";
      const formattedName = username.charAt(0).toUpperCase() + username.slice(1);

      const payload = {
        email,
        name: form.name.trim() || formattedName,
        picture: "https://lh3.googleusercontent.com/a/default-user=s96-c",
        sub: `google_${Date.now()}`
      };

      const user =
        mode === "signup"
          ? await googleSignup({
              ...payload,
              city: form.city,
              weeklyEmissionTargetKg: form.weeklyEmissionTargetKg
            })
          : await googleLogin(payload);
      setShowGooglePrompt(false);
      onAuthenticated(user);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message ?? err.message ?? "Google Sign-In failed.");
    } finally {
      setLoading(false);
    }
  }

  function handleDemoUser() {
    onAuthenticated({
      userId: "demo-user",
      name: "Aarav Mehta",
      email: "demo@ecomind.org",
      city: "New Delhi",
      weeklyEmissionTargetKg: 85
    });
    onClose();
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md overflow-y-auto"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: "spring", stiffness: 300, damping: 26 }}
          className="relative w-full max-w-md overflow-hidden rounded-[32px] bg-[#f7faf5] p-6 shadow-2xl sm:p-8 dark:bg-[#1c222c] dark:border dark:border-white/10"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#0f5132]">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl">
                <img src="/favicon.svg" alt="EcoMind" className="h-10 w-10" />
              </div>
              <span className="text-xl font-bold tracking-tight text-black dark:text-white">EcoMind</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/5 text-black/60 transition hover:bg-black/10 hover:text-black dark:bg-white/10 dark:text-white/60 dark:hover:bg-white/20 dark:hover:text-white"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-5">
            <h2 className="text-2xl font-semibold tracking-tight text-black sm:text-3xl dark:text-white">
              {mode === "signin" ? "Welcome back 👋" : mode === "signup" ? "Create account ✨" : "Reset Password 🔑"}
            </h2>
            <p className="mt-1 text-sm text-black/50 dark:text-white/50">
              {mode === "signin"
                ? "Sign in to access your personal carbon dashboard."
                : mode === "signup"
                  ? "Sign up to track your emissions and earn eco rewards."
                  : forgotStep === "request"
                    ? "Enter your registered email address to receive a 6-digit reset code."
                    : "Enter the 6-digit code sent to your email and your new password."}
            </p>
          </div>

          {mode !== "forgot" ? (
            <>
              {/* Mode Switcher Tabs */}
              <div className="mt-5 grid grid-cols-2 gap-1 rounded-2xl bg-black/5 p-1 dark:bg-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setSignupStep("details");
                    setOtpInput("");
                    setSuccessMsg("");
                    setError("");
                  }}
                  className={`rounded-xl py-2 text-xs font-semibold transition ${
                    mode === "signin" ? "bg-white text-black shadow-sm dark:bg-[#222832] dark:text-white" : "text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setSignupStep("details");
                    setOtpInput("");
                    setSuccessMsg("");
                    setError("");
                  }}
                  className={`rounded-xl py-2 text-xs font-semibold transition ${
                    mode === "signup" ? "bg-white text-black shadow-sm dark:bg-[#222832] dark:text-white" : "text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"
                  }`}
                >
                  Sign Up
                </button>
              </div>

              {/* Google Sign In Button */}
              <div className="mt-5">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border border-black/10 bg-white py-3.5 text-sm font-semibold text-black shadow-sm transition hover:bg-black/5 active:scale-[0.99] dark:border-white/15 dark:bg-[#222832] dark:text-white dark:hover:bg-white/10"
                >
                  <GoogleLogoIcon />
                  <span>Continue with Google / Gmail</span>
                </button>

                <div className="relative my-5 flex items-center justify-center">
                  <div className="w-full border-t border-black/10 dark:border-white/10" />
                  <span className="absolute bg-[#f7faf5] px-3 text-xs uppercase tracking-wider text-black/40 dark:bg-[#1c222c] dark:text-white/40">
                    Or with email
                  </span>
                </div>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setForgotStep("request");
                setSuccessMsg("");
                setError("");
                setForgotCode("");
                setConfirmPassword("");
              }}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#0f5132] transition hover:underline dark:text-emerald-400"
            >
              ← Back to Sign In
            </button>
          )}

          {/* Error Banner */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 mt-4 flex items-start gap-2 rounded-2xl bg-red-50 p-3.5 text-xs text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Success Banner */}
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 mt-4 flex items-start gap-2 rounded-2xl bg-emerald-50 p-3.5 text-xs text-emerald-800 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20"
            >
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              <span>{successMsg}</span>
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
            {mode === "signup" && signupStep === "details" && (
              <div>
                <label className="block text-xs font-semibold text-black/70 mb-1 dark:text-white/70">Full Name</label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40" />
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="E.g. Aarav Mehta"
                    value={form.name}
                    onChange={handleInputChange}
                    className="w-full rounded-2xl border border-black/15 bg-white py-3 pl-10 pr-4 text-sm font-medium text-black focus:border-[#0f5132] focus:outline-none dark:border-white/15 dark:bg-[#222832] dark:text-white dark:focus:border-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* Email field */}
            {mode !== "forgot" || forgotStep === "request" ? (
              <div>
                <label className="block text-xs font-semibold text-black/70 mb-1 dark:text-white/70">Email Address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40" />
                  <input
                    type="email"
                    name="email"
                    required
                    disabled={mode === "signup" && signupStep === "verify"}
                    placeholder="name@example.com"
                    value={form.email}
                    onChange={handleInputChange}
                    className="w-full rounded-2xl border border-black/15 bg-white py-3 pl-10 pr-4 text-sm font-medium text-black focus:border-[#0f5132] focus:outline-none disabled:opacity-60 dark:border-white/15 dark:bg-[#222832] dark:text-white dark:focus:border-emerald-500"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-black/70 mb-1 dark:text-white/70">Email Address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40" />
                  <input
                    type="email"
                    disabled
                    value={form.email}
                    className="w-full rounded-2xl border border-black/15 bg-black/5 py-3 pl-10 pr-4 text-sm font-medium text-black/60 dark:border-white/15 dark:bg-white/5 dark:text-white/60"
                  />
                </div>
              </div>
            )}

            {/* Password Field / Forgot Password Step */}
            {mode === "signin" && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-black/70 dark:text-white/70">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot");
                      setForgotStep("request");
                      setError("");
                      setSuccessMsg("");
                      setForgotCode("");
                      setConfirmPassword("");
                    }}
                    className="text-xs font-semibold text-[#0f5132] transition hover:underline dark:text-emerald-400"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40" />
                  <input
                    type="password"
                    name="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={form.password}
                    onChange={handleInputChange}
                    className="w-full rounded-2xl border border-black/15 bg-white py-3 pl-10 pr-4 text-sm font-medium text-black focus:border-[#0f5132] focus:outline-none dark:border-white/15 dark:bg-[#222832] dark:text-white dark:focus:border-emerald-500"
                  />
                </div>
              </div>
            )}

            {mode === "signup" && signupStep === "details" && (
              <div>
                <label className="block text-xs font-semibold text-black/70 mb-1 dark:text-white/70">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40" />
                  <input
                    type="password"
                    name="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={form.password}
                    onChange={handleInputChange}
                    className="w-full rounded-2xl border border-black/15 bg-white py-3 pl-10 pr-4 text-sm font-medium text-black focus:border-[#0f5132] focus:outline-none dark:border-white/15 dark:bg-[#222832] dark:text-white dark:focus:border-emerald-500"
                  />
                </div>
              </div>
            )}

            {mode === "signup" && signupStep === "details" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-black/70 mb-1 dark:text-white/70">City</label>
                  <div className="relative">
                    <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40 pointer-events-none z-10 dark:text-white/40" />
                    <select
                      name="city"
                      value={form.city}
                      onChange={handleInputChange}
                      className="w-full appearance-none rounded-2xl border border-black/15 bg-white py-2.5 pl-9 pr-7 text-xs font-medium text-black focus:border-[#0f5132] focus:outline-none cursor-pointer dark:border-white/15 dark:bg-[#222832] dark:text-white dark:focus:border-emerald-500"
                    >
                      {INDIAN_CITIES.map((city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-black/40 pointer-events-none dark:text-white/40" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-black/70 mb-1 dark:text-white/70">Target (kg/wk)</label>
                  <div className="relative">
                    <Target size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40" />
                    <input
                      type="number"
                      name="weeklyEmissionTargetKg"
                      placeholder="85"
                      min={10}
                      max={500}
                      value={form.weeklyEmissionTargetKg}
                      onChange={handleInputChange}
                      className="w-full rounded-2xl border border-black/15 bg-white py-2.5 pl-9 pr-3 text-xs font-medium text-black focus:border-[#0f5132] focus:outline-none dark:border-white/15 dark:bg-[#222832] dark:text-white dark:focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {mode === "signup" && signupStep === "verify" && (
              <div>
                <label className="block text-xs font-semibold text-black/70 mb-1 dark:text-white/70">6-Digit Verification Code</label>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40" />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="••••••"
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value)}
                    className="w-full rounded-2xl border border-black/15 bg-white py-3 pl-10 pr-4 text-sm font-medium text-black tracking-[0.4em] focus:border-[#0f5132] focus:outline-none dark:border-white/15 dark:bg-[#222832] dark:text-white dark:focus:border-emerald-500"
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setSignupStep("details");
                      setOtpInput("");
                      setSuccessMsg("");
                      setError("");
                    }}
                    className="font-medium text-black/55 transition hover:text-[#0f5132] hover:underline dark:text-white/55 dark:hover:text-emerald-400"
                  >
                    ← Edit details
                  </button>
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={loading}
                    className="font-medium text-[#0f5132] transition hover:underline disabled:opacity-50 dark:text-emerald-400"
                  >
                    Resend Code 🔄
                  </button>
                </div>
              </div>
            )}

            {mode === "forgot" && forgotStep === "reset" && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-black/70 mb-1 dark:text-white/70">6-Digit Reset Code</label>
                  <div className="relative">
                    <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40" />
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      placeholder="••••••"
                      value={forgotCode}
                      onChange={(e) => setForgotCode(e.target.value)}
                      className="w-full rounded-2xl border border-black/15 bg-white py-3 pl-10 pr-4 text-sm font-medium text-black tracking-[0.4em] focus:border-[#0f5132] focus:outline-none dark:border-white/15 dark:bg-[#222832] dark:text-white dark:focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-black/70 mb-1 dark:text-white/70">New Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40" />
                    <input
                      type="password"
                      name="password"
                      required
                      minLength={6}
                      placeholder="At least 6 characters"
                      value={form.password}
                      onChange={handleInputChange}
                      className="w-full rounded-2xl border border-black/15 bg-white py-3 pl-10 pr-4 text-sm font-medium text-black focus:border-[#0f5132] focus:outline-none dark:border-white/15 dark:bg-[#222832] dark:text-white dark:focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-black/70 mb-1 dark:text-white/70">Confirm New Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="Re-type new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-2xl border border-black/15 bg-white py-3 pl-10 pr-4 text-sm font-medium text-black focus:border-[#0f5132] focus:outline-none dark:border-white/15 dark:bg-[#222832] dark:text-white dark:focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep("request");
                      setForgotCode("");
                      setSuccessMsg("");
                      setError("");
                    }}
                    className="font-medium text-black/55 transition hover:text-[#0f5132] hover:underline dark:text-white/55 dark:hover:text-emerald-400"
                  >
                    ← Edit email
                  </button>
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={loading}
                    className="font-medium text-[#0f5132] transition hover:underline disabled:opacity-50 dark:text-emerald-400"
                  >
                    Resend Code 🔄
                  </button>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#15171b] py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#0f5132] active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : mode === "forgot" ? (
                forgotStep === "request" ? "Send Reset Code 📧" : "Reset Password & Sign In 🔑"
              ) : mode === "signin" ? (
                "Sign In"
              ) : signupStep === "verify" ? (
                "Verify & Create Account"
              ) : (
                "Send Verification Code"
              )}
            </button>
          </form>

          {/* Demo User Switch */}
          <div className="mt-5 border-t border-black/10 pt-4 text-center dark:border-white/10">
            <button
              type="button"
              onClick={handleDemoUser}
              className="text-xs font-medium text-black/55 transition hover:text-[#0f5132] hover:underline dark:text-white/55 dark:hover:text-emerald-400"
            >
              Or continue as Guest / Demo Account →
            </button>
          </div>
        </motion.div>

        {/* Google Gmail Sign-In Direct Prompt Modal */}
        {showGooglePrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl border border-black/10 text-left dark:bg-[#1c222c] dark:border-white/10"
            >
              <div className="flex items-center justify-between border-b border-black/8 pb-3.5 mb-4 dark:border-white/10">
                <div className="flex items-center gap-2.5">
                  <GoogleLogoIcon />
                  <span className="font-semibold text-black text-sm dark:text-white">{mode === "signup" ? "Create account with Google" : "Sign in with Google"}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGooglePrompt(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-black/5 text-xs text-black/60 hover:bg-black/10 hover:text-black dark:bg-white/10 dark:text-white/60 dark:hover:bg-white/20 dark:hover:text-white"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-black/60 mb-4 dark:text-white/60">
                Select your Gmail account to sign in to <strong>EcoMind</strong>:
              </p>

              <form onSubmit={confirmGoogleAuth} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-black/70 mb-1 dark:text-white/70">Gmail Address</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40" />
                    <input
                      type="email"
                      required
                      placeholder="your.name@gmail.com"
                      value={gmailInput}
                      onChange={(e) => setGmailInput(e.target.value)}
                      className="w-full rounded-2xl border border-black/15 bg-[#f7faf5] py-3 pl-10 pr-4 text-sm font-medium text-black focus:border-[#4285F4] focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#222832] dark:text-white dark:focus:border-emerald-500 dark:focus:bg-[#222832]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#4285F4] py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#3367D6] active:scale-[0.99] disabled:opacity-50"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : `Continue as ${gmailInput.split("@")[0] || "Google User"}`}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

