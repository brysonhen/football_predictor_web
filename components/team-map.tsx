"use client";

import { useState } from "react";
import DottedMap from "dotted-map";
import teamsData from "@/data/teams.json";
import type { TeamMeta } from "@/lib/types";

const REGION = { lat: { min: 49.9, max: 55.9 }, lng: { min: -6.4, max: 1.9 } };

const map = new DottedMap({ height: 60, grid: "diagonal", region: REGION });
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
const PAD = 2.5;
const viewBox = `${minX - PAD} ${minY - PAD} ${maxX - minX + PAD * 2} ${
  maxY - minY + PAD * 2
}`;

export function TeamMap() {
  const [hovered, setHovered] = useState<Pin | null>(null);

  return (
    <div className="relative w-full">
      <svg viewBox={viewBox} className="w-full h-auto">
        {bgPoints.map((point, i) => (
          <circle
            key={i}
            cx={point.x}
            cy={point.y}
            r={0.32}
            className="fill-muted-foreground/25"
          />
        ))}

        {pins.map((pin, i) => {
          const active = hovered?.team.name === pin.team.name;
          return (
            <g key={pin.team.name}>
              {active && (
                <circle
                  cx={pin.x}
                  cy={pin.y}
                  r={2.2}
                  className="fill-primary/25"
                />
              )}
              <circle
                cx={pin.x}
                cy={pin.y}
                r={active ? 1.15 : 0.85}
                className="fill-primary cursor-pointer transition-all"
                style={{ animationDelay: `${i * 35}ms` }}
                onMouseEnter={() => setHovered(pin)}
                onMouseLeave={() => setHovered(null)}
              />
            </g>
          );
        })}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-lg"
          style={{
            left: `${((hovered.x - minX + PAD) / (maxX - minX + PAD * 2)) * 100}%`,
            top: `${((hovered.y - minY + PAD) / (maxY - minY + PAD * 2)) * 100}%`,
          }}
        >
          <div className="font-semibold text-foreground">
            {hovered.team.name}
          </div>
          <div className="text-muted-foreground">{hovered.team.stadium}</div>
        </div>
      )}
    </div>
  );
}
