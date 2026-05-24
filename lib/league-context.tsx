"use client";

import { createContext, useContext, useState } from "react";

interface LeagueContextValue {
  league: string;
  setLeague: (league: string) => void;
}

export const LeagueContext = createContext<LeagueContextValue>({
  league: "pl",
  setLeague: () => {},
});

export function LeagueProvider({ children }: { children: React.ReactNode }) {
  const [league, setLeague] = useState("pl");
  return (
    <LeagueContext.Provider value={{ league, setLeague }}>
      {children}
    </LeagueContext.Provider>
  );
}

export function useLeague() {
  return useContext(LeagueContext);
}
