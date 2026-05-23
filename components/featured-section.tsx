import {
  Activity,
  GalleryVerticalEnd,
  MapPin,
  ShieldCheck,
  Eye,
} from "lucide-react";
import { TeamMap } from "@/components/team-map";
import { AccuracyChart } from "@/components/accuracy-chart";
import meta from "@/data/meta.json";
import { logoUrl, formatSeason } from "@/lib/types";
import teamsData from "@/data/teams.json";
import type { TeamMeta } from "@/lib/types";

const teamByName = new Map(
  (Object.values(teamsData) as TeamMeta[]).map((t) => [t.name, t]),
);

function ResultCrest({ name }: { name: string }) {
  const team = teamByName.get(name);
  if (!team) return null;
  /* eslint-disable-next-line @next/next/no-img-element */
  return (
    <img
      src={logoUrl(team.logoId)}
      alt={name}
      className="h-5 w-5 object-contain"
    />
  );
}

function QuadrantHeader({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {icon}
      {label}
    </div>
  );
}

export function FeaturedSection() {
  const recent = meta.recentResults.slice(0, 6);

  return (
    <section className="border-t border-border bg-background py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-10 max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Under the hood
          </h2>
          <p className="mt-3 text-muted-foreground">
            A logistic regression trained on six Premier League seasons, with
            strict temporal validation so every prediction uses only what was
            known before kickoff.
          </p>
        </div>

        <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-border md:grid-cols-2">
          {/* 1. Stadium map */}
          <div className="border-b border-border bg-card p-6 md:border-r">
            <QuadrantHeader
              icon={<MapPin className="h-4 w-4" />}
              label="Stadium network"
            />
            <h3 className="mt-3 text-xl font-semibold">
              Every ground, mapped.{" "}
              <span className="font-normal text-muted-foreground">
                {meta.teamCount} clubs across England feed the training data.
              </span>
            </h3>
            <div className="relative mt-4">
              <TeamMap />
              <div className="absolute right-2 top-2 rounded-md border border-border bg-background/80 px-2.5 py-1 text-xs font-medium backdrop-blur">
                {meta.teamCount} clubs · {meta.totalMatches.toLocaleString()} matches
              </div>
            </div>
          </div>

          {/* 2. Methodology / recent results feed */}
          <div className="flex flex-col border-b border-border bg-card p-6">
            <QuadrantHeader
              icon={<GalleryVerticalEnd className="h-4 w-4" />}
              label="Methodology"
            />
            <h3 className="mt-3 text-xl font-semibold">
              Trained on real results.{" "}
              <span className="font-normal text-muted-foreground">
                The model learns from thousands of completed matches like these.
              </span>
            </h3>
            <div className="relative mt-4 flex-1">
              <div className="space-y-2">
                {recent.map((m, i) => {
                  const winner =
                    m.ftr === "H" ? m.home : m.ftr === "A" ? m.away : null;
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
                        <ResultCrest name={m.home} />
                        <span className="font-mono font-semibold">
                          {m.fthg}-{m.ftag}
                        </span>
                        <ResultCrest name={m.away} />
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
            <QuadrantHeader
              icon={<Activity className="h-4 w-4" />}
              label="Model performance"
            />
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

          {/* 4. Feature cards */}
          <div className="grid bg-card sm:grid-cols-2">
            <FeatureCard
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Data integrity"
              title="No leakage."
              description="Every feature uses only matches played before kickoff. Training and test seasons never overlap."
            />
            <FeatureCard
              icon={<Eye className="h-4 w-4" />}
              label="Transparency"
              title="No black box."
              description="Each prediction breaks down the exact form stats that drove it, in plain English."
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon,
  label,
  title,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-2 border-border p-6 [&:not(:last-child)]:border-b sm:[&:not(:last-child)]:border-b-0 sm:[&:not(:last-child)]:border-r">
      <QuadrantHeader icon={icon} label={label} />
      <p className="mt-2 text-base font-semibold leading-snug">
        {title}{" "}
        <span className="font-normal text-muted-foreground">{description}</span>
      </p>
    </div>
  );
}
