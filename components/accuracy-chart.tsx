"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlyAccuracy } from "@/lib/types";

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
};

function shortMonth(month: string): string {
  return MONTH_LABELS[month.slice(5)] ?? month;
}

interface TooltipPayloadItem {
  payload: MonthlyAccuracy & { label: string };
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-xl">
      <div className="font-semibold text-foreground">{d.label}</div>
      <div className="mt-1 text-muted-foreground">
        Accuracy{" "}
        <span className="font-mono font-semibold text-primary">
          {(d.accuracy * 100).toFixed(1)}%
        </span>
      </div>
      <div className="text-muted-foreground">{d.matches} matches</div>
    </div>
  );
}

export function AccuracyChart({ data }: { data: MonthlyAccuracy[] }) {
  const chartData = data.map((d) => ({ ...d, label: shortMonth(d.month) }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="accuracyFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.55} />
            <stop offset="90%" stopColor="var(--primary)" stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid
          vertical={false}
          stroke="var(--border)"
          strokeDasharray="3 3"
        />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
        />
        <YAxis
          domain={[0, 0.8]}
          tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border)" }} />
        <Area
          type="monotone"
          dataKey="accuracy"
          stroke="var(--primary)"
          strokeWidth={2}
          fill="url(#accuracyFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
