import { type DB } from "#/db";
import type { State } from "#/state/state";
import { textHistory } from "@repo/shared/db";
import { ReconnectingWebsocket } from "@repo/shared/ws";
import { type ServerApi } from "@repo/shared/ws";
import { type Logger } from "pino";

const isNotJapaneseRegex =
  /[^0-9A-Z○◯々-〇〻ぁ-ゖゝ-ゞァ-ヺー０-９Ａ-Ｚｦ-ﾝ\p{Radical}\p{Unified_Ideograph}]+/gimu;

function calculateJapaneseCharCount(text: string): number {
  return text.replace(isNotJapaneseRegex, "").length;
}

export class TextHookerClient extends ReconnectingWebsocket {
  state: State;
  messages: string[] = [];
  constructor({
    url = "ws://localhost:6677",
    logger,
    api,
    db,
    state,
  }: {
    url?: string;
    logger: Logger;
    api: ServerApi;
    db: DB;
    state: State;
  }) {
    super({
      url,
      logger: logger.child({ name: "text-hooker-client" }),
    });
    this.state = state;

    this.addEventListener("message", async (event: CustomEventInit<string>) => {
      if (event.detail) {
        this.log.info(`Message: ${event.detail}`);
        const activeSessionId = this.state.activeSessionId();
        if (!activeSessionId) return;
        const row = await db
          .insert(textHistory)
          .values({
            text: event.detail,
            sessionId: activeSessionId,
            japaneseCharacterCount: calculateJapaneseCharCount(event.detail),
          })
          .returning()
          .get();
        api.push.textHistory(row);
      }
    });
  }

  getMessages(): string[] {
    return [...this.messages];
  }

  clearMessages() {
    this.messages = [];
  }
}
