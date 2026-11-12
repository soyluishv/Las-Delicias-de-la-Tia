import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

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
  createdAt: string;
  updatedAt: string;
}

interface ListResponse {
  success: boolean;
  data: EventRequest[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  financialSummary: {
    activeEvents: number;
    inProgressEvents: number;
    quotedTotalCop: number;
    receivedCop: number;
    outstandingCop: number;
  };
  error?: string;
}

const statuses = [
  { value: 'ALL', label: 'Todas las solicitudes' },
  { value: 'PENDING', label: 'Pendientes' },
  { value: 'IN_REVIEW', label: 'En revisión' },
  { value: 'QUOTED', label: 'Cotizadas' },
  { value: 'ACCEPTED', label: 'Aceptadas' },
  { value: 'REJECTED', label: 'Rechazadas' },
  { value: 'CANCELLED', label: 'Canceladas' },
];

const statusStyle: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  IN_REVIEW: 'bg-blue-100 text-blue-800',
  QUOTED: 'bg-purple-100 text-purple-800',
  ACCEPTED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-700',
};

const statusLabel: Record<string, string> = {
  PENDING: 'Pendiente',
  IN_REVIEW: 'En revisión',
  QUOTED: 'Cotizada',
  ACCEPTED: 'Aceptada',
  REJECTED: 'Rechazada',
  CANCELLED: 'Cancelada',
};

const operationalLabel: Record<string, string> = {
  PENDING: 'Por coordinar',
  CONFIRMED: 'Confirmado',
  PREPARING: 'En preparación',
  READY: 'Listo para salir',
  DISPATCHED: 'En camino',
  DELIVERED: 'Entregado',
  COMPLETED: 'Finalizado',
  CANCELLED: 'Cancelado',
};

const formatCOP = (value: number | null) =>
  value === null
    ? 'Sin definir'
    : new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
      }).format(value);

const formatDate = (value: string | null) => {
  if (!value) return 'Por definir';

  const date = new Date(`${value.slice(0, 10)}T12:00:00-05:00`);

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeZone: 'America/Bogota',
  }).format(date);
};

