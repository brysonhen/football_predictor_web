"use client";

import { createContext, useContext, useState } from "react";

interface LeagueContextValue {
  league: string;
  setLeague: (league: string) => void;
  hasInteracted: boolean;
}

export const LeagueContext = createContext<LeagueContextValue>({
  league: "europe",
  setLeague: () => {},
  hasInteracted: false,
});

export function LeagueProvider({ children }: { children: React.ReactNode }) {
  const [league, setLeagueRaw] = useState("pl");
  const [hasInteracted, setHasInteracted] = useState(false);

  function setLeague(next: string) {
    setLeagueRaw(next);
    setHasInteracted(true);
  }

  return (
    <LeagueContext.Provider value={{ league, setLeague, hasInteracted }}>
      {children}
    </LeagueContext.Provider>
  );
}

export function useLeague() {
  return useContext(LeagueContext);
}
