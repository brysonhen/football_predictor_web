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

// Geographic bounds — tuned to actual team locations.
// Widened longitude ranges so PL/Bundesliga appear squarer (more sea is fine).
const REGIONS: Record<string, { lat: { min: number; max: number }; lng: { min: number; max: number } }> = {
  pl:         { lat: { min: 50.3,  max: 55.3  }, lng: { min: -5.8,  max:  3.8  } },
  laliga:     { lat: { min: 27.6,  max: 44.0  }, lng: { min: -9.8,  max:  4.2  } },
  bundesliga: { lat: { min: 47.5,  max: 54.8  }, lng: { min:  4.8,  max: 15.2  } },
  seriea:     { lat: { min: 38.5,  max: 46.6  }, lng: { min:  6.5,  max: 18.8  } },
  ligue1:     { lat: { min: 41.4,  max: 51.2  }, lng: { min: -5.5,  max:  9.5  } },
  europe:     { lat: { min: 35.5,  max: 56.0  }, lng: { min: -10.5, max: 19.5  } },
};

const ALL_TEAMS: Record<string, Record<string, TeamMeta>> = {
  pl:         plTeams         as Record<string, TeamMeta>,
  laliga:     laligaTeams     as Record<string, TeamMeta>,
  bundesliga: bundesligaTeams as Record<string, TeamMeta>,
  seriea:     serieaTeams     as Record<string, TeamMeta>,
  ligue1:     ligue1Teams     as Record<string, TeamMeta>,
};

const LEAGUE_COLORS: Record<string, string> = {
  pl:         "#7c3aed",
  laliga:     "#ea580c",
  bundesliga: "#dc2626",
  seriea:     "#2563eb",
  ligue1:     "#0f172a",
};

// Pre-compute one DottedMap per region.
const MAPS: Record<string, DottedMap> = Object.fromEntries(
  Object.entries(REGIONS).map(([id, region]) => [
    id,
    new DottedMap({ height: 90, grid: "diagonal", region }),
  ])
);

type Pin = { team: TeamMeta; x: number; y: number; league?: string };

