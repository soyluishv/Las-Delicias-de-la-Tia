import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image?: string | null;
  images?: string[];
  sortOrder: number;
  isActive: boolean;
  parentId: string | null;
  children: { id: string; name: string }[];
  _count: { menuItems: number };
}

export default function CategoryList() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ data: Category[] }>('/menu/categories')
      .then((res) => { setCategories(res.data); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  const topLevel = categories.filter((category) => !category.parentId);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`¿Deseas eliminar la categoría "${name}"?`)) return;
    try {
      await api.delete(`/menu/categories/${id}`);
      setCategories((previous) => previous.filter((category) => category.id !== id));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'No fue posible eliminar la categoría.');
    }
  };

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-800">Categorías</h2>
          <p className="mt-1 text-sm text-gray-500">Organiza los productos y sus fotografías por categoría.</p>
        </div>
        <Link
          to="/menu/categories/new"
          className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-700 sm:w-auto"
        >
          + Agregar categoría
        </Link>
      </div>

      {loading && <div className="rounded-lg bg-white p-8 text-center text-sm text-gray-500 shadow-sm">Cargando categorías...</div>}
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Error: {error}</p>}

      {!loading && !error && topLevel.length === 0 && (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm">
          <p className="mb-4 text-gray-500">Todavía no hay categorías.</p>
          <Link to="/menu/categories/new" className="font-medium text-primary-600 hover:text-primary-700">Crear la primera categoría</Link>
        </div>
      )}

      {!loading && !error && topLevel.length > 0 && (
        <>
          <div className="space-y-3 md:hidden">
            {topLevel.map((category) => {
              const image = category.images?.[0] || category.image || '';
              return (
                <article key={category.id} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                  <div className="flex items-start gap-3">
                    {image ? (
                      <img src={image} alt={category.name} loading="lazy" className="h-16 w-16 shrink-0 rounded-xl border border-gray-100 bg-gray-50 object-cover" />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[#FFF4E8] text-2xl" aria-hidden="true">▦</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="break-words text-base font-bold text-gray-900">{category.name}</h3>
                      <p className="mt-1 break-all text-xs text-gray-400">{category.slug}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800">{category._count?.menuItems ?? 0} productos</span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${category.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {category.isActive ? 'Activa' : 'Inactiva'}
                        </span>
                      </div>
                    </div>
                  </div>
                  {category.children.length > 0 && (
                    <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                      <span className="font-semibold">Subcategorías:</span> {category.children.map((child) => child.name).join(', ')}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-gray-500">Orden de visualización: {category.sortOrder}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-gray-100 pt-3">
                    <Link to={`/menu/categories/${category.id}`} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700" aria-label={`Editar categoría ${category.name}`}>
                      Editar
                    </Link>
                    <button type="button" onClick={() => void handleDelete(category.id, category.name)} className="min-h-11 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100" aria-label={`Eliminar categoría ${category.name}`}>
                      Eliminar
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-hidden rounded-lg bg-white shadow md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Nombre</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Productos</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Subcategorías</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Estado</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Orden</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {topLevel.map((category) => (
                    <tr key={category.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{category.name}</div>
                        <div className="text-xs text-gray-400">{category.slug}</div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{category._count?.menuItems ?? 0}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{category.children.length > 0 ? category.children.map((child) => child.name).join(', ') : '-'}</td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${category.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {category.isActive ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{category.sortOrder}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                        <Link to={`/menu/categories/${category.id}`} className="mr-3 font-medium text-primary-600 hover:text-primary-900" aria-label={`Editar categoría ${category.name}`}>Editar</Link>
                        <button type="button" onClick={() => void handleDelete(category.id, category.name)} className="font-medium text-red-600 hover:text-red-900" aria-label={`Eliminar categoría ${category.name}`}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
