import { intervalToDuration } from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  useActiveSession$,
  useIsListeningTexthooker$,
  useSession$,
  useSetActiveSession,
  useSetIsListeningTexthooker,
  useUpdateSessionDuration,
} from "./sessions";

function formatDuration(totalSeconds: number): string {
  const duration = intervalToDuration({ start: 0, end: totalSeconds * 1000 });
  const totalHours = (duration.days ?? 0) * 24 + (duration.hours ?? 0);
  const m = String(duration.minutes ?? 0).padStart(2, "0");
  const s = String(duration.seconds ?? 0).padStart(2, "0");
  const h = String(totalHours).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

const SYNC_INTERVAL = 5000;

export function useSessionTimer({ sessionId }: { sessionId: number }) {
  const { data: activeSession } = useActiveSession$();
  const { data: session } = useSession$(sessionId);
  const { data: isListeningTexthooker } = useIsListeningTexthooker$();

  const isRunning = isListeningTexthooker && activeSession?.id === sessionId;
  const initialDuration = session.duration;
  const [seconds, setSeconds] = useState(initialDuration);

  // Update seconds when initialDuration changes (e.g., when session data loads)
  useEffect(() => {
    setSeconds(initialDuration);
  }, [initialDuration]);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  const reset = useCallback(() => {
    setSeconds(0);
  }, []);

  const durationRef = useRef<number>(initialDuration);
  useEffect(() => {
    durationRef.current = seconds;
  }, [seconds]);

  const { mutateAsync: updateDuration } = useUpdateSessionDuration();
  const { mutate: setActiveSession } = useSetActiveSession();

  // Sync duration to server every SYNC_INTERVAL while running
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(async () => {
      await updateDuration({ duration: durationRef.current, sessionId });
    }, SYNC_INTERVAL);

    return () => clearInterval(interval);
  }, [isRunning, sessionId, updateDuration]);

  // Sync duration when timer stops
  useEffect(() => {
    if (isRunning) return;
    updateDuration({ duration: durationRef.current, sessionId });
  }, [isRunning, sessionId, updateDuration]);

  const { mutate: setIsListeningTexthooker, isPending: isToggling } = useSetIsListeningTexthooker();

  const toggle = useCallback(() => {
    setIsListeningTexthooker(!isRunning);
    setActiveSession(sessionId);
  }, [isRunning, setIsListeningTexthooker, setActiveSession, sessionId]);

  const start = useCallback(() => {
    if (!isRunning) {
      setIsListeningTexthooker(true);
    }
    setActiveSession(sessionId);
  }, [isRunning, setIsListeningTexthooker, setActiveSession, sessionId]);

  const pause = useCallback(() => {
    if (isRunning) {
      setIsListeningTexthooker(false);
    }
    setActiveSession(sessionId);
  }, [isRunning, setIsListeningTexthooker, setActiveSession, sessionId]);

  const formattedDuration = useMemo(() => formatDuration(seconds), [seconds]);

  return {
    seconds,
    isRunning,
    isToggling,
    formattedDuration,
    start,
    pause,
    toggle,
    reset,
  };
}

export function useReadingSpeed(charCount: number, seconds: number) {
  const speed = useMemo(() => {
    if (seconds === 0) return 0;
    return Math.round((charCount / seconds) * 3600);
  }, [charCount, seconds]);

  const formattedSpeed = useMemo(() => `${speed} chars/hour`, [speed]);

  return {
    speed,
    formattedSpeed,
  };
}
