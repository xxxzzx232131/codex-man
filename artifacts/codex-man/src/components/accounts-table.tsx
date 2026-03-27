import { useState } from "react";
import { format, isValid } from "date-fns";
import { useGetAccounts, useDeleteAccount } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, FileText, RefreshCw, Trash2, Shield, Eye, EyeOff, PackageOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

function safeFormat(ts: string | Date, fmt: string): string {
  const d = new Date(ts);
  return isValid(d) ? format(d, fmt) : "—";
}

function emailToFilename(email: string): string {
  const [local, domain] = email.split("@");
  return `token_${local}_${domain}.json`;
}

function triggerDownload(filename: string, content: string, mime = "application/json") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function AccountsTable() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showTokens, setShowTokens] = useState<Record<number, boolean>>({});
  const [downloading, setDownloading] = useState<Record<number, boolean>>({});

  const { data, isLoading, refetch } = useGetAccounts();
  const accounts = data?.accounts || [];

  const deleteMutation = useDeleteAccount({
    mutation: {
      onSuccess: () => {
        toast({ title: "Account deleted" });
        queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      },
      onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
    },
  });

  /** Download a single account as token_email@domain.json */
  const handleDownloadOne = async (id: number, email: string) => {
    setDownloading((p) => ({ ...p, [id]: true }));
    try {
      const res = await fetch(`/api/accounts/${id}/token`);
      if (!res.ok) throw new Error("Download failed");
      const text = await res.text();
      triggerDownload(emailToFilename(email), text);
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    } finally {
      setDownloading((p) => ({ ...p, [id]: false }));
    }
  };

  /** Download all accounts — one separate file per account, staggered */
  const handleExportAllJson = async () => {
    try {
      const res = await fetch("/api/accounts/export/json");
      if (!res.ok) throw new Error("Export failed");
      const data = await res.json() as {
        files: { filename: string; id_token: string }[];
        total: number;
      };

      if (data.files.length === 0) {
        toast({ title: "No accounts to export", variant: "destructive" });
        return;
      }

      // Trigger one download per account with a small delay to avoid browser blocking
      for (let i = 0; i < data.files.length; i++) {
        const file = data.files[i];
        await new Promise<void>((resolve) => {
          setTimeout(() => {
            triggerDownload(file.filename, JSON.stringify({ id_token: file.id_token }, null, 2));
            resolve();
          }, i * 200);
        });
      }

      toast({ title: `Downloaded ${data.files.length} token files` });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  /** Export as CSV */
  const handleExportCSV = async () => {
    try {
      const res = await fetch("/api/accounts/export/csv");
      if (!res.ok) throw new Error();
      const text = await res.text();
      triggerDownload("codex_accounts.csv", text, "text/csv");
    } catch {
      toast({ title: "CSV export failed", variant: "destructive" });
    }
  };

  const toggleToken = (id: number) =>
    setShowTokens((p) => ({ ...p, [id]: !p[id] }));

  return (
    <Card className="border-border/50 shadow-lg bg-card/50 backdrop-blur-sm h-[800px] flex flex-col">
      <CardHeader className="pb-4 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Shield className="h-5 w-5 text-primary" />
              Registered Accounts
            </CardTitle>
            <CardDescription>
              {accounts.length} account{accounts.length !== 1 ? "s" : ""} — each exports as its own{" "}
              <code className="text-xs">token_email_domain.json</code>
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="secondary" size="sm" onClick={handleExportCSV}>
              <FileText className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={handleExportAllJson}>
              <PackageOpen className="h-4 w-4 mr-2" />
              Export All JSON
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <div className="h-full overflow-auto terminal-scrollbar px-6 pb-6">
          <Table>
            <TableHeader className="bg-background/80 sticky top-0 backdrop-blur-sm z-10">
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="w-[60px]">ID</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-[220px]">id_token</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Shield className="h-12 w-12 mb-4 opacity-20" />
                      <p className="text-lg font-medium">No accounts yet</p>
                      <p className="text-sm">Start the registration engine to populate.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((acc) => (
                  <TableRow key={acc.id} className="border-border/50 group">
                    <TableCell className="font-mono text-muted-foreground text-xs">{acc.id}</TableCell>
                    <TableCell className="font-medium text-sm">{acc.email}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <code className="bg-background/50 px-2 py-1 rounded text-xs font-mono text-muted-foreground truncate w-40 block">
                          {showTokens[acc.id]
                            ? acc.token.substring(0, 40) + "…"
                            : "eyJ••••••••••••••••••"}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => toggleToken(acc.id)}
                        >
                          {showTokens[acc.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          acc.status === "active"
                            ? "border-primary/50 text-primary bg-primary/10"
                            : acc.status === "failed"
                            ? "border-destructive/50 text-destructive bg-destructive/10"
                            : "text-muted-foreground"
                        }
                      >
                        {acc.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {safeFormat(acc.createdAt, "MM/dd HH:mm:ss")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Download individual token file */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                          onClick={() => handleDownloadOne(acc.id, acc.email)}
                          disabled={downloading[acc.id]}
                          title={emailToFilename(acc.email)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {/* Delete */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm("Delete this account?")) deleteMutation.mutate({ id: acc.id });
                          }}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
