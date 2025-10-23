import { Roarr as log_, ROARR } from "roarr";

const queue: string[] = [];
let socket: WebSocket;

function flushQueue() {
  while (queue.length && socket.readyState === WebSocket.OPEN) {
    const txt = queue.shift();
    if (txt) socket.send(txt);
  }
}

function getLogServerUrl() {
  // Allow full URL or just port number in localStorage
  const value = localStorage.getItem("logServerPortOrUrl");
  if (!value) return "ws://localhost:33434";
  // If value looks like a number (port), build URL
  if (/^\d+$/.test(value)) return `ws://localhost:${value}`;
  return value;
}

function connect() {
  const url = getLogServerUrl();
  socket = new WebSocket(url);

  socket.addEventListener("open", () => {
    console.info(`🟢 Connected to log server at ${url}`);
    flushQueue();
  });
  socket.addEventListener("close", () => {
    console.warn("🔌 Log socket disconnected. Reconnecting in 1s...");
    setTimeout(connect, 1000);
  });
  socket.addEventListener("error", (err) => {
    console.error("🚨 Log socket error:", err);
  });
}

connect();

ROARR.write = (message) => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(`${message}`);
  } else {
    queue.push(`${message}`);
  }
};

export const log__ = log_.child((message) => {
  const message_ = {
    ...message,
    context: {
      ...message.context,
    },
  };

  return message_;
});

declare global {
  var log: typeof log__;
}
if (!window.log) window.log = log__;
