import { useEffect, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';

type Product = {
  id: string;
  name: string;
  image: string | null;
  images?: string[];
  isActive: boolean;
  trackStock?: boolean;
  stockQty?: number;
};

type ProductResponse = {
  success: boolean;
  data: Product[];
  pagination?: { page: number; totalPages: number; total: number };
  error?: string;
};

type SettingsResponse = {
  success: boolean;
  data?: { homepageFeaturedImages?: string[] };
  error?: string;
};

const slotLabels = [
  { title: 'Fotografía principal', description: 'La imagen grande del lado izquierdo de la portada.' },
  { title: 'Fotografía secundaria superior', description: 'La imagen pequeña de la parte superior derecha.' },
  { title: 'Fotografía secundaria inferior', description: 'La imagen pequeña de la parte inferior derecha.' },
];

export default function SettingsHomepage() {
  const token = localStorage.getItem('token') || '';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [automaticPhotos, setAutomaticPhotos] = useState<string[]>([]);
  const [slots, setSlots] = useState<string[]>(['', '', '']);
  const [isCustom, setIsCustom] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const settingsRequest = fetch('/api/settings', { headers }).then(async (response) => {
          const result = (await response.json()) as SettingsResponse;
          if (!response.ok || !result.success) {
            throw new Error(result.error || 'No fue posible leer la configuración de la portada.');
          }
          return result.data?.homepageFeaturedImages ?? [];
        });

        const allProducts: Product[] = [];
        let page = 1;
        let totalPages = 1;
        do {
          const response = await fetch(`/api/menu/items?page=${page}&limit=50`, { headers });
          const result = (await response.json()) as ProductResponse;
          if (!response.ok || !result.success) {
            throw new Error(result.error || 'No fue posible cargar las fotografías de los productos.');
          }
          allProducts.push(...(result.data ?? []));
          totalPages = result.pagination?.totalPages ?? 1;
          page += 1;
        } while (page <= totalPages);

        const auto: string[] = [];
        for (const [productIndex, product] of allProducts.entries()) {
          const productImages = (Array.isArray(product.images) && product.images.length > 0
            ? product.images
            : product.image ? [product.image] : []);
          const canShowAutomatically = productIndex < 8 && product.isActive && (!product.trackStock || (product.stockQty ?? 0) > 0);
          const firstImage = product.image || productImages[0];
          if (canShowAutomatically && firstImage && auto.length < 3 && !auto.includes(firstImage)) {
            auto.push(firstImage);
          }
        }

        const configured = await settingsRequest;
        if (!active) return;
        setAutomaticPhotos(auto);
        const validConfigured = Array.isArray(configured) && configured.length === 3 && configured.every((url) => typeof url === 'string' && url.trim());
        setIsCustom(Boolean(validConfigured));
        const initial = validConfigured ? configured.slice(0, 3) : auto.slice(0, 3);
        setSlots([initial[0] || '', initial[1] || '', initial[2] || '']);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'No fue posible cargar la portada.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, [token]);

  function updateSlot(index: number, value: string) {
    setSlots((current) => current.map((slot, slotIndex) => slotIndex === index ? value : slot));
    setError('');
    setSuccess('');
  }

  async function uploadPhoto(index: number, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Utiliza una imagen JPG, PNG o WebP.');
      return;
    }
    if (file.size < 1 || file.size > 5 * 1024 * 1024) {
      setError('La imagen debe pesar más de 0 y máximo 5 MB.');
      return;
    }

    setUploadingSlot(index);
    setError('');
    setSuccess('');
    try {
      const formData = new FormData();
      formData.append('kind', 'homepage');
      formData.append('file', file);
      const response = await fetch('/api/media/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const result = await response.json() as { success?: boolean; data?: { url?: string }; error?: string };
      if (!response.ok || !result.success || !result.data?.url) {
        throw new Error(result.error || 'No fue posible cargar la fotografía.');
      }
      const url = result.data.url;
      updateSlot(index, url);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Ocurrió un error al cargar la fotografía.');
    } finally {
      setUploadingSlot(null);
    }
  }

  async function persistImages(images: string[]) {
    const response = await fetch('/api/settings/homepage', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ images }),
    });
    const result = await response.json() as { success?: boolean; error?: string };
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'No fue posible guardar la selección de la portada.');
    }
  }

  async function saveSelection() {
    setError('');
    setSuccess('');
    const cleaned = slots.map((url) => url.trim());
    if (cleaned.every((url) => !url)) {
      setError('Selecciona tres fotografías o utiliza la opción de fotos automáticas.');
      return;
    }
    if (cleaned.some((url) => !url)) {
      setError('Completa los tres espacios de fotografías antes de guardar.');
      return;
    }
    if (new Set(cleaned).size !== 3) {
      setError('Selecciona tres fotografías diferentes para la portada.');
      return;
    }

    setSaving(true);
    try {
      await persistImages(cleaned);
      setSlots(cleaned);
      setIsCustom(true);
      setSuccess('La portada se guardó correctamente. Actualiza la tienda para ver los cambios.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No fue posible guardar los cambios.');
    } finally {
      setSaving(false);
    }
  }

  async function restoreAutomatic() {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await persistImages([]);
      setSlots([automaticPhotos[0] || '', automaticPhotos[1] || '', automaticPhotos[2] || '']);
      setIsCustom(false);
      setSuccess('La portada volvió a utilizar las fotografías automáticas de los productos disponibles.');
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : 'No fue posible restaurar las fotografías automáticas.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="rounded-xl border border-[#E8DDD7] bg-white p-6 text-sm text-gray-600">Cargando fotografías y configuración de la portada…</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/settings" className="text-sm font-semibold text-[#8F4F43] hover:underline">← Volver a configuración</Link>
          <h1 className="mt-3 text-2xl font-bold text-[#3B222B]">Portada de la tienda</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Elige las tres fotografías que aparecen en la portada. Los productos nuevos no cambiarán esta selección.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void restoreAutomatic()} disabled={saving || uploadingSlot !== null} className="rounded-lg border border-[#C9B7AF] bg-white px-4 py-2.5 text-sm font-semibold text-[#654B4D] hover:bg-[#FAF5F1] disabled:opacity-50">Usar fotos automáticas</button>
          <button type="button" onClick={() => void saveSelection()} disabled={saving || uploadingSlot !== null} className="rounded-lg bg-[#8F4F43] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#744037] disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar portada'}</button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>}

      <div className="rounded-xl border border-[#E8DDD7] bg-[#FFF9F1] p-4 text-sm text-[#684B4B]">
        <strong>Cómo funciona:</strong> cada espacio tiene su propia fotografía. Cárgala directamente desde tu computador o celular. También puedes usar las fotografías automáticas del catálogo activo; esa opción apunta a las mismas imágenes de los productos y no crea una copia adicional.
        <div className="mt-2 text-xs">Formatos: JPG, PNG y WebP · Máximo 5 MB por fotografía. Las cargas que no guardes se eliminan automáticamente después de 1 hora.</div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {slotLabels.map((slot, index) => (
          <section key={slot.title} className="overflow-hidden rounded-2xl border border-[#E8DDD7] bg-white shadow-sm">
            <div className="border-b border-[#EFE5DF] px-4 py-3">
              <h2 className="font-semibold text-[#3B222B]">{slot.title}</h2>
              <p className="mt-1 text-xs leading-5 text-gray-500">{slot.description}</p>
            </div>
            <div className="space-y-3 p-4">
              <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-[#F8EEE8]">
                {slots[index] ? <img src={slots[index]} alt={slot.title} className="h-full w-full object-cover" /> : <span className="px-4 text-center text-sm text-gray-500">Selecciona una fotografía para ver la vista previa.</span>}
              </div>
              <div className="border-t border-gray-100 pt-3">
                <label className="block text-xs font-semibold text-[#49343B]" htmlFor={`homepage-upload-${index}`}>{slots[index] ? 'Cambiar fotografía desde tu dispositivo' : 'Subir fotografía desde tu dispositivo'}</label>
                <input id={`homepage-upload-${index}`} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadPhoto(index, event)} disabled={uploadingSlot !== null} className="mt-2 block w-full text-xs text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#F8EEE8] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#8F4F43] hover:file:bg-[#F1E2DC] disabled:opacity-50" />
                {uploadingSlot === index && <p className="mt-2 text-xs text-[#8F4F43]">Cargando fotografía…</p>}
              </div>
            </div>
          </section>
        ))}
      </div>

      <section className="rounded-2xl border border-[#E8DDD7] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold text-[#3B222B]">Vista previa de las tres fotografías</h2>
            <p className="mt-1 text-xs text-gray-500">Esta distribución representa la portada actual.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isCustom ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{isCustom ? 'Selección manual' : 'Selección automática'}</span>
        </div>
        <div className="mt-4 grid h-64 max-w-2xl grid-cols-[1.35fr_0.78fr] gap-3 overflow-hidden rounded-2xl bg-[#F8EEE8] p-3 sm:h-72">
          <div className="overflow-hidden rounded-xl bg-[#EBD8C9]">{slots[0] && <img src={slots[0]} alt="Vista principal" className="h-full w-full object-cover" />}</div>
          <div className="grid min-h-0 grid-rows-2 gap-3">
            <div className="overflow-hidden rounded-xl bg-[#EBD8C9]">{slots[1] && <img src={slots[1]} alt="Vista secundaria superior" className="h-full w-full object-cover" />}</div>
            <div className="overflow-hidden rounded-xl bg-[#EBD8C9]">{slots[2] && <img src={slots[2]} alt="Vista secundaria inferior" className="h-full w-full object-cover" />}</div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4">
        <button type="button" onClick={() => void restoreAutomatic()} disabled={saving} className="rounded-lg border border-[#C9B7AF] bg-white px-4 py-2.5 text-sm font-semibold text-[#654B4D] hover:bg-[#FAF5F1] disabled:opacity-50">Restaurar selección automática</button>
        <button type="button" onClick={() => void saveSelection()} disabled={saving || uploadingSlot !== null} className="rounded-lg bg-[#8F4F43] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#744037] disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar portada'}</button>
      </div>
    </div>
  );
}
