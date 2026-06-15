import {
  useAnalyticsQuery,
  useServingInvoke,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Badge,
  Button,
  Skeleton,
  Alert,
  AlertTitle,
  AlertDescription,
  Separator,
  Progress,
} from '@databricks/appkit-ui/react';
import { sql } from '@databricks/appkit-ui/js';
import { MapPin, Phone, Mail, Globe, AlertTriangle, Stethoscope, Sparkles } from 'lucide-react';
import { toNum, fmtScore, fmtNum, fmtPct } from '../lib/format';
import { tierClasses, flagLabel, parseFlags } from '../lib/trust';

type Props = {
  facilityId: string | null;
  district: string | null;
  specialty: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const COMPONENTS = [
  { key: 'corroboration_score', label: 'Corroboration', hint: 'independent sources backing the record' },
  { key: 'completeness_score', label: 'Completeness', hint: 'share of key claim fields populated' },
  { key: 'consistency_score', label: 'Consistency', hint: 'penalties for contradictory claims' },
  { key: 'recency_score', label: 'Recency', hint: 'how recently the record was refreshed' },
] as const;

function extractUrls(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const matches = raw.match(/https?:\/\/[^\s",\]]+/g);
  return matches ? Array.from(new Set(matches)) : [];
}

export function FacilityDetailSheet({ facilityId, district, specialty, open, onOpenChange }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        {open && facilityId ? (
          <DetailBody facilityId={facilityId} district={district} specialty={specialty} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

type FacilityDetailRow = {
  name: string;
  city: string;
  state: string;
  specialties: string;
  n_specialties: number;
  number_doctors: number;
  capacity: number;
  year_established: number;
  n_distinct_sources: number;
  description: string;
  page_update_date: string;
  trust_score: number;
  trust_tier: string;
  trust_flags: string;
};

function DetailBody({
  facilityId,
  district,
  specialty,
}: {
  facilityId: string;
  district: string | null;
  specialty: string | null;
}) {
  const { data, loading, error } = useAnalyticsQuery('facility_detail', {
    facility_id: sql.string(facilityId),
  });

  if (loading) {
    return (
      <div className="space-y-4 mt-6">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mt-6">
        <AlertTitle>Couldn't load facility</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const f = data?.[0];
  if (!f) {
    return (
      <Alert className="mt-6">
        <AlertTitle>No record found</AlertTitle>
        <AlertDescription>This facility is no longer available.</AlertDescription>
      </Alert>
    );
  }

  const flags = parseFlags(f.trust_flags);
  const urls = extractUrls(f.source_urls);
  const addr = [f.address_line1, f.address_line2, f.city, f.state, f.postcode_raw]
    .filter((x) => x && String(x).trim() !== '')
    .join(', ');

  return (
    <>
      <SheetHeader className="px-0">
        <SheetTitle className="text-xl">{f.name}</SheetTitle>
        <SheetDescription>
          {f.organization_type || 'Healthcare facility'}
          {f.year_established ? ` · est. ${f.year_established}` : ''}
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-6 mt-2">
        {/* Trust summary */}
        <section className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Information-trust score</div>
              <div className="text-3xl font-bold">{fmtScore(f.trust_score)}<span className="text-base text-muted-foreground"> / 100</span></div>
            </div>
            <Badge className={tierClasses(f.trust_tier)}>{f.trust_tier} trust</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Reflects how well-corroborated, complete, consistent and fresh this facility's
            self-reported information is — not a measure of clinical quality.
          </p>

          <div className="space-y-3 mt-4">
            {COMPONENTS.map((c) => {
              const raw = toNum((f as Record<string, unknown>)[c.key] as number | string);
              const pct = Number.isFinite(raw) ? (raw / 25) * 100 : 0;
              return (
                <div key={c.key}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{c.label}</span>
                    <span className="text-muted-foreground">{fmtScore(raw)} / 25</span>
                  </div>
                  <Progress value={pct} className="h-2 mt-1" />
                  <div className="text-xs text-muted-foreground mt-0.5">{c.hint}</div>
                </div>
              );
            })}
          </div>

          {flags.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center gap-1.5 text-sm font-medium text-warning-foreground">
                <AlertTriangle className="h-4 w-4" />
                Trust flags
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {flags.map((fl) => (
                  <Badge key={fl} variant="outline">{flagLabel(fl)}</Badge>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Grounded explanation */}
        <WhyRecommended
          specialty={specialty}
          f={{
            name: f.name,
            city: f.city,
            state: f.state,
            specialties: f.specialties,
            n_specialties: f.n_specialties,
            number_doctors: f.number_doctors,
            capacity: f.capacity,
            year_established: f.year_established,
            n_distinct_sources: f.n_distinct_sources,
            description: f.description,
            page_update_date: f.page_update_date,
            trust_score: f.trust_score,
            trust_tier: f.trust_tier,
            trust_flags: f.trust_flags,
          }}
        />

        {/* Capabilities */}
        <section>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
            <Stethoscope className="h-4 w-4" /> Capabilities (self-reported)
          </h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted-foreground">Specialties: </span>{fmtNum(f.n_specialties)}</div>
            <div><span className="text-muted-foreground">Doctors: </span>{fmtNum(f.number_doctors)}</div>
            <div><span className="text-muted-foreground">Capacity (beds): </span>{fmtNum(f.capacity)}</div>
            <div><span className="text-muted-foreground">Sources: </span>{fmtNum(f.n_distinct_sources)}</div>
          </div>
          {f.specialties && (
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{f.specialties}</p>
          )}
        </section>

        {/* Contact + location */}
        <section className="space-y-1.5 text-sm">
          {addr && (
            <div className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" /><span>{addr}</span></div>
          )}
          {f.phone && (
            <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /><span>{f.phone}</span></div>
          )}
          {f.email && (
            <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /><span>{f.email}</span></div>
          )}
          {f.website && (
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <a href={f.website} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4 break-all">{f.website}</a>
            </div>
          )}
        </section>

        <Separator />

        {/* Evidence */}
        <section>
          <h3 className="text-sm font-semibold mb-2">Evidence used</h3>
          {f.description ? (
            <blockquote className="text-sm border-l-2 pl-3 text-muted-foreground leading-relaxed max-h-48 overflow-y-auto">
              {f.description}
            </blockquote>
          ) : (
            <p className="text-sm text-muted-foreground">No description text on record.</p>
          )}
          <div className="text-xs text-muted-foreground mt-2">
            Last updated on record: {f.page_update_date || 'unknown'}
          </div>
          {urls.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="text-xs font-medium">Sources</div>
              {urls.slice(0, 5).map((u) => (
                <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="block text-xs text-primary underline underline-offset-4 break-all">{u}</a>
              ))}
            </div>
          )}
        </section>

        <Separator />

        {/* District health context */}
        <NfhsContext district={district} />
      </div>
    </>
  );
}

const SYSTEM_PROMPT =
  'You help a healthcare referral planner in India understand a facility recommendation. ' +
  'Use ONLY the facts provided in the user message — never invent capabilities, doctors, ' +
  'numbers, or services. Write 3–5 plain sentences. First explain why this facility may suit ' +
  'a patient needing the stated service (cite concrete facts). Then state the trust caveats ' +
  'honestly using the trust score and any flags — if the information is single-source, stale, ' +
  'or internally inconsistent, say so. Do not give medical advice or clinical judgement. ' +
  'Remember: the trust score reflects information quality, not clinical quality.';

function buildPrompt(f: FacilityDetailRow, specialty: string | null, flags: string[]): string {
  const lines = [
    `Patient need: ${specialty || 'general care'}`,
    `Facility: ${f.name} (${[f.city, f.state].filter(Boolean).join(', ')})`,
    `Information-trust score: ${fmtScore(f.trust_score)}/100 (${f.trust_tier} tier)`,
    `Independent sources backing the record: ${fmtNum(f.n_distinct_sources)}`,
    `Self-reported: ${fmtNum(f.n_specialties)} specialties, ${fmtNum(f.number_doctors)} doctors, ${fmtNum(f.capacity)} beds`,
    f.year_established ? `Established: ${f.year_established}` : '',
    `Record last updated: ${f.page_update_date || 'unknown'}`,
    flags.length > 0
      ? `Trust flags: ${flags.map(flagLabel).join('; ')}`
      : 'Trust flags: none',
    f.specialties ? `Specialties listed: ${f.specialties.slice(0, 600)}` : '',
    f.description ? `Description on record: ${f.description.slice(0, 900)}` : '',
  ];
  return lines.filter((l) => l !== '').join('\n');
}

function extractText(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const d = data as Record<string, unknown>;
  const choices = d.choices;
  if (Array.isArray(choices) && choices[0] && typeof choices[0] === 'object') {
    const msg = (choices[0] as Record<string, unknown>).message;
    if (msg && typeof msg === 'object') {
      const content = (msg as Record<string, unknown>).content;
      if (typeof content === 'string') return content;
    }
  }
  if (typeof d.content === 'string') return d.content;
  return '';
}

function WhyRecommended({ f, specialty }: { f: FacilityDetailRow; specialty: string | null }) {
  const flags = parseFlags(f.trust_flags);
  const { invoke, data, loading, error } = useServingInvoke(
    {
      messages: [
        {
          role: 'user',
          content: `${SYSTEM_PROMPT}\n\n---\n${buildPrompt(f, specialty, flags)}`,
        },
      ],
    },
    {},
  );
  const text = extractText(data);

  return (
    <section className="rounded-lg border p-4">
      <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
        <Sparkles className="h-4 w-4" /> Why this recommendation
      </h3>

      {!data && !loading && !error && (
        <>
          <p className="text-xs text-muted-foreground mb-3">
            Generate a plain-language summary grounded only in this facility's record above.
          </p>
          <Button variant="outline" size="sm" onClick={() => invoke()}>
            <Sparkles className="h-4 w-4" /> Explain this recommendation
          </Button>
        </>
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
          <AlertTitle>Couldn't generate summary</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {text && (
        <>
          <p className="text-sm leading-relaxed whitespace-pre-line">{text}</p>
          <p className="text-xs text-muted-foreground mt-2 italic">
            AI-generated from this facility's record — verify before acting. Not medical advice.
          </p>
        </>
      )}
    </section>
  );
}

function NfhsContext({ district }: { district: string | null }) {
  const { data, loading, error } = useAnalyticsQuery('nfhs_context', {
    district: sql.string(district || ''),
  });

  const rows = [
    { key: 'institutional_birth_5y_pct', label: 'Institutional births' },
    { key: 'births_attended_by_skilled_hp_5y_10_pct', label: 'Skilled birth attendance' },
    { key: 'all_w15_49_who_are_anaemic_pct', label: 'Women (15–49) anaemic' },
    { key: 'hh_use_improved_sanitation_pct', label: 'Improved sanitation' },
    { key: 'hh_member_covered_health_insurance_pct', label: 'Has health insurance' },
    { key: 'women_age_15_49_who_are_literate_pct', label: 'Women literate (15–49)' },
  ] as const;

  return (
    <section>
      <h3 className="text-sm font-semibold mb-1">District health context</h3>
      <p className="text-xs text-muted-foreground mb-2">
        NFHS-5 survey indicators for {district || 'this district'} — context for interpreting access and need.
      </p>
      {loading && <Skeleton className="h-24 w-full" />}
      {error && <p className="text-xs text-muted-foreground">Context unavailable.</p>}
      {!loading && !error && (!data || data.length === 0) && (
        <p className="text-xs text-muted-foreground">No NFHS-5 match for this district.</p>
      )}
      {!loading && !error && data && data.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          {rows.map((r) => (
            <div key={r.key} className="flex justify-between">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="font-medium">{fmtPct((data[0] as Record<string, unknown>)[r.key] as number)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
