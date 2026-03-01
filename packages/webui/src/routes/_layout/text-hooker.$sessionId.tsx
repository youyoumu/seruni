import { useHover } from "#/hooks/dom";
import { useServices } from "#/hooks/services";
import {
  useDeleteTextHistory,
  useIsTextHistoryCompleted$,
  useMarkTextHistoryAsCompleted,
  useTextHistory$,
} from "#/hooks/text-history";
import { useReadingSpeed, useSessionTimer } from "#/hooks/timer";
import { Button, cn, Popover, Separator, Skeleton } from "@heroui/react";
import { type TextHistory } from "@repo/shared/db";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { elementScroll, useVirtualizer } from "@tanstack/react-virtual";
import type { VirtualizerOptions } from "@tanstack/react-virtual";
import { randomInt, range, shuffle } from "es-toolkit";
import {
  ClockCheckIcon,
  EllipsisVerticalIcon,
  PauseIcon,
  PlayIcon,
  RssIcon,
  TrashIcon,
} from "lucide-react";
import { memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

function easeInOutQuint(t: number) {
  return t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * --t * t * t * t * t;
}

function getTextHistoryCharCount(textHistory: TextHistory[]) {
  return textHistory.reduce((sum, item) => sum + item.japaneseCharacterCount, 0);
}

export const Route = createFileRoute("/_layout/text-hooker/$sessionId")({
  component: TextHookerPage,
  params: {
    parse: (params) => ({
      sessionId: Number(params.sessionId),
    }),
  },
  async loader({ params, context }) {
    const { sessionId } = params;
    const { api } = context.services;
    const session = await api.request.session(sessionId);
    if (!session) {
      const sessions = await api.request.sessions();
      const lastSession = sessions[sessions.length - 1];
      if (!lastSession) throw Error("Last session not found");
      throw redirect({
        to: "/text-hooker/$sessionId",
        params: { sessionId: lastSession.id },
      });
    }
  },
  async onLeave({ context }) {
    const { api } = context.services;
    await api.request.setIsListeningTexthooker(false);
  },
});

function FallbackTextHistoryList() {
  const [widthPool] = useState(shuffle(["w-3/5", "w-4/5", "w-5/5"]));
  const [skeletonCount] = useState(randomInt(3, 6));

  return (
    <div className="flex flex-col gap-8 px-4 pt-8 pb-16">
      {range(skeletonCount).map((_, i) => (
        <Skeleton key={i} className={`h-6 ${widthPool[i]} rounded-lg`} />
      ))}
    </div>
  );
}

function TextHookerPage() {
  const { sessionId } = Route.useParams();
  const { data: textHistory } = useTextHistory$({ sessionId });
  const textHistoryCharCount = useMemo(() => getTextHistoryCharCount(textHistory), [textHistory]);

  const timer = useSessionTimer({
    sessionId,
  });
  const speed = useReadingSpeed(textHistoryCharCount, timer.seconds);

  return (
    <div className="flex h-full flex-col overflow-auto">
      <Suspense fallback={<FallbackTextHistoryList />}>
        <div className="flex items-center justify-between gap-4 border-b p-4">
          <div>
            <RssIcon
              size={24}
              className={cn({
                "text-surface-foreground-faint": !timer.isRunning,
              })}
            />
          </div>
          <div className="flex h-full items-center justify-end gap-4">
            <span className="text-lg font-medium">
              {textHistoryCharCount} characters in {timer.formattedDuration}
            </span>
            <Separator orientation="vertical" />
            <span className="text-lg font-semibold">{speed.formattedSpeed}</span>
            <Button isIconOnly onClick={timer.toggle}>
              {timer.isRunning ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
            </Button>
          </div>
        </div>
        <TextHistoryListM isRunning={timer.isRunning} />
      </Suspense>
    </div>
  );
}

const TextHistoryListM = memo(TextHistoryList);

function TextHistoryList(props: { isRunning: boolean }) {
  const { sessionId } = Route.useParams();
  const { data: textHistory } = useTextHistory$({ sessionId });
  const { bus } = useServices();

  const parentRef = useRef<HTMLDivElement>(null);
  const hasScrolledOnLoad = useRef(false);
  const scrollingRef = useRef<number | undefined>(undefined);

  const scrollToFn: VirtualizerOptions<HTMLDivElement, Element>["scrollToFn"] = useCallback(
    (offset, canSmooth, instance) => {
      const start = parentRef.current?.scrollTop ?? 0;
      const distance = Math.abs(offset - start);

      // For large scrolls, use instant scroll to avoid scroll failures
      if (distance > 10000) {
        elementScroll(offset, canSmooth, instance);
        return;
      }

      // Dynamic duration based on distance (0.5ms per pixel, min 500ms, max 2000ms)
      const duration = Math.min(Math.max(distance * 0.5, 500), 2000);
      const startTime = (scrollingRef.current = Date.now());

      const run = () => {
        if (scrollingRef.current !== startTime) return;
        const now = Date.now();
        const elapsed = now - startTime;
        const progress = easeInOutQuint(Math.min(elapsed / duration, 1));
        const interpolated = start + (offset - start) * progress;

        if (elapsed < duration) {
          elementScroll(interpolated, canSmooth, instance);
          requestAnimationFrame(run);
        } else {
          elementScroll(interpolated, canSmooth, instance);
        }
      };

      requestAnimationFrame(run);
    },
    [],
  );

  const virtualizer = useVirtualizer({
    count: textHistory.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    measureElement: (element) => element.getBoundingClientRect().height,
    gap: 32,
    paddingStart: 32,
    paddingEnd: 128,
    overscan: 5,
    scrollToFn,
  });

  useEffect(() => {
    if (textHistory.length > 0 && !hasScrolledOnLoad.current) {
      virtualizer.scrollToIndex(textHistory.length - 1, { align: "end" });
      hasScrolledOnLoad.current = true;
    }
  }, [textHistory.length, virtualizer]);

  useEffect(() => {
    return bus.addListener("textHistory:new", (detail) => {
      if (detail.sessionId === sessionId) {
        setTimeout(() => {
          virtualizer.scrollToOffset(virtualizer.getTotalSize());
        }, 0);
      }
    });
  }, [sessionId, bus, virtualizer, textHistory.length]);

  return (
    <div ref={parentRef} className="flex-1 overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const item = textHistory[virtualItem.index];
          if (!item) return null; // never

          return (
            <div
              key={virtualItem.key}
              ref={(el) => {
                virtualizer.measureElement(el);
              }}
              data-index={virtualItem.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start}px)`,
              }}
              className="px-4"
            >
              <TextHistoryItem
                textHistory={item}
                last={virtualItem.index === textHistory.length - 1}
                isRunning={props.isRunning}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TextHistoryItem(props: {
  textHistory: TextHistory;
  last: boolean;
  isRunning: boolean;
}) {
  const { textHistory: item, last, isRunning } = props;
  const [isOpen, setIsOpen] = useState(false);
  const [hoverRef, isHover] = useHover();

  return (
    <div ref={hoverRef} className="flex items-start gap-2 border-b p-2 hover:bg-surface-calm">
      <p
        className={cn("flex-1 text-xl", {
          "text-surface-foreground-calm": !isRunning,
        })}
      >
        {"\n"}
        {item.text}
        <span
          style={{
            opacity: 0.01,
            fontSize: "0.1px",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >{`‹id:${item.id}›`}</span>
        {"\n"}
      </p>
      {isHover || isOpen ? (
        <TextHistoryPopover
          onOpenChange={setIsOpen}
          key={item.id}
          slot={{
            trigger: <EllipsisVerticalIcon className="size-4 text-surface-foreground-soft" />,
          }}
          textHistory={item}
          last={last}
        />
      ) : (
        <EllipsisVerticalIcon className="size-4 text-surface-foreground-soft" />
      )}
    </div>
  );
}

export function TextHistoryPopover(props: {
  slot: { trigger: React.ReactNode };
  textHistory: TextHistory;
  onOpenChange?: (open: boolean) => void;
  last?: boolean;
}) {
  const { onOpenChange, last } = props;
  const { mutate: deleteTextHistory } = useDeleteTextHistory();
  const { mutate: markTextHistoryAsCompleted } = useMarkTextHistoryAsCompleted();
  const isCompleted = useIsTextHistoryCompleted$(props.textHistory);

  useEffect(() => {
    return onOpenChange?.(false);
  }, [onOpenChange]);

  return (
    <Popover onOpenChange={onOpenChange}>
      <Popover.Trigger>{props.slot.trigger}</Popover.Trigger>
      <Popover.Content className="-translate-4 overflow-auto bg-surface-calm">
        <Popover.Dialog className="flex flex-col gap-2">
          <button
            className={cn("flex items-center gap-2 rounded-lg p-2", {
              "cursor-pointer hover:bg-surface-soft": !isCompleted,
              hidden: !last,
            })}
            disabled={isCompleted}
            onClick={() => {
              markTextHistoryAsCompleted(props.textHistory.id);
            }}
          >
            <ClockCheckIcon className={cn("size-4 shrink-0", { "text-success": isCompleted })} />
            <div className={cn({ "text-surface-foreground-soft": isCompleted })}>
              Mark as completed
            </div>
          </button>
          <button
            className="flex cursor-pointer items-center gap-2 rounded-lg p-2 hover:bg-surface-soft"
            onClick={() => {
              deleteTextHistory(props.textHistory.id);
            }}
          >
            <TrashIcon className="size-4 shrink-0 text-danger" />
            <div>Delete</div>
          </button>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
