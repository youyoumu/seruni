import { WebSocketServer } from "ws";
import "dotenv/config";

const enabled = process.env.ENABLE_TEXT_HOOKER_EMULATOR;

const japaneseTexts = [
  "こんにちは、私たちと一緒に歩きませんか？",
  "今日の天気は本当に素晴らしいですね。",
  "この世界には、まだ知られていない多くの謎があります。",
  "君のことが、ずっと好きだったんだ。",
  "一緒に帰ろうか？もう遅いから。",
  "何があったの？大丈夫？",
  "あの時は、本当に助かりました。",
  "いつか、この国を離れてみたいと思っていたんだ。",
  "本当に、君だったのかい？",
  "待っててください、必ず帰ってきます。",
];

const wss = new WebSocketServer({ port: 6677 });

wss.on("connection", (ws) => {
  console.log("Client connected");

  const interval = setInterval(() => {
    if (!enabled) return;
    const randomText = japaneseTexts[Math.floor(Math.random() * japaneseTexts.length)];
    ws.send(randomText);
  }, 3000);

  ws.on("close", () => {
    clearInterval(interval);
    console.log("Client disconnected");
  });
});

console.log("WebSocket server running on ws://localhost:6677");
