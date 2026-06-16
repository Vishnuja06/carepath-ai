// Shared types + helpers for the AI/BI Insights console.

export type CareGapRow = {
  district: string;
  state: string;
  n_facilities: number;
  total_beds: number;
  total_doctors: number;
  avg_trust: number;
  flagged_pct: number;
  n_specialties: number;
  need_index: number;
  need_known: boolean | string;
  supply_scarcity: number;
  trust_deficit: number;
  care_gap_score: number;
};

export type DataConfidenceRow = {
  n_facilities: number;
  high_pct: number;
  flagged_pct: number;
  avg_trust: number;
};

// SQL BOOLEAN can arrive as a real boolean or the string "true"/"false".
export const isTrue = (v: boolean | string | null | undefined): boolean =>
  v === true || v === 'true' || v === 't' || v === '1';

// Curated questions for the demo-safe "Guided" analyst mode (used when a live
// Genie space isn't wired). Each is answerable purely from the care-gap rows
// already on screen, so answers stay grounded.
export const GUIDED_QUESTIONS: { id: string; label: string }[] = [
  { id: 'top-gap', label: 'Which districts have the largest care gap, and why?' },
  { id: 'trust-vs-need', label: 'Where is high need paired with low information-trust?' },
  { id: 'thin-supply', label: 'Which high-need districts have the fewest facilities?' },
  { id: 'where-to-send', label: 'If I could fund one district this quarter, which and why?' },
];

// Compact, grounded context handed to the serving LLM in Guided mode. We send
// only the on-screen rows and instruct the model to use nothing else.
export function buildAnalystPrompt(question: string, rows: CareGapRow[]): string {
  const compact = rows.slice(0, 15).map((r) => ({
    district: r.district,
    state: r.state,
    care_gap_score: r.care_gap_score,
    need_index: r.need_index,
    need_known: isTrue(r.need_known),
    supply_scarcity: r.supply_scarcity,
    trust_deficit: r.trust_deficit,
    n_facilities: r.n_facilities,
    avg_trust: r.avg_trust,
    flagged_pct: r.flagged_pct,
  }));
  return [
    'You are a careful health-systems data analyst for CarePath AI in India.',
    'Answer the question using ONLY the JSON rows below — never invent districts,',
    'numbers, or facts not present. care_gap_score (0-100) blends need (NFHS-5),',
    'supply scarcity, and an information-TRUST deficit; trust reflects how complete',
    'and corroborated facility records are, NOT clinical quality. Where need_known is',
    'false, NFHS need data is missing for that district — say so rather than guessing.',
    'Reply in 3-5 plain sentences, cite specific districts and their scores, and end',
    'with one honest caveat about the data. Do not give medical advice.',
    '',
    `Question: ${question}`,
    '',
    `Rows: ${JSON.stringify(compact)}`,
  ].join('\n');
}

// Pull assistant text out of a chat-completions style serving response.
export function extractServingText(data: unknown): string {
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

// Live Genie tab is shown only when the team opts in via VITE_GENIE_ENABLED.
// Keeps the app demo-safe by default: no env => Guided mode only.
export const GENIE_ENABLED: boolean =
  String(import.meta.env.VITE_GENIE_ENABLED ?? '').toLowerCase() === 'true';

export const GENIE_ALIAS = 'insights';
