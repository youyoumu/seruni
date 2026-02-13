import { type Logger } from "pino";
import { ReconnectingWebsocket } from "@repo/shared/ws";
import { type DB } from "#/db";
import { textHistory } from "@repo/shared/db";
import { type ServerApi } from "@repo/shared/ws";

export class TextHookerClient extends ReconnectingWebsocket {
  activeSessionId: () => number | undefined;
  messages: string[] = [];
  constructor({
    url = "ws://localhost:6677",
    logger,
    api,
    db,
    activeSessionId,
  }: {
    url?: string;
    logger: Logger;
    api: ServerApi;
    db: DB;
    activeSessionId: () => number | undefined;
  }) {
    super({
      url,
      logger: logger.child({ name: "text-hooker-client" }),
    });
    this.activeSessionId = activeSessionId;

    this.addEventListener("message", async (event: CustomEventInit<string>) => {
      if (event.detail) {
        this.log.info(`Message: ${event.detail}`);
        const activeSessionId = this.activeSessionId();
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
