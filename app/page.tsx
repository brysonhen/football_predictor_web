import { Code, Target } from "lucide-react";
import { MainContent } from "@/components/main-content";

const GITHUB_URL = "https://github.com/brysonhen/football_matchup_predictor";

export default function Home() {
  return (
    <>
      <MainContent githubUrl={GITHUB_URL} />

      {/* Footer */}
      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <p>
            © {new Date().getFullYear()} Bryson Henderson · Match data from{" "}
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
            <span>PL · La Liga · Bundesliga · Serie A · Ligue 1</span>
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
