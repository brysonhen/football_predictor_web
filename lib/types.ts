export type Outcome = "H" | "D" | "A";

export interface League {
  id: string;
  name: string;
  country: string;
}

export interface TeamMeta {
  name: string;
  lat?: number;
  lng?: number;
  city?: string;
  stadium?: string;
  /** PL only: use with logoUrl() to build the CDN URL */
  logoId?: number;
  /** PL only: skip the /rb/ retina path for clubs missing the HiDPI badge */
  noRetina?: boolean;
  /** Non-PL leagues: direct logo URL (thesportsdb) */
  logoUrl?: string;
}

export interface TeamForm {
  ppg_l5: number;
  ppg_l10: number;
  gf_l5: number;
  ga_l5: number;
  rest_days: number;
  recent_form: string[];
}

export interface PredictionDriver {
  feature: string;
  impact: number;
  explanation: string;
}

export interface H2HMatch {
  date: string;
  home: string;
  away: string;
  fthg: number;
  ftag: number;
  ftr: Outcome;
}

export interface H2H {
  homeWins: number;
  draws: number;
  awayWins: number;
  matches: H2HMatch[];
}

export interface PredictionResult {
  home: string;
  away: string;
  probabilities: { home: number; draw: number; away: number };
  predicted: string;
  verdict: string;
  homeForm: TeamForm;
  awayForm: TeamForm;
  drivers: PredictionDriver[];
  h2h: H2H;
}

export interface MonthlyAccuracy {
  month: string;
  accuracy: number;
  matches: number;
}

export interface Meta {
  league: string;
  leagueName: string;
  country: string;
  lastMatchDate: string;
  trainSeasons: string[];
  testSeasons: string[];
  metrics: {
    dummy_log_loss: number;
    form_log_loss: number;
    model_log_loss: number;
    model_accuracy: number;
  };
  confusionMatrix: number[][];
  monthlyAccuracy: MonthlyAccuracy[];
  recentResults: H2HMatch[];
  totalMatches: number;
  teamCount: number;
}

/** PL official badge CDN. Pass noRetina=true for clubs without a high-DPI badge. */
export function logoUrl(logoId: number, noRetina = false): string {
  const path = noRetina ? "" : "rb/";
  return `https://resources.premierleague.com/premierleague/badges/${path}t${logoId}.svg`;
}

/** Resolve the best logo src for any team, regardless of league. */
export function teamLogoSrc(team: TeamMeta): string | null {
  if (team.logoUrl) return team.logoUrl;
  if (team.logoId) return logoUrl(team.logoId, team.noRetina);
  return null;
}

/** "1920" -> "2019/20" */
export function formatSeason(code: string): string {
  return `20${code.slice(0, 2)}/${code.slice(2)}`;
}
