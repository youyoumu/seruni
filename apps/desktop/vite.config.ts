import { resolve } from "node:path";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [],
  resolve: {
    alias: {
      "#": resolve(__dirname, "./src"),
    },
  },
  appType: "custom",
  environments: {
    electron: {
      resolve: {
        builtins: ["electron", /^node:.*/],
      },
      build: {
        lib: {
          entry: "src/main.ts",
          formats: ["es"], // output ESM for your target
        },
      },
      //TODO: this already the default, try createFetchableDevEnvironment later
      // dev: {
      //   createEnvironment(name, config) {
      //     return createRunnableDevEnvironment(name, config);
      //   },
      // },
    },
  },
  builder: {
    async buildApp(builder) {
      if (builder.environments.electron)
        await builder.build(builder.environments.electron);
    },
  },
});
