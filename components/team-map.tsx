"use client";

import { useState, useMemo } from "react";
import { teamLogoSrc } from "@/lib/types";
import type { TeamMeta } from "@/lib/types";

import countryGeometry from "@/data/country-geometry.json";
import plTeams from "@/data/pl/teams.json";
import laligaTeams from "@/data/laliga/teams.json";
import bundesligaTeams from "@/data/bundesliga/teams.json";
import serieaTeams from "@/data/seriea/teams.json";
import ligue1Teams from "@/data/ligue1/teams.json";

// ─── Types ───────────────────────────────────────────────────────────────────
type Ring = [number, number][];
type GeoPolygon   = { type: "Polygon";      coordinates: Ring[] };
type GeoMultiPoly = { type: "MultiPolygon"; coordinates: Ring[][] };
type Geom = GeoPolygon | GeoMultiPoly;

interface ViewBounds {
  lngMin: number; lngMax: number;
  latMin: number; latMax: number;
}

interface Pin { team: TeamMeta; leagueId: string; sx: number; sy: number }

// ─── Data ────────────────────────────────────────────────────────────────────
const ALL_TEAMS: Record<string, Record<string, TeamMeta>> = {
  pl:         plTeams         as Record<string, TeamMeta>,
  laliga:     laligaTeams     as Record<string, TeamMeta>,
  bundesliga: bundesligaTeams as Record<string, TeamMeta>,
  seriea:     serieaTeams     as Record<string, TeamMeta>,
  ligue1:     ligue1Teams     as Record<string, TeamMeta>,
};

const LEAGUE_NAMES: Record<string, string> = {
  pl: "Premier League", laliga: "La Liga",
  bundesliga: "Bundesliga", seriea: "Serie A", ligue1: "Ligue 1",
};

const LEAGUE_COUNTRY: Record<string, string[]> = {
  pl:         ["GBR"],
  laliga:     ["ESP"],
  bundesliga: ["DEU"],
  seriea:     ["ITA"],
  ligue1:     ["FRA"],
  europe:     ["GBR", "FRA", "DEU", "ITA", "ESP"],
};

const EUROPE_BOUNDS: ViewBounds = { lngMin: -11, lngMax: 22, latMin: 34.5, latMax: 59 };
const LEAGUE_BOUNDS: Record<string, ViewBounds> = {
  pl:         { lngMin: -8,   lngMax: 3,    latMin: 49.5, latMax: 59 },
  laliga:     { lngMin: -10,  lngMax: 4.5,  latMin: 35.5, latMax: 44.5 },
  bundesliga: { lngMin: 5.5,  lngMax: 16,   latMin: 46.5, latMax: 55.5 },
  seriea:     { lngMin: 5.5,  lngMax: 19.5, latMin: 36,   latMax: 47.5 },
  ligue1:     { lngMin: -6,   lngMax: 10,   latMin: 41,   latMax: 52 },
};

// ─── Projection (Mercator — matches DottedMap's internal formula) ─────────────
const merc = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const SVG_W = 1000, SVG_H = 1000;

function toSVG(lat: number, lng: number, b: ViewBounds): [number, number] {
  const x = ((lng - b.lngMin) / (b.lngMax - b.lngMin)) * SVG_W;
  const y = ((merc(b.latMax) - merc(lat)) / (merc(b.latMax) - merc(b.latMin))) * SVG_H;
  return [x, y];
}

