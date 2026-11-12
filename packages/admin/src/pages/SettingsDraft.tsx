import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

type Section = 'hours' | 'location' | 'orders';

type ApiResult<T> = { success: boolean; data?: T; message?: string; error?: string };

type HourDay = {
  dayOfWeek: number;
  isOpen: boolean;
  opensAt: string;
  closesAt: string;
};

type Operations = {
  acceptOrders: boolean;
  allowDelivery: boolean;
  allowPickup: boolean;
  allowScheduledOrders: boolean;
  allowGuestCheckout: boolean;
  allowCashPayment: boolean;
  freeDeliveryEnabled: boolean;
  freeDeliveryMinUnits: number;
  minimumDeliveryOrderCop: number;
  minimumPickupOrderCop: number;
  deliveryPrepMinutes: number;
  pickupPrepMinutes: number;
};

type PrivateLocation = {
  baseAddress: string;
  baseNeighborhood: string;
  baseCity: string;
  baseDepartment: string;
  internalNotes: string;
};

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DEFAULT_HOURS: HourDay[] = DAYS.map((_, index) => ({
  dayOfWeek: index + 1,
  isOpen: false,
  opensAt: '',
  closesAt: '',
}));
const DEFAULT_OPERATIONS: Operations = {
  acceptOrders: true,
  allowDelivery: true,
  allowPickup: false,
  allowScheduledOrders: true,
  allowGuestCheckout: true,
  allowCashPayment: true,
  freeDeliveryEnabled: true,
  freeDeliveryMinUnits: 11,
  minimumDeliveryOrderCop: 0,
  minimumPickupOrderCop: 0,
  deliveryPrepMinutes: 0,
  pickupPrepMinutes: 0,
};
const EMPTY_LOCATION: PrivateLocation = {
  baseAddress: '', baseNeighborhood: '', baseCity: '', baseDepartment: '', internalNotes: '',
};

const inputClass = 'w-full rounded-lg border border-[#DCCFC9] bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#A96B5D] focus:ring-2 focus:ring-[#F1E2DC] disabled:bg-gray-100 disabled:text-gray-500';
const labelClass = 'mb-1.5 block text-sm font-medium text-[#49343B]';

