import { useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '../context/CartContext.js';

type Order = {
  id: string;
  orderNumber?: string;
  orderType?: string;
  status?: string;
  subtotal?: number;
  deliveryFee?: number;
  discount?: number;
  total?: number;
};

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

function formatCOP(value: number | undefined): string {
  const amount = Number(value ?? 0);
  return copFormatter.format(Number.isFinite(amount) ? Math.round(amount) : 0);
}

function getOrderTypeLabel(orderType: string | undefined): string {
  switch ((orderType || '').toUpperCase()) {
    case 'DELIVERY': return 'Domicilio';
    case 'PICKUP': return 'Recogida';
    default: return 'Por confirmar';
  }
}

function getStatusPresentation(status: string | undefined, orderType: string | undefined): { label: string; className: string } {
  switch ((status || '').toUpperCase()) {
    case 'PENDING': return { label: 'Pendiente', className: 'bg-amber-100 text-amber-800' };
    case 'CONFIRMED': return { label: 'Confirmado', className: 'bg-blue-100 text-blue-800' };
    case 'PREPARING': return { label: 'En preparación', className: 'bg-purple-100 text-purple-800' };
    case 'READY': return { label: orderType?.toUpperCase() === 'PICKUP' ? 'Listo para recoger' : 'Listo para salir', className: 'bg-emerald-100 text-emerald-800' };
    case 'OUT_FOR_DELIVERY': return { label: 'En camino', className: 'bg-indigo-100 text-indigo-800' };
    case 'DELIVERED': return { label: 'Entregado', className: 'bg-green-100 text-green-800' };
    case 'PICKED_UP': return { label: 'Recogido', className: 'bg-green-100 text-green-800' };
    case 'CANCELLED': return { label: 'Cancelado', className: 'bg-red-100 text-red-800' };
    default: return { label: 'En revisión', className: 'bg-gray-100 text-gray-700' };
  }
}

export default function OrderConfirmation() {
  const { t } = useTranslation();
  const { id } = useParams();
  const location = useLocation();
  const [search] = useSearchParams();
  const { clear } = useCart();

  const paid = search.get('paid') === 'true';
  const initial = (location.state?.order as Order | undefined) ?? null;
  const [order, setOrder] = useState<Order | null>(initial);
  const [polls, setPolls] = useState(0);

  useEffect(() => {
    if (paid) clear();
  }, [paid, clear]);

  useEffect(() => {
    if (!id) return;
    if (order && order.status === 'CONFIRMED') return;
    if (polls > 10) return;

    let cancelled = false;
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(`/api/orders/${id}`);
        if (!response.ok) return;
        const data = await response.json() as { data?: Order };
        if (!cancelled && data?.data) setOrder(data.data);
        setPolls((count) => count + 1);
      } catch {
        // La página conserva los datos recibidos al crear el pedido.
      }
    }, polls === 0 ? 0 : 1500);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [id, order, polls]);

  const confirmed = order?.status === 'CONFIRMED';
  const status = getStatusPresentation(order?.status, order?.orderType);
  const isDelivery = order?.orderType?.toUpperCase() === 'DELIVERY';

  return (
    <div data-ld-page="confirmation" className="ld-order-page mx-auto max-w-2xl px-4 py-12 text-center sm:px-6 lg:px-8">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h1 className="mb-2 text-3xl font-bold text-gray-900">{t('orderConfirmation.title')}</h1>
      <p className="mb-2 text-gray-600">{t('orderConfirmation.thankYou')}</p>

      {paid && !confirmed && (
        <p className="mb-2 text-sm text-gray-500">Estamos verificando tu pago. Te informaremos cuando quede confirmado.</p>
      )}

      {(order?.orderNumber || id) && (
        <p className="mb-6 text-sm text-gray-500">
          {t('orderConfirmation.orderNumber')} {order?.orderNumber ? `#${order.orderNumber}` : `ID: ${id}`}
        </p>
      )}

      {order && (
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 text-left shadow-sm">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Tipo de pedido</span>
              <p className="mt-1 font-semibold text-gray-900">{getOrderTypeLabel(order.orderType)}</p>
            </div>
            <div>
              <span className="text-gray-500">Estado</span>
              <p className="mt-1">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>
                  {status.label}
                </span>
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3 border-t border-gray-100 pt-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium text-gray-900">{formatCOP(order.subtotal)}</span>
            </div>
            {isDelivery && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-gray-600">Domicilio</span>
                <span className="font-medium text-gray-900">{formatCOP(order.deliveryFee)}</span>
              </div>
            )}
            {Number(order.discount ?? 0) > 0 && (
              <div className="flex items-center justify-between gap-4 text-green-700">
                <span>Descuento</span>
                <span className="font-medium">-{formatCOP(order.discount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-4 border-t border-gray-200 pt-3">
              <span className="text-base font-bold text-gray-900">Total</span>
              <span className="text-xl font-extrabold text-primary-600">{formatCOP(order.total)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        {id && (
          <Link
            to={`/orders/${id}`}
            className="rounded-lg border border-primary-600 px-6 py-2.5 font-medium text-primary-700 transition-colors hover:bg-primary-50"
          >
            Seguir mi pedido
          </Link>
        )}
        <Link
          to="/menu"
          className="rounded-lg bg-primary-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-primary-700"
        >
          {t('orderConfirmation.orderMore')}
        </Link>
        <Link
          to="/"
          className="rounded-lg border border-gray-300 px-6 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          {t('notFound.backHome')}
        </Link>
      </div>
    </div>
  );
}
