import { useState } from "react";
import { format } from "date-fns";
import { useGetAccounts, useDeleteAccount, exportAccountsCsv, exportAccountsJson } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, FileJson, FileText, RefreshCw, Trash2, Shield, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export function AccountsTable() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showTokens, setShowTokens] = useState<Record<number, boolean>>({});

  const { data, isLoading, refetch } = useGetAccounts();
  const accounts = data?.accounts || [];

  const deleteMutation = useDeleteAccount({
    mutation: {
      onSuccess: () => {
        toast({ title: "Account deleted", variant: "default" });
        queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      },
      onError: () => {
        toast({ title: "Failed to delete", variant: "destructive" });
      }
    }
  });

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this account?")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleExportCSV = async () => {
    try {
      const csvData = await exportAccountsCsv();
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `codex_accounts_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  const handleExportJSON = async () => {
    try {
      const jsonData = await exportAccountsJson();
      const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `codex_accounts_${format(new Date(), 'yyyyMMdd_HHmmss')}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  const toggleToken = (id: number) => {
    setShowTokens(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <Card className="border-border/50 shadow-lg bg-card/50 backdrop-blur-sm h-[800px] flex flex-col">
      <CardHeader className="pb-4 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Shield className="h-5 w-5 text-primary" />
              Registered Accounts
            </CardTitle>
            <CardDescription>Manage and export successfully registered accounts</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} className="hover:text-primary transition-colors">
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="secondary" size="sm" onClick={handleExportCSV}>
              <FileText className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={handleExportJSON}>
              <FileJson className="h-4 w-4 mr-2" />
              JSON
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <div className="h-full overflow-auto terminal-scrollbar px-6 pb-6">
          <Table>
            <TableHeader className="bg-background/80 sticky top-0 backdrop-blur-sm z-10">
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="w-[80px]">ID</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-[300px]">Token</TableHead>
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
                      <p className="text-lg font-medium">No accounts found</p>
                      <p className="text-sm">Start the registration engine to populate.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((acc) => (
                  <TableRow key={acc.id} className="border-border/50 group">
                    <TableCell className="font-mono text-muted-foreground">{acc.id}</TableCell>
                    <TableCell className="font-medium">{acc.email}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="bg-background/50 px-2 py-1 rounded text-xs font-mono text-muted-foreground truncate w-48 block">
                          {showTokens[acc.id] ? acc.token : `${acc.token.substring(0, 8)}••••••••••••••••`}
                        </code>
                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => toggleToken(acc.id)}>
                          {showTokens[acc.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        acc.status === 'active' ? 'border-primary/50 text-primary bg-primary/10' : 
                        acc.status === 'failed' ? 'border-destructive/50 text-destructive bg-destructive/10' : 
                        'text-muted-foreground'
                      }>
                        {acc.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(acc.createdAt), 'MMM dd, HH:mm:ss')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(acc.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
