import { useState } from 'react';
import {
  useAnalyticsQuery,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Slider,
  Badge,
  Skeleton,
  Alert,
  AlertTitle,
  AlertDescription,
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@databricks/appkit-ui/react';
import { sql } from '@databricks/appkit-ui/js';
import { MapPin, ShieldCheck, Search, Bookmark, BookmarkCheck } from 'lucide-react';
import { fmtScore, fmtKm, fmtNum } from '../lib/format';
import { tierClasses, flagLabel, parseFlags } from '../lib/trust';
import { useShortlist } from '../lib/shortlist';
import { FacilityDetailSheet } from '../components/FacilityDetailSheet';

type SearchParams = {
  specialty: string;
  pincode: number;
  radiusKm: number;
  trustWeight: number; // 0..100 (percent)
};

export function ReferralWorkspace() {
  const [specialty, setSpecialty] = useState<string>('');
  const [pincode, setPincode] = useState<string>('');
  const [radiusKm, setRadiusKm] = useState<number>(50);
  const [trustWeight, setTrustWeight] = useState<number>(40);
  const [submitted, setSubmitted] = useState<SearchParams | null>(null);

  const specialtiesQ = useAnalyticsQuery('specialties', {});

  const pincodeValid = /^\d{6}$/.test(pincode);
  const canSearch = specialty !== '' && pincodeValid;

  const onSearch = () => {
    if (!canSearch) return;
    setSubmitted({ specialty, pincode: Number(pincode), radiusKm, trustWeight });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <TrustOverviewStrip />

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start">
        {/* Patient-need form */}
        <Card className="shadow-sm lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle className="text-base">Patient need</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="specialty">Specialty / service needed</Label>
              <Select value={specialty} onValueChange={setSpecialty}>
                <SelectTrigger id="specialty">
                  <SelectValue placeholder="Select a specialty" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {specialtiesQ.data?.map((s) => (
                    <SelectItem key={s.specialty} value={s.specialty}>
                      {s.specialty} ({fmtNum(s.n_facilities)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pincode">Patient location (6-digit pincode)</Label>
              <Input
                id="pincode"
                inputMode="numeric"
                placeholder="e.g. 110002"
                value={pincode}
                maxLength={6}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
              />
              {pincode !== '' && !pincodeValid && (
                <p className="text-xs text-destructive">Enter a valid 6-digit pincode.</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Search radius</Label>
                <span className="text-sm text-muted-foreground">{radiusKm} km</span>
              </div>
              <Slider
                value={[radiusKm]}
                min={5}
                max={200}
                step={5}
                onValueChange={(v) => setRadiusKm(v[0])}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Trust weight</Label>
                <span className="text-sm text-muted-foreground">{trustWeight}%</span>
              </div>
              <Slider
                value={[trustWeight]}
                min={0}
                max={100}
                step={5}
                onValueChange={(v) => setTrustWeight(v[0])}
              />
              <p className="text-xs text-muted-foreground">
                How much information-trust influences ranking vs. proximity. 0% = nearest first,
                100% = most-trustworthy first.
              </p>
            </div>

            <Button className="w-full" disabled={!canSearch} onClick={onSearch}>
              <Search className="h-4 w-4" /> Find facilities
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="min-w-0">
          {submitted ? (
            <Results params={submitted} />
          ) : (
            <Empty className="border rounded-lg py-16">
              <EmptyHeader>
                <EmptyTitle>Start a referral</EmptyTitle>
                <EmptyDescription>
                  Pick a specialty and enter the patient's pincode, then press
                  <span className="font-medium"> Find facilities</span>. You'll get ranked
                  options with a transparent trust score and the evidence behind each one.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </div>
    </div>
  );
}

function TrustOverviewStrip() {
  const { data } = useAnalyticsQuery('trust_overview', {});
  if (!data || data.length === 0) return null;
  const total = data.reduce((acc, r) => acc + Number(r.n_facilities), 0);
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="text-muted-foreground">
        <ShieldCheck className="inline h-4 w-4 mr-1" />
        {fmtNum(total)} facilities scored for information trust:
      </span>
      {data.map((r) => (
        <Badge key={r.trust_tier} className={tierClasses(r.trust_tier)}>
          {fmtNum(r.n_facilities)} {r.trust_tier}
        </Badge>
      ))}
    </div>
  );
}

function Results({ params }: { params: SearchParams }) {
  const [selected, setSelected] = useState<{ id: string; district: string } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const shortlist = useShortlist();

  const pinQ = useAnalyticsQuery('pincode_info', { pincode: sql.bigint(params.pincode) });
  const { data, loading, error } = useAnalyticsQuery('recommend', {
    specialty: sql.string(params.specialty),
    pincode: sql.bigint(params.pincode),
    radius_km: sql.double(params.radiusKm),
    trust_weight: sql.double(params.trustWeight / 100),
  });

  const loc = pinQ.data?.[0];
  const pinNotFound = !pinQ.loading && (!pinQ.data || pinQ.data.length === 0);

  const openDetail = (id: string, district: string) => {
    setSelected({ id, district });
    setSheetOpen(true);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold capitalize">{params.specialty}</h2>
        <p className="text-sm text-muted-foreground">
          <MapPin className="inline h-3.5 w-3.5 mr-1" />
          Within {params.radiusKm} km of {params.pincode}
          {loc ? ` · ${loc.district}, ${loc.state}` : ''} · trust weight {params.trustWeight}%
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          <span className="font-medium">Match</span> blends proximity and information-trust
          (0–100). <span className="font-medium">Trust</span> scores how complete, corroborated,
          consistent and fresh the facility's record is — not its clinical quality.
        </p>
        {shortlist.entries.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            <BookmarkCheck className="inline h-3.5 w-3.5 mr-1" />
            {shortlist.entries.length} facilit{shortlist.entries.length === 1 ? 'y' : 'ies'} saved to
            your shortlist (persisted)
          </p>
        )}
      </div>

      {pinNotFound && (
        <Alert variant="destructive">
          <AlertTitle>Pincode not found</AlertTitle>
          <AlertDescription>
            We couldn't resolve pincode {params.pincode} to a location, so distances can't be
            computed. Try a nearby pincode.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Search failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      )}

      {!loading && !error && data && data.length === 0 && !pinNotFound && (
        <Empty className="border rounded-lg py-16">
          <EmptyHeader>
            <EmptyTitle>No matching facilities</EmptyTitle>
            <EmptyDescription>
              No facilities offer {params.specialty} within {params.radiusKm} km. Try widening the
              radius or choosing a related specialty.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {!loading && !error && data && data.length > 0 && (
        <div className="space-y-3">
          {data.map((f, idx) => (
            <FacilityCard
              key={f.facility_id}
              rank={idx + 1}
              f={f}
              onOpen={openDetail}
              saved={shortlist.savedIds.has(f.facility_id)}
              onToggleSave={() => {
                const existing = shortlist.entries.find((e) => e.facility_id === f.facility_id);
                if (existing) {
                  void shortlist.remove(existing.id);
                } else {
                  void shortlist.save({
                    facility_id: f.facility_id,
                    specialty: params.specialty,
                    pincode: params.pincode,
                  });
                }
              }}
            />
          ))}
        </div>
      )}

      <FacilityDetailSheet
        facilityId={selected?.id ?? null}
        district={selected?.district ?? null}
        specialty={params.specialty}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}

type RecommendRow = {
  facility_id: string;
  name: string;
  city: string;
  district: string;
  state: string;
  matched_specialties: string;
  number_doctors: number;
  capacity: number;
  distance_km: number;
  proximity_score: number;
  trust_score: number;
  trust_tier: string;
  trust_flags: string;
  rank_score: number;
};

function FacilityCard({
  rank,
  f,
  onOpen,
  saved,
  onToggleSave,
}: {
  rank: number;
  f: RecommendRow;
  onOpen: (id: string, district: string) => void;
  saved: boolean;
  onToggleSave: () => void;
}) {
  const flags = parseFlags(f.trust_flags);
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex gap-4">
          <div className="flex-none w-8 text-center">
            <div className="text-lg font-bold text-muted-foreground">{rank}</div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <button
                  className="text-left font-semibold hover:underline underline-offset-4"
                  onClick={() => onOpen(f.facility_id, f.district)}
                >
                  {f.name}
                </button>
                <div className="text-sm text-muted-foreground truncate">
                  {[f.city, f.district].filter(Boolean).join(' · ')} · {fmtKm(f.distance_km)}
                </div>
              </div>
              <div className="flex-none text-right">
                <Badge className={tierClasses(f.trust_tier)}>
                  Trust {fmtScore(f.trust_score)}/100
                </Badge>
                <div className="text-xs text-muted-foreground mt-1">
                  Match {fmtScore(f.rank_score)}/100
                </div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground mt-2 truncate">{f.matched_specialties}</div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
              <span>Doctors: {fmtNum(f.number_doctors)}</span>
              <span>Beds: {fmtNum(f.capacity)}</span>
              <span>Proximity {fmtScore(f.proximity_score)}/100</span>
            </div>

            {flags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {flags.map((fl) => (
                  <Badge key={fl} variant="outline" className="text-xs">
                    {flagLabel(fl)}
                  </Badge>
                ))}
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpen(f.facility_id, f.district)}>
                View trust &amp; evidence
              </Button>
              <Button
                variant={saved ? 'secondary' : 'outline'}
                size="sm"
                onClick={onToggleSave}
                aria-pressed={saved}
              >
                {saved ? (
                  <>
                    <BookmarkCheck className="h-4 w-4" /> Saved
                  </>
                ) : (
                  <>
                    <Bookmark className="h-4 w-4" /> Save to shortlist
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