function geomToPath(geom: Geom, bounds: ViewBounds): string {
  const rings: Ring[] =
    geom.type === "Polygon" ? geom.coordinates : geom.coordinates.flatMap((p) => p);
  return rings.map((ring) =>
    ring.map(([lng, lat], i) => {
      const [x, y] = toSVG(lat, lng, bounds);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join("") + "Z"
  ).join(" ");
}

// Compute a tight viewBox from the path strings with % padding
function computeViewBox(pathStr: string, padFrac = 0.05): string {
  const xs: number[] = [], ys: number[] = [];
  for (const m of pathStr.matchAll(/[ML]([\d.]+),([\d.]+)/g)) {
    xs.push(Number(m[1])); ys.push(Number(m[2]));
  }
  if (!xs.length) return `0 0 ${SVG_W} ${SVG_H}`;
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const vw = maxX - minX, vh = maxY - minY;
  const px = vw * padFrac, py = vh * padFrac;
  return `${(minX - px).toFixed(0)} ${(minY - py).toFixed(0)} ${(vw + 2 * px).toFixed(0)} ${(vh + 2 * py).toFixed(0)}`;
}

// ─── Module-level cache ───────────────────────────────────────────────────────
interface CacheEntry { paths: string[]; viewbox: string; pins: Pin[]; bounds: ViewBounds }
const _cache: Partial<Record<string, CacheEntry>> = {};

function buildCache(league: string): CacheEntry {
  if (_cache[league]) return _cache[league]!;

  const bounds = league === "europe" ? EUROPE_BOUNDS : (LEAGUE_BOUNDS[league] ?? EUROPE_BOUNDS);
  const codes  = LEAGUE_COUNTRY[league] ?? [];

  const paths = codes.map((code) => {
    const geom = (countryGeometry as unknown as Record<string, Geom>)[code];
    return geom ? geomToPath(geom, bounds) : "";
  });

  const viewbox = computeViewBox(paths.join(" "));

  const leagueIds = league === "europe" ? Object.keys(ALL_TEAMS) : [league];
  const pins: Pin[] = leagueIds.flatMap((lid) =>
    Object.values(ALL_TEAMS[lid] ?? {})
      .filter((t) => t.lat != null && t.lng != null)
      .map((team) => {
        const [sx, sy] = toSVG(team.lat!, team.lng!, bounds);
        return { team, leagueId: lid, sx, sy };
      })
  );

  const entry: CacheEntry = { paths, viewbox, pins, bounds };
  _cache[league] = entry;
  return entry;
}

// ─── Component ───────────────────────────────────────────────────────────────
interface TeamMapProps {
  league?: string;
  homeTeam?: string | null;
  awayTeam?: string | null;
  onTeamClick?: (teamName: string) => void;
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

  const { paths, viewbox, pins } = useMemo(() => buildCache(league), [league]);

  const PIN_R  = isEurope ? 11 : 20; // logo radius in SVG units
  const RING_R = PIN_R + 5;          // selection ring radius

  const hoveredPin = hovered ? pins.find((p) => p.team.name === hovered) ?? null : null;

  return (
    <div className="relative w-full select-none rounded-xl overflow-hidden border border-border/30">
      <svg
        viewBox={viewbox}
        className="w-full h-auto block"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Ocean / background */}
        <rect x="-2000" y="-2000" width="6000" height="6000" fill="hsl(220,22%,8%)" />

        {/* Country fills — solid land mass shapes */}
        {paths.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="hsl(214,32%,17%)"
            stroke="hsl(214,38%,30%)"
            strokeWidth="4"
            strokeLinejoin="round"
          />
        ))}

        {/* Team pins — rendered inside SVG so coordinates always align */}
        {pins.map((pin) => {
          const { team, leagueId, sx, sy } = pin;
          const isHome    = team.name === homeTeam;
          const isAway    = team.name === awayTeam;
          const isSelected = isHome || isAway;
          const isHov     = hovered === team.name;
          const anySelected = !!(homeTeam || awayTeam);
          const dimmed    = anySelected && !isSelected && !isHov;
          const src       = teamLogoSrc(team);
          const scale     = isSelected ? 1.4 : isHov ? 1.2 : 1;
          const ringColor = isHome ? "#10b981" : isAway ? "#f97316" : isHov ? "rgba(255,255,255,0.5)" : "none";
          const ringWidth = isSelected ? 5 : 2.5;

          return (
            <g
              key={`${leagueId}-${team.name}`}
              transform={`translate(${sx},${sy}) scale(${scale})`}
              style={{
                cursor: interactive ? "pointer" : "default",
                opacity: dimmed ? 0.25 : 1,
                transition: "opacity 0.15s",
              }}
              onMouseEnter={() => setHovered(team.name)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => {
                if (!interactive) return;
                if (isEurope) onLeagueClick?.(leagueId);
                else onTeamClick?.(team.name);
              }}
            >
              {/* Background circle for contrast */}
              <circle cx={0} cy={0} r={PIN_R + 3} fill="hsl(220,22%,12%)" />
              {/* Selection ring */}
              {(isSelected || isHov) && (
                <circle cx={0} cy={0} r={RING_R} fill="none" stroke={ringColor} strokeWidth={ringWidth} />
              )}
              {/* Team logo */}
              {src ? (
                <image
                  href={src}
                  x={-PIN_R}
                  y={-PIN_R}
                  width={PIN_R * 2}
                  height={PIN_R * 2}
                  preserveAspectRatio="xMidYMid meet"
                />
              ) : (
                <text
                  x={0} y={0}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={PIN_R}
                  fill="hsl(215,80%,70%)"
                  fontWeight="bold"
                >
                  {team.name.slice(0, 2).toUpperCase()}
                </text>
              )}
              {/* HOME / AWAY label */}
              {isSelected && (
                <text
                  x={0}
                  y={RING_R + 10}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight="bold"
                  fill={isHome ? "#10b981" : "#f97316"}
                >
                  {isHome ? "HOME" : "AWAY"}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Bottom info bar on hover */}
      <div
        className={`absolute bottom-0 left-0 right-0 flex items-center gap-3 border-t border-border/30 bg-background/90 px-4 py-2 backdrop-blur transition-opacity duration-150 ${
          hoveredPin ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {hoveredPin && (() => {
          const src    = teamLogoSrc(hoveredPin.team);
          const isHome = hoveredPin.team.name === homeTeam;
          const isAway = hoveredPin.team.name === awayTeam;
          return (
            <>
              {src && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={hoveredPin.team.name} width={28} height={28} className="object-contain flex-shrink-0" loading="lazy" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-foreground truncate">{hoveredPin.team.name}</span>
                  {(isHome || isAway) && (
                    <span className={`shrink-0 rounded px-1.5 py-px text-[9px] font-bold text-white ${isHome ? "bg-emerald-500" : "bg-orange-500"}`}>
                      {isHome ? "HOME" : "AWAY"}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {[hoveredPin.team.stadium, hoveredPin.team.city, isEurope ? LEAGUE_NAMES[hoveredPin.leagueId] : null]
                    .filter(Boolean).join(" · ")}
                </div>
              </div>
              {interactive && (
                <span className="shrink-0 text-xs text-primary/70">
                  {isEurope
                    ? `Click → ${LEAGUE_NAMES[hoveredPin.leagueId]}`
                    : isHome || isAway ? "Click to deselect"
                    : homeTeam === null ? "Click → Home" : "Click → Away"}
                </span>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}
