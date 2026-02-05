import { Logger } from "pino";
import { ReconnectingWebsocket } from "./ReconnectingWebsocket";
import { db } from "#/db";
import { textHistory } from "#/db/schema";

export class TextHookerClient extends ReconnectingWebsocket {
  messages: string[] = [];

  constructor({ url = "ws://localhost:6677", logger }: { url?: string; logger: Logger }) {
    super({
      name: "text-hooker-client",
      url,
      logger,
    });
    this.addEventListener("message", async (event: CustomEventInit<string>) => {
      if (event.detail) {
        this.log.info(`Message: ${event.detail}`);
        const id = await db.insert(textHistory).values({ text: event.detail }).returning();
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
