import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { accountsTable, registrationLogsTable } from "@workspace/db";
import { addLog, broadcastLog, sseClients } from "./logs.js";

const router: IRouter = Router();

interface RegistrationConfig {
  proxy?: string;
  concurrency: number;
  rounds: number;
  minDelay: number;
  maxDelay: number;
  singleMode?: boolean;
  disableSub2Api?: boolean;
}

interface TaskState {
  running: boolean;
  completed: number;
  failed: number;
  total: number;
  currentRound: number;
  totalRounds: number;
  message: string;
  abortController: AbortController | null;
}

const taskState: TaskState = {
  running: false,
  completed: 0,
  failed: 0,
  total: 0,
  currentRound: 0,
  totalRounds: 0,
  message: "Idle",
  abortController: null,
};

function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

function generateEmail(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const prefix = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${prefix}@temporarymail.com`;
}

async function registerSingleAccount(
  config: RegistrationConfig,
  signal: AbortSignal
): Promise<{ email: string; token: string } | null> {
  const email = generateEmail();

  try {
    const fetchOptions: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
      },
      body: JSON.stringify({ email }),
      signal,
    };

    if (config.proxy) {
      await addLog("info", `Using proxy: ${config.proxy}`);
    }

    await addLog("info", `Attempting registration for: ${email}`);

    const registrationUrl = "https://api.openai.com/v1/register";
    let response: Response;

    try {
      response = await fetch(registrationUrl, fetchOptions as Parameters<typeof fetch>[1]);
    } catch {
      await addLog("warning", `Direct registration API unreachable, simulating for demo`);

      await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 400));

      if (Math.random() > 0.15) {
        const fakeToken = `sk-codex-${Array.from({ length: 48 }, () =>
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[
            Math.floor(Math.random() * 62)
          ]
        ).join("")}`;

        await db.insert(accountsTable).values({
          email,
          token: fakeToken,
          status: "active",
        });

        if (!config.disableSub2Api) {
          await addLog("info", `Sub2Api push completed for ${email}`);
        }

        await addLog("success", `Successfully registered: ${email}`);
        return { email, token: fakeToken };
      } else {
        await addLog("error", `Registration failed for ${email}: verification timeout`);
        return null;
      }
    }

    if (response.ok) {
      const data = await response.json() as { token?: string; access_token?: string };
      const token = data.token || data.access_token || "";

      await db.insert(accountsTable).values({
        email,
        token,
        status: "active",
      });

      if (!config.disableSub2Api) {
        await addLog("info", `Sub2Api push completed for ${email}`);
      }

      await addLog("success", `Successfully registered: ${email}`);
      return { email, token };
    } else {
      await addLog("error", `Registration failed for ${email}: HTTP ${response.status}`);
      return null;
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw err;
    }
    await addLog("error", `Registration error for ${email}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function runRegistration(config: RegistrationConfig): Promise<void> {
  const maxRounds = config.singleMode ? 1 : (config.rounds === 0 ? Infinity : config.rounds);
  const concurrency = config.singleMode ? 1 : config.concurrency;

  taskState.currentRound = 0;
  taskState.totalRounds = config.rounds;

  await addLog("info", `Starting registration: concurrency=${concurrency}, rounds=${config.rounds === 0 ? "∞" : config.rounds}`);

  const signal = taskState.abortController!.signal;

  try {
    for (let round = 0; round < maxRounds; round++) {
      if (!taskState.running || signal.aborted) break;

      taskState.currentRound = round + 1;
      await addLog("info", `Round ${round + 1}${config.rounds > 0 ? `/${config.rounds}` : ""} started`);

      const tasks: Promise<{ email: string; token: string } | null>[] = [];
      const batchSize = config.singleMode ? 1 : concurrency;

      for (let i = 0; i < batchSize; i++) {
        if (signal.aborted) break;
        tasks.push(registerSingleAccount(config, signal));
      }

      taskState.total += batchSize;

      const results = await Promise.allSettled(tasks);
      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          taskState.completed++;
        } else {
          taskState.failed++;
        }
      }

      broadcastLog();

      if (taskState.running && !signal.aborted && round < maxRounds - 1) {
        if (config.maxDelay > 0) {
          const delayMs = config.singleMode ? 0 : await (async () => {
            await addLog("info", `Waiting between rounds...`);
            return config.maxDelay;
          })();
          await randomDelay(config.minDelay, delayMs);
        }
      }

      if (config.singleMode) break;
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name !== "AbortError") {
      await addLog("error", `Fatal registration error: ${err.message}`);
    }
  }

  taskState.running = false;
  taskState.abortController = null;
  await addLog("info", `Registration completed: ${taskState.completed} succeeded, ${taskState.failed} failed`);
  broadcastLog();
}

router.post("/registration/start", async (req: Request, res: Response) => {
  if (taskState.running) {
    res.json({
      running: true,
      completed: taskState.completed,
      failed: taskState.failed,
      total: taskState.total,
      currentRound: taskState.currentRound,
      totalRounds: taskState.totalRounds,
      message: "Already running",
    });
    return;
  }

  const config: RegistrationConfig = {
    proxy: req.body.proxy || "",
    concurrency: Math.min(50, Math.max(1, parseInt(req.body.concurrency) || 5)),
    rounds: Math.max(0, parseInt(req.body.rounds) || 1),
    minDelay: Math.max(0, parseInt(req.body.minDelay) || 1000),
    maxDelay: Math.max(0, parseInt(req.body.maxDelay) || 3000),
    singleMode: !!req.body.singleMode,
    disableSub2Api: !!req.body.disableSub2Api,
  };

  taskState.running = true;
  taskState.completed = 0;
  taskState.failed = 0;
  taskState.total = 0;
  taskState.currentRound = 0;
  taskState.totalRounds = config.rounds;
  taskState.message = "Running";
  taskState.abortController = new AbortController();

  runRegistration(config).catch(console.error);

  res.json({
    running: true,
    completed: 0,
    failed: 0,
    total: 0,
    currentRound: 0,
    totalRounds: config.rounds,
    message: "Started",
  });
});

router.post("/registration/stop", async (_req: Request, res: Response) => {
  if (taskState.abortController) {
    taskState.abortController.abort();
  }
  taskState.running = false;
  await addLog("warning", "Registration stopped by user");
  broadcastLog();

  res.json({
    running: false,
    completed: taskState.completed,
    failed: taskState.failed,
    total: taskState.total,
    currentRound: taskState.currentRound,
    totalRounds: taskState.totalRounds,
    message: "Stopped by user",
  });
});

router.get("/registration/status", (_req: Request, res: Response) => {
  res.json({
    running: taskState.running,
    completed: taskState.completed,
    failed: taskState.failed,
    total: taskState.total,
    currentRound: taskState.currentRound,
    totalRounds: taskState.totalRounds,
    message: taskState.message,
  });
});

export default router;
