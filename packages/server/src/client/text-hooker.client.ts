import { type DB } from "#/db";
import type { State } from "#/state/state";
import { textHistory } from "@repo/shared/db";
import { ReconnectingWebSocket } from "@repo/shared/ws";
import { type ServerApi } from "@repo/shared/ws";
import { debounce } from "es-toolkit";
import { type Logger } from "pino";

const isNotJapaneseRegex =
  /[^0-9A-Z○◯々-〇〻ぁ-ゖゝ-ゞァ-ヺー０-９Ａ-Ｚｦ-ﾝ\p{Radical}\p{Unified_Ideograph}]+/gimu;

function calculateJapaneseCharCount(text: string): number {
  return text.replace(isNotJapaneseRegex, "").length;
}

export class TextHookerClient extends ReconnectingWebSocket {
  state: State;
  messages: string[] = [];

  constructor(opts: { url?: string; logger: Logger; api: ServerApi; db: DB; state: State }) {
    super({
      url: opts.url ?? "ws://localhost:6677",
      logger: opts.logger.child({ name: "text-hooker-client" }),
    });
    this.state = opts.state;

    const textHookerToastD = debounce(() => {
      opts.api.push.toast({
        title: "Text Hooker",
        description: "Received a message but timer is paused.",
      });
    }, 1000);

    this.addListener("message", async (detail) => {
      if (typeof detail === "string") {
        const text = detail.replaceAll("\n", " ").trim();
        const isListeningTexthooker = this.state.isListeningTexthooker();
        if (!isListeningTexthooker) {
          textHookerToastD();
          return;
        }
        this.log.info(`Message: ${detail}`);
        const activeSessionId = this.state.activeSessionId();
        if (!activeSessionId) return;
        const row = await opts.db
          .insert(textHistory)
          .values({
            text: text,
            sessionId: activeSessionId,
            japaneseCharacterCount: calculateJapaneseCharCount(text),
          })
          .returning()
          .get();
        opts.api.push.textHistory(row);
      }
    });

    this.addListener("open", () => {
      this.state.textHookerConnected(true);
    });

    this.addListener("close", () => {
      this.state.textHookerConnected(false);
    });
  }

  getMessages(): string[] {
    return [...this.messages];
  }

  clearMessages() {
    this.messages = [];
  }
}
