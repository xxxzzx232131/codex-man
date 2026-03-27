import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { registrationLogsTable } from "@workspace/db";
import { desc } from "drizzle-orm";

const router: IRouter = Router();

export const sseClients: Set<Response> = new Set();

export async function addLog(level: string, message: string): Promise<void> {
  try {
    await db.insert(registrationLogsTable).values({ level, message });
  } catch {
  }
}

export function broadcastLog(): void {
  for (const client of sseClients) {
    client.write(`data: ${JSON.stringify({ type: "update" })}\n\n`);
  }
}

router.get("/logs", async (_req: Request, res: Response) => {
  try {
    const logs = await db
      .select()
      .from(registrationLogsTable)
      .orderBy(desc(registrationLogsTable.timestamp))
      .limit(500);

    res.json({ logs: logs.reverse() });
  } catch {
    res.json({ logs: [] });
  }
});

router.get("/logs/stream", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

  sseClients.add(res);

  req.on("close", () => {
    sseClients.delete(res);
  });
});

export default router;
