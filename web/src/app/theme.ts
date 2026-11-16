import { useEffect, useSyncExternalStore } from "react";

import { usePreferencias } from "./preferencias";

const media = () => window.matchMedia("(prefers-color-scheme: dark)");

function subscribeSystem(callback: () => void) {
  const m = media();
  m.addEventListener("change", callback);
  return () => m.removeEventListener("change", callback);
}

function useSystemDark() {
  return useSyncExternalStore(subscribeSystem, () => media().matches);
}

/** Resolved theme ("system" → OS preference). */
export function useIsDark(): boolean {
  const theme = usePreferencias((s) => s.tema);
  const systemDark = useSystemDark();
  return theme === "dark" || (theme === "system" && systemDark);
}

/** Keeps the `dark` class on <html> in sync with the preference. */
export function useApplyTheme() {
  const isDark = useIsDark();
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", isDark);
    root.style.colorScheme = isDark ? "dark" : "light";
  }, [isDark]);
}
