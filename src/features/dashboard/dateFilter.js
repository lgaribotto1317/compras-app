// ─── FILTRO DE FECHAS DEL DASHBOARD ──────────────────────────────
// Modelo 1 (selectores de período cerrado), multi-año desde 2026.
// Filtra por createdAt de las solicitudes.
//
// Forma del período:
//   { kind: 'all' }
//   { kind: 'week' }                            // esta semana en curso (lun-dom)
//   { kind: 'month',    year, month }           // month: 1..12
//   { kind: 'quarter',  year, q }               // q: 1..4
//   { kind: 'semester', year, s }               // s: 1..2
//   { kind: 'year',     year }
//   { kind: 'custom',   from, to }              // YYYY-MM-DD inclusive
//
// El año mínimo es APP_START_YEAR (2026, cuando arrancó la app).

export const APP_START_YEAR = 2026;

// Genera el rango de años disponibles: desde APP_START_YEAR hasta el año actual.
// Si en 2027 querés ver 2026, va a aparecer. Se ajusta solo con el paso del tiempo.
export function getAvailableYears() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear; y >= APP_START_YEAR; y--) years.push(y);
  return years;
}

// Default: sin filtro
export const DEFAULT_PERIOD = { kind: 'all' };

// ─── CÁLCULO DE BORDES DE PERÍODO ────────────────────────────────
// Devuelve { from: Date, to: Date } en el huso local. `to` es el último
// instante del último día (23:59:59.999) para que la comparación sea inclusive.
// Si el período no es válido, devuelve null.
export function periodBounds(period) {
  if (!period || period.kind === 'all') return null;

  const now = new Date();

  if (period.kind === 'week') {
    // Lunes a domingo de la semana en curso (Argentina/Europa: lunes como primer día).
    const day  = now.getDay();              // 0 = dom, 1 = lun, ..., 6 = sab
    const diff = day === 0 ? 6 : day - 1;   // cuántos días retroceder al lunes
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff, 0, 0, 0, 0);
    const to   = new Date(from);
    to.setDate(to.getDate() + 6);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }

  if (period.kind === 'month') {
    const { year, month } = period;
    if (!year || !month) return null;
    const from = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const to   = new Date(year, month, 0, 23, 59, 59, 999);  // día 0 del mes siguiente = último día del mes
    return { from, to };
  }

  if (period.kind === 'quarter') {
    const { year, q } = period;
    if (!year || !q) return null;
    const startMonth = (q - 1) * 3;     // Q1→0, Q2→3, Q3→6, Q4→9
    const from = new Date(year, startMonth,     1, 0, 0, 0, 0);
    const to   = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
    return { from, to };
  }

  if (period.kind === 'semester') {
    const { year, s } = period;
    if (!year || !s) return null;
    const startMonth = (s - 1) * 6;     // S1→0, S2→6
    const from = new Date(year, startMonth,     1, 0, 0, 0, 0);
    const to   = new Date(year, startMonth + 6, 0, 23, 59, 59, 999);
    return { from, to };
  }

  if (period.kind === 'year') {
    const { year } = period;
    if (!year) return null;
    const from = new Date(year,     0, 1, 0, 0, 0, 0);
    const to   = new Date(year, 11, 31, 23, 59, 59, 999);
    return { from, to };
  }

  if (period.kind === 'custom') {
    const { from: f, to: t } = period;
    if (!f || !t) return null;
    const from = new Date(f + 'T00:00:00');
    const to   = new Date(t + 'T23:59:59.999');
    if (isNaN(from) || isNaN(to) || from > to) return null;
    return { from, to };
  }

  return null;
}

// ─── FILTRO ──────────────────────────────────────────────────────
// Aplica el período sobre el array de tasks, comparando contra createdAt.
// Si el período es 'all' o inválido, devuelve tasks tal cual.
export function filterTasksByPeriod(tasks, period) {
  const bounds = periodBounds(period);
  if (!bounds) return tasks;
  const fromMs = bounds.from.getTime();
  const toMs   = bounds.to.getTime();
  return tasks.filter(t => {
    const c = new Date(t.createdAt).getTime();
    return c >= fromMs && c <= toMs;
  });
}

// ─── LABEL HUMANO ────────────────────────────────────────────────
// Texto legible del período para mostrar en el banner.
const MES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                   'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function periodLabel(period) {
  if (!period || period.kind === 'all') return 'Todo el histórico';
  if (period.kind === 'week')     return 'Esta semana';
  if (period.kind === 'month')    return `${MES_LARGO[period.month - 1]} ${period.year}`;
  if (period.kind === 'quarter')  return `Q${period.q} ${period.year}`;
  if (period.kind === 'semester') return `S${period.s} ${period.year}`;
  if (period.kind === 'year')     return `Año ${period.year}`;
  if (period.kind === 'custom')   return `${period.from} → ${period.to}`;
  return '';
}

export const MES_OPTIONS = MES_LARGO.map((label, i) => ({ value: i + 1, label }));
