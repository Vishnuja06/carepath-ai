import { ShieldCheck, AlertTriangle, Info } from 'lucide-react';
import { fmtNum, fmtPct } from '../lib/format';

type Props = {
  nFacilities: number;
  highPct: number;
  flaggedPct: number;
  /** Share of shown districts that have NFHS-5 need data (0..100). */
  needCoveragePct?: number;
  /** True when the panel is showing bundled sample data, not live results. */
  sample?: boolean;
  className?: string;
};

// Honest-uncertainty footer: states how trustworthy the underlying data is,
// mirroring CarePath's core thesis that information quality must be visible.
export function DataConfidence({
  nFacilities,
  highPct,
  flaggedPct,
  needCoveragePct,
  sample,
  className,
}: Props) {
  return (
    <div className={`text-xs text-muted-foreground border-t pt-2 mt-3 ${className ?? ''}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5" />
          Based on {fmtNum(nFacilities)} scored facilities
        </span>
        <span className="inline-flex items-center gap-1">
          {fmtPct(highPct)} high-trust
        </span>
        <span className="inline-flex items-center gap-1 text-warning-foreground">
          <AlertTriangle className="h-3.5 w-3.5" />
          {fmtPct(flaggedPct)} flagged
        </span>
        {needCoveragePct !== undefined && (
          <span className="inline-flex items-center gap-1">
            <Info className="h-3.5 w-3.5" />
            NFHS-5 need data for {fmtPct(needCoveragePct)} of shown districts
          </span>
        )}
      </div>
      <p className="mt-1 italic">
        Trust measures how complete and corroborated facility records are — not clinical quality.
        {sample ? ' Showing illustrative sample data (no warehouse connected).' : ''}
      </p>
    </div>
  );
}
