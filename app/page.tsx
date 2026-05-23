import { Code, Target, TrendingUp } from "lucide-react";
import { Predictor } from "@/components/predictor";
import { FeaturedSection } from "@/components/featured-section";
import { Button } from "@/components/ui/button";
import meta from "@/data/meta.json";
import { formatSeason } from "@/lib/types";

const GITHUB_URL = "https://github.com/brysonhen/football_matchup_predictor";

const HERO_STATS = [
  { value: "6", label: "PL seasons" },
  { value: meta.totalMatches.toLocaleString(), label: "matches analysed" },
  { value: `${Math.round(meta.metrics.model_accuracy * 100)}%`, label: "test accuracy" },
  { value: meta.teamCount.toString(), label: "clubs covered" },
];

export default function Home() {
  return (
    <>
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2 font-semibold">
            <Target className="h-5 w-5 text-primary" />
            <span>Matchup Predictor</span>
          </div>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Code className="h-4 w-4" />
            <span className="hidden sm:inline">Source</span>
          </a>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(60% 50% at 50% 0%, color-mix(in oklch, var(--primary) 16%, transparent), transparent)",
            }}
          />
          <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
                Premier League{" "}
                <span className="text-primary">Matchup Predictor</span>
              </h1>

              <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
                A machine learning model that estimates pre-match win
                probabilities for any Premier League fixture, using nothing but
                each team&apos;s recent form.
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="lg" className="font-semibold">
                  <a href="#predictor">
                    <TrendingUp className="h-4 w-4" />
                    Try the predictor
                  </a>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                    <Code className="h-4 w-4" />
                    View the code
                  </a>
                </Button>
              </div>

              <dl className="mx-auto mt-14 grid max-w-2xl grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
                {HERO_STATS.map((s) => (
                  <div key={s.label} className="bg-card px-4 py-5 text-center">
                    <dt className="text-2xl font-bold tabular-nums">{s.value}</dt>
                    <dd className="mt-1 text-xs text-muted-foreground">
                      {s.label}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* Predictor */}
        <section className="mx-auto max-w-3xl px-6 pb-20">
          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight">
              Pick a fixture
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a home and away team to see the model&apos;s prediction,
              the factors behind it, and how the clubs have fared before.
            </p>
          </div>
          <Predictor />
        </section>

        {/* Featured section */}
        <FeaturedSection />
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <p>
            Built by Bryson Henderson · Match data from{" "}
            <a
              href="https://www.football-data.co.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              football-data.co.uk
            </a>
          </p>
          <div className="flex items-center gap-4">
            <span>
              Trained on {meta.trainSeasons.map(formatSeason).join(", ")}
            </span>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-foreground"
            >
              <Code className="h-4 w-4" />
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
