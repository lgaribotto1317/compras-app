import React, { useState } from 'react';
import {
  Plus, Filter, LayoutGrid, BarChart3, Download, Loader2, Package
} from 'lucide-react';

import { SECTIONS, SECTION_BY_ID, FLOW_STEPS } from './lib/constants';
import { useSolicitudes } from './hooks/useSolicitudes';
import { useToast } from './hooks/useToast';
import { useAuth } from './hooks/useAuth';

// Features
import { LoginScreen }           from './features/auth/LoginScreen';
import { UserMenu }              from './features/auth/UserMenu';
import { ChangePasswordModal }   from './features/auth/ChangePasswordModal';
import { KanbanView }            from './features/kanban/KanbanView';
import { Dashboard }             from './features/dashboard/Dashboard';
import { ExportarView }          from './features/exportar/ExportarView';
import { TaskFormModal }         from './features/solicitudes/TaskFormModal';
import { DetailModal }           from './features/solicitudes/DetailModal';
import { AdvanceModal }          from './features/solicitudes/AdvanceModal';
import { CargarPresupuestoModal, QuitarPresupuestoModal, FiltersModal } from './features/solicitudes/FiltersModal';
import { CancelarSolicitudModal } from './features/solicitudes/CancelarSolicitudModal';

// Components
import { ConfirmModal } from './components/ui';
import { Toast }        from './components/ui';
import { EmptyState }   from './components/ui';
import { FiltersBanner } from './components/ui';
import { buildModalFilterChips, canCancel, canAdvance, canEdit, canBudget } from './lib/helpers';

