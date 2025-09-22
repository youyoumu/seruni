import { Roarr as log_ } from "roarr";
import { logIPC } from "#/ipc/log";

export const log = log_.child<{
  error: unknown;
}>((message) => {
  const error_ =
    message.context.error && message.context.error instanceof Error
      ? {
          message: message.context.error.message,
        }
      : undefined;

  const message_ = {
    ...message,
    context: {
      ...message.context,
      error: error_,
    },
  };

  for (const [key, value] of Object.entries(message.context)) {
    if (typeof value === "undefined") delete message.context[key];
  }

  logIPC.send("log:send", message_);
  return message_;
});
