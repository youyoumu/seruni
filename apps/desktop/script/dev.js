import path from "node:path";
import concurrently from "concurrently";

const preloadPath = path.resolve(
  path.join(import.meta.dirname, "../../../packages/preload/dist/main.js"),
);

concurrently(
  [
    {
      command: "tsdown --watch src",
      name: "TS",
    },
    {
      command: `nodemon --watch dist/main.js --watch ${preloadPath} --exec pnpm run start`,
      name: "EL",
    },
  ],
  {
    prefixColors: ["bgMagenta.black.bold", "bgBlue.black.bold"],
    killOthersOn: ["success", "failure"],
  },
);
