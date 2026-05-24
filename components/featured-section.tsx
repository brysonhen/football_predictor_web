"use client";

import { Activity, BarChart3, Layers, TrendingUp } from "lucide-react";
import { AccuracyChart } from "@/components/accuracy-chart";
import { formatSeason } from "@/lib/types";

import plMeta         from "@/data/pl/meta.json";
import laligaMeta     from "@/data/laliga/meta.json";
import bundesligaMeta from "@/data/bundesliga/meta.json";
import serieaMeta     from "@/data/seriea/meta.json";
import ligue1Meta     from "@/data/ligue1/meta.json";

const ALL_META = {
  pl: plMeta, laliga: laligaMeta, bundesliga: bundesligaMeta,
  seriea: serieaMeta, ligue1: ligue1Meta,
};

const LEAGUE_DISPLAY = [
  { id: "pl",         name: "Premier League",  flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { id: "laliga",     name: "La Liga",          flag: "🇪🇸" },
  { id: "bundesliga", name: "Bundesliga",       flag: "🇩🇪" },
  { id: "seriea",     name: "Serie A",          flag: "🇮🇹" },
  { id: "ligue1",     name: "Ligue 1",          flag: "🇫🇷" },
];

// Aggregate across all 5 leagues
const totalMatches = Object.values(ALL_META).reduce((n, m) => n + m.totalMatches, 0);
const totalClubs   = Object.values(ALL_META).reduce((n, m) => n + m.teamCount, 0);
const avgAccuracy  = Math.round(
  Object.values(ALL_META).reduce((n, m) => n + m.metrics.model_accuracy, 0) /
  Object.values(ALL_META).length * 100
);

function QuadrantHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {icon}
      {label}
    </div>
  );
}

export function FeaturedSection() {
  // Featured league for the chart — use the highest accuracy one (Bundesliga)
  const featuredId = "bundesliga";
  const featured = ALL_META[featuredId];
  const accuracy = Math.round(featured.metrics.model_accuracy * 100);
  const baseline = featured.metrics.dummy_log_loss;
  const model = featured.metrics.model_log_loss;
  const improvement = Math.round(((baseline - model) / baseline) * 100);
  const homeWinBaseline = Math.round(
    (featured.confusionMatrix[0][0] / featured.confusionMatrix[0].reduce((a, b) => a + b, 0)) * 100
  );

  return (
    <section className="border-t border-border bg-background py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-10 max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Under the hood</h2>
          <p className="mt-3 text-muted-foreground">
            Five separate logistic regression models — one per league — each trained with strict
            temporal validation so every prediction uses only what was known before kickoff.
          </p>
        </div>

        {/* Top stats row */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { value: "5",                          label: "Leagues" },
            { value: totalClubs.toString(),         label: "Clubs tracked" },
            { value: totalMatches.toLocaleString(), label: "Matches analysed" },
            { value: `${avgAccuracy}%`,             label: "Avg test accuracy" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-5 text-center">
              <div className="text-2xl font-bold tabular-nums text-primary">{s.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-border md:grid-cols-2">
          {/* 1. Per-league accuracy breakdown */}
          <div className="border-b border-border bg-card p-6 md:border-r">
            <QuadrantHeader icon={<TrendingUp className="h-4 w-4" />} label="Per-league accuracy" />
            <h3 className="mt-3 text-xl font-semibold">
              Up to 52% accuracy.{" "}
              <span className="font-normal text-muted-foreground">
                Across {totalMatches.toLocaleString()} real matches, temporally validated.
              </span>
            </h3>
            <div className="mt-4 space-y-3">
              {LEAGUE_DISPLAY.map(({ id, name, flag }) => {
                const m = ALL_META[id as keyof typeof ALL_META];
                const acc = Math.round(m.metrics.model_accuracy * 100);
                return (
                  <div key={id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <span>{flag}</span>
                        {name}
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-primary">{acc}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${acc}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Methodology */}
          <div className="border-b border-border bg-card p-6">
            <QuadrantHeader icon={<Layers className="h-4 w-4" />} label="23 features, 5 models" />
            <h3 className="mt-3 text-xl font-semibold">
              Pure form, nothing else.{" "}
              <span className="font-normal text-muted-foreground">
                No injuries, no transfers, no weather — just the numbers teams put on the pitch.
              </span>
            </h3>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              {[
                { label: "Points per game",         detail: "Last 5 and last 10 matches" },
                { label: "Goals scored & conceded",  detail: "Both 5 and 10 game windows" },
                { label: "Goal difference",          detail: "Per game, 5 and 10 game windows" },
                { label: "Composite comparisons",    detail: "Head-to-head form gaps (5 features)" },
                { label: "Rest / fatigue proxy",     detail: "Days since last match" },
              ].map(({ label, detail }) => (
                <li key={label} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>
                    <span className="font-medium text-foreground">{label}</span>
                    {" — "}
                    {detail}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg border border-border bg-background px-4 py-3 text-xs text-muted-foreground">
              Features are computed independently for home and away, then compared with difference
              features — giving the model 23 inputs per fixture.
            </div>
          </div>

          {/* 3. Accuracy chart (Bundesliga as the highlighted league) */}
          <div className="border-b border-border bg-card p-6 md:border-r md:border-b-0">
            <QuadrantHeader icon={<Activity className="h-4 w-4" />} label="Bundesliga — model performance" />
            <h3 className="mt-3 text-xl font-semibold">
              Accuracy through the {formatSeason(featured.testSeasons[0])} season.{" "}
              <span className="font-normal text-muted-foreground">
                Tested on matches the model had never seen before.
              </span>
            </h3>
            <div className="mt-4">
              <AccuracyChart data={featured.monthlyAccuracy} />
            </div>
          </div>

          {/* 4. Stats cards */}
          <div className="grid bg-card sm:grid-cols-2">
            <div className="flex flex-col gap-3 border-border p-6 [&:not(:last-child)]:border-b sm:[&:not(:last-child)]:border-b-0 sm:[&:not(:last-child)]:border-r">
              <QuadrantHeader icon={<BarChart3 className="h-4 w-4" />} label="Beats the baseline" />
              <p className="mt-1 text-base font-semibold leading-snug">
                {accuracy}% test accuracy.{" "}
                <span className="font-normal text-muted-foreground">
                  {improvement}% lower log-loss than a majority-class baseline, across{" "}
                  {featured.totalMatches.toLocaleString()} Bundesliga matches.
                </span>
              </p>
              <div className="mt-auto grid grid-cols-2 gap-2 pt-2">
                <div className="rounded-lg border border-border bg-background px-3 py-2 text-center">
                  <div className="text-lg font-bold tabular-nums text-primary">{accuracy}%</div>
                  <div className="text-[10px] text-muted-foreground">ML model</div>
                </div>
                <div className="rounded-lg border border-border bg-background px-3 py-2 text-center">
                  <div className="text-lg font-bold tabular-nums">{homeWinBaseline}%</div>
                  <div className="text-[10px] text-muted-foreground">Home-win baseline</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 p-6">
              <QuadrantHeader icon={<Activity className="h-4 w-4" />} label="Temporal validation" />
              <p className="mt-1 text-base font-semibold leading-snug">
                No data leakage.{" "}
                <span className="font-normal text-muted-foreground">
                  Each feature snapshot uses only matches played before the fixture date.
                  The test season was never in the training set.
                </span>
              </p>
              <ul className="mt-auto space-y-1 pt-2 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-primary" />
                  Train: all seasons before the test season
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-primary" />
                  Test: the most recent completed full season
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-primary" />
                  Snapshots computed match-by-match in chronological order
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
