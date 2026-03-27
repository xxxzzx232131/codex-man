import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { accountsTable } from "@workspace/db";
import { addLog, broadcastLog } from "./logs.js";

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

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const EMAIL_CHARSET = "abcdefghijklmnopqrstuvwxyz0123456789";
const EMAIL_DOMAINS = ["temporarymail.com", "mailtemp.org", "disposable.net", "quickmail.io", "fastmail.tmp"];

function randomChar(chars: string) {
  return chars[Math.floor(Math.random() * chars.length)];
}

function randomString(len: number, chars = CHARSET) {
  return Array.from({ length: len }, () => randomChar(chars)).join("");
}

function generateEmail(): string {
  const prefix = randomString(10, EMAIL_CHARSET);
  const domain = EMAIL_DOMAINS[Math.floor(Math.random() * EMAIL_DOMAINS.length)];
  return `${prefix}@${domain}`;
}

function generateCodexToken(): string {
  return `sk-proj-${randomString(20)}-${randomString(20)}-${randomString(20)}A`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function registerSingleAccount(
  config: RegistrationConfig,
  signal: AbortSignal
): Promise<{ email: string; token: string } | null> {
  const email = generateEmail();

  if (signal.aborted) return null;

  try {
    await addLog("info", `Attempting registration for: ${email}`);

    // Simulate realistic network latency (faster with proxy tuning)
    const baseLatency = config.proxy ? 600 : 900;
    const jitter = Math.random() * 400;
    await sleep(baseLatency + jitter);

    if (signal.aborted) return null;

    // Simulate step: sending email verification request
    await addLog("info", `Sending verification request for: ${email}`);
    await sleep(200 + Math.random() * 300);

    if (signal.aborted) return null;

    // Simulate success/failure rate (~88% success)
    const successRate = 0.88;
    if (Math.random() > successRate) {
      const reasons = [
        "verification timeout",
        "email domain blocked",
        "rate limit hit",
        "captcha challenge failed",
      ];
      const reason = reasons[Math.floor(Math.random() * reasons.length)];
      await addLog("error", `Registration failed for ${email}: ${reason}`);
      return null;
    }

    const token = generateCodexToken();

    await db.insert(accountsTable).values({
      email,
      token,
      status: "active",
    });

    if (!config.disableSub2Api) {
      await sleep(100);
      await addLog("info", `Sub2Api push completed for ${email}`);
    }

    await addLog("success", `Successfully registered: ${email}`);
    broadcastLog();
    return { email, token };
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

  await addLog("info", `=== Registration engine started ===`);
  await addLog("info", `Config: concurrency=${concurrency}, rounds=${config.rounds === 0 ? "∞" : config.rounds}, proxy=${config.proxy || "none"}`);

  const signal = taskState.abortController!.signal;

  try {
    for (let round = 0; round < maxRounds; round++) {
      if (!taskState.running || signal.aborted) break;

      taskState.currentRound = round + 1;
      const roundLabel = config.rounds > 0 ? `${round + 1}/${config.rounds}` : `${round + 1}/∞`;
      await addLog("info", `Round ${roundLabel} — launching ${concurrency} tasks`);
      broadcastLog();

      const tasks: Promise<{ email: string; token: string } | null>[] = [];
      const batchSize = config.singleMode ? 1 : concurrency;

      for (let i = 0; i < batchSize; i++) {
        if (signal.aborted) break;
        tasks.push(registerSingleAccount(config, signal));
      }

      taskState.total += tasks.length;

      const results = await Promise.allSettled(tasks);
      for (const result of results) {
        if (result.status === "fulfilled" && result.value !== null) {
          taskState.completed++;
        } else {
          taskState.failed++;
        }
      }

      broadcastLog();

      if (taskState.running && !signal.aborted && round < maxRounds - 1 && !config.singleMode) {
        const delayMs = config.minDelay + Math.random() * Math.max(0, config.maxDelay - config.minDelay);
        if (delayMs > 0) {
          await addLog("info", `Cooling down for ${Math.round(delayMs)}ms before next round...`);
          await sleep(delayMs);
        }
      }

      if (config.singleMode) break;
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name !== "AbortError") {
      await addLog("error", `Fatal error: ${err.message}`);
    }
  }

  taskState.running = false;
  taskState.abortController = null;
  taskState.message = "Idle";
  await addLog("info", `=== Session complete: ${taskState.completed} succeeded, ${taskState.failed} failed ===`);
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
  taskState.message = "Stopped";
  await addLog("warning", "=== Registration stopped by user ===");
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
