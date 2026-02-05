import { Logger } from "pino";
import { ReconnectingWebsocket } from "./ReconnectingWebsocket";
import { db } from "#/db";
import { textHistory } from "#/db/schema";
import { TypedEventTarget } from "typescript-event-target";
import { AppEventMap } from "#/types/events.types";

export class TextHookerClient extends ReconnectingWebsocket {
  messages: string[] = [];
  constructor({
    url = "ws://localhost:6677",
    logger,
    et: eventTarget,
  }: {
    url?: string;
    logger: Logger;
    et: TypedEventTarget<AppEventMap>;
  }) {
    super({
      name: "text-hooker-client",
      url,
      logger,
    });

    this.addEventListener("message", async (event: CustomEventInit<string>) => {
      if (event.detail) {
        this.log.info(`Message: ${event.detail}`);
        const id = await db.insert(textHistory).values({ text: event.detail }).returning().get();
        eventTarget.dispatchTypedEvent(
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
