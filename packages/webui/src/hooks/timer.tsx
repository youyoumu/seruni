import { intervalToDuration } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";

export interface TimerState {
  seconds: number;
  isRunning: boolean;
  formattedDuration: string;
}

export interface TimerActions {
  start: () => void;
  pause: () => void;
  toggle: () => void;
  reset: () => void;
}

export type UseTimerReturn = TimerState & TimerActions;

function formatDuration(totalSeconds: number): string {
  const duration = intervalToDuration({ start: 0, end: totalSeconds * 1000 });
  const totalHours = (duration.days ?? 0) * 24 + (duration.hours ?? 0);
  const m = String(duration.minutes ?? 0).padStart(2, "0");
  const s = String(duration.seconds ?? 0).padStart(2, "0");
  const h = String(totalHours).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function useTimer(): UseTimerReturn {
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

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

export interface SpeedState {
  speed: number;
  formattedSpeed: string;
}

export function useSpeed(charCount: number, seconds: number): SpeedState {
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
