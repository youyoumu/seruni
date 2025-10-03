import { signal } from "alien-signals";
import { WebSocket } from "ws";
import { log } from "../util/logger";

export function createTextractorClient() {
  class TextractorClient {
    // TODO: limit history size
    history: { time: Date; text: string }[] = [];
    client: WebSocket | undefined;
    constructor() {}

    prepare() {
      try {
        //TODO: configure port
        this.client = new WebSocket("ws://127.0.0.1:6677");
        this.client.on("error", (e) => {
          log.error({ error: e }, "Failed to connect to textractor");
        });
        this.client.on("open", () => {
          log.info("Connected to textractor");
        });

        this.client.on("message", (data) => {
          // Convert Buffer → UTF-8 string
          const text = Buffer.isBuffer(data)
            ? data.toString("utf8")
            : data.toString();
          log.debug({ text }, "Received from textractor");
          this.history.push({ time: new Date(), text });
        });
      } catch (e) {
        log.error({ error: e }, "Failed to connect to textractor");
      }
    }
  }

  return new TextractorClient();
}

export const textractorClient = signal(createTextractorClient());
