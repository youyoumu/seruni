import type { AnkiHistory } from "@repo/preload/ipc";
import { createContext, type JSX, useContext } from "solid-js";

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
  const note = useContext(NoteContext);
  if (!note) throw new Error("NoteContext not found");
  return note;
}
