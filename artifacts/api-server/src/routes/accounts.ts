import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { accountsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

/** Convert email to token filename: user@domain.com → token_user_domain.com.json */
function emailToFilename(email: string): string {
  const [local, domain] = email.split("@");
  return `token_${local}_${domain}.json`;
}

router.get("/accounts", async (_req: Request, res: Response) => {
  try {
    const accounts = await db.select().from(accountsTable).orderBy(desc(accountsTable.createdAt));
    res.json({ accounts, total: accounts.length });
  } catch {
    res.json({ accounts: [], total: 0 });
  }
});

/** Download a single account's token file: token_{localpart}_{domain}.json */
router.get("/accounts/:id/token", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, id));
    if (!account) { res.status(404).json({ error: "Account not found" }); return; }

    const filename = emailToFilename(account.email);
    const payload = JSON.stringify({ id_token: account.token }, null, 2);

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(payload);
  } catch {
    res.status(500).json({ error: "Download failed" });
  }
});

/** Export all accounts as CSV */
router.get("/accounts/export/csv", async (_req: Request, res: Response) => {
  try {
    const accounts = await db.select().from(accountsTable).orderBy(desc(accountsTable.createdAt));
    const csvHeader = "email,id_token,status,createdAt\n";
    const csvRows = accounts
      .map((a) => `"${a.email}","${a.token}","${a.status}","${a.createdAt.toISOString()}"`)
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=codex_accounts.csv");
    res.send(csvHeader + csvRows);
  } catch {
    res.status(500).json({ error: "Export failed" });
  }
});

/** Export all accounts: returns array of {filename, id_token} for client-side multi-file download */
router.get("/accounts/export/json", async (_req: Request, res: Response) => {
  try {
    const accounts = await db.select().from(accountsTable).orderBy(desc(accountsTable.createdAt));
    const files = accounts.map((a) => ({
      filename: emailToFilename(a.email),
      email: a.email,
      id_token: a.token,
      status: a.status,
      createdAt: a.createdAt,
    }));
    res.json({ files, total: files.length });
  } catch {
    res.status(500).json({ error: "Export failed" });
  }
});

router.delete("/accounts/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ success: false, message: "Invalid ID" }); return; }
    await db.delete(accountsTable).where(eq(accountsTable.id, id));
    res.json({ success: true, message: "Account deleted" });
  } catch {
    res.status(500).json({ success: false, message: "Delete failed" });
  }
});

export default router;
