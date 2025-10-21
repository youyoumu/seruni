import type { NoteMediaSrc } from "@repo/preload/ipc";
import { createContext, type JSX, type Signal, useContext } from "solid-js";

export const MediaSrcContext = createContext<Signal<NoteMediaSrc>>();

export function MediaSrcContextProvider(props: {
  children: JSX.Element;
  value: Signal<NoteMediaSrc>;
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
