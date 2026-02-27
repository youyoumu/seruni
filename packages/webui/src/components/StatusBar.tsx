import {
  useTextHookerConnected$,
  useAnkiConnectConnected$,
  useObsConnected$,
} from "#/hooks/client";
import { Spinner } from "@heroui/react";
import { ZapIcon, ZapOffIcon } from "lucide-react";

export function StatusBar() {
  const { data: textHookerConnected } = useTextHookerConnected$();
  const { data: ankiConnectConnected } = useAnkiConnectConnected$();
  const { data: obsConnected } = useObsConnected$();

  return (
    <div className="flex justify-end gap-2 border-t border-border bg-surface-calm px-2 py-1">
      <div className="flex items-center gap-2">
        <StatusIcon status={textHookerConnected ? "connected" : "connecting"} />
        <div className="text-sm">Text Hooker</div>
      </div>
      <div className="flex items-center gap-2">
        <StatusIcon status={ankiConnectConnected ? "connected" : "connecting"} />
        <div className="text-sm">Anki Connect</div>
      </div>
      <div className="flex items-center gap-2">
        <StatusIcon status={obsConnected ? "connected" : "connecting"} />
        <div className="text-sm">OBS</div>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: "connected" | "disconnected" | "connecting" }) {
  switch (status) {
    case "connected":
      return <ZapIcon size={16} className="text-success" />;
    case "disconnected":
      return <ZapOffIcon size={16} className="text-danger" />;
    case "connecting":
      return <Spinner className="size-4 text-surface-foreground-calm" />;
  }
}
