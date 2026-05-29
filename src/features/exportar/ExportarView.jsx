import React, { useMemo, useState } from 'react';
import {
  FileSpreadsheet, FileDown, Download, Check, Loader2,
  BarChart3, ListChecks, Activity, Clock, Building2, Truck, User
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { calculateStats } from '../dashboard/calculateStats';
import {
  buildResumen, buildSolicitudes, buildTrazabilidad,
  buildMetricasAntiguedad, buildPorArea, buildPorProveedor, buildPorSolicitante
} from './exportBuilders';

export function ExportarView({ tasks }) {
  const stats      = useMemo(() => calculateStats(tasks), [tasks]);
  const [exporting, setExporting] = useState(null);
  const [lastExport, setLastExport] = useState(null);
  const today = new Date().toISOString().slice(0, 10);

  // Auto-ancho de columnas basado en el header más largo
  function autoWidth(data) {
    if (!data.length) return [];
    return Object.keys(data[0]).map(k => ({ wch: Math.min(Math.max(k.length, 10) + 4, 50) }));
  }

  function exportSingle(name, label, builder) {
    setExporting(name);
    try {
      const data = builder();
      if (!data.length) return;
      const ws  = XLSX.utils.json_to_sheet(data);
      ws['!cols'] = autoWidth(data);
      const wb  = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, label);
      XLSX.writeFile(wb, `compras_${name}_${today}.xlsx`);
      setLastExport(label);
    } catch (e) {
      console.error('Error exportando:', e);
      alert('Error al generar el archivo: ' + (e.message || e));
    } finally {
      setTimeout(() => setExporting(null), 500);
    }
  }

  function exportCompleto() {
    setExporting('completo');
    try {
      const wb   = XLSX.utils.book_new();
      const hojas = [
        { name: 'Resumen',             data: buildResumen(stats) },
        { name: 'Solicitudes',         data: buildSolicitudes(tasks) },
        { name: 'Trazabilidad',        data: buildTrazabilidad(tasks) },
        { name: 'Metricas antiguedad', data: buildMetricasAntiguedad(stats) },
        { name: 'Por area',            data: buildPorArea(tasks) },
        { name: 'Por proveedor',       data: buildPorProveedor(stats) },
        { name: 'Por solicitante',     data: buildPorSolicitante(stats) }
      ];
      hojas.forEach(h => {
        if (!h.data.length) return;
        const ws    = XLSX.utils.json_to_sheet(h.data);
        ws['!cols'] = autoWidth(h.data);
        XLSX.utils.book_append_sheet(wb, ws, h.name);
      });
      XLSX.writeFile(wb, `compras_completo_${today}.xlsx`);
      setLastExport('Excel completo');
    } catch (e) {
      console.error('Error:', e);
      alert('Error al generar el archivo: ' + (e.message || e));
    } finally {
      setTimeout(() => setExporting(null), 500);
    }
  }

  const accents = {
    sky:    { bg: 'bg-sky-50',    border: 'border-sky-200',    icon: 'text-sky-600',    btn: 'bg-sky-600 hover:bg-sky-700' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', icon: 'text-orange-600', btn: 'bg-orange-600 hover:bg-orange-700' },
    emerald:{ bg: 'bg-emerald-50',border: 'border-emerald-200',icon: 'text-emerald-600',btn: 'bg-emerald-600 hover:bg-emerald-700' },
    violet: { bg: 'bg-violet-50', border: 'border-violet-200', icon: 'text-violet-600', btn: 'bg-violet-600 hover:bg-violet-700' }
  };

  const reportes = [
    { name: 'resumen',      label: 'Resumen',              desc: 'KPIs principales y métricas globales',      icon: BarChart3,   accent: 'sky',     count: 13,                           builder: () => buildResumen(stats) },
    { name: 'solicitudes',  label: 'Solicitudes',          desc: 'Listado completo con todos los campos',     icon: ListChecks,  accent: 'orange',  count: tasks.length,                 builder: () => buildSolicitudes(tasks) },
    { name: 'trazabilidad', label: 'Trazabilidad',         desc: 'Historial completo de eventos',             icon: Activity,    accent: 'violet',  count: tasks.reduce((a, t) => a + (t.history?.length || 0), 0), builder: () => buildTrazabilidad(tasks) },
    { name: 'metricas',     label: 'Métricas de antigüedad',desc: 'Cumplimiento de las 3 etapas',            icon: Clock,       accent: 'orange',  count: 3,                            builder: () => buildMetricasAntiguedad(stats) },
    { name: 'area',         label: 'Por área',             desc: 'Distribución y performance',               icon: Building2,   accent: 'emerald', count: 3,                            builder: () => buildPorArea(tasks) },
    { name: 'proveedor',    label: 'Por proveedor',        desc: 'Volumen por proveedor',                    icon: Truck,       accent: 'violet',  count: stats.proveedores.length,     builder: () => buildPorProveedor(stats) },
    { name: 'solicitante',  label: 'Por solicitante',      desc: 'Volumen por persona',                      icon: User,        accent: 'sky',     count: stats.solicitantes.length,    builder: () => buildPorSolicitante(stats) }
  ];

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center">
              <FileSpreadsheet size={18} className="text-emerald-600" strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Exportar a Excel</p>
              <p className="font-mono text-sm text-slate-900 font-semibold">{tasks.length} solicitudes · {today}</p>
            </div>
          </div>
          {lastExport && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-medium">
              <Check size={12} /> Último: {lastExport}
            </span>
          )}
        </div>
      </div>

      {/* Excel completo */}
      <div className="relative bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r bg-slate-900"></div>
        <div className="pl-5 pr-4 sm:pr-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Excel completo</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Un solo archivo con las 7 hojas (resumen, solicitudes, trazabilidad, métricas, área, proveedor, solicitante)
            </p>
          </div>
          <button
            onClick={exportCompleto}
            disabled={tasks.length === 0 || exporting !== null}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-md transition-colors disabled:opacity-40 flex items-center gap-2"
          >
            {exporting === 'completo' ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}
            Descargar Excel completo
          </button>
        </div>
      </div>

      {/* Reportes individuales */}
      <div>
        <h3 className="text-[11px] uppercase tracking-wider text-slate-600 font-semibold mb-3 px-1">Reportes individuales</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {reportes.map(r => {
            const a          = accents[r.accent];
            const Icon       = r.icon;
            const isExporting = exporting === r.name;
            return (
              <div key={r.name} className="relative bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className={`absolute left-0 top-4 bottom-4 w-[3px] rounded-r ${a.btn.split(' ')[0]}`}></div>
                <div className="pl-5 pr-4 py-4">
                  <div className="flex items-start gap-2 mb-2">
                    <div className={`w-8 h-8 rounded-md ${a.bg} ${a.border} border flex items-center justify-center shrink-0`}>
                      <Icon size={15} className={a.icon} strokeWidth={2.2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-slate-900 leading-tight">{r.label}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">{r.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="font-mono text-[10px] text-slate-500">{r.count} {r.count === 1 ? 'fila' : 'filas'}</span>
                    <button
                      onClick={() => exportSingle(r.name, r.label, r.builder)}
                      disabled={tasks.length === 0 || r.count === 0 || exporting !== null}
                      className={`px-2.5 py-1.5 text-white text-xs font-semibold rounded-md transition-colors disabled:opacity-40 flex items-center gap-1.5 ${a.btn}`}
                    >
                      {isExporting ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                      Descargar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-center text-xs text-slate-500 pt-2 font-mono">
        Los archivos se generan en el navegador · formato .xlsx
      </p>
    </div>
  );
}
