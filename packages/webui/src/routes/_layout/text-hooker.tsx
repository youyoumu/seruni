import { createFileRoute } from "@tanstack/react-router";
import { useTextHistory } from "#/hooks/text-history";

export const Route = createFileRoute("/_layout/text-hooker")({
  component: TextHookerPage,
});

function TextHookerPage() {
  const [textHistory] = useTextHistory();

  return (
    <div className="p-2 bg-surface-faint">
      <h3 className="text-xl font-bold mb-4">Text Hooker</h3>
      {textHistory.map((text, i) => (
        <p key={i} className="text-sm mb-2">
          {text}
        </p>
      ))}
    </div>
  );
}
