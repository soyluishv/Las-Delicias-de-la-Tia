import { useEffect, useState } from 'react';

interface MediaInventoryItem {
  id: string;
  filename: string;
  originalName: string;
  url: string;
  mimeType: string;
  size: number;
  createdAt: string;
  source: 'r2' | 'static';
  usedBy: string[];
}

interface MediaInventoryResponse {
  success?: boolean;
  data?: MediaInventoryItem[];
  activeR2Images?: number;
  activeStorageBytes?: number;
  error?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  if (!iso) return 'Archivo incluido en el proyecto';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(date);
}

export default function DesignMedia() {
  const [items, setItems] = useState<MediaInventoryItem[]>([]);
  const [activeR2Images, setActiveR2Images] = useState(0);
  const [activeStorageBytes, setActiveStorageBytes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token') || '';

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/media?limit=2500', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json() as MediaInventoryResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'No fue posible consultar el almacenamiento de imágenes.');
      }
      setItems(Array.isArray(result.data) ? result.data : []);
      setActiveR2Images(Number(result.activeR2Images) || 0);
      setActiveStorageBytes(Number(result.activeStorageBytes) || 0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible consultar el almacenamiento de imágenes.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // La sesión se lee al montar la página; no cambia durante esta vista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const staticCount = items.filter((item) => item.source === 'static').length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gray-800">Almacenamiento de imágenes</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
            Aquí aparecen únicamente las fotografías que utiliza actualmente la tienda. Para cambiar o retirar una imagen,
            hazlo desde el producto, categoría o sección correspondiente. Los originales permanecen en tu computador o celular.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? 'Actualizando…' : 'Actualizar estado'}
        </button>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Resumen del almacenamiento">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Imágenes activas en la nube</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{activeR2Images}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Espacio activo en R2</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{formatSize(activeStorageBytes)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Recursos estáticos del sitio</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{staticCount}</p>
        </div>
      </section>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
        Esta pantalla es informativa: no almacena fotografías nuevas ni conserva archivos sin uso. Las imágenes se cargan
        desde el formulario donde las necesitas. Cuando reemplazas o retiras una fotografía, el sistema comprueba sus usos
        y libera el archivo de la nube cuando ninguna otra sección lo necesita.
      </div>

      {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <p className="font-medium text-gray-700">No hay fotografías activas registradas en este entorno.</p>
          <p className="mt-1 text-sm text-gray-500">Cuando cargues una imagen desde su módulo y guardes el cambio, aparecerá aquí.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <article key={`${item.source}:${item.id}`} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="aspect-square bg-gray-100">
                <img src={item.url} alt={item.originalName} className="h-full w-full object-cover" loading="lazy" />
              </div>
              <div className="space-y-2 p-3">
                <p className="truncate text-sm font-semibold text-gray-900" title={item.originalName}>{item.originalName}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span>{item.source === 'r2' ? formatSize(item.size) : 'Incluida en el proyecto'}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatDate(item.createdAt)}</span>
                </div>
                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${item.source === 'r2' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                  {item.source === 'r2' ? 'Almacenada en la nube' : 'Archivo estático del sitio'}
                </span>
                <div className="border-t border-gray-100 pt-2">
                  <p className="mb-1 text-xs font-semibold text-gray-700">Dónde se utiliza</p>
                  {item.usedBy.length > 0 ? (
                    <ul className="space-y-1 text-xs leading-5 text-gray-600">
                      {item.usedBy.map((usage) => <li key={usage}>• {usage}</li>)}
                    </ul>
                  ) : (
                    <p className="text-xs text-gray-500">Sin referencias activas</p>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
