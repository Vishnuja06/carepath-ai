import { useState } from 'react';
import {
  useServingInvoke,
  GenieChat,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Badge,
  Skeleton,
  Alert,
  AlertTitle,
  AlertDescription,
} from '@databricks/appkit-ui/react';
import { Sparkles, Send, MessageSquare } from 'lucide-react';
import {
  GUIDED_QUESTIONS,
  buildAnalystPrompt,
  extractServingText,
  GENIE_ENABLED,
  GENIE_ALIAS,
  type CareGapRow,
} from '../lib/insights';

export function AskTheData({ rows }: { rows: CareGapRow[] }) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" /> Ask the data
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Natural-language questions about coverage and trust, answered with the data behind them.
        </p>
      </CardHeader>
      <CardContent>
        {GENIE_ENABLED ? (
          <Tabs defaultValue="guided">
            <TabsList>
              <TabsTrigger value="guided">Guided</TabsTrigger>
              <TabsTrigger value="genie">Live Genie</TabsTrigger>
            </TabsList>
            <TabsContent value="guided">
              <GuidedAnalyst rows={rows} />
            </TabsContent>
            <TabsContent value="genie">
              <div className="h-[480px] rounded-lg border overflow-hidden">
                <GenieChat
                  alias={GENIE_ALIAS}
                  placeholder="Ask Genie about facilities, trust, or district need…"
                  className="h-full"
                />
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <GuidedAnalyst rows={rows} />
        )}
      </CardContent>
    </Card>
  );
}

// Demo-safe analyst: grounds a serving-model answer strictly in the on-screen
// care-gap rows. Works with zero extra configuration (uses the existing
// serving() endpoint), so the panel is always live in a demo.
function GuidedAnalyst({ rows }: { rows: CareGapRow[] }) {
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState<string | null>(null);
  const { invoke, data, loading, error } = useServingInvoke({
    messages: [{ role: 'user', content: '' }],
  });

  const ask = (q: string) => {
    const text = q.trim();
    if (!text || loading) return;
    setAsked(text);
    void invoke({ messages: [{ role: 'user', content: buildAnalystPrompt(text, rows) }] });
  };

  const answer = extractServingText(data);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {GUIDED_QUESTIONS.map((q) => (
          <Button
            key={q.id}
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => ask(q.label)}
          >
            {q.label}
          </Button>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
      >
        <Input
          placeholder="Ask your own question about these districts…"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <Button type="submit" disabled={loading || question.trim() === ''}>
          <Send className="h-4 w-4" /> Ask
        </Button>
      </form>

      {asked && (
        <div className="text-sm font-medium flex items-start gap-2">
          <Sparkles className="h-4 w-4 mt-0.5 text-primary flex-none" />
          <span>{asked}</span>
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t answer</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {answer && (
        <>
          <p className="text-sm leading-relaxed whitespace-pre-line">{answer}</p>
          <p className="text-xs text-muted-foreground italic">
            Grounded only in the {rows.length} districts shown above — verify before acting. Not
            medical advice.
          </p>
        </>
      )}

      {!asked && !loading && (
        <p className="text-xs text-muted-foreground">
          Pick a question or type your own. Answers are grounded in the Care Gap table above.
          <Badge variant="outline" className="ml-2">
            {GENIE_ENABLED ? 'guided mode' : 'no Genie space configured'}
          </Badge>
        </p>
      )}
    </div>
  );
}
