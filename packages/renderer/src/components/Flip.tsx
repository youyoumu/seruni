import { createSignal, onCleanup, onMount } from "solid-js";
import type { JSX } from "solid-js/jsx-runtime";
import { css } from "styled-system/css";
import { Stack } from "styled-system/jsx";

export function createFlip() {
  let ref: HTMLElement | undefined;
  const [flipped, setFlipped] = createSignal(false);

  const handleMouseMove = (e: MouseEvent) => {
    if (!ref) return;
    const rect = ref.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    setFlipped(e.clientX < centerX);
  };

  onMount(() => {
    window.addEventListener("mousemove", handleMouseMove);
    onCleanup(() => window.removeEventListener("mousemove", handleMouseMove));
  });

  return {
    el: ref,
    setRef: (node: HTMLElement) => {
      ref = node;
    },
    flipped,
  };
}
export function Flip({ children }: { children: JSX.Element }) {
  const { setRef, flipped } = createFlip();

  return (
    <Stack
      ref={setRef}
      class={css({
        transform: flipped() ? "rotateY(180deg)" : "rotateY(0deg)",
      })}
    >
      {children}
    </Stack>
  );
}
