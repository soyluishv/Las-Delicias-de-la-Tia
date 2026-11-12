import { useEffect, useState, type ChangeEvent } from 'react';

type Category = 'FOOD' | 'EVENTS';

interface GalleryImage {
  id: string;
  url: string;
  alt: string;
  category: Category;
  sortOrder: number;
}

const CATEGORIES: Category[] = ['FOOD', 'EVENTS'];
const CATEGORY_LABELS: Record<Category, string> = { FOOD: 'Comidas', EVENTS: 'Eventos' };

interface FormState {
  url: string;
  alt: string;
  category: Category;
  sortOrder: number;
}

const emptyForm: FormState = { url: '', alt: 'Fotografía de comidas', category: 'FOOD', sortOrder: 0 };

export default function DesignGallery() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Category | 'ALL'>('ALL');
  const [editing, setEditing] = useState<GalleryImage | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const token = localStorage.getItem('token') || '';
  const authHeaders = { Authorization: `Bearer ${token}` };

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/gallery/admin', { headers: authHeaders });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'No fue posible cargar la galería.');
      setImages(result.data ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible cargar la galería.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(image: GalleryImage) {
    setEditing(image);
    setForm({
      url: image.url,
      alt: image.alt,
      category: image.category,
      sortOrder: image.sortOrder,
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm);
  }

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Utiliza una imagen JPG, PNG o WebP.');
      return;
    }
    if (file.size < 1 || file.size > 5 * 1024 * 1024) {
      setError('La fotografía debe pesar máximo 5 MB.');
      return;
    }

    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('kind', 'gallery');
      formData.append('file', file);
      const response = await fetch('/api/media/upload', {
        method: 'POST',
        headers: authHeaders,
        body: formData,
      });
      const result = await response.json() as { success?: boolean; data?: { url?: string }; error?: string };
      if (!response.ok || !result.success || !result.data?.url) {
        throw new Error(result.error || 'No fue posible cargar la fotografía.');
      }
      setForm((current) => ({
        ...current,
        url: result.data!.url!,
        alt: `Fotografía de ${current.category === 'FOOD' ? 'comidas' : 'eventos'}`,
      }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible cargar la fotografía.');
    } finally {
      setUploading(false);
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form.url) {
      setError('Selecciona una fotografía desde tu computador o celular.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const endpoint = editing ? `/api/gallery/${editing.id}` : '/api/gallery';
      const response = await fetch(endpoint, {
        method: editing ? 'PATCH' : 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(typeof result.error === 'string' ? result.error : 'No fue posible guardar la fotografía.');
      }
      closeForm();
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible guardar la fotografía.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(image: GalleryImage) {
    if (!window.confirm(`¿Retirar esta fotografía de la galería?`)) return;
    try {
      const response = await fetch(`/api/gallery/${image.id}`, { method: 'DELETE', headers: authHeaders });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || 'No fue posible retirar la fotografía.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible retirar la fotografía.');
    }
  }


  const filtered = filter === 'ALL' ? images : images.filter((image) => image.category === filter);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gray-800">Galería de fotografías</h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">Sube una fotografía y clasifícala como Comidas o Eventos. No necesitas escribir títulos ni descripciones.</p>
        </div>
        <button type="button" onClick={openCreate} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700">
          + Agregar fotografía
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {(['ALL', ...CATEGORIES] as const).map((category) => (
          <button key={category} type="button" onClick={() => setFilter(category)} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${filter === category ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {category === 'ALL' ? 'Todas' : CATEGORY_LABELS[category]}
            <span className="ml-1 opacity-70">({category === 'ALL' ? images.length : images.filter((image) => image.category === category).length})</span>
          </button>
        ))}
      </div>

      {error && <div role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" /></div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">Todavía no hay fotografías. Agrega la primera desde tu computador o celular.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((image) => (
            <article key={image.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="relative aspect-[4/3] bg-gray-100">
                <img src={image.url} alt={image.alt} className="h-full w-full object-cover" loading="lazy" />
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-medium text-gray-900">{CATEGORY_LABELS[image.category]}</p>
                <p className="mt-1 text-xs text-gray-500">Visible en la galería pública</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => openEdit(image)} className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-xs hover:bg-gray-50">Editar / cambiar foto</button>
                  <button type="button" onClick={() => void remove(image)} className="rounded border border-red-200 px-2 py-1.5 text-xs text-red-600 hover:bg-red-50" aria-label={`Retirar ${image.alt}`}>Retirar</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <form onSubmit={save}>
              <div className="border-b border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900">{editing ? 'Editar fotografía' : 'Agregar fotografía'}</h3>
              </div>
              <div className="space-y-4 p-6">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Fotografía desde tu dispositivo</label>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadPhoto(event)} disabled={uploading || saving} className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#F8EEE8] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#8F4F43] hover:file:bg-[#F1E2DC] disabled:opacity-50" />
                  <p className="mt-1 text-xs text-gray-500">JPG, PNG o WebP · máximo 5 MB. La imagen se vincula al guardar; las cargas que canceles se eliminan después de 1 hora.</p>
                  {uploading && <p className="mt-2 text-xs text-primary-700">Cargando fotografía…</p>}
                </div>
                {form.url && <div className="aspect-[4/3] overflow-hidden rounded-lg bg-gray-100"><img src={form.url} alt="Vista previa" className="h-full w-full object-cover" /></div>}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Categoría</label>
                  <select value={form.category} onChange={(event) => { const category = event.target.value as Category; setForm({ ...form, category, alt: `Fotografía de ${category === 'FOOD' ? 'comidas' : 'eventos'}` }); }} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                    {CATEGORIES.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 rounded-b-xl border-t border-gray-200 bg-gray-50 px-6 py-4">
                <button type="button" onClick={closeForm} disabled={saving || uploading} className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100 disabled:opacity-50">Cancelar</button>
                <button type="submit" disabled={saving || uploading || !form.url} className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700 disabled:opacity-50">{saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Agregar fotografía'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
