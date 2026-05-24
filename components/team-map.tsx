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

// La Liga uses mainland-Spain bounds — Canary Islands (Las Palmas at 28°N) are excluded.
const REGIONS: Record<string, { lat: { min: number; max: number }; lng: { min: number; max: number } }> = {
  pl:         { lat: { min: 50.3, max: 55.3 }, lng: { min: -5.8, max:  3.8 } },
  laliga:     { lat: { min: 36.0, max: 43.9 }, lng: { min: -9.1, max:  3.2 } },
  bundesliga: { lat: { min: 47.5, max: 54.8 }, lng: { min:  4.8, max: 15.2 } },
  seriea:     { lat: { min: 38.5, max: 46.6 }, lng: { min:  6.5, max: 18.8 } },
  ligue1:     { lat: { min: 41.4, max: 51.2 }, lng: { min: -5.5, max:  9.5 } },
  europe:     { lat: { min: 36.5, max: 56.0 }, lng: { min: -9.5, max: 19.5 } },
};

const ALL_TEAMS: Record<string, Record<string, TeamMeta>> = {
  pl:         plTeams         as Record<string, TeamMeta>,
  laliga:     laligaTeams     as Record<string, TeamMeta>,
  bundesliga: bundesligaTeams as Record<string, TeamMeta>,
  seriea:     serieaTeams     as Record<string, TeamMeta>,
  ligue1:     ligue1Teams     as Record<string, TeamMeta>,
};

