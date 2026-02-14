import { useServices } from "#/hooks/api";
import { useMutation } from "@tanstack/react-query";
import { intervalToDuration } from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useSession$ } from "./sessions";

function formatDuration(totalSeconds: number): string {
  const duration = intervalToDuration({ start: 0, end: totalSeconds * 1000 });
  const totalHours = (duration.days ?? 0) * 24 + (duration.hours ?? 0);
  const m = String(duration.minutes ?? 0).padStart(2, "0");
  const s = String(duration.seconds ?? 0).padStart(2, "0");
  const h = String(totalHours).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function useTimer(initialDuration = 0) {
  const [seconds, setSeconds] = useState(initialDuration);
  const [isRunning, setIsRunning] = useState(false);

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

  const formattedDuration = useMemo(() => formatDuration(seconds), [seconds]);

  const start = useCallback(() => setIsRunning(true), []);
  const pause = useCallback(() => setIsRunning(false), []);
  const toggle = useCallback(() => setIsRunning((prev) => !prev), []);
  const reset = useCallback(() => {
    setIsRunning(false);
    setSeconds(0);
  }, []);

  return {
    seconds,
    isRunning,
    formattedDuration,
    start,
    pause,
    toggle,
    reset,
  };
}

const SYNC_INTERVAL = 5000;
export function useSessionTimer({ sessionId }: { sessionId: number }) {
  const { api } = useServices();
  const { data: session } = useSession$(sessionId);
  const { formattedDuration, isRunning, pause, reset, seconds, start, toggle } = useTimer(
    session.duration,
  );
  const durationRef = useRef<number>(session.duration);

  const { mutateAsync: updateDuration } = useMutation({
    mutationFn: async (duration: number) => {
      return await api.request.updateSession({ id: sessionId, duration });
    },
  });

  //update when timer.seconds changes
  useEffect(() => {
    durationRef.current = seconds;
  }, [seconds]);

  // sync every x seconds
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(async () => {
      await updateDuration(durationRef.current);
    }, SYNC_INTERVAL);

    return () => clearInterval(interval);
  }, [isRunning, sessionId, updateDuration]);

  // sync when timer is stopped
  useEffect(() => {
    if (isRunning) return;
    updateDuration(durationRef.current);
  }, [isRunning, sessionId, updateDuration]);

  const forceSync = useCallback(async () => {
    await updateDuration(durationRef.current);
  }, [updateDuration]);

  return {
    seconds,
    isRunning,
    formattedDuration,
    start,
    pause,
    toggle,
    reset,
    forceSync,
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
