import { useState } from 'react';
import {
  useAgentChat,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Textarea,
  Badge,
  Alert,
  AlertTitle,
  AlertDescription,
  Spinner,
} from '@databricks/appkit-ui/react';
import { Sparkles, Send, Wrench } from 'lucide-react';

// The referral copilot (Agent Bricks). Streams from the `referral` agent,
// which maps a free-text need -> specialty, calls the recommend_by_pincode SQL
// function as a tool, and returns grounded, cited options. Agent id matches the
// config/agents/referral/ folder.
const EXAMPLES = [
  'A patient needs a cardiologist near pincode 110002, within 50 km. Give me the top 3 options.',
  'Pediatric care near 400001 within 30 km — which facilities, and how trustworthy is the data?',
  'Where can someone get orthopedic surgery near 560001? Prioritise well-corroborated records.',
];

export function AgentCopilot() {
  const [draft, setDraft] = useState('');
  const [tools, setTools] = useState<string[]>([]);

  const { content, isStreaming, error, send, reset } = useAgentChat({
    agent: 'referral',
    onEvent(ev) {
      // Surface tool calls so it's visible the agent actually queried the data.
      if (ev.type === 'response.output_item.added' && ev.item?.type === 'function_call' && ev.item.name) {
        const name = ev.item.name;
        setTools((t) => (t.includes(name) ? t : [...t, name]));
      }
    },
  });

  const submit = (text: string) => {
    const msg = text.trim();
    if (!msg || isStreaming) return;
    setTools([]);
    void send(msg);
  };

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> Referral copilot
          <Badge variant="outline" className="font-normal">AI agent</Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Describe the patient need in plain language (include a 6-digit pincode and a travel
          radius). The agent picks the specialty, queries the facility data itself, and explains
          the top options with honest trust caveats.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. A patient needs a cardiologist near pincode 110002, within 50 km."
            rows={3}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(draft);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => submit(draft)} disabled={isStreaming || draft.trim() === ''}>
              {isStreaming ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              {isStreaming ? 'Thinking…' : 'Ask the copilot'}
            </Button>
            {(content || error) && !isStreaming && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  reset();
                  setTools([]);
                }}
              >
                Clear
              </Button>
            )}
            <span className="text-xs text-muted-foreground">⌘/Ctrl + Enter to send</span>
          </div>
        </div>

        {!content && !isStreaming && !error && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Try an example</div>
            <div className="flex flex-col gap-1.5">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  className="text-left text-sm text-primary hover:underline underline-offset-4"
                  onClick={() => {
                    setDraft(ex);
                    submit(ex);
                  }}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {tools.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Tools used:</span>
            {tools.map((t) => (
              <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
            ))}
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Copilot error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {(content || isStreaming) && (
          <div className="rounded-lg border p-4">
            {content ? (
              <p className="text-sm leading-relaxed whitespace-pre-line">{content}</p>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner className="h-4 w-4" /> Querying facilities and composing a grounded answer…
              </div>
            )}
            {content && !isStreaming && (
              <p className="text-xs text-muted-foreground mt-3 italic">
                AI-generated from the facility records — verify before acting. Not medical advice.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
