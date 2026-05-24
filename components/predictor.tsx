"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowLeftRight, Loader2, TrendingUp } from "lucide-react";
import { teamLogoSrc, type PredictionResult, type TeamForm, type TeamMeta } from "@/lib/types";
import { useLeague } from "@/lib/league-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

// Static imports for all leagues — each JSON is ~20 KB, total ~100 KB.
import plTeams from "@/data/pl/teams.json";
import laligaTeams from "@/data/laliga/teams.json";
import bundesligaTeams from "@/data/bundesliga/teams.json";
import serieaTeams from "@/data/seriea/teams.json";
import ligue1Teams from "@/data/ligue1/teams.json";

const LEAGUE_DATA: Record<string, { teams: Record<string, TeamMeta>; home: string; away: string }> = {
  pl:         { teams: plTeams as Record<string, TeamMeta>,         home: "Arsenal",      away: "Chelsea"   },
  laliga:     { teams: laligaTeams as Record<string, TeamMeta>,     home: "Barcelona",    away: "Ath Madrid" },
  bundesliga: { teams: bundesligaTeams as Record<string, TeamMeta>, home: "Bayern Munich", away: "Dortmund"  },
  seriea:     { teams: serieaTeams as Record<string, TeamMeta>,     home: "Inter",        away: "Milan"     },
  ligue1:     { teams: ligue1Teams as Record<string, TeamMeta>,     home: "Paris SG",     away: "Marseille" },
};

const LEAGUES = [
  { id: "pl",         name: "Premier League" },
  { id: "laliga",     name: "La Liga"        },
  { id: "bundesliga", name: "Bundesliga"     },
  { id: "seriea",     name: "Serie A"        },
  { id: "ligue1",     name: "Ligue 1"        },
];

const COLORS = { home: "var(--chart-1)", draw: "var(--chart-2)", away: "var(--chart-3)" };

function TeamLogo({ team, size = 24 }: { team: TeamMeta | undefined; size?: number }) {
  const src = team ? teamLogoSrc(team) : null;
  if (!src) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded bg-muted text-[9px] font-bold text-muted-foreground"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        {team?.name?.slice(0, 2).toUpperCase() ?? "?"}
      </span>
    );
  }
  /* eslint-disable-next-line @next/next/no-img-element */
  return (
    <img
      src={src}
      alt={team?.name ?? ""}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="shrink-0 object-contain"
    />
  );
}

