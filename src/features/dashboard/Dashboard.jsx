import React, { useMemo, useState } from 'react';
import {
  BarChart3, Activity, CheckCircle2, Hourglass, Flame,
  AlertTriangle, ShieldCheck, Clock, Receipt, FileCheck2,
  ShoppingCart, Package, ArrowUpRight, ChevronRight, CircleDot,
  Calendar, XCircle
} from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';
import { SECTIONS, SECTION_BY_ID, PRIORIDADES } from '../../lib/constants';
import { fmtDate, timeAgo } from '../../lib/helpers';
import { calculateStats } from './calculateStats';
import {
  DEFAULT_PERIOD, getAvailableYears, MES_OPTIONS,
  filterTasksByPeriod, periodLabel
} from './dateFilter';
import { FiltersBanner } from '../../components/ui';

// ─── Helpers de presentación ──────────────────────────────────────
function EmptyChart({ label }) {
  return <div className="py-8 text-center text-xs text-slate-400 italic">{label}</div>;
}

function DashCard({ title, subtitle, children, accent = 'sky' }) {
  const bars = {
    sky: 'bg-sky-500', emerald: 'bg-emerald-500', orange: 'bg-orange-500',
    violet: 'bg-violet-500', red: 'bg-red-500', slate: 'bg-slate-400'
  };
  return (
    <div className="relative bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className={`absolute left-0 top-4 bottom-4 w-[3px] rounded-r ${bars[accent] || bars.sky}`}></div>
      <div className="pl-5 pr-4 sm:pr-5 pt-4 pb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-slate-900 leading-tight">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="pl-5 pr-4 sm:pr-5 pb-5">{children}</div>
    </div>
  );
}

