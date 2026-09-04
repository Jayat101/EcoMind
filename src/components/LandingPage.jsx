import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowRight, Award, BarChart3, Bot, CheckCircle2, ChevronDown, Eye, EyeOff, KeyRound, Loader2, Lock, Mail, MapPin, ShieldCheck, Sparkles, Target, User, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { INDIAN_CITIES } from "../constants/cities.js";
import { googleLogin, googleSignup, loginUser, resetPasswordWithCode, sendForgotPasswordCode, sendVerificationCode, signupUser, verifyEmailCode } from "../services/api.js";
import ThemeToggle from "./ThemeToggle.jsx";

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

export default function LandingPage({ onAuthenticated }) {
  const [mode, setMode] = useState("signup"); // "signup", "signin", or "forgot"
  const [signupStep, setSignupStep] = useState("details"); // "details" or "verify"
  const [forgotStep, setForgotStep] = useState("request"); // "request" or "reset"
  const [otpInput, setOtpInput] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    city: "New Delhi",
    weeklyEmissionTargetKg: 85
  });

  const [showGooglePrompt, setShowGooglePrompt] = useState(false);
  const [googleStep, setGoogleStep] = useState("input"); // "input" or "verify"
  const [gmailInput, setGmailInput] = useState("");
  const [googleOtp, setGoogleOtp] = useState("");
  const [googleError, setGoogleError] = useState("");
  const [pendingGoogleUser, setPendingGoogleUser] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined" || window.google) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  function handleInputChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  // Handle Step 1: Send Verification Code to Email
  async function handleSendSignupCode(event) {
    event.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!form.name.trim()) return setError("Please enter your full name.");
    if (!form.email.trim()) return setError("Please enter your email address.");
    if (!form.password || form.password.length < 6) return setError("Password must be at least 6 characters.");

    setLoading(true);
    try {
      const data = await sendVerificationCode(form.email.trim());
      const devHint = data?.devCode ? ` Dev code: ${data.devCode}` : "";
      setSuccessMsg(`Verification code sent to ${form.email.trim()}! Please check your email inbox.${devHint}`);
      setSignupStep("verify");
    } catch (err) {
      setError(err.response?.data?.message ?? err.message ?? "Failed to send verification code.");
    } finally {
      setLoading(false);
    }
  }

  // Handle Step 2: Verify Code and Create Account
  async function handleVerifyAndSignup(event) {
    event.preventDefault();
    setError("");

    setLoading(true);
    try {
      if (!otpInput.trim() || otpInput.trim().length !== 6) {
        throw new Error("Please enter the 6-digit verification code.");
      }

      await verifyEmailCode(form.email.trim(), otpInput.trim());
      const user = await signupUser(form);
      onAuthenticated(user);
    } catch (err) {
      setError(err.response?.data?.message ?? err.message ?? "Verification failed.");
    } finally {
      setLoading(false);
    }
  }

  // Handle Forgot Password Request Code
  async function handleRequestResetCode(event) {
    event.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!form.email.trim()) return setError("Please enter your registered email address.");

    setLoading(true);
    try {
      const data = await sendForgotPasswordCode(form.email.trim());
      const devHint = data?.devCode ? ` Dev code: ${data.devCode}` : "";
      setSuccessMsg(`Password reset code sent to ${form.email.trim()}! Please check your email inbox.${devHint}`);
      setForgotStep("reset");
    } catch (err) {
      setError(err.response?.data?.message ?? err.message ?? "Failed to send reset code.");
    } finally {
      setLoading(false);
    }
  }

  // Handle Reset Password Submit
  async function handleResetPassword(event) {
    event.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!form.email.trim()) return setError("Please enter your email address.");
    if (!forgotCode.trim() || forgotCode.trim().length !== 6) return setError("Please enter the 6-digit reset code.");
    if (!form.password || form.password.length < 6) return setError("New password must be at least 6 characters.");
    if (form.password !== confirmPassword) return setError("Passwords do not match.");

    setLoading(true);
    try {
      const user = await resetPasswordWithCode(form.email.trim(), forgotCode.trim(), form.password);
      onAuthenticated(user);
    } catch (err) {
      setError(err.response?.data?.message ?? err.message ?? "Password reset failed.");
    } finally {
      setLoading(false);
    }
  }

  // Handle Login Flow
  async function handleSigninSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!form.email.trim()) throw new Error("Please enter your email address.");
      if (!form.password) throw new Error("Please enter your password.");

      const user = await loginUser({ email: form.email, password: form.password });
      onAuthenticated(user);
    } catch (err) {
      setError(err.response?.data?.message ?? err.message ?? "Sign-in failed. Please check credentials.");
    } finally {
      setLoading(false);
    }
  }

  // Direct Google / Gmail Login (No verification code needed)
  async function handleSendGoogleCode(event) {
    event.preventDefault();
    setGoogleError("");
    setError("");

    const email = gmailInput.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return setGoogleError("Please enter a valid Gmail address.");

    setLoading(true);
    try {
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
    } catch (err) {
      setGoogleError(err.response?.data?.message ?? err.message ?? "Google login failed.");
    } finally {
      setLoading(false);
    }
  }

  // Real Google Sign-In via OAuth2 popup (always shows the full account picker)
  async function handleGoogleSignIn() {
    setGoogleError("");
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!clientId || clientId.startsWith("demo-")) {
      setGoogleError("Google Sign-In isn't configured yet. Please use email sign-up.");
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
      setGoogleError("Could not load Google Sign-In. Please check your connection and reload.");
      return;
    }

    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "openid email profile",
        callback: async (tokenResponse) => {
          try {
            if (tokenResponse.error) {
              setGoogleError("Google Sign-In was cancelled or failed.");
              setLoading(false);
              return;
            }

            const userInfo = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
            }).then((r) => r.json());

            if (mode === "signup") {
              setPendingGoogleUser({
                email: userInfo.email,
                name: userInfo.name,
                picture: userInfo.picture,
                sub: userInfo.sub
              });
              setLoading(false);
              return;
            }

            const user = await googleLogin({
              email: userInfo.email,
              name: userInfo.name,
              picture: userInfo.picture,
              sub: userInfo.sub
            });
            onAuthenticated(user);
          } catch (err) {
            if (
              err?.response?.status === 400 &&
              /already exists|sign in instead/i.test(err.response.data?.message ?? "")
            ) {
              setError(err.response.data.message);
            } else {
              setError(err.response?.data?.message ?? err.message ?? "Google Sign-In failed.");
            }
          } finally {
            setLoading(false);
          }
        },
        error_callback: () => {
          setLoading(false);
          setGoogleError("Google Sign-In was cancelled or blocked. Please allow popups and try again.");
        }
      });
      tokenClient.requestAccessToken();
    } catch (err) {
      setLoading(false);
      setGoogleError("Google Sign-In failed to initialize. Please try again.");
    }
  }

  // Complete the Google signup with the user's chosen city & weekly target
  async function handleCompleteGoogleSignup(event) {
    event.preventDefault();
    setError("");
    setGoogleError("");
    setLoading(true);
    try {
      const user = await googleSignup({
        email: pendingGoogleUser.email,
        name: pendingGoogleUser.name,
        picture: pendingGoogleUser.picture,
        sub: pendingGoogleUser.sub,
        city: form.city,
        weeklyEmissionTargetKg: form.weeklyEmissionTargetKg
      });
      setPendingGoogleUser(null);
      onAuthenticated(user);
    } catch (err) {
      if (err?.response?.status === 400 && /already exists/i.test(err.response.data?.message ?? "")) {
        setError(err.response.data.message);
      } else {
        setError(err.response?.data?.message ?? err.message ?? "Google Sign-Up failed.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleDemoLogin() {
    onAuthenticated({
      userId: "demo-user",
      name: "Aarav Mehta",
      email: "demo@ecomind.org",
      city: "New Delhi",
      weeklyEmissionTargetKg: 85
    });
  }

  return (
    <div className="relative min-h-screen bg-[#f7faf5] text-black overflow-hidden flex flex-col justify-between p-4 sm:p-8 transition-colors duration-300 dark:bg-transparent dark:text-white">
      {/* Background Orbs */}
      <div className="ambient-core" />
      <div className="ambient-orbit" />

      {/* Top Header Logo */}
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl">
            <img src="/favicon.svg" alt="EcoMind" className="h-11 w-11" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-black dark:text-white">EcoMind</h1>
            <p className="text-[11px] text-black/45 dark:text-white/45">Carbon Intelligence</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle className="flex h-11 w-11 items-center justify-center rounded-2xl border border-black/10 bg-white text-black shadow-sm transition hover:bg-black/5 dark:border-white/15 dark:bg-[#222832] dark:text-white dark:hover:bg-white/10" />
          <button
            type="button"
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-xs font-semibold text-black shadow-sm transition hover:bg-black/5 dark:border-white/15 dark:bg-[#222832] dark:text-white dark:hover:bg-white/10"
          >
            {mode === "signup" ? "Already registered? Sign In" : "New here? Sign Up"}
            <ArrowRight size={14} />
          </button>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="relative z-10 mx-auto my-auto grid w-full max-w-7xl items-center gap-12 py-8 lg:grid-cols-12">
        {/* Left Side: Value Proposition Hero */}
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="lg:col-span-7 space-y-6"
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-[#0f5132]/10 px-4 py-1.5 text-xs font-semibold text-[#0f5132] dark:bg-emerald-500/15 dark:text-emerald-400">
            <Sparkles size={14} />
            Personal Carbon Accounting & Intelligence
          </span>

          <h2 className="text-5xl font-medium leading-[1.05] tracking-[-0.03em] text-black sm:text-6xl md:text-7xl dark:text-white">
            Track your footprint. Build zero-carbon habits.
          </h2>

          <p className="max-w-2xl text-base leading-relaxed text-black/60 sm:text-lg dark:text-white/60">
            EcoMind combines daily travel, energy, and food check-ins with AI recommendations to help you measure, benchmark, and lower your personal emissions.
          </p>

          {/* Feature Highlights Grid */}
          <div className="grid gap-4 sm:grid-cols-2 pt-4">
            <div className="rounded-[24px] bg-white p-5 shadow-[0_10px_28px_rgba(20,22,26,0.04)] border border-black/5 dark:bg-[#222832] dark:border-white/10 dark:shadow-none">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f5132]/10 text-[#0f5132] dark:bg-emerald-500/15 dark:text-emerald-400">
                <BarChart3 size={20} />
              </div>
              <h3 className="font-semibold text-black text-base dark:text-white">Live Carbon Score</h3>
              <p className="mt-1 text-xs text-black/50 leading-relaxed dark:text-white/50">
                Accounts start fresh at 0 score. Watch your score increase as you log low-carbon days.
              </p>
            </div>

            <div className="rounded-[24px] bg-white p-5 shadow-[0_10px_28px_rgba(20,22,26,0.04)] border border-black/5 dark:bg-[#222832] dark:border-white/10 dark:shadow-none">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f5132]/10 text-[#0f5132] dark:bg-emerald-500/15 dark:text-emerald-400">
                <Zap size={20} />
              </div>
              <h3 className="font-semibold text-black text-base dark:text-white">Practical Check-ins</h3>
              <p className="mt-1 text-xs text-black/50 leading-relaxed dark:text-white/50">
                Log real travel km, AC running hours, heavy appliances, and food choices in 30 seconds.
              </p>
            </div>

            <div className="rounded-[24px] bg-white p-5 shadow-[0_10px_28px_rgba(20,22,26,0.04)] border border-black/5 dark:bg-[#222832] dark:border-white/10 dark:shadow-none">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f5132]/10 text-[#0f5132] dark:bg-emerald-500/15 dark:text-emerald-400">
                <Bot size={20} />
              </div>
              <h3 className="font-semibold text-black text-base dark:text-white">AI Insights & Forecast</h3>
              <p className="mt-1 text-xs text-black/50 leading-relaxed dark:text-white/50">
                Receive priority action tips and 7-day predictive models tailored to your routine.
              </p>
            </div>

            <div className="rounded-[24px] bg-white p-5 shadow-[0_10px_28px_rgba(20,22,26,0.04)] border border-black/5 dark:bg-[#222832] dark:border-white/10 dark:shadow-none">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f5132]/10 text-[#0f5132] dark:bg-emerald-500/15 dark:text-emerald-400">
                <Award size={20} />
              </div>
              <h3 className="font-semibold text-black text-base dark:text-white">Badges & Rewards</h3>
              <p className="mt-1 text-xs text-black/50 leading-relaxed dark:text-white/50">
                Earn milestone badges, engagement points, and discount bonuses for recycling habits.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Right Side: Dedicated Auth Landing Card */}
        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="lg:col-span-5"
        >
          <div className="rounded-[36px] bg-white p-6 shadow-2xl border border-black/8 sm:p-8 dark:bg-[#1c222c] dark:border-white/10">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-black sm:text-3xl dark:text-white">
                  {mode === "signup" ? "Create Account" : mode === "signin" ? "Welcome Back" : "Reset Password"}
                </h2>
                <p className="mt-1 text-xs text-black/50 dark:text-white/50">
                  {mode === "signup"
                    ? "Sign up to start tracking your carbon footprint."
                    : mode === "signin"
                      ? "Sign in to access your saved dashboard."
                      : forgotStep === "request"
                        ? "Enter your registered email to receive a 6-digit reset code."
                        : "Enter the 6-digit code sent to your email and your new password."}
                </p>
              </div>

              {/* Toggle Switch */}
              <div className="inline-flex rounded-2xl bg-black/5 p-1 dark:bg-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setError("");
                    setSuccessMsg("");
                  }}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                    mode === "signup" ? "bg-white text-black shadow-sm dark:bg-[#222832] dark:text-white" : "text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"
                  }`}
                >
                  Sign Up
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError("");
                    setSuccessMsg("");
                  }}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                    mode === "signin" || mode === "forgot" ? "bg-white text-black shadow-sm dark:bg-[#222832] dark:text-white" : "text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"
                  }`}
                >
                  Sign In
                </button>
              </div>
            </div>

            {mode !== "forgot" && (
              <>
                {/* Google Quick Connect Button */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border border-black/10 bg-[#f7faf5] py-3.5 text-sm font-semibold text-black shadow-sm transition hover:bg-black/5 active:scale-[0.99] dark:border-white/15 dark:bg-[#222832] dark:text-white dark:hover:bg-white/10"
                >
                  <GoogleLogoIcon />
                  <span>Continue with Google / Gmail</span>
                </button>

                <div className="relative my-5 flex items-center justify-center">
                  <div className="w-full border-t border-black/10 dark:border-white/10" />
                  <span className="absolute bg-white px-3 text-[11px] uppercase tracking-wider text-black/40 dark:bg-[#1c222c] dark:text-white/40">
                    Or with Email
                  </span>
                </div>
              </>
            )}

            {/* Error & Success Messages */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 flex items-start gap-2 rounded-2xl bg-red-50 p-3.5 text-xs text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20"
              >
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 flex items-start gap-2 rounded-2xl bg-emerald-50 p-3.5 text-xs text-[#0f5132] border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
              >
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                <span>{successMsg}</span>
              </motion.div>
            )}

            {/* Signin Form */}
            {mode === "signin" && (
              <form onSubmit={handleSigninSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-black/70 mb-1 dark:text-white/70">Email Address</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40" />
                    <input
                      type="email"
                      name="email"
                      required
                      placeholder="name@gmail.com"
                      value={form.email}
                      onChange={handleInputChange}
                      className="w-full rounded-2xl border border-black/15 bg-[#f7faf5] py-3 pl-10 pr-4 text-sm font-medium text-black focus:border-[#0f5132] focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#222832] dark:text-white dark:focus:border-emerald-500 dark:focus:bg-[#222832]"
                    />
                  </div>
                </div>

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
                      type={showLoginPassword ? "text" : "password"}
                      name="password"
                      required
                      placeholder="••••••••"
                      value={form.password}
                      onChange={handleInputChange}
                      className="w-full rounded-2xl border border-black/15 bg-[#f7faf5] py-3 pl-10 pr-11 text-sm font-medium text-black focus:border-[#0f5132] focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#222832] dark:text-white dark:focus:border-emerald-500 dark:focus:bg-[#222832]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword((visible) => !visible)}
                      aria-label={showLoginPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 transition hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
                    >
                      {showLoginPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#15171b] py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#0f5132] active:scale-[0.99] disabled:opacity-50"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : "Sign In to EcoMind"}
                </button>
              </form>
            )}

            {/* Forgot Password Form */}
            {mode === "forgot" && (
              <div>
                {forgotStep === "request" ? (
                  <form onSubmit={handleRequestResetCode} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-black/70 mb-1 dark:text-white/70">Registered Email Address</label>
                      <div className="relative">
                        <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40" />
                        <input
                          type="email"
                          name="email"
                          required
                          placeholder="name@gmail.com"
                          value={form.email}
                          onChange={handleInputChange}
                          className="w-full rounded-2xl border border-black/15 bg-[#f7faf5] py-3 pl-10 pr-4 text-sm font-medium text-black focus:border-[#0f5132] focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#222832] dark:text-white dark:focus:border-emerald-500 dark:focus:bg-[#222832]"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#15171b] py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#0f5132] active:scale-[0.99] disabled:opacity-50"
                    >
                      {loading ? <Loader2 size={18} className="animate-spin" /> : "Send Reset Code 📧"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMode("signin");
                        setError("");
                        setSuccessMsg("");
                      }}
                      className="w-full text-center text-xs font-medium text-black/55 transition hover:text-[#0f5132] hover:underline dark:text-white/55 dark:hover:text-emerald-400"
                    >
                      ← Back to Sign In
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleResetPassword} className="space-y-3.5">
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
                          className="w-full rounded-2xl border border-black/15 bg-[#f7faf5] py-3 pl-10 pr-4 text-sm font-medium text-black tracking-[0.4em] focus:border-[#0f5132] focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#222832] dark:text-white dark:focus:border-emerald-500 dark:focus:bg-[#222832]"
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
                          className="w-full rounded-2xl border border-black/15 bg-[#f7faf5] py-3 pl-10 pr-4 text-sm font-medium text-black focus:border-[#0f5132] focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#222832] dark:text-white dark:focus:border-emerald-500 dark:focus:bg-[#222832]"
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
                          className="w-full rounded-2xl border border-black/15 bg-[#f7faf5] py-3 pl-10 pr-4 text-sm font-medium text-black focus:border-[#0f5132] focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#222832] dark:text-white dark:focus:border-emerald-500 dark:focus:bg-[#222832]"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#15171b] py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#0f5132] active:scale-[0.99] disabled:opacity-50"
                    >
                      {loading ? <Loader2 size={18} className="animate-spin" /> : "Reset Password & Sign In 🔑"}
                    </button>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setForgotStep("request");
                          setForgotCode("");
                          setError("");
                          setSuccessMsg("");
                        }}
                        className="font-medium text-black/55 transition hover:text-[#0f5132] hover:underline dark:text-white/55 dark:hover:text-emerald-400"
                      >
                        ← Edit email
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMode("signin");
                          setError("");
                          setSuccessMsg("");
                        }}
                        className="font-medium text-black/55 transition hover:text-[#0f5132] hover:underline dark:text-white/55 dark:hover:text-emerald-400"
                      >
                        Back to Sign In
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Signup Form */}
            {mode === "signup" && (
              <div>
                {pendingGoogleUser ? (
                  <form onSubmit={handleCompleteGoogleSignup} className="space-y-3.5">
                    <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-3 dark:bg-emerald-500/10">
                      {pendingGoogleUser.picture ? (
                        <img src={pendingGoogleUser.picture} alt="" className="h-10 w-10 rounded-full" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0f5132] text-white">
                          <User size={18} />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-black dark:text-white">{pendingGoogleUser.name || "Google User"}</p>
                        <p className="text-xs text-black/60 dark:text-white/60">{pendingGoogleUser.email}</p>
                      </div>
                    </div>

                    <p className="text-xs text-black/60 dark:text-white/60">
                      You're all set with Google. Just tell us your city and weekly carbon goal to finish creating your account.
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-black/70 mb-1 dark:text-white/70">City</label>
                        <div className="relative">
                          <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40 pointer-events-none z-10 dark:text-white/40" />
                          <select
                            name="city"
                            value={form.city}
                            onChange={handleInputChange}
                            className="w-full appearance-none rounded-2xl border border-black/15 bg-[#f7faf5] py-2.5 pl-9 pr-7 text-xs font-medium text-black focus:border-[#0f5132] focus:bg-white focus:outline-none cursor-pointer dark:border-white/15 dark:bg-[#222832] dark:text-white dark:focus:border-emerald-500 dark:focus:bg-[#222832]"
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
                            className="w-full rounded-2xl border border-black/15 bg-[#f7faf5] py-2.5 pl-9 pr-3 text-xs font-medium text-black focus:border-[#0f5132] focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#222832] dark:text-white dark:focus:border-emerald-500 dark:focus:bg-[#222832]"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0f5132] py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#0b3d26] active:scale-[0.99] disabled:opacity-50"
                    >
                      {loading ? <Loader2 size={18} className="animate-spin" /> : "Create My EcoMind Account"}
                    </button>
                  </form>
                ) : signupStep === "details" ? (
                  <form onSubmit={handleSendSignupCode} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-black/70 mb-1 dark:text-white/70">Full Name</label>
                      <div className="relative">
                        <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40" />
                        <input
                          type="text"
                          name="name"
                          required
                          placeholder="Aarav Mehta"
                          value={form.name}
                          onChange={handleInputChange}
                          className="w-full rounded-2xl border border-black/15 bg-[#f7faf5] py-3 pl-10 pr-4 text-sm font-medium text-black focus:border-[#0f5132] focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#222832] dark:text-white dark:focus:border-emerald-500 dark:focus:bg-[#222832]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-black/70 mb-1 dark:text-white/70">Email Address</label>
                      <div className="relative">
                        <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40" />
                        <input
                          type="email"
                          name="email"
                          required
                          placeholder="name@gmail.com"
                          value={form.email}
                          onChange={handleInputChange}
                          className="w-full rounded-2xl border border-black/15 bg-[#f7faf5] py-3 pl-10 pr-4 text-sm font-medium text-black focus:border-[#0f5132] focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#222832] dark:text-white dark:focus:border-emerald-500 dark:focus:bg-[#222832]"
                        />
                      </div>
                    </div>

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
                          className="w-full rounded-2xl border border-black/15 bg-[#f7faf5] py-3 pl-10 pr-4 text-sm font-medium text-black focus:border-[#0f5132] focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#222832] dark:text-white dark:focus:border-emerald-500 dark:focus:bg-[#222832]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-black/70 mb-1 dark:text-white/70">City</label>
                        <div className="relative">
                          <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40 pointer-events-none z-10 dark:text-white/40" />
                          <select
                            name="city"
                            value={form.city}
                            onChange={handleInputChange}
                            className="w-full appearance-none rounded-2xl border border-black/15 bg-[#f7faf5] py-2.5 pl-9 pr-7 text-xs font-medium text-black focus:border-[#0f5132] focus:bg-white focus:outline-none cursor-pointer dark:border-white/15 dark:bg-[#222832] dark:text-white dark:focus:border-emerald-500 dark:focus:bg-[#222832]"
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
                            className="w-full rounded-2xl border border-black/15 bg-[#f7faf5] py-2.5 pl-9 pr-3 text-xs font-medium text-black focus:border-[#0f5132] focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#222832] dark:text-white dark:focus:border-emerald-500 dark:focus:bg-[#222832]"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0f5132] py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#0b3d26] active:scale-[0.99] disabled:opacity-50"
                    >
                      {loading ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <span>Send 6-Digit Verification Code</span>
                      )}
                    </button>
                  </form>
                ) : (
                  /* Step 2: Enter Verification Code Form */
                  <form onSubmit={handleVerifyAndSignup} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-black/70 mb-1 dark:text-white/70">
                        Enter 6-Digit Verification Code
                      </label>
                      <div className="relative">
                        <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40" />
                        <input
                          type="text"
                          required
                          maxLength={6}
                          placeholder="123456"
                          value={otpInput}
                          onChange={(e) => setOtpInput(e.target.value)}
                          className="w-full rounded-2xl border border-black/15 bg-[#f7faf5] py-3 pl-10 pr-4 text-center font-mono text-lg tracking-widest text-black focus:border-[#0f5132] focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#222832] dark:text-white dark:focus:border-emerald-500 dark:focus:bg-[#222832]"
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-black/50 dark:text-white/50">
                        Enter the code sent to <strong className="text-black dark:text-white">{form.email}</strong>.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0f5132] py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#0b3d26] active:scale-[0.99] disabled:opacity-50"
                    >
                      {loading ? <Loader2 size={18} className="animate-spin" /> : "Verify Code & Complete Registration"}
                    </button>

                    <button
                      type="button"
                      onClick={() => setSignupStep("details")}
                      className="w-full text-center text-xs text-black/50 hover:text-black hover:underline dark:text-white/50 dark:hover:text-white"
                    >
                      ← Back to edit email details
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Guest Demo Account Switch */}
            <div className="mt-6 border-t border-black/10 pt-4 text-center dark:border-white/10">
              <button
                type="button"
                onClick={handleDemoLogin}
                className="text-xs font-medium text-black/55 transition hover:text-[#0f5132] hover:underline dark:text-white/55 dark:hover:text-emerald-400"
              >
                Or continue as Guest / Demo Account →
              </button>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Google Verification Modal */}
      {showGooglePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl border border-black/10 text-left dark:bg-[#1c222c] dark:border-white/10"
          >
            <div className="flex items-center justify-between border-b border-black/8 pb-3.5 mb-4 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <GoogleLogoIcon />
                <span className="font-semibold text-black text-sm dark:text-white">Google Gmail Sign-In</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowGooglePrompt(false);
                  setGoogleStep("input");
                }}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-black/5 text-xs text-black/60 hover:bg-black/10 hover:text-black dark:bg-white/10 dark:text-white/60 dark:hover:bg-white/20 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            {googleError && (
              <div className="mb-3 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20">
                {googleError}
              </div>
            )}

            <form onSubmit={handleSendGoogleCode} className="space-y-3">
              <p className="text-xs text-black/60 dark:text-white/60">
                {mode === "signup"
                  ? "Create your EcoMind account with your Gmail address:"
                  : "Confirm your Gmail address to sign in directly to <strong>EcoMind</strong>:"}
              </p>

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
                {loading ? <Loader2 size={18} className="animate-spin" /> : mode === "signup" ? `Create Account as ${gmailInput.split("@")[0] || "Google User"}` : `Sign In as ${gmailInput.split("@")[0] || "Google User"}`}
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* Footer */}
      <footer className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between py-4 text-xs text-black/40 dark:text-white/40">
        <p>© {new Date().getFullYear()} EcoMind. Personal Carbon Accounting.</p>
        <div className="flex gap-4">
          <span className="flex items-center gap-1"><ShieldCheck size={14} /> 256-bit Encrypted</span>
        </div>
      </footer>
    </div>
  );
}

