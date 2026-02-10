import { type Logger } from "pino";
import { ReconnectingWebsocket } from "@repo/shared/ws";
import { type DB } from "#/db";
import { textHistory } from "@repo/shared/db";
import { type ServerApi } from "@repo/shared/ws";

export class TextHookerClient extends ReconnectingWebsocket {
  sessionId: number;
  messages: string[] = [];
  constructor({
    url = "ws://localhost:6677",
    logger,
    api,
    db,
    sessionId,
  }: {
    url?: string;
    logger: Logger;
    api: ServerApi;
    db: DB;
    sessionId: number;
  }) {
    super({
      url,
      logger: logger.child({ name: "text-hooker-client" }),
    });
    this.sessionId = sessionId;

    this.addEventListener("message", async (event: CustomEventInit<string>) => {
      if (event.detail) {
        this.log.info(`Message: ${event.detail}`);
        const row = await db
          .insert(textHistory)
          .values({ text: event.detail, sessionId: this.sessionId })
          .returning()
          .get();
        api.push("text_history", row);
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