function HeroStat({ label, value, accent }) {
  const colors = { emerald: 'text-emerald-600', orange: 'text-orange-600', sky: 'text-sky-600', red: 'text-red-600' };
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</span>
      <span className={`font-mono font-semibold text-lg leading-tight ${accent ? colors[accent] : 'text-slate-900'}`}>
        {value}
      </span>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, accent = 'slate' }) {
  const t = {
    slate:   { bar: 'bg-slate-400',   iconBg: 'bg-slate-50',   iconColor: 'text-slate-600',   valueColor: 'text-slate-900' },
    emerald: { bar: 'bg-emerald-500', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', valueColor: 'text-slate-900' },
    sky:     { bar: 'bg-sky-500',     iconBg: 'bg-sky-50',     iconColor: 'text-sky-600',     valueColor: 'text-slate-900' },
    orange:  { bar: 'bg-orange-500',  iconBg: 'bg-orange-50',  iconColor: 'text-orange-600',  valueColor: 'text-slate-900' },
    red:     { bar: 'bg-red-500',     iconBg: 'bg-red-50',     iconColor: 'text-red-600',     valueColor: 'text-red-700' },
    violet:  { bar: 'bg-violet-500',  iconBg: 'bg-violet-50',  iconColor: 'text-violet-600',  valueColor: 'text-slate-900' }
  }[accent] || { bar: 'bg-slate-400', iconBg: 'bg-slate-50', iconColor: 'text-slate-600', valueColor: 'text-slate-900' };

  return (
    <div className="relative bg-white rounded-xl border border-slate-200 shadow-sm p-4 overflow-hidden">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-md ${t.iconBg} ${t.iconColor} flex items-center justify-center`}>
          <Icon size={14} strokeWidth={2.3} />
        </div>
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</span>
      </div>
      <div className={`font-mono text-3xl font-semibold ${t.valueColor} leading-none tabular-nums`}>{value}</div>
      {sub && <p className="text-[11px] text-slate-500 mt-1.5">{sub}</p>}
    </div>
  );
}

function BarRow({ label, value, max, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-700 font-medium truncate pr-2">{label}</span>
        <span className="font-mono text-xs text-slate-600 font-semibold tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }}></div>
      </div>
    </div>
  );
}

function AlertRow({ alert, onClick }) {
  const Icon       = alert.icon;
  const isCritical = alert.type === 'critical';
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-start gap-2.5 p-2.5 rounded-md border transition-colors ${
        isCritical ? 'bg-red-50 border-red-200 hover:bg-red-100/70' : 'bg-orange-50 border-orange-200 hover:bg-orange-100/70'
      }`}
    >
      <Icon size={14} className={`shrink-0 mt-0.5 ${isCritical ? 'text-red-600' : 'text-orange-600'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-900 truncate">{alert.task.name}</p>
        <p className={`text-[11px] mt-0.5 font-mono ${isCritical ? 'text-red-700' : 'text-orange-700'}`}>
          {alert.label} · {SECTION_BY_ID[alert.task.section]?.short}
        </p>
      </div>
      <ChevronRight size={13} className="text-slate-400 shrink-0 mt-0.5" />
    </button>
  );
}

function ActivityRow({ activity, onClick }) {
  const { task, event } = activity;
  const fromSec = event.from ? SECTION_BY_ID[event.from] : null;
  const toSec   = event.to   ? SECTION_BY_ID[event.to]   : SECTION_BY_ID[task.section];
  return (
    <button
      onClick={onClick}
      className="group w-full text-left flex items-start gap-2.5 p-2.5 rounded-md hover:bg-slate-50 transition-colors border border-slate-100"
      title="Abrir detalle de la solicitud"
    >
      <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
        <CircleDot size={12} className="text-slate-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-900 truncate">{task.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 flex-wrap">
          <span className="text-slate-700 font-medium">{event.action}</span>
          {event.userEmail && (
            <span
              className="text-[10px] text-slate-500 font-medium"
              title={event.userEmail}
            >
              · {event.userEmail.split('@')[0]}
            </span>
          )}
          {fromSec && toSec && (
            <>
              <span>·</span>
              <span className={`px-1.5 py-0.5 rounded font-medium ${fromSec.chip} text-[10px]`}>{fromSec.short}</span>
              <ChevronRight size={9} className="text-slate-400" />
              <span className={`px-1.5 py-0.5 rounded font-medium ${toSec.chip} text-[10px]`}>{toSec.short}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 mt-1">
        <span className="font-mono text-[10px] text-slate-400">{timeAgo(event.at)}</span>
        <ArrowUpRight size={13} className="text-slate-300 group-hover:text-sky-600 transition-colors" strokeWidth={2.2} />
      </div>
    </button>
  );
}

function PriorityBreakdown({ stats }) {
  const data = [
    { name: 'Alta',  value: stats.prioMap.Alta,  fill: '#ef4444' },
    { name: 'Media', value: stats.prioMap.Media, fill: '#f97316' },
    { name: 'Baja',  value: stats.prioMap.Baja,  fill: '#94a3b8' }
  ].filter(d => d.value > 0);

  if (data.length === 0) return <EmptyChart label="Sin solicitudes activas" />;

  return (
    <div className="flex items-center gap-4 sm:gap-6">
      <div className="w-32 h-32 sm:w-36 sm:h-36 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius="60%" outerRadius="95%" paddingAngle={2} strokeWidth={0}>
              {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-2">
        {PRIORIDADES.map(p => {
          const v   = stats.prioMap[p.value];
          const pct = stats.totalPrio > 0 ? Math.round((v / stats.totalPrio) * 100) : 0;
          return (
            <div key={p.value} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${p.dot}`}></span>
                <span className="text-xs font-medium text-slate-700">{p.value}</span>
              </div>
              <div className="flex items-baseline gap-1.5 font-mono">
                <span className="text-sm font-semibold text-slate-900 tabular-nums">{v}</span>
                <span className="text-[10px] text-slate-500 tabular-nums">{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActivityTrend({ data }) {
  const total = data.reduce((acc, d) => acc + d.creadas + d.cerradas, 0);
  if (total === 0) return <EmptyChart label="Sin actividad en los últimos 30 días" />;
  return (
    <div>
      <div className="flex items-center gap-4 mb-2 text-[11px]">
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-orange-500"></span><span className="text-slate-600 font-medium">Creadas</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span><span className="text-slate-600 font-medium">Finalizadas</span></div>
      </div>
      <div className="h-44 -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="gCreadas"  x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f97316" stopOpacity={0.3}/><stop offset="100%" stopColor="#f97316" stopOpacity={0}/></linearGradient>
              <linearGradient id="gCerradas" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="100%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'JetBrains Mono, monospace' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={20} />
            <YAxis tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'JetBrains Mono, monospace' }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
            <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: 8, fontSize: 11, color: '#f8fafc', padding: '6px 10px', fontFamily: 'JetBrains Mono, monospace' }} labelStyle={{ color: '#94a3b8', fontSize: 10, marginBottom: 2 }} cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '3 3' }} />
            <Area type="monotone" dataKey="creadas"  stroke="#f97316" fill="url(#gCreadas)"  strokeWidth={2} name="Creadas" />
            <Area type="monotone" dataKey="cerradas" stroke="#10b981" fill="url(#gCerradas)" strokeWidth={2} name="Finalizadas" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// StageAging recibe los buckets como configuración, no asume rangos fijos.
