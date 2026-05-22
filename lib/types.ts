export type Outcome = "H" | "D" | "A";

export interface TeamMeta {
  name: string;
  lat: number;
  lng: number;
  city: string;
  stadium: string;
  logoId: number;
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

/** PL official badge CDN. */
export function logoUrl(logoId: number): string {
  return `https://resources.premierleague.com/premierleague/badges/rb/t${logoId}.svg`;
}

/** "1920" -> "2019/20" */
export function formatSeason(code: string): string {
  return `20${code.slice(0, 2)}/${code.slice(2)}`;
}
