import { useDeleteTextHistory, useTextHistory$ } from "#/hooks/text-history";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { TrashIcon } from "lucide-react";
import { Suspense, useRef } from "react";

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

function TextHookerPage() {
  return (
    <div className="overflow-auto p-4">
      <div className="flex flex-col gap-16 pb-16">
        {/* //TODO: pretty loading */}
        <Suspense fallback="loading...">
          <TextHistoryList />
        </Suspense>
      </div>
    </div>
  );
}

function TextHistoryList() {
  const { sessionId } = Route.useParams();
  const { data: textHistory } = useTextHistory$({ sessionId: Number(sessionId) });
  const { mutate: deleteTextHistory } = useDeleteTextHistory();

  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: textHistory.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5,
  });

  return (
    <div ref={parentRef} className="h-[calc(100vh-8rem)] overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const item = textHistory[virtualItem.index];
          return (
            <div
              key={virtualItem.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
              className="flex items-center gap-2 border-b p-2 hover:bg-surface-calm"
            >
              <p className="flex-1 text-xl break-words whitespace-pre-wrap">
                {"\n"}
                {item.text}
                <span
                  style={{
                    opacity: 0.01,
                    fontSize: "0.1px",
                  }}
                >{`‹id:${item.id}›`}</span>
                {"\n"}
              </p>

              <TrashIcon
                size={20}
                className="cursor-pointer text-danger"
                onClick={() => {
                  deleteTextHistory(item.id);
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
