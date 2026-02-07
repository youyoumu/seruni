import { type Logger } from "pino";
import { ReconnectingWebsocket } from "@repo/shared/ws";
import { db } from "#/db";
import { textHistory } from "#/db/schema";
import { type ServerBus } from "#/util/bus";

export class TextHookerClient extends ReconnectingWebsocket {
  messages: string[] = [];
  constructor({
    url = "ws://localhost:6677",
    logger,
    serverBus,
  }: {
    url?: string;
    logger: Logger;
    serverBus: ServerBus;
  }) {
    super({
      url,
      logger: logger.child({ name: "text-hooker-client" }),
    });

    this.addEventListener("message", async (event: CustomEventInit<string>) => {
      if (event.detail) {
        this.log.info(`Message: ${event.detail}`);
        const id = await db.insert(textHistory).values({ text: event.detail }).returning().get();
        serverBus.dispatchTypedEvent(
          "text_history",
          new CustomEvent("text_history", { detail: id }),
        );
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
