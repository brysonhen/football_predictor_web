"use client";

import { useState, useMemo } from "react";
import DottedMap from "dotted-map";
import { teamLogoSrc } from "@/lib/types";
import type { TeamMeta } from "@/lib/types";

import plTeams from "@/data/pl/teams.json";
import laligaTeams from "@/data/laliga/teams.json";
import bundesligaTeams from "@/data/bundesliga/teams.json";
import serieaTeams from "@/data/seriea/teams.json";
import ligue1Teams from "@/data/ligue1/teams.json";

const REGIONS: Record<string, { lat: { min: number; max: number }; lng: { min: number; max: number } }> = {
  pl:         { lat: { min: 49.9, max: 55.9 }, lng: { min: -5.8, max:  2.0 } },
  laliga:     { lat: { min: 27.6, max: 44.1 }, lng: { min: -9.5, max:  4.5 } },
  bundesliga: { lat: { min: 47.2, max: 55.1 }, lng: { min:  5.8, max: 15.1 } },
  seriea:     { lat: { min: 37.5, max: 47.1 }, lng: { min:  6.5, max: 18.6 } },
  ligue1:     { lat: { min: 42.3, max: 51.2 }, lng: { min: -4.8, max:  8.3 } },
};

const ALL_TEAMS: Record<string, Record<string, TeamMeta>> = {
  pl:         plTeams         as Record<string, TeamMeta>,
  laliga:     laligaTeams     as Record<string, TeamMeta>,
  bundesliga: bundesligaTeams as Record<string, TeamMeta>,
  seriea:     serieaTeams     as Record<string, TeamMeta>,
  ligue1:     ligue1Teams     as Record<string, TeamMeta>,
};

// Pre-compute one DottedMap per league at module load time (lightweight).
const MAPS: Record<string, DottedMap> = Object.fromEntries(
  Object.entries(REGIONS).map(([id, region]) => [
    id,
    new DottedMap({ height: 90, grid: "diagonal", region }),
  ])
);

type Pin = { team: TeamMeta; x: number; y: number };

function buildPins(league: string): { pins: Pin[]; bgPoints: { x: number; y: number }[] } {
  const map = MAPS[league];
  const bgPoints = map.getPoints();
  const teams = Object.values(ALL_TEAMS[league]);
  const pins: Pin[] = teams
    .map((team) => {
      if (team.lat == null || team.lng == null) return null;
      const pin = map.getPin({ lat: team.lat, lng: team.lng });
      return pin ? { team, x: pin.x, y: pin.y } : null;
    })
    .filter((p): p is Pin => p !== null);
  return { pins, bgPoints };
}

// Pre-compute per-league pin sets.
const LEAGUE_PINS: Record<string, ReturnType<typeof buildPins>> = Object.fromEntries(
  Object.keys(REGIONS).map((id) => [id, buildPins(id)])
);

function viewBox(bgPoints: { x: number; y: number }[], pins: Pin[]) {
  const allX = [...bgPoints.map((p) => p.x), ...pins.map((p) => p.x)];
  const allY = [...bgPoints.map((p) => p.y), ...pins.map((p) => p.y)];
  const PAD = 2;
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);
  return { minX, maxX, minY, maxY, PAD, VW: maxX - minX + PAD * 2, VH: maxY - minY + PAD * 2 };
}

export function TeamMap({ league = "pl" }: { league?: string }) {
  const [hovered, setHovered] = useState<Pin | null>(null);

  const { pins, bgPoints } = LEAGUE_PINS[league] ?? LEAGUE_PINS.pl;
  const { minX, minY, PAD, VW, VH } = useMemo(
    () => viewBox(bgPoints, pins),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [league]
  );

  function toPercent(pin: Pin) {
    return {
      left: ((pin.x - (minX - PAD)) / VW) * 100,
      top:  ((pin.y - (minY - PAD)) / VH) * 100,
    };
  }

  return (
    <div className="relative w-full select-none">
      <svg
        viewBox={`${minX - PAD} ${minY - PAD} ${VW} ${VH}`}
        className="w-full h-auto"
        aria-hidden="true"
      >
        {bgPoints.map((point, i) => (
          <circle
            key={i}
            cx={point.x}
            cy={point.y}
            r={0.26}
            className="fill-muted-foreground/18"
          />
        ))}
      </svg>

      {pins.map((pin) => {
        const pos = toPercent(pin);
        const active = hovered?.team.name === pin.team.name;
        const src = teamLogoSrc(pin.team);
        return (
          <div
            key={pin.team.name}
            className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer"
            style={{ left: `${pos.left}%`, top: `${pos.top}%`, zIndex: active ? 20 : 10 }}
            onMouseEnter={() => setHovered(pin)}
            onMouseLeave={() => setHovered(null)}
          >
            <div
              className={`flex items-center justify-center rounded-full transition-all duration-150 ${
                active
                  ? "scale-[1.7] ring-1 ring-primary ring-offset-1 ring-offset-card bg-card/95 shadow-lg p-[3px]"
                  : "bg-card/80 p-[2px] shadow hover:scale-125 hover:bg-card"
              }`}
            >
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt={pin.team.name}
                  width={14}
                  height={14}
                  style={{ width: 14, height: 14 }}
                  className="object-contain"
                  loading="lazy"
                />
              ) : (
                <span
                  className="flex items-center justify-center rounded-full bg-primary/20 text-[6px] font-bold text-primary"
                  style={{ width: 14, height: 14 }}
                >
                  {pin.team.name.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
          </div>
        );
      })}

      {hovered && (() => {
        const pos = toPercent(hovered);
        const nearTop = pos.top < 18;
        return (
          <div
            className="pointer-events-none absolute z-30 -translate-x-1/2 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-lg"
            style={{
              left: `${pos.left}%`,
              ...(nearTop
                ? { top: `calc(${pos.top}% + 22px)` }
                : { top: `calc(${pos.top}% - 38px)` }),
            }}
          >
            <div className="font-semibold text-foreground whitespace-nowrap">{hovered.team.name}</div>
            {hovered.team.stadium && (
              <div className="text-muted-foreground whitespace-nowrap">{hovered.team.stadium}</div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
