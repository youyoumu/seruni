import { net } from "electron";
import { env } from "#/env";
import { AppWindow } from "./_util";

class MainWindow extends AppWindow {
  constructor() {
    super({
      width: 1280,
      height: 1000,
      show: false,
    });
  }

  override async create() {
    super.create();

    await this.waitForRenderer(env.RENDERER_URL);
    console.log("DEBUG[504]: env.RENDERER_URL=", env.RENDERER_URL);
    await this.win?.loadURL(env.RENDERER_URL);
    this.win?.show();
  }

  private async waitForRenderer(url: string, retries = 30, delay = 500) {
    for (let i = 0; i < retries; i++) {
      try {
        await this.ping(url);
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw new Error(`Renderer at ${url} not responding after ${retries} tries`);
  }

  private ping(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = net.request({ url, method: "HEAD" });
      request.on("response", (res) => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
          resolve();
        } else {
          reject(new Error(`Bad status: ${res.statusCode}`));
        }
      });
      request.on("error", reject);
      request.end();
    });
  }
}

export const mainWindow = new MainWindow();
