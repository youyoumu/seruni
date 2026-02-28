import {
  useTextHookerConnected$,
  useAnkiConnectConnected$,
  useObsConnected$,
} from "#/hooks/client";
import { useServices } from "#/hooks/services";
import { Popover, Spinner, tv } from "@heroui/react";
import { useSelector } from "@xstate/store-react";
import {
  AlertTriangleIcon,
  BellIcon,
  CheckCircleIcon,
  InfoIcon,
  XCircleIcon,
  XIcon,
  ZapIcon,
  ZapOffIcon,
} from "lucide-react";

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

      <div className="flex items-center gap-2">
        <ToastHistoryPopover
          slot={{
            trigger: <BellIcon className="size-4" />,
          }}
        />
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: "connected" | "disconnected" | "connecting" }) {
  switch (status) {
    case "connected":
      return <ZapIcon className="size-4 text-success" />;
    case "disconnected":
      return <ZapOffIcon className="size-4 text-danger" />;
    case "connecting":
      return <Spinner className="size-4 text-surface-foreground-calm" />;
  }
}

export function ToastHistoryPopover(props: {
  slot: {
    trigger: React.ReactNode;
  };
}) {
  const { toastStore } = useServices();

  return (
    <Popover>
      <Popover.Trigger>{props.slot.trigger}</Popover.Trigger>
      <Popover.Content className="-translate-4 overflow-auto bg-surface-calm">
        <Popover.Dialog className="flex flex-col gap-4">
          <Popover.Heading className="flex items-center justify-between text-lg">
            <div>Notification History</div>
            <button
              className="cursor-pointer text-sm text-surface-foreground-soft"
              onClick={() => toastStore.trigger.clearHistory()}
            >
              Clear
            </button>
          </Popover.Heading>
          <ToastHistoryList />
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

const toastTitleTv = tv({
  variants: {
    color: {
      default: "",
      accent: "text-accent",
      success: "text-success",
      warning: "text-warning",
      danger: "text-danger",
    },
  },
});

function ToastHistoryList() {
  const { toastStore } = useServices();
  const toastHistory = useSelector(toastStore, (s) => s.context.history);

  return (
    <div className="flex max-h-[50vh] min-w-[320px] flex-col gap-2 overflow-auto pe-4">
      {toastHistory.map((item, i) => (
        <div key={item.id} className="flex gap-2 rounded-xl p-2 hover:bg-surface-soft">
          <ToastIcon variant={item.variant ?? "default"} />
          <div className="flex flex-1 flex-col">
            <div className={toastTitleTv({ color: item.variant ?? "default" })}>{item.title}</div>
            <div className="text-sm text-surface-foreground-soft">{item.description}</div>
          </div>
          <XIcon
            className="size-4 cursor-pointer"
            onClick={() => toastStore.trigger.removeToast(item)}
          />
        </div>
      ))}
    </div>
  );
}

const toastIconTv = tv({
  base: ["size-4"],
  variants: {
    color: {
      default: "",
      accent: "",
      success: "text-success",
      warning: "text-warning",
      danger: "text-danger",
    },
  },
});

function ToastIcon(props: { variant: "default" | "accent" | "success" | "warning" | "danger" }) {
  switch (props.variant) {
    case "default":
      return <InfoIcon className={toastIconTv()} />;
    case "accent":
      return <InfoIcon className={toastIconTv({ color: "accent" })} />;
    case "success":
      return <CheckCircleIcon className={toastIconTv({ color: "success" })} />;
    case "warning":
      return <AlertTriangleIcon className={toastIconTv({ color: "warning" })} />;
    case "danger":
      return <XCircleIcon className={toastIconTv({ color: "danger" })} />;
  }
}
