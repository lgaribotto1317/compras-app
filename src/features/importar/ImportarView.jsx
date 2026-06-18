import React, { useState, useMemo, useRef } from 'react';
import {
  Upload, FileSpreadsheet, Loader2, AlertTriangle, CheckCircle2,
  Plus, ArrowRight, Ban, Equal, Layers, RefreshCw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { parseOmaExcel } from './parseOmaExcel';

// ─── ImportarView ─────────────────────────────────────────────────
// Import de OCs self-service desde el Excel "OMA al ..." del sistema origen.
// Flujo: subir Excel -> parsear (client) -> previsualizar (RPC dry_run) ->
//        revisar/deseleccionar -> aplicar (RPC dry_run=false).
//
// La RPC public.import_ocs es SECURITY INVOKER: la aplicacion real solo pasa
// el trigger de transiciones si el usuario logueado es Compras o admin (por
// eso el tab solo se muestra a esos roles; RLS es la defensa real).
//
// Props:
//   onApplied : callback tras aplicar OK (reload del tablero). Opcional.
//   tol       : umbral de tolerancia de monto (default 1). Diferencias por
//               debajo se ignoran (no se reportan ni se aplican).

const fmtMonto = (n) =>
  (n == null || isNaN(Number(n)))
    ? '—'
    : Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });

// Config visual de cada categoria del reporte.
const CATS = {
  auto_creadas:   { label: 'RMA nuevas (auto-creadas)', icon: Plus,          accent: 'emerald', accionable: true,  desc: 'No existian en la base; se crean en OC generada.' },
  a_aplicar:      { label: 'Avanzan a OC generada',     icon: ArrowRight,    accent: 'sky',     accionable: true,  desc: 'Estaban en RMA generada; pasan a OC generada.' },
  oma_nueva:      { label: 'OMA agregada',              icon: Layers,        accent: 'violet',  accionable: true,  desc: 'Ya en OC generada; se les suma una OMA nueva.' },
  montos_cambian: { label: 'Monto cambia · revisar',    icon: AlertTriangle, accent: 'amber',   accionable: true,  desc: 'El Excel trae un monto distinto al de la base. Revisá antes de aplicar.' },
  sin_cambios:    { label: 'Sin cambios',               icon: Equal,         accent: 'slate',   accionable: false, desc: 'Coinciden con la base; no se tocan.' },
  frenadas:       { label: 'Frenadas',                  icon: Ban,           accent: 'red',     accionable: false, desc: 'No se aplican; requieren revisión manual.' },
};

const ACCENT = {
  emerald: { bar: 'bg-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-600', text: 'text-emerald-700' },
  sky:     { bar: 'bg-sky-500',     bg: 'bg-sky-50',     border: 'border-sky-200',     icon: 'text-sky-600',     text: 'text-sky-700' },
  violet:  { bar: 'bg-violet-500',  bg: 'bg-violet-50',  border: 'border-violet-200',  icon: 'text-violet-600',  text: 'text-violet-700' },
  amber:   { bar: 'bg-amber-500',   bg: 'bg-amber-50',   border: 'border-amber-200',   icon: 'text-amber-600',   text: 'text-amber-800' },
  slate:   { bar: 'bg-slate-400',   bg: 'bg-slate-50',   border: 'border-slate-200',   icon: 'text-slate-500',   text: 'text-slate-600' },
  red:     { bar: 'bg-red-500',     bg: 'bg-red-50',     border: 'border-red-200',     icon: 'text-red-600',     text: 'text-red-700' },
};

const ORDER = ['montos_cambian', 'auto_creadas', 'a_aplicar', 'oma_nueva', 'frenadas', 'sin_cambios'];

