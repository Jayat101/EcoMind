import { useEffect, useState } from "react";

const PREF_KEY = "ecomind_premium_theme_v1";

function readPref() {
  try {
    const saved = localStorage.getItem(PREF_KEY);
    if (saved === "1" || saved === "0") return saved === "1";
  } catch {
    /* ignore */
  }
  return true;
}

export function usePremiumTheme({ unlocked = false }) {
  const [enabled, setEnabled] = useState(readPref);

  useEffect(() => {
    const root = document.documentElement;
    if (unlocked && enabled) root.setAttribute("data-premium-theme", "earth");
    else root.removeAttribute("data-premium-theme");
    try {
      localStorage.setItem(PREF_KEY, enabled ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [unlocked, enabled]);

  return {
    isThemeUnlocked: unlocked,
    isEnabled: enabled,
    setEnabled
  };
}
