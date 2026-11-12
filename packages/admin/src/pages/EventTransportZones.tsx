import { useEffect, useMemo, useState, type FormEvent } from 'react';

interface EventTransportZone {
  id: string;
  name: string;
  city: string;
  neighborhoods: string[];
  feeCop: number;
  isActive: boolean;
}

type StatusFilter = 'all' | 'active' | 'inactive';

const fieldClass = 'w-full rounded-xl border border-[#DDCFC5] bg-white px-3.5 py-2.5 text-sm text-[#321923] outline-none transition focus:border-[#B47B32] focus:ring-2 focus:ring-[#D7A64D]/20';
const labelClass = 'mb-1.5 block text-sm font-semibold text-[#4B3440]';
const formatCop = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0);
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('es');

function parseAreas(value: string) {
  return value.split(/[\r\n,;]+/).map(item => item.trim().replace(/\s+/g, ' ')).filter(Boolean)
    .filter((item, index, all) => all.findIndex(other => normalize(other) === normalize(item)) === index);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token') || '';
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
    },
  });
  const result = await response.json().catch(() => null) as ({ success?: boolean; data?: T; error?: string } | null);
  if (!response.ok || !result?.success) throw new Error(result?.error || 'No fue posible completar la operación.');
  return result.data as T;
}

