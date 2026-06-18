// importOcsParser.js
// Parsea el Excel "OMA al ..." (export del sistema origen) al payload que
// espera la RPC public.import_ocs(p_payload, p_dry_run, p_tol).
//
// Agregacion validada contra la base (compras-app):
//   - El Excel esta a nivel de LINEA DE ARTICULO. Una OMA (Nro OC) ocupa
//     varias filas + filas de comentario (Precio 0).
//   - Se agrupa por RMA -> por OC. monto de la OMA = sum(Precio) redondeado
//     a 2 decimales (criterio del backfill existente; NO se multiplica por
//     CantidadSolicitada).
//   - cod = CodProveedor (va a proveedor_adjudicado_codigo). NO es CodArticulo.
//   - fecha = FechaComp3 (la de la OMA), normalizada a ISO YYYY-MM-DD.
//
// Dependencia: SheetJS  ->  import * as XLSX from 'xlsx'
//
// Salida:
//   {
//     payload:     [{ rma, omas: [{ oc, proveedor, cod, monto, fecha }] }],
//     resumen:     { filas, rmas, omas, montoTotal },
//     problemas:   [{ rma, oc, motivo }],          // filas a revisar antes de enviar
//     compartidas: [{ oc, rmas: [...] }]           // OC bajo >1 RMA (consolidacion N->1, informativo)
//   }

import * as XLSX from 'xlsx';

// Nombres de columna del export. Si el sistema origen cambia los headers,
// se ajustan aca (no hace falta tocar la logica).
const COL = {
  rma:        'N° RMA',
  oc:         'Nro OC',
  proveedor:  'Proveedor',
  codProv:    'CodProveedor',
  fechaOma:   'FechaComp3',
  precio:     'Precio',
  cantidad:   'CantidadSolicitada', // no se usa para el monto; se conserva por si hace falta
};

const s = (v) => (v === null || v === undefined ? '' : String(v).trim());

function toNumber(v) {
  if (typeof v === 'number') return v;
  if (v === null || v === undefined || v === '') return 0;
  // tolera separador de miles "." y decimal "," por las dudas
  const n = parseFloat(String(v).replace(/\s/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

function toIsoDate(v) {
  if (v === null || v === undefined || s(v) === '') return null;
  // Date (cellDates:true). SheetJS ancla las fechas a UTC -> usar getUTC*
  // para evitar off-by-one por timezone local. *** VERIFICAR AL INTEGRAR ***
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    const y = v.getUTCFullYear();
    const mo = String(v.getUTCMonth() + 1).padStart(2, '0');
    const d = String(v.getUTCDate()).padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }
  // numero serial de Excel (si no se uso cellDates)
  if (typeof v === 'number') {
    const dc = XLSX.SSF && XLSX.SSF.parse_date_code ? XLSX.SSF.parse_date_code(v) : null;
    if (dc && dc.y) return `${dc.y}-${String(dc.m).padStart(2, '0')}-${String(dc.d).padStart(2, '0')}`;
    return null;
  }
  const t = s(v);
  let m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/); // DD/MM/YYYY o DD-MM-YYYY
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t; // ya ISO
  return null; // no se pudo parsear -> se reporta como problema
}

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * @param {ArrayBuffer|Uint8Array} fileData  contenido del .xlsx (p. ej. de file.arrayBuffer())
 * @returns objeto { payload, resumen, problemas, compartidas }
 */
export function parseOmaExcel(fileData) {
  const wb = XLSX.read(fileData, { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' }); // usa la primera fila como headers

  if (!rows.length) {
    return { payload: [], resumen: { filas: 0, rmas: 0, omas: 0, montoTotal: 0 }, problemas: [], compartidas: [] };
  }

  // valida que existan las columnas esperadas
  const headers = Object.keys(rows[0]);
  const faltantes = [COL.rma, COL.oc, COL.proveedor, COL.codProv, COL.fechaOma, COL.precio]
    .filter((c) => !headers.includes(c));
  if (faltantes.length) {
    throw new Error(`El Excel no tiene las columnas esperadas: ${faltantes.join(', ')}`);
  }

  // acc[rma][oc] = { oc, proveedor, cod, monto, fecha }
  const acc = new Map();           // rma -> Map(oc -> oma)
  const ocToRmas = new Map();      // oc  -> Set(rma)    (para detectar OC compartida)
  const problemas = [];
  let filasValidas = 0;

  for (const r of rows) {
    const rma = s(r[COL.rma]);
    const oc  = s(r[COL.oc]);
    const precio = toNumber(r[COL.precio]);

    if (!rma) { continue; } // fila sin RMA: se ignora (no deberia pasar en este export)
    if (Number.isNaN(precio)) {
      problemas.push({ rma, oc, motivo: `precio no numerico: "${r[COL.precio]}"` });
      continue;
    }
    filasValidas++;

    if (!acc.has(rma)) acc.set(rma, new Map());
    const ocMap = acc.get(rma);

    if (!ocMap.has(oc)) {
      ocMap.set(oc, {
        oc,
        proveedor: s(r[COL.proveedor]),
        cod:       s(r[COL.codProv]),
        monto:     0,
        fecha:     toIsoDate(r[COL.fechaOma]),
      });
    }
    ocMap.get(oc).monto += precio;

    if (!ocToRmas.has(oc)) ocToRmas.set(oc, new Set());
    ocToRmas.get(oc).add(rma);
  }

  // arma payload + valida
  const payload = [];
  let omasTotal = 0;
  let montoTotal = 0;

  for (const [rma, ocMap] of acc) {
    const omas = [];
    for (const oma of ocMap.values()) {
      oma.monto = round2(oma.monto);
      if (!oma.oc) problemas.push({ rma, oc: '', motivo: 'OMA sin numero de OC' });
      if (oma.fecha === null) problemas.push({ rma, oc: oma.oc, motivo: 'fecha de OMA invalida o vacia' });
      omas.push(oma);
      omasTotal++;
      montoTotal += oma.monto;
    }
    payload.push({ rma, omas });
  }

  // OCs compartidas por mas de una RMA (consolidacion N->1; informativo, no es error)
  const compartidas = [];
  for (const [oc, set] of ocToRmas) {
    if (set.size > 1) compartidas.push({ oc, rmas: [...set].sort() });
  }

  return {
    payload,
    resumen: {
      filas: filasValidas,
      rmas: payload.length,
      omas: omasTotal,
      montoTotal: round2(montoTotal),
    },
    problemas,
    compartidas,
  };
}
