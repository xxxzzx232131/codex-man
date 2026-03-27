import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { accountsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/accounts", async (_req: Request, res: Response) => {
  try {
    const accounts = await db
      .select()
      .from(accountsTable)
      .orderBy(desc(accountsTable.createdAt));

    res.json({ accounts, total: accounts.length });
  } catch {
    res.json({ accounts: [], total: 0 });
  }
});

router.get("/accounts/export/csv", async (_req: Request, res: Response) => {
  try {
    const accounts = await db
      .select()
      .from(accountsTable)
      .orderBy(desc(accountsTable.createdAt));

    const csvHeader = "id,email,token,status,createdAt\n";
    const csvRows = accounts
      .map((a) => `${a.id},"${a.email}","${a.token}","${a.status}","${a.createdAt.toISOString()}"`)
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=accounts.csv");
    res.send(csvHeader + csvRows);
  } catch {
    res.status(500).json({ error: "Export failed" });
  }
});

router.get("/accounts/export/json", async (_req: Request, res: Response) => {
  try {
    const accounts = await db
      .select()
      .from(accountsTable)
      .orderBy(desc(accountsTable.createdAt));

    res.setHeader("Content-Disposition", "attachment; filename=accounts.json");
    res.json({ accounts, total: accounts.length });
  } catch {
    res.status(500).json({ error: "Export failed" });
  }
});

router.delete("/accounts/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: "Invalid ID" });
      return;
    }

    await db.delete(accountsTable).where(eq(accountsTable.id, id));
    res.json({ success: true, message: "Account deleted" });
  } catch {
    res.status(500).json({ success: false, message: "Delete failed" });
  }
});

export default router;
