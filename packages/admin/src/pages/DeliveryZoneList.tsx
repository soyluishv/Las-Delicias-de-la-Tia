import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api } from '../lib/api.js';
import EventTransportZones from './EventTransportZones.js';

interface DeliveryZone {
  id: string;
  name: string;
  city: string | null;
  neighborhoods: string[];
  feeCop: number;
  minimumOrderCop: number;
  isActive: boolean;
}

type StatusFilter = 'all' | 'active' | 'inactive';

const formatCop = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value || 0);

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLocaleLowerCase('es');

function parseNeighborhoods(value: string) {
  return value
    .split(/[\r\n,;]+/)
    .map(item => item.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .filter((item, index, all) => all.findIndex(other => normalize(other) === normalize(item)) === index);
}

function ProductDeliveryZones() {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [neighborhoodsText, setNeighborhoodsText] = useState('');
  const [feeCop, setFeeCop] = useState('');
  const [minimumOrderCop, setMinimumOrderCop] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [saving, setSaving] = useState(false);
  const [busyZoneId, setBusyZoneId] = useState<string | null>(null);

  const loadZones = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<{ data: DeliveryZone[] }>('/delivery-zones');
      setZones(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar las zonas de domicilio.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadZones();
  }, []);

  const activeZones = zones.filter(zone => zone.isActive);
  const municipalities = new Set(activeZones.map(zone => normalize(zone.city || '')).filter(Boolean));
  const coveredNeighborhoods = new Set(
    activeZones.flatMap(zone => zone.neighborhoods.map(neighborhood => `${normalize(zone.city || '')}::${normalize(neighborhood)}`))
  );

  const visibleZones = useMemo(() => {
    const query = normalize(search);
    return zones.filter(zone => {
      if (statusFilter === 'active' && !zone.isActive) return false;
      if (statusFilter === 'inactive' && zone.isActive) return false;
      if (!query) return true;
      const haystack = [zone.name, zone.city || '', ...zone.neighborhoods].join(' ');
      return normalize(haystack).includes(query);
    });
  }, [zones, search, statusFilter]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setCity('');
    setNeighborhoodsText('');
    setFeeCop('');
    setMinimumOrderCop('0');
    setIsActive(true);
    setShowForm(false);
    setError('');
  };

  const startCreate = () => {
    resetForm();
    setSuccess('');
    setShowForm(true);
  };

  const startEdit = (zone: DeliveryZone) => {
    setEditingId(zone.id);
    setName(zone.name);
    setCity(zone.city || '');
    setNeighborhoodsText(zone.neighborhoods.join('\n'));
    setFeeCop(String(zone.feeCop));
    setMinimumOrderCop(String(zone.minimumOrderCop));
    setIsActive(zone.isActive);
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const findNeighborhoodConflicts = (targetCity: string, neighborhoods: string[], ignoredId: string | null) => {
    const requested = new Set(neighborhoods.map(normalize));
    const conflicts: Array<{ neighborhood: string; zoneName: string }> = [];
    for (const zone of zones) {
      if (!zone.isActive || zone.id === ignoredId || normalize(zone.city || '') !== normalize(targetCity)) continue;
      for (const neighborhood of zone.neighborhoods) {
        if (requested.has(normalize(neighborhood))) conflicts.push({ neighborhood, zoneName: zone.name });
      }
    }
    return conflicts;
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const neighborhoods = parseNeighborhoods(neighborhoodsText);
    const fee = Number(feeCop);
    const minimum = Number(minimumOrderCop);

    if (!name.trim() || !city.trim() || neighborhoods.length === 0) {
      setError('Completa el nombre de la zona, el municipio y al menos un barrio.');
      return;
    }
    if (neighborhoods.length > 100) {
      setError('Puedes registrar hasta 100 barrios por zona.');
      return;
    }
    if (!Number.isSafeInteger(fee) || fee < 0 || !Number.isSafeInteger(minimum) || minimum < 0) {
      setError('La tarifa y el pedido mínimo deben ser valores enteros en pesos colombianos.');
      return;
    }

    const zoneWillBeActive = editingId ? isActive : true;
    if (zoneWillBeActive) {
      const conflicts = findNeighborhoodConflicts(city, neighborhoods, editingId);
      if (conflicts.length > 0) {
        const conflictText = conflicts.slice(0, 5).map(item => `“${item.neighborhood}” (${item.zoneName})`).join(', ');
        setError(`Estos barrios ya pertenecen a otra zona activa del mismo municipio: ${conflictText}. Cada barrio debe tener una sola tarifa.`);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        city: city.trim(),
        neighborhoods,
        feeCop: fee,
        minimumOrderCop: minimum,
      };

      if (editingId) {
        await api.patch(`/delivery-zones/${editingId}`, { ...payload, isActive });
        setSuccess('La zona de domicilio se actualizó correctamente.');
      } else {
        await api.post('/delivery-zones', payload);
        setSuccess('La zona de domicilio se creó correctamente y quedó activa.');
      }
      resetForm();
      await loadZones();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible guardar la zona.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (zone: DeliveryZone) => {
    setError('');
    setSuccess('');
    if (!zone.isActive) {
      const conflicts = findNeighborhoodConflicts(zone.city || '', zone.neighborhoods, zone.id);
      if (conflicts.length > 0) {
        const names = conflicts.slice(0, 5).map(item => item.neighborhood).join(', ');
        setError(`No se puede activar esta zona porque estos barrios ya están cubiertos en otra zona activa: ${names}.`);
        return;
      }
    }
    setBusyZoneId(zone.id);
    try {
      await api.patch(`/delivery-zones/${zone.id}`, { isActive: !zone.isActive });
      setZones(previous => previous.map(item => item.id === zone.id ? { ...item, isActive: !item.isActive } : item));
      setSuccess(zone.isActive ? 'La zona quedó pausada. Los clientes ya no podrán seleccionarla.' : 'La zona está activa y disponible en la tienda.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cambiar el estado de la zona.');
    } finally {
      setBusyZoneId(null);
    }
  };

  const deleteZone = async (zone: DeliveryZone) => {
    const confirmed = window.confirm(
      `¿Eliminar la zona “${zone.name}”? Si tiene pedidos asociados, el sistema impedirá eliminarla. En ese caso puedes desactivarla.`
    );
    if (!confirmed) return;
    setError('');
    setSuccess('');
    setBusyZoneId(zone.id);
    try {
      await api.delete(`/delivery-zones/${zone.id}`);
      setZones(previous => previous.filter(item => item.id !== zone.id));
      setSuccess('La zona se eliminó correctamente.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible eliminar la zona.');
    } finally {
      setBusyZoneId(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#B47B32]">Entrega y cobertura</p>
          <h1 className="mt-1 text-2xl font-bold text-[#321923]">Domicilios de productos</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Configura la cobertura y las tarifas para hamburguesas, perros, tamales y demás productos del menú.
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="rounded-xl bg-[#74152F] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5E1026] focus:outline-none focus:ring-2 focus:ring-[#D7A64D] focus:ring-offset-2"
        >
          + Agregar zona
        </button>
      </header>

      {(error || success) && (
        <div role={error ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          {error || success}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[#F0DFCD] bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Zonas activas</p>
          <p className="mt-2 text-3xl font-bold text-[#74152F]">{activeZones.length}</p>
          <p className="mt-1 text-xs text-slate-500">Disponibles para recibir pedidos</p>
        </div>
        <div className="rounded-2xl border border-[#F0DFCD] bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Municipios cubiertos</p>
          <p className="mt-2 text-3xl font-bold text-[#74152F]">{municipalities.size}</p>
          <p className="mt-1 text-xs text-slate-500">Con al menos una zona activa</p>
        </div>
        <div className="rounded-2xl border border-[#F0DFCD] bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Barrios cubiertos</p>
          <p className="mt-2 text-3xl font-bold text-[#74152F]">{coveredNeighborhoods.size}</p>
          <p className="mt-1 text-xs text-slate-500">Sin contar barrios repetidos</p>
        </div>
        <div className="rounded-2xl border border-[#F0DFCD] bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Zonas pausadas</p>
          <p className="mt-2 text-3xl font-bold text-slate-700">{zones.length - activeZones.length}</p>
          <p className="mt-1 text-xs text-slate-500">No aparecen en el formulario de compra</p>
        </div>
      </section>

      <section className="rounded-2xl border border-[#EEDBC8] bg-gradient-to-r from-[#FFF8EF] via-white to-[#FFF1E9] p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F8E6C4] text-xl text-[#8A5B1E]">i</div>
          <div className="space-y-1 text-sm text-[#5B4450]">
            <p className="font-bold text-[#321923]">Cómo organizar tus tarifas</p>
            <p>Junta en una misma zona los barrios que tengan el mismo costo de domicilio. Si un barrio tiene otra tarifa, crea una zona aparte para ese barrio.</p>
            <p>Cada barrio debe estar asignado a una sola zona activa por municipio. Así la tienda puede calcular el valor correcto sin confundir al cliente.</p>
            <p>Las tarifas deben ser las que tú decidas. No se han precargado valores ni barrios inventados.</p>
          </div>
        </div>
      </section>

      {showForm && (
        <form onSubmit={handleSave} className="space-y-5 rounded-2xl border border-[#EAD6C6] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#B47B32]">Configuración de cobertura</p>
              <h2 className="mt-1 text-lg font-bold text-[#321923]">{editingId ? 'Editar zona de domicilio' : 'Crear zona de domicilio'}</h2>
            </div>
            {editingId && (
              <label className="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={isActive} onChange={event => setIsActive(event.target.checked)} className="h-4 w-4 accent-[#74152F]" />
                Zona activa
              </label>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Nombre para identificar la zona</span>
              <input required value={name} onChange={event => setName(event.target.value)} maxLength={100} className="w-full rounded-xl border border-[#DDCFC5] px-3 py-2.5 text-sm outline-none transition focus:border-[#B47B32] focus:ring-2 focus:ring-[#F4E0B9]" placeholder="Ej. Caldas - tarifa general" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Municipio</span>
              <input required value={city} onChange={event => setCity(event.target.value)} maxLength={100} className="w-full rounded-xl border border-[#DDCFC5] px-3 py-2.5 text-sm outline-none transition focus:border-[#B47B32] focus:ring-2 focus:ring-[#F4E0B9]" placeholder="Ej. Caldas" />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">Barrios incluidos</span>
            <textarea required value={neighborhoodsText} onChange={event => setNeighborhoodsText(event.target.value)} rows={5} maxLength={8000} className="w-full rounded-xl border border-[#DDCFC5] px-3 py-2.5 text-sm outline-none transition focus:border-[#B47B32] focus:ring-2 focus:ring-[#F4E0B9]" placeholder={'Escribe un barrio por línea.\nEjemplo:\nCentro\nLa Inmaculada\nAndalucía'} />
            <span className="mt-1.5 block text-xs text-slate-500">Puedes separar los barrios con saltos de línea, comas o punto y coma. Máximo 100 barrios por zona.</span>
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Costo del domicilio (COP)</span>
              <input type="number" min="0" max="100000000" step="1" required value={feeCop} onChange={event => setFeeCop(event.target.value)} className="w-full rounded-xl border border-[#DDCFC5] px-3 py-2.5 text-sm outline-none transition focus:border-[#B47B32] focus:ring-2 focus:ring-[#F4E0B9]" placeholder="Escribe la tarifa que cobrarás" />
              <span className="mt-1.5 block text-xs text-slate-500">Si el domicilio en esta zona no tiene costo, escribe 0.</span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Pedido mínimo de esta zona (COP)</span>
              <input type="number" min="0" max="100000000" step="1" required value={minimumOrderCop} onChange={event => setMinimumOrderCop(event.target.value)} className="w-full rounded-xl border border-[#DDCFC5] px-3 py-2.5 text-sm outline-none transition focus:border-[#B47B32] focus:ring-2 focus:ring-[#F4E0B9]" />
              <span className="mt-1.5 block text-xs text-slate-500">Es adicional al pedido mínimo general. Escribe 0 si no necesitas un mínimo especial para esta zona.</span>
            </label>
          </div>

          {!editingId && <p className="rounded-xl bg-[#FFF8EF] px-4 py-3 text-xs text-[#71563B]">La nueva zona se creará activa y aparecerá en la tienda cuando el domicilio esté habilitado.</p>}

          <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4">
            <button type="submit" disabled={saving} className="rounded-xl bg-[#74152F] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#5E1026] disabled:opacity-50">
              {saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear zona'}
            </button>
            <button type="button" onClick={resetForm} disabled={saving} className="rounded-xl border border-[#DDCFC5] px-5 py-2.5 text-sm font-semibold text-[#5B4450] transition hover:bg-[#FFF8EF] disabled:opacity-50">Cancelar</button>
          </div>
        </form>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#321923]">Cobertura configurada</h2>
            <p className="text-sm text-slate-500">Las zonas activas se ofrecen en el formulario de compra.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input aria-label="Buscar zona o barrio" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar zona, municipio o barrio…" className="min-w-[220px] rounded-xl border border-[#DDCFC5] bg-white px-3 py-2 text-sm outline-none focus:border-[#B47B32]" />
            <select aria-label="Filtrar por estado" value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)} className="rounded-xl border border-[#DDCFC5] bg-white px-3 py-2 text-sm outline-none focus:border-[#B47B32]">
              <option value="all">Todas</option>
              <option value="active">Activas</option>
              <option value="inactive">Pausadas</option>
            </select>
            <button type="button" onClick={() => void loadZones()} className="rounded-xl border border-[#DDCFC5] bg-white px-3 py-2 text-sm font-semibold text-[#74152F] hover:bg-[#FFF8EF]">Actualizar</button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-[#EAD6C6] bg-white py-14 text-center text-sm text-slate-500">Cargando cobertura de domicilios…</div>
        ) : visibleZones.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D7BFAE] bg-white px-6 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF2E3] text-2xl">⌖</div>
            <h3 className="mt-3 font-bold text-[#321923]">{zones.length === 0 ? 'Todavía no has configurado domicilios' : 'No encontramos zonas con esos filtros'}</h3>
            <p className="mx-auto mt-1 max-w-xl text-sm text-slate-500">{zones.length === 0 ? 'Agrega los municipios y barrios donde sí puedes entregar. La tienda calculará la tarifa automáticamente al elegir la dirección.' : 'Prueba otra búsqueda o cambia el filtro de estado.'}</p>
            {zones.length === 0 && <button type="button" onClick={startCreate} className="mt-4 rounded-xl bg-[#74152F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#5E1026]">Agregar primera zona</button>}
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {visibleZones.map(zone => (
              <article key={zone.id} className="overflow-hidden rounded-2xl border border-[#EAD6C6] bg-white shadow-sm transition hover:shadow-md">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#F2E7DE] bg-gradient-to-r from-[#FFF8EF] to-white px-5 py-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-[#321923]">{zone.name}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${zone.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{zone.isActive ? 'Activa en la tienda' : 'Pausada'}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{zone.city || 'Municipio no indicado'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Tarifa de domicilio</p>
                    <p className="mt-0.5 text-xl font-bold text-[#74152F]">{zone.feeCop === 0 ? 'Gratis' : formatCop(zone.feeCop)}</p>
                  </div>
                </div>
                <div className="space-y-3 px-5 py-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Barrios cubiertos ({zone.neighborhoods.length})</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {zone.neighborhoods.map(neighborhood => <span key={`${zone.id}-${neighborhood}`} className="rounded-full border border-[#F0DFCD] bg-[#FFFCF8] px-2.5 py-1 text-xs text-[#5B4450]">{neighborhood}</span>)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                    <p className="text-sm text-slate-600">Pedido mínimo: <strong className="text-[#321923]">{formatCop(zone.minimumOrderCop)}</strong></p>
                    <div className="flex flex-wrap gap-3">
                      <button type="button" disabled={busyZoneId === zone.id} onClick={() => startEdit(zone)} className="text-sm font-semibold text-[#74152F] hover:underline disabled:opacity-50">Editar</button>
                      <button type="button" disabled={busyZoneId === zone.id} onClick={() => void toggleActive(zone)} className="text-sm font-semibold text-slate-700 hover:underline disabled:opacity-50">{busyZoneId === zone.id ? 'Procesando…' : zone.isActive ? 'Pausar zona' : 'Activar zona'}</button>
                      <button type="button" disabled={busyZoneId === zone.id} onClick={() => void deleteZone(zone)} className="text-sm font-semibold text-red-600 hover:underline disabled:opacity-50">Eliminar</button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}


export default function DeliveryZoneList() {
  const [activeSection, setActiveSection] = useState<'products' | 'events'>('products');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-[#EAD6C6] bg-white p-2 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveSection('products')}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${activeSection === 'products' ? 'bg-[#74152F] text-white shadow-sm' : 'text-[#5B4450] hover:bg-[#FFF8EF]'}`}
        >
          Domicilios de productos
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('events')}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${activeSection === 'events' ? 'bg-[#74152F] text-white shadow-sm' : 'text-[#5B4450] hover:bg-[#FFF8EF]'}`}
        >
          Transporte de eventos
        </button>
      </div>
      {activeSection === 'products' ? <ProductDeliveryZones /> : <EventTransportZones />}
    </div>
  );
}
