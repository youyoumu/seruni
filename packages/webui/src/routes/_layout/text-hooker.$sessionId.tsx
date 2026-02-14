import { useServices } from "#/hooks/api";
import { useDeleteTextHistory, useTextHistory$ } from "#/hooks/text-history";
import { Skeleton } from "@heroui/react";
import type { TextHistory } from "@repo/shared/db";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { elementScroll, useVirtualizer } from "@tanstack/react-virtual";
import type { VirtualizerOptions } from "@tanstack/react-virtual";
import { randomInt, range, shuffle } from "es-toolkit";
import { TrashIcon } from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

function easeInOutQuint(t: number) {
  return t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * --t * t * t * t * t;
}

const isNotJapaneseRegex =
  /[^0-9A-Z○◯々-〇〻ぁ-ゖゝ-ゞァ-ヺー０-９Ａ-Ｚｦ-ﾝ\p{Radical}\p{Unified_Ideograph}]+/gimu;

const getTextHistoryCharCount = (textHistory: TextHistory[]) =>
  textHistory
    .map((item) => item.text.replace(isNotJapaneseRegex, "").length)
    .reduce((a, b) => a + b, 0);

export const Route = createFileRoute("/_layout/text-hooker/$sessionId")({
  component: TextHookerPage,
  async loader({ params, context }) {
    const { sessionId } = params;
    const { api } = context.services;
    const session = await api.request.session(Number(sessionId));
    if (!session) {
      const sessions = await api.request.sessions();
      const lastSession = sessions[sessions.length - 1];
      if (!lastSession) throw Error("Last session not found");
      throw redirect({
        to: "/text-hooker/$sessionId",
        params: { sessionId: String(lastSession.id) },
      });
    }
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
  return (
    <div className="flex h-screen flex-col overflow-auto">
      <Suspense fallback={<FallbackTextHistoryList />}>
        <TextHistoryPageHeader />
        <TextHistoryList />
      </Suspense>
    </div>
  );
}

function TextHistoryPageHeader() {
  const { sessionId } = Route.useParams();
  const { data: textHistory } = useTextHistory$({ sessionId: Number(sessionId) });

  const textHistoryCharCount = useMemo(() => getTextHistoryCharCount(textHistory), [textHistory]);
  return (
    <div className="flex items-center justify-end border-b p-4 text-lg">{textHistoryCharCount}</div>
  );
}

function TextHistoryList() {
  const { sessionId } = Route.useParams();
  const { data: textHistory } = useTextHistory$({ sessionId: Number(sessionId) });
  const { mutate: deleteTextHistory } = useDeleteTextHistory();
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
    const handleNewTextHistory = (e: CustomEvent<TextHistory>) => {
      if (e.detail.sessionId === Number(sessionId)) {
        setTimeout(() => {
          virtualizer.scrollToOffset(virtualizer.getTotalSize());
        }, 0);
      }
    };

    bus.addEventListener("textHistory:new", handleNewTextHistory);
    return () => {
      bus.removeEventListener("textHistory:new", handleNewTextHistory);
    };
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
              ref={virtualizer.measureElement}
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
              <div className="flex items-start gap-2 border-b p-2 hover:bg-surface-calm">
                <p className="flex-1 text-xl">
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

                <TrashIcon
                  size={20}
                  className="shrink-0 cursor-pointer text-danger"
                  onClick={() => {
                    deleteTextHistory(item.id);
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
