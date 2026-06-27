import { createEchoApp } from "../server";

const appPromise = createEchoApp({ assetsMode: "api" });

export default async function handler(req: any, res: any) {
  const app = await appPromise;
  return app(req, res);
}
