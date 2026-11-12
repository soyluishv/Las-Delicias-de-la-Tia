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
  quoteDetails: string | null;
  adminNotes: string | null;
  whatsappConsent: number | boolean;
  whatsappConsentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

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
  const [quoteDetails, setQuoteDetails] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

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
      setQuoteDetails(data.quoteDetails || '');
      setAdminNotes(data.adminNotes || '');
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

    if (
      amount !== null &&
      (!Number.isSafeInteger(amount) || amount < 0 || amount > 1000000000)
    ) {
      setError('Introduce un valor válido en pesos colombianos.');
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
            quoteDetails: quoteDetails.trim() || null,
            adminNotes: adminNotes.trim() || null,
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

  const quoteMessage = [
    `Hola ${event.contactName}, te saludamos de Las Delicias de la Tía.`,
    `Te compartimos la cotización para tu evento. Número de solicitud: ${event.requestNumber}.`,
    `Tipo de evento: ${event.eventType}.`,
    event.eventDate ? `Fecha del evento: ${formatDate(event.eventDate)}.` : null,
    event.guestCount
      ? `Número de invitados: ${event.guestCount.toLocaleString('es-CO')}.`
      : null,
    event.quotedTotalCop !== null
      ? `Valor de la cotización: ${formatCOP(event.quotedTotalCop)}.`
      : null,
    event.quoteDetails?.trim()
      ? `Detalles de la propuesta:\\n${event.quoteDetails.trim()}`
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
    </div>
  );
}