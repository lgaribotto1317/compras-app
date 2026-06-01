import React, { useState } from 'react';
import { ChevronRight, AlertTriangle, Layers } from 'lucide-react';
import { CAMPOS_UNICOS } from '../../lib/constants';
import { normalizarIdentificador } from '../../lib/helpers';
import { ModalShell, Field, ModalActions } from '../../components/ModalShell';
import { ProveedorCombobox } from '../../components/ProveedorCombobox';

// AdvanceModal: avanza UNA o VARIAS solicitudes (consolidación N→1) en una
// sola operación. `tasks` es el array de filas a avanzar (1 o N). `excludeIds`
// son los ids que NO cuentan como colisión de unicidad (= los que van a
// compartir el número del grupo). El resto de la base sí cuenta: un número no
// puede pertenecer a otro grupo.
export function AdvanceModal({
  tasks = [], step, fromSection, toSection,
  allTasks = [], excludeIds = [],
  proveedores = [], loadingProveedores = false,
  onClose, onSubmit
}) {
  const [values, setValues] = useState({});

  const excludeSet = new Set(excludeIds.length ? excludeIds : tasks.map(t => t.id));
  const esConsolidado = tasks.length > 1;

  // Busca si el valor de un campo único ya está en una fila FUERA de la selección.
  function findDuplicate(fieldKey, val) {
    const norm = normalizarIdentificador(val);
    if (!norm) return null;
    return allTasks.find(t => {
      if (excludeSet.has(t.id)) return false;
      return normalizarIdentificador(t[fieldKey]) === norm;
    }) || null;
  }

  const duplicates = {};
  step.fields.forEach(f => {
    if (CAMPOS_UNICOS[f.key]) {
      const dup = findDuplicate(f.key, values[f.key]);
      if (dup) duplicates[f.key] = dup;
    }
  });

  const fieldsValid = step.fields.every(f => {
    const v = (values[f.key] || '').trim();
    if (f.required && !v) return false;
    if (f.integer && v && !/^\d+$/.test(v)) return false;
    if (f.digits && v && !new RegExp(`^\\d{${f.digits}}$`).test(v)) return false;
    if (CAMPOS_UNICOS[f.key] && duplicates[f.key]) return false;
    return true;
  });

  function handleNumericInput(key, raw, f) {
    let cleaned = (f.integer || f.digits)
      ? raw.replace(/[^\d]/g, '')
      : raw.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
    if (f.digits) cleaned = cleaned.slice(0, f.digits);
    setValues({ ...values, [key]: cleaned });
  }

  return (
    <ModalShell
      onClose={onClose}
      title={step.title}
      subtitle={step.subtitle}
      footer={
        <ModalActions
          onClose={onClose}
          onSubmit={() => onSubmit(values)}
          disabled={!fieldsValid}
          submitLabel={esConsolidado ? `${step.label} · ${tasks.length}` : step.label}
        />
      }
    >

      {/* Resumen de la(s) solicitud(es) + transición de sección */}
      <div className="bg-slate-50 rounded-md border border-slate-200 p-3 mb-4">
        {esConsolidado ? (
          <>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1.5">
              <Layers size={12} strokeWidth={2.5} />
              Consolidando {tasks.length} solicitudes
            </p>
            <div className="mt-1.5 max-h-28 overflow-y-auto space-y-1">
              {tasks.map(t => (
                <div key={t.id} className="flex items-center gap-2 text-[11px] text-slate-700">
                  <span className="font-mono text-slate-500 shrink-0">{t.numero || '—'}</span>
                  <span className="truncate">
                    {t.rmaNumber ? `RMA ${t.rmaNumber}` : t.name}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-2">
              Todas reciben el mismo número y avanzan juntas.
            </p>
          </>
        ) : (
          <>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Solicitud</p>
            <p className="text-sm font-semibold text-slate-900 mt-1">{tasks[0]?.name}</p>
          </>
        )}
        <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-600 flex-wrap">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium ${fromSection?.chip}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${fromSection?.dot}`}></span>
            {fromSection?.short}
          </span>
          <ChevronRight size={11} className="text-slate-400" />
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium ${toSection?.chip}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${toSection?.dot}`}></span>
            {toSection?.short}
          </span>
        </div>
      </div>

      <div className="space-y-3.5">
        {step.fields.map(f => {
          const dup    = duplicates[f.key];
          const hasDup = !!dup;
          const vCur   = (values[f.key] || '').trim();
          const badDigits = f.digits && vCur && !new RegExp(`^\\d{${f.digits}}$`).test(vCur);
          const inputBase   = 'w-full px-3 py-2.5 border rounded-md text-sm focus:outline-none focus:ring-2';
          const inputBorder = (hasDup || badDigits)
            ? 'border-red-400 focus:ring-red-500 focus:border-red-500'
            : 'border-slate-300 focus:ring-sky-600 focus:border-sky-600';

          return (
            <Field key={f.key} label={f.label} required={f.required}>
              {f.widget === 'proveedor' ? (
                <ProveedorCombobox
                  value={values[f.key] || ''}
                  codigo={values[f.codeKey] ?? null}
                  proveedores={proveedores}
                  loading={loadingProveedores}
                  placeholder={f.placeholder}
                  onChange={({ name, codigo }) =>
                    setValues({ ...values, [f.key]: name, [f.codeKey]: codigo })
                  }
                />
              ) : f.multiline ? (
                <textarea
                  value={values[f.key] || ''}
                  onChange={e => setValues({ ...values, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  rows={3}
                  className={`${inputBase} ${inputBorder} resize-none`}
                />
              ) : f.type === 'number' ? (
                <input
                  type="text"
                  inputMode="numeric"
                  pattern={(f.integer || f.digits) ? '[0-9]*' : '[0-9.]*'}
                  value={values[f.key] || ''}
                  onChange={e => handleNumericInput(f.key, e.target.value, f)}
                  placeholder={f.placeholder}
                  className={`${inputBase} ${inputBorder} font-mono`}
                />
              ) : (
                <input
                  type={f.type || 'text'}
                  value={values[f.key] || ''}
                  onChange={e => setValues({ ...values, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  className={`${inputBase} ${inputBorder}`}
                />
              )}

              {badDigits && !hasDup && (
                <p className="mt-1.5 text-[11px] text-red-600 flex items-start gap-1.5">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  <span>{f.label} debe tener exactamente {f.digits} dígitos numéricos</span>
                </p>
              )}

              {hasDup && (
                <p className="mt-1.5 text-[11px] text-red-600 flex items-start gap-1.5">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  <span>
                    Este {CAMPOS_UNICOS[f.key]} ya pertenece a otro grupo:{' '}
                    <span className="font-mono font-semibold">{dup.numero || `#${dup.id}`}</span>
                    {dup.name && <>: <span className="font-medium">{dup.name}</span></>}
                  </span>
                </p>
              )}
            </Field>
          );
        })}
      </div>
    </ModalShell>
  );
}
