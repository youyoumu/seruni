import { createFileRoute, notFound } from "@tanstack/react-router";
import { useTextHistory$ } from "#/hooks/text-history";
import { useConfig } from "#/hooks/config";
import { TrashIcon } from "lucide-react";
import { useRef } from "react";

export const Route = createFileRoute("/_layout/text-hooker/$sessionId")({
  component: TextHookerPage,
  async beforeLoad({ params, context }) {
    const { sessionId } = params;
    const { api } = context;
    let session: any;
    try {
      session = await api.request.session(Number(sessionId));
    } catch {
      throw notFound();
    }

    console.log("DEBUG[1579]: session=", session);
    if (!session) throw notFound();
  },
});

function TextHookerPage() {
  const { sessionId } = Route.useParams();
  const { data: textHistory } = useTextHistory$({ sessionId: Number(sessionId) });
  const textHistoryContainer = useRef<HTMLDivElement>(null);
  useConfig();

  return (
    <div className="p-4 overflow-auto">
      <div className="flex flex-col gap-16 pb-16" ref={textHistoryContainer}>
        {textHistory.map((item) => (
          <div key={item.id} className="flex items-center gap-2 border-b p-2 hover:bg-surface-calm">
            <p className="text-xl flex-1">
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
              className="size-5, cursor-pointer text-danger"
              onClick={() => {
                // texthoookerDB.text.where("uuid").equals(item.uuid).delete();
              }}
            ></TrashIcon>
          </div>
        ))}
      </div>
    </div>
  );
}