function buildPins(league: string): { pins: Pin[]; bgPoints: { x: number; y: number }[] } {
  const map = MAPS[league];
  const bgPoints = map.getPoints();

  if (league === "europe") {
    const pins: Pin[] = [];
    for (const lid of ["pl", "laliga", "bundesliga", "seriea", "ligue1"]) {
      for (const team of Object.values(ALL_TEAMS[lid])) {
        if (team.lat == null || team.lng == null) continue;
        const pin = map.getPin({ lat: team.lat, lng: team.lng });
        if (pin) pins.push({ team, x: pin.x, y: pin.y, league: lid });
      }
    }
    return { pins, bgPoints };
  }

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

const LEAGUE_PINS: Record<string, ReturnType<typeof buildPins>> = Object.fromEntries(
  Object.keys(REGIONS).map((id) => [id, buildPins(id)])
);

/** Normalise an SVG coordinate space to a target aspect ratio by padding. */
function computeViewBox(
  bgPoints: { x: number; y: number }[],
  pins: Pin[],
  targetRatio = 4 / 3,
) {
  const allX = [...bgPoints.map((p) => p.x), ...pins.map((p) => p.x)];
  const allY = [...bgPoints.map((p) => p.y), ...pins.map((p) => p.y)];
  const PAD = 1.5;
  let minX = Math.min(...allX) - PAD;
  let minY = Math.min(...allY) - PAD;
  let VW = Math.max(...allX) + PAD - minX;
  let VH = Math.max(...allY) + PAD - minY;

  const ratio = VW / VH;
  if (ratio < targetRatio) {
    const extra = (VH * targetRatio - VW) / 2;
    minX -= extra;
    VW = VH * targetRatio;
  } else {
    const extra = (VW / targetRatio - VH) / 2;
    minY -= extra;
    VH = VW / targetRatio;
  }
  return { minX, minY, VW, VH };
}

interface TeamMapProps {
  league?: string;
  homeTeam?: string | null;
  awayTeam?: string | null;
  onTeamClick?: (teamName: string, leagueId?: string) => void;
  interactive?: boolean;
}

export function TeamMap({
  league = "europe",
  homeTeam = null,
  awayTeam = null,
  onTeamClick,
  interactive = false,
}: TeamMapProps) {
  const [hovered, setHovered] = useState<Pin | null>(null);

  const key = LEAGUE_PINS[league] ? league : "europe";
  const { pins, bgPoints } = LEAGUE_PINS[key];
  const isEurope = key === "europe";
  // Europe overview: 5:4 ratio (a bit wider); league views: 4:3
  const targetRatio = isEurope ? 5 / 4 : 4 / 3;

  const { minX, minY, VW, VH } = useMemo(
    () => computeViewBox(bgPoints, pins, targetRatio),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]
  );

  function toPercent(pin: Pick<Pin, "x" | "y">) {
    return {
      left: ((pin.x - minX) / VW) * 100,
      top:  ((pin.y - minY) / VH) * 100,
    };
  }

  function pinRole(name: string) {
    if (name === homeTeam) return "home";
    if (name === awayTeam) return "away";
    return null;
  }

  const pinSize = isEurope ? 10 : 15;

  return (
    <div className="relative w-full select-none">
      <svg
        viewBox={`${minX} ${minY} ${VW} ${VH}`}
        className="w-full h-auto"
        aria-hidden="true"
      >
        {bgPoints.map((pt, i) => (
          <circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r={0.24}
            className="fill-muted-foreground/20"
          />
        ))}
      </svg>

      {pins.map((pin, idx) => {
        const pos = toPercent(pin);
        const role = pinRole(pin.team.name);
        const isHovered = hovered?.team.name === pin.team.name;
        const isSelected = role !== null;
        const src = teamLogoSrc(pin.team);
        const accentColor = pin.league ? LEAGUE_COLORS[pin.league] : undefined;
        const otherSelected = (homeTeam || awayTeam) && !isSelected && interactive;

        return (
          <div
            key={`${pin.team.name}-${idx}`}
            className={`absolute -translate-x-1/2 -translate-y-1/2 ${
              interactive ? "cursor-pointer" : "cursor-default"
            }`}
            style={{
              left: `${pos.left}%`,
              top: `${pos.top}%`,
              zIndex: isSelected ? 30 : isHovered ? 20 : 10,
              opacity: otherSelected ? 0.55 : 1,
              transition: "opacity 0.15s",
            }}
            onMouseEnter={() => setHovered(pin)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => {
              if (!interactive) return;
              onTeamClick?.(pin.team.name, pin.league);
            }}
          >
            <div
              className={`flex items-center justify-center rounded-full transition-all duration-150 ${
                role === "home"
                  ? "scale-[1.9] ring-2 ring-emerald-500 ring-offset-1 ring-offset-background bg-card shadow-lg p-[2px]"
                  : role === "away"
                  ? "scale-[1.9] ring-2 ring-orange-500 ring-offset-1 ring-offset-background bg-card shadow-lg p-[2px]"
                  : isHovered
                  ? "scale-[1.5] bg-card shadow-md p-[2px]"
                  : "bg-card/85 p-[2px] shadow-sm"
              }`}
              style={
                isEurope && accentColor && !isSelected && !isHovered
                  ? { borderBottom: `2px solid ${accentColor}` }
                  : undefined
              }
            >
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt={pin.team.name}
                  width={pinSize}
                  height={pinSize}
                  style={{ width: pinSize, height: pinSize }}
                  className="object-contain"
                  loading="lazy"
                />
              ) : (
                <span
                  className="flex items-center justify-center rounded-full bg-primary/15 text-[6px] font-bold text-primary"
                  style={{ width: pinSize, height: pinSize }}
                >
                  {pin.team.name.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>

            {/* Role badge */}
            {role && (
              <div
                className={`absolute -bottom-3.5 left-1/2 -translate-x-1/2 rounded-sm px-1 text-[7px] font-bold leading-tight text-white whitespace-nowrap ${
                  role === "home" ? "bg-emerald-500" : "bg-orange-500"
                }`}
              >
                {role.toUpperCase()}
              </div>
            )}
          </div>
        );
      })}

      {/* Tooltip */}
      {hovered && (() => {
        const pos = toPercent(hovered);
        const nearTop = pos.top < 18;
        const nearRight = pos.left > 80;
        return (
          <div
            className="pointer-events-none absolute z-40 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-xl"
            style={{
              left: nearRight ? "auto" : `${pos.left}%`,
              right: nearRight ? `${100 - pos.left}%` : "auto",
              transform: nearRight ? "none" : "translateX(-50%)",
              ...(nearTop
                ? { top: `calc(${pos.top}% + 24px)` }
                : { top: `calc(${pos.top}% - 46px)` }),
            }}
          >
            <div className="font-semibold text-foreground whitespace-nowrap">{hovered.team.name}</div>
            {hovered.team.stadium && (
              <div className="text-muted-foreground whitespace-nowrap">{hovered.team.stadium}</div>
            )}
            {hovered.team.city && (
              <div className="text-muted-foreground whitespace-nowrap">{hovered.team.city}</div>
            )}
            {interactive && (
              <div className="mt-1 text-primary/80 whitespace-nowrap">
                {hovered.team.name === homeTeam
                  ? "← Click to deselect"
                  : hovered.team.name === awayTeam
                  ? "← Click to deselect"
                  : homeTeam === null
                  ? "Click to set as Home"
                  : "Click to set as Away"}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
