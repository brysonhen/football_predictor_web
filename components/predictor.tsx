"use client";

import { useState } from "react";
import { ArrowLeftRight, Loader2, TrendingUp } from "lucide-react";
import teamsData from "@/data/teams.json";
import { logoUrl, type PredictionResult, type TeamForm, type TeamMeta } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const teams = (Object.values(teamsData) as TeamMeta[]).sort((a, b) =>
  a.name.localeCompare(b.name),
);
const teamByName = new Map(teams.map((t) => [t.name, t]));

const COLORS = { home: "var(--chart-1)", draw: "var(--chart-2)", away: "var(--chart-3)" };

function TeamLogo({ name, size = 24 }: { name: string; size?: number }) {
  const team = teamByName.get(name);
  if (!team) return null;
  /* eslint-disable-next-line @next/next/no-img-element */
  return (
    <img
      src={logoUrl(team.logoId, team.noRetina)}
      alt={name}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="object-contain"
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
          className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${
            styles[r] ?? "bg-muted"
          }`}
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
}: {
  name: string;
  role: "Home" | "Away";
  form: TeamForm;
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
        <TeamLogo name={name} size={36} />
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

function ProbabilityBar({
  home,
  draw,
  away,
}: {
  home: number;
  draw: number;
  away: number;
}) {
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
          style={{
            width: `${s.v * 100}%`,
            backgroundColor: s.c,
            animationDelay: `${i * 90}ms`,
          }}
        >
          {s.v > 0.08 && (
            <span className="text-sm font-bold text-black/80">
              {Math.round(s.v * 100)}%
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function Predictor() {
  const [home, setHome] = useState("Arsenal");
  const [away, setAway] = useState("Chelsea");
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const swap = () => {
    setHome(away);
    setAway(home);
  };

  async function predict() {
    if (home === away) {
      setError("Pick two different teams.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ home, away }),
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

  return (
    <div id="predictor" className="scroll-mt-20">
      {/* Inputs */}
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
                      <TeamLogo name={t.name} size={18} />
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
                      <TeamLogo name={t.name} size={18} />
                      {t.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          onClick={predict}
          disabled={loading}
          className="mt-4 w-full font-semibold"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Calculating
            </>
          ) : (
            <>
              <TrendingUp className="h-4 w-4" /> Predict outcome
            </>
          )}
        </Button>

        {error && (
          <p className="mt-3 text-sm text-destructive">{error}</p>
        )}
      </div>

      {/* Result */}
      {result && (
        <div key={`${result.home}-${result.away}`} className="animate-fade-up mt-5 space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TeamFormCard name={result.home} role="Home" form={result.homeForm} />
            <TeamFormCard name={result.away} role="Away" form={result.awayForm} />
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
                { label: "Draw", v: result.probabilities.draw, c: COLORS.draw },
                { label: `${result.away} win`, v: result.probabilities.away, c: COLORS.away },
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
              The model predicted <span className="font-semibold text-foreground">{result.predicted}</span>.
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
              <p className="text-sm text-muted-foreground">
                No previous meetings on record.
              </p>
            ) : (
              <>
                <div className="mb-3 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg border border-border bg-background p-2">
                    <div className="text-xl font-bold tabular-nums">{result.h2h.homeWins}</div>
                    <div className="text-xs text-muted-foreground">{result.home}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-background p-2">
                    <div className="text-xl font-bold tabular-nums">{result.h2h.draws}</div>
                    <div className="text-xs text-muted-foreground">Draws</div>
                  </div>
                  <div className="rounded-lg border border-border bg-background p-2">
                    <div className="text-xl font-bold tabular-nums">{result.h2h.awayWins}</div>
                    <div className="text-xs text-muted-foreground">{result.away}</div>
                  </div>
                </div>
                <div className="divide-y divide-border/60">
                  {result.h2h.matches.map((m, i) => {
                    const winner = m.ftr === "H" ? m.home : m.ftr === "A" ? m.away : null;
                    return (
                      <div key={i} className="flex items-center justify-between py-2 text-sm">
                        <span className="w-24 text-xs text-muted-foreground">
                          {new Date(m.date).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        <span className="flex-1 text-center">
                          <span className={winner === m.home ? "font-semibold" : ""}>
                            {m.home}
                          </span>{" "}
                          <span className="font-mono font-semibold">
                            {m.fthg}-{m.ftag}
                          </span>{" "}
                          <span className={winner === m.away ? "font-semibold" : ""}>
                            {m.away}
                          </span>
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
