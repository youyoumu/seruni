import { RatIcon } from "lucide-solid";
import {
  createEffect,
  createSignal,
  type JSX,
  type ParentProps,
  Show,
} from "solid-js";
import { css } from "styled-system/css";
import { Stack } from "styled-system/jsx";
import { Flip } from "#/components/Flip";
import { Icon } from "#/components/ui/icon";
import { Spinner } from "#/components/ui/spinner";
import { srcSet } from "./_util";

export function ImageWithFallback(props: {
  src: string;
  image: (
    props: () => ParentProps<JSX.ImgHTMLAttributes<HTMLImageElement>>,
  ) => JSX.Element;
  onErrorChange?: (error: boolean) => void;
}) {
  const [loaded, setLoaded] = createSignal(srcSet.has(props.src));
  const [error, setError] = createSignal(false);
  createEffect(() => {
    props.src;
    setError(false);
  });
  createEffect(() => {
    props.onErrorChange?.(error());
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
            width: "full",
          })}
        >
          <Spinner size="lg" />
        </Stack>
      </Show>
      <Show when={error()}>
        <Stack
          class={css({
            rounded: "sm",
            borderColor: "border.default",
            borderWidth: "thin",
            aspectRatio: "16 / 9",
            alignItems: "center",
            justifyContent: "center",
            height: "auto",
            width: "full",
          })}
        >
          <Flip>
            <Icon
              color="fg.muted"
              width="12"
              height="12"
              strokeWidth="1"
              asChild={(iconProps) => <RatIcon {...iconProps()} />}
            />
          </Flip>
        </Stack>
      </Show>
    </>
  );
}
