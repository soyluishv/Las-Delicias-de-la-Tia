import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';

type SectionType = 'announcement' | 'text' | 'imageText' | 'features' | 'cta';
type BuilderSection = {
  id: string;
  type: SectionType;
  visible: boolean;
  eyebrow: string;
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  buttonLabel: string;
  buttonUrl: string;
  feature1Title: string;
  feature1Description: string;
  feature2Title: string;
  feature2Description: string;
  feature3Title: string;
  feature3Description: string;
};

const TYPE_OPTIONS: Array<{ value: SectionType; label: string; description: string }> = [
  { value: 'announcement', label: 'Franja informativa', description: 'Mensaje corto para destacar una novedad.' },
  { value: 'text', label: 'Texto y descripción', description: 'Bloque editorial con título y descripción.' },
  { value: 'imageText', label: 'Imagen y texto', description: 'Fotografía propia junto a un mensaje.' },
  { value: 'features', label: 'Tarjetas de beneficios', description: 'Hasta tres beneficios o características.' },
  { value: 'cta', label: 'Llamado a la acción', description: 'Mensaje destacado con un botón.' },
];

function createId(): string {
  return `bloque_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function createSection(type: SectionType): BuilderSection {
  const base: BuilderSection = {
    id: createId(), type, visible: true, eyebrow: '', title: '', description: '',
    imageUrl: '', imageAlt: '', buttonLabel: '', buttonUrl: '/menu',
    feature1Title: '', feature1Description: '', feature2Title: '', feature2Description: '',
    feature3Title: '', feature3Description: '',
  };
  const label = TYPE_OPTIONS.find((item) => item.value === type)?.label || 'Nueva sección';
  return { ...base, title: label };
}

function parseSections(raw: unknown): BuilderSection[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 10).filter((item): item is BuilderSection => Boolean(
      item && typeof item === 'object' &&
      typeof item.id === 'string' &&
      ['announcement', 'text', 'imageText', 'features', 'cta'].includes(item.type) &&
      typeof item.visible === 'boolean'
    )).map((item) => ({
      id: item.id,
      type: item.type,
      visible: item.visible,
      eyebrow: typeof item.eyebrow === 'string' ? item.eyebrow : '',
      title: typeof item.title === 'string' ? item.title : '',
      description: typeof item.description === 'string' ? item.description : '',
      imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : '',
      imageAlt: typeof item.imageAlt === 'string' ? item.imageAlt : '',
      buttonLabel: typeof item.buttonLabel === 'string' ? item.buttonLabel : '',
      buttonUrl: typeof item.buttonUrl === 'string' ? item.buttonUrl : '/menu',
      feature1Title: typeof item.feature1Title === 'string' ? item.feature1Title : '',
      feature1Description: typeof item.feature1Description === 'string' ? item.feature1Description : '',
      feature2Title: typeof item.feature2Title === 'string' ? item.feature2Title : '',
      feature2Description: typeof item.feature2Description === 'string' ? item.feature2Description : '',
      feature3Title: typeof item.feature3Title === 'string' ? item.feature3Title : '',
      feature3Description: typeof item.feature3Description === 'string' ? item.feature3Description : '',
    }));
  } catch {
    return [];
  }
}

function Field({ label, value, onChange, multiline = false, maxLength = 220, help }: {
  label: string; value: string; onChange: (value: string) => void; multiline?: boolean; maxLength?: number; help?: string;
}) {
  return (
    <label className="block text-sm font-semibold text-[#49343B]">
      {label}
      {multiline ? (
        <textarea value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} rows={3} className="mt-1.5 block w-full resize-y rounded-xl border border-[#DCCFC9] bg-white px-3 py-2.5 text-sm font-normal text-gray-900 outline-none focus:border-[#A96B5D] focus:ring-2 focus:ring-[#F1E2DC]" />
      ) : (
        <input value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} className="mt-1.5 block w-full rounded-xl border border-[#DCCFC9] bg-white px-3 py-2.5 text-sm font-normal text-gray-900 outline-none focus:border-[#A96B5D] focus:ring-2 focus:ring-[#F1E2DC]" />
      )}
      {help && <span className="mt-1 block text-xs font-normal text-gray-500">{help}</span>}
    </label>
  );
}

function SectionPreview({ section }: { section: BuilderSection }) {
  return (
    <div className="rounded-xl border border-dashed border-[#DCCFC9] bg-[#FFFCFA] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A96B5D]">Vista previa del bloque</p>
      {section.eyebrow && <p className="mt-2 text-xs font-bold uppercase tracking-wide text-[#A96B5D]">{section.eyebrow}</p>}
      <p className="mt-1 text-lg font-bold text-[#3B222B]">{section.title || 'Título de la sección'}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-gray-600">{section.description || 'Aquí se mostrará la descripción.'}</p>
      {section.type === 'imageText' && section.imageUrl && <img src={section.imageUrl} alt={section.imageAlt} className="mt-3 max-h-40 w-full rounded-lg object-cover" />}
      {section.type === 'features' && <div className="mt-3 grid gap-2 sm:grid-cols-3">{[1, 2, 3].map((index) => <div key={index} className="rounded-lg bg-white p-3 text-xs text-gray-600">{section[`feature${index}Title` as keyof BuilderSection] || `Beneficio ${index}`}</div>)}</div>}
      {section.buttonLabel && <span className="mt-3 inline-flex rounded-lg bg-[#8F4F43] px-4 py-2 text-xs font-semibold text-white">{section.buttonLabel}</span>}
    </div>
  );
}

export default function PageBuilder() {
  const token = localStorage.getItem('token') || '';
  const [sections, setSections] = useState<BuilderSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newType, setNewType] = useState<SectionType>('text');
  const [uploadingImageFor, setUploadingImageFor] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/settings/storefront-content', { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'No se pudo cargar la configuración.');
        if (active) setSections(parseSections(result.data?.pageBuilderJson));
      })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'No se pudo cargar el constructor.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  const visibleCount = useMemo(() => sections.filter((section) => section.visible).length, [sections]);

  function updateSection(id: string, patch: Partial<BuilderSection>) {
    setSections((current) => current.map((section) => section.id === id ? { ...section, ...patch } : section));
    setSuccess('');
  }

  function moveSection(id: string, direction: -1 | 1) {
    setSections((current) => {
      const index = current.findIndex((section) => section.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function addSection() {
    if (sections.length >= 10) {
      setError('Puedes crear hasta 10 bloques adicionales en esta primera versión.');
      return;
    }
    setSections((current) => [...current, createSection(newType)]);
    setSuccess('Bloque añadido. Recuerda guardar para publicarlo en la portada.');
    setError('');
  }

  function duplicateSection(section: BuilderSection) {
    if (sections.length >= 10) {
      setError('Has alcanzado el máximo de 10 bloques adicionales.');
      return;
    }
    const duplicate = { ...section, id: createId(), title: section.title ? `${section.title.slice(0, 132)} (copia)` : 'Copia de sección' };
    setSections((current) => {
      const index = current.findIndex((item) => item.id === section.id);
      const next = [...current];
      next.splice(index + 1, 0, duplicate);
      return next;
    });
    setError('');
    setSuccess('Bloque duplicado. Guarda los cambios para publicarlo.');
  }

  function deleteSection(section: BuilderSection) {
    if (!window.confirm(`¿Eliminar el bloque «${section.title || 'Sin título'}»? Esta acción se aplicará en la portada después de guardar.`)) return;
    setSections((current) => current.filter((item) => item.id !== section.id));
    setSuccess('Bloque retirado del borrador. Guarda para aplicar el cambio.');
  }

  async function save() {
    setSaving(true); setError(''); setSuccess('');
    try {
      const response = await fetch('/api/settings/storefront-content', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ content: { pageBuilderJson: JSON.stringify(sections) } }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'No fue posible guardar el constructor.');
      setSections(parseSections(result.data?.pageBuilderJson ?? JSON.stringify(sections)));
      setSuccess('Constructor guardado. Actualiza la portada pública para comprobar los cambios.');
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Ocurrió un error al guardar.');
    } finally {
      setSaving(false);
    }
  }

  async function uploadSectionImage(sectionId: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Utiliza una imagen JPG, PNG o WebP.');
      return;
    }
    if (file.size < 1 || file.size > 5 * 1024 * 1024) {
      setError('La imagen debe pesar máximo 5 MB.');
      return;
    }

    setUploadingImageFor(sectionId);
    setError('');
    try {
      const formData = new FormData();
      formData.append('kind', 'page');
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
      updateSection(sectionId, { imageUrl: result.data.url, imageAlt: file.name.replace(/\.[^.]+$/, '').slice(0, 180) });
      setSuccess('Fotografía cargada. Guarda el constructor para vincularla a la portada.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible cargar la fotografía.');
    } finally {
      setUploadingImageFor(null);
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-600">Cargando constructor de portada…</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="overflow-hidden rounded-2xl bg-[#2B1720] px-6 py-7 text-white shadow-sm sm:px-8">
        <Link to="/settings" className="text-xs font-semibold text-[#E9B9A9] hover:underline">← Volver a configuración</Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-[#E9B9A9]">Diseño y contenido</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Constructor de secciones de portada</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">Añade bloques complementarios, edita su contenido, carga fotografías desde tu dispositivo, duplica, oculta y cambia su orden. Los bloques se muestran después de las secciones principales actuales de la portada.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#E8DDD7] bg-white p-4"><p className="text-xs text-gray-500">Bloques creados</p><p className="mt-1 text-2xl font-bold text-[#3B222B]">{sections.length} / 10</p></div>
        <div className="rounded-xl border border-[#E8DDD7] bg-white p-4"><p className="text-xs text-gray-500">Bloques visibles</p><p className="mt-1 text-2xl font-bold text-[#3B222B]">{visibleCount}</p></div>
        <div className="rounded-xl border border-[#E8DDD7] bg-white p-4"><p className="text-xs text-gray-500">Destino</p><p className="mt-1 text-lg font-bold text-[#3B222B]">Portada pública</p></div>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {success && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</div>}

      <section className="rounded-2xl border border-[#E8DDD7] bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold text-[#3B222B]">Añadir un bloque</h2>
        <p className="mt-1 text-sm text-gray-500">Elige uno de los diseños disponibles. Podrás cambiar sus textos y opciones después de crearlo.</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <select value={newType} onChange={(event) => setNewType(event.target.value as SectionType)} className="min-w-0 flex-1 rounded-xl border border-[#DCCFC9] bg-white px-3 py-2.5 text-sm text-gray-900">
            {TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label} — {option.description}</option>)}
          </select>
          <button type="button" onClick={addSection} disabled={sections.length >= 10} className="rounded-xl bg-[#8F4F43] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#744037] disabled:opacity-40">+ Añadir bloque</button>
        </div>
      </section>

      {sections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#DCCFC9] bg-white px-6 py-14 text-center">
          <p className="text-lg font-bold text-[#3B222B]">Todavía no hay bloques adicionales</p>
          <p className="mt-2 text-sm text-gray-500">Añade una franja informativa, un bloque de texto, una imagen, beneficios o un llamado a la acción.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map((section, index) => {
            const typeLabel = TYPE_OPTIONS.find((option) => option.value === section.type)?.label || 'Sección';
            return (
              <section key={section.id} className={`rounded-2xl border bg-white p-5 shadow-sm sm:p-6 ${section.visible ? 'border-[#E8DDD7]' : 'border-dashed border-gray-300 opacity-75'}`}>
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F8EEE8] text-sm font-bold text-[#8F4F43]">{index + 1}</span>
                    <div className="min-w-0"><h2 className="truncate font-bold text-[#3B222B]">{section.title || 'Sección sin título'}</h2><p className="text-xs text-gray-500">{typeLabel} · {section.visible ? 'Visible' : 'Oculta'}</p></div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button type="button" onClick={() => moveSection(section.id, -1)} disabled={index === 0} className="rounded-lg border border-[#DCCFC9] px-3 py-2 text-sm disabled:opacity-30" aria-label="Subir bloque">↑</button>
                    <button type="button" onClick={() => moveSection(section.id, 1)} disabled={index === sections.length - 1} className="rounded-lg border border-[#DCCFC9] px-3 py-2 text-sm disabled:opacity-30" aria-label="Bajar bloque">↓</button>
                    <button type="button" onClick={() => updateSection(section.id, { visible: !section.visible })} className="rounded-lg border border-[#DCCFC9] px-3 py-2 text-xs font-semibold text-[#654B4D]">{section.visible ? 'Ocultar' : 'Mostrar'}</button>
                    <button type="button" onClick={() => duplicateSection(section)} className="rounded-lg border border-[#DCCFC9] px-3 py-2 text-xs font-semibold text-[#654B4D]">Duplicar</button>
                    <button type="button" onClick={() => deleteSection(section)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">Eliminar</button>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-4">
                    <Field label="Etiqueta superior (opcional)" value={section.eyebrow} maxLength={90} onChange={(value) => updateSection(section.id, { eyebrow: value })} />
                    <Field label="Título" value={section.title} maxLength={140} onChange={(value) => updateSection(section.id, { title: value })} />
                    <Field label="Descripción" value={section.description} multiline maxLength={700} onChange={(value) => updateSection(section.id, { description: value })} />
                    {(section.type === 'imageText' || section.type === 'cta') && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Texto del botón" value={section.buttonLabel} maxLength={70} onChange={(value) => updateSection(section.id, { buttonLabel: value })} />
                        <Field label="Enlace del botón" value={section.buttonUrl} maxLength={500} onChange={(value) => updateSection(section.id, { buttonUrl: value })} help="Ejemplos: /menu, /events o https://tusitio.com" />
                      </div>
                    )}
                    {section.type === 'imageText' && (
                      <div className="space-y-2 rounded-xl border border-[#EFE6E1] p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-[#49343B]">Fotografía del bloque</span>
                          {section.imageUrl && <button type="button" onClick={() => updateSection(section.id, { imageUrl: '', imageAlt: '' })} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">Quitar fotografía</button>}
                        </div>
                        {section.imageUrl ? <img src={section.imageUrl} alt={section.imageAlt} className="max-h-44 w-full rounded-lg object-cover" /> : <p className="text-xs text-gray-500">Carga una fotografía desde tu computador o celular.</p>}
                        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadSectionImage(section.id, event)} disabled={uploadingImageFor !== null || saving} className="block w-full text-xs text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#F8EEE8] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#8F4F43] hover:file:bg-[#F1E2DC] disabled:opacity-50" />
                        {uploadingImageFor === section.id && <p className="text-xs text-[#8F4F43]">Cargando fotografía…</p>}
                        <p className="text-xs text-gray-500">JPG, PNG o WebP · máximo 5 MB. Guarda el constructor antes de 1 hora; las cargas sin uso se limpian automáticamente.</p>
                        <Field label="Texto alternativo de la imagen" value={section.imageAlt} maxLength={180} onChange={(value) => updateSection(section.id, { imageAlt: value })} />
                      </div>
                    )}
                    {section.type === 'features' && [1, 2, 3].map((number) => (
                      <div key={number} className="grid gap-3 rounded-xl border border-[#EFE6E1] p-3 sm:grid-cols-2">
                        <Field label={`Beneficio ${number} — título`} value={section[`feature${number}Title` as keyof BuilderSection] as string} maxLength={90} onChange={(value) => updateSection(section.id, { [`feature${number}Title`]: value } as Partial<BuilderSection>)} />
                        <Field label={`Beneficio ${number} — descripción`} value={section[`feature${number}Description` as keyof BuilderSection] as string} multiline maxLength={220} onChange={(value) => updateSection(section.id, { [`feature${number}Description`]: value } as Partial<BuilderSection>)} />
                      </div>
                    ))}
                  </div>
                  <SectionPreview section={section} />
                </div>
              </section>
            );
          })}
        </div>
      )}

      <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E8DDD7] bg-white/95 p-3 shadow-lg backdrop-blur">
        <p className="px-2 text-xs text-gray-500">Los cambios se publican en la portada al guardar. Las páginas internas y las cinco secciones principales siguen administrándose desde sus módulos actuales.</p>
        <button type="button" onClick={save} disabled={saving || uploadingImageFor !== null} className="rounded-xl bg-[#8F4F43] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#744037] disabled:opacity-50">{uploadingImageFor !== null ? 'Cargando fotografía…' : saving ? 'Guardando…' : 'Guardar constructor'}</button>
      </div>
    </div>
  );
}