// League cards shown on the Europe overview map instead of individual pins.
// Clicking a card zooms into that league.
const LEAGUE_CARDS = [
  { id: "pl",         flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", name: "Premier League",  lat: 52.5,  lng: -1.5  },
  { id: "laliga",     flag: "🇪🇸", name: "La Liga",          lat: 40.4,  lng: -3.7  },
  { id: "bundesliga", flag: "🇩🇪", name: "Bundesliga",       lat: 51.2,  lng: 10.2  },
  { id: "seriea",     flag: "🇮🇹", name: "Serie A",          lat: 41.9,  lng: 12.5  },
  { id: "ligue1",     flag: "🇫🇷", name: "Ligue 1",          lat: 46.6,  lng:  2.3  },
];

type Point = { x: number; y: number };
type Pin   = { team: TeamMeta; x: number; y: number };

// ─── Lazy map cache ──────────────────────────────────────────────────────────
// Nothing is computed at module load. Each league's DottedMap is built once,
// the first time it is needed, then stored here.
const _mapCache:  Record<string, DottedMap> = {};
const _pinsCache: Record<string, { pins: Pin[]; bgPoints: Point[] }> = {};

function getLeagueData(league: string): { pins: Pin[]; bgPoints: Point[] } {
  if (_pinsCache[league]) return _pinsCache[league];

  // height: 65 → ~30 % fewer SVG dots than the old height: 90
  const map = new DottedMap({ height: 65, grid: "diagonal", region: REGIONS[league] });
  _mapCache[league] = map;

  const bgPoints = map.getPoints();
  const teams = Object.values(ALL_TEAMS[league] ?? {});
  const pins: Pin[] = teams
    .map((team) => {
      if (team.lat == null || team.lng == null) return null;
      const pin = map.getPin({ lat: team.lat, lng: team.lng });
      return pin ? { team, x: pin.x, y: pin.y } : null;
    })
    .filter((p): p is Pin => p !== null);

  _pinsCache[league] = { pins, bgPoints };
  return _pinsCache[league];
}

// Europe background dots only — no team pins at this level.
let _europePoints: Point[] | null = null;
function getEuropePoints(): Point[] {
  if (!_europePoints) {
    const map = new DottedMap({ height: 65, grid: "diagonal", region: REGIONS.europe });
    _europePoints = map.getPoints();
  }
  return _europePoints;
}

// ─── ViewBox ─────────────────────────────────────────────────────────────────
function computeViewBox(points: Point[], extraPts: Point[], targetRatio: number) {
  const all = [...points, ...extraPts];
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
  const [hovered, setHovered] = useState<string | null>(null); // team name
  const isEurope = league === "europe";

  // ── Lazy-compute only the active view ──────────────────────────────────────
  const { pins, bgPoints } = useMemo(() => {
    if (isEurope) return { pins: [], bgPoints: getEuropePoints() };
    return getLeagueData(league);
  }, [league, isEurope]);

  // ── League card positions on the Europe map ────────────────────────────────
  const leagueCardPositions = useMemo(() => {
    if (!isEurope) return [];
    const map = _mapCache.europe ?? (() => {
      const m = new DottedMap({ height: 65, grid: "diagonal", region: REGIONS.europe });
      _mapCache.europe = m;
      return m;
    })();
    return LEAGUE_CARDS.map((card) => {
      const pin = map.getPin({ lat: card.lat, lng: card.lng });
      return pin ? { ...card, x: pin.x, y: pin.y } : null;
    }).filter(Boolean) as (typeof LEAGUE_CARDS[0] & { x: number; y: number })[];
  }, [isEurope]);

  const targetRatio = isEurope ? 5 / 4 : 4 / 3;

  const { minX, minY, VW, VH } = useMemo(
    () => computeViewBox(bgPoints, pins, targetRatio),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [league]
  );

  function toPercent(x: number, y: number) {
    return { left: ((x - minX) / VW) * 100, top: ((y - minY) / VH) * 100 };
  }

  // 22 px logos — large enough to actually see and click
  const PIN_SIZE = 22;

  return (
    <div className="relative w-full select-none">
      {/* Dot background */}
      <svg viewBox={`${minX} ${minY} ${VW} ${VH}`} className="w-full h-auto" aria-hidden="true">
        {bgPoints.map((pt, i) => (
          <circle key={i} cx={pt.x} cy={pt.y} r={0.28} className="fill-muted-foreground/20" />
        ))}
      </svg>

      {/* ── Europe view: 5 large league cards ──────────────────────────────── */}
      {isEurope && leagueCardPositions.map((card) => {
        const pos = toPercent(card.x, card.y);
        const teamCount = Object.keys(ALL_TEAMS[card.id] ?? {}).length;
        return (
          <button
            key={card.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 group"
            style={{ left: `${pos.left}%`, top: `${pos.top}%`, zIndex: 20 }}
            onClick={() => onLeagueClick?.(card.id)}
          >
            <div className="flex flex-col items-center gap-1 rounded-xl border border-border/60 bg-card/95 px-3 py-2 shadow-md backdrop-blur transition-all duration-150 group-hover:border-primary/60 group-hover:shadow-lg group-hover:scale-105">
              <span className="text-xl leading-none">{card.flag}</span>
              <span className="text-[11px] font-semibold text-foreground leading-tight whitespace-nowrap">{card.name}</span>
              <span className="text-[9px] text-muted-foreground">{teamCount} clubs</span>
            </div>
          </button>
        );
      })}

      {/* ── League view: individual team pins ──────────────────────────────── */}
      {!isEurope && pins.map((pin) => {
        const pos = toPercent(pin.x, pin.y);
        const isHome = pin.team.name === homeTeam;
        const isAway = pin.team.name === awayTeam;
        const isSelected = isHome || isAway;
        const isHov = hovered === pin.team.name;
        const anySelected = !!(homeTeam || awayTeam);
        const dimmed = anySelected && !isSelected && !isHov;
        const src = teamLogoSrc(pin.team);

        return (
          <div
            key={pin.team.name}
            className={`absolute -translate-x-1/2 -translate-y-1/2 ${interactive ? "cursor-pointer" : "cursor-default"}`}
            style={{
              left: `${pos.left}%`,
              top:  `${pos.top}%`,
              zIndex: isSelected ? 30 : isHov ? 20 : 10,
              opacity: dimmed ? 0.45 : 1,
              transition: "opacity 0.15s, transform 0.1s",
            }}
            onMouseEnter={() => setHovered(pin.team.name)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => interactive && onTeamClick?.(pin.team.name)}
          >
            {/* Hit-area wrapper — larger than the visible circle for easier clicking */}
            <div className="flex items-center justify-center" style={{ width: PIN_SIZE + 14, height: PIN_SIZE + 14 }}>
              <div
                className={`flex items-center justify-center rounded-full transition-all duration-150 ${
                  isHome
                    ? "ring-[3px] ring-emerald-500 ring-offset-2 ring-offset-background bg-card shadow-lg"
                    : isAway
                    ? "ring-[3px] ring-orange-500 ring-offset-2 ring-offset-background bg-card shadow-lg"
                    : isHov
                    ? "ring-2 ring-primary/50 ring-offset-1 ring-offset-background bg-card shadow-md scale-110"
                    : "bg-card/90 shadow-sm hover:shadow-md"
                }`}
                style={{
                  width:   PIN_SIZE + 8,
                  height:  PIN_SIZE + 8,
                  padding: 3,
                  transform: isSelected ? "scale(1.25)" : undefined,
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

            {/* HOME / AWAY label under selected pins */}
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

      {/* Tooltip — league view only */}
      {!isEurope && hovered && (() => {
        const pin = pins.find((p) => p.team.name === hovered);
        if (!pin) return null;
        const pos = toPercent(pin.x, pin.y);
        const nearTop   = pos.top  < 20;
        const nearRight = pos.left > 78;
        const isHome = pin.team.name === homeTeam;
        const isAway = pin.team.name === awayTeam;
        return (
          <div
            className="pointer-events-none absolute z-40 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-xl"
            style={{
              left:      nearRight ? "auto" : `${pos.left}%`,
              right:     nearRight ? `${100 - pos.left}%` : "auto",
              transform: nearRight ? "none" : "translateX(-50%)",
              ...(nearTop
                ? { top: `calc(${pos.top}% + 30px)` }
                : { top: `calc(${pos.top}% - 52px)` }),
            }}
          >
            <div className="font-semibold text-foreground">{pin.team.name}</div>
            {pin.team.stadium && <div className="text-muted-foreground">{pin.team.stadium}</div>}
            {pin.team.city    && <div className="text-muted-foreground">{pin.team.city}</div>}
            {interactive && (
              <div className="mt-1 text-primary/80">
                {isHome || isAway
                  ? "Click to deselect"
                  : homeTeam === null
                  ? "Click → Home team"
                  : "Click → Away team"}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