export default function EventRequests() {
  const [requests, setRequests] = useState<EventRequest[]>([]);
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [financialSummary, setFinancialSummary] = useState<ListResponse['financialSummary']>({
    activeEvents: 0, inProgressEvents: 0, quotedTotalCop: 0, receivedCop: 0, outstandingCop: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token') || '';
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        status,
        search: search.trim(),
      });

      const response = await fetch(`/api/admin/events?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json() as ListResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'No fue posible cargar las solicitudes.');
      }

      setRequests(result.data);
      setTotal(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
      setFinancialSummary(result.financialSummary || {
        activeEvents: 0, inProgressEvents: 0, quotedTotalCop: 0, receivedCop: 0, outstandingCop: 0
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No fue posible consultar las solicitudes.'
      );
    } finally {
      setLoading(false);
    }
  }, [page, status, search]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  function changeStatus(value: string) {
    setStatus(value);
    setPage(1);
  }

  function changeSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-[#A71942]">
            Las Delicias de la Tía
          </p>
          <h1 className="mt-1 text-2xl font-extrabold text-[#76152F]">
            Solicitudes de eventos
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Consulta las solicitudes de cotización recibidas.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadRequests()}
          disabled={loading}
          className="rounded-xl border border-[#A71942] px-4 py-2.5 text-sm font-semibold text-[#A71942] transition hover:bg-[#FFF1F3] disabled:opacity-50"
        >
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Eventos activos</p>
          <p className="mt-2 text-3xl font-extrabold text-[#76152F]">{financialSummary.activeEvents}</p>
          <p className="mt-1 text-xs text-gray-400">Solicitudes no rechazadas ni canceladas</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Valor total cotizado</p>
          <p className="mt-2 text-2xl font-extrabold text-gray-900">{formatCOP(financialSummary.quotedTotalCop)}</p>
          <p className="mt-1 text-xs text-gray-400">Incluye transporte de eventos</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
          <p className="text-sm text-emerald-700">Abonos recibidos</p>
          <p className="mt-2 text-2xl font-extrabold text-emerald-800">{formatCOP(financialSummary.receivedCop)}</p>
          <p className="mt-1 text-xs text-emerald-700">Movimientos registrados</p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 shadow-sm">
          <p className="text-sm text-amber-700">Saldo pendiente por cobrar</p>
          <p className="mt-2 text-2xl font-extrabold text-amber-900">{formatCOP(financialSummary.outstandingCop)}</p>
          <p className="mt-1 text-xs text-amber-700">En eventos activos cotizados</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row">
        <input
          type="search"
          value={search}
          onChange={(event) => changeSearch(event.target.value)}
          placeholder="Buscar por nombre, teléfono o número de solicitud..."
          maxLength={100}
          className="min-w-0 flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-[#A71942] focus:ring-2 focus:ring-[#A71942]/10"
        />

        <select
          value={status}
          onChange={(event) => changeStatus(event.target.value)}
          className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#A71942]"
          aria-label="Filtrar solicitudes por estado"
        >
          {statuses.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center text-gray-500">
          Cargando solicitudes...
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-5 py-16 text-center shadow-sm">
          <div className="text-4xl">🎉</div>
          <h2 className="mt-4 text-lg font-bold text-[#76152F]">
            No hay solicitudes para mostrar
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Cuando un cliente solicite una cotización, aparecerá aquí.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="bg-[#FFF6F3] text-xs uppercase tracking-wider text-[#76152F]">
                <tr>
                  <th className="px-5 py-4">Solicitud</th>
                  <th className="px-5 py-4">Cliente</th>
                  <th className="px-5 py-4">Evento</th>
                  <th className="px-5 py-4">Fecha</th>
                  <th className="px-5 py-4">Invitados</th>
                  <th className="px-5 py-4">Presupuesto</th>
                  <th className="px-5 py-4">Cotización</th>
                  <th className="px-5 py-4">Recibido</th>
                  <th className="px-5 py-4">Saldo</th>
                  <th className="px-5 py-4">Estado de solicitud</th>
                  <th className="px-5 py-4">Operación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {requests.map((item) => (
                  <tr key={item.id} className="transition hover:bg-[#FFFAF8]">
                    <td className="px-5 py-4">
                      <Link
                        to={`/events/${item.id}`}
                        className="font-mono text-xs font-semibold text-[#A71942] hover:underline"
                        title="Ver detalles de la solicitud"
                      >
                        {item.requestNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-900">{item.contactName}</p>
                      <p className="mt-1 text-xs text-gray-500">{item.contactPhone}</p>
                    </td>
                    <td className="px-5 py-4 font-medium text-gray-700">
                      {item.eventType}
                    </td>
                    <td className="px-5 py-4 text-gray-600">
                      {formatDate(item.eventDate)}
                    </td>
                    <td className="px-5 py-4 text-gray-600">
                      {item.guestCount ?? 'Sin definir'}
                    </td>
                    <td className="px-5 py-4 text-gray-600">
                      {formatCOP(item.budgetCop)}
                    </td>
                    <td className="px-5 py-4 text-gray-600">
                      {item.quotedTotalCop === null ? 'Sin cotizar' : formatCOP(item.quotedTotalCop + (item.deliveryFeeCop || 0))}
                    </td>
                    <td className="px-5 py-4 font-semibold text-emerald-700">{formatCOP(item.depositPaidCop || 0)}</td>
                    <td className="px-5 py-4 font-semibold text-[#76152F]">
                      {item.quotedTotalCop === null ? '—' : formatCOP(Math.max(0, item.quotedTotalCop + (item.deliveryFeeCop || 0) - (item.depositPaidCop || 0)))}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyle[item.status] || 'bg-gray-100 text-gray-700'}`}>
                        {statusLabel[item.status] || item.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-full bg-[#FFF2E3] px-3 py-1 text-xs font-semibold text-[#7A4D1B]">
                        {operationalLabel[item.operationalStatus || 'PENDING'] || item.operationalStatus || 'Por coordinar'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          {total} solicitud(es) en total
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => current - 1)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="px-2 text-sm text-gray-600">
            Página {page} de {Math.max(totalPages, 1)}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((current) => current + 1)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}