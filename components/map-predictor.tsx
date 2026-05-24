"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight,
  Loader2,
  TrendingUp,
  BarChart3,
  Activity,
  Layers,
  X,
} from "lucide-react";
import { TeamMap } from "@/components/team-map";
import { AccuracyChart } from "@/components/accuracy-chart";
import { teamLogoSrc, formatSeason, type PredictionResult, type TeamForm, type TeamMeta } from "@/lib/types";
import { useLeague } from "@/lib/league-context";
import { Button } from "@/components/ui/button";

import plTeams         from "@/data/pl/teams.json";
import laligaTeams     from "@/data/laliga/teams.json";
import bundesligaTeams from "@/data/bundesliga/teams.json";
import serieaTeams     from "@/data/seriea/teams.json";
import ligue1Teams     from "@/data/ligue1/teams.json";

import plMeta         from "@/data/pl/meta.json";
import laligaMeta     from "@/data/laliga/meta.json";
import bundesligaMeta from "@/data/bundesliga/meta.json";
import serieaMeta     from "@/data/seriea/meta.json";
import ligue1Meta     from "@/data/ligue1/meta.json";

const ALL_TEAMS: Record<string, Record<string, TeamMeta>> = {
  pl:         plTeams         as Record<string, TeamMeta>,
  laliga:     laligaTeams     as Record<string, TeamMeta>,
  bundesliga: bundesligaTeams as Record<string, TeamMeta>,
  seriea:     serieaTeams     as Record<string, TeamMeta>,
  ligue1:     ligue1Teams     as Record<string, TeamMeta>,
};

const ALL_META: Record<string, typeof plMeta> = {
  pl: plMeta, laliga: laligaMeta, bundesliga: bundesligaMeta,
  seriea: serieaMeta, ligue1: ligue1Meta,
};

