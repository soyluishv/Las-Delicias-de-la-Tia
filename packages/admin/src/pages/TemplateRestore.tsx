import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

type RestoreStatus = {
  hasPreviousPersonalization: boolean;
  backupCreatedAt: string | null;
};

type ApiResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  data?: RestoreStatus;
};

const ORIGINAL_CONFIRMATION = 'RESTAURAR ORIGINAL';
const PREVIOUS_CONFIRMATION = 'RECUPERAR MI DISEÑO';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDate(value: string | null): string {
  if (!value) return 'Sin respaldo previo';
  const parsed = new Date(value.replace(' ', 'T') + (value.includes('Z') ? '' : 'Z'));
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('es-CO');
}

export default function TemplateRestore() {
  const [status, setStatus] = useState<RestoreStatus>({
    hasPreviousPersonalization: false,
    backupCreatedAt: null,
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'original' | 'previous' | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/settings/presentation/restore-status', {
        headers: authHeaders(),
      });
      const result = (await response.json()) as ApiResponse;
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'No fue posible consultar el estado del respaldo.');
      }
      setStatus(result.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible consultar el respaldo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function runRestore(kind: 'original' | 'previous') {
    const expected = kind === 'original' ? ORIGINAL_CONFIRMATION : PREVIOUS_CONFIRMATION;
    if (confirmation.trim() !== expected) {
      setError(`Escribe exactamente: ${expected}`);
      return;
    }
    if (kind === 'previous' && !status.hasPreviousPersonalization) {
      setError('Todavía no existe una personalización anterior respaldada.');
      return;
    }

    setBusy(kind);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(
        kind === 'original'
          ? '/api/settings/presentation/restore-original'
          : '/api/settings/presentation/restore-previous',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ confirmation: expected }),
        },
      );
      const result = (await response.json()) as ApiResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'No se pudo completar la restauración.');
      }
      setSuccess(result.message || 'La configuración de presentación se restauró correctamente. Actualiza la tienda pública.');
      setConfirmation('');
      await loadStatus();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo completar la restauración.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link to="/settings" className="text-sm font-medium text-primary-600 hover:underline">← Volver a configuración</Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary-700">Protección de la tienda</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Plantilla original y restauración</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
          Conserva la identidad visual original de Las Delicias de la Tía. Puedes experimentar con textos,
          colores y secciones sabiendo que existe una forma segura de volver a la plantilla predeterminada.
        </p>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {success && <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">{success}</div>}

      <section className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 via-white to-amber-50 p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-800">
              Plantilla protegida · versión original
            </span>
            <h2 className="mt-3 text-xl font-bold text-gray-900">Las Delicias de la Tía</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600">
              Recupera los colores crema, frambuesa y vino, la tipografía, los textos originales,
              la portada, la navegación y la presentación predeterminada.
            </p>
          </div>
          <div className="rounded-xl border border-rose-100 bg-white p-3 text-3xl" aria-hidden="true">↶</div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            ['Diseño visual', 'Paleta original, tipografía, proporciones, radios y sombras.'],
            ['Contenido público', 'Textos, botones, navegación, portada, menú, eventos y pie de página.'],
            ['Constructor de portada', 'La plantilla original vuelve sin bloques adicionales. Tus bloques actuales quedan guardados en la personalización anterior.'],
            ['Identidad de la tienda', 'Nombre, título del sitio, eslogan, logo y favicon predeterminados.'],
          ].map(([title, description]) => (
            <div key={title} className="rounded-xl border border-white bg-white/90 p-4">
              <p className="text-sm font-semibold text-gray-900">{title}</p>
              <p className="mt-1 text-xs leading-5 text-gray-600">{description}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-950">Antes de restaurar, guardaremos tu personalización actual.</p>
          <p className="mt-1 text-xs leading-5 text-amber-900">
            La plantilla original quita los bloques adicionales del constructor y restablece el mosaico
            para que use automáticamente las primeras tres fotografías de productos disponibles. Tus
            bloques y la selección anterior de fotografías quedan incluidos en el respaldo y vuelven al
            elegir “Recuperar mi personalización anterior”. Los archivos de imágenes no se eliminan.
          </p>
          <p className="mt-2 text-xs leading-5 text-amber-900">
            La restauración tampoco elimina productos, categorías, fotografías almacenadas, inventario,
            clientes, usuarios, pedidos, cotizaciones, pagos, horarios, tarifas ni zonas de entrega.
          </p>
        </div>

        <div className="mt-5 space-y-3">
          <label className="block text-sm font-semibold text-gray-800">
            Para confirmar, escribe: <span className="font-mono text-rose-700">{ORIGINAL_CONFIRMATION}</span>
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
              placeholder="Escribe la frase de confirmación"
            />
          </label>
          <button
            type="button"
            onClick={() => void runRestore('original')}
            disabled={busy !== null || loading || confirmation.trim() !== ORIGINAL_CONFIRMATION}
            className="inline-flex w-full items-center justify-center rounded-xl bg-rose-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
          >
            {busy === 'original' ? 'Respaldando y restaurando…' : 'Restaurar plantilla original'}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Recuperar mi personalización anterior</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600">
              Si restauraste la plantilla original y luego quieres recuperar el diseño que tenías justo antes,
              podrás volver a esa copia.
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.hasPreviousPersonalization ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
            {loading ? 'Consultando…' : status.hasPreviousPersonalization ? 'Respaldo disponible' : 'Aún sin respaldo'}
          </span>
        </div>

        <div className="mt-4 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
          {loading ? 'Consultando respaldo…' : `Último respaldo: ${formatDate(status.backupCreatedAt)}`}
        </div>
        <p className="mt-2 text-xs leading-5 text-gray-500">
          La recuperación devuelve también los bloques del constructor y las fotografías destacadas
          seleccionadas antes de restaurar la plantilla original.
        </p>

        <div className="mt-4 space-y-3">
          <label className="block text-sm font-semibold text-gray-800">
            Para confirmar, escribe: <span className="font-mono text-gray-700">{PREVIOUS_CONFIRMATION}</span>
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-100"
              placeholder="Escribe la frase de confirmación"
            />
          </label>
          <button
            type="button"
            onClick={() => void runRestore('previous')}
            disabled={busy !== null || loading || !status.hasPreviousPersonalization || confirmation.trim() !== PREVIOUS_CONFIRMATION}
            className="inline-flex w-full items-center justify-center rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
          >
            {busy === 'previous' ? 'Recuperando…' : 'Recuperar personalización anterior'}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
        <strong>Qué no hace esta herramienta:</strong> no elimina ni modifica pedidos, cotizaciones, pagos,
        productos, categorías, clientes, usuarios, tarifas, medios de pago o zonas de entrega. Tampoco borra
        archivos de imágenes del almacenamiento. Solo restaura la configuración de presentación y los textos
        predeterminados de la tienda.
      </section>
    </div>
  );
}
