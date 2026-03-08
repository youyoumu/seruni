import { CloseButton, Skeleton } from "@heroui/react";
import { Suspense } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";

import { NewSessionForm, TextHookerSessionList } from "./SessionList";

export function SideBar(props: { panelRef: PanelImperativeHandle | null }) {
  return (
    <div className="relative h-page overflow-auto border-r bg-surface-calm p-4">
      <CloseButton className="absolute top-4 right-4" onClick={() => props.panelRef?.collapse()} />
      <SessionPanel />
    </div>
  );
}

function SessionPanel() {
  return (
    <div className="flex flex-col gap-4">
      <div className="text-lg">Select Session</div>

      <NewSessionForm />
      <Suspense
        fallback={
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-3/5 rounded-lg" />
            <Skeleton className="h-3 w-4/5 rounded-lg" />
            <Skeleton className="h-3 w-5/5 rounded-lg" />
          </div>
        }
      >
        <TextHookerSessionList />
      </Suspense>
    </div>
  );
}
