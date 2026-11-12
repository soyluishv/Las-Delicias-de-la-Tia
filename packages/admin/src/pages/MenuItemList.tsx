import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';

interface MenuItem {
  id: string;
  name: string;
  slug: string;
  price: number;
  image: string | null;
  isActive: boolean;
  sortOrder: number;
  trackStock: boolean;
  stockQty: number;
  category: { id: string; name: string };
  _count: { options: number; allergens: number; mealtimes: number };
}

interface Category {
  id: string;
  name: string;
}

interface MenuItemResponse {
  success: boolean;
  data: MenuItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const formatCOP = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);

export default function MenuItemList() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  const fetchItems = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search.trim()) params.set('search', search.trim());
    if (categoryFilter) params.set('categoryId', categoryFilter);

    try {
      const response = await api.get<MenuItemResponse>(`/menu/items?${params.toString()}`);
      setItems(response.data);
      setPagination({
        page: response.pagination.page,
        totalPages: response.pagination.totalPages,
        total: response.pagination.total,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar los productos.');
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter]);

  useEffect(() => {
    api.get<{ data: Category[] }>('/menu/categories')
      .then((response) => setCategories(response.data))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    void fetchItems(1);
  }, [fetchItems]);

  const handleDelete = async (id: string, name: string) => {
    const confirmed = window.confirm(`¿Deseas eliminar el producto "${name}"? Los pedidos anteriores conservarán su descripción histórica.`);
    if (!confirmed) return;
    try {
      await api.delete(`/menu/items/${id}`);
      await fetchItems(Math.min(pagination.page, pagination.totalPages));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'No fue posible eliminar el producto.');
    }
  };

  const renderStatus = (item: MenuItem) => (
    <div className="flex flex-wrap gap-1.5">
      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${item.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
        {item.isActive ? 'Activo' : 'Inactivo'}
      </span>
      {item.trackStock && (
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${item.stockQty > 0 ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
          Existencias: {item.stockQty}
        </span>
      )}
    </div>
  );

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold text-gray-800">Productos</h2>
          <p className="mt-1 text-sm text-gray-500">Administra el catálogo, los precios y las existencias.</p>
        </div>
        <Link
          to="/menu/items/new"
          className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-700 sm:w-auto"
        >
          + Nuevo producto
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm sm:flex sm:p-4">
        <input
          type="text"
          placeholder="Buscar por nombre o descripción..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-12 min-w-0 w-full flex-1 rounded-lg border border-gray-300 px-3 text-base focus:border-primary-500 focus:ring-2 focus:ring-primary-500 sm:text-sm"
          aria-label="Buscar productos"
        />
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="h-12 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 text-base focus:border-primary-500 focus:ring-2 focus:ring-primary-500 sm:w-auto sm:min-w-[220px] sm:text-sm"
          aria-label="Filtrar por categoría"
        >
          <option value="">Todas las categorías</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-lg bg-white p-8 text-center text-sm text-gray-500 shadow">Cargando productos...</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm sm:p-10">
          <p className="font-medium text-gray-700">Todavía no hay productos para mostrar.</p>
          <p className="mt-1 text-sm text-gray-500">Crea tu primer producto para comenzar el catálogo.</p>
          <Link to="/menu/items/new" className="mt-4 inline-flex min-h-11 items-center font-semibold text-primary-600 hover:text-primary-700">
            Crear primer producto
          </Link>
        </div>
      ) : (
        <>
          {/* Mobile cards: every key detail and both actions fit the phone width. */}
          <div className="space-y-3 md:hidden">
            {items.map((item) => (
              <article key={item.id} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                <div className="flex min-w-0 items-start gap-3">
                  {item.image ? (
                    <img src={item.image} alt={item.name} loading="lazy" className="h-20 w-20 shrink-0 rounded-xl border border-gray-100 bg-gray-50 object-cover" />
                  ) : (
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-3xl" aria-hidden="true">🍽️</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words text-base font-bold leading-5 text-gray-900">{item.name}</h3>
                    <p className="mt-1 break-words text-xs text-gray-500">{item.category?.name || 'Sin categoría'}</p>
                    <p className="mt-2 text-lg font-bold text-gray-900">{formatCOP(item.price)}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
                  {renderStatus(item)}
                  <span className="text-xs text-gray-500">{item._count?.options ?? 0} grupos de opciones</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link
                    to={`/menu/items/${item.id}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                    aria-label={`Editar ${item.name}`}
                  >
                    Editar
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleDelete(item.id, item.name)}
                    className="min-h-11 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                    aria-label={`Eliminar ${item.name}`}
                  >
                    Eliminar
                  </button>
                </div>
              </article>
            ))}
          </div>

          {/* Desktop table remains available with its full set of columns and actions. */}
          <div className="hidden overflow-hidden rounded-lg bg-white shadow md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Producto</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Categoría</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Precio</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Estado e inventario</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Opciones</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="flex items-center gap-3">
                          {item.image ? (
                            <img src={item.image} alt={item.name} loading="lazy" className="h-11 w-11 rounded-lg border border-gray-100 object-cover" />
                          ) : (
                            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gray-100 text-lg" aria-hidden="true">🍽️</div>
                          )}
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{item.name}</div>
                            <div className="text-xs text-gray-400">{item.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">{item.category?.name || 'Sin categoría'}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-gray-900">{formatCOP(item.price)}</td>
                      <td className="px-5 py-4">{renderStatus(item)}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">{item._count?.options ?? 0} grupos</td>
                      <td className="whitespace-nowrap px-5 py-4 text-right text-sm">
                        <Link to={`/menu/items/${item.id}`} className="mr-3 font-semibold text-primary-600 hover:text-primary-800" aria-label={`Editar ${item.name}`}>Editar</Link>
                        <button type="button" onClick={() => void handleDelete(item.id, item.name)} className="font-semibold text-red-600 hover:text-red-800" aria-label={`Eliminar ${item.name}`}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">{pagination.total} producto(s) en total</p>
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <button type="button" onClick={() => void fetchItems(pagination.page - 1)} disabled={pagination.page <= 1} className="min-h-11 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 disabled:opacity-40">Anterior</button>
                <span className="text-sm text-gray-600">Página {pagination.page} de {pagination.totalPages}</span>
                <button type="button" onClick={() => void fetchItems(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} className="min-h-11 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 disabled:opacity-40">Siguiente</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
