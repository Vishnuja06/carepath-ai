import { useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { sql } from '@databricks/appkit-ui/js';
import { toNum } from '../lib/format';
import { type CareGapRow } from '../lib/insights';
import { CareGapPanel } from '../components/CareGapPanel';
import { AskTheData } from '../components/AskTheData';
import sample from '../data/insights-sample.json';

const SAMPLE_ROWS = sample.care_gap as CareGapRow[];

// Coerce a row (DECIMAL/DOUBLE/BIGINT may arrive as strings) to clean numbers.
function clean(r: CareGapRow): CareGapRow {
  return {
    ...r,
    n_facilities: toNum(r.n_facilities),
    total_beds: toNum(r.total_beds),
    total_doctors: toNum(r.total_doctors),
    avg_trust: toNum(r.avg_trust),
    flagged_pct: toNum(r.flagged_pct),
    n_specialties: toNum(r.n_specialties),
    need_index: toNum(r.need_index),
    supply_scarcity: toNum(r.supply_scarcity),
    trust_deficit: toNum(r.trust_deficit),
    care_gap_score: toNum(r.care_gap_score),
  };
}

export function InsightsConsole() {
  const gapQ = useAnalyticsQuery('care_gap', { min_facilities: sql.bigint(1) });

  // Demo-safe: live rows when the warehouse answers, else bundled sample.
  const live = !gapQ.error && gapQ.data && gapQ.data.length > 0;
  const usingSample = !gapQ.loading && !live;
  const rows: CareGapRow[] = (live ? gapQ.data! : SAMPLE_ROWS).map(clean);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Coverage Insights</h2>
        <p className="text-sm text-muted-foreground">
          From per-patient referral to population-level triage — see which districts are most
          underserved, and ask the data why.
        </p>
      </div>

      <CareGapPanel
        rows={rows}
        usingSample={usingSample}
        loading={gapQ.loading}
        error={gapQ.error}
      />

      <AskTheData rows={rows} />
    </div>
  );
}
