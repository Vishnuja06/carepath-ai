import { Activity } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@databricks/appkit-ui/react';
import { ReferralWorkspace } from './pages/ReferralWorkspace';
import { InsightsConsole } from './pages/InsightsConsole';

export default function App() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b px-4 md:px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Activity className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-semibold text-foreground leading-tight">CarePath AI</h1>
            <p className="text-xs text-muted-foreground leading-tight">
              Referral Copilot &amp; Facility Trust Desk — where should a patient go, and can we
              trust why?
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6">
        <Tabs defaultValue="referrals" className="max-w-6xl mx-auto">
          <TabsList className="mb-6">
            <TabsTrigger value="referrals">Referrals</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>
          <TabsContent value="referrals">
            <ReferralWorkspace />
          </TabsContent>
          <TabsContent value="insights">
            <InsightsConsole />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