export default function SettingsDraft({ section }: { section: Section }) {
  const token = localStorage.getItem('token') || '';
  const [hours, setHours] = useState<HourDay[]>(DEFAULT_HOURS);
  const [specialNotes, setSpecialNotes] = useState('');
  const [operations, setOperations] = useState<Operations>(DEFAULT_OPERATIONS);
  const [location, setLocation] = useState<PrivateLocation>(EMPTY_LOCATION);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const endpoint = section === 'hours'
    ? '/api/settings/hours'
    : section === 'location'
      ? '/api/settings/private-location'
      : '/api/settings/operations';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json() as ApiResult<Record<string, unknown>>;
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'No se pudo cargar esta configuración.');
      }
      if (section === 'hours') {
        const rawDays = Array.isArray(result.data.days) ? result.data.days : [];
        const normalized = DEFAULT_HOURS.map((fallback) => {
          const raw = rawDays.find((item) => !!item && typeof item === 'object' && (item as Record<string, unknown>).dayOfWeek === fallback.dayOfWeek) as Record<string, unknown> | undefined;
          return raw ? {
            dayOfWeek: fallback.dayOfWeek,
            isOpen: raw.isOpen === true,
            opensAt: typeof raw.opensAt === 'string' ? raw.opensAt : '',
            closesAt: typeof raw.closesAt === 'string' ? raw.closesAt : '',
          } : fallback;
        });
        setHours(normalized);
        setSpecialNotes(typeof result.data.specialNotes === 'string' ? result.data.specialNotes : '');
      } else if (section === 'location') {
        setLocation({
          baseAddress: String(result.data.baseAddress || ''),
          baseNeighborhood: String(result.data.baseNeighborhood || ''),
          baseCity: String(result.data.baseCity || ''),
          baseDepartment: String(result.data.baseDepartment || ''),
          internalNotes: String(result.data.internalNotes || ''),
        });
      } else {
        setOperations({
          acceptOrders: result.data.acceptOrders === true,
          allowDelivery: result.data.allowDelivery === true,
          allowPickup: result.data.allowPickup === true,
          allowScheduledOrders: result.data.allowScheduledOrders === true,
          allowGuestCheckout: result.data.allowGuestCheckout === true,
          allowCashPayment: result.data.allowCashPayment === true,
          freeDeliveryEnabled: result.data.freeDeliveryEnabled === true,
          freeDeliveryMinUnits: Number(result.data.freeDeliveryMinUnits ?? 11),
          minimumDeliveryOrderCop: Number(result.data.minimumDeliveryOrderCop ?? 0),
          minimumPickupOrderCop: Number(result.data.minimumPickupOrderCop ?? 0),
          deliveryPrepMinutes: Number(result.data.deliveryPrepMinutes ?? 0),
          pickupPrepMinutes: Number(result.data.pickupPrepMinutes ?? 0),
        });
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Error de conexión al cargar la configuración.');
    } finally {
      setLoading(false);
    }
  }, [endpoint, section, token]);

  useEffect(() => { void load(); }, [load]);

  function updateHour(dayOfWeek: number, changes: Partial<HourDay>) {
    setHours((current) => current.map((day) => day.dayOfWeek === dayOfWeek ? { ...day, ...changes } : day));
    setSuccess('');
  }

  function updateOperation<K extends keyof Operations>(field: K, value: Operations[K]) {
    setOperations((current) => ({ ...current, [field]: value }));
    setSuccess('');
  }

  function updateLocation<K extends keyof PrivateLocation>(field: K, value: PrivateLocation[K]) {
    setLocation((current) => ({ ...current, [field]: value }));
    setSuccess('');
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    let payload: unknown;
    if (section === 'hours') payload = { days: hours, specialNotes };
    else if (section === 'location') payload = location;
    else payload = { ...operations, allowGuestCheckout: true };

    try {
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as ApiResult<unknown>;
      if (!response.ok || !result.success) throw new Error(result.error || 'No se pudieron guardar los cambios.');
      setSuccess(result.message || 'Los cambios se guardaron correctamente.');
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Error de conexión al guardar los cambios.');
    } finally {
      setSaving(false);
    }
  }

  const title = section === 'hours'
    ? 'Horarios de atención'
    : section === 'location'
      ? 'Dirección privada del negocio'
      : 'Pedidos y modalidades de entrega';
  const description = section === 'hours'
    ? 'Define los días y las horas en que atiende el negocio.'
    : section === 'location'
      ? 'Registra la ubicación desde donde se preparan y despachan los pedidos.'
      : 'Controla la disponibilidad, las modalidades y las condiciones para recibir pedidos.';

  if (loading) return <div className="mx-auto max-w-5xl p-6 text-sm text-gray-600">Cargando configuración…</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/settings" className="text-sm font-semibold text-[#8F4F43] hover:underline">← Volver a configuración</Link>
          <h1 className="mt-3 text-2xl font-bold text-[#3B222B]">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">{description}</p>
        </div>
        <button type="submit" form="settings-detail-form" disabled={saving} className="rounded-lg bg-[#8F4F43] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#744037] disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar cambios'}</button>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>}

      <form id="settings-detail-form" onSubmit={handleSave} className="space-y-5">
        {section === 'hours' && (
          <section className="rounded-2xl border border-[#E8DDD7] bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4"><h2 className="font-semibold text-[#3B222B]">Horario semanal</h2><p className="mt-1 text-sm text-gray-500">Activa cada día y define las horas de apertura y cierre. Los días desactivados quedan como cerrados.</p></div>
            <div className="divide-y divide-gray-100">
              {hours.map((day) => (
                <div key={day.dayOfWeek} className="grid gap-3 py-4 sm:grid-cols-[1.1fr_1fr_1fr] sm:items-end">
                  <label className="flex items-center gap-3 pb-2 text-sm font-medium text-gray-800">
                    <input type="checkbox" checked={day.isOpen} onChange={(event) => updateHour(day.dayOfWeek, { isOpen: event.target.checked })} className="h-4 w-4 rounded border-gray-300 accent-[#8F4F43]" />
                    {DAYS[day.dayOfWeek - 1]}
                  </label>
                  <div><label className={labelClass}>Hora de apertura</label><input type="time" disabled={!day.isOpen} value={day.opensAt} onChange={(event) => updateHour(day.dayOfWeek, { opensAt: event.target.value })} className={inputClass} /></div>
                  <div><label className={labelClass}>Hora de cierre</label><input type="time" disabled={!day.isOpen} value={day.closesAt} onChange={(event) => updateHour(day.dayOfWeek, { closesAt: event.target.value })} className={inputClass} /></div>
                  <p className={`text-xs font-medium sm:col-span-3 ${day.isOpen ? 'text-emerald-700' : 'text-gray-400'}`}>{day.isOpen ? 'Día de atención' : 'Cerrado'}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-gray-100 pt-4"><label className={labelClass} htmlFor="specialNotes">Notas para fechas especiales</label><textarea id="specialNotes" rows={3} maxLength={1000} value={specialNotes} onChange={(event) => { setSpecialNotes(event.target.value); setSuccess(''); }} className={inputClass} placeholder="Ej. En días festivos atenderemos con horario especial…" /></div>
          </section>
        )}

        {section === 'location' && (
          <section className="space-y-5 rounded-2xl border border-[#E8DDD7] bg-white p-5 shadow-sm sm:p-6">
            <div><h2 className="font-semibold text-[#3B222B]">Ubicación de preparación y despacho</h2><p className="mt-1 text-sm text-gray-500">Esta información es privada y solo está disponible para el administrador principal.</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><label className={labelClass} htmlFor="baseAddress">Dirección completa</label><input id="baseAddress" maxLength={250} value={location.baseAddress} onChange={(event) => updateLocation('baseAddress', event.target.value)} className={inputClass} placeholder="Escribe la dirección del negocio" /></div>
              <div><label className={labelClass} htmlFor="baseNeighborhood">Barrio o sector</label><input id="baseNeighborhood" maxLength={100} value={location.baseNeighborhood} onChange={(event) => updateLocation('baseNeighborhood', event.target.value)} className={inputClass} placeholder="Barrio" /></div>
              <div><label className={labelClass} htmlFor="baseCity">Municipio</label><input id="baseCity" maxLength={120} value={location.baseCity} onChange={(event) => updateLocation('baseCity', event.target.value)} className={inputClass} placeholder="Municipio" /></div>
              <div><label className={labelClass} htmlFor="baseDepartment">Departamento</label><input id="baseDepartment" maxLength={120} value={location.baseDepartment} onChange={(event) => updateLocation('baseDepartment', event.target.value)} className={inputClass} placeholder="Departamento" /></div>
              <div className="sm:col-span-2"><label className={labelClass} htmlFor="internalNotes">Indicaciones internas</label><textarea id="internalNotes" maxLength={1000} rows={3} value={location.internalNotes} onChange={(event) => updateLocation('internalNotes', event.target.value)} className={inputClass} placeholder="Referencias para preparación, despacho o recogida" /></div>
            </div>
            <div className="rounded-lg bg-[#F8F1ED] p-3 text-sm text-[#684B4B]">La dirección privada se almacena separada de la información pública y no se muestra a los clientes.</div>
          </section>
        )}

        {section === 'orders' && (
          <section className="space-y-5 rounded-2xl border border-[#E8DDD7] bg-white p-5 shadow-sm sm:p-6">
            <div><h2 className="font-semibold text-[#3B222B]">Disponibilidad del negocio</h2><p className="mt-1 text-sm text-gray-500">Estos controles afectan la posibilidad de realizar pedidos desde la tienda.</p></div>
            <Toggle label="Aceptar pedidos en línea" description="Activa o pausa la recepción de pedidos desde la tienda." checked={operations.acceptOrders} onChange={(value) => updateOperation('acceptOrders', value)} />
            <div className="border-t border-gray-100 pt-3"><h3 className="mb-2 text-sm font-semibold text-[#3B222B]">Modalidades disponibles</h3>
              <Toggle label="Domicilio" description="Permite recibir pedidos para entregar en la dirección del cliente." checked={operations.allowDelivery} onChange={(value) => updateOperation('allowDelivery', value)} />
              <Toggle label="Recoger en el negocio" description="Permite que el cliente recoja su pedido en el punto de preparación." checked={operations.allowPickup} onChange={(value) => updateOperation('allowPickup', value)} />
            </div>
            <div className="border-t border-gray-100 pt-3"><h3 className="mb-2 text-sm font-semibold text-[#3B222B]">Condiciones de compra</h3>
              <Toggle label="Permitir pedidos programados" description="El cliente puede elegir una fecha y hora futura." checked={operations.allowScheduledOrders} onChange={(value) => updateOperation('allowScheduledOrders', value)} />
              <div className="rounded-lg bg-[#F8F1ED] px-4 py-3 text-sm text-[#684B4B]">
                <strong className="block font-semibold">Pedidos sin registro: habilitados</strong>
                Los clientes pueden hacer pedidos sin crear una cuenta. Esta opción se mantiene activa porque el sistema aún no tiene cuentas de clientes.
              </div>
              <Toggle label="Recibir pagos en efectivo" description="Habilita el pago al recibir o recoger el pedido." checked={operations.allowCashPayment} onChange={(value) => updateOperation('allowCashPayment', value)} />
            </div>
            <div className="grid gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2">
              <NumberField label="Pedido mínimo para domicilio (COP)" value={operations.minimumDeliveryOrderCop} min={0} onChange={(value) => updateOperation('minimumDeliveryOrderCop', value)} helper="0 significa que no hay un mínimo general. Las zonas pueden tener su propio mínimo adicional." />
              <NumberField label="Pedido mínimo para recoger (COP)" value={operations.minimumPickupOrderCop} min={0} onChange={(value) => updateOperation('minimumPickupOrderCop', value)} helper="0 significa que no hay un mínimo." />
              <NumberField label="Preparación estimada para domicilio (minutos)" value={operations.deliveryPrepMinutes} min={0} max={1440} onChange={(value) => updateOperation('deliveryPrepMinutes', value)} helper="0 significa que no se muestra un tiempo estimado." />
              <NumberField label="Preparación estimada para recoger (minutos)" value={operations.pickupPrepMinutes} min={0} max={1440} onChange={(value) => updateOperation('pickupPrepMinutes', value)} helper="0 significa que no se muestra un tiempo estimado." />
            </div>
            <div className="border-t border-gray-100 pt-4"><h3 className="mb-2 text-sm font-semibold text-[#3B222B]">Beneficio de domicilio gratis</h3>
              <Toggle label="Activar domicilio gratis por cantidad de productos" description="Cuando el pedido alcanza la cantidad definida, se elimina el costo de domicilio." checked={operations.freeDeliveryEnabled} onChange={(value) => updateOperation('freeDeliveryEnabled', value)} />
              <NumberField label="Cantidad mínima de productos" value={operations.freeDeliveryMinUnits} min={1} max={1000} disabled={!operations.freeDeliveryEnabled} onChange={(value) => updateOperation('freeDeliveryMinUnits', value)} helper="Actualmente el valor configurado es 11 productos." />
            </div>
          </section>
        )}

        <div className="flex justify-end"><button type="submit" disabled={saving} className="rounded-lg bg-[#8F4F43] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#744037] disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar cambios'}</button></div>
      </form>
    </div>
  );
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 border-b border-gray-100 py-3 last:border-0">
      <span><span className="block text-sm font-medium text-gray-800">{label}</span><span className="mt-0.5 block text-xs text-gray-500">{description}</span></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 rounded border-gray-300 accent-[#8F4F43]" />
    </label>
  );
}

function NumberField({ label, value, min, max = 100000000, disabled = false, onChange, helper }: { label: string; value: number; min: number; max?: number; disabled?: boolean; onChange: (value: number) => void; helper: string }) {
  return (
    <div><label className={labelClass}>{label}</label><input type="number" min={min} max={max} step="1" disabled={disabled} value={value} onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || 0)))} className={inputClass} /><p className="mt-1 text-xs text-gray-500">{helper}</p></div>
  );
}
