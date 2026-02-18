import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/main.ts"],
  define: {
    __DEV__: "false",
  },
});
