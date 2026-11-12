import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';

interface OptionValue {
  name: string;
  priceModifier: number;
  sortOrder: number;
}

interface MenuOption {
  name: string;
  displayType: 'SELECT' | 'RADIO' | 'CHECKBOX';
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  values: OptionValue[];
}

interface MenuItemData {
  name: string;
  slug: string;
  description: string;
  price: number;
  isActive: boolean;
  sortOrder: number;
  trackStock: boolean;
  stockQty: number;
  categoryId: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

const emptyItem: MenuItemData = {
  name: '',
  slug: '',
  description: '',
  price: 0,
  isActive: true,
  sortOrder: 0,
  trackStock: false,
  stockQty: 0,
  categoryId: '',
};

const emptyOptionValue: OptionValue = { name: '', priceModifier: 0, sortOrder: 0 };
const emptyOption: MenuOption = {
  name: '',
  displayType: 'SELECT',
  isRequired: false,
  minSelect: 0,
  maxSelect: 1,
  sortOrder: 0,
  values: [{ ...emptyOptionValue }],
};

export default function MenuItemForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [form, setForm] = useState<MenuItemData>(emptyItem);
  const [options, setOptions] = useState<MenuOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ data: CategoryOption[] }>('/menu/categories')
      .then((res) => setCategories(res.data))
      .catch((err) => setError(err.message || 'No fue posible cargar las categorías.'));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    api.get<{ data: any }>(`/menu/items/${id}`)
      .then((res) => {
        const item = res.data;
        setForm({
          name: item.name,
          slug: item.slug,
          description: item.description || '',
          price: item.price,
          isActive: item.isActive,
          sortOrder: item.sortOrder,
          trackStock: item.trackStock,
          stockQty: item.stockQty,
          categoryId: item.categoryId,
        });
        setImageUrl(item.imageUrl || item.image || '');
        if (item.options?.length) {
          setOptions(item.options.map((o: any) => ({
            name: o.name,
            displayType: o.displayType,
            isRequired: o.isRequired,
            minSelect: o.minSelect,
            maxSelect: o.maxSelect,
            sortOrder: o.sortOrder,
            values: o.values.map((v: any) => ({
              name: v.name,
              priceModifier: v.priceModifier,
              sortOrder: v.sortOrder,
            })),
          })));
        }
        setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [id, isEdit]);

  const updateField = (field: keyof MenuItemData, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const autoSlug = (name: string) => {
    if (!isEdit) {
      updateField('slug', name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
    }
  };

  const addOption = () => setOptions((prev) => [...prev, { ...emptyOption, values: [{ ...emptyOptionValue }] }]);
  const removeOption = (index: number) => setOptions((prev) => prev.filter((_, i) => i !== index));

  const updateOption = (index: number, field: keyof MenuOption, value: any) => {
    setOptions((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addOptionValue = (optIndex: number) => {
    setOptions((prev) => {
      const updated = [...prev];
      updated[optIndex] = {
        ...updated[optIndex],
        values: [...updated[optIndex].values, { ...emptyOptionValue }],
      };
      return updated;
    });
  };

  const removeOptionValue = (optIndex: number, valIndex: number) => {
    setOptions((prev) => {
      const updated = [...prev];
      updated[optIndex] = {
        ...updated[optIndex],
        values: updated[optIndex].values.filter((_, i) => i !== valIndex),
      };
      return updated;
    });
  };

  const updateOptionValue = (optIndex: number, valIndex: number, field: keyof OptionValue, value: any) => {
    setOptions((prev) => {
      const updated = [...prev];
      const values = [...updated[optIndex].values];
      values[valIndex] = { ...values[valIndex], [field]: value };
      updated[optIndex] = { ...updated[optIndex], values };
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const body = {
        ...form,
        price: Number(form.price),
        sortOrder: Number(form.sortOrder),
        stockQty: Number(form.stockQty),
        imageUrl: imageUrl.trim() || null,
        options: options,
      };

      if (isEdit) {
        const { slug: _, ...updateBody } = body;
        await api.patch(`/menu/items/${id}`, updateBody);
      } else {
        await api.post('/menu/items', body);
      }
      navigate('/menu/items');
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  if (loading) return <p className="text-gray-500">Cargando...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-gray-800">
          {isEdit ? 'Editar producto' : 'Nuevo producto'}
        </h2>
        <button onClick={() => navigate('/menu/items')} className="text-gray-500 hover:text-gray-700 text-sm">
          Volver a productos
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Info */}
        <section className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Información básica</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => { updateField('name', e.target.value); autoSlug(e.target.value); }}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => updateField('slug', e.target.value)}
                required
                disabled={isEdit}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría *</label>
              <select
                value={form.categoryId}
                onChange={(e) => updateField('categoryId', e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Selecciona una categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio (COP) *</label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => updateField('price', e.target.value)}
                required
                min={0}
                step={1}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Orden</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => updateField('sortOrder', e.target.value)}
                min={0}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div className="flex items-center gap-6 mt-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => updateField('isActive', e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Activo</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.trackStock}
                  onChange={(e) => updateField('trackStock', e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Controlar inventario</span>
              </label>
              {form.trackStock && (
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-700">Existencias:</label>
                  <input
                    type="number"
                    value={form.stockQty}
                    onChange={(e) => updateField('stockQty', e.target.value)}
                    min={0}
                    className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Imagen del producto: se guarda una URL o ruta, no se sube un archivo */}
        <section className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Imagen del producto</h3>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="imageUrl">
            URL de imagen (opcional)
          </label>
          <input
            id="imageUrl"
            type="text"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://... o /ruta-de-imagen.jpg"
            maxLength={1500}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <p className="text-xs text-gray-400 mt-2">
            Puedes pegar una dirección de imagen pública. La carga directa de archivos se habilitará cuando configuremos almacenamiento de imágenes.
          </p>
          {imageUrl.trim() && (
            <div className="mt-4">
              <img
                src={imageUrl}
                alt={form.name || 'Vista previa del producto'}
                className="w-40 h-40 object-cover rounded-lg border border-gray-200"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                onLoad={(e) => { e.currentTarget.style.display = 'block'; }}
              />
            </div>
          )}
        </section>

        {/* Opciones del producto */}
        <section className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Opciones del producto</h3>
            <button type="button" onClick={addOption} className="text-primary-600 hover:text-primary-700 text-sm font-medium">
              + Agregar grupo de opciones
            </button>
          </div>
          {options.length === 0 && (
            <p className="text-sm text-gray-400">No hay opciones. Puedes agregar grupos como tamaño o adicionales.</p>
          )}
          <div className="space-y-6">
            {options.map((opt, optIdx) => (
              <div key={optIdx} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">Grupo de opciones #{optIdx + 1}</span>
                  <button type="button" onClick={() => removeOption(optIdx)} className="text-red-500 hover:text-red-700 text-sm">
                    Eliminar grupo
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Nombre *</label>
                    <input
                      type="text"
                      value={opt.name}
                      onChange={(e) => updateOption(optIdx, 'name', e.target.value)}
                      placeholder="e.g. Size"
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Tipo de selección</label>
                    <select
                      value={opt.displayType}
                      onChange={(e) => updateOption(optIdx, 'displayType', e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    >
                      <option value="SELECT">Lista desplegable</option>
                      <option value="RADIO">Opción única</option>
                      <option value="CHECKBOX">Selección múltiple</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-4 mt-4">
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={opt.isRequired}
                        onChange={(e) => updateOption(optIdx, 'isRequired', e.target.checked)}
                        className="rounded border-gray-300 text-primary-600"
                      />
                      <span className="text-xs text-gray-700">Obligatorio</span>
                    </label>
                  </div>
                </div>

                {/* Option Values */}
                <div className="ml-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Valores</span>
                    <button type="button" onClick={() => addOptionValue(optIdx)} className="text-primary-600 text-xs font-medium">
                      + Agregar valor
                    </button>
                  </div>
                  {opt.values.map((val, valIdx) => (
                    <div key={valIdx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={val.name}
                        onChange={(e) => updateOptionValue(optIdx, valIdx, 'name', e.target.value)}
                        placeholder="Nombre del valor"
                        className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                      />
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-400">+$</span>
                        <input
                          type="number"
                          value={val.priceModifier}
                          onChange={(e) => updateOptionValue(optIdx, valIdx, 'priceModifier', parseInt(e.target.value, 10) || 0)}
                          step={1}
                          className="w-16 border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                      </div>
                      {opt.values.length > 1 && (
                        <button type="button" onClick={() => removeOptionValue(optIdx, valIdx)} className="text-red-400 hover:text-red-600 text-xs" aria-label={`Remove value ${val.name || valIdx + 1}`}>
                          X
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/menu/items')} className="px-6 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors">
            {saving ? 'Guardando...' : isEdit ? 'Actualizar producto' : 'Crear producto'}
          </button>
        </div>
      </form>
    </div>
  );
}
