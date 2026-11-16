import { useSyncExternalStore } from "react";

import { isDesktop } from "./platform";

/**
 * The phone's breakpoint (the Conecta's `useTelaCelular`): below 1024 px the
 * browser shows the phone's shell (the floating bar, full-screen pages). The
 * same edge as Tailwind's `max-lg:`.
 */
export const PHONE_QUERY = "(max-width: 1023.98px)";

const subscribe = (callback: () => void) => {
  const media = window.matchMedia(PHONE_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
};
const snapshot = () => window.matchMedia(PHONE_QUERY).matches;
const never = () => false;
const unsubscribed = () => () => {};

/**
 * True in the browser below 1024 px; always false in the desktop app (its
 * window is never narrower than 1024). For what CSS cannot branch on alone:
 * an old class with a `dark:` partner (which beats `max-lg:`), an inline
 * width, markup only the phone has (spec, ground rule 1).
 */
export function useIsPhone(): boolean {
  return useSyncExternalStore(isDesktop ? unsubscribed : subscribe, isDesktop ? never : snapshot, never);
}
