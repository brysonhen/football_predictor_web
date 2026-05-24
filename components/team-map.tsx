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

// La Liga: mainland-Spain bounds only (Canary Islands excluded)
const REGIONS: Record<string, { lat: { min: number; max: number }; lng: { min: number; max: number } }> = {
  pl:         { lat: { min: 50.3, max: 55.3 }, lng: { min: -5.8, max:  3.8 } },
  laliga:     { lat: { min: 36.0, max: 43.9 }, lng: { min: -9.1, max:  3.2 } },
  bundesliga: { lat: { min: 47.5, max: 54.8 }, lng: { min:  4.8, max: 15.2 } },
  seriea:     { lat: { min: 38.5, max: 46.6 }, lng: { min:  6.5, max: 18.8 } },
  ligue1:     { lat: { min: 41.4, max: 51.2 }, lng: { min: -5.5, max:  9.5 } },
  europe:     { lat: { min: 36.5, max: 56.0 }, lng: { min: -9.5, max: 19.5 } },
};

// ISO-3166-1 alpha-3 codes used by DottedMap's countries filter
const LEAGUE_COUNTRY: Record<string, string> = {
  pl:         "GBR",
  laliga:     "ESP",
  bundesliga: "DEU",
  seriea:     "ITA",
  ligue1:     "FRA",
};

const ALL_TEAMS: Record<string, Record<string, TeamMeta>> = {
  pl:         plTeams         as Record<string, TeamMeta>,
  laliga:     laligaTeams     as Record<string, TeamMeta>,
  bundesliga: bundesligaTeams as Record<string, TeamMeta>,
  seriea:     serieaTeams     as Record<string, TeamMeta>,
  ligue1:     ligue1Teams     as Record<string, TeamMeta>,
};

const LEAGUE_NAMES: Record<string, string> = {
  pl:         "Premier League",
  laliga:     "La Liga",
  bundesliga: "Bundesliga",
  seriea:     "Serie A",
  ligue1:     "Ligue 1",
};

type Point = { x: number; y: number };
type Pin   = { team: TeamMeta; leagueId: string; x: number; y: number };

// ─── Dot path builder ────────────────────────────────────────────────────────
// Collapses N dots into a single SVG path — huge DOM reduction vs <circle> per dot.
function buildPath(points: Point[], r: number): string {
  return points
    .map(({ x, y }) => `M${x - r},${y}a${r},${r},0,1,0,${r * 2},0a${r},${r},0,1,0,${-r * 2},0`)
    .join("");
}

// ─── Lazy map cache ──────────────────────────────────────────────────────────
// Everything is computed on first access and stored; nothing runs at import time.

interface LeagueCacheEntry {
  map:         DottedMap;
  bgPath:      string;   // all dots in the league's region (faint background)
  countryPath: string;   // dots inside the country only (highlighted land mass)
  pins:        Pin[];
}

const _leagueCache: Partial<Record<string, LeagueCacheEntry>> = {};

function getLeagueCache(leagueId: string): LeagueCacheEntry {
  const cached = _leagueCache[leagueId];
  if (cached) return cached;

  const region  = REGIONS[leagueId];
  const country = LEAGUE_COUNTRY[leagueId];

  const map         = new DottedMap({ height: 65, grid: "diagonal", region });
  const countryMap  = new DottedMap({ height: 65, grid: "diagonal", region, countries: [country] });

  const bgPath      = buildPath(map.getPoints(), 0.2);
  const countryPath = buildPath(countryMap.getPoints(), 0.2);

  const teams = Object.values(ALL_TEAMS[leagueId] ?? {});
  const pins: Pin[] = teams
    .map((team) => {
      if (team.lat == null || team.lng == null) return null;
      const pin = map.getPin({ lat: team.lat, lng: team.lng });
      return pin ? { team, leagueId, x: pin.x, y: pin.y } : null;
    })
    .filter((p): p is Pin => p !== null);

  const entry: LeagueCacheEntry = { map, bgPath, countryPath, pins };
  _leagueCache[leagueId] = entry;
  return entry;
}

// ─── Europe cache ─────────────────────────────────────────────────────────────

interface EuropeCacheEntry {
  map:          DottedMap;
  bgPath:       string;                    // all-Europe background dots
  countryPaths: Record<string, string>;   // per-league country dots
  pins:         Pin[];                     // all 142 team pins
}

let _europeCache: EuropeCacheEntry | null = null;

