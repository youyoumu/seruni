import { useDeleteTextHistory, useTextHistory$ } from "#/hooks/text-history";
import { createFileRoute, redirect } from "@tanstack/react-router";
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
  const textHistoryContainer = useRef<HTMLDivElement>(null);

  return (
    <div className="overflow-auto p-4">
      <div className="flex flex-col gap-16 pb-16" ref={textHistoryContainer}>
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

  //TODO: virtual list
  return textHistory.map((item) => (
    <div key={item.id} className="flex items-center gap-2 border-b p-2 hover:bg-surface-calm">
      <p className="flex-1 text-xl">
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
      ></TrashIcon>
    </div>
  ));
}
