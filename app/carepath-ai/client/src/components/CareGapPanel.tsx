import {
  useAnalyticsQuery,
  BarChart,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Skeleton,
  Alert,
  AlertTitle,
  AlertDescription,
} from '@databricks/appkit-ui/react';
import { TrendingUp } from 'lucide-react';
import { toNum, fmtScore, fmtNum } from '../lib/format';
import { isTrue, type CareGapRow, type DataConfidenceRow } from '../lib/insights';
import { DataConfidence } from './DataConfidence';
import sample from '../data/insights-sample.json';

const SAMPLE_CONF = sample.data_confidence as DataConfidenceRow;

type Props = {
  rows: CareGapRow[];
  usingSample: boolean;
  loading: boolean;
  error: string | null;
};

export function CareGapPanel({ rows, usingSample, loading, error }: Props) {
  // data_confidence is independent of the gap query; fetch it here.
  const confQ = useAnalyticsQuery('data_confidence', {});
  const conf: DataConfidenceRow =
    !confQ.error && confQ.data && confQ.data.length > 0
      ? (confQ.data[0] as DataConfidenceRow)
      : SAMPLE_CONF;

  const top = rows.slice(0, 12);
  const chartData = top.map((r) => ({
    district: `${r.district} (${r.state})`,
    'Care gap': r.care_gap_score,
  }));
  const needCoveragePct =
    rows.length > 0 ? (rows.filter((r) => isTrue(r.need_known)).length / rows.length) * 100 : 0;

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Care Gap Index — where to prioritize
          </CardTitle>
          {usingSample && <Badge variant="outline">sample data</Badge>}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Districts ranked by a transparent blend of <span className="font-medium">need</span>{' '}
          (NFHS-5 deprivation), <span className="font-medium">supply scarcity</span> (how few
          facilities), and <span className="font-medium">information-trust deficit</span>. Higher =
          more underserved.
        </p>
      </CardHeader>
      <CardContent>
        {loading && <Skeleton className="h-72 w-full" />}

        {!loading && error && (
          <Alert className="mb-3">
            <AlertTitle>Showing sample data</AlertTitle>
            <AlertDescription>
              Couldn&apos;t reach the SQL Warehouse, so this is illustrative sample data. Connect the
              warehouse and run <code>sql/04_care_gap_index.sql</code> for live numbers.
            </AlertDescription>
          </Alert>
        )}

        {!loading && (
          <>
            <BarChart
              data={chartData}
              xKey="district"
              yKey="Care gap"
              orientation="horizontal"
              height={360}
              colorPalette="diverging"
              showLegend={false}
              title="Top 12 districts by Care Gap Score"
              ariaLabel="Bar chart of districts ranked by care gap score"
            />

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-1.5 pr-3 font-medium">District</th>
                    <th className="py-1.5 px-2 font-medium text-right">Gap</th>
                    <th className="py-1.5 px-2 font-medium text-right">Need</th>
                    <th className="py-1.5 px-2 font-medium text-right">Facilities</th>
                    <th className="py-1.5 px-2 font-medium text-right">Avg trust</th>
                    <th className="py-1.5 pl-2 font-medium text-right">Flagged</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((r) => (
                    <tr key={`${r.district}-${r.state}`} className="border-b last:border-0">
                      <td className="py-1.5 pr-3">
                        <span className="font-medium">{r.district}</span>
                        <span className="text-muted-foreground"> · {r.state}</span>
                        {!isTrue(r.need_known) && (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            no NFHS
                          </Badge>
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-right font-semibold">
                        {fmtScore(r.care_gap_score)}
                      </td>
                      <td className="py-1.5 px-2 text-right">
                        {isTrue(r.need_known) ? fmtScore(r.need_index) : '—'}
                      </td>
                      <td className="py-1.5 px-2 text-right">{fmtNum(r.n_facilities)}</td>
                      <td className="py-1.5 px-2 text-right">{fmtScore(r.avg_trust)}</td>
                      <td className="py-1.5 pl-2 text-right">{fmtScore(r.flagged_pct)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <DataConfidence
              nFacilities={toNum(conf.n_facilities)}
              highPct={toNum(conf.high_pct)}
              flaggedPct={toNum(conf.flagged_pct)}
              needCoveragePct={needCoveragePct}
              sample={usingSample}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
