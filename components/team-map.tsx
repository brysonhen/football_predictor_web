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

// Tighter per-league bounding boxes based on actual team locations.
// "europe" covers all 5 countries; Las Palmas excluded from the europe bound
// (still visible on the laliga map which uses lat 27.8 min).
const REGIONS: Record<string, { lat: { min: number; max: number }; lng: { min: number; max: number } }> = {
  pl:         { lat: { min: 50.5,  max: 55.2  }, lng: { min: -3.3,  max:  1.6  } },
  laliga:     { lat: { min: 27.8,  max: 43.7  }, lng: { min: -9.3,  max:  3.2  } },
  bundesliga: { lat: { min: 47.7,  max: 54.6  }, lng: { min:  6.0,  max: 14.0  } },
  seriea:     { lat: { min: 38.8,  max: 46.4  }, lng: { min:  7.3,  max: 18.5  } },
  ligue1:     { lat: { min: 41.6,  max: 50.9  }, lng: { min: -4.8,  max:  9.0  } },
  europe:     { lat: { min: 36.2,  max: 55.5  }, lng: { min: -9.8,  max: 18.8  } },
};

const ALL_TEAMS: Record<string, Record<string, TeamMeta>> = {
  pl:         plTeams         as Record<string, TeamMeta>,
  laliga:     laligaTeams     as Record<string, TeamMeta>,
  bundesliga: bundesligaTeams as Record<string, TeamMeta>,
  seriea:     serieaTeams     as Record<string, TeamMeta>,
  ligue1:     ligue1Teams     as Record<string, TeamMeta>,
};

// League accent colours for europe view pins
const LEAGUE_COLORS: Record<string, string> = {
  pl:         "#38003c",  // Premier League purple
  laliga:     "#ee8100",  // La Liga orange
  bundesliga: "#d20515",  // Bundesliga red
  seriea:     "#1e4694",  // Serie A blue
  ligue1:     "#091c3e",  // Ligue 1 navy
};

// Pre-compute one DottedMap per region at module load time.
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
    // Combine all leagues, tagging each pin with its league for colouring
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

// Pre-compute all pin sets (including europe).
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

export function TeamMap({ league = "europe" }: { league?: string }) {
  const [hovered, setHovered] = useState<Pin | null>(null);

  const key = LEAGUE_PINS[league] ? league : "europe";
  const { pins, bgPoints } = LEAGUE_PINS[key];
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

  const isEurope = key === "europe";

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

      {pins.map((pin, idx) => {
        const pos = toPercent(pin);
        const active = hovered?.team.name === pin.team.name;
        const src = teamLogoSrc(pin.team);
        const accentColor = pin.league ? LEAGUE_COLORS[pin.league] : undefined;
        // Europe view: smaller pins to avoid crowding
        const size = isEurope ? 11 : 14;
        return (
          <div
            key={`${pin.team.name}-${idx}`}
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
              style={isEurope && accentColor && !active ? { borderBottom: `2px solid ${accentColor}` } : undefined}
            >
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt={pin.team.name}
                  width={size}
                  height={size}
                  style={{ width: size, height: size }}
                  className="object-contain"
                  loading="lazy"
                />
              ) : (
                <span
                  className="flex items-center justify-center rounded-full bg-primary/20 text-[6px] font-bold text-primary"
                  style={{ width: size, height: size }}
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
            {hovered.team.city && (
              <div className="text-muted-foreground whitespace-nowrap">{hovered.team.city}</div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
