import { type Logger } from "pino";
import { ReconnectingWebsocket } from "@repo/shared/ws";
import { type DB } from "#/db";
import { textHistory } from "@repo/shared/db";
import { type ServerApi } from "@repo/shared/ws";
import type { State } from "#/state/state";

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
          .values({ text: event.detail, sessionId: activeSessionId })
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
