"use client";

import {
  Activity,
  GalleryVerticalEnd,
  MapPin,
  BarChart3,
  Layers,
} from "lucide-react";
import { TeamMap } from "@/components/team-map";
import { AccuracyChart } from "@/components/accuracy-chart";
import { teamLogoSrc, formatSeason } from "@/lib/types";
import { useLeague } from "@/lib/league-context";
import type { TeamMeta } from "@/lib/types";

import plMeta     from "@/data/pl/meta.json";
import laligaMeta from "@/data/laliga/meta.json";
import bundesligaMeta from "@/data/bundesliga/meta.json";
import serieaMeta from "@/data/seriea/meta.json";
import ligue1Meta from "@/data/ligue1/meta.json";

import plTeams         from "@/data/pl/teams.json";
import laligaTeams     from "@/data/laliga/teams.json";
import bundesligaTeams from "@/data/bundesliga/teams.json";
import serieaTeams     from "@/data/seriea/teams.json";
import ligue1Teams     from "@/data/ligue1/teams.json";

const ALL_META: Record<string, typeof plMeta> = {
  pl: plMeta, laliga: laligaMeta, bundesliga: bundesligaMeta,
  seriea: serieaMeta, ligue1: ligue1Meta,
};

const ALL_TEAMS: Record<string, Record<string, TeamMeta>> = {
  pl:         plTeams         as Record<string, TeamMeta>,
  laliga:     laligaTeams     as Record<string, TeamMeta>,
  bundesliga: bundesligaTeams as Record<string, TeamMeta>,
  seriea:     serieaTeams     as Record<string, TeamMeta>,
  ligue1:     ligue1Teams     as Record<string, TeamMeta>,
};

function ResultCrest({ name, league }: { name: string; league: string }) {
  const team = ALL_TEAMS[league]?.[name];
  const src = team ? teamLogoSrc(team) : null;
  if (!src) return null;
  /* eslint-disable-next-line @next/next/no-img-element */
  return <img src={src} alt={name} className="h-5 w-5 object-contain" />;
}

function QuadrantHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {icon}
      {label}
    </div>
  );
}

export function FeaturedSection() {
  const { league } = useLeague();
  const meta = ALL_META[league] ?? plMeta;
  const recent = meta.recentResults.slice(0, 6);

  const baseline = meta.metrics.dummy_log_loss;
  const model = meta.metrics.model_log_loss;
  const improvement = Math.round(((baseline - model) / baseline) * 100);
  const accuracy = Math.round(meta.metrics.model_accuracy * 100);

  return (
    <section className="border-t border-border bg-background py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-10 max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Under the hood
          </h2>
          <p className="mt-3 text-muted-foreground">
            Five separate logistic regression models — one per league — each
            trained with strict temporal validation so every prediction uses
            only what was known before kickoff.
          </p>
        </div>

        <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-border md:grid-cols-2">
          {/* 1. Stadium map */}
          <div className="border-b border-border bg-card p-6 md:border-r">
            <QuadrantHeader icon={<MapPin className="h-4 w-4" />} label="Stadium network" />
            <h3 className="mt-3 text-xl font-semibold">
              Every ground, mapped.{" "}
              <span className="font-normal text-muted-foreground">
                {meta.teamCount} clubs feed the {meta.leagueName} model.
              </span>
            </h3>
            <div className="relative mt-4">
              <TeamMap league={league} />
              <div className="absolute right-2 top-2 rounded-md border border-border bg-background/80 px-2.5 py-1 text-xs font-medium backdrop-blur">
                {meta.teamCount} clubs · {meta.totalMatches.toLocaleString()} matches
              </div>
            </div>
          </div>

          {/* 2. Recent results feed */}
          <div className="flex flex-col border-b border-border bg-card p-6">
            <QuadrantHeader icon={<GalleryVerticalEnd className="h-4 w-4" />} label="Methodology" />
            <h3 className="mt-3 text-xl font-semibold">
              Trained on real results.{" "}
              <span className="font-normal text-muted-foreground">
                The model learns from thousands of completed matches like these.
              </span>
            </h3>
            <div className="relative mt-4 flex-1">
              <div className="space-y-2">
                {recent.map((m, i) => {
                  const winner = m.ftr === "H" ? m.home : m.ftr === "A" ? m.away : null;
                  return (
                    <div
                      key={i}
                      className="animate-scale-up flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2"
                      style={{ animationDelay: `${i * 90}ms` }}
                    >
                      <span className="text-xs text-muted-foreground">
                        {new Date(m.date).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                      <div className="flex flex-1 items-center justify-center gap-2 text-sm">
                        <ResultCrest name={m.home} league={league} />
                        <span className="font-mono font-semibold">
                          {m.fthg}-{m.ftag}
                        </span>
                        <ResultCrest name={m.away} league={league} />
                      </div>
                      <span className="w-14 text-right text-xs text-muted-foreground">
                        {winner ? winner.split(" ")[0] : "Draw"}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card to-transparent" />
            </div>
          </div>

          {/* 3. Accuracy chart */}
          <div className="border-b border-border bg-card p-6 md:border-r md:border-b-0">
            <QuadrantHeader icon={<Activity className="h-4 w-4" />} label="Model performance" />
            <h3 className="mt-3 text-xl font-semibold">
              Accuracy through the {formatSeason(meta.testSeasons[0])} season.{" "}
              <span className="font-normal text-muted-foreground">
                Tested on a full season the model never saw in training.
              </span>
            </h3>
            <div className="mt-4">
              <AccuracyChart data={meta.monthlyAccuracy} />
            </div>
          </div>

          {/* 4. Stats cards */}
          <div className="grid bg-card sm:grid-cols-2">
            <div className="flex flex-col gap-3 border-border p-6 [&:not(:last-child)]:border-b sm:[&:not(:last-child)]:border-b-0 sm:[&:not(:last-child)]:border-r">
              <QuadrantHeader icon={<BarChart3 className="h-4 w-4" />} label="Beats the baseline" />
              <p className="mt-1 text-base font-semibold leading-snug">
                {accuracy}% test accuracy.{" "}
                <span className="font-normal text-muted-foreground">
                  {improvement}% lower log-loss than a naive majority-class
                  baseline, across {meta.totalMatches.toLocaleString()} matches.
                </span>
              </p>
              <div className="mt-auto grid grid-cols-2 gap-2 pt-2">
                <div className="rounded-lg border border-border bg-background px-3 py-2 text-center">
                  <div className="text-lg font-bold tabular-nums text-primary">{accuracy}%</div>
                  <div className="text-[10px] text-muted-foreground">ML model</div>
                </div>
                <div className="rounded-lg border border-border bg-background px-3 py-2 text-center">
                  <div className="text-lg font-bold tabular-nums">
                    {Math.round(
                      (meta.confusionMatrix[0][0] /
                        meta.confusionMatrix[0].reduce((a, b) => a + b, 0)) *
                        100
                    )}%
                  </div>
                  <div className="text-[10px] text-muted-foreground">Home-win baseline</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 p-6">
              <QuadrantHeader icon={<Layers className="h-4 w-4" />} label="12 inputs" />
              <p className="mt-1 text-base font-semibold leading-snug">
                6 form stats, doubled.{" "}
                <span className="font-normal text-muted-foreground">
                  Each feature is computed independently for home and away,
                  giving the model a full picture of both sides.
                </span>
              </p>
              <ul className="mt-auto space-y-1 pt-2 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-primary" />
                  Points per game (last 5 and 10 matches)
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-primary" />
                  Goals scored and conceded per game
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-primary" />
                  Days since last match (fatigue proxy)
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
