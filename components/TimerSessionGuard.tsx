import { useCallback, useEffect } from "react";
import { AppState } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useTimerStore } from "../store/useTimerStore";

export function TimerSessionGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const init = useTimerStore((s) => s.init);
  const refreshActiveSession = useTimerStore((s) => s.refreshActiveSession);
  const activeSession = useTimerStore((s) => s.activeSession);
  const isReady = useTimerStore((s) => s.isReady);

  const ensureRoute = useCallback(async () => {
    const session = await refreshActiveSession();
    if (session?.status === "running" && pathname !== "/timer-running") {
      router.replace("/timer-running");
      return;
    }
    if (session?.status === "stopped" && pathname !== "/timer-stop") {
      router.replace("/timer-stop");
    }
  }, [pathname, refreshActiveSession, router]);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (!isReady) return;
    ensureRoute();
  }, [activeSession?.status, ensureRoute, isReady]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        ensureRoute();
      }
    });
    return () => sub.remove();
  }, [ensureRoute]);

  return null;
}
