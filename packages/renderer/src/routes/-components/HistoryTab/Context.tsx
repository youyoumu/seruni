import { createContext, type JSX, useContext } from "solid-js";
import type { SetStoreFunction, Store } from "solid-js/store";

//  ────────────────────────────── NoteForm ───────────────────────────

export type NoteForm = {
  picture: string | undefined;
  sentenceAudio: string | undefined;
};
export const NoteFormContext =
  createContext<[Store<NoteForm>, SetStoreFunction<NoteForm>]>();
export function NoteFormContextProvider(props: {
  children: JSX.Element;
  value: [Store<NoteForm>, SetStoreFunction<NoteForm>];
}) {
  return (
    <NoteFormContext.Provider value={props.value}>
      {props.children}
    </NoteFormContext.Provider>
  );
}
export function useNoteFormContext() {
  const value = useContext(NoteFormContext);
  if (!value) throw new Error("NoteFormContext not found");
  return value;
}

//  ───────────────────────────── NoteContext ─────────────────────────────

import type { AnkiHistory } from "@repo/preload/ipc";

export const NoteContext = createContext<AnkiHistory[number]>();

export function NoteContextProvider(props: {
  children: JSX.Element;
  value: AnkiHistory[number];
}) {
  return (
    <NoteContext.Provider value={props.value}>
      {props.children}
    </NoteContext.Provider>
  );
}

export function useNoteContext() {
  const value = useContext(NoteContext);
  if (!value) throw new Error("NoteContext not found");
  return value;
}

//  ─────────────────────────── MedisSrcContext ───────────────────────────

type NoteMediaSrc = {
  fileName: () => string | undefined;
  source: () => "anki" | "storage";
};
export const NoteMediaSrcContext = createContext<NoteMediaSrc>();

export function NoteMediaSrcContextProvider(props: {
  children: JSX.Element;
  value: NoteMediaSrc;
}) {
  return (
    <NoteMediaSrcContext.Provider value={props.value}>
      {props.children}
    </NoteMediaSrcContext.Provider>
  );
}

export function useNoteMediaSrcContext() {
  const value = useContext(NoteMediaSrcContext);
  if (!value) throw new Error("NoteMediaSrcContext not found");
  return value;
}
