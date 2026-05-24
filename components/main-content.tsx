"use client";

import { Code, Home, Target } from "lucide-react";
import { LeagueProvider } from "@/lib/league-context";
import { MapPredictor } from "@/components/map-predictor";
import { FeaturedSection } from "@/components/featured-section";
import { useLeague } from "@/lib/league-context";

function NavBar({ githubUrl }: { githubUrl: string }) {
  const { reset } = useLeague();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2.5 font-semibold transition-colors hover:text-primary"
            title="Back to Europe overview"
          >
            <Home className="h-4 w-4 text-primary" />
            <Target className="h-5 w-5 text-primary" />
            <span>Matchup Predictor</span>
          </button>
        </div>
        <a
          href={githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <Code className="h-4 w-4" />
          <span className="hidden sm:inline">Source</span>
        </a>
      </div>
    </header>
  );
}

function AppContent({ githubUrl }: { githubUrl: string }) {
  return (
    <>
      <NavBar githubUrl={githubUrl} />
      <main className="flex-1">
        <MapPredictor />
        <FeaturedSection />
      </main>
    </>
  );
}

export function MainContent({ githubUrl }: { githubUrl: string }) {
  return (
    <LeagueProvider>
      <AppContent githubUrl={githubUrl} />
    </LeagueProvider>
  );
}
