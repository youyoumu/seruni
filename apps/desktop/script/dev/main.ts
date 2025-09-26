import { createServer, isRunnableDevEnvironment } from "vite";

const viteServer = await createServer();

const electronEnv = viteServer.environments.electron;
if (electronEnv && isRunnableDevEnvironment(electronEnv)) {
  await electronEnv.runner.import("/src/main.ts");
}
