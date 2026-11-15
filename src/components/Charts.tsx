"use client";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { CONFIDENCE_COLOR, fmtDate, fmtMonth, fmtNumber, MONTHS } from "@/lib/format";
import { CONFIDENCE_LABEL, SATELLITE_LABEL, type Confidence } from "@/lib/types";

const FIRE = "#ea580c";
const Empty = () => <div className="flex h-full items-center justify-center text-sm text-stone-400">Sin datos para los filtros seleccionados</div>;

export function DailyChart({ data }: { data: { date: string; count: number }[] }) {
  if (!data.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
        <XAxis dataKey="date" tickFormatter={fmtDate} fontSize={11} minTickGap={12} />
        <YAxis allowDecimals={false} fontSize={11} />
        <Tooltip labelFormatter={(d) => fmtDate(String(d))} formatter={(v) => [fmtNumber(Number(v)), "Detecciones"]} />
        <Bar dataKey="count" fill={FIRE} radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ProvinceChart({ data, onSelect }: { data: { id: number | null; name: string; count: number }[]; onSelect?: (id: number) => void }) {
  if (!data.length) return <Empty />;
  const top = data.slice(0, 12);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={top} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
        <XAxis type="number" allowDecimals={false} fontSize={11} />
        <YAxis type="category" dataKey="name" width={120} fontSize={11} interval={0} />
        <Tooltip formatter={(v) => [fmtNumber(Number(v)), "Detecciones"]} />
        <Bar dataKey="count" fill={FIRE} radius={[0, 3, 3, 0]} isAnimationActive={false} cursor="pointer" onClick={(d) => {
          const id = (d as unknown as { id?: number | null }).id;
          if (id != null) onSelect?.(id);
        }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ConfidenceChart({ data }: { data: { confidence: Confidence; count: number }[] }) {
  if (!data.length) return <Empty />;
  const rows = data.map((d) => ({ ...d, name: CONFIDENCE_LABEL[d.confidence] }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={rows} dataKey="count" nameKey="name" innerRadius="50%" outerRadius="80%" isAnimationActive={false} label={(e) => fmtNumber(Number(e.value))}>
          {rows.map((r) => <Cell key={r.confidence} fill={CONFIDENCE_COLOR[r.confidence]} />)}
        </Pie>
        <Legend verticalAlign="bottom" height={24} iconSize={10} />
        <Tooltip formatter={(v) => fmtNumber(Number(v))} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function SatelliteList({ data }: { data: { satellite: string; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  if (!data.length) return <Empty />;
  return (
    <ul className="space-y-2 text-sm">
      {data.map((d) => (
        <li key={d.satellite}>
          <div className="flex justify-between"><span>{SATELLITE_LABEL[d.satellite] ?? d.satellite}</span><span className="tabular-nums">{fmtNumber(d.count)}</span></div>
          <div className="h-1.5 rounded bg-stone-100"><div className="h-1.5 rounded bg-fuego-500" style={{ width: `${(d.count / total) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

export function MonthlyChart({ data }: { data: { month: string; count: number; frp: number }[] }) {
  if (!data.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
        <XAxis dataKey="month" tickFormatter={fmtMonth} fontSize={11} minTickGap={16} />
        <YAxis allowDecimals={false} fontSize={11} />
        <Tooltip labelFormatter={(m) => fmtMonth(String(m))} formatter={(v) => [fmtNumber(Number(v)), "Detecciones"]} />
        <Line type="monotone" dataKey="count" stroke={FIRE} strokeWidth={2} dot={data.length < 40} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SeasonalityChart({ data }: { data: { month: number; count: number; years: number }[] }) {
  const rows = MONTHS.map((name, i) => {
    const d = data.find((x) => x.month === i + 1);
    return { name, avg: d ? Math.round((d.count / Math.max(1, d.years)) * 10) / 10 : 0 };
  });
  if (!data.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
        <XAxis dataKey="name" fontSize={11} />
        <YAxis fontSize={11} />
        <Tooltip formatter={(v) => [fmtNumber(Number(v), 1), "Promedio por año"]} />
        <Bar dataKey="avg" fill={FIRE} radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