// Cada flujo del Dashboard pasa su propio set (Sin→Con presupuesto tiene 3,
// Solicitud→RMA tiene 2, RMA→OC tiene 4). El componente se adapta.
//
// Props:
//   - buckets: { [key]: count }  (counts por bucket)
//   - buckCfg: [{ key, label, color, ... }]  (configuración de cada bucket)
//   - compliance: filas de cumplimiento (cada una con label, target, actual, pass, op)
//   - total: cantidad total de items considerados
export function StageAging({ buckets, buckCfg, compliance, total }) {
  if (total === 0) return <EmptyChart label="Sin solicitudes en esta etapa" />;

  // Si no llega buckCfg (compat con código viejo), usamos los 4 buckets clásicos.
  const cfg = buckCfg || [
    { key: '0-15',  label: '0-15 días',  color: 'bg-emerald-500' },
    { key: '16-30', label: '16-30 días', color: 'bg-sky-500' },
    { key: '31-60', label: '31-60 días', color: 'bg-orange-500' },
    { key: '60+',   label: '> 60 días',  color: 'bg-red-600' }
  ];
  const totalBuckets = Object.values(buckets).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100 mb-2">
          {cfg.map(b => {
            const pct = totalBuckets > 0 ? (buckets[b.key] / totalBuckets) * 100 : 0;
            if (pct === 0) return null;
            return <div key={b.key} className={b.color} style={{ width: `${pct}%` }} title={`${b.label}: ${buckets[b.key]}`}></div>;
          })}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {cfg.map(b => {
            const v   = buckets[b.key] || 0;
            const pct = totalBuckets > 0 ? Math.round((v / totalBuckets) * 100) : 0;
            return (
              <div key={b.key} className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`w-2 h-2 rounded-sm ${b.color} shrink-0`}></span>
                  <span className="text-slate-600 truncate">{b.label}</span>
                </div>
                <div className="flex items-baseline gap-1.5 font-mono">
                  <span className="text-slate-900 font-semibold tabular-nums">{v}</span>
                  <span className="text-[10px] text-slate-500 tabular-nums">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-slate-100 pt-3">
        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Cumplimiento</p>
        <div className="space-y-1.5">
          {compliance.map(c => {
            const barColor = c.pass ? 'bg-emerald-500' : 'bg-red-500';
            // Escalado de la barra: "gt/ge" usa el porcentaje directo capeado a 100;
            // "lt" usa una escala relativa al threshold (para que pequeños sobrepasos
            // se vean visibles).
            const barWidth = (c.op === 'gt' || c.op === 'ge')
              ? Math.min(c.actual, 100)
              : Math.min((c.actual / Math.max(c.threshold * 4, 20)) * 100, 100);
            const labelColor = c.pass ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200';
            return (
              <div key={c.key} className="flex items-center gap-2 py-0.5">
                <div className="w-20 sm:w-24 shrink-0">
                  <p className="text-[11px] font-medium text-slate-800 leading-tight">{c.label}</p>
                  <p className="text-[9px] text-slate-500 font-mono">obj. {c.target}</p>
                </div>
                <div className="flex-1 relative h-6 bg-slate-100 rounded overflow-hidden">
                  <div className={`absolute inset-y-0 left-0 ${barColor} transition-all`} style={{ width: `${Math.max(barWidth, 4)}%`, opacity: 0.85 }}></div>
                  <div className="absolute inset-0 flex items-center justify-end pr-2 font-mono text-[11px] font-semibold text-slate-900">
                    {c.actual.toFixed(0)}%
                  </div>
                </div>
                <span className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center ${labelColor}`}>
                  {c.pass ? '✓' : '✗'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PendientesUnificado({ stats, onGoToKanban }) {
  const sinPresu         = stats.totalSinPresupuesto;
  const conPresu         = Math.max(0, stats.totalEnRmaSolicitada - stats.totalSinPresupuesto);
  const rmaSolicitadaTotal = stats.totalEnRmaSolicitada;
  const rmaGenerada      = stats.totalEnRmaGenerada;
  const ocGenerada       = stats.porSeccion.oc_generada || 0;
  const finalizadas      = stats.finalizadas;
  const totalActivas     = rmaSolicitadaTotal + rmaGenerada + ocGenerada;
  const granTotal        = totalActivas + finalizadas;
  const pctActivas       = (n) => totalActivas > 0 ? Math.round((n / totalActivas) * 100) : 0;
  const pctGran          = (n) => granTotal > 0 ? Math.round((n / granTotal) * 100) : 0;
  const maxBarra         = Math.max(rmaSolicitadaTotal, rmaGenerada, ocGenerada, finalizadas, 1);

  const filas = [
    { key: 'sin_presu',      icon: Receipt,      label: 'Solicitud sin presupuesto', value: sinPresu,         pct: pctActivas(sinPresu),         dot: 'bg-slate-400', bar: 'bg-slate-500', fill: null,      onClick: () => onGoToKanban('rma_solicitada'), role: 'sub' },
    { key: 'con_presu',      icon: FileCheck2,   label: 'Solicitud con presupuesto', value: conPresu,         pct: pctActivas(conPresu),         dot: 'bg-slate-400', bar: 'bg-slate-500', fill: null,      onClick: () => onGoToKanban('rma_solicitada'), role: 'sub' },
    { key: 'rma_solicitada', icon: FileCheck2,   label: 'RMA solicitada (∑)',        value: rmaSolicitadaTotal, pct: pctActivas(rmaSolicitadaTotal), dot: 'bg-orange-500', bar: 'bg-orange-500', fill: '#f97316', onClick: () => onGoToKanban('rma_solicitada'), role: 'main' },
    { key: 'rma_generada',   icon: ShoppingCart, label: 'RMA generada',             value: rmaGenerada,      pct: pctActivas(rmaGenerada),      dot: 'bg-sky-500',    bar: 'bg-sky-500',    fill: '#0ea5e9', onClick: () => onGoToKanban('rma_generada'),   role: 'main' },
    { key: 'oc_generada',    icon: Package,      label: 'OC generada',              value: ocGenerada,       pct: pctActivas(ocGenerada),       dot: 'bg-violet-500', bar: 'bg-violet-500', fill: '#8b5cf6', onClick: () => onGoToKanban('oc_generada'),    role: 'main' },
    { key: 'finalizadas',    icon: CheckCircle2, label: 'Finalizadas',              value: finalizadas,      pct: pctGran(finalizadas),         dot: 'bg-emerald-600', bar: 'bg-emerald-600', fill: null,    onClick: () => onGoToKanban('finalizadas'),    role: 'closed' }
  ];

  const dataTorta = filas.filter(f => f.role === 'main' && f.fill && f.value > 0)
    .map(f => ({ name: f.label, value: f.value, fill: f.fill }));

  return (
    <div>
      <h3 className="text-[11px] uppercase tracking-wider text-slate-600 font-semibold mb-2 px-1">Pendientes por etapa</h3>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 p-4 sm:p-5 items-center">
          <div className="space-y-1">
            {filas.map(f => {
              const Icon     = f.icon;
              const isEmpty  = f.value === 0;
              const widthPct = maxBarra > 0 ? (f.value / maxBarra) * 100 : 0;
              const isSub    = f.role === 'sub';
              return (
                <button key={f.key} onClick={f.onClick} className="w-full text-left group rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50">
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className={`w-2.5 h-2.5 rounded-sm ${f.dot} shrink-0`}></span>
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${isEmpty ? 'bg-slate-50 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                      <Icon size={12} strokeWidth={2.2} />
                    </div>
                    <span className={`text-sm flex-1 truncate ${f.role === 'main' || f.role === 'closed' ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>{f.label}</span>
                    <div className="flex items-baseline gap-2 shrink-0">
                      <span className={`text-lg font-bold tabular-nums ${isEmpty ? 'text-slate-400' : 'text-slate-900'}`}>{f.value}</span>
                      <span className="text-xs font-semibold text-slate-500 tabular-nums w-10 text-right">{f.pct}%</span>
                    </div>
                    <ArrowUpRight size={13} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                  <div className={`ml-[3.25rem] rounded-full bg-slate-100 overflow-hidden ${isSub ? 'h-1' : 'h-2'}`}>
                    <div className={`h-full rounded-full ${f.bar} ${isSub ? 'opacity-50' : ''}`} style={{ width: `${widthPct}%` }}></div>
                  </div>
                </button>
              );
            })}
            <div className="pt-3 mt-2 border-t border-slate-100 px-2 flex items-baseline justify-between">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Total activas / total general</span>
              <span className="text-base font-bold text-slate-900 tabular-nums">{totalActivas} <span className="text-slate-400 font-medium">/</span> {granTotal}</span>
            </div>
          </div>

          <div className="flex items-center justify-center">
            {dataTorta.length === 0 ? (
              <div className="w-40 h-40 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center">
                <span className="text-xs text-slate-400">Sin activas</span>
              </div>
            ) : (
              <div className="relative w-48 h-48 sm:w-56 sm:h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dataTorta} dataKey="value" cx="50%" cy="50%" innerRadius="62%" outerRadius="95%" paddingAngle={2} strokeWidth={0}>
                      {dataTorta.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-bold text-slate-900 tabular-nums leading-none">{totalActivas}</span>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-1.5">activas</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PeriodSelector ───────────────────────────────────────────────
// Selector de período para el filtro de fechas del Dashboard. Modelo 1:
// presets cerrados (esta semana, mes, trimestre, semestre, año, personalizado).
// Multi-año desde 2026.
function PeriodSelector({ period, onChange }) {
  const years      = getAvailableYears();
  const currentYr  = years[0];

  // Detecta el kind activo para resaltar el botón
  const kind = period.kind;

  function setKind(newKind) {
    // Al cambiar de kind, completo con defaults razonables
    if (newKind === 'all' || newKind === 'week')  return onChange({ kind: newKind });
    if (newKind === 'month')    return onChange({ kind: 'month',    year: currentYr, month: new Date().getMonth() + 1 });
    if (newKind === 'quarter')  return onChange({ kind: 'quarter',  year: currentYr, q: Math.floor(new Date().getMonth() / 3) + 1 });
    if (newKind === 'semester') return onChange({ kind: 'semester', year: currentYr, s: new Date().getMonth() < 6 ? 1 : 2 });
    if (newKind === 'year')     return onChange({ kind: 'year',     year: currentYr });
    if (newKind === 'custom')   return onChange({ kind: 'custom',   from: '', to: '' });
  }

  const KINDS = [
    { value: 'all',      label: 'Todo' },
    { value: 'week',     label: 'Esta semana' },
    { value: 'month',    label: 'Mes' },
    { value: 'quarter',  label: 'Trimestre' },
    { value: 'semester', label: 'Semestre' },
    { value: 'year',     label: 'Año' },
    { value: 'custom',   label: 'Personalizado' }
  ];

  return (
    <div className="space-y-2">
      {/* Fila de selección de tipo */}
      <div className="flex flex-wrap gap-1.5">
        {KINDS.map(k => (
          <button
            key={k.value}
            onClick={() => setKind(k.value)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
              kind === k.value
                ? 'bg-sky-600 text-white border-sky-600'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      {/* Sub-controles según el kind */}
      {(kind === 'month' || kind === 'quarter' || kind === 'semester' || kind === 'year') && (
        <div className="flex flex-wrap gap-1.5 items-center">
          {/* Selector específico del kind */}
          {kind === 'month' && (
            <select
              value={period.month}
              onChange={e => onChange({ ...period, month: Number(e.target.value) })}
              className="px-2.5 py-1 rounded-md text-xs font-medium border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-600"
            >
              {MES_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          )}
          {kind === 'quarter' && [1, 2, 3, 4].map(q => (
            <button
              key={q}
              onClick={() => onChange({ ...period, q })}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                period.q === q
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              Q{q}
            </button>
          ))}
          {kind === 'semester' && [1, 2].map(s => (
            <button
              key={s}
              onClick={() => onChange({ ...period, s })}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                period.s === s
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              S{s}
            </button>
          ))}

          {/* Selector de año, aparece en mes/trimestre/semestre/año */}
          <select
            value={period.year}
            onChange={e => onChange({ ...period, year: Number(e.target.value) })}
            className="px-2.5 py-1 rounded-md text-xs font-medium border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-600"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      )}

      {/* Rango personalizado */}
      {kind === 'custom' && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            Desde
            <input
              type="date"
              value={period.from || ''}
              onChange={e => onChange({ ...period, from: e.target.value })}
              className="px-2 py-1 rounded-md text-xs border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            Hasta
            <input
              type="date"
              value={period.to || ''}
              onChange={e => onChange({ ...period, to: e.target.value })}
              className="px-2 py-1 rounded-md text-xs border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
          </label>
        </div>
      )}
    </div>
  );
}

// ─── PeriodBanner ─────────────────────────────────────────────────
// Banner visible cuando hay un filtro de fechas activo. Muestra el período
// elegido y cuántas solicitudes quedan vs el total. Botón para limpiar.
// ─── Dashboard (componente principal) ────────────────────────────
// Props:
//   tasks: solicitudes YA filtradas por los filtros del modal (vienen de App).
//   totalTasksUnfiltered: total sin filtros, para el "X de Y" del banner.
//   modalChips: chips de los filtros del modal activos (de App).
//   onClearModalFilters: limpia los filtros del modal (de App).
//   onGoToKanban, onCardClick: navegación.
//
// El Dashboard agrega ENCIMA el filtro de período (solo aquí, no afecta Kanban).
// El banner unificado muestra modalChips + chip de período si están activos.
export function Dashboard({
  tasks,
  totalTasksUnfiltered,
  modalChips = [],
  onClearModalFilters,
  onGoToKanban,
  onCardClick
}) {
  const [period, setPeriod] = useState(DEFAULT_PERIOD);

  // Filtros se aplican en cascada: tasks ya viene filtrada por el modal,
  // acá le sumamos el filtro de período del Dashboard.
  const filteredTasks = useMemo(() => filterTasksByPeriod(tasks, period), [tasks, period]);
  const stats         = useMemo(() => calculateStats(filteredTasks),     [filteredTasks]);

  // Chips del banner: los del modal (vienen como prop) + el del período si está activo.
  const periodChip = period.kind !== 'all' ? [{ label: `Período: ${periodLabel(period)}`, tone: 'sky' }] : [];
  const allChips   = [...modalChips, ...periodChip];

  // Limpiar TODO desde el banner: limpia modal + resetea período.
  function clearAll() {
    onClearModalFilters?.();
    setPeriod(DEFAULT_PERIOD);
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Banner unificado: filtros del modal + período del Dashboard */}
      <FiltersBanner
        chips={allChips}
        filteredCount={filteredTasks.length}
        totalCount={totalTasksUnfiltered ?? tasks.length}
        onClear={clearAll}
      />

      {/* Selector de período */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 sm:px-5 py-3">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex items-center gap-2 shrink-0">
            <Calendar size={14} className="text-slate-500" />
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Período</span>
          </div>
          <div className="flex-1 min-w-[280px]">
            <PeriodSelector period={period} onChange={setPeriod} />
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-4 flex flex-wrap items-center gap-x-8 gap-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center">
              <BarChart3 size={18} className="text-sky-600" strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Dashboard</p>
              <p className="font-mono text-sm text-slate-900 font-semibold uppercase">
                {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="hidden sm:block w-px h-10 bg-slate-200"></div>
          <HeroStat label="Total"    value={stats.totales} />
          <HeroStat label="En curso" value={stats.enCurso} />
          <HeroStat label="Cerradas" value={stats.finalizadas} />
          <HeroStat label="% cierre" value={`${stats.tasaFinalizacion}%`} accent={stats.tasaFinalizacion >= 70 ? 'emerald' : 'orange'} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Activity}     label="En curso"      value={stats.enCurso}  sub={`${stats.totales} totales`} accent="sky" />
        <KpiCard icon={CheckCircle2} label="Finalizadas"   value={stats.finalizadas} sub={`${stats.tasaFinalizacion}% tasa cierre`} accent="emerald" />
        <KpiCard icon={Hourglass}    label="Tiempo prom."  value={stats.tiempoPromedioCierre !== null ? `${stats.tiempoPromedioCierre}d` : '—'} sub="ciclo completo" accent="violet" />
        <KpiCard icon={Flame}        label="Prioridad alta" value={stats.altaPrioridad} sub={stats.paradaPlanta > 0 ? `${stats.paradaPlanta} parada planta` : 'sin paradas'} accent={stats.altaPrioridad > 0 ? 'red' : 'slate'} />
      </div>

      <PendientesUnificado stats={stats} onGoToKanban={onGoToKanban} />

      {/* Antigüedad */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DashCard title="Antigüedad: Sin → Con presupuesto" subtitle={`${stats.totalSinPresupuesto} sin presupuesto · días desde creación`} accent="emerald">
          <StageAging buckets={stats.aging_presupuesto} buckCfg={stats.buckets_presupuesto} compliance={stats.compliance_presupuesto} total={stats.totalSinPresupuesto} />
        </DashCard>
        <DashCard title="Antigüedad: Solicitud → RMA"        subtitle={`${stats.totalEnRmaSolicitada} esperando RMA · días desde creación`} accent="orange">
          <StageAging buckets={stats.aging_solicitud}    buckCfg={stats.buckets_solicitud}    compliance={stats.compliance_solicitud}    total={stats.totalEnRmaSolicitada} />
        </DashCard>
        <DashCard title="Antigüedad: RMA → OC"               subtitle={`${stats.totalEnRmaGenerada} esperando OC · días desde RMA generada`} accent="sky">
          <StageAging buckets={stats.aging_rma}          buckCfg={stats.buckets_rma}          compliance={stats.compliance_rma}          total={stats.totalEnRmaGenerada} />
        </DashCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DashCard title="Por prioridad" subtitle="Solicitudes activas" accent="orange">
          <PriorityBreakdown stats={stats} />
        </DashCard>
        <DashCard title="Alertas" subtitle={`${stats.alertas.length} ítems requieren atención`} accent="red">
          {stats.alertas.length === 0
            ? <EmptyChart label="✓ Todo en orden" />
            : <div className="space-y-2 max-h-72 overflow-y-auto">
                {stats.alertas.map(a => <AlertRow key={a.task.id} alert={a} onClick={() => onCardClick(a.task)} />)}
              </div>
          }
        </DashCard>
      </div>

      {/* Bloque 4: cancelaciones. Solo aparece si hay al menos una.
          La tasa se calcula sobre `totales` (el conjunto que está mirando
          el usuario según los filtros del modal). Si el toggle "Incluir
          canceladas" está apagado, este bloque queda vacío y se oculta. */}
      {stats.canceladas > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="grid grid-cols-2 gap-3">
            <KpiCard
              icon={XCircle}
              label="Canceladas"
              value={stats.canceladas}
              sub={`${stats.tasaCancelacion}% de ${stats.totales} totales`}
              accent="red"
            />
            <KpiCard
              icon={ChevronRight}
              label="Activas reales"
              value={stats.enCurso - stats.canceladas > 0 ? stats.enCurso - stats.canceladas : 0}
              sub="en curso excluyendo canceladas"
              accent="slate"
            />
          </div>
          <DashCard title="Motivos top de cancelación" subtitle={`${stats.motivosTop.length} motivos distintos`} accent="red">
            {stats.motivosTop.length === 0
              ? <EmptyChart label="Sin motivos registrados" />
              : <div className="space-y-2">
                  {stats.motivosTop.map((m, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className="font-mono font-semibold text-red-700 shrink-0 tabular-nums w-6 text-right">{m.count}×</span>
                      <span className="text-slate-700 leading-snug">{m.motivo}</span>
                    </div>
                  ))}
                </div>
            }
          </DashCard>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DashCard title="Top proveedores"  subtitle="Por OCs adjudicadas" accent="violet">
          {stats.proveedores.length === 0
            ? <EmptyChart label="Sin OCs emitidas todavía" />
            : <div className="space-y-2.5">{stats.proveedores.slice(0, 5).map(p => <BarRow key={p.name} label={p.name} value={p.count} max={stats.proveedores[0].count} color="bg-violet-500" />)}</div>
          }
        </DashCard>
        <DashCard title="Top solicitantes" subtitle={`${stats.solicitantes.length} personas`}   accent="emerald">
          {stats.solicitantes.length === 0
            ? <EmptyChart label="Sin solicitantes" />
            : <div className="space-y-2.5">{stats.solicitantes.slice(0, 5).map(p => <BarRow key={p.name} label={p.name} value={p.count} max={stats.solicitantes[0].count} color="bg-emerald-500" />)}</div>
          }
        </DashCard>
      </div>

      <DashCard title="Actividad últimos 30 días" subtitle="Solicitudes creadas vs finalizadas" accent="sky">
        <ActivityTrend data={stats.actividad30d} />
      </DashCard>

      <DashCard title="Actividad reciente" subtitle="Últimos movimientos" accent="emerald">
        {stats.actividadReciente.length === 0
          ? <EmptyChart label="Sin actividad reciente" />
          : <div className="space-y-2 max-h-80 overflow-y-auto">
              {stats.actividadReciente.map((a, i) => <ActivityRow key={i} activity={a} onClick={() => onCardClick(a.task)} />)}
            </div>
        }
      </DashCard>

      <p className="text-center text-xs text-slate-500 pt-2 font-mono">
        {stats.totales} solicitudes · datos locales
      </p>
    </div>
  );
}
