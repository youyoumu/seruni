import { app } from "electron";
import { createServer, isRunnableDevEnvironment } from "vite";
import pkg from "../package.json" with { type: "json" };

app.setName(pkg.productName ?? pkg.name);
// @ts-expect-error undocumented api
app.setVersion(pkg.version);

const viteServer = await createServer();

const electronEnv = viteServer.environments.electron;
if (electronEnv && isRunnableDevEnvironment(electronEnv)) {
  await electronEnv.runner.import("/src/main.ts");
}
