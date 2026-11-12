import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import ImageGalleryFields from '../components/ImageGalleryFields.js';

interface CategoryData {
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  parentId: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

const emptyCategory: CategoryData = {
  name: '',
  slug: '',
  description: '',
  sortOrder: 0,
  isActive: true,
  parentId: '',
};

function generarIdentificadorUrl(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function CategoryForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [form, setForm] = useState<CategoryData>(emptyCategory);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ data: CategoryOption[] }>('/menu/categories')
      .then((res) => setCategories(res.data.filter((c) => c.id !== id)))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!isEdit) return;
    api.get<{ data: any }>(`/menu/categories/${id}`)
      .then((res) => {
        const cat = res.data;
        setForm({
          name: cat.name,
          slug: cat.slug,
          description: cat.description || '',
          sortOrder: cat.sortOrder,
          isActive: cat.isActive,
          parentId: cat.parentId || '',
        });
        setImages(Array.isArray(cat.images) ? cat.images.slice(0, 3) : (cat.image ? [cat.image] : []));
        setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [id, isEdit]);

  const updateField = (field: keyof CategoryData, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const autoSlug = (name: string) => {
    if (!isEdit) {
      updateField('slug', generarIdentificadorUrl(name));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const body = {
        ...form,
        sortOrder: Number(form.sortOrder),
        parentId: form.parentId || undefined,
        images: images.map((image) => image.trim()).filter(Boolean).slice(0, 3),
      };

      if (isEdit) {
        const { slug: _, ...updateBody } = body;
        await api.patch(`/menu/categories/${id}`, updateBody);
      } else {
        await api.post('/menu/categories', body);
      }
      navigate('/menu/categories');
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  if (loading) return <p className="text-gray-500">Cargando categoría...</p>;

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold text-gray-800 sm:text-2xl">
          {isEdit ? 'Editar categoría' : 'Nueva categoría'}
        </h2>
        <button onClick={() => navigate('/menu/categories')} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:w-auto">
          Volver a categorías
        </button>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:mb-6">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
        <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Datos de la categoría</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => {
                  const nextName = e.target.value;
                  updateField('name', nextName);
                  autoSlug(nextName);
                  if (!isEdit && images.every((image) => !image.trim())) {
                    const key = generarIdentificadorUrl(nextName);
                    const suggestions: Array<[string, string]> = [
                      ['hamburguesa', '/category-images/hamburguesas.webp'],
                      ['perro', '/category-images/perros_calientes.webp'],
                      ['tamal', '/category-images/tamales_y_fiambres.webp'],
                      ['fiambre', '/category-images/tamales_y_fiambres.webp'],
                      ['postre', '/category-images/postres_y_dulces.webp'],
                      ['dulce', '/category-images/postres_y_dulces.webp'],
                      ['frito', '/category-images/fritos_tradicionales.webp'],
                      ['buñuelo', '/category-images/fritos_tradicionales.webp'],
                      ['pasaboca', '/category-images/pasabocas.webp'],
                      ['evento', '/category-images/comidas_para_eventos.webp'],
                      ['temporada', '/category-images/temporadas_especiales.webp'],
                    ];
                    const match = suggestions.find(([word]) => key.includes(word));
                    if (match) setImages([match[1]]);
                  }
                }}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base sm:text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Identificador URL *</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => updateField('slug', e.target.value)}
                required
                disabled={isEdit}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base sm:text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
              />
              <p className="mt-1 text-xs text-gray-500">
                Se genera automáticamente a partir del nombre y se utiliza en la dirección web.
              </p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base sm:text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría principal</label>
              <select
                value={form.parentId}
                onChange={(e) => updateField('parentId', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base sm:text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Ninguna (categoría principal)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Orden de visualización</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => updateField('sortOrder', e.target.value)}
                min={0}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base sm:text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 mt-6">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => updateField('isActive', e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Activa</span>
              </label>
            </div>
          </div>
        </section>

        <ImageGalleryFields title="Galería de la categoría" kind="category" value={images} onChange={setImages} />

        <div className="sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-2 border-t border-gray-200 bg-white/95 p-3 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] backdrop-blur sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-0">
          <button type="button" onClick={() => navigate('/menu/categories')} className="min-h-12 w-full rounded-lg border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:w-auto">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="min-h-12 w-full rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50 sm:w-auto">
            {saving ? 'Guardando...' : isEdit ? 'Actualizar categoría' : 'Crear categoría'}
          </button>
        </div>
      </form>
    </div>
  );
}
