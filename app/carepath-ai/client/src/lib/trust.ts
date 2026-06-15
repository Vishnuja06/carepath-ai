// Trust-tier presentation + flag labels. Color encodes meaning via semantic
// tokens only (success / warning / destructive) — never raw hex/Tailwind colors.

export type TrustTier = 'High' | 'Medium' | 'Low' | string;

// Tailwind classes backed by AppKit semantic tokens (see index.css / styles.css).
export function tierClasses(tier: TrustTier): string {
  switch (tier) {
    case 'High':
      return 'bg-success text-success-foreground';
    case 'Medium':
      return 'bg-warning text-warning-foreground';
    default:
      return 'bg-destructive text-destructive-foreground';
  }
}

export function tierBarClass(tier: TrustTier): string {
  switch (tier) {
    case 'High':
      return 'bg-success';
    case 'Medium':
      return 'bg-warning';
    default:
      return 'bg-destructive';
  }
}

const FLAG_LABELS: Record<string, string> = {
  single_or_no_source: 'Single / no source',
  doctor_count_contradicts_specialty_breadth: 'Doctor count vs. specialties',
  implausible_capacity_vs_doctors: 'Implausible capacity',
  future_dated_update: 'Future-dated update',
  missing_or_invalid_geo: 'Missing / invalid location',
  stale_over_2y: 'Not updated in 2+ years',
};

export function flagLabel(flag: string): string {
  return FLAG_LABELS[flag] ?? flag;
}

// trust_flags is returned as a '|'-joined string (empty when none).
export function parseFlags(flags: string | null | undefined): string[] {
  if (!flags) return [];
  return flags.split('|').filter((f) => f.trim() !== '');
}