export function ImportarView({ onApplied = null, tol = 1 }) {
  const fileRef = useRef(null);
  const [fileName, setFileName]   = useState(null);
  const [parseRes, setParseRes]   = useState(null);   // { payload, resumen, problemas, compartidas }
  const [parseErr, setParseErr]   = useState(null);
  const [preview, setPreview]     = useState(null);   // reporte dry-run
  const [busy, setBusy]           = useState(null);    // 'parse' | 'preview' | 'apply' | null
  const [excluded, setExcluded]   = useState(() => new Set()); // rmas excluidas del aplicar
  const [applyRes, setApplyRes]   = useState(null);
  const [rpcErr, setRpcErr]       = useState(null);

  function resetDesde(paso) {
    if (paso <= 1) { setParseRes(null); setParseErr(null); }
    setPreview(null);
    setExcluded(new Set());
    setApplyRes(null);
    setRpcErr(null);
  }

  async function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    resetDesde(1);
    setBusy('parse');
    try {
      const buf = await f.arrayBuffer();
      const res = parseOmaExcel(buf);
      setParseRes(res);
    } catch (err) {
      setParseErr(err.message || String(err));
    } finally {
      setBusy(null);
    }
  }

  async function handlePreview() {
    if (!parseRes) return;
    setBusy('preview');
    setRpcErr(null);
    setApplyRes(null);
    try {
      const { data, error } = await supabase.rpc('import_ocs', {
        p_payload: parseRes.payload, p_dry_run: true, p_tol: tol,
      });
      if (error) { setRpcErr(error.message); return; }
      setPreview(data);
      setExcluded(new Set());
    } catch (err) {
      setRpcErr(err.message || String(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleApply() {
    if (!parseRes || !preview) return;
    const payloadAplicar = parseRes.payload.filter(p => !excluded.has(p.rma));
    if (payloadAplicar.length === 0) { setRpcErr('No queda nada para aplicar (todo excluido).'); return; }
    const ok = window.confirm(
      `Vas a aplicar el import sobre ${payloadAplicar.length} RMA(s). ` +
      `Esta accion escribe en la base. ¿Confirmás?`
    );
    if (!ok) return;
    setBusy('apply');
    setRpcErr(null);
    try {
      const { data, error } = await supabase.rpc('import_ocs', {
        p_payload: payloadAplicar, p_dry_run: false, p_tol: tol,
      });
      if (error) { setRpcErr(error.message); return; }
      setApplyRes(data);
      if (onApplied) onApplied();
    } catch (err) {
      setRpcErr(err.message || String(err));
    } finally {
      setBusy(null);
    }
  }

  function toggleExcluir(rma) {
    setExcluded(prev => {
      const next = new Set(prev);
      if (next.has(rma)) next.delete(rma); else next.add(rma);
      return next;
    });
  }

  // Conteo de lo que efectivamente se va a aplicar (accionables no excluidas).
  const aAplicarCount = useMemo(() => {
    if (!preview) return 0;
    let n = 0;
    for (const key of Object.keys(CATS)) {
      if (!CATS[key].accionable) continue;
      for (const row of (preview[key] || [])) if (!excluded.has(row.rma)) n++;
    }
    return n;
  }, [preview, excluded]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center">
              <FileSpreadsheet size={18} className="text-sky-600" strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Importar OCs desde Excel</p>
              <p className="font-mono text-sm text-slate-900 font-semibold">
                {fileName ? fileName : 'Ningún archivo'} · {today}
              </p>
            </div>
          </div>
          <label className="px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 cursor-pointer transition-colors">
            <Upload size={15} />
            {fileName ? 'Cambiar archivo' : 'Subir Excel'}
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
          </label>
        </div>
      </div>

      {busy === 'parse' && (
        <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Parseando archivo…</div>
      )}

      {parseErr && (
        <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" /> <span>{parseErr}</span>
        </div>
      )}

      {/* ── Resumen del parseo ───────────────────────────────── */}
      {parseRes && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 sm:px-5 py-4">
            <h3 className="text-base font-semibold text-slate-900 mb-3">Archivo leído</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <Stat label="RMAs" value={parseRes.resumen.rmas} />
              <Stat label="OMAs" value={parseRes.resumen.omas} />
              <Stat label="Líneas" value={parseRes.resumen.filas} />
              <Stat label="Monto total" value={fmtMonto(parseRes.resumen.montoTotal)} mono />
            </div>

            {parseRes.compartidas.length > 0 && (
              <p className="text-[12px] text-slate-500 mb-2">
                <span className="font-medium text-slate-700">{parseRes.compartidas.length}</span> OMA(s) consolidada(s) en varias RMA (N→1):{' '}
                {parseRes.compartidas.map(c => `OC ${c.oc} (${c.rmas.length})`).join(', ')}
              </p>
            )}

            {parseRes.problemas.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-3">
                <p className="text-[12px] font-semibold text-amber-800 mb-1 flex items-center gap-1.5">
                  <AlertTriangle size={13} /> {parseRes.problemas.length} fila(s) con problemas
                </p>
                <ul className="text-[11px] text-amber-800 space-y-0.5 max-h-32 overflow-y-auto">
                  {parseRes.problemas.slice(0, 30).map((p, i) => (
                    <li key={i} className="font-mono">RMA {p.rma}{p.oc ? ` · OC ${p.oc}` : ''}: {p.motivo}</li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={handlePreview}
              disabled={busy !== null}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-md transition-colors disabled:opacity-40 flex items-center gap-2"
            >
              {busy === 'preview' ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              Previsualizar import
            </button>
          </div>
        </div>
      )}

      {rpcErr && (
        <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" /> <span>{rpcErr}</span>
        </div>
      )}

      {/* ── Preview / Resultado ──────────────────────────────── */}
      {preview && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2 px-1">
            <h3 className="text-[11px] uppercase tracking-wider text-slate-600 font-semibold">
              {applyRes ? 'Resultado del import' : 'Previsualización (no se escribió nada)'}
            </h3>
            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
              {Object.entries((applyRes || preview).totales).map(([k, v]) => (
                <span key={k}>{k}: <b className="text-slate-700">{v}</b></span>
              ))}
            </div>
          </div>

          {ORDER.map(key => (
            <CategoryCard
              key={key}
              catKey={key}
              rows={(applyRes || preview)[key] || []}
              excluded={excluded}
              onToggle={toggleExcluir}
              readOnly={!!applyRes}
            />
          ))}

          {!applyRes && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 sm:px-5 py-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600">
                Se van a aplicar <b className="text-slate-900">{aAplicarCount}</b> RMA(s).
                {excluded.size > 0 && <span className="text-slate-500"> ({excluded.size} excluida{excluded.size > 1 ? 's' : ''})</span>}
              </p>
              <button
                onClick={handleApply}
                disabled={busy !== null || aAplicarCount === 0}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-md transition-colors disabled:opacity-40 flex items-center gap-2"
              >
                {busy === 'apply' ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                Aplicar import
              </button>
            </div>
          )}

          {applyRes && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-md px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
              <CheckCircle2 size={16} /> Import aplicado. El tablero se actualizó.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, mono }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</p>
      <p className={`text-slate-900 font-semibold ${mono ? 'font-mono text-sm' : 'text-lg'}`}>{value}</p>
    </div>
  );
}

function CategoryCard({ catKey, rows, excluded, onToggle, readOnly }) {
  const cfg = CATS[catKey];
  const a   = ACCENT[cfg.accent];
  const Icon = cfg.icon;
  const [open, setOpen] = useState(catKey === 'montos_cambian' || catKey === 'frenadas');

  if (!rows.length) return null;

  return (
    <div className="relative bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className={`absolute left-0 top-4 bottom-4 w-[3px] rounded-r ${a.bar}`}></div>
      <button onClick={() => setOpen(o => !o)} className="w-full pl-5 pr-4 py-3 flex items-center gap-3 text-left">
        <div className={`w-8 h-8 rounded-md ${a.bg} ${a.border} border flex items-center justify-center shrink-0`}>
          <Icon size={15} className={a.icon} strokeWidth={2.2} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-slate-900 leading-tight">{cfg.label}</h4>
          <p className="text-[11px] text-slate-500 mt-0.5">{cfg.desc}</p>
        </div>
        <span className={`font-mono text-sm font-semibold ${a.text}`}>{rows.length}</span>
      </button>

      {open && (
        <div className="px-5 pb-3 overflow-x-auto">
          <table className="w-full text-[12px]">
            <tbody>
              {rows.map((r, i) => {
                const isExcl = excluded.has(r.rma);
                return (
                  <tr key={i} className={`border-t border-slate-100 ${isExcl ? 'opacity-40' : ''}`}>
                    {cfg.accionable && !readOnly && (
                      <td className="py-1.5 pr-2 w-8">
                        <input type="checkbox" checked={!isExcl} onChange={() => onToggle(r.rma)} title="Incluir en el import" />
                      </td>
                    )}
                    <td className="py-1.5 pr-3 font-mono text-slate-700 whitespace-nowrap">RMA {r.rma}{r.numero ? ` · ${r.numero}` : ''}</td>
                    <td className="py-1.5 text-slate-600">{describeRow(catKey, r)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function describeRow(catKey, r) {
  switch (catKey) {
    case 'montos_cambian':
      return <span className="font-mono">{fmtMonto(r.monto_viejo)} → <b className="text-amber-800">{fmtMonto(r.monto_nuevo)}</b></span>;
    case 'oma_nueva':
      return <span className="font-mono">OMAs {r.omas_antes} → {r.omas_despues} · total {fmtMonto(r.monto)}</span>;
    case 'auto_creadas':
      return <span className="font-mono">OC {r.oc_primaria} · {r.n_omas} OMA(s) · {fmtMonto(r.monto)}</span>;
    case 'a_aplicar':
      return <span className="font-mono">OC {r.oc_primaria} · {r.n_omas} OMA(s) · {fmtMonto(r.monto)}</span>;
    case 'sin_cambios':
      return <span className="font-mono text-slate-500">{r.section} · {r.n_omas} OMA(s)</span>;
    case 'frenadas':
      return <span className="text-red-700">{r.motivo}</span>;
    default:
      return null;
  }
}
