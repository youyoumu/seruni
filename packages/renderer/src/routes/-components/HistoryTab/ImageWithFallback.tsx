import {
  createEffect,
  createSignal,
  type JSX,
  type ParentProps,
  Show,
} from "solid-js";
import { css } from "styled-system/css";
import { Stack } from "styled-system/jsx";
import { Spinner } from "#/components/ui/spinner";
import { srcSet } from "./_util";

export function ImageWithFallback(props: {
  src: string;
  image: (
    props: () => ParentProps<JSX.ImgHTMLAttributes<HTMLImageElement>>,
  ) => JSX.Element;
  height: string;
}) {
  const [loaded, setLoaded] = createSignal(srcSet.has(props.src));
  const [error, setError] = createSignal(false);
  createEffect(() => {
    props.src;
    setError(false);
  });
  return (
    <>
      <Show when={!error()}>
        {props.image(() => ({
          style: {
            display: loaded() ? "block" : "none",
          },
          onLoad: () => {
            setLoaded(true);
            srcSet.add(props.src);
          },
          onError: () => {
            setError(true);
          },
        }))}
      </Show>
      <Show when={!loaded() && !error()}>
        <Stack
          class={css({
            rounded: "sm",
            borderColor: "border.default",
            borderWidth: "thin",
            aspectRatio: "16 / 9",
            alignItems: "center",
            justifyContent: "center",
            height: `[${props.height}]`,
            width: "full",
          })}
        >
          <Spinner size="lg" />
        </Stack>
      </Show>
      <Show when={loaded() && error()}>
        <Stack
          class={css({
            rounded: "sm",
            borderColor: "border.default",
            borderWidth: "thin",
            aspectRatio: "16 / 9",
            alignItems: "center",
            justifyContent: "center",
            //TODO: this doesn't work
            height: `[${props.height}]`,
            width: "full",
          })}
        ></Stack>
      </Show>
    </>
  );
}
