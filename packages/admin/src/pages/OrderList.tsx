import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  orderType: 'DELIVERY' | 'PICKUP';
  status: string;
  itemQuantityTotal: number;
  itemsSummary?: string | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  neighborhood: string | null;
  city: string | null;
  addressLine?: string | null;
  customerNotes?: string | null;
  scheduledAt: string | null;
  createdAt: string;
  whatsappUpdatesConsent?: boolean | number;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Nuevo', CONFIRMED: 'Confirmado', PREPARING: 'En preparación',
  READY: 'Listo para recoger', OUT_FOR_DELIVERY: 'Despachado', DELIVERED: 'Entregado',
  PICKED_UP: 'Recogido', CANCELLED: 'Cancelado',
};
const PAYMENT_LABELS: Record<string, string> = {
  PENDING: 'Pendiente', PAID: 'Pagado', FAILED: 'Fallido', REFUNDED: 'Reembolsado',
};
const formatCOP = (value: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0,
}).format(value || 0);

function parseDbDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function elapsedLabel(value: string, now: number): { text: string; tone: string } {
  const created = parseDbDate(value);
  if (!created) return { text: 'Hora no disponible', tone: 'text-gray-500 bg-gray-100' };
  const minutes = Math.max(0, Math.floor((now - created.getTime()) / 60000));
  if (minutes < 1) return { text: 'Recién recibido', tone: 'text-emerald-800 bg-emerald-100' };
  if (minutes < 8) return { text: `Hace ${minutes} min`, tone: 'text-emerald-800 bg-emerald-100' };
  if (minutes < 16) return { text: `Hace ${minutes} min`, tone: 'text-amber-800 bg-amber-100' };
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return { text: `Hace ${hours} h ${minutes % 60} min`, tone: 'text-red-800 bg-red-100' };
  return { text: `Hace ${minutes} min`, tone: 'text-red-800 bg-red-100' };
}

function formatSchedule(value: string | null): string | null {
  if (!value) return null;
  // Datetime-local values are stored without a timezone; display them as the
  // local time selected by the customer instead of shifting them to UTC.
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}

