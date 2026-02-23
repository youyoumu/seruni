import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/main.ts"],
  define: {
    __DEV__: "false",
  },
  copy: [
    "./drizzle/",
    {
      from: "../webui/dist",
      to: "./dist",
      rename: "webui",
    },
  ],
});
