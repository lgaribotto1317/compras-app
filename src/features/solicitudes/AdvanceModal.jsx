import React, { useState } from 'react';
import { ChevronRight, AlertTriangle } from 'lucide-react';
import { CAMPOS_UNICOS } from '../../lib/constants';
import { normalizarIdentificador } from '../../lib/helpers';
import { ModalShell, Field, ModalActions } from '../../components/ModalShell';

export function AdvanceModal({ task, step, fromSection, toSection, allTasks = [], onClose, onSubmit }) {
  const [values, setValues] = useState({});

  // Busca si el valor de un campo único ya está en otra solicitud.
  function findDuplicate(fieldKey, val) {
    const norm = normalizarIdentificador(val);
    if (!norm) return null;
    return allTasks.find(t => {
      if (t.id === task.id) return false;
      return normalizarIdentificador(t[fieldKey]) === norm;
    }) || null;
  }

  // Mapa de duplicados detectados en los campos del step actual
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
    if (CAMPOS_UNICOS[f.key] && duplicates[f.key]) return false;
    return true;
  });

  function handleNumericInput(key, raw, integer) {
    const cleaned = integer
      ? raw.replace(/[^\d]/g, '')
      : raw.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
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
          submitLabel={step.label}
        />
      }
    >

      {/* Resumen de la solicitud + transición de sección */}
      <div className="bg-slate-50 rounded-md border border-slate-200 p-3 mb-4">
        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Solicitud</p>
        <p className="text-sm font-semibold text-slate-900 mt-1">{task.name}</p>
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
          const inputBase   = 'w-full px-3 py-2.5 border rounded-md text-sm focus:outline-none focus:ring-2';
          const inputBorder = hasDup
            ? 'border-red-400 focus:ring-red-500 focus:border-red-500'
            : 'border-slate-300 focus:ring-sky-600 focus:border-sky-600';

          return (
            <Field key={f.key} label={f.label} required={f.required}>
              {f.multiline ? (
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
                  pattern={f.integer ? '[0-9]*' : '[0-9.]*'}
                  value={values[f.key] || ''}
                  onChange={e => handleNumericInput(f.key, e.target.value, f.integer)}
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

              {hasDup && (
                <p className="mt-1.5 text-[11px] text-red-600 flex items-start gap-1.5">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  <span>
                    Este {CAMPOS_UNICOS[f.key]} ya está usado en la solicitud{' '}
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
