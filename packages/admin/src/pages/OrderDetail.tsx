import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  comment: string | null;
  options: { id?: string; name: string; value: string; priceModifier?: number }[];
}
interface OrderDetail {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  orderType: 'DELIVERY' | 'PICKUP';
  status: string;
  addressLine: string | null;
  neighborhood: string | null;
  city: string | null;
  addressReference: string | null;
  deliveryZoneName: string | null;
  itemQuantityTotal: number;
  subtotal: number;
  tax: number;
  deliveryFee: number;
  discount: number;
  total: number;
  paymentMethod: string;
  paymentMethodDetail: string | null;
  paymentStatus: string;
  scheduledAt: string | null;
  customerNotes: string | null;
  adminNotes: string | null;
  deliveryPersonName: string | null;
  whatsappUpdatesConsent: boolean | number;
  whatsappUpdatesConsentAt?: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente', CONFIRMED: 'Confirmado', PREPARING: 'En preparación',
  READY: 'Listo para salir', OUT_FOR_DELIVERY: 'En camino', DELIVERED: 'Entregado',
  PICKED_UP: 'Recogido', CANCELLED: 'Cancelado',
};
const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800', CONFIRMED: 'bg-blue-100 text-blue-800',
  PREPARING: 'bg-violet-100 text-violet-800', READY: 'bg-emerald-100 text-emerald-800',
  OUT_FOR_DELIVERY: 'bg-indigo-100 text-indigo-800', DELIVERED: 'bg-green-100 text-green-800',
  PICKED_UP: 'bg-green-100 text-green-800', CANCELLED: 'bg-red-100 text-red-800',
};
const TRANSITIONS: Record<string, string[]> = {
  PENDING: ['PREPARING', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['CANCELLED'],
  READY: [], OUT_FOR_DELIVERY: ['DELIVERED'], DELIVERED: [], PICKED_UP: [], CANCELLED: [],
};
const PAYMENT_LABELS: Record<string, string> = { PENDING: 'Pendiente', PAID: 'Pagado', FAILED: 'Fallido', REFUNDED: 'Reembolsado' };
const formatCOP = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0);
const formatDate = (value: string) => new Date(value).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
const cardClass = 'rounded-xl border border-[#EAD8D1] bg-white p-5 shadow-sm';