function FormBadges({ form }: { form: string[] }) {
  const styles: Record<string, string> = {
    W: "bg-[var(--chart-1)] text-black",
    D: "bg-muted-foreground/70 text-black",
    L: "bg-destructive text-white",
  };
  return (
    <div className="flex gap-1">
      {form.map((r, i) => (
        <span
          key={i}
          className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${styles[r] ?? "bg-muted"}`}
        >
          {r}
        </span>
      ))}
    </div>
  );
}

function TeamFormCard({
  name,
  role,
  form,
  teamMeta,
}: {
  name: string;
  role: "Home" | "Away";
  form: TeamForm;
  teamMeta: TeamMeta | undefined;
}) {
  const stats: [string, string][] = [
    ["Points/game (last 5)", form.ppg_l5.toFixed(1)],
    ["Points/game (last 10)", form.ppg_l10.toFixed(1)],
    ["Goals scored/game", form.gf_l5.toFixed(1)],
    ["Goals conceded/game", form.ga_l5.toFixed(1)],
    ["Days since last match", String(form.rest_days)],
  ];
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <TeamLogo team={teamMeta} size={36} />
        <div>
          <div className="font-semibold leading-tight">{name}</div>
          <div className="text-xs text-muted-foreground">{role}</div>
        </div>
      </div>
      <div className="mt-3">
        <FormBadges form={form.recent_form} />
      </div>
      <dl className="mt-3 space-y-0">
        {stats.map(([label, value]) => (
          <div
            key={label}
            className="flex justify-between border-b border-border/60 py-1.5 text-sm last:border-0"
          >
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ProbabilityBar({ home, draw, away }: { home: number; draw: number; away: number }) {
  const segs = [
    { v: home, c: COLORS.home },
    { v: draw, c: COLORS.draw },
    { v: away, c: COLORS.away },
  ];
  return (
    <div className="flex h-12 w-full overflow-hidden rounded-lg">
      {segs.map((s, i) => (
        <div
          key={i}
          className="animate-grow-bar flex items-center justify-center"
          style={{ width: `${s.v * 100}%`, backgroundColor: s.c, animationDelay: `${i * 90}ms` }}
        >
          {s.v > 0.08 && (
            <span className="text-sm font-bold text-black/80">{Math.round(s.v * 100)}%</span>
          )}
        </div>
      ))}
    </div>
  );
}

export function Predictor() {
  const { league, setLeague } = useLeague();
  const [home, setHome] = useState(LEAGUE_DATA.pl.home);
  const [away, setAway] = useState(LEAGUE_DATA.pl.away);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const didAutoRun = useRef(false);

  const leagueData = LEAGUE_DATA[league];
  const teams = Object.values(leagueData.teams).sort((a, b) => a.name.localeCompare(b.name));
  const teamByName = new Map(teams.map((t) => [t.name, t]));

  // When league changes: reset teams to that league's defaults and clear result
  const handleLeagueChange = (newLeague: string) => {
    const d = LEAGUE_DATA[newLeague];
    setLeague(newLeague);
    setHome(d.home);
    setAway(d.away);
    setResult(null);
    setError(null);
  };

  const swap = () => {
    setHome(away);
    setAway(home);
  };

  async function predict(overrideHome?: string, overrideAway?: string, overrideLeague?: string) {
    const h = overrideHome ?? home;
    const a = overrideAway ?? away;
    const l = overrideLeague ?? league;
    if (h === a) {
      setError("Pick two different teams.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ home: h, away: a, league: l }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Prediction failed.");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  // Auto-run the default PL matchup on first load
  useEffect(() => {
    if (didAutoRun.current) return;
    didAutoRun.current = true;
    predict(LEAGUE_DATA.pl.home, LEAGUE_DATA.pl.away, "pl");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div id="predictor" className="scroll-mt-20">
      {/* League selector */}
      <div className="mb-4">
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">League</label>
        <div className="flex flex-wrap gap-2">
          {LEAGUES.map((l) => (
            <button
              key={l.id}
              onClick={() => handleLeagueChange(l.id)}
              className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                league === l.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
            >
              {l.name}
            </button>
          ))}
        </div>
      </div>

      {/* Team selectors */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Home team
            </label>
            <Select value={home} onValueChange={setHome}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {teams.map((t) => (
                  <SelectItem key={t.name} value={t.name}>
                    <span className="flex items-center gap-2">
                      <TeamLogo team={t} size={18} />
                      {t.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={swap}
            className="mb-0.5 hidden sm:flex"
            aria-label="Swap teams"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </Button>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Away team
            </label>
            <Select value={away} onValueChange={setAway}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {teams.map((t) => (
                  <SelectItem key={t.name} value={t.name}>
                    <span className="flex items-center gap-2">
                      <TeamLogo team={t} size={18} />
                      {t.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Mobile swap */}
        <Button
          variant="outline"
          size="sm"
          onClick={swap}
          className="mt-3 flex w-full items-center justify-center gap-2 sm:hidden"
          aria-label="Swap teams"
        >
          <ArrowLeftRight className="h-4 w-4" />
          Swap home / away
        </Button>

        <Button
          onClick={() => predict()}
          disabled={loading}
          className="mt-3 w-full font-semibold"
          size="lg"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Calculating</>
          ) : (
            <><TrendingUp className="h-4 w-4" /> Predict outcome</>
          )}
        </Button>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </div>

      {/* Result */}
      {result && (
        <div key={`${league}-${result.home}-${result.away}`} className="animate-fade-up mt-5 space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TeamFormCard
              name={result.home}
              role="Home"
              form={result.homeForm}
              teamMeta={teamByName.get(result.home)}
            />
            <TeamFormCard
              name={result.away}
              role="Away"
              form={result.awayForm}
              teamMeta={teamByName.get(result.away)}
            />
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h3 className="text-sm font-semibold text-muted-foreground">
              Predicted outcome probabilities
            </h3>
            <p className="mt-1 mb-4 text-xs text-muted-foreground">
              A win probability is not a guarantee. It reflects how often a team
              in this form situation wins similar matchups.
            </p>
            <ProbabilityBar
              home={result.probabilities.home}
              draw={result.probabilities.draw}
              away={result.probabilities.away}
            />
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              {[
                { label: `${result.home} win`, v: result.probabilities.home, c: COLORS.home },
                { label: "Draw",               v: result.probabilities.draw,  c: COLORS.draw },
                { label: `${result.away} win`, v: result.probabilities.away,  c: COLORS.away },
              ].map((o) => (
                <div key={o.label} className="rounded-lg border border-border bg-background p-3">
                  <div className="text-2xl font-bold tabular-nums" style={{ color: o.c }}>
                    {Math.round(o.v * 100)}%
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{o.label}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium">
              {result.verdict}
            </div>
          </div>

          {/* Drivers */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h3 className="text-sm font-semibold text-muted-foreground">
              What drove this prediction
            </h3>
            <p className="mt-1 mb-3 text-xs text-muted-foreground">
              The model predicted{" "}
              <span className="font-semibold text-foreground">{result.predicted}</span>.
              Green factors pushed toward that outcome; red pushed against it.
            </p>
            <div className="space-y-2">
              {result.drivers.map((d, i) => (
                <div
                  key={i}
                  className="rounded-md border-l-2 bg-background px-3 py-2 text-sm"
                  style={{ borderLeftColor: d.impact > 0 ? COLORS.home : "var(--destructive)" }}
                >
                  {d.explanation}
                </div>
              ))}
            </div>
          </div>

          {/* Head-to-head */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h3 className="text-sm font-semibold text-muted-foreground">
              Head-to-head history
            </h3>
            <p className="mt-1 mb-3 text-xs text-muted-foreground">
              Last {result.h2h.matches.length} meetings in the dataset.
            </p>
            {result.h2h.matches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No previous meetings on record.</p>
            ) : (
              <>
                <div className="mb-3 grid grid-cols-3 gap-3 text-center">
                  {[
                    { label: result.home, v: result.h2h.homeWins },
                    { label: "Draws",    v: result.h2h.draws    },
                    { label: result.away, v: result.h2h.awayWins },
                  ].map((o) => (
                    <div key={o.label} className="rounded-lg border border-border bg-background p-2">
                      <div className="text-xl font-bold tabular-nums">{o.v}</div>
                      <div className="text-xs text-muted-foreground">{o.label}</div>
                    </div>
                  ))}
                </div>
                <div className="divide-y divide-border/60">
                  {result.h2h.matches.map((m, i) => {
                    const winner = m.ftr === "H" ? m.home : m.ftr === "A" ? m.away : null;
                    return (
                      <div key={i} className="flex items-center justify-between py-2 text-sm">
                        <span className="w-24 text-xs text-muted-foreground">
                          {new Date(m.date).toLocaleDateString("en-GB", {
                            day: "2-digit", month: "short", year: "numeric",
                          })}
                        </span>
                        <span className="flex-1 text-center">
                          <span className={winner === m.home ? "font-semibold" : ""}>{m.home}</span>
                          {" "}<span className="font-mono font-semibold">{m.fthg}-{m.ftag}</span>{" "}
                          <span className={winner === m.away ? "font-semibold" : ""}>{m.away}</span>
                        </span>
                        <span className="w-24 text-right text-xs text-muted-foreground">
                          {winner ? `${winner} win` : "Draw"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