// ─── INLINE STYLES & ANIMATIONS ──────────────────────────────────
// Se inyectan una sola vez en el root. En el proyecto Vite esto va
// al index.css o tailwind.config (ya definido en la Vuelta 1).
const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
  body { font-family: 'Inter', system-ui, sans-serif; }
  .font-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
  @keyframes slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  .animate-slide-up { animation: slide-up 0.3s ease-out; }
  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
  .animate-fade-in { animation: fade-in 0.2s ease-out; }
  .scrollbar-hide::-webkit-scrollbar { display: none; }
  .scrollbar-hide { scrollbar-width: none; }
  .form-input {
    width: 100%; padding: 0.625rem 0.75rem;
    border: 1px solid #cbd5e1; border-radius: 0.375rem;
    font-size: 0.875rem; outline: none;
  }
  .form-input:focus { ring: 2px; border-color: #0284c7; box-shadow: 0 0 0 2px rgba(2,132,199,0.2); }
`;

export default function App() {
  // ── Auth ─────────────────────────────────────────────────────────
  // Gate: si no hay sesión, mostramos LoginScreen y nada más se carga.
  // useAuth maneja la persistencia, el chequeo inicial y la suscripción
  // a cambios (incluyendo logout desde otro tab o expiración del token).
  const { user, userName, isAdmin, funcion, loading: authLoading, signIn, signOut } = useAuth();

  // ── Estado UI ────────────────────────────────────────────────────
  const [mainView,     setMainView]     = useState('kanban');   // 'kanban' | 'dashboard' | 'exportar'
  const [activeSection, setActiveSection] = useState('rma_solicitada');

  // Modales abiertos
  const [showNewModal,          setShowNewModal]          = useState(false);
  const [editingTask,           setEditingTask]           = useState(null);
  const [detailTask,            setDetailTask]            = useState(null);
  const [advancingTask,         setAdvancingTask]         = useState(null);
  const [confirmDelete,         setConfirmDelete]         = useState(null);
  const [cancellingTask,        setCancellingTask]        = useState(null);   // Bloque 4
  const [cargandoPresupuesto,   setCargandoPresupuesto]   = useState(null);
  const [quitandoPresupuesto,   setQuitandoPresupuesto]   = useState(null);
  const [showFilters,           setShowFilters]           = useState(false);
  const [showChangePassword,    setShowChangePassword]    = useState(false);

  // ── Lógica de negocio ────────────────────────────────────────────
  // useToast va primero para poder pasar showToast como onError handler
  // a useSolicitudes (fallos de Supabase muestran un toast rojo).
  const { toast, showToast } = useToast();

  const {
    tasks, filtered, counts, loading, hasActiveFilters,
    search, setSearch,
    filterPrioridad, setFilterPrioridad,
    filterArea,      setFilterArea,
    filterParada,    setFilterParada,
    filterAuditoria, setFilterAuditoria,
    includeCancelled, setIncludeCancelled,
    createTask, editTask, advanceTask, deleteTask, cancelTask,
    cargarPresupuesto, quitarPresupuesto,
    tasksInSection
  } = useSolicitudes({
    onError: msg => showToast(`⚠ ${msg}`, 'error')
  });

  // ── Handlers ─────────────────────────────────────────────────────

  async function handleCreate(data) {
    const result = await createTask(data);
    if (!result.ok) {
      // El toast ya lo disparó el hook vía onError. Solo evitamos cerrar el modal.
      return;
    }
    setShowNewModal(false);
    showToast(`✓ Solicitud creada · ${result.numero}`);
  }

  async function handleEdit(data) {
    const result = await editTask(editingTask.id, editingTask, data);
    if (!result.ok) return;
    setEditingTask(null);
    // Solo mostramos toast si efectivamente hubo cambios.
    if (!result.noop) showToast('✓ Solicitud actualizada');
  }

  async function handleAdvance(values) {
    const step   = FLOW_STEPS[advancingTask.section];
    const result = await advanceTask(advancingTask, values, step);
    if (!result.ok) {
      showToast(`⚠ ${result.error}`, 'error');
      return;
    }
    setAdvancingTask(null);
    showToast(`✓ ${step.label} · movida a ${SECTION_BY_ID[result.nextSection].name}`);
    setActiveSection(result.nextSection);
  }

  async function handleDelete() {
    const result = await deleteTask(confirmDelete.id);
    if (!result.ok) return;
    setConfirmDelete(null);
    setDetailTask(null);
    showToast('✓ Solicitud eliminada');
  }

  // Bloque 4: cancelación de solicitudes. El modal valida motivo mínimo
  // del lado cliente; cancelTask del hook lo manda a Supabase y el trigger
  // Postgres es defensa en profundidad.
  async function handleCancel(motivo) {
    const result = await cancelTask(cancellingTask.id, motivo);
    if (!result.ok) {
      // Re-lanzamos para que el modal muestre el error inline en vez de
      // dejarlo solo en el toast. Es el patrón que usa CancelarSolicitudModal.
      throw new Error(result.error || 'No se pudo cancelar.');
    }
    setCancellingTask(null);
    setDetailTask(null);
    showToast('✓ Solicitud cancelada');
  }

  async function handleCargarPresupuesto(attachment) {
    const result = await cargarPresupuesto(cargandoPresupuesto.id, attachment);
    if (!result.ok) return;
    // Actualizar detailTask si está abierto sobre la misma solicitud.
    // Nota: con el reload() interno del hook, esto es un refresco optimista
    // del modal; los datos reales vienen del próximo render.
    if (detailTask?.id === cargandoPresupuesto.id) {
      setDetailTask(prev => prev ? { ...prev, tienePresupuesto: true } : prev);
    }
    setCargandoPresupuesto(null);
    showToast('✓ Presupuesto cargado');
  }

  async function handleQuitarPresupuesto(motivo) {
    const result = await quitarPresupuesto(quitandoPresupuesto.id, motivo);
    if (!result.ok) return;
    if (detailTask?.id === quitandoPresupuesto.id) {
      setDetailTask(prev => prev ? { ...prev, tienePresupuesto: false, presupuestadaAt: null } : prev);
    }
    setQuitandoPresupuesto(null);
    showToast('✓ Presupuesto removido');
  }

  function handleGoToKanban(sectionId) {
    setMainView('kanban');
    if (sectionId) setActiveSection(sectionId);
  }

  // Limpia todos los filtros del modal (búsqueda, prioridad, área, parada,
  // auditoría, cancelados). Reutilizado por el botón "Limpiar" del modal y del banner.
  function clearModalFilters() {
    setSearch('');
    setFilterPrioridad('');
    setFilterArea('');
    setFilterParada(false);
    setFilterAuditoria(false);
    setIncludeCancelled(false);
  }

  // Chips actuales para el banner. Si no hay filtros activos del modal, es array vacío.
  const modalChips = buildModalFilterChips({ search, filterPrioridad, filterArea, filterParada, filterAuditoria, includeCancelled });

  // ── Render ───────────────────────────────────────────────────────

  // 1) Mientras chequea sesión persistida: spinner. Evita parpadeo de
  //    LoginScreen cuando el usuario ya estaba logueado.
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-slate-400" size={28} />
      </div>
    );
  }

  // 2) Sin sesión: pantalla de login. Nada más se carga (ni datos ni UI).
  if (!user) {
    return <LoginScreen onSignIn={signIn} />;
  }

  // 3) Con sesión: app completa.
  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <style>{globalStyles}</style>

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30">
        <div className="bg-slate-900 text-slate-100 border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <Logo />
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Menú de usuario: chip clickeable con dropdown
                  (Cambiar contraseña, Cerrar sesión). */}
              <UserMenu
                user={user}
                onChangePassword={() => setShowChangePassword(true)}
                onSignOut={signOut}
              />
              <div className="hidden md:flex flex-col items-end font-mono text-[11px] leading-tight">
                <span className="text-slate-100 font-semibold uppercase">
                  {new Date().toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
                <span className="text-slate-400">{tasks.length} {tasks.length === 1 ? 'solicitud' : 'solicitudes'}</span>
              </div>
              <button
                onClick={() => setShowNewModal(true)}
                className="bg-sky-600 hover:bg-sky-500 text-white px-3 py-2 rounded-lg flex items-center gap-1.5 text-sm font-medium transition-colors shadow-sm"
              >
                <Plus size={15} strokeWidth={2.5} />
                <span className="hidden sm:inline">Nueva solicitud</span>
                <span className="sm:hidden">Nueva</span>
              </button>
            </div>
          </div>

          {/* Tabs: Kanban / Dashboard / Exportar */}
          <div className="px-4 sm:px-6 border-t border-slate-800">
            <div className="max-w-7xl mx-auto flex gap-0">
              <ViewTab active={mainView === 'kanban'}    onClick={() => setMainView('kanban')}    icon={LayoutGrid} label="Kanban"    />
              <ViewTab active={mainView === 'dashboard'} onClick={() => setMainView('dashboard')} icon={BarChart3}  label="Dashboard" />
              <ViewTab active={mainView === 'exportar'}  onClick={() => setMainView('exportar')}  icon={Download}   label="Exportar"  />
              <div className="flex-1" />
              {(mainView === 'kanban' || mainView === 'dashboard') && (
                <button
                  onClick={() => setShowFilters(true)}
                  className="px-3 py-2.5 text-slate-400 hover:text-slate-100 transition-colors flex items-center gap-1.5 text-sm relative"
                >
                  <Filter size={14} />
                  <span className="hidden sm:inline">Filtros</span>
                  {hasActiveFilters && (
                    <span className="absolute top-2 right-1 w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs móvil de secciones (solo en kanban) */}
        {mainView === 'kanban' && (
          <div className="md:hidden bg-white border-b border-slate-200 px-2 overflow-x-auto scrollbar-hide">
            <div className="flex gap-1 py-2 min-w-max">
              {SECTIONS.map(s => {
                const Icon     = s.icon;
                const isActive = activeSection === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveSection(s.id)}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-medium whitespace-nowrap transition-all ${
                      isActive ? 'bg-slate-900 text-slate-50' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Package size={13} />
                    {s.name}
                    <span className={`ml-0.5 px-1.5 rounded-full text-[10px] font-mono font-semibold ${
                      isActive ? 'bg-slate-50 text-slate-900' : 'bg-white text-slate-700'
                    }`}>
                      {counts[s.id] || 0}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* ── MAIN ───────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-5 sm:py-8 pb-32">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Loader2 className="animate-spin mb-3" size={28} />
            <p className="text-sm">Cargando...</p>
          </div>
        ) : tasks.length === 0 ? (
          <EmptyState onCreate={() => setShowNewModal(true)} />
        ) : mainView === 'dashboard' ? (
          <Dashboard
            tasks={filtered}
            totalTasksUnfiltered={tasks.length}
            modalChips={modalChips}
            onClearModalFilters={clearModalFilters}
            onGoToKanban={handleGoToKanban}
            onCardClick={setDetailTask}
          />
        ) : mainView === 'exportar' ? (
          <ExportarView tasks={tasks} />
        ) : (
          <>
            {/* Banner de filtros activos (solo Kanban; en Dashboard se arma adentro
                porque suma el chip de período del filtro de fechas). */}
            {modalChips.length > 0 && (
              <div className="mb-4">
                <FiltersBanner
                  chips={modalChips}
                  filteredCount={filtered.length}
                  totalCount={tasks.length}
                  onClear={clearModalFilters}
                />
              </div>
            )}
            <KanbanView
              activeSection={activeSection}
              setActiveSection={setActiveSection}
              tasksInSection={tasksInSection}
              onCardClick={setDetailTask}
              onAdvance={setAdvancingTask}
              onCargarPresupuesto={setCargandoPresupuesto}
              user={user}
            />
          </>
        )}
      </main>

      {/* ── MODALES ────────────────────────────────────────────── */}

      {showNewModal && (
        <TaskFormModal
          mode="create"
          defaultSolicitante={userName}
          onClose={() => setShowNewModal(false)}
          onSubmit={handleCreate}
        />
      )}

      {editingTask && (
        <TaskFormModal
          mode="edit"
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSubmit={handleEdit}
        />
      )}

      {advancingTask && (
        <AdvanceModal
          task={advancingTask}
          step={FLOW_STEPS[advancingTask.section]}
          fromSection={SECTION_BY_ID[advancingTask.section]}
          toSection={SECTION_BY_ID[FLOW_STEPS[advancingTask.section].next]}
          allTasks={tasks}
          onClose={() => setAdvancingTask(null)}
          onSubmit={handleAdvance}
        />
      )}

      {detailTask && (
        <DetailModal
          task={detailTask}
          canCancel={canCancel(detailTask, user)}
          canDelete={isAdmin}
          canEdit={canEdit(detailTask, user)}
          canAdvance={canAdvance(detailTask, user)}
          canBudget={canBudget(detailTask, user)}
          onClose={() => setDetailTask(null)}
          onEdit={() => { setEditingTask(detailTask); setDetailTask(null); }}
          onDelete={() => setConfirmDelete(detailTask)}
          onAdvance={() => { setAdvancingTask(detailTask); setDetailTask(null); }}
          onCancel={() => { setCancellingTask(detailTask); setDetailTask(null); }}
          onCargarPresupuesto={() => { setCargandoPresupuesto(detailTask); setDetailTask(null); }}
          onQuitarPresupuesto={() => { setQuitandoPresupuesto(detailTask); setDetailTask(null); }}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="¿Eliminar solicitud?"
          message={`Se va a eliminar "${confirmDelete.name}". Queda registrada en la base como eliminada (soft delete) pero deja de aparecer en el Kanban. Solo se puede recuperar manualmente.`}
          confirmLabel="Eliminar"
          danger
          onClose={() => setConfirmDelete(null)}
          onConfirm={handleDelete}
        />
      )}

      {cancellingTask && (
        <CancelarSolicitudModal
          task={cancellingTask}
          onClose={() => setCancellingTask(null)}
          onSubmit={handleCancel}
        />
      )}

      {showFilters && (
        <FiltersModal
          search={search}           setSearch={setSearch}
          filterPrioridad={filterPrioridad} setFilterPrioridad={setFilterPrioridad}
          filterArea={filterArea}   setFilterArea={setFilterArea}
          filterParada={filterParada}       setFilterParada={setFilterParada}
          filterAuditoria={filterAuditoria} setFilterAuditoria={setFilterAuditoria}
          includeCancelled={includeCancelled} setIncludeCancelled={setIncludeCancelled}
          onClose={() => setShowFilters(false)}
          onClear={clearModalFilters}
        />
      )}

      {cargandoPresupuesto && (
        <CargarPresupuestoModal
          task={cargandoPresupuesto}
          onClose={() => setCargandoPresupuesto(null)}
          onSubmit={handleCargarPresupuesto}
        />
      )}

      {quitandoPresupuesto && (
        <QuitarPresupuestoModal
          task={quitandoPresupuesto}
          onClose={() => setQuitandoPresupuesto(null)}
          onSubmit={handleQuitarPresupuesto}
        />
      )}

      {showChangePassword && (
        <ChangePasswordModal
          user={user}
          onClose={() => setShowChangePassword(false)}
          onSuccess={() => showToast('✓ Contraseña actualizada')}
        />
      )}

      {/* ── TOAST ──────────────────────────────────────────────── */}
      <Toast toast={toast} />
    </div>
  );
}

// ─── Sub-componentes del header ───────────────────────────────────

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center shadow-sm border border-slate-600">
        <Package size={18} className="text-sky-300" strokeWidth={2.2} />
      </div>
      <div>
        <h1 className="font-semibold text-[15px] text-slate-50 leading-tight">Gestión de Compras</h1>
        <p className="text-[11px] text-slate-400 leading-tight mt-0.5">Sistema integral · RMAs, OCs, dashboard y estadísticas</p>
      </div>
    </div>
  );
}

function ViewTab({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-1.5 ${
        active ? 'text-sky-400' : 'text-slate-400 hover:text-slate-200'
      }`}
    >
      <Icon size={15} strokeWidth={active ? 2.3 : 2} />
      {label}
      {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-400"></span>}
    </button>
  );
}
