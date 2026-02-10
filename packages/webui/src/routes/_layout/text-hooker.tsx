import { createFileRoute } from "@tanstack/react-router";
import { useTextHistory } from "#/hooks/text-history";
import { useConfig } from "#/hooks/config";
import { TrashIcon } from "lucide-react";
import { useRef } from "react";

export const Route = createFileRoute("/_layout/text-hooker")({
  component: TextHookerPage,
});

function TextHookerPage() {
  const [textHistory] = useTextHistory();
  const textHistoryContainer = useRef<HTMLDivElement>(null);
  useConfig();

  return (
    <div className="p-4 overflow-auto">
      <div className="flex flex-col gap-16" ref={textHistoryContainer}>
        {textHistory.map((item) => (
          <div className="flex items-center gap-2 border-b p-2 hover:bg-surface-calm">
            <p key={item.id} className="text-xl flex-1">
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
        <p className="mt-16"></p>
      </div>
    </div>
  );
}
