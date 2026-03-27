import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfigPanel } from "@/components/config-panel";
import { AccountsTable } from "@/components/accounts-table";
import { LogsTerminal } from "@/components/logs-terminal";
import { Settings, Database, TerminalSquare } from "lucide-react";
import { motion } from "framer-motion";

export function Dashboard() {
  return (
    <div className="space-y-6 w-full pb-20">
      
      <Tabs defaultValue="control" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3 bg-card/50 backdrop-blur-sm border border-border/50 h-12">
          <TabsTrigger value="control" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-all rounded-md">
            <Settings className="h-4 w-4 mr-2" />
            Control
          </TabsTrigger>
          <TabsTrigger value="accounts" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-all rounded-md">
            <Database className="h-4 w-4 mr-2" />
            Accounts
          </TabsTrigger>
          <TabsTrigger value="logs" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-all rounded-md">
            <TerminalSquare className="h-4 w-4 mr-2" />
            Logs
          </TabsTrigger>
        </TabsList>

        <div className="mt-8">
          <TabsContent value="control" className="m-0 focus-visible:outline-none">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <ConfigPanel />
            </motion.div>
          </TabsContent>
          
          <TabsContent value="accounts" className="m-0 focus-visible:outline-none">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <AccountsTable />
            </motion.div>
          </TabsContent>
          
          <TabsContent value="logs" className="m-0 focus-visible:outline-none">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <LogsTerminal />
            </motion.div>
          </TabsContent>
        </div>
      </Tabs>

    </div>
  );
}