const LEAGUES = [
  { id: "pl",         name: "Premier League",  flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { id: "laliga",     name: "La Liga",          flag: "🇪🇸" },
  { id: "bundesliga", name: "Bundesliga",       flag: "🇩🇪" },
  { id: "seriea",     name: "Serie A",          flag: "🇮🇹" },
  { id: "ligue1",     name: "Ligue 1",          flag: "🇫🇷" },
];

const COLORS = { home: "var(--chart-1)", draw: "var(--chart-2)", away: "var(--chart-3)" };

function TeamLogo({ team, size = 28 }: { team: TeamMeta | undefined; size?: number }) {
  const src = team ? teamLogoSrc(team) : null;
  if (!src) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded bg-muted text-[9px] font-bold text-muted-foreground"
        style={{ width: size, height: size }}
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
    W: "bg-emerald-500 text-white",
    D: "bg-muted-foreground/60 text-white",
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
    ["Points/game (last 5)",  form.ppg_l5.toFixed(1)],
    ["Points/game (last 10)", form.ppg_l10.toFixed(1)],
    ["Goals scored/game",     form.gf_l5.toFixed(1)],
    ["Goals conceded/game",   form.ga_l5.toFixed(1)],
    ["Days since last match", String(form.rest_days)],
  ];
  const roleColor = role === "Home" ? "emerald" : "orange";
  return (
    <div className={`rounded-xl border bg-card p-4 ${role === "Home" ? "border-emerald-500/30" : "border-orange-500/30"}`}>
      <div className="flex items-center gap-3">
        <TeamLogo team={teamMeta} size={36} />
        <div>
          <div className="font-semibold leading-tight">{name}</div>
          <div className={`text-xs font-medium ${role === "Home" ? "text-emerald-600 dark:text-emerald-400" : "text-orange-600 dark:text-orange-400"}`}>{role}</div>
        </div>
      </div>
      <div className="mt-3">
        <FormBadges form={form.recent_form} />
      </div>
      <dl className="mt-3 space-y-0">
        {stats.map(([label, value]) => (
          <div
            key={label}
            className="flex justify-between border-b border-border/50 py-1.5 text-sm last:border-0"
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
  return (
    <div className="flex h-10 w-full overflow-hidden rounded-lg">
      {[{ v: home, c: COLORS.home }, { v: draw, c: COLORS.draw }, { v: away, c: COLORS.away }].map(
        (s, i) => (
          <div
            key={i}
            className="animate-grow-bar flex items-center justify-center"
            style={{ width: `${s.v * 100}%`, backgroundColor: s.c, animationDelay: `${i * 90}ms` }}
          >
            {s.v > 0.08 && (
              <span className="text-sm font-bold text-white/90">{Math.round(s.v * 100)}%</span>
            )}
          </div>
        )
      )}
    </div>
  );
}

function SelectionBar() {
  const { viewMode, homeTeam, awayTeam, league, swapTeams, reset, selectTeam } = useLeague();
  const leagueName = LEAGUES.find((l) => l.id === league)?.name ?? "";
  const teams = ALL_TEAMS[league] ?? {};
  const homeMeta = homeTeam ? teams[homeTeam] : undefined;
  const awayMeta = awayTeam ? teams[awayTeam] : undefined;

  if (viewMode === "europe") {
    return (
      <div className="flex items-center justify-center gap-3 py-4 text-sm text-muted-foreground">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
        Click a league below to zoom in, then pick two teams on the map
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 py-4">
      {/* Home slot */}
      <div
        className={`flex min-w-[120px] items-center gap-2.5 rounded-xl border px-4 py-2.5 ${
          homeTeam
            ? "border-emerald-500/40 bg-emerald-500/10"
            : "border-dashed border-border bg-card/60"
        }`}
      >
        {homeTeam ? (
          <>
            <TeamLogo team={homeMeta} size={24} />
            <div className="min-w-0">
              <div className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">HOME</div>
              <div className="truncate text-sm font-semibold">{homeTeam}</div>
            </div>
            <button
              onClick={() => selectTeam(homeTeam)}
              className="ml-auto text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">
            {awayTeam ? "Click to set Home" : "Pick home team"}
          </span>
        )}
      </div>

      {/* Swap */}
      {homeTeam && awayTeam && (
        <button
          onClick={swapTeams}
          className="rounded-full border border-border bg-card p-2 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
          title="Swap home / away"
        >
          <ArrowLeftRight className="h-4 w-4" />
        </button>
      )}

      {/* vs divider when only one team */}
      {(!homeTeam || !awayTeam) && !(homeTeam && awayTeam) && (
        <span className="text-xs text-muted-foreground">vs</span>
      )}

      {/* Away slot */}
      <div
        className={`flex min-w-[120px] items-center gap-2.5 rounded-xl border px-4 py-2.5 ${
          awayTeam
            ? "border-orange-500/40 bg-orange-500/10"
            : "border-dashed border-border bg-card/60"
        }`}
      >
        {awayTeam ? (
          <>
            <TeamLogo team={awayMeta} size={24} />
            <div className="min-w-0">
              <div className="text-[10px] font-medium text-orange-600 dark:text-orange-400">AWAY</div>
              <div className="truncate text-sm font-semibold">{awayTeam}</div>
            </div>
            <button
              onClick={() => selectTeam(awayTeam)}
              className="ml-auto text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">
            {homeTeam ? "Now pick away team" : "Pick away team"}
          </span>
        )}
      </div>
    </div>
  );
}

export function MapPredictor() {
  const { league, viewMode, homeTeam, awayTeam, selectLeague, selectTeam } = useLeague();
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const mapLeague = viewMode === "europe" ? "europe" : league;

  // Auto-predict when both teams are selected
  useEffect(() => {
    if (!homeTeam || !awayTeam) {
      setResult(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch("/api/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ home: homeTeam, away: awayTeam, league }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) setError(data.error);
        else {
          setResult(data);
          // Scroll to result
          setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
        }
      })
      .catch(() => { if (!cancelled) setError("Prediction failed."); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [homeTeam, awayTeam, league]);

  function handleTeamClick(name: string, leagueId?: string) {
    // If on Europe view and a team is clicked, zoom to that league first
    if (viewMode === "europe" && leagueId) {
      selectLeague(leagueId);
    }
    selectTeam(name);
  }

  const meta = ALL_META[league] ?? plMeta;
  const teams = ALL_TEAMS[league] ?? {};
  const teamByName = new Map(Object.values(teams).map((t) => [t.name, t]));
  const accuracy = Math.round(meta.metrics.model_accuracy * 100);
  const baseline = meta.metrics.dummy_log_loss;
  const model = meta.metrics.model_log_loss;
  const improvement = Math.round(((baseline - model) / baseline) * 100);

  return (
    <section className="bg-background">
      {/* Hero text */}
      <div className="mx-auto max-w-7xl px-6 pt-10 pb-4 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
          Football <span className="text-primary">Match Predictor</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">
          Select a league, then click two clubs on the map to get an instant
          ML-powered win probability prediction.
        </p>
      </div>

      {/* League selector */}
      <div className="mx-auto max-w-7xl px-6 pb-3">
        <div className="flex flex-wrap justify-center gap-2">
          {LEAGUES.map((l) => (
            <button
              key={l.id}
              onClick={() => selectLeague(l.id)}
              className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
                viewMode === "league" && league === l.id
                  ? "border-primary bg-primary text-primary-foreground shadow-md"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
            >
              <span>{l.flag}</span>
              {l.name}
            </button>
          ))}
        </div>
      </div>

      {/* THE MAP */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <TeamMap
            league={mapLeague}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            onTeamClick={handleTeamClick}
            interactive={true}
          />
        </div>
      </div>

      {/* Team selection bar */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SelectionBar />
      </div>

      {/* Loading spinner */}
      {loading && (
        <div className="mx-auto mt-2 flex max-w-5xl items-center justify-center gap-2 px-6 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Running prediction…
        </div>
      )}

      {error && (
        <div className="mx-auto max-w-5xl px-6 py-2">
          <p className="text-center text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Prediction result */}
      {result && !loading && (
        <div
          ref={resultRef}
          key={`${league}-${result.home}-${result.away}`}
          className="mx-auto max-w-5xl animate-fade-up space-y-4 px-4 pb-10 sm:px-6"
        >
          {/* Probability bar */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-muted-foreground">Predicted outcome</h3>
              <span className="text-xs text-muted-foreground">
                {accuracy}% test accuracy · {meta.leagueName} model
              </span>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">
              Win probability reflects how often a team in this form situation wins similar matchups.
            </p>
            <ProbabilityBar
              home={result.probabilities.home}
              draw={result.probabilities.draw}
              away={result.probabilities.away}
            />
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              {[
                { label: `${result.home} win`, v: result.probabilities.home, c: COLORS.home },
                { label: "Draw",               v: result.probabilities.draw,  c: COLORS.draw  },
                { label: `${result.away} win`, v: result.probabilities.away,  c: COLORS.away  },
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

          {/* Form cards + drivers */}
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

          {/* Drivers */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h3 className="text-sm font-semibold text-muted-foreground">What drove this prediction</h3>
            <p className="mt-1 mb-3 text-xs text-muted-foreground">
              The model predicted <span className="font-semibold text-foreground">{result.predicted}</span>.
              Green bars pushed toward that outcome; red pushed against.
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

          {/* H2H */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h3 className="text-sm font-semibold text-muted-foreground">Head-to-head history</h3>
            <p className="mt-1 mb-3 text-xs text-muted-foreground">
              Last {result.h2h.matches.length} meetings on record.
            </p>
            {result.h2h.matches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No previous meetings in the dataset.</p>
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
                      <div className="text-xs text-muted-foreground truncate">{o.label}</div>
                    </div>
                  ))}
                </div>
                <div className="divide-y divide-border/60">
                  {result.h2h.matches.map((m, i) => {
                    const winner = m.ftr === "H" ? m.home : m.ftr === "A" ? m.away : null;
                    return (
                      <div key={i} className="flex items-center justify-between py-2 text-sm">
                        <span className="w-20 shrink-0 text-xs text-muted-foreground">
                          {new Date(m.date).toLocaleDateString("en-GB", {
                            day: "2-digit", month: "short", year: "numeric",
                          })}
                        </span>
                        <span className="flex-1 text-center text-xs sm:text-sm">
                          <span className={winner === m.home ? "font-semibold" : ""}>{m.home}</span>
                          {" "}<span className="font-mono font-semibold">{m.fthg}–{m.ftag}</span>{" "}
                          <span className={winner === m.away ? "font-semibold" : ""}>{m.away}</span>
                        </span>
                        <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
                          {winner ? `${winner.split(" ")[0]} win` : "Draw"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Accuracy mini-chart */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground">Model accuracy — {meta.leagueName}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Tested on {formatSeason(meta.testSeasons[0])} — a full season the model never saw.
                </p>
              </div>
              <div className="flex gap-3">
                <div className="rounded-lg border border-border bg-background px-3 py-2 text-center">
                  <div className="text-lg font-bold tabular-nums text-primary">{accuracy}%</div>
                  <div className="text-[10px] text-muted-foreground">ML model</div>
                </div>
                <div className="rounded-lg border border-border bg-background px-3 py-2 text-center">
                  <div className="text-lg font-bold tabular-nums">{improvement}%</div>
                  <div className="text-[10px] text-muted-foreground">vs baseline</div>
                </div>
              </div>
            </div>
            <AccuracyChart data={meta.monthlyAccuracy} />
          </div>
        </div>
      )}
    </section>
  );
}