function buildWhatsAppUrl(order: Order): string | null {
  if (!order.whatsappUpdatesConsent) return null;
  const digits = (order.customerPhone || '').replace(/\D/g, '');
  const phone = digits.length === 10 ? `57${digits}` : (digits.length === 12 && digits.startsWith('57') ? digits : '');
  if (!phone) return null;
  const greeting = `Hola ${order.customerName},`;
  const reference = `pedido #${order.orderNumber}`;
  const body = order.orderType === 'DELIVERY'
    ? `${greeting}\n\nTe escribimos de Las Delicias de la Tía para contarte que tu ${reference} ya está listo y va en camino a la dirección que nos indicaste.\n\nTotal del pedido: ${formatCOP(order.total)}.\n\nGracias por elegirnos. ¡Que lo disfrutes!`
    : `${greeting}\n\nTu ${reference} de Las Delicias de la Tía ya está preparado y listo para recoger en nuestro punto de entrega.\n\nTotal del pedido: ${formatCOP(order.total)}.\n\nPuedes pasar por él cuando gustes. ¡Te esperamos!`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(body)}`;
}

type QueueTab = 'new' | 'preparing' | 'ready' | 'history';

export default function OrderList() {
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<QueueTab>('new');
  const [updatingIds, setUpdatingIds] = useState<string[]>([]);
  const [fallbackLinks, setFallbackLinks] = useState<Record<string, string>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<string>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );
  const [now, setNow] = useState(Date.now());
  const knownOrderIds = useRef<Set<string> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const loadingRef = useRef(false);
  const token = localStorage.getItem('token') || '';

  function playNewOrderAlert() {
    const context = audioContextRef.current;
    if (!context || context.state !== 'running') return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    oscillator.frequency.setValueAtTime(660, context.currentTime + 0.18);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.42);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.44);
  }

  async function enableAlerts() {
    try {
      const AudioContextConstructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioContextConstructor && !audioContextRef.current) {
        audioContextRef.current = new AudioContextConstructor();
      }
      if (audioContextRef.current?.state === 'suspended') await audioContextRef.current.resume();
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
      }
      setAlertsEnabled(true);
      setNotice('Alertas activadas. Mantén abierto el panel de pedidos para recibir avisos de nuevos pedidos.');
      playNewOrderAlert();
    } catch {
      setNotice('No se pudo activar el sonido. Puedes seguir consultando los pedidos; el panel se actualiza automáticamente.');
    }
  }

  async function loadOrders(initial = false) {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [activeResponse, historyResponse] = await Promise.all([
        fetch('/api/admin/orders?view=kitchen&limit=100&page=1', { headers }),
        fetch('/api/admin/orders?view=history&limit=100&page=1', { headers }),
      ]);
      const [activeResult, historyResult] = await Promise.all([activeResponse.json(), historyResponse.json()]);
      if (!activeResponse.ok) throw new Error(activeResult.error || 'No se pudieron cargar los pedidos activos.');
      if (!historyResponse.ok) throw new Error(historyResult.error || 'No se pudo cargar el historial.');
      const nextActive = Array.isArray(activeResult.data) ? activeResult.data as Order[] : [];
      const nextHistory = Array.isArray(historyResult.data) ? historyResult.data as Order[] : [];

      if (knownOrderIds.current === null || initial) {
        knownOrderIds.current = new Set(nextActive.map((order) => order.id));
      } else {
        const known = knownOrderIds.current;
        const arrivals = nextActive.filter((order) => order.status === 'PENDING' && !known.has(order.id));
        for (const order of nextActive) known.add(order.id);
        if (arrivals.length > 0) {
          setActiveTab('new');
          playNewOrderAlert();
          if (document.visibilityState === 'hidden' && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            arrivals.slice(0, 3).forEach((order) => {
              new Notification('Nuevo pedido - Las Delicias de la Tía', {
                body: `${order.customerName} · ${order.orderType === 'DELIVERY' ? 'Domicilio' : 'Recoger'} · ${order.orderNumber}`,
                tag: order.id,
              });
            });
          }
        }
      }
      setActiveOrders(nextActive);
      setHistoryOrders(nextHistory);
      setLastUpdated(new Date());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron actualizar los pedidos.');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOrders(true);
    const poll = window.setInterval(() => {
      void loadOrders(false);
    }, 15000);
    const clock = window.setInterval(() => setNow(Date.now()), 30000);
    return () => { window.clearInterval(poll); window.clearInterval(clock); };
    // Load once and poll while this screen is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function updateOrderStatus(order: Order, newStatus: string) {
    if (updatingIds.includes(order.id)) return;
    const isReady = newStatus === 'READY' || newStatus === 'OUT_FOR_DELIVERY';
    const whatsappUrl = isReady ? buildWhatsAppUrl(order) : null;
    // Open synchronously from the click gesture so the browser does not block WhatsApp.
    const whatsappWindow = whatsappUrl ? window.open('about:blank', '_blank') : null;
    setUpdatingIds((current) => [...current, order.id]);
    setError('');
    setNotice('');
    setFallbackLinks((current) => { const next = { ...current }; delete next[order.id]; return next; });
    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo actualizar el pedido.');
      setActiveOrders((current) => current.map((item) => item.id === order.id ? { ...item, status: newStatus } : item));
      if (isReady) setActiveTab('new');
      const statusLabel = newStatus === 'PREPARING' ? 'En preparación'
        : newStatus === 'READY' ? 'Listo para recoger'
          : newStatus === 'OUT_FOR_DELIVERY' ? 'Despachado / en camino'
            : newStatus === 'DELIVERED' ? 'Entregado'
              : newStatus === 'PICKED_UP' ? 'Recogido' : 'Cancelado';
      if (isReady && order.whatsappUpdatesConsent) {
        if (whatsappWindow && whatsappUrl) {
          whatsappWindow.opener = null;
          whatsappWindow.location.href = whatsappUrl;
          setNotice(`Pedido actualizado: ${statusLabel}. WhatsApp se abrió con el mensaje preparado; solo falta pulsar Enviar.`);
        } else if (whatsappUrl) {
          setFallbackLinks((current) => ({ ...current, [order.id]: whatsappUrl }));
          setNotice(`Pedido actualizado: ${statusLabel}. El navegador bloqueó WhatsApp; usa el enlace del pedido para abrir el mensaje.`);
        } else {
          setNotice(`Pedido actualizado: ${statusLabel}, pero el teléfono no tiene un formato válido para WhatsApp.`);
        }
      } else if (isReady) {
        setNotice(`Pedido actualizado: ${statusLabel}. El cliente no autorizó avisos por WhatsApp.`);
      } else if (newStatus === 'PREPARING') {
        setNotice(`Pedido ${order.orderNumber} aceptado. Ya está en preparación.`);
      } else if (newStatus === 'DELIVERED' || newStatus === 'PICKED_UP') {
        setNotice(`Pedido ${order.orderNumber}: ${statusLabel.toLowerCase()}. Ya pasó al historial.`);
      } else {
        setNotice(`Pedido ${order.orderNumber} cancelado.`);
      }
      await loadOrders(false);
    } catch (err) {
      whatsappWindow?.close();
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el pedido.');
    } finally {
      setUpdatingIds((current) => current.filter((id) => id !== order.id));
    }
  }

  const filteredActive = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es-CO');
    const source = activeOrders.filter((order) => {
      if (!term) return true;
      return [order.orderNumber, order.customerName, order.customerPhone, order.city, order.neighborhood]
        .some((value) => (value || '').toLocaleLowerCase('es-CO').includes(term));
    });
    return source.sort((a, b) => (parseDbDate(a.createdAt)?.getTime() || 0) - (parseDbDate(b.createdAt)?.getTime() || 0));
  }, [activeOrders, search]);

  const filteredHistory = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es-CO');
    return historyOrders.filter((order) => !term || [order.orderNumber, order.customerName, order.customerPhone]
      .some((value) => (value || '').toLocaleLowerCase('es-CO').includes(term)));
  }, [historyOrders, search]);

  const newOrders = filteredActive.filter((order) => order.status === 'PENDING' || order.status === 'CONFIRMED');
  const preparingOrders = filteredActive.filter((order) => order.status === 'PREPARING');
  const pickupReady = filteredActive.filter((order) => order.status === 'READY' && order.orderType === 'PICKUP');
  const dispatched = filteredActive.filter((order) => order.status === 'OUT_FOR_DELIVERY' || (order.status === 'READY' && order.orderType === 'DELIVERY'));
  const readyCount = pickupReady.length + dispatched.length;

  function orderCard(order: Order, mode: 'new' | 'preparing' | 'ready' | 'history') {
    const elapsed = elapsedLabel(order.createdAt, now);
    const busy = updatingIds.includes(order.id);
    const nextStatus = mode === 'new' ? 'PREPARING' : mode === 'preparing'
      ? (order.orderType === 'DELIVERY' ? 'OUT_FOR_DELIVERY' : 'READY')
      : mode === 'ready' ? (order.orderType === 'DELIVERY' ? 'DELIVERED' : 'PICKED_UP') : null;
    return (
      <article key={order.id} className="rounded-xl border border-[#EAD8D1] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-[#321B25]">{order.orderNumber}</span>
              {mode === 'new' && <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold uppercase text-red-800">Nuevo pedido</span>}
              {mode === 'preparing' && <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-violet-800">En preparación</span>}
              {mode === 'ready' && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">{order.orderType === 'DELIVERY' ? 'Despachado' : 'Listo para recoger'}</span>}
              {mode === 'history' && <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-700">{STATUS_LABELS[order.status] || order.status}</span>}
            </div>
            <p className="mt-1 font-semibold text-[#321B25]">{order.customerName}</p>
            <p className="text-xs text-gray-500">{order.customerPhone}</p>
          </div>
          <div className={`rounded-lg px-3 py-2 text-right text-xs font-bold ${elapsed.tone}`}>
            <div>Tiempo desde que llegó</div>
            <div className="mt-0.5 text-sm">{elapsed.text}</div>
          </div>
        </div>

        <div className="mt-3 rounded-lg bg-[#FAF5F2] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#79574F]">{order.orderType === 'DELIVERY' ? 'Domicilio' : 'Recogida en el negocio'}</span>
            <span className="text-sm font-bold text-[#321B25]">{formatCOP(order.total)}</span>
          </div>
          <p className="mt-1 text-sm font-medium text-[#321B25]">{order.itemsSummary || `${order.itemQuantityTotal} unidad(es)`}</p>
          {order.orderType === 'DELIVERY' && (
            <p className="mt-1 text-xs text-gray-600">{[order.addressLine, order.neighborhood, order.city].filter(Boolean).join(' · ') || 'Dirección pendiente de revisar'}</p>
          )}
          {order.scheduledAt && <p className="mt-1 text-xs font-semibold text-[#96594D]">Programado: {formatSchedule(order.scheduledAt)}</p>}
          {order.customerNotes && <p className="mt-2 text-xs text-gray-700">Indicaciones: {order.customerNotes}</p>}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
            <span className={`rounded-full px-2.5 py-1 ${order.paymentStatus === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
              Pago: {PAYMENT_LABELS[order.paymentStatus] || order.paymentStatus}
            </span>
            {order.whatsappUpdatesConsent && <span className="rounded-full bg-green-50 px-2.5 py-1 text-green-800">Aviso WhatsApp autorizado</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {mode === 'new' && (
              <button type="button" disabled={busy} onClick={() => void updateOrderStatus(order, 'PREPARING')}
                className="rounded-lg bg-[#96594D] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#7E493F] disabled:opacity-50">
                {busy ? 'Actualizando…' : 'Aceptar y empezar preparación'}
              </button>
            )}
            {mode === 'preparing' && nextStatus && (
              <button type="button" disabled={busy} onClick={() => void updateOrderStatus(order, nextStatus)}
                className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
                {busy ? 'Actualizando…' : 'Marcar como listo'}
              </button>
            )}
            {mode === 'ready' && nextStatus && (
              <button type="button" disabled={busy} onClick={() => {
                const action = order.orderType === 'DELIVERY' ? 'confirmar que el domicilio fue entregado' : 'confirmar que el cliente recogió el pedido';
                if (window.confirm(`¿Deseas ${action} del pedido ${order.orderNumber}?`)) void updateOrderStatus(order, nextStatus);
              }}
                className="rounded-lg bg-[#465B45] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#354735] disabled:opacity-50">
                {busy ? 'Actualizando…' : order.orderType === 'DELIVERY' ? 'Confirmar entrega' : 'Confirmar recogida'}
              </button>
            )}
            {(mode === 'new' || mode === 'preparing') && <button type="button" disabled={busy} onClick={() => { if (window.confirm('¿Cancelar este pedido?')) void updateOrderStatus(order, 'CANCELLED'); }} className="rounded-lg border border-red-200 px-3 py-2.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Cancelar</button>}
            <Link to={`/orders/${order.id}`} className="rounded-lg border border-[#DEC8BF] px-3 py-2.5 text-xs font-semibold text-[#75483E] hover:bg-[#FAF5F2]">Ver detalle</Link>
            {fallbackLinks[order.id] && <a href={fallbackLinks[order.id]} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-green-700 px-3 py-2.5 text-xs font-semibold text-white">Abrir WhatsApp</a>}
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9A6257]">Operación de cocina</p>
          <h1 className="mt-1 text-2xl font-bold text-[#321B25]">Bandeja de pedidos</h1>
          <p className="mt-1 text-sm text-gray-500">Los pedidos nuevos aparecen automáticamente. Atiende primero el que lleva más tiempo esperando.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void enableAlerts()} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${alertsEnabled ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-[#DEC8BF] bg-white text-[#75483E]'}`}>
            {alertsEnabled ? '🔔 Alertas activadas' : '🔔 Activar alertas y sonido'}
          </button>
          <button type="button" onClick={() => void loadOrders(false)} className="rounded-lg border border-[#DEC8BF] bg-white px-3 py-2 text-sm font-semibold text-[#75483E]">Actualizar</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button type="button" onClick={() => setActiveTab('new')} className={`rounded-xl border p-4 text-left ${activeTab === 'new' ? 'border-red-300 bg-red-50' : 'border-[#EAD8D1] bg-white'}`}>
          <div className="text-xs font-semibold uppercase tracking-wide text-red-800">Nuevos por aceptar</div>
          <div className="mt-1 text-3xl font-bold text-red-800">{newOrders.length}</div>
          <div className="mt-1 text-xs text-gray-600">Ordenados del más antiguo al más reciente</div>
        </button>
        <button type="button" onClick={() => setActiveTab('preparing')} className={`rounded-xl border p-4 text-left ${activeTab === 'preparing' ? 'border-violet-300 bg-violet-50' : 'border-[#EAD8D1] bg-white'}`}>
          <div className="text-xs font-semibold uppercase tracking-wide text-violet-800">En preparación</div>
          <div className="mt-1 text-3xl font-bold text-violet-800">{preparingOrders.length}</div>
          <div className="mt-1 text-xs text-gray-600">Pedidos que están en cocina</div>
        </button>
        <button type="button" onClick={() => setActiveTab('ready')} className={`rounded-xl border p-4 text-left ${activeTab === 'ready' ? 'border-emerald-300 bg-emerald-50' : 'border-[#EAD8D1] bg-white'}`}>
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Listos / despachados</div>
          <div className="mt-1 text-3xl font-bold text-emerald-800">{readyCount}</div>
          <div className="mt-1 text-xs text-gray-600">Separados de la cola de preparación</div>
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#EAD8D1] bg-white p-3">
        <div className="flex flex-wrap gap-2">
          {([
            ['new', 'Nuevos'], ['preparing', 'En cocina'], ['ready', 'Listos'], ['history', 'Historial'],
          ] as [QueueTab, string][]).map(([value, label]) => (
            <button type="button" key={value} onClick={() => setActiveTab(value)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${activeTab === value ? 'bg-[#7E1837] text-white' : 'border border-[#EAD8D1] text-[#75483E] hover:bg-[#FAF5F2]'}`}>
              {label}{value === 'new' && newOrders.length > 0 ? ` (${newOrders.length})` : ''}
            </button>
          ))}
        </div>
        <label className="min-w-[220px] flex-1 text-sm font-medium text-[#321B25] sm:max-w-xs">
          <span className="sr-only">Buscar pedido</span>
          <input value={search} onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)} placeholder="Buscar cliente, teléfono o pedido…" className="w-full rounded-lg border border-[#DEC8BF] px-3 py-2 font-normal outline-none focus:border-[#96594D]" />
        </label>
      </div>

      {notice && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</div>}
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <span>{activeOrders.length} pedidos activos · {historyOrders.length} en historial cargados</span>
        <span>{lastUpdated ? `Última actualización: ${lastUpdated.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · actualización automática cada 15 segundos` : 'Consultando pedidos…'}</span>
      </div>

      {loading ? <div className="rounded-xl border border-[#EAD8D1] bg-white py-14 text-center text-sm text-gray-500">Cargando pedidos…</div> : (
        <>
          {activeTab === 'new' && (newOrders.length ? <div className="space-y-3">{newOrders.map((order) => orderCard(order, 'new'))}</div> : <div className="rounded-xl border border-dashed border-[#DCC6BD] bg-white px-5 py-14 text-center"><div className="text-lg font-semibold text-[#321B25]">No hay pedidos nuevos</div><p className="mt-1 text-sm text-gray-500">Cuando llegue una compra, aparecerá aquí y recibirás una alerta si las activaste.</p></div>)}
          {activeTab === 'preparing' && (preparingOrders.length ? <div className="space-y-3">{preparingOrders.map((order) => orderCard(order, 'preparing'))}</div> : <div className="rounded-xl border border-dashed border-[#DCC6BD] bg-white px-5 py-14 text-center"><div className="text-lg font-semibold text-[#321B25]">La cocina está al día</div><p className="mt-1 text-sm text-gray-500">Aquí aparecerán los pedidos que Erika acepte para preparar.</p></div>)}
          {activeTab === 'ready' && (readyCount ? <div className="space-y-5">
            <section className="space-y-3"><h2 className="text-base font-bold text-[#321B25]">Esperando que el cliente recoja ({pickupReady.length})</h2>{pickupReady.length ? pickupReady.map((order) => orderCard(order, 'ready')) : <p className="rounded-lg bg-white p-4 text-sm text-gray-500">No hay pedidos esperando recogida.</p>}</section>
            <section className="space-y-3"><h2 className="text-base font-bold text-[#321B25]">Domicilios despachados ({dispatched.length})</h2>{dispatched.length ? dispatched.map((order) => orderCard(order, 'ready')) : <p className="rounded-lg bg-white p-4 text-sm text-gray-500">No hay domicilios despachados.</p>}</section>
          </div> : <div className="rounded-xl border border-dashed border-[#DCC6BD] bg-white px-5 py-14 text-center"><div className="text-lg font-semibold text-[#321B25]">Todavía no hay pedidos listos</div><p className="mt-1 text-sm text-gray-500">Cuando Erika termine de preparar un pedido, aparecerá aquí.</p></div>)}
          {activeTab === 'history' && (filteredHistory.length ? <div className="space-y-3">{filteredHistory.map((order) => orderCard(order, 'history'))}</div> : <div className="rounded-xl border border-dashed border-[#DCC6BD] bg-white px-5 py-14 text-center"><div className="text-lg font-semibold text-[#321B25]">Todavía no hay pedidos cerrados</div><p className="mt-1 text-sm text-gray-500">Los pedidos entregados, recogidos o cancelados aparecerán aquí.</p></div>)}
        </>
      )}

      {notificationPermission === 'denied' && <p className="text-xs text-amber-800">Las notificaciones del navegador están bloqueadas. Puedes permitirlas desde los permisos del sitio en el navegador; el aviso sonoro seguirá funcionando mientras el panel esté abierto y las alertas estén activadas.</p>}
      {notificationPermission === 'unsupported' && <p className="text-xs text-gray-500">Este navegador no admite notificaciones de escritorio. La bandeja y el contador se actualizan mientras el panel está abierto.</p>}
    </div>
  );
}
