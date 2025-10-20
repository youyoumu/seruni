import type { MediaSrc } from "@repo/preload/ipc";
import { createContext, type JSX, type Signal, useContext } from "solid-js";

export const MediaSrcContext = createContext<Signal<MediaSrc>>();

export function MediaSrcContextProvider(props: {
  children: JSX.Element;
  value: Signal<MediaSrc>;
}) {
  return (
    <MediaSrcContext.Provider value={props.value}>
      {props.children}
    </MediaSrcContext.Provider>
  );
}

export function useMediaSrcContext() {
  const mediaSrc = useContext(MediaSrcContext);
  if (!mediaSrc) throw new Error("MediaSrcContext not found");
  return mediaSrc;
}