export default function EventTransportZones() {
  const [zones, setZones] = useState<EventTransportZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [areasText, setAreasText] = useState('');
  const [feeCop, setFeeCop] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadZones = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await request<EventTransportZone[]>('/event-delivery-zones');
      setZones(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar las tarifas de eventos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadZones(); }, []);

  const activeZones = zones.filter(zone => zone.isActive);
  const activeCities = new Set(activeZones.map(zone => normalize(zone.city)).filter(Boolean));
  const specificAreas = new Set(activeZones.flatMap(zone => zone.neighborhoods.map(area => `${normalize(zone.city)}::${normalize(area)}`)));
  const visibleZones = useMemo(() => {
    const query = normalize(search);
    return zones.filter(zone => {
      if (statusFilter === 'active' && !zone.isActive) return false;
      if (statusFilter === 'inactive' && zone.isActive) return false;
      if (!query) return true;
      return normalize([zone.name, zone.city, ...zone.neighborhoods].join(' ')).includes(query);
    });
  }, [zones, search, statusFilter]);

  const resetForm = () => {
    setEditingId(null); setName(''); setCity(''); setAreasText(''); setFeeCop('');
    setIsActive(true); setShowForm(false); setError('');
  };

  const startCreate = () => { resetForm(); setSuccess(''); setShowForm(true); };
  const startEdit = (zone: EventTransportZone) => {
    setEditingId(zone.id); setName(zone.name); setCity(zone.city);
    setAreasText(zone.neighborhoods.join('\n')); setFeeCop(String(zone.feeCop));
    setIsActive(zone.isActive); setShowForm(true); setError(''); setSuccess('');
  };

  const findConflicts = (targetCity: string, requestedAreas: string[], ignoredId: string | null) => {
    const requested = new Set(requestedAreas.map(normalize));
    const conflicts: string[] = [];
    for (const zone of zones) {
      if (!zone.isActive || zone.id === ignoredId || normalize(zone.city) !== normalize(targetCity)) continue;
      // A city-wide base tariff may coexist with specific sectors. Specific sectors override it.
      if (requestedAreas.length === 0 && zone.neighborhoods.length === 0) conflicts.push(`tarifa general de ${zone.name}`);
      if (requestedAreas.length > 0 && zone.neighborhoods.length > 0) {
        const overlaps = zone.neighborhoods.filter(area => requested.has(normalize(area)));
        if (overlaps.length) conflicts.push(...overlaps.map(area => `${area} (${zone.name})`));
      }
    }
    return conflicts;
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(''); setSuccess('');
    const areas = parseAreas(areasText);
    const fee = Number(feeCop);
    if (!name.trim() || !city.trim()) { setError('Completa el nombre de la zona y el municipio.'); return; }
    if (areas.length > 100) { setError('Puedes registrar hasta 100 barrios o sectores por zona.'); return; }
    if (feeCop.trim() === '' || !Number.isSafeInteger(fee) || fee < 0 || fee > 1000000000) {
      setError('Indica una tarifa válida en pesos colombianos. Escribe 0 solo cuando el transporte sea gratuito.'); return;
    }
    const willBeActive = editingId ? isActive : true;
    if (willBeActive) {
      const conflicts = findConflicts(city, areas, editingId);
      if (conflicts.length) {
        setError(`Hay una tarifa activa que se cruza con esta zona: ${conflicts.slice(0, 5).join(', ')}. Puedes usar una tarifa general para todo el municipio y crear sectores específicos con prioridad.`);
        return;
      }
    }
    setSaving(true);
    try {
      const payload = { name: name.trim(), city: city.trim(), neighborhoods: areas, feeCop: fee };
      if (editingId) {
        await request(`/event-delivery-zones/${encodeURIComponent(editingId)}`, { method: 'PATCH', body: JSON.stringify({ ...payload, isActive }) });
        setSuccess('La tarifa de transporte del evento se actualizó correctamente.');
      } else {
        await request('/event-delivery-zones', { method: 'POST', body: JSON.stringify(payload) });
        setSuccess('La zona de transporte para eventos quedó creada y activa.');
      }
      resetForm(); await loadZones();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible guardar la tarifa.');
    } finally { setSaving(false); }
  };

  const toggleActive = async (zone: EventTransportZone) => {
    setError(''); setSuccess('');
    if (!zone.isActive) {
      const conflicts = findConflicts(zone.city, zone.neighborhoods, zone.id);
      if (conflicts.length) { setError(`No se puede activar porque se cruza con: ${conflicts.slice(0, 5).join(', ')}.`); return; }
    }
    setBusyId(zone.id);
    try {
      await request(`/event-delivery-zones/${encodeURIComponent(zone.id)}`, { method: 'PATCH', body: JSON.stringify({ isActive: !zone.isActive }) });
      setSuccess(zone.isActive ? 'La zona quedó pausada.' : 'La zona está activa para cotizar eventos.');
      await loadZones();
    } catch (err) { setError(err instanceof Error ? err.message : 'No fue posible cambiar el estado.'); }
    finally { setBusyId(null); }
  };

  const deleteZone = async (zone: EventTransportZone) => {
    if (!window.confirm(`¿Eliminar la tarifa de transporte “${zone.name}”? Las cotizaciones ya guardadas conservan su valor. Esta acción no elimina solicitudes de eventos.`)) return;
    setBusyId(zone.id); setError(''); setSuccess('');
    try {
      await request(`/event-delivery-zones/${encodeURIComponent(zone.id)}`, { method: 'DELETE' });
      setSuccess('La tarifa se eliminó correctamente.'); await loadZones();
    } catch (err) { setError(err instanceof Error ? err.message : 'No fue posible eliminar la tarifa.'); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#B47B32]">Cobertura para celebraciones</p>
          <h2 className="mt-1 text-2xl font-bold text-[#321923]">Transporte de eventos especiales</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Configura tarifas independientes de los domicilios de hamburguesas, perros, tamales y demás productos del menú. El valor se sugiere en cada cotización y puedes ajustarlo según el evento.</p>
        </div>
        <button type="button" onClick={startCreate} className="rounded-xl bg-[#74152F] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5E1026]">+ Agregar zona de eventos</button>
      </header>

      {(error || success) && <div role={error ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{error || success}</div>}

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#F0DFCD] bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Zonas activas</p><p className="mt-2 text-3xl font-bold text-[#74152F]">{activeZones.length}</p><p className="mt-1 text-xs text-slate-500">Disponibles para cotizar eventos</p></div>
        <div className="rounded-2xl border border-[#F0DFCD] bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Municipios cubiertos</p><p className="mt-2 text-3xl font-bold text-[#74152F]">{activeCities.size}</p><p className="mt-1 text-xs text-slate-500">Con tarifa activa para eventos</p></div>
        <div className="rounded-2xl border border-[#F0DFCD] bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sectores específicos</p><p className="mt-2 text-3xl font-bold text-[#74152F]">{specificAreas.size}</p><p className="mt-1 text-xs text-slate-500">Con precio propio por sector</p></div>
      </section>

      <section className="rounded-2xl border border-[#F0DFCD] bg-gradient-to-r from-[#FFF8EF] to-[#FFF1EA] p-5 text-sm leading-6 text-[#5B4450]">
        <p className="font-bold text-[#321923]">Cómo organizar las tarifas de eventos</p>
        <p className="mt-1">Puedes crear una tarifa general para todo un municipio dejando vacía la lista de barrios. Si un sector requiere un valor diferente —por ejemplo, El Poblado dentro de Medellín— crea una zona específica para ese sector: su tarifa tendrá prioridad sobre la general. Las tarifas de productos del menú no se modifican.</p>
        <p className="mt-2 text-xs">No se precargan municipios, barrios ni precios. Tú defines la cobertura y el costo. Un valor de $0 significa transporte gratuito.</p>
      </section>

      {showForm && <form onSubmit={handleSave} className="space-y-4 rounded-2xl border border-[#EAD6C6] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-bold text-[#321923]">{editingId ? 'Editar tarifa de evento' : 'Nueva zona de transporte para eventos'}</h3>{editingId && <label className="flex items-center gap-2 text-sm font-medium text-[#4B3440]"><input type="checkbox" checked={isActive} onChange={event => setIsActive(event.target.checked)} className="h-4 w-4 accent-[#74152F]"/> Zona activa</label>}</div>
        <div className="grid gap-4 md:grid-cols-2">
          <div><label className={labelClass} htmlFor="event-zone-name">Nombre de la zona</label><input id="event-zone-name" value={name} onChange={event => setName(event.target.value)} className={fieldClass} placeholder="Ej. Caldas - tarifa general" maxLength={100} required/></div>
          <div><label className={labelClass} htmlFor="event-zone-city">Municipio</label><input id="event-zone-city" value={city} onChange={event => setCity(event.target.value)} className={fieldClass} placeholder="Ej. Caldas, Antioquia" maxLength={100} required/></div>
          <div className="md:col-span-2"><label className={labelClass} htmlFor="event-zone-areas">Barrios o sectores específicos (opcional)</label><textarea id="event-zone-areas" value={areasText} onChange={event => setAreasText(event.target.value)} className={fieldClass} rows={3} placeholder="Déjalo vacío para cubrir todo Caldas. Para una tarifa especial, escribe sectores como El Poblado."/><p className="mt-1.5 text-xs leading-5 text-slate-500">Para cubrir todo el municipio, deja este campo vacío. Solo escribe aquí sectores que tendrán una tarifa diferente, por ejemplo El Poblado dentro de Medellín.</p></div>
          <div><label className={labelClass} htmlFor="event-zone-fee">Transporte del evento (COP)</label><input id="event-zone-fee" type="number" min="0" max="1000000000" step="1" value={feeCop} onChange={event => setFeeCop(event.target.value)} className={fieldClass} placeholder="Escribe la tarifa que cobrarás" required/><p className="mt-1 text-xs text-slate-500">Este valor se envía como número entero en pesos colombianos y es independiente del domicilio de productos.</p></div>
        </div>
        <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4"><button type="submit" disabled={saving} className="rounded-xl bg-[#74152F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#5E1026] disabled:opacity-50">{saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear zona de eventos'}</button><button type="button" onClick={resetForm} disabled={saving} className="rounded-xl border border-[#DDCFC5] px-5 py-2.5 text-sm font-semibold text-[#5B4450] hover:bg-[#FFF8EF]">Cancelar</button></div>
      </form>}

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-lg font-bold text-[#321923]">Cobertura para eventos configurada</h3><p className="text-sm text-slate-500">Estas tarifas aparecen como sugerencia al preparar la cotización. Puedes modificarlas para cada cliente.</p></div><div className="flex flex-wrap gap-2"><input aria-label="Buscar tarifa de evento" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar municipio o sector…" className="min-w-[220px] rounded-xl border border-[#DDCFC5] bg-white px-3 py-2 text-sm outline-none focus:border-[#B47B32]"/><select aria-label="Filtrar zonas de eventos" value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)} className="rounded-xl border border-[#DDCFC5] bg-white px-3 py-2 text-sm outline-none"><option value="all">Todas</option><option value="active">Activas</option><option value="inactive">Pausadas</option></select><button type="button" onClick={() => void loadZones()} className="rounded-xl border border-[#DDCFC5] bg-white px-3 py-2 text-sm font-semibold text-[#74152F] hover:bg-[#FFF8EF]">Actualizar</button></div></div>
        {loading ? <div className="rounded-2xl border border-[#EAD6C6] bg-white py-14 text-center text-sm text-slate-500">Cargando tarifas de transporte…</div> : visibleZones.length === 0 ? <div className="rounded-2xl border border-dashed border-[#D7BFAE] bg-white px-6 py-12 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF2E3] text-2xl">⌖</div><h3 className="mt-3 font-bold text-[#321923]">{zones.length === 0 ? 'Aún no has configurado transporte para eventos' : 'No encontramos zonas con esos filtros'}</h3><p className="mx-auto mt-1 max-w-xl text-sm text-slate-500">Agrega los municipios y sectores a los que puedes llevar comida para celebraciones. No tienes que usar las mismas tarifas de los domicilios normales.</p>{zones.length === 0 && <button type="button" onClick={startCreate} className="mt-4 rounded-xl bg-[#74152F] px-5 py-2.5 text-sm font-semibold text-white">Agregar primera zona</button>}</div> : <div className="grid gap-4 xl:grid-cols-2">{visibleZones.map(zone => <article key={zone.id} className="overflow-hidden rounded-2xl border border-[#EAD6C6] bg-white shadow-sm transition hover:shadow-md"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#F2E7DE] bg-gradient-to-r from-[#FFF8EF] to-white px-5 py-4"><div><div className="flex flex-wrap items-center gap-2"><h4 className="font-bold text-[#321923]">{zone.name}</h4><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${zone.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{zone.isActive ? 'Activa para eventos' : 'Pausada'}</span></div><p className="mt-1 text-sm text-slate-500">{zone.city}</p></div><div className="text-right"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Transporte del evento</p><p className="mt-0.5 text-xl font-bold text-[#74152F]">{zone.feeCop === 0 ? 'Gratis' : formatCop(zone.feeCop)}</p></div></div><div className="space-y-3 px-5 py-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{zone.neighborhoods.length ? `Sectores específicos (${zone.neighborhoods.length})` : 'Cobertura general'}</p>{zone.neighborhoods.length ? <div className="mt-2 flex flex-wrap gap-1.5">{zone.neighborhoods.map(area => <span key={`${zone.id}-${area}`} className="rounded-full border border-[#F0DFCD] bg-[#FFFCF8] px-2.5 py-1 text-xs text-[#5B4450]">{area}</span>)}</div> : <p className="mt-1 text-sm text-[#5B4450]">Todo el municipio. Las tarifas de sectores específicos tendrán prioridad cuando estén configuradas.</p>}</div><div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-3"><button type="button" disabled={busyId === zone.id} onClick={() => startEdit(zone)} className="text-sm font-semibold text-[#74152F] hover:underline">Editar</button><button type="button" disabled={busyId === zone.id} onClick={() => void toggleActive(zone)} className="text-sm font-semibold text-slate-700 hover:underline">{busyId === zone.id ? 'Procesando…' : zone.isActive ? 'Pausar zona' : 'Activar zona'}</button><button type="button" disabled={busyId === zone.id} onClick={() => void deleteZone(zone)} className="text-sm font-semibold text-red-600 hover:underline">Eliminar</button></div></div></article>)}</div>}
      </section>
    </div>
  );
}