function getEuropeCache(): EuropeCacheEntry {
  if (_europeCache) return _europeCache;

  const region = REGIONS.europe;
  const map    = new DottedMap({ height: 65, grid: "diagonal", region });
  const bgPath = buildPath(map.getPoints(), 0.18);

  const countryPaths: Record<string, string> = {};
  for (const [leagueId, countryCode] of Object.entries(LEAGUE_COUNTRY)) {
    const cm = new DottedMap({ height: 65, grid: "diagonal", region, countries: [countryCode] });
    countryPaths[leagueId] = buildPath(cm.getPoints(), 0.18);
  }

  const pins: Pin[] = [];
  for (const leagueId of Object.keys(ALL_TEAMS)) {
    for (const team of Object.values(ALL_TEAMS[leagueId])) {
      if (team.lat == null || team.lng == null) continue;
      const pin = map.getPin({ lat: team.lat, lng: team.lng });
      if (pin) pins.push({ team, leagueId, x: pin.x, y: pin.y });
    }
  }

  _europeCache = { map, bgPath, countryPaths, pins };
  return _europeCache;
}

// ─── ViewBox ─────────────────────────────────────────────────────────────────

function computeViewBox(bgPoints: Point[], extraPts: Point[], targetRatio: number) {
  const all = [...bgPoints, ...extraPts];
  const PAD = 1.5;
  let minX = Math.min(...all.map((p) => p.x)) - PAD;
  let minY = Math.min(...all.map((p) => p.y)) - PAD;
  let VW   = Math.max(...all.map((p) => p.x)) + PAD - minX;
  let VH   = Math.max(...all.map((p) => p.y)) + PAD - minY;

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

// ─── Component ───────────────────────────────────────────────────────────────

interface TeamMapProps {
  league?: string;
  homeTeam?: string | null;
  awayTeam?: string | null;
  onTeamClick?: (teamName: string, leagueId?: string) => void;
  onLeagueClick?: (leagueId: string) => void;
  interactive?: boolean;
}

export function TeamMap({
  league = "europe",
  homeTeam = null,
  awayTeam = null,
  onTeamClick,
  onLeagueClick,
  interactive = false,
}: TeamMapProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const isEurope = league === "europe";

  // ── Build or retrieve cached data ─────────────────────────────────────────
  const { bgPath, overlayPaths, pins, rawPoints } = useMemo(() => {
    if (isEurope) {
      const c = getEuropeCache();
      return {
        bgPath:       c.bgPath,
        overlayPaths: Object.values(c.countryPaths), // 5 paths, one per country
        pins:         c.pins,
        rawPoints:    c.map.getPoints(),
      };
    }
    const c = getLeagueCache(league);
    return {
      bgPath:       c.bgPath,
      overlayPaths: [c.countryPath],
      pins:         c.pins,
      rawPoints:    c.map.getPoints(),
    };
  }, [league, isEurope]);

  const targetRatio = isEurope ? 5 / 4 : 4 / 3;
  const { minX, minY, VW, VH } = useMemo(
    () => computeViewBox(rawPoints, pins, targetRatio),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [league]
  );

  function toPercent(x: number, y: number) {
    return { left: ((x - minX) / VW) * 100, top: ((y - minY) / VH) * 100 };
  }

  // League view logos are larger — they're the focus of the map.
  const PIN_SIZE = isEurope ? 14 : 28;

  const hoveredPin = hovered ? pins.find((p) => p.team.name === hovered) ?? null : null;

  function handleClick(pin: Pin) {
    if (!interactive) return;
    if (isEurope) {
      onLeagueClick?.(pin.leagueId);
    } else {
      onTeamClick?.(pin.team.name);
    }
  }

  return (
    <div className="relative w-full select-none">
      {/* Dot background — two layers: faint all-region + brighter country shape */}
      <svg viewBox={`${minX} ${minY} ${VW} ${VH}`} className="w-full h-auto" aria-hidden="true">
        {/* Faint ocean / non-country dots */}
        <path d={bgPath} fill="rgba(148,163,184,0.07)" />
        {/* Country highlight dots — same grid, visually creates country shape */}
        {overlayPaths.map((path, i) => (
          <path key={i} d={path} fill="rgba(148,163,184,0.30)" />
        ))}
      </svg>

      {/* Team pins */}
      {pins.map((pin) => {
        const pos      = toPercent(pin.x, pin.y);
        const isHome   = pin.team.name === homeTeam;
        const isAway   = pin.team.name === awayTeam;
        const isSelected = isHome || isAway;
        const isHov    = hovered === pin.team.name;
        const anySelected = !!(homeTeam || awayTeam);
        const dimmed   = anySelected && !isSelected && !isHov;
        const src      = teamLogoSrc(pin.team);

        return (
          <div
            key={`${pin.leagueId}-${pin.team.name}`}
            className={`absolute -translate-x-1/2 -translate-y-1/2 ${interactive ? "cursor-pointer" : "cursor-default"}`}
            style={{
              left: `${pos.left}%`,
              top:  `${pos.top}%`,
              zIndex: isSelected ? 30 : isHov ? 20 : 10,
              opacity: dimmed ? 0.35 : 1,
              transition: "opacity 0.15s",
            }}
            onMouseEnter={() => setHovered(pin.team.name)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => handleClick(pin)}
          >
            {/* Invisible hit area — larger than logo for easier clicking */}
            <div className="flex items-center justify-center" style={{ width: PIN_SIZE + 14, height: PIN_SIZE + 14 }}>
              <div
                className={`flex items-center justify-center rounded-full transition-all duration-150 ${
                  isHome
                    ? "ring-[3px] ring-emerald-500 ring-offset-2 ring-offset-background bg-card shadow-lg"
                    : isAway
                    ? "ring-[3px] ring-orange-500 ring-offset-2 ring-offset-background bg-card shadow-lg"
                    : isHov
                    ? "ring-2 ring-primary/60 ring-offset-1 ring-offset-background bg-card shadow-md"
                    : "bg-card/80 shadow-sm"
                }`}
                style={{
                  width:   PIN_SIZE + 8,
                  height:  PIN_SIZE + 8,
                  padding: 3,
                  transform: isSelected ? "scale(1.3)" : isHov ? "scale(1.15)" : undefined,
                }}
              >
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt={pin.team.name}
                    width={PIN_SIZE}
                    height={PIN_SIZE}
                    style={{ width: PIN_SIZE, height: PIN_SIZE }}
                    className="object-contain"
                    loading="lazy"
                  />
                ) : (
                  <span
                    className="flex items-center justify-center rounded-full bg-primary/15 text-[8px] font-bold text-primary"
                    style={{ width: PIN_SIZE, height: PIN_SIZE }}
                  >
                    {pin.team.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            {/* HOME / AWAY badge below selected pins */}
            {isSelected && (
              <div
                className={`absolute top-full left-1/2 mt-0.5 -translate-x-1/2 rounded px-1.5 py-px text-[8px] font-bold text-white whitespace-nowrap ${
                  isHome ? "bg-emerald-500" : "bg-orange-500"
                }`}
              >
                {isHome ? "HOME" : "AWAY"}
              </div>
            )}
          </div>
        );
      })}

      {/* Bottom info bar — replaces floating tooltip; never overlaps pins */}
      <div
        className={`absolute bottom-0 left-0 right-0 flex items-center gap-3 rounded-b-lg border-t border-border/30 bg-background/90 px-4 py-2 backdrop-blur transition-opacity duration-150 ${
          hoveredPin ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{ zIndex: 50 }}
      >
        {hoveredPin && (() => {
          const src    = teamLogoSrc(hoveredPin.team);
          const isHome = hoveredPin.team.name === homeTeam;
          const isAway = hoveredPin.team.name === awayTeam;
          return (
            <>
              {src && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt={hoveredPin.team.name}
                  width={28}
                  height={28}
                  className="object-contain flex-shrink-0"
                  loading="lazy"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-foreground truncate">{hoveredPin.team.name}</span>
                  {(isHome || isAway) && (
                    <span
                      className={`shrink-0 rounded px-1.5 py-px text-[9px] font-bold text-white ${
                        isHome ? "bg-emerald-500" : "bg-orange-500"
                      }`}
                    >
                      {isHome ? "HOME" : "AWAY"}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {[
                    hoveredPin.team.stadium,
                    hoveredPin.team.city,
                    isEurope ? LEAGUE_NAMES[hoveredPin.leagueId] : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              {interactive && (
                <span className="shrink-0 text-xs text-primary/70">
                  {isEurope
                    ? `Click → ${LEAGUE_NAMES[hoveredPin.leagueId] ?? hoveredPin.leagueId}`
                    : isHome || isAway
                    ? "Click to deselect"
                    : homeTeam === null
                    ? "Click → Home"
                    : "Click → Away"}
                </span>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}
