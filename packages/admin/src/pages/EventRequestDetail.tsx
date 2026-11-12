import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

interface EventRequest {
  id: string;
  requestNumber: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  eventType: string;
  eventDate: string | null;
  guestCount: number | null;
  city: string | null;
  neighborhood: string | null;
  venueAddress: string | null;
  budgetCop: number | null;
  requestedFood: string | null;
  eventDetails: string | null;
  status: string;
  quotedTotalCop: number | null;
  deliveryFeeCop: number;
  depositRequiredCop: number;
  depositPaidCop: number;
  operationalStatus: string;
  plannedDeliveryAt: string | null;
  deliveryResponsible: string | null;
  deliveryNotes: string | null;
  paymentHistory: EventPayment[];
  operationalHistory: EventStatusHistory[];
  quoteDetails: string | null;
  adminNotes: string | null;
  whatsappConsent: number | boolean;
  whatsappConsentAt: string | null;
  createdAt: string;
  updatedAt: string;
  suggestedDeliveryZone?: EventTransportZone | null;
}

interface EventTransportZone {
  id: string;
  name: string;
  city: string;
  neighborhoods: string[];
  feeCop: number;
  isActive: boolean;
}

interface EventStatusHistory {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  changedBy: string | null;
  notes: string | null;
  createdAt: string;
}

interface EventPayment {
  id: string;
  amountCop: number;
  paymentMethod: 'CASH' | 'TRANSFER' | 'NEQUI' | 'BRE_B' | 'OTHER';
  paidAt: string;
  reference: string | null;
  notes: string | null;
  createdBy?: string | null;
  createdAt: string;
}

const operationalStatuses = [
  { value: 'PENDING', label: 'Por coordinar' },
  { value: 'CONFIRMED', label: 'Confirmado' },
  { value: 'PREPARING', label: 'En preparación' },
  { value: 'READY', label: 'Listo para salir' },
  { value: 'DISPATCHED', label: 'En camino' },
  { value: 'DELIVERED', label: 'Entregado' },
  { value: 'COMPLETED', label: 'Finalizado' },
  { value: 'CANCELLED', label: 'Cancelado' },
];

const paymentMethods = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'TRANSFER', label: 'Transferencia bancaria' },
  { value: 'NEQUI', label: 'Nequi' },
  { value: 'BRE_B', label: 'Bre-B' },
  { value: 'OTHER', label: 'Otro medio' },
];

const todayInBogota = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date());

const statuses = [
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'IN_REVIEW', label: 'En revisión' },
  { value: 'QUOTED', label: 'Cotizada' },
  { value: 'ACCEPTED', label: 'Aceptada' },
  { value: 'REJECTED', label: 'Rechazada' },
  { value: 'CANCELLED', label: 'Cancelada' },
];

const fieldClass =
  'w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#A71942] focus:ring-2 focus:ring-[#A71942]/10';

const labelClass =
  'mb-2 block text-sm font-semibold text-gray-700';

const formatCOP = (value: number | null) =>
  value === null
    ? 'No informado'
    : new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
      }).format(value);

const formatDate = (value: string | null) => {
  if (!value) return 'Por definir';

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'long',
    timeZone: 'America/Bogota',
  }).format(new Date(`${value.slice(0, 10)}T12:00:00-05:00`));
};

const safeCOPInput = (value: string) => {
  const amount = Number(value || 0);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : 0;
};

