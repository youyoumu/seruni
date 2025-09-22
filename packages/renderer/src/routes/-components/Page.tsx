import { css } from "styled-system/css";
import { Button } from "#/components/ui/button";
import { Sidebar } from "./Sidebar";

export function Page() {
  return (
    <div
      class={css({
        bg: "bg.default",
        color: "fg.default",
        minH: "screen",
        p: "2",
        gap: "2",
        display: "flex",
        fontFamily: "nunito",
      })}
    >
      <div>test</div>
      <Button>Open VN Overlay</Button>
      <Sidebar />
    </div>
  );
}