export default function OrderDetailPage() {
  const { id } = useParams();
  const token = localStorage.getItem('token') || '';
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('PENDING');
  const [adminNotes, setAdminNotes] = useState('');
  const [deliveryPersonName, setDeliveryPersonName] = useState('');
  const [whatsappFallbackUrl, setWhatsappFallbackUrl] = useState('');

  function buildWhatsAppUrl(): string | null {
    if (!order || !order.whatsappUpdatesConsent) return null;
    const digits = (order.customerPhone || '').replace(/\D/g, '');
    const phone = digits.length === 10 ? `57${digits}` : (digits.length === 12 && digits.startsWith('57') ? digits : '');
    if (!phone) return null;

    const isDelivery = order.orderType === 'DELIVERY';
    const greeting = `Hola ${order.customerName},`;
    const orderRef = `pedido #${order.orderNumber}`;
    const body = isDelivery
      ? `${greeting}\n\nTe escribimos de Las Delicias de la Tía para contarte que tu ${orderRef} ya está listo y va en camino a la dirección que nos indicaste.\n\nTotal del pedido: ${formatCOP(order.total)}.\n\nGracias por elegirnos. ¡Que lo disfrutes!`
      : `${greeting}\n\nTu ${orderRef} de Las Delicias de la Tía ya está preparado y listo para recoger en nuestro punto de entrega.\n\nTotal del pedido: ${formatCOP(order.total)}.\n\nPuedes pasar por él cuando gustes. ¡Te esperamos!`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(body)}`;
  }

  useEffect(() => {
    const controller = new AbortController();
    async function loadOrder() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/admin/orders/${id}`, {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'No se pudo cargar el pedido.');
        const loaded = result.data as OrderDetail;
        setOrder(loaded);
        setPaymentStatus(loaded.paymentStatus || 'PENDING');
        setAdminNotes(loaded.adminNotes || '');
        setDeliveryPersonName(loaded.deliveryPersonName || '');
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Ocurrió un error al cargar el pedido.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadOrder();
    return () => controller.abort();
  }, [id, token]);

  const nextStatuses = useMemo(() => {
    if (!order) return [];
    if (order.status === 'PREPARING') {
      return [order.orderType === 'DELIVERY' ? 'OUT_FOR_DELIVERY' : 'READY', 'CANCELLED'];
    }
    if (order.status === 'READY') {
      return order.orderType === 'DELIVERY'
        ? ['OUT_FOR_DELIVERY', 'CANCELLED'] // Compatibilidad con pedidos anteriores.
        : ['PICKED_UP', 'CANCELLED'];
    }
    return TRANSITIONS[order.status] || [];
  }, [order]);

  function actionLabel(status: string): string {
    if (status === 'PREPARING') return 'Aceptar pedido y empezar preparación';
    if (status === 'OUT_FOR_DELIVERY') {
      return order?.whatsappUpdatesConsent
        ? 'Marcar como despachado y abrir WhatsApp'
        : 'Marcar como despachado';
    }
    if (status === 'READY' && order?.orderType === 'PICKUP') return 'Marcar como listo y abrir WhatsApp';
    if (status === 'PICKED_UP') return 'Confirmar recogida';
    if (status === 'DELIVERED') return 'Confirmar entrega';
    return 'Cancelar pedido';
  }

  async function updateStatus(newStatus: string) {
    if (!order) return;
    const isReadyNotice = newStatus === 'OUT_FOR_DELIVERY' || (newStatus === 'READY' && order.orderType === 'PICKUP');
    const targetWhatsAppUrl = isReadyNotice ? buildWhatsAppUrl() : null;
    // Open synchronously inside the user's click so the browser does not block the WhatsApp tab.
    const whatsappWindow = targetWhatsAppUrl ? window.open('about:blank', '_blank') : null;

    setUpdatingStatus(true);
    setError('');
    setMessage('');
    setWhatsappFallbackUrl('');
    try {
      const response = await fetch(`/api/admin/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo actualizar el estado.');
      setOrder((current) => current ? { ...current, status: newStatus } : current);

      if (isReadyNotice) {
        if (!order.whatsappUpdatesConsent) {
          setMessage('El pedido quedó actualizado. El cliente no autorizó avisos por WhatsApp, así que no se abrió una conversación.');
        } else if (!targetWhatsAppUrl) {
          setMessage('El pedido quedó actualizado, pero el teléfono no tiene un formato válido para WhatsApp. Revisa el número del cliente.');
        } else if (whatsappWindow) {
          whatsappWindow.opener = null;
          whatsappWindow.location.href = targetWhatsAppUrl;
          setMessage('El estado quedó actualizado. WhatsApp se abrió con el aviso preparado; solo falta pulsar Enviar.');
        } else {
          setWhatsappFallbackUrl(targetWhatsAppUrl);
          setMessage('El estado quedó actualizado. El navegador bloqueó la ventana emergente; usa el enlace para abrir WhatsApp.');
        }
      } else {
        setMessage(newStatus === 'PREPARING'
          ? 'Pedido aceptado. Ya aparece como En preparación.'
          : 'El pedido se canceló correctamente.');
      }
    } catch (err) {
      whatsappWindow?.close();
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el estado.');
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingDetails(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/admin/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ paymentStatus, adminNotes, deliveryPersonName }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudieron guardar los detalles.');
      setOrder((current) => current ? { ...current, paymentStatus, adminNotes, deliveryPersonName } : current);
      setMessage('Los datos internos del pedido se guardaron correctamente.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar los detalles.');
    } finally {
      setSavingDetails(false);
    }
  }

  if (loading) return <div className="rounded-xl border border-[#EAD8D1] bg-white py-16 text-center text-sm text-gray-500">Cargando pedido…</div>;
  if (error && !order) return <div className="space-y-4"><div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div><Link to="/orders" className="font-semibold text-[#96594D]">Volver a pedidos</Link></div>;
  if (!order) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to="/orders" className="text-sm font-medium text-[#96594D] hover:underline">← Volver a pedidos</Link>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#9A6257]">Detalle de compra</p>
          <h1 className="mt-1 text-2xl font-bold text-[#321B25]">Pedido {order.orderNumber}</h1>
          <p className="mt-1 text-sm text-gray-500">Recibido el {formatDate(order.createdAt)}</p>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-700'}`}>{order.status === 'READY' && order.orderType === 'PICKUP' ? 'Listo para recoger' : STATUS_LABELS[order.status] || order.status}</span>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {message && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{message}</div>}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
        <div className="space-y-5">
          <section className={cardClass}>
            <h2 className="text-lg font-semibold text-[#321B25]">Productos del pedido</h2>
            <div className="mt-4 divide-y divide-[#F0E5E0]">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="font-semibold text-[#321B25]"><span className="mr-2 text-[#96594D]">{item.quantity} ×</span>{item.name}</div>
                    {item.options?.length > 0 && <p className="mt-1 text-xs text-gray-500">{item.options.map((option) => `${option.name}: ${option.value}`).join(' · ')}</p>}
                    {item.comment && <p className="mt-1 text-xs italic text-gray-500">Nota: {item.comment}</p>}
                    <p className="mt-1 text-xs text-gray-400">Valor unitario: {formatCOP(item.unitPrice)}</p>
                  </div>
                  <div className="shrink-0 font-semibold text-[#321B25]">{formatCOP(item.subtotal)}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-2 border-t border-[#EAD8D1] pt-4 text-sm">
              <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span>{formatCOP(order.subtotal)}</span></div>
              {order.deliveryFee > 0 && <div className="flex justify-between"><span className="text-gray-600">Domicilio</span><span>{formatCOP(order.deliveryFee)}</span></div>}
              {order.discount > 0 && <div className="flex justify-between text-green-700"><span>Descuento</span><span>−{formatCOP(order.discount)}</span></div>}
              <div className="flex justify-between border-t border-[#EAD8D1] pt-3 text-base font-bold text-[#321B25]"><span>Total</span><span>{formatCOP(order.total)}</span></div>
            </div>
          </section>

          <section className={cardClass}>
            <h2 className="text-lg font-semibold text-[#321B25]">Datos del cliente</h2>
            <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><dt className="text-xs text-gray-500">Nombre</dt><dd className="mt-1 font-medium text-[#321B25]">{order.customerName}</dd></div>
              <div><dt className="text-xs text-gray-500">Teléfono</dt><dd className="mt-1 font-medium text-[#321B25]">{order.customerPhone}</dd></div>
              <div><dt className="text-xs text-gray-500">Aviso por WhatsApp</dt><dd className="mt-1 font-medium text-[#321B25]">{order.whatsappUpdatesConsent ? 'Autorizado por el cliente' : 'No autorizado'}</dd></div>
              {order.customerEmail && <div><dt className="text-xs text-gray-500">Correo</dt><dd className="mt-1 font-medium text-[#321B25]">{order.customerEmail}</dd></div>}
              <div><dt className="text-xs text-gray-500">Modalidad</dt><dd className="mt-1 font-medium text-[#321B25]">{order.orderType === 'DELIVERY' ? 'Domicilio' : 'Recoger en el negocio'}</dd></div>
            </dl>
            {order.orderType === 'DELIVERY' && (
              <div className="mt-4 rounded-lg bg-[#FAF5F2] p-4">
                <h3 className="font-semibold text-[#321B25]">Dirección de entrega</h3>
                <p className="mt-2 text-sm text-[#49323A]">{order.addressLine || 'Sin dirección registrada'}</p>
                <p className="mt-1 text-sm text-gray-600">{[order.neighborhood, order.city].filter(Boolean).join(' · ')}</p>
                {order.deliveryZoneName && <p className="mt-1 text-xs text-gray-500">Zona: {order.deliveryZoneName}</p>}
                {order.addressReference && <p className="mt-2 text-sm text-gray-600">Referencia: {order.addressReference}</p>}
              </div>
            )}
            {order.customerNotes && <div className="mt-4 rounded-lg border border-[#EAD8D1] p-4"><h3 className="text-sm font-semibold text-[#321B25]">Indicaciones del cliente</h3><p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{order.customerNotes}</p></div>}
          </section>
        </div>

        <aside className="space-y-5">
          <section className={cardClass}>
            <h2 className="text-lg font-semibold text-[#321B25]">Preparación del pedido</h2>
            <p className="mt-1 text-xs text-gray-500">Erika solo necesita dos acciones: empezar a preparar y marcar cuando esté listo.</p>
            <div className="mt-4 space-y-2">
              <div className={`rounded-lg px-3 py-2 text-sm font-semibold ${STATUS_COLORS[order.status] || 'bg-gray-100'}`}>
                Estado actual: {order.status === 'READY' && order.orderType === 'PICKUP' ? 'Listo para recoger' : STATUS_LABELS[order.status] || order.status}
              </div>
              {nextStatuses.length ? nextStatuses.map((status) => (
                <button
                  type="button"
                  key={status}
                  disabled={updatingStatus}
                  onClick={() => {
                    if (status === 'CANCELLED' && !window.confirm('¿Seguro que deseas cancelar este pedido?')) return;
                    void updateStatus(status);
                  }}
                  className={`w-full rounded-lg border px-3 py-3 text-left text-sm font-semibold transition hover:border-[#96594D] hover:bg-[#FAF5F2] disabled:opacity-50 ${status === 'CANCELLED' ? 'border-red-200 text-red-700' : 'border-[#EAD8D1] text-[#75483E]'}`}
                >
                  {updatingStatus ? 'Actualizando…' : actionLabel(status)}
                </button>
              )) : <p className="rounded-lg bg-gray-50 px-3 py-3 text-sm text-gray-500">No hay más acciones de preparación pendientes para este pedido.</p>}
            </div>
            {order.status === 'PREPARING' && order.whatsappUpdatesConsent && (
              <p className="mt-3 rounded-lg bg-green-50 p-3 text-xs leading-5 text-green-800">
                Al marcarlo como listo, se abrirá WhatsApp con el mensaje correspondiente a domicilio o recogida. Erika solo tendrá que revisar y pulsar Enviar.
              </p>
            )}
            {order.status === 'PREPARING' && !order.whatsappUpdatesConsent && (
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                El cliente no autorizó avisos por WhatsApp. Al marcarlo como listo solo se actualizará el pedido.
              </p>
            )}
            {whatsappFallbackUrl && (
              <a href={whatsappFallbackUrl} target="_blank" rel="noopener noreferrer"
                className="mt-3 block rounded-lg bg-green-700 px-3 py-3 text-center text-sm font-semibold text-white hover:bg-green-800">
                Abrir WhatsApp para revisar y enviar
              </a>
            )}
            {order.scheduledAt && <p className="mt-4 rounded-lg bg-[#F8F1ED] p-3 text-sm text-[#75483E]">Pedido programado para: <strong>{formatDate(order.scheduledAt)}</strong></p>}
          </section>

          <form className={cardClass} onSubmit={saveDetails}>
            <h2 className="text-lg font-semibold text-[#321B25]">Control interno</h2>
            <label className="mt-4 block text-sm font-medium text-[#49323A]">Estado del pago
              <select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#DEC8BF] bg-white px-3 py-2 outline-none focus:border-[#96594D]">
                <option value="PENDING">Pendiente</option><option value="PAID">Pagado</option><option value="FAILED">Fallido</option><option value="REFUNDED">Reembolsado</option>
              </select>
            </label>
            <label className="mt-4 block text-sm font-medium text-[#49323A]">Persona encargada del domicilio
              <input value={deliveryPersonName} onChange={(event) => setDeliveryPersonName(event.target.value)} maxLength={120} placeholder="Nombre del domiciliario" className="mt-1.5 w-full rounded-lg border border-[#DEC8BF] px-3 py-2 font-normal outline-none focus:border-[#96594D]" />
            </label>
            <label className="mt-4 block text-sm font-medium text-[#49323A]">Notas privadas del negocio
              <textarea value={adminNotes} onChange={(event) => setAdminNotes(event.target.value)} rows={4} maxLength={1500} placeholder="Notas para el equipo; el cliente no las verá." className="mt-1.5 w-full rounded-lg border border-[#DEC8BF] px-3 py-2 font-normal outline-none focus:border-[#96594D]" />
            </label>
            <button type="submit" disabled={savingDetails} className="mt-4 w-full rounded-lg bg-[#96594D] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#7E493F] disabled:opacity-50">{savingDetails ? 'Guardando…' : 'Guardar datos internos'}</button>
          </form>

          <section className={cardClass}>
            <h2 className="text-lg font-semibold text-[#321B25]">Información del pago</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div><dt className="text-gray-500">Medio de pago</dt><dd className="mt-1 font-medium text-[#321B25]">{order.paymentMethod === 'CASH' ? 'Efectivo' : order.paymentMethodDetail || 'Transferencia'}</dd></div>
              <div><dt className="text-gray-500">Estado</dt><dd className="mt-1 font-medium text-[#321B25]">{PAYMENT_LABELS[order.paymentStatus] || order.paymentStatus}</dd></div>
              <div><dt className="text-gray-500">Unidades</dt><dd className="mt-1 font-medium text-[#321B25]">{order.itemQuantityTotal}</dd></div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
