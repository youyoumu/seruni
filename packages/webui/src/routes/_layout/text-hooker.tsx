import { createFileRoute } from "@tanstack/react-router";
import { useTextHistory } from "#/hooks/text-history";
import { useConfig } from "#/hooks/config";

export const Route = createFileRoute("/_layout/text-hooker")({
  component: TextHookerPage,
});

function TextHookerPage() {
  const [textHistory] = useTextHistory();
  useConfig();

  return (
    <div className="p-4 overflow-auto">
      <div className="flex flex-col gap-16">
        {textHistory.map((text, i) => (
          <p key={i} className="text-xl">
            {text}
          </p>
        ))}
        <p className="mt-16"></p>
      </div>
    </div>
  );
}
