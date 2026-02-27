import { useState, useRef, useEffect, useCallback } from "react";

export function useHover(delayMs: number = 100) {
  const [isHovered, setIsHovered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseOver = useCallback(() => {
    // If the user re-enters before the "exit delay" is over,
    // cancel the scheduled "set to false".
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsHovered(true);
  }, []);

  const handleMouseOut = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsHovered(false);
      timeoutRef.current = null;
    }, delayMs);
  }, [delayMs]);

  useEffect(() => {
    const node = ref.current;

    if (node) {
      node.addEventListener("mouseover", handleMouseOver);
      node.addEventListener("mouseout", handleMouseOut);

      return () => {
        node.removeEventListener("mouseover", handleMouseOver);
        node.removeEventListener("mouseout", handleMouseOut);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }
  }, [handleMouseOver, handleMouseOut]);

  return [ref, isHovered] as const;
}
