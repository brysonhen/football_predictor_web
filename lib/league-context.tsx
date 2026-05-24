"use client";

import { createContext, useContext, useState, useCallback } from "react";

export type ViewMode = "europe" | "league";

interface LeagueContextValue {
  league: string;
  viewMode: ViewMode;
  homeTeam: string | null;
  awayTeam: string | null;
  selectLeague: (id: string) => void;
  /** Toggle-style: first click = home, second = away, clicking selected = deselect */
  selectTeam: (name: string) => void;
  /** Direct setters for dropdowns */
  setHomeTeam: (name: string | null) => void;
  setAwayTeam: (name: string | null) => void;
  swapTeams: () => void;
  reset: () => void;
}

export const LeagueContext = createContext<LeagueContextValue>({
  league: "pl",
  viewMode: "europe",
  homeTeam: null,
  awayTeam: null,
  selectLeague: () => {},
  selectTeam: () => {},
  setHomeTeam: () => {},
  setAwayTeam: () => {},
  swapTeams: () => {},
  reset: () => {},
});

interface Selection { home: string | null; away: string | null }

export function LeagueProvider({ children }: { children: React.ReactNode }) {
  const [league, setLeague] = useState("pl");
  const [viewMode, setViewMode] = useState<ViewMode>("europe");
  const [sel, setSel] = useState<Selection>({ home: null, away: null });

  const selectLeague = useCallback((id: string) => {
    setLeague(id);
    setViewMode("league");
    setSel({ home: null, away: null });
  }, []);

  const selectTeam = useCallback((name: string) => {
    setSel((prev) => {
      // Clicking the home team again → deselect everything
      if (prev.home === name) return { home: null, away: null };
      // Clicking the away team again → clear away only
      if (prev.away === name) return { ...prev, away: null };
      // No home set → set as home
      if (prev.home === null) return { home: name, away: null };
      // Home set, no away → set as away
      if (prev.away === null) return { ...prev, away: name };
      // Both set → replace away with new pick
      return { ...prev, away: name };
    });
  }, []);

  const swapTeams = useCallback(() => {
    setSel((prev) => ({ home: prev.away, away: prev.home }));
  }, []);

  const reset = useCallback(() => {
    setViewMode("europe");
    setSel({ home: null, away: null });
  }, []);

  const setHomeTeam = useCallback((name: string | null) => {
    setSel((prev) => ({ ...prev, home: name }));
  }, []);

  const setAwayTeam = useCallback((name: string | null) => {
    setSel((prev) => ({ ...prev, away: name }));
  }, []);

  return (
    <LeagueContext.Provider
      value={{
        league,
        viewMode,
        homeTeam: sel.home,
        awayTeam: sel.away,
        selectLeague,
        selectTeam,
        setHomeTeam,
        setAwayTeam,
        swapTeams,
        reset,
      }}
    >
      {children}
    </LeagueContext.Provider>
  );
}

export function useLeague() {
  return useContext(LeagueContext);
}
