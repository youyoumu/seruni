import { type DB } from "#/services/db.service";
import type { State } from "#/state/state";
import { textHistory } from "@repo/shared/db";
import { ReconnectingWebSocket } from "@repo/shared/ws";
import { type ServerApi } from "@repo/shared/ws";
import { effect } from "alien-signals";
import { debounce } from "es-toolkit";
import { type Logger } from "pino";

const isNotJapaneseRegex =
  /[^0-9A-Z○◯々-〇〻ぁ-ゖゝ-ゞァ-ヺー０-９Ａ-Ｚｦ-ﾝ\p{Radical}\p{Unified_Ideograph}]+/gimu;

function calculateJapaneseCharCount(text: string): number {
  return text.replace(isNotJapaneseRegex, "").length;
}

export class TextHookerClient extends ReconnectingWebSocket {
  messages: string[] = [];

  constructor(
    public log: Logger,
    public api: ServerApi,
    public db: DB,
    public state: State,
  ) {
    super({ url: state.config().textHookerWebSocketAddress, log });
    this.log = log.child({ name: "text-hooker" });

    const textHookerToastD = debounce(() => {
      this.api.push.toast({
        title: "Text Hooker",
        description: "Received a message but timer is paused.",
      });
    }, 1000);

    this.addListener("message", async (detail) => {
      const now = new Date();
      if (typeof detail === "string") {
        if (this.state.isTextHookerAutoResume() && !this.state.isListeningTextHooker()) {
          this.state.isListeningTextHooker(true);
        }
        this.setupAfkTimer();
        const text = detail.replaceAll("\n", " ").trim();
        const isListeningTexthooker = this.state.isListeningTextHooker();
        if (!isListeningTexthooker) {
          textHookerToastD();
          return;
        }
        this.log.info(`Message: ${detail}`);
        const activeSessionId = this.state.activeSessionId();
        if (!activeSessionId) return;
        const row = this.db
          .insert(textHistory)
          .values({
            text: text,
            sessionId: activeSessionId,
            japaneseCharacterCount: calculateJapaneseCharCount(text),
            createdAt: now,
          })
          .returning()
          .get();
        this.api.push.textHistory(row);
      }
    });

    this.addListener("open", () => {
      this.state.textHookerConnected(true);
    });

    this.addListener("close", () => {
      this.state.textHookerConnected(false);
    });

    effect(() => this.setupAfkTimer());
    effect(() => {
      this.state.isListeningTextHooker();
      this.setupAfkTimer();
    });
  }

  #afkTimeoutId: NodeJS.Timeout | undefined;
  setupAfkTimer() {
    const afkTimer = this.state.config().textHookerAfkTimerS * 1000;
    clearTimeout(this.#afkTimeoutId);
    if (afkTimer <= 0) return;
    this.#afkTimeoutId = setTimeout(() => {
      this.state.isListeningTextHooker(false);
    }, afkTimer);
  }

  getMessages(): string[] {
    return [...this.messages];
  }

  clearMessages() {
    this.messages = [];
  }
}
