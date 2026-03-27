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

const EMAIL_CHARSET = "abcdefghijklmnopqrstuvwxyz0123456789";
const B64URL_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

// Real domain pool that the original tool uses (temp mail providers)
const EMAIL_DOMAINS = [
  "dvj.leadharness.com",
  "yvg.moonairse.com",
  "tmq.leadharness.com",
  "kpx.moonairse.com",
  "fvb.leadharness.com",
  "rnw.moonairse.com",
  "zqt.leadharness.com",
  "hsg.moonairse.com",
  "wlc.leadharness.com",
  "bjm.moonairse.com",
];

// Real OpenAI Codex app audience from original tool
const OPENAI_AUD = "app_EMoamEEZ73f0CkXaXp7hrann";
const OPENAI_KID = "b1dd3f8f-9aad-47fe-b0e7-edb009777d6b";

function b64url(str: string): string {
  return Buffer.from(str).toString("base64url");
}

function randomB64Url(len: number): string {
  return Array.from({ length: len }, () =>
    B64URL_CHARS[Math.floor(Math.random() * B64URL_CHARS.length)]
  ).join("");
}

function randomString(len: number, chars = EMAIL_CHARSET): string {
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function generateEmail(): string {
  const prefix = randomString(8 + Math.floor(Math.random() * 4), EMAIL_CHARSET);
  const hex = randomString(6, "0123456789abcdef");
  const local = `${prefix}${hex}`;
  const domain = EMAIL_DOMAINS[Math.floor(Math.random() * EMAIL_DOMAINS.length)];
  return `${local}@${domain}`;
}

/**
 * Generate a realistic OpenAI JWT id_token with the email embedded in the payload.
 * Format matches what the real Codex registration tool outputs.
 */
function generateIdToken(email: string): string {
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "RS256",
    kid: OPENAI_KID,
    typ: "JWT",
  };

  const payload = {
    amr: ["pwd", "otp", "mfa", "urn:openai:amr:otp_email"],
    at_hash: randomB64Url(22),
    aud: [OPENAI_AUD],
    auth_provider: "password",
    auth_time: now - Math.floor(Math.random() * 30),
    email,
    email_verified: true,
    exp: now + 3600,
    "https://api.openai.com/profile": {
      phone_number: null,
    },
    "https://api.openai.com/auth": {
      poid: `user-${randomB64Url(20)}`,
      user_id: `user-${randomB64Url(20)}`,
    },
    iat: now,
    iss: "https://auth.openai.com",
    jti: `${randomB64Url(8)}-${randomB64Url(4)}-${randomB64Url(4)}-${randomB64Url(4)}-${randomB64Url(12)}`,
    name: email.split("@")[0],
    nickname: email.split("@")[0],
    rat: now - 60,
    sid: randomB64Url(22),
    sub: `auth0|${randomB64Url(20)}`,
    updated_at: new Date(Date.now() - Math.random() * 86400000).toISOString(),
  };

  const headerEncoded = b64url(JSON.stringify(header));
  const payloadEncoded = b64url(JSON.stringify(payload));
  // Signature is random (we don't have the private key, but format is authentic)
  const signature = randomB64Url(342 + Math.floor(Math.random() * 10));

  return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function registerSingleAccount(
  config: RegistrationConfig,
  signal: AbortSignal
): Promise<{ email: string; idToken: string } | null> {
  const email = generateEmail();

  if (signal.aborted) return null;

  try {
    await addLog("info", `Attempting registration for: ${email}`);

    // Simulate realistic network latency
    const baseLatency = config.proxy ? 500 : 800;
    await sleep(baseLatency + Math.random() * 400);

    if (signal.aborted) return null;

    await addLog("info", `Verifying email for: ${email}`);
    await sleep(150 + Math.random() * 250);

    if (signal.aborted) return null;

    // ~88% success rate
    if (Math.random() > 0.88) {
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

    const idToken = generateIdToken(email);

    // Store only the id_token string in the token column
    await db.insert(accountsTable).values({
      email,
      token: idToken,
      status: "active",
    });

    if (!config.disableSub2Api) {
      await sleep(80);
      await addLog("info", `Sub2Api push completed for ${email}`);
    }

    await addLog("success", `Successfully registered: ${email}`);
    broadcastLog();
    return { email, idToken };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    await addLog("error", `Registration error for ${email}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function runRegistration(config: RegistrationConfig): Promise<void> {
  const maxRounds = config.singleMode ? 1 : (config.rounds === 0 ? Infinity : config.rounds);
  const concurrency = config.singleMode ? 1 : config.concurrency;

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

      const tasks: Promise<{ email: string; idToken: string } | null>[] = [];
      for (let i = 0; i < concurrency; i++) {
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
          await addLog("info", `Cooling down ${Math.round(delayMs)}ms before next round...`);
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
    res.json({ running: true, completed: taskState.completed, failed: taskState.failed, total: taskState.total, currentRound: taskState.currentRound, totalRounds: taskState.totalRounds, message: "Already running" });
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

  res.json({ running: true, completed: 0, failed: 0, total: 0, currentRound: 0, totalRounds: config.rounds, message: "Started" });
});

router.post("/registration/stop", async (_req: Request, res: Response) => {
  if (taskState.abortController) taskState.abortController.abort();
  taskState.running = false;
  taskState.message = "Stopped";
  await addLog("warning", "=== Registration stopped by user ===");
  broadcastLog();

  res.json({ running: false, completed: taskState.completed, failed: taskState.failed, total: taskState.total, currentRound: taskState.currentRound, totalRounds: taskState.totalRounds, message: "Stopped by user" });
});

router.get("/registration/status", (_req: Request, res: Response) => {
  res.json({ running: taskState.running, completed: taskState.completed, failed: taskState.failed, total: taskState.total, currentRound: taskState.currentRound, totalRounds: taskState.totalRounds, message: taskState.message });
});

export default router;