// Limpia texto copiado desde documentos o bloques Markdown antes de abrir WhatsApp.
const formatQuoteDetailsForWhatsApp = (value: string) =>
  value
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .replace(/\\([*_~`])/g, '$1')
    .replace(/\*{2,}([^\n]+?)\*{2,}/g, '*$1*')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const formatDateTime = (value: string | null) => {
  if (!value) return 'Fecha no disponible';

  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(normalized);
  const date = new Date(hasTimezone ? normalized : `${normalized}Z`);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(date);
};

function Info({ label, children }: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-gray-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <div className="mt-2 break-words text-sm font-medium text-gray-900">
        {children || 'No informado'}
      </div>
    </div>
  );
}

export default function EventRequestDetail() {
  const { id } = useParams<{ id: string }>();

  const [event, setEvent] = useState<EventRequest | null>(null);
  const [status, setStatus] = useState('PENDING');
  const [quotedTotal, setQuotedTotal] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('0');
  const [deliveryFeeTouched, setDeliveryFeeTouched] = useState(false);
  const [depositRequired, setDepositRequired] = useState('0');
  const [quoteDetails, setQuoteDetails] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [operationalStatus, setOperationalStatus] = useState('PENDING');
  const [plannedDeliveryAt, setPlannedDeliveryAt] = useState('');
  const [deliveryResponsible, setDeliveryResponsible] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<EventPayment['paymentMethod']>('TRANSFER');
  const [paymentDate, setPaymentDate] = useState(todayInBogota());
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadEvent = useCallback(async () => {
    if (!id) {
      setError('No se identificó la solicitud.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token') || '';

      const response = await fetch(
        `/api/admin/events/${encodeURIComponent(id)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'No fue posible cargar la solicitud.');
      }

      const data = result.data as EventRequest;

      setEvent(data);
      setStatus(data.status);
      setQuotedTotal(
        data.quotedTotalCop === null ? '' : String(data.quotedTotalCop)
      );
      const savedDeliveryFee = Number(data.deliveryFeeCop ?? 0);
      const suggestedDeliveryFee = Number(data.suggestedDeliveryZone?.feeCop ?? 0);
      setDeliveryFee(String(savedDeliveryFee > 0 ? savedDeliveryFee : suggestedDeliveryFee));
      setDeliveryFeeTouched(savedDeliveryFee > 0);
      setDepositRequired(String(data.depositRequiredCop ?? 0));
      setQuoteDetails(data.quoteDetails || '');
      setAdminNotes(data.adminNotes || '');
      setOperationalStatus(data.operationalStatus || 'PENDING');
      setPlannedDeliveryAt(data.plannedDeliveryAt || '');
      setDeliveryResponsible(data.deliveryResponsible || '');
      setDeliveryNotes(data.deliveryNotes || '');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al cargar la solicitud.'
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadEvent();
  }, [loadEvent]);


  async function saveQuotation() {
    if (!id) return;

    setError('');
    setSuccess('');

    const amount = quotedTotal.trim() === '' ? null : Number(quotedTotal);

    const deliveryAmount = Number(deliveryFee || 0);
    const depositRequiredAmount = Number(depositRequired || 0);
    const additionalAmounts = [deliveryAmount, depositRequiredAmount];

    if (
      (amount !== null && (!Number.isSafeInteger(amount) || amount < 0 || amount > 1000000000)) ||
      additionalAmounts.some((value) => !Number.isSafeInteger(value) || value < 0 || value > 1000000000)
    ) {
      setError('Los valores deben ser números enteros válidos en pesos colombianos.');
      return;
    }

    const totalToValidate = (amount ?? 0) + deliveryAmount;
    if (depositRequiredAmount > totalToValidate || Number(event?.depositPaidCop ?? 0) > totalToValidate) {
      setError('El anticipo solicitado o el total ya recibido no puede superar el total del evento.');
      return;
    }

    setSaving(true);

    try {
      const token = localStorage.getItem('token') || '';

      const response = await fetch(
        `/api/admin/events/${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status,
            quotedTotalCop: amount,
            deliveryFeeCop: deliveryAmount,
            depositRequiredCop: depositRequiredAmount,
            quoteDetails: quoteDetails.trim() || null,
            adminNotes: adminNotes.trim() || null,
            operationalStatus,
            plannedDeliveryAt: plannedDeliveryAt || null,
            deliveryResponsible: deliveryResponsible.trim() || null,
            deliveryNotes: deliveryNotes.trim() || null,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'No fue posible guardar los cambios.');
      }

      setEvent(result.data as EventRequest);
      setSuccess('Los cambios se guardaron correctamente.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al guardar los cambios.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function recordPayment() {
    if (!id || !event) return;
    setError('');
    setSuccess('');
    const amount = Number(paymentAmount);
    const eventTotal = Number(event.quotedTotalCop ?? 0) + Number(event.deliveryFeeCop ?? 0);
    const outstanding = Math.max(0, eventTotal - Number(event.depositPaidCop ?? 0));
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      setError('Escribe un valor de abono entero mayor que cero.');
      return;
    }
    if (amount > outstanding) {
      setError(`El abono supera el saldo pendiente. Puedes registrar máximo ${formatCOP(outstanding)}.`);
      return;
    }
    setSavingPayment(true);
    try {
      const token = localStorage.getItem('token') || '';
      const response = await fetch(`/api/admin/events/${encodeURIComponent(id)}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          amountCop: amount,
          paymentMethod,
          paidAt: paymentDate,
          reference: paymentReference.trim() || null,
          notes: paymentNotes.trim() || null,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'No fue posible registrar el abono.');
      setPaymentAmount('');
      setPaymentReference('');
      setPaymentNotes('');
      setPaymentDate(todayInBogota());
      await loadEvent();
      setSuccess('El abono quedó registrado en el historial y el saldo se actualizó.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar el abono.');
    } finally {
      setSavingPayment(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-12 text-center text-gray-500">
        Cargando información del evento...
      </div>
    );
  }

  if (!event) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-8">
        <p className="font-semibold text-red-700">
          {error || 'No se encontró la solicitud.'}
        </p>
        <Link to="/events" className="mt-4 inline-block font-semibold text-[#A71942]">
          Volver a solicitudes
        </Link>
      </div>
    );
  }

  const phone = event.contactPhone.replace(/\D/g, '');
  const whatsappPhone = phone.startsWith('57') ? phone : `57${phone}`;
  const hasWhatsappConsent =
    event.whatsappConsent === true || event.whatsappConsent === 1;
  const hasSavedQuote =
    event.quotedTotalCop !== null || Boolean(event.quoteDetails?.trim());
  const quoteSubtotal = Number(event.quotedTotalCop ?? 0);
  const eventDeliveryFee = Number(event.deliveryFeeCop ?? 0);
  const eventTotal = quoteSubtotal + eventDeliveryFee;
  const requestedDeposit = Number(event.depositRequiredCop ?? 0);
  const receivedDeposit = Number(event.depositPaidCop ?? 0);
  const outstandingBalance = Math.max(0, eventTotal - receivedDeposit);
  const balanceAfterRequestedDeposit = Math.max(0, eventTotal - requestedDeposit);
  const currentOutstandingBalance = Math.max(0, eventTotal - receivedDeposit);
  const balanceMessage = receivedDeposit > 0
    ? `Saldo pendiente por pagar: ${formatCOP(currentOutstandingBalance)}.`
    : requestedDeposit > 0
      ? `Saldo restante después del anticipo solicitado: ${formatCOP(balanceAfterRequestedDeposit)}.`
      : `Saldo pendiente: ${formatCOP(eventTotal)}.`;
  const whatsappQuoteDetails = event.quoteDetails?.trim()
    ? formatQuoteDetailsForWhatsApp(event.quoteDetails)
    : '';
  const matchingTransportZone = event.suggestedDeliveryZone ?? null;
  const matchingSpecificTransportZone = Boolean(
    matchingTransportZone && matchingTransportZone.neighborhoods.length > 0
  );

  const quoteMessage = [
    `Hola ${event.contactName}, te saludamos de Las Delicias de la Tía.`,
    `Te compartimos la cotización para tu evento. Número de solicitud: ${event.requestNumber}.`,
    `Tipo de evento: ${event.eventType}.`,
    event.eventDate ? `Fecha del evento: ${formatDate(event.eventDate)}.` : null,
    event.guestCount
      ? `Número de invitados: ${event.guestCount.toLocaleString('es-CO')}.`
      : null,
    event.quotedTotalCop !== null
      ? `Valor de productos y servicios: ${formatCOP(event.quotedTotalCop)}.`
      : null,
    eventDeliveryFee > 0
      ? `Transporte del evento: ${formatCOP(eventDeliveryFee)}.`
      : null,
    event.quotedTotalCop !== null
      ? `Total del evento: ${formatCOP(eventTotal)}.`
      : null,
    requestedDeposit > 0
      ? `Anticipo solicitado: ${formatCOP(requestedDeposit)}.`
      : null,
    receivedDeposit > 0
      ? `Anticipo recibido: ${formatCOP(receivedDeposit)}.`
      : null,
    event.quotedTotalCop !== null ? balanceMessage : null,
    whatsappQuoteDetails
      ? `Detalles de la propuesta:\n${whatsappQuoteDetails}`
      : null,
    'Quedamos atentos a tus comentarios. ¡Gracias por tenernos en cuenta!',
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n\n');

  const whatsappQuoteUrl =
    hasWhatsappConsent && hasSavedQuote
      ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(quoteMessage)}`
      : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">

      <Link
        to="/events"
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#A71942] hover:underline"
      >
        ← Volver a solicitudes
      </Link>

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#A71942]">
            Las Delicias de la Tía
          </p>
          <h1 className="mt-2 text-2xl font-extrabold text-[#76152F]">
            Detalle del evento
          </h1>
          <p className="mt-1 font-mono text-sm text-gray-500">
            {event.requestNumber}
          </p>
        </div>

        <span className="rounded-full bg-[#FCE8E7] px-4 py-2 text-sm font-bold text-[#921638]">
          {statuses.find((item) => item.value === event.status)?.label || event.status}
        </span>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-lg font-bold text-[#76152F]">
          Información del cliente
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Info label="Nombre">{event.contactName}</Info>
          <Info label="Teléfono">{event.contactPhone}</Info>
          <Info label="Correo">{event.contactEmail}</Info>
          <Info label="Autorización para contacto por WhatsApp">
            {hasWhatsappConsent ? 'Sí, autorizó el contacto' : 'No autorizó el contacto'}
          </Info>
          <Info label="Fecha de autorización">
            {hasWhatsappConsent
              ? formatDateTime(event.whatsappConsentAt)
              : 'No aplica'}
          </Info>
        </div>

        {hasWhatsappConsent ? (
          <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-semibold text-green-800">
              El cliente autorizó que lo contactemos por WhatsApp para atender esta solicitud y compartir la cotización.
            </p>

            {whatsappQuoteUrl ? (
              <>
                <a
                  href={whatsappQuoteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex rounded-xl bg-[#168A53] px-5 py-3 text-sm font-bold text-white hover:bg-[#116D42]"
                >
                  Abrir WhatsApp con la cotización
                </a>
                <p className="mt-2 text-xs leading-relaxed text-green-800">
                  Se abrirá WhatsApp con el mensaje preparado. Revisa la información y pulsa Enviar desde WhatsApp; el mensaje no se envía automáticamente.
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-green-800">
                Guarda primero el valor o los detalles de la cotización para preparar el mensaje de WhatsApp.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
            Este cliente no autorizó el contacto por WhatsApp. No se muestra el acceso para escribirle por ese medio. Utiliza otro canal de contacto disponible, como el correo electrónico.
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-lg font-bold text-[#76152F]">
          Información del evento
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Info label="Tipo de evento">{event.eventType}</Info>
          <Info label="Fecha">{formatDate(event.eventDate)}</Info>
          <Info label="Número de invitados">{event.guestCount?.toLocaleString('es-CO')}</Info>
          <Info label="Ciudad o municipio">{event.city}</Info>
          <Info label="Barrio o sector">{event.neighborhood}</Info>
          <Info label="Dirección del evento">{event.venueAddress}</Info>
          <Info label="Presupuesto del cliente">{formatCOP(event.budgetCop)}</Info>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl bg-gray-50 p-4">
            <h3 className="text-sm font-bold text-gray-700">
              Comidas solicitadas
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
              {event.requestedFood || 'El cliente no indicó productos específicos.'}
            </p>
          </div>

          <div className="rounded-xl bg-gray-50 p-4">
            <h3 className="text-sm font-bold text-gray-700">
              Detalles adicionales
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
              {event.eventDetails || 'Sin detalles adicionales.'}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#F0DDD5] bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-lg font-bold text-[#76152F]">
          Gestión de cotización
        </h2>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="eventStatus">
              Estado de la solicitud
            </label>
            <select
              id="eventStatus"
              className={fieldClass}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {statuses.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="quotedTotal">
              Valor de la cotización (COP)
            </label>
            <input
              id="quotedTotal"
              type="number"
              min="0"
              max="1000000000"
              step="1"
              className={fieldClass}
              value={quotedTotal}
              onChange={(e) => setQuotedTotal(e.target.value)}
              placeholder="Ej. 450000"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="deliveryFee">
              Transporte del evento (COP)
            </label>
            <input
              id="deliveryFee"
              type="number"
              min="0"
              max="1000000000"
              step="1"
              className={fieldClass}
              value={deliveryFee}
              onChange={(e) => {
                setDeliveryFee(e.target.value);
                setDeliveryFeeTouched(true);
              }}
              placeholder="0"
            />
            <p className="mt-1 text-xs text-gray-500">Se cobra por separado de los productos y servicios. Puedes ajustar el valor según la fecha, el volumen y las condiciones de entrega.</p>
            <div className="mt-3 rounded-xl border border-[#F0DDD5] bg-[#FFFAF8] p-3">
              {matchingTransportZone ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#8A5B2C]">Tarifa sugerida por cobertura</p>
                    <p className="mt-1 text-sm font-semibold text-[#76152F]">{matchingTransportZone.name} · {formatCOP(matchingTransportZone.feeCop)}</p>
                    <p className="mt-1 text-xs text-gray-500">{matchingSpecificTransportZone ? 'Tarifa específica del sector; tiene prioridad sobre la tarifa general.' : 'Tarifa general configurada para este municipio.'}</p>
                    <p className="mt-1 text-xs font-semibold text-emerald-700">{deliveryFeeTouched ? 'Puedes ajustar manualmente el transporte para este evento.' : 'Esta tarifa se aplicó automáticamente a la cotización.'}</p>
                  </div>
                  {deliveryFeeTouched && <button type="button" onClick={() => { setDeliveryFee(String(matchingTransportZone.feeCop)); setDeliveryFeeTouched(false); }} className="rounded-lg border border-[#D7A64D] bg-white px-3 py-2 text-xs font-bold text-[#76152F] hover:bg-[#FFF8EF]">Restablecer tarifa sugerida</button>}
                </div>
              ) : (
                <p className="text-xs leading-5 text-[#71563B]">No hay una tarifa de transporte configurada para {event.city || 'este municipio'}{event.neighborhood ? ` · ${event.neighborhood}` : ''}. Puedes escribir aquí el valor acordado para esta cotización o configurar la zona en Domicilios → Transporte de eventos.</p>
              )}
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="depositRequired">
              Anticipo solicitado (COP)
            </label>
            <input
              id="depositRequired"
              type="number"
              min="0"
              max="1000000000"
              step="1"
              className={fieldClass}
              value={depositRequired}
              onChange={(e) => setDepositRequired(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Total recibido</p>
            <p className="mt-2 text-xl font-extrabold text-emerald-800">{formatCOP(receivedDeposit)}</p>
            <p className="mt-1 text-xs text-emerald-700">Se actualiza al registrar cada movimiento en el historial de pagos.</p>
          </div>

          <div className="sm:col-span-2 rounded-xl border border-[#F0DDD5] bg-[#FFFAF8] p-4">
            <h3 className="text-sm font-bold text-[#76152F]">Resumen económico del evento</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div><p className="text-xs text-gray-500">Productos y servicios</p><p className="mt-1 font-bold text-gray-900">{formatCOP(safeCOPInput(quotedTotal))}</p></div>
              <div><p className="text-xs text-gray-500">Transporte del evento</p><p className="mt-1 font-bold text-gray-900">{formatCOP(safeCOPInput(deliveryFee))}</p></div>
              <div><p className="text-xs text-gray-500">Total del evento</p><p className="mt-1 font-bold text-[#76152F]">{formatCOP(safeCOPInput(quotedTotal) + safeCOPInput(deliveryFee))}</p></div>
              <div><p className="text-xs text-gray-500">Total recibido</p><p className="mt-1 font-bold text-emerald-700">{formatCOP(receivedDeposit)}</p></div>
              <div><p className="text-xs text-gray-500">Saldo pendiente</p><p className="mt-1 font-bold text-[#76152F]">{formatCOP(Math.max(0, safeCOPInput(quotedTotal) + safeCOPInput(deliveryFee) - receivedDeposit))}</p></div>
            </div>
          </div>

          <div className="sm:col-span-2 rounded-xl border border-[#F0DDD5] bg-[#FFFAF8] p-4">
            <h3 className="text-sm font-bold text-[#76152F]">Seguimiento de preparación y entrega</h3>
            <p className="mt-1 text-xs text-gray-500">Este estado es interno y no reemplaza el estado de la solicitud de cotización.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="operationalStatus">Estado operativo</label>
                <select id="operationalStatus" className={fieldClass} value={operationalStatus} onChange={(e) => setOperationalStatus(e.target.value)}>
                  {operationalStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="plannedDeliveryAt">Fecha y hora programada de entrega</label>
                <input id="plannedDeliveryAt" type="datetime-local" className={fieldClass} value={plannedDeliveryAt} onChange={(e) => setPlannedDeliveryAt(e.target.value)} />
              </div>
              <div>
                <label className={labelClass} htmlFor="deliveryResponsible">Responsable de preparación o entrega</label>
                <input id="deliveryResponsible" type="text" maxLength={120} className={fieldClass} value={deliveryResponsible} onChange={(e) => setDeliveryResponsible(e.target.value)} placeholder="Nombre de quien coordina o entrega" />
              </div>
              <div>
                <label className={labelClass} htmlFor="deliveryNotes">Indicaciones de preparación y entrega (internas)</label>
                <textarea id="deliveryNotes" rows={3} maxLength={2000} className={fieldClass} value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} placeholder="Hora de salida, montaje, recepción, instrucciones..." />
              </div>
            </div>
            <div className="mt-5 border-t border-[#F0DDD5] pt-4">
              <h4 className="text-sm font-bold text-[#76152F]">Historial de estados operativos</h4>
              {(!event.operationalHistory || event.operationalHistory.length === 0) ? (
                <p className="mt-2 text-xs text-gray-500">Todavía no hay cambios de estado registrados.</p>
              ) : (
                <ol className="mt-3 space-y-3">
                  {event.operationalHistory.map((entry) => (
                    <li key={entry.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg bg-white p-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {entry.fromStatus ? `${operationalStatuses.find((item) => item.value === entry.fromStatus)?.label || entry.fromStatus} → ` : ''}{operationalStatuses.find((item) => item.value === entry.toStatus)?.label || entry.toStatus}
                        </p>
                        {entry.notes && <p className="mt-1 text-xs text-gray-500">{entry.notes}</p>}
                      </div>
                      <span className="text-xs text-gray-400">{entry.changedBy === 'MIGRATION' ? 'Registro inicial' : formatDateTime(entry.createdAt)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="quoteDetails">
              Descripción de la propuesta
            </label>
            <textarea
              id="quoteDetails"
              rows={5}
              maxLength={4000}
              className={fieldClass}
              value={quoteDetails}
              onChange={(e) => setQuoteDetails(e.target.value)}
              placeholder="Describe los platos, cantidades, servicios y condiciones de la propuesta..."
            />
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="adminNotes">
              Notas internas (solo administración)
            </label>
            <textarea
              id="adminNotes"
              rows={3}
              maxLength={2000}
              className={fieldClass}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Anotaciones privadas para el equipo..."
            />
          </div>
        </div>

        {error && (
          <div role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div role="status" className="mt-5 rounded-xl bg-green-50 p-4 text-sm text-green-800">
            {success}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            Última actualización: {formatDate(event.updatedAt)}
          </p>

          <button
            type="button"
            onClick={() => void saveQuotation()}
            disabled={saving}
            className="rounded-xl bg-[#A71942] px-7 py-3 font-bold text-white shadow-sm transition hover:bg-[#821333] disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar cotización y estado'}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-[#F0DDD5] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#76152F]">Historial de pagos y anticipos</h2>
            <p className="mt-1 text-sm text-gray-500">Cada abono queda registrado por separado con fecha, medio de pago y referencia.</p>
          </div>
          <div className="rounded-xl bg-[#FFF8EF] px-4 py-3 text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#8A5B2C]">Saldo pendiente</p>
            <p className="mt-1 text-xl font-extrabold text-[#76152F]">{formatCOP(outstandingBalance)}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-500">Total del evento</p><p className="mt-1 font-bold">{formatCOP(eventTotal)}</p></div>
          <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-500">Anticipo solicitado</p><p className="mt-1 font-bold">{formatCOP(requestedDeposit)}</p></div>
          <div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs text-emerald-700">Total recibido</p><p className="mt-1 font-bold text-emerald-800">{formatCOP(receivedDeposit)}</p></div>
          <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-500">Porcentaje recibido</p><p className="mt-1 font-bold">{eventTotal > 0 ? `${Math.round((receivedDeposit / eventTotal) * 100)}%` : '0%'}</p></div>
        </div>

        <div className="mt-6 rounded-xl border border-gray-200 p-4">
          <h3 className="font-bold text-gray-800">Registrar nuevo abono</h3>
          {event.quotedTotalCop === null ? (
            <p className="mt-2 text-sm text-amber-700">Primero guarda la cotización para poder registrar pagos.</p>
          ) : outstandingBalance <= 0 ? (
            <p className="mt-2 text-sm font-semibold text-emerald-700">Este evento ya está completamente pagado.</p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div><label className={labelClass} htmlFor="paymentAmount">Valor recibido (COP)</label><input id="paymentAmount" type="number" min="1" max={outstandingBalance} step="1" className={fieldClass} value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="Ej. 200000" /></div>
              <div><label className={labelClass} htmlFor="paymentMethod">Medio de pago</label><select id="paymentMethod" className={fieldClass} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as EventPayment['paymentMethod'])}>{paymentMethods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
              <div><label className={labelClass} htmlFor="paymentDate">Fecha del abono</label><input id="paymentDate" type="date" className={fieldClass} value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /></div>
              <div><label className={labelClass} htmlFor="paymentReference">Referencia o comprobante (opcional)</label><input id="paymentReference" type="text" maxLength={120} className={fieldClass} value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="Número de transferencia" /></div>
              <div className="sm:col-span-2"><label className={labelClass} htmlFor="paymentNotes">Observaciones del abono (opcional)</label><input id="paymentNotes" type="text" maxLength={1000} className={fieldClass} value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="Ej. Anticipo para confirmar la fecha" /></div>
              <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-gray-500">Máximo pendiente por recibir: <strong>{formatCOP(outstandingBalance)}</strong>. El registro es manual; no procesa pagos bancarios.</p>
                <button type="button" onClick={() => void recordPayment()} disabled={savingPayment} className="rounded-xl bg-[#168A53] px-6 py-3 text-sm font-bold text-white hover:bg-[#116D42] disabled:opacity-50">{savingPayment ? 'Registrando abono...' : 'Registrar abono'}</button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6">
          <h3 className="font-bold text-gray-800">Movimientos registrados</h3>
          {(!event.paymentHistory || event.paymentHistory.length === 0) ? (
            <div className="mt-3 rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">Todavía no hay abonos registrados.</div>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-[#FFF8EF] text-xs uppercase tracking-wide text-[#76152F]"><tr><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Medio</th><th className="px-4 py-3">Referencia</th><th className="px-4 py-3">Observaciones</th><th className="px-4 py-3 text-right">Valor recibido</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {event.paymentHistory.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-4 py-3">{payment.createdBy === 'MIGRATION' ? 'Fecha no registrada' : formatDate(payment.paidAt)}</td>
                      <td className="px-4 py-3">{payment.createdBy === 'MIGRATION' ? 'Medio no registrado' : paymentMethods.find((item) => item.value === payment.paymentMethod)?.label || 'Otro medio'}</td>
                      <td className="px-4 py-3">{payment.reference || '—'}</td>
                      <td className="px-4 py-3">{payment.notes || (payment.createdBy === 'MIGRATION' ? 'Saldo acumulado anterior al historial detallado' : '—')}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700">{formatCOP(payment.amountCop)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}