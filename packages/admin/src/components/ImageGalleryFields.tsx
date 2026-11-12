import { useId, useState } from 'react';

interface ImageGalleryFieldsProps {
  title: string;
  kind: 'category' | 'product';
  value: string[];
  onChange: (images: string[]) => void;
}

interface UploadResponse {
  success?: boolean;
  data?: { url?: string };
  error?: string;
}

const acceptedImageTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export default function ImageGalleryFields({
  title,
  kind,
  value,
  onChange,
}: ImageGalleryFieldsProps) {
  const inputPrefix = useId().replace(/:/g, '');
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Keep the existing limits: six photographs for products and three for categories.
  const maxImages = kind === 'product' ? 6 : 3;
  const savedImages = value
    .filter((image): image is string => typeof image === 'string' && image.trim().length > 0)
    .slice(0, maxImages);
  // Show only saved photographs plus one empty slot; this keeps the mobile form short.
  const images = [...savedImages, ...(savedImages.length < maxImages ? [''] : [])];
  const imageCount = savedImages.length;

  const updateImage = (index: number, nextValue: string) => {
    const next = [...images];
    next[index] = nextValue.trim();
    onChange(next.filter((image) => image.trim()).slice(0, maxImages));
    setError('');
    setSuccess('');
  };

  const removeImage = (index: number) => {
    onChange(images.filter((image, currentIndex) => currentIndex !== index && image.trim()).slice(0, maxImages));
    setError('');
    setSuccess('');
  };

  const makePrimary = (index: number) => {
    const selected = images[index];
    if (!selected) return;
    const next = [selected, ...images.filter((image, currentIndex) => currentIndex !== index && image.trim())];
    onChange(next.slice(0, maxImages));
    setSuccess('La fotografía principal se cambió. Guarda el formulario para aplicar el cambio.');
    setError('');
  };

  const uploadImage = async (index: number, file: File) => {
    setError('');
    setSuccess('');

    if (file.size < 1 || file.size > MAX_IMAGE_BYTES) {
      setError('La imagen debe pesar más de 0 y máximo 5 MB.');
      return;
    }

    if (!acceptedImageTypes.has(file.type)) {
      setError('Formato no permitido. Elige una foto PNG, JPG o WebP.');
      return;
    }

    const token = localStorage.getItem('token') || '';
    if (!token) {
      setError('Tu sesión no está disponible. Inicia sesión nuevamente.');
      return;
    }

    const formData = new FormData();
    formData.append('kind', kind);
    formData.append('image', file);
    setUploadingIndex(index);

    try {
      const response = await fetch('/api/media/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const result = (await response.json().catch(() => null)) as UploadResponse | null;

      if (!response.ok || !result?.success || !result.data?.url) {
        throw new Error(result?.error || 'No se pudo cargar la imagen.');
      }

      const next = [...images];
      next[index] = result.data.url;
      onChange(next.filter((image) => image.trim()).slice(0, maxImages));
      setSuccess('Foto cargada. Recuerda guardar el formulario para aplicar los cambios.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Error al cargar la imagen.');
    } finally {
      setUploadingIndex(null);
    }
  };

  return (
    <section className="rounded-2xl border border-[#E9DDE1] bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="mt-1 text-sm leading-5 text-gray-500">
            Agrega fotos desde tu celular o computador. La primera fotografía será la principal.
          </p>
          <p className="mt-1 text-xs text-gray-500">
            En el celular puedes tomar una foto o elegirla de tu biblioteca.
          </p>
        </div>
        <span className="inline-flex w-fit shrink-0 rounded-full bg-[#FFF4E8] px-3 py-1 text-xs font-semibold text-[#805326]">
          {imageCount} de {maxImages} fotos
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 sm:gap-4">
        {images.map((image, index) => {
          const inputId = `${inputPrefix}-${kind}-photo-${index}`;
          const isUploading = uploadingIndex === index;
          const isBusy = uploadingIndex !== null;
          return (
            <article key={inputId} className="min-w-0 rounded-xl border border-gray-200 bg-[#FFFEFD] p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {index === 0 ? 'Fotografía principal' : `Fotografía ${index + 1}`}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {index === 0 ? 'Se muestra primero en la tienda.' : 'Imagen adicional de la galería.'}
                  </p>
                </div>
                {index === 0 && image && (
                  <span className="shrink-0 rounded-full bg-[#FCE8ED] px-2.5 py-1 text-[11px] font-bold text-[#8E2443]">
                    Principal
                  </span>
                )}
              </div>

              <div className="relative mb-3 flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-[#F8F4F1]">
                {image ? (
                  <img
                    src={image}
                    alt={`${title}, fotografía ${index + 1}`}
                    className="h-full w-full object-contain"
                    onError={(event) => { event.currentTarget.style.opacity = '0.15'; }}
                    onLoad={(event) => { event.currentTarget.style.opacity = '1'; }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 px-4 text-center text-gray-400">
                    <span className="text-4xl" aria-hidden="true">📷</span>
                    <span className="text-xs font-medium">Todavía no has agregado una foto</span>
                  </div>
                )}
                {isUploading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/90 text-sm font-semibold text-primary-700" role="status">
                    <span className="h-7 w-7 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
                    Subiendo foto...
                  </div>
                )}
              </div>

              <input
                id={inputId}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={isBusy}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = '';
                  if (file) void uploadImage(index, file);
                }}
                className="sr-only"
              />
              <label
                htmlFor={inputId}
                aria-disabled={isBusy}
                className={`flex min-h-12 w-full cursor-pointer items-center justify-center rounded-lg bg-primary-600 px-3 py-3 text-center text-sm font-semibold text-white transition hover:bg-primary-700 ${isBusy ? 'pointer-events-none opacity-60' : ''}`}
              >
                {image ? 'Cambiar foto desde mi dispositivo' : index > 0 ? 'Agregar otra foto' : 'Elegir o tomar foto'}
              </label>

              {image && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {index > 0 && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => makePrimary(index)}
                      className="min-h-11 rounded-lg border border-[#E7B75C] bg-[#FFFAEF] px-2 py-2 text-xs font-semibold text-[#805326] disabled:opacity-50"
                    >
                      Hacer principal
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => removeImage(index)}
                    className={`${index === 0 ? 'col-span-2' : ''} min-h-11 rounded-lg border border-red-200 bg-red-50 px-2 py-2 text-xs font-semibold text-red-700 disabled:opacity-50`}
                  >
                    Quitar foto
                  </button>
                </div>
              )}

            </article>
          );
        })}
      </div>

      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
      {success && <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800" role="status">{success}</p>}

      <p className="mt-4 text-xs leading-5 text-gray-500">
        Formatos permitidos: PNG, JPG y WebP. Tamaño máximo: 5 MB por foto. Al guardar, las fotografías retiradas se eliminan de la nube cuando ningún otro módulo las utiliza. Tus archivos originales permanecen en tu dispositivo.
      </p>
    </section>
  );
}
