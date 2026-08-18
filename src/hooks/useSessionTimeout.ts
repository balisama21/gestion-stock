import React, { useCallback, useEffect, useRef, useState } from "react";

interface UseSessionTimeoutOptions {
  timeoutMinutes: number; // 0 = disabled
  onTimeout: () => void;
  enabled?: boolean;
}

/**
 * Tracks user activity (mouse, keyboard, touch) and fires onTimeout
 * when the user has been idle for timeoutMinutes.
 */
export function useSessionTimeout({
  timeoutMinutes,
  onTimeout,
  enabled = true,
}: UseSessionTimeoutOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(timeoutMinutes * 60);

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setRemainingSeconds(timeoutMinutes * 60);

    if (!enabled || timeoutMinutes <= 0) return;

    timerRef.current = setTimeout(
      () => {
        onTimeout();
      },
      timeoutMinutes * 60 * 1000,
    );
  }, [timeoutMinutes, onTimeout, enabled]);

  useEffect(() => {
    if (!enabled || timeoutMinutes <= 0) return;

    const events = ["mousedown", "mousemove", "keypress", "touchstart", "scroll", "click"];
    const handleActivity = () => reset();

    events.forEach((event) => window.addEventListener(event, handleActivity, { passive: true }));
    reset(); // Start timer

    // Countdown display (optional)
    const countdown = setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      events.forEach((event) => window.removeEventListener(event, handleActivity));
      if (timerRef.current) clearTimeout(timerRef.current);
      clearInterval(countdown);
    };
  }, [reset, enabled, timeoutMinutes]);

  return { remainingSeconds, reset };
}
