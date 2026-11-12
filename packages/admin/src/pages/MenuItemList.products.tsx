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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gray-800">Productos</h2>
          <p className="mt-1 text-sm text-gray-500">Administra el catálogo, los precios y las existencias.</p>
        </div>
        <Link
          to="/menu/items/new"
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
        >
          + Nuevo producto
        </Link>
      </div>

      <div className="flex flex-col gap-3 rounded-lg bg-white p-4 shadow sm:flex-row">
        <input
          type="text"
          placeholder="Buscar por nombre o descripción..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
          aria-label="Buscar productos"
        />
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
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
        <div className="rounded-lg bg-white p-8 text-center text-sm text-gray-500 shadow">
          Cargando productos...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg bg-white p-10 text-center shadow">
          <p className="font-medium text-gray-700">Todavía no hay productos para mostrar.</p>
          <p className="mt-1 text-sm text-gray-500">Crea tu primer producto para comenzar el catálogo.</p>
          <Link to="/menu/items/new" className="mt-4 inline-block font-semibold text-primary-600 hover:text-primary-700">
            Crear primer producto
          </Link>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg bg-white shadow">
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
                            <img src={item.image} alt={item.name} className="h-11 w-11 rounded-lg border border-gray-100 object-cover" />
                          ) : (
                            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gray-100 text-lg" aria-hidden="true">
                              🍽️
                            </div>
                          )}
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{item.name}</div>
                            <div className="text-xs text-gray-400">{item.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">{item.category?.name || 'Sin categoría'}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-gray-900">{formatCOP(item.price)}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${item.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                            {item.isActive ? 'Activo' : 'Inactivo'}
                          </span>
                          {item.trackStock && (
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${item.stockQty > 0 ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                              Existencias: {item.stockQty}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">
                        {item._count?.options ?? 0} grupos
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right text-sm">
                        <Link
                          to={`/menu/items/${item.id}`}
                          className="mr-3 font-semibold text-primary-600 hover:text-primary-800"
                          aria-label={`Editar ${item.name}`}
                        >
                          Editar
                        </Link>
                        <button
                          type="button"
                          onClick={() => void handleDelete(item.id, item.name)}
                          className="font-semibold text-red-600 hover:text-red-800"
                          aria-label={`Eliminar ${item.name}`}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500">{pagination.total} producto(s) en total</p>
            {pagination.totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void fetchItems(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="text-sm text-gray-600">
                  Página {pagination.page} de {pagination.totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => void fetchItems(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
