"use client";

import { useState } from "react";
import DottedMap from "dotted-map";
import teamsData from "@/data/teams.json";
import { logoUrl } from "@/lib/types";
import type { TeamMeta } from "@/lib/types";

// Focused on England — enough headroom to show Scotland/Wales coastline for context
const REGION = { lat: { min: 49.9, max: 55.9 }, lng: { min: -5.8, max: 2.0 } };

const map = new DottedMap({ height: 90, grid: "diagonal", region: REGION });
const bgPoints = map.getPoints();

const teams = Object.values(teamsData) as TeamMeta[];

type Pin = { team: TeamMeta; x: number; y: number };

const pins: Pin[] = teams
  .map((team) => {
    const pin = map.getPin({ lat: team.lat, lng: team.lng });
    return pin ? { team, x: pin.x, y: pin.y } : null;
  })
  .filter((p): p is Pin => p !== null);

const allX = [...bgPoints.map((p) => p.x), ...pins.map((p) => p.x)];
const allY = [...bgPoints.map((p) => p.y), ...pins.map((p) => p.y)];
const minX = Math.min(...allX);
const maxX = Math.max(...allX);
const minY = Math.min(...allY);
const maxY = Math.max(...allY);
const PAD = 2;
const VW = maxX - minX + PAD * 2;
const VH = maxY - minY + PAD * 2;

function toPercent(pin: Pin) {
  return {
    left: ((pin.x - (minX - PAD)) / VW) * 100,
    top: ((pin.y - (minY - PAD)) / VH) * 100,
  };
}

export function TeamMap() {
  const [hovered, setHovered] = useState<Pin | null>(null);

  return (
    <div className="relative w-full select-none">
      {/* Dotted map — England/Wales outline */}
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

      {/* Team logo pins — positioned absolutely over the SVG */}
      {pins.map((pin) => {
        const pos = toPercent(pin);
        const active = hovered?.team.name === pin.team.name;
        return (
          <div
            key={pin.team.name}
            className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer"
            style={{
              left: `${pos.left}%`,
              top: `${pos.top}%`,
              zIndex: active ? 20 : 10,
            }}
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl(pin.team.logoId)}
                alt={pin.team.name}
                width={14}
                height={14}
                style={{ width: 14, height: 14 }}
                className="object-contain"
                loading="lazy"
              />
            </div>
          </div>
        );
      })}

      {/* Tooltip */}
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
            <div className="font-semibold text-foreground whitespace-nowrap">
              {hovered.team.name}
            </div>
            <div className="text-muted-foreground whitespace-nowrap">
              {hovered.team.stadium}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
