import { signAuthToken, verifyAuthToken, verifyPassword, hashPassword, type AdminRole, type AdminIdentity } from "./auth";
interface D1Result<T> {
  results: T[];
  success: boolean;
}

interface D1PreparedStatement {
  bind(...values: (string | number | null)[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<{ success: boolean; meta?: { changes?: number } }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

interface R2ListedObject {
  key: string;
  size: number;
  uploaded: Date;
  httpMetadata?: { contentType?: string; cacheControl?: string };
  customMetadata?: Record<string, string>;
}

interface R2ListResult {
  objects: R2ListedObject[];
  truncated: boolean;
  cursor?: string;
}

interface R2BucketBinding {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | Blob | ReadableStream | string,
    options?: {
      httpMetadata?: { contentType?: string; cacheControl?: string };
      customMetadata?: Record<string, string>;
    }
  ): Promise<unknown>;
  get(key: string): Promise<{
    body: ReadableStream;
    httpMetadata?: { contentType?: string; cacheControl?: string };
    etag?: string;
  } | null>;
  head(key: string): Promise<{ key: string; size: number; uploaded: Date } | null>;
  list(options?: {
    prefix?: string;
    limit?: number;
    cursor?: string;
    include?: Array<"httpMetadata" | "customMetadata">;
  }): Promise<R2ListResult>;
  delete(key: string | string[]): Promise<void>;
}

interface Env {
  DB: D1Database;
  ASSETS: R2BucketBinding;
  AUTH_SECRET?: string;
}

function normalizeDeliveryZoneKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("es");
}

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  imageGalleryJson: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: number;
  menuItemCount: number;
}

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  image: string | null;
  imageGalleryJson: string | null;
  isActive: number;
  trackStock: number;
  stockQty: number;
  sortOrder: number;
  categoryId: string;
  categoryName: string;
}

interface ImageGalleryResult {
  valid: boolean;
  provided: boolean;
  images: string[];
  error?: string;
}

// Categories keep three images; products support up to six.
function validateImageGallery(value: unknown, maxImages = 3): ImageGalleryResult {
  if (!Array.isArray(value)) {
    return { valid: false, provided: true, images: [], error: "Las imágenes deben enviarse como una lista." };
  }
  if (value.length > maxImages) {
    return { valid: false, provided: true, images: [], error: `Puedes agregar máximo ${maxImages} imágenes por elemento.` };
  }

  const images: string[] = [];
  for (const rawImage of value) {
    if (rawImage !== null && typeof rawImage !== "string") {
      return { valid: false, provided: true, images: [], error: "Cada dirección de imagen debe ser texto." };
    }
    const image = typeof rawImage === "string" ? rawImage.trim() : "";
    if (!image) continue;
    if (
      image.length > 1500 ||
      (!/^https?:\/\/\S+$/i.test(image) && !/^\/(?!\/)[A-Za-z0-9/_\-.,?=&%#]+$/.test(image))
    ) {
      return { valid: false, provided: true, images: [], error: "Usa una URL http(s) válida o una ruta local que comience por una sola barra (/)." };
    }
    if (!images.includes(image)) images.push(image);
  }

  return { valid: true, provided: true, images };
}

function readSubmittedImageGallery(body: Record<string, unknown>, maxImages = 3): ImageGalleryResult {
  if (Object.prototype.hasOwnProperty.call(body, "images")) {
    return validateImageGallery(body.images, maxImages);
  }
  if (Object.prototype.hasOwnProperty.call(body, "imageUrl")) {
    if (body.imageUrl !== null && typeof body.imageUrl !== "string") {
      return { valid: false, provided: true, images: [], error: "La dirección de la imagen no es válida." };
    }
    return validateImageGallery(typeof body.imageUrl === "string" && body.imageUrl.trim() ? [body.imageUrl] : [], maxImages);
  }
  return { valid: true, provided: false, images: [] };
}

function parseImageGallery(rawJson: string | null | undefined, legacyImage: string | null, maxImages = 3): string[] {
  if (typeof rawJson === "string" && rawJson.trim()) {
    try {
      const parsed: unknown = JSON.parse(rawJson);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item): item is string => typeof item === "string")
          .map(item => item.trim())
          .filter(Boolean)
          .slice(0, maxImages);
      }
    } catch {
      // Keep older records readable if a legacy JSON value is malformed.
    }
  }
  return legacyImage ? [legacyImage] : [];
}

function createAccountRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `LDTA-${hex.match(/.{1,8}/g)?.join("-") ?? hex}`;
}

function validNewPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 12 && value.length <= 128;
}

function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

function cleanOriginalFilename(value: string): string {
  const cleaned = value
    .replace(/[\\/]/g, "_")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 180);
  return cleaned || "imagen";
}

function mediaPublicUrl(key: string): string {
  return `/api/media/${key}`;
}

function isManagedMediaKey(key: string): boolean {
  return /^media\/[a-f0-9]{64}\.(?:png|jpg|webp)$/.test(key) ||
    /^brand\/(?:logo|favicon)-[0-9a-f-]{36}\.(?:png|jpg|webp)$/.test(key) ||
    /^catalog\/(?:categories|products|library|homepage|gallery|pages)\/[0-9a-f-]{36}\.(?:png|jpg|webp)$/.test(key);
}

// A freshly uploaded image remains temporarily available while an admin finishes
// saving the form. Unreferenced uploads older than this grace period are removed.
const ORPHAN_MEDIA_GRACE_MS = 60 * 60 * 1000;
// Protección temporal: no borrar objetos físicos de R2 durante el despliegue.
const MEDIA_DELETION_ENABLED = false;

function mediaKeyFromReference(reference: string): string | null {
  const prefix = "/api/media/";
  if (!reference.startsWith(prefix)) return null;
  const key = reference.slice(prefix.length);
  return isManagedMediaKey(key) ? key : null;
}

async function listAllManagedMediaObjects(env: Env): Promise<R2ListedObject[]> {
  const objects: R2ListedObject[] = [];
  for (const prefix of ["media/", "catalog/", "brand/"]) {
    let cursor: string | undefined;
    do {
      const page = await env.ASSETS.list({
        prefix,
        limit: 1000,
        cursor,
        include: ["httpMetadata", "customMetadata"]
      });
      objects.push(...page.objects.filter((object) => isManagedMediaKey(object.key)));
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
  }
  return objects;
}

async function cleanupReleasedMediaReferences(env: Env, previousUsage: Map<string, string[]>): Promise<void> {
  if (!MEDIA_DELETION_ENABLED) return;
  try {
    const currentUsage = await buildMediaUsageMap(env);
    const candidates = new Set<string>();
    for (const [reference, labels] of previousUsage) {
      if (!labels.length || (currentUsage.get(reference)?.length ?? 0) > 0) continue;
      const key = mediaKeyFromReference(reference);
      if (key) candidates.add(key);
    }
    for (const key of candidates) {
      try {
        const latestUsage = await buildMediaUsageMap(env);
        const reference = canonicalMediaReference(mediaPublicUrl(key)) || mediaPublicUrl(key);
        if ((latestUsage.get(reference)?.length ?? 0) > 0) continue;
        await env.ASSETS.delete(key);
      } catch (error) {
        // The scheduled orphan sweep retries failed cleanup without breaking a saved change.
        console.warn("Could not remove an image that is no longer referenced:", key, error);
      }
    }
  } catch (error) {
    // A successful D1 change must not be reported as failed just because R2 cleanup was unavailable.
    console.warn("Could not verify released image references; scheduled cleanup will retry:", error);
  }
}

async function cleanupExpiredOrphanMedia(env: Env, now = Date.now()): Promise<{ deleted: number; bytes: number }> {
  const result = { deleted: 0, bytes: 0 };
  if (!MEDIA_DELETION_ENABLED) return result;
  try {
    const [usage, objects] = await Promise.all([
      buildMediaUsageMap(env),
      listAllManagedMediaObjects(env)
    ]);
    const cutoff = now - ORPHAN_MEDIA_GRACE_MS;
    for (const object of objects) {
      if (object.uploaded.getTime() > cutoff) continue;
      const reference = canonicalMediaReference(mediaPublicUrl(object.key)) || mediaPublicUrl(object.key);
      if ((usage.get(reference)?.length ?? 0) > 0) continue;
      try {
        await env.ASSETS.delete(object.key);
        result.deleted += 1;
        result.bytes += object.size;
      } catch (error) {
        console.warn("Could not remove an expired unreferenced image:", object.key, error);
      }
    }
  } catch (error) {
    console.warn("Orphan image cleanup could not complete; it will be retried:", error);
  }
  return result;
}

function canonicalMediaReference(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;

  let path = raw;
  try {
    if (/^https?:\/\//i.test(raw)) path = new URL(raw).pathname;
  } catch {
    return null;
  }

  if (/^(?:media|brand|catalog)\//.test(path)) path = mediaPublicUrl(path);
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  path = path.split(/[?#]/, 1)[0];
  try { path = decodeURIComponent(path); } catch { /* Keep the literal path if malformed. */ }
  return path;
}

function collectJsonStrings(value: unknown, output: string[], depth = 0): void {
  if (depth > 8 || value === null || value === undefined) return;
  if (typeof value === "string") {
    output.push(value);
    const trimmed = value.trim();
    if ((trimmed.startsWith("{") || trimmed.startsWith("[")) && trimmed.length <= 50000) {
      try { collectJsonStrings(JSON.parse(trimmed) as unknown, output, depth + 1); } catch { /* Plain text is expected too. */ }
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectJsonStrings(item, output, depth + 1);
    return;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectJsonStrings(item, output, depth + 1);
    }
  }
}

async function buildMediaUsageMap(env: Env): Promise<Map<string, string[]>> {
  const usage = new Map<string, string[]>();
  const add = (raw: unknown, label: string) => {
    if (typeof raw !== "string") return;
    const canonical = canonicalMediaReference(raw);
    if (!canonical) return;
    const labels = usage.get(canonical) ?? [];
    if (!labels.includes(label)) labels.push(label);
    usage.set(canonical, labels);
  };
  const addJson = (raw: string | null, label: string) => {
    if (!raw) return;
    const values: string[] = [];
    try { collectJsonStrings(JSON.parse(raw) as unknown, values); } catch { values.push(raw); }
    for (const value of values) add(value, label);
  };

  const [products, categories, gallery, settings] = await Promise.all([
    env.DB.prepare("SELECT name, image_key, image_url, image_gallery_json FROM products").all<{
      name: string; image_key: string | null; image_url: string | null; image_gallery_json: string | null;
    }>(),
    env.DB.prepare("SELECT name, image_key, image_url, image_gallery_json FROM categories").all<{
      name: string; image_key: string | null; image_url: string | null; image_gallery_json: string | null;
    }>(),
    env.DB.prepare("SELECT alt_text, image_key, image_url FROM gallery_images WHERE is_active = 1").all<{
      alt_text: string; image_key: string | null; image_url: string;
    }>(),
    env.DB.prepare(`
      SELECT logo_key, logo_url, favicon_key, favicon_url,
             homepage_featured_images_json, storefront_content_json
      FROM site_settings WHERE id = 'default' LIMIT 1
    `).first<{
      logo_key: string | null; logo_url: string | null;
      favicon_key: string | null; favicon_url: string | null;
      homepage_featured_images_json: string | null; storefront_content_json: string | null;
    }>()
  ]);

  for (const row of products.results) {
    const label = `Producto: ${row.name}`;
    add(row.image_key, label);
    add(row.image_url, label);
    addJson(row.image_gallery_json, label);
  }
  for (const row of categories.results) {
    const label = `Categoría: ${row.name}`;
    add(row.image_key, label);
    add(row.image_url, label);
    addJson(row.image_gallery_json, label);
  }
  for (const row of gallery.results) {
    const label = `Galería: ${row.alt_text || "Fotografía"}`;
    add(row.image_key, label);
    add(row.image_url, label);
  }
  if (settings) {
    add(settings.logo_key, "Logotipo de la tienda");
    add(settings.logo_url, "Logotipo de la tienda");
    add(settings.favicon_key, "Icono de la tienda");
    add(settings.favicon_url, "Icono de la tienda");
    addJson(settings.homepage_featured_images_json, "Portada de la tienda");
    try {
      const storefrontContent = JSON.parse(settings.storefront_content_json || "{}") as Record<string, unknown>;
      const rawSections = typeof storefrontContent.pageBuilderJson === "string"
        ? storefrontContent.pageBuilderJson : "[]";
      const sections = JSON.parse(rawSections) as unknown;
      if (Array.isArray(sections)) {
        for (const candidate of sections) {
          if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
          const section = candidate as Record<string, unknown>;
          if (section.visible === true && typeof section.imageUrl === "string") {
            add(section.imageUrl, `Constructor de portada: ${String(section.title || "Bloque")}`);
          }
        }
      }
    } catch {
      // Invalid or legacy page-builder metadata must not pin unused R2 objects forever.
    }
  }
  return usage;
}

async function mediaReferenceStillExists(env: Env, reference: string): Promise<boolean> {
  const canonical = canonicalMediaReference(reference) || reference;
  if (!canonical.startsWith("/api/media/")) {
    // Project-bundled static files and external HTTPS URLs are not R2 objects.
    return true;
  }
  const key = mediaKeyFromReference(canonical);
  if (!key) return false;
  return Boolean(await env.ASSETS.head(key));
}

async function findUnavailableManagedMediaReference(env: Env, references: string[]): Promise<string | null> {
  for (const reference of references) {
    const canonical = canonicalMediaReference(reference) || reference;
    if (canonical.startsWith("/api/media/") && !(await mediaReferenceStillExists(env, reference))) {
      return reference;
    }
  }
  return null;
}

async function sanitizeRestoredPageBuilder(env: Env, raw: string): Promise<{ json: string; missing: boolean }> {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return { json: "[]", missing: Boolean(raw) }; }
  if (!Array.isArray(parsed)) return { json: "[]", missing: Boolean(raw) };
  let missing = false;
  const sections: unknown[] = [];
  for (const candidate of parsed) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      sections.push(candidate);
      continue;
    }
    const section = { ...(candidate as Record<string, unknown>) };
    if (typeof section.imageUrl === "string" && section.imageUrl.trim()) {
      if (!(await mediaReferenceStillExists(env, section.imageUrl))) {
        section.imageUrl = "";
        section.imageAlt = "";
        missing = true;
      }
    }
    sections.push(section);
  }
  return { json: JSON.stringify(sections), missing };
}

const STATIC_PUBLIC_MEDIA = [
  "/brand/las-delicias-de-la-tia-logo.png",
  "/category-images/comidas_para_eventos.webp",
  "/category-images/fritos_tradicionales.webp",
  "/category-images/hamburguesas.webp",
  "/category-images/pasabocas.webp",
  "/category-images/perros_calientes.webp",
  "/category-images/postres_y_dulces.webp",
  "/category-images/tamales_y_fiambres.webp",
  "/category-images/temporadas_especiales.webp",
  "/product-images/hamburguesa-clasica.png",
  "/product-images/hamburguesa-doble-carne.png",
  "/product-images/hamburguesa-especial-tocineta.png",
  "/product-images/perro-caliente-especial.png",
  "/product-images/perro-caliente-sencillo.png",
  "/product-images/perro-caliente-super-tocineta.png",
  "/product-images/tamal-tradicional.webp",
  "/social/las-delicias-link-preview-v1.jpg",
  "/social/las-delicias-link-preview-v2.jpg"
] as const;

function mediaMimeTypeFromName(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (extension === "png") return "image/png";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "webp") return "image/webp";
  return "application/octet-stream";
}


// Verify administrator identity against D1 on every protected request.
async function isAuthenticatedAdmin(request: Request, env: Env): Promise<boolean> {
  if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32) return false;

  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (!token) return false;

  const identity = await verifyAuthToken(token, env.AUTH_SECRET);
  if (!identity) return false;

  const admin = await env.DB.prepare(`
    SELECT id, role, is_active, auth_version
    FROM admin_users
    WHERE id = ?
    LIMIT 1
  `).bind(identity.id).first<{
    id: string;
    role: string;
    is_active: number;
    auth_version: number;
  }>();

  return !!admin &&
    admin.is_active === 1 &&
    admin.role === identity.role &&
    admin.auth_version === identity.authVersion;
}

// Resolve the current administrator and confirm that the account is active.
async function getAdminForRequest(
  request: Request,
  env: Env
): Promise<AdminIdentity | null> {
  if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32) return null;

  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (!token) return null;

  const identity = await verifyAuthToken(token, env.AUTH_SECRET);
  if (!identity) return null;

  const admin = await env.DB.prepare(`
    SELECT id, role, is_active, auth_version
    FROM admin_users
    WHERE id = ?
    LIMIT 1
  `).bind(identity.id).first<{
    id: string;
    role: string;
    is_active: number;
    auth_version: number;
  }>();

  if (
    !admin ||
    admin.is_active !== 1 ||
    admin.role !== identity.role ||
    admin.auth_version !== identity.authVersion
  ) {
    return null;
  }

  return identity;
}
const DEFAULT_STOREFRONT_CONTENT: Record<string, string | boolean> = {
  "businessActivity": "",
  "designTokensJson": "",
  "pageBuilderJson": "",
  "navHomeLabel": "Inicio",
  "navCatalogLabel": "Menú",
  "navEventsLabel": "Eventos especiales",
  "navGalleryLabel": "Galería",
  "navShowEvents": true,
  "navShowGallery": true,
  "cartButtonLabel": "Mi pedido",
  "cartPanelTitle": "Tu carrito",
  "cartEmptyTitle": "Tu carrito está vacío",
  "cartBrowseLabel": "Ver menú",
  "cartCheckoutLabel": "Continuar al pago",
  "checkoutEmptyTitle": "Tu carrito está vacío",
  "checkoutEmptyDescription": "Agrega productos del menú para continuar con tu pedido.",
  "checkoutEmptyButtonLabel": "Ver menú",
  "checkoutTitle": "Finalizar pedido",
  "checkoutSubtitle": "Completa tus datos y elige cómo deseas recibir tu pedido.",
  "checkoutReceiveTitle": "¿Cómo deseas recibir tu pedido?",
  "checkoutDeliveryLabel": "Domicilio",
  "checkoutDeliveryDescription": "Recibe tu pedido en la dirección que indiques.",
  "checkoutPickupLabel": "Recoger en el establecimiento",
  "checkoutPickupDescription": "Sin costo de domicilio. Te confirmaremos los datos para recoger.",
  "checkoutAddressTitle": "Dirección de entrega",
  "checkoutDeliveryFeeLabel": "Domicilio",
  "checkoutFreeDeliveryMessage": "Tu pedido cumple la condición de domicilio gratis.",
  "checkoutPickupNoticeTitle": "Recogida sin costo",
  "checkoutPickupNoticeDescription": "No se cobrará domicilio. El negocio confirmará contigo la dirección y la hora para recoger el pedido.",
  "checkoutPickupSummaryNote": "Recogida sin costo de domicilio.",
  "checkoutSummaryTitle": "Resumen del pedido",
  "checkoutNotesTitle": "Notas del pedido",
  "checkoutContactDescription": "Necesitamos estos datos para confirmar y coordinar tu pedido.",
  "checkoutCashPaymentTitle": "Efectivo contra entrega o al recoger",
  "checkoutCashPaymentDescription": "Pagas cuando recibas o recojas tu pedido.",
  "checkoutSubmitLabel": "Confirmar pedido",
  "checkoutLoadingLabel": "Registrando pedido...",
  "checkoutPriceValidationNote": "Los precios y el costo de domicilio serán validados nuevamente por el sistema al registrar el pedido.",
  "checkoutConfigurationLoadingMessage": "Cargando medios de pago y opciones de entrega...",
  "checkoutConfigurationErrorMessage": "No fue posible cargar la información para realizar el pedido.",
  "checkoutOrdersUnavailableMessage": "En este momento no estamos recibiendo pedidos en línea. Puedes comunicarte con el negocio para consultar disponibilidad.",
  "checkoutScheduledUnavailableError": "Los pedidos programados no están disponibles actualmente.",
  "checkoutCashUnavailableError": "El pago en efectivo no está disponible. Selecciona otro medio de pago.",
  "checkoutDeliveryUnavailableError": "El servicio a domicilio no está disponible actualmente.",
  "checkoutCoverageUnavailableError": "Selecciona un municipio y un barrio que estén dentro de la cobertura de domicilios.",
  "checkoutMinimumOrderError": "El pedido mínimo para esta modalidad es {amount}.",
  "checkoutOtherNeighborhoodRequiredError": "Escribe el nombre de tu barrio o sector.",
  "checkoutOtherNeighborhoodLengthError": "El nombre del barrio o sector no puede superar 100 caracteres.",
  "checkoutAddressRequiredError": "Escribe la dirección de entrega.",
  "checkoutPickupUnavailableError": "La recogida en el establecimiento no está disponible actualmente.",
  "checkoutCustomerContactRequiredError": "Escribe el nombre y el teléfono de contacto.",
  "checkoutPaymentUnavailableError": "El medio de pago seleccionado ya no está disponible. Selecciona otro.",
  "checkoutOrderCreateError": "No fue posible registrar el pedido. Revisa los datos e inténtalo nuevamente.",
  "checkoutUnexpectedError": "Ocurrió un error al registrar el pedido.",
  "checkoutNoDeliveryModesMessage": "En este momento no hay modalidades de entrega habilitadas.",
  "checkoutCityLabel": "Municipio",
  "checkoutCityPlaceholder": "Selecciona tu municipio",
  "checkoutNeighborhoodLabel": "Barrio",
  "checkoutNeighborhoodPlaceholder": "Selecciona tu barrio",
  "checkoutOtherNeighborhoodLabel": "Escribe tu barrio o sector",
  "checkoutOtherNeighborhoodPlaceholder": "Ej. La Tablaza, El Escobero, Robledo...",
  "checkoutOtherNeighborhoodFeeNote": "Se aplicará la tarifa general configurada para este municipio.",
  "checkoutAddressLabel": "Dirección",
  "checkoutAddressPlaceholder": "Ej. Calle 00 # 00-00, apartamento o casa",
  "checkoutAddressExtraLabel": "Indicaciones adicionales (opcional)",
  "checkoutAddressExtraPlaceholder": "Torre, apartamento, referencia para llegar...",
  "checkoutNoNeighborhoodsMessage": "No hay barrios configurados para este municipio. Comunícate con el negocio para consultar cobertura.",
  "checkoutFreeDeliveryLabel": "GRATIS",
  "checkoutMinimumOrderMessage": "Pedido mínimo para esta modalidad: {amount}.",
  "checkoutBelowMinimumMessage": "Agrega productos por {amount} más para alcanzar el pedido mínimo.",
  "checkoutPickupMinimumMessage": "Pedido mínimo para recoger: {amount}.",
  "checkoutPickupMinimumBelowMessage": "Agrega {amount} más para continuar.",
  "checkoutScheduledTitle": "¿Cuándo lo necesitas?",
  "checkoutScheduleAsapLabel": "Lo antes posible",
  "checkoutScheduleLaterLabel": "Programar fecha y hora",
  "checkoutNotesPlaceholder": "Cuéntanos alguna indicación especial (opcional).",
  "checkoutContactTitle": "Datos de contacto",
  "checkoutCustomerNameLabel": "Nombre completo *",
  "checkoutCustomerPhoneLabel": "Teléfono celular *",
  "checkoutCustomerEmailLabel": "Correo electrónico (opcional)",
  "checkoutWhatsappConsentLabel": "Quiero recibir por WhatsApp un aviso cuando mi pedido esté listo (opcional).",
  "checkoutWhatsappConsentDescription": "Usaremos tu número únicamente para avisarte sobre este pedido. No enviaremos promociones ni publicidad por esta autorización.",
  "checkoutPaymentMethodTitle": "Medio de pago",
  "checkoutNoPaymentMethodsMessage": "No hay medios de pago habilitados en este momento. Comunícate con el negocio.",
  "checkoutPaymentDetailsTitle": "Datos para realizar el pago",
  "checkoutPaymentAccountHolderLabel": "Titular:",
  "checkoutPaymentAccountHolderFallback": "Consulta con el negocio",
  "checkoutPaymentBankLabel": "Entidad:",
  "checkoutPaymentAccountTypeLabel": "Tipo de cuenta:",
  "checkoutPaymentAccountNumberLabel": "Número de cuenta o celular:",
  "checkoutPaymentKeyLabel": "Llave Bre-B:",
  "checkoutPaymentAdvanceNotice": "Este medio requiere pago anticipado. Después de registrar el pedido, realiza la transferencia. El pedido quedará pendiente hasta que el negocio verifique la recepción del dinero.",
  "checkoutCashPendingNotice": "El pago en efectivo se registrará como pendiente hasta que el negocio reciba el dinero.",
  "checkoutSubtotalLabel": "Subtotal",
  "checkoutTotalLabel": "Total",
  "catalogProductPlaceholderEmoji": "🍽️",
  "homeShowHeroSection": true,
  "homeShowCatalogSection": true,
  "homeSectionOrder": "hero,catalog,events,features,closing",
  "homeHeroBadge": "Las Delicias de la Tía · Hecho en casa",
  "homeHeroTitle": "Comida rica para momentos especiales",
  "homeHeroSubtitle": "Hechas en casa, pensadas para compartir.",
  "homeHeroDescription": "Explora nuestras comidas y preparaciones: almuerzos, picadas, refrigerios, comidas rápidas, postres y mucho más. También organizamos propuestas por encargo para banquetes, reuniones y celebraciones especiales.",
  "homeHeroPrimaryLabel": "Ver menú",
  "homeShowHeroEventsButton": true,
  "homeHeroEventsLabel": "Cotizar un evento",
  "homeBenefit1": "Preparación por encargo",
  "homeBenefit2": "Recogida o domicilio",
  "homeBenefit3": "Menús para celebrar",
  "homeHeroPhotoBadge": "El sabor de la casa",
  "homeHeroPhotoTitle": "Antojos que reúnen sonrisas",
  "homeHeroSideCaption1": "Para compartir",
  "homeHeroSideCaption2": "Hecho con cariño",
  "homeHeroLogoTitle": "Nuestra cocina",
  "homeHeroLogoDescription": "Preparaciones por encargo para cada ocasión.",
  "homeCatalogEyebrow": "El menú de la casa",
  "homeCatalogTitle": "Un antojo siempre encuentra su momento",
  "homeCatalogDescription": "Encuentra desde comidas para todos los días y antojos para compartir hasta opciones dulces y preparaciones para tus celebraciones.",
  "homeCatalogButtonLabel": "Explorar todo el menú",
  "homeFeaturedEyebrow": "Favoritos para compartir",
  "homeFeaturedTitle": "Delicias que te esperan",
  "homeFeaturedBadge": "Preparado por encargo",
  "homeProductCardBadge": "Favorito de la casa",
  "homeProductCardButton": "Ver producto",
  "homeCatalogEmptyTitle": "Estamos preparando nuestro catálogo",
  "homeCatalogEmptyDescription": "Pronto encontrarás aquí nuestros productos.",
  "homeShowEventsSection": true,
  "homeEventsBadge": "Celebraciones y fechas especiales",
  "homeEventsTitle": "Tú celebras. Nosotros ponemos el sabor.",
  "homeEventsDescription": "Cumpleaños, reuniones familiares, grados, aniversarios y fechas especiales. Preparamos pasabocas, platos para compartir y menús tipo bufé. Cuéntanos cuántas personas asistirán y qué te gustaría servir.",
  "homeEventsServiceNote": "Cocina por encargo desde casa · Recogida o domicilio según cobertura",
  "homeEventsPrimaryLabel": "Cotizar mi celebración",
  "homeEventsSecondaryLabel": "Ver comidas del menú",
  "homeShowFeaturesSection": true,
  "homeFeature1Title": "Preparado con cariño",
  "homeFeature1Description": "Comidas hechas por encargo para disfrutar en familia, compartir y celebrar.",
  "homeFeature2Title": "Pide a tu manera",
  "homeFeature2Description": "Explora el menú, elige tus antojos y arma tu pedido fácilmente.",
  "homeFeature3Title": "Celebraciones especiales",
  "homeFeature3Description": "Menús, pasabocas y opciones tipo bufé para tus mejores momentos.",
  "homeShowClosingSection": true,
  "homeClosingEyebrow": "Un antojo, una ocasión, un buen momento",
  "homeClosingTitle": "¿Se te antojó algo rico?",
  "homeClosingDescription": "Explora nuestro menú y encuentra algo delicioso para disfrutar o compartir.",
  "homeClosingButtonLabel": "Ver menú",
  "catalogPageDescription": "Elige tus favoritos, revisa sus detalles y arma tu pedido. Preparamos cada opción con cariño para disfrutar en casa o compartir.",
  "catalogIntroBadge": "Las Delicias de la Tía",
  "catalogSearchPlaceholder": "Buscar en el menú...",
  "catalogAllLabel": "Todos",
  "catalogCategoriesEyebrow": "Encuentra tu favorito",
  "catalogCategoriesTitle": "Explora nuestras categorías",
  "catalogCategoriesDescription": "Elige lo que más se te antoje.",
  "catalogCategoriesTotalSingular": "categoría",
  "catalogCategoriesTotalPlural": "categorías",
  "catalogCategoryCountSingular": "producto",
  "catalogCategoryCountPlural": "productos",
  "catalogCategoryEmptyLabel": "Próximamente",
  "catalogResultsEyebrow": "Recién preparado para ti",
  "catalogSearchResultsTitle": "Resultados de búsqueda",
  "catalogProductsTitle": "Nuestros productos",
  "catalogShowAllCategoriesLabel": "Ver todas las categorías",
  "catalogEmptyTitle": "Todavía no hay productos en esta selección",
  "catalogEmptyDescription": "Estamos preparando nuestro catálogo. Explora las demás categorías mientras agregamos más productos.",
  "catalogProductAvailableLabel": "Disponible para pedir",
  "catalogProductDetailsLabel": "Ver detalles y opciones",
  "catalogLoadError": "No fue posible cargar los productos. Inténtalo de nuevo.",
  "footerBusinessDescription": "Somos una cocina por encargo: preparamos almuerzos, refrigerios, picadas, comidas rápidas, tamales, fiambres, tablas, postres y muchas opciones más. También elaboramos propuestas para banquetes, celebraciones y servicios tipo bufé. Coordinamos la recogida o la entrega a domicilio según la cobertura. No contamos con atención en mesas.",
  "footerServiceBadge": "Atención por WhatsApp",
  "footerNavigationTitle": "Explora nuestra tienda",
  "footerContactTitle": "Estamos para atenderte",
  "footerContactDescription": "¿Buscas comida para el día a día, algo para compartir o una propuesta para tu celebración? Escríbenos y cuéntanos qué necesitas.",
  "footerWhatsappButtonLabel": "Escríbenos por WhatsApp",
  "footerShowEventsButton": true,
  "footerEventsButtonLabel": "Solicitar cotización para un evento",
  "footerSocialEyebrow": "Conecta con nosotros",
  "footerSocialTitle": "Síguenos y visítanos",
  "footerSocialDescription": "Descubre nuestras novedades, conoce lo que preparamos y acompáñanos en cada ocasión especial.",
  "eventsPageBadge": "Las Delicias de la Tía",
  "eventsPageTitle": "Celebremos juntos tus momentos especiales",
  "eventsPageDescription": "Preparamos comida por encargo para cumpleaños, reuniones familiares, grados, aniversarios y fechas especiales. También ofrecemos pasabocas y menús tipo bufé. Cuéntanos la fecha, el número de invitados, el lugar y qué te gustaría servir para preparar una propuesta a tu medida. Coordinamos recogida o domicilio según la cobertura.",
  "eventsPageTagline": "Para cada antojo, una experiencia.",
  "eventsContactSectionTitle": "1. Información de contacto",
  "eventsNameLabel": "Nombre completo *",
  "eventsNamePlaceholder": "Tu nombre",
  "eventsPhoneLabel": "Teléfono o WhatsApp *",
  "eventsPhonePlaceholder": "Tu número de contacto",
  "eventsEmailLabel": "Correo electrónico (opcional)",
  "eventsEmailPlaceholder": "correo@ejemplo.com",
  "eventsConsentText": "Autorizo a {businessName} a contactarme por WhatsApp para responder esta solicitud y compartir la cotización. Esta autorización es opcional y puedo solicitar que dejen de escribirme.",
  "eventsConsentHelp": "Puedes enviar tu solicitud aunque no marques esta casilla.",
  "eventsDetailsSectionTitle": "2. Información del evento",
  "eventsTypeLabel": "¿Qué evento estás organizando? *",
  "eventsTypePlaceholder": "Selecciona una opción",
  "eventsTypeOptions": "Cumpleaños\nReunión familiar\nEvento empresarial\nGrado\nBautizo o primera comunión\nAniversario\nOtro evento",
  "eventsDateLabel": "Fecha del evento",
  "eventsGuestCountLabel": "Número de invitados",
  "eventsGuestCountPlaceholder": "Ej. 50",
  "eventsLocationSectionTitle": "3. Lugar del evento",
  "eventsCityLabel": "Ciudad o municipio",
  "eventsCityPlaceholder": "Ej. Medellín",
  "eventsNeighborhoodLabel": "Barrio o sector",
  "eventsNeighborhoodPlaceholder": "Nombre del barrio",
  "eventsAddressLabel": "Dirección o lugar",
  "eventsAddressPlaceholder": "Dirección donde se realizará el evento",
  "eventsFoodBudgetSectionTitle": "4. Comidas y presupuesto",
  "eventsFoodLabel": "¿Qué comidas o productos te interesan?",
  "eventsFoodPlaceholder": "Cuéntanos qué te gustaría incluir en tu evento...",
  "eventsBudgetLabel": "Presupuesto aproximado (COP)",
  "eventsBudgetPlaceholder": "Ej. 500000",
  "eventsAdditionalDetailsLabel": "Detalles adicionales",
  "eventsAdditionalDetailsPlaceholder": "¿Hay algún detalle especial que debamos conocer?",
  "eventsSubmitLabel": "Enviar solicitud de cotización",
  "eventsSubmittingLabel": "Enviando solicitud...",
  "eventsSuccessMessage": "¡Tu solicitud fue recibida! Número de seguimiento: {number}",
  "eventsPrivacyNote": "Tus datos se utilizarán para atender esta solicitud y preparar tu cotización. No necesitas crear una cuenta.",
  "eventsRequestErrorMessage": "No fue posible enviar tu solicitud. Intenta nuevamente.",
  "eventsGenericErrorMessage": "Ocurrió un error. Intenta nuevamente.",
  "eventsInvalidPayloadError": "El contenido de la solicitud no es válido.",
  "eventsInvalidNameError": "Escribe un nombre válido de entre 2 y 100 caracteres.",
  "eventsInvalidPhoneError": "Escribe un número de teléfono válido.",
  "eventsInvalidTypeError": "Selecciona o escribe un tipo de evento válido.",
  "eventsInvalidEmailError": "El correo electrónico no es válido.",
  "eventsInvalidDateError": "La fecha del evento no tiene un formato válido.",
  "eventsInvalidGuestCountError": "El número de invitados debe estar entre 1 y 10.000.",
  "eventsInvalidBudgetError": "El presupuesto indicado no es válido.",
  "eventsInvalidFieldLengthError": "El campo {field} supera el límite permitido de {maximum} caracteres."
};

const ORIGINAL_TEMPLATE_DESIGN_TOKENS = {
  primary: "#C51E43",
  secondary: "#FFF3E7",
  accent: "#B91F4C",
  background: "#FFF9F1",
  surface: "#FFFDF9",
  text: "#321522",
  muted: "#74666B",
  border: "#EADFD8",
  fontFamily: "inter",
  cardRadius: "comfortable",
  contentWidth: "wide",
  shadow: "soft",
} as const;

// Immutable presentation baseline for the original Las Delicias de la Tía storefront.
// An empty featured-image override intentionally makes ClassicHero use the first three
// active catalog product photos, as in the original dynamic presentation. It does not
// delete any uploaded images or product records.
const ORIGINAL_TEMPLATE_FEATURED_IMAGES_JSON = "[]";
// Custom page-builder sections are not part of the original template. They remain in the
// pre-restore snapshot and can be recovered with the "restore previous" operation.
const ORIGINAL_TEMPLATE_PAGE_BUILDER_JSON = "";

function readStorefrontContent(raw: string | null | undefined): Record<string, string | boolean> {
  const defaults = { ...DEFAULT_STOREFRONT_CONTENT };
  if (!raw) return defaults;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return defaults;
    const source = parsed as Record<string, unknown>;
    for (const [key, fallback] of Object.entries(DEFAULT_STOREFRONT_CONTENT)) {
      const value = source[key];
      if (typeof fallback === "boolean" && typeof value === "boolean") defaults[key] = value;
      const maxLength = key === "pageBuilderJson" ? 32000 : key === "designTokensJson" ? 1200 : 600;
      if (typeof fallback === "string" && typeof value === "string" && value.length <= maxLength) defaults[key] = value;
    }
    return defaults;
  } catch {
    return defaults;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Read-only inventory of images referenced by the storefront; unlinked R2 objects are swept after a grace period.
      if (path === "/api/media" && request.method === "GET") {
        const admin = await getAdminForRequest(request, env);
        if (!admin) return jsonResponse({ success: false, error: "Debes iniciar sesión para consultar la biblioteca." }, 401);

        await cleanupExpiredOrphanMedia(env);
        const usage = await buildMediaUsageMap(env);
        const objects = (await listAllManagedMediaObjects(env))
          .sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime());

        const r2Items = objects.flatMap(object => {
          const url = mediaPublicUrl(object.key);
          const usedBy = usage.get(canonicalMediaReference(url) || url) ?? [];
          // The panel is an inventory of images in active use, never an archive of unused uploads.
          if (usedBy.length === 0) return [];
          const filename = object.key.split("/").pop() || object.key;
          return [{
            id: object.key,
            filename,
            originalName: object.customMetadata?.originalName || filename,
            url,
            mimeType: object.httpMetadata?.contentType || mediaMimeTypeFromName(filename),
            size: object.size,
            createdAt: object.uploaded.toISOString(),
            uploadedBy: null,
            source: "r2",
            usedBy,
            canDelete: false
          }];
        });

        const staticItems = STATIC_PUBLIC_MEDIA.flatMap(staticUrl => {
          const filename = staticUrl.split("/").pop() || staticUrl;
          const usedBy = usage.get(canonicalMediaReference(staticUrl) || staticUrl) ?? [];
          if (usedBy.length === 0) return [];
          return [{
            id: `static:${staticUrl}`,
            filename,
            originalName: filename,
            url: staticUrl,
            mimeType: mediaMimeTypeFromName(filename),
            size: 0,
            createdAt: "",
            uploadedBy: null,
            source: "static",
            usedBy,
            canDelete: false
          }];
        });

        const requestedLimit = Number.parseInt(url.searchParams.get("limit") || "2500", 10);
        const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 2500)) : 2500;
        const data = [...r2Items, ...staticItems].slice(0, limit);
        return jsonResponse({
          success: true,
          data,
          activeR2Images: r2Items.length,
          activeStorageBytes: r2Items.reduce((total, item) => total + item.size, 0),
          truncated: r2Items.length + staticItems.length > limit
        });
      }

      // Delete only managed R2 images, and only when no database setting or record references them.
      if (path.startsWith("/api/media/") && request.method === "DELETE") {
        const admin = await getAdminForRequest(request, env);
        if (!admin || (admin.role !== "SUPER_ADMIN" && admin.role !== "MANAGER")) {
          return jsonResponse({ success: false, error: "No tienes autorización para eliminar imágenes." }, 403);
        }

        let key: string;
        try { key = decodeURIComponent(path.slice("/api/media/".length)); }
        catch { return jsonResponse({ success: false, error: "Identificador de imagen no válido." }, 400); }
        if (!isManagedMediaKey(key)) {
          return jsonResponse({ success: false, error: "Solo puedes eliminar archivos administrados por la biblioteca." }, 400);
        }

        if (!MEDIA_DELETION_ENABLED) {
          return jsonResponse({
            success: false,
            error: "La eliminación física de archivos multimedia está temporalmente desactivada por protección de datos."
          }, 423);
        }

        const image = await env.ASSETS.get(key);
        if (!image) return jsonResponse({ success: false, error: "La imagen ya no existe en el almacenamiento." }, 404);

        const usage = await buildMediaUsageMap(env);
        const references = usage.get(canonicalMediaReference(mediaPublicUrl(key)) || mediaPublicUrl(key)) ?? [];
        if (references.length > 0) {
          return jsonResponse({
            success: false,
            error: "No se puede eliminar porque esta imagen está siendo utilizada.",
            usedBy: references
          }, 409);
        }

        await env.ASSETS.delete(key);
        try {
          await env.DB.prepare(`
            INSERT INTO audit_logs (id, admin_user_id, action, entity_type, entity_id, details_json)
            VALUES (?, ?, 'MEDIA_DELETED', 'MEDIA', ?, ?)
          `).bind(crypto.randomUUID(), admin.id, key, JSON.stringify({ key, url: mediaPublicUrl(key) })).run();
        } catch (auditError) {
          console.warn("Could not write media deletion audit entry:", auditError);
        }

        return jsonResponse({ success: true, message: "La imagen se eliminó correctamente." });
      }

      // Public access to managed active storefront images stored in R2.
      if (path.startsWith("/api/media/") && request.method === "GET") {
        let key: string;

        try {
          key = decodeURIComponent(path.slice("/api/media/".length));
        } catch {
          return jsonResponse({ success: false, error: "Ruta de imagen no válida." }, 400);
        }

        if (!isManagedMediaKey(key)) {
          return jsonResponse({ success: false, error: "Imagen no encontrada." }, 404);
        }

        const object = await env.ASSETS.get(key);

        if (!object) {
          return jsonResponse({ success: false, error: "Imagen no encontrada." }, 404);
        }

        return new Response(object.body, {
          headers: {
            "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
            "Cache-Control": object.httpMetadata?.cacheControl || "public, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff"
          }
        });
      }

      // Protected logo and favicon uploads for the SUPER_ADMIN.
      if (
        (path === "/api/settings/logo" || path === "/api/settings/favicon") &&
        request.method === "POST"
      ) {
        const admin = await getAdminForRequest(request, env);

        if (!admin || admin.role !== "SUPER_ADMIN") {
          return jsonResponse({
            success: false,
            error: "No tienes autorización para cargar imágenes."
          }, 403);
        }

        const type = path.endsWith("/logo") ? "logo" : "favicon";

        let formData: FormData;

        try {
          formData = await request.formData();
        } catch {
          return jsonResponse({
            success: false,
            error: "No se pudo leer el archivo enviado."
          }, 400);
        }

        const uploaded = formData.get(type);

        if (!(uploaded instanceof File)) {
          return jsonResponse({
            success: false,
            error: "Selecciona una imagen válida."
          }, 400);
        }

        if (uploaded.size < 1 || uploaded.size > 5 * 1024 * 1024) {
          return jsonResponse({
            success: false,
            error: "La imagen debe pesar más de 0 y máximo 5 MB."
          }, 400);
        }

        const buffer = await uploaded.arrayBuffer();
        const bytes = new Uint8Array(buffer);

        const isPng =
          bytes.length >= 8 &&
          bytes[0] === 0x89 &&
          bytes[1] === 0x50 &&
          bytes[2] === 0x4e &&
          bytes[3] === 0x47 &&
          bytes[4] === 0x0d &&
          bytes[5] === 0x0a &&
          bytes[6] === 0x1a &&
          bytes[7] === 0x0a;

        const isJpeg =
          bytes.length >= 3 &&
          bytes[0] === 0xff &&
          bytes[1] === 0xd8 &&
          bytes[2] === 0xff;

        const isWebp =
          bytes.length >= 12 &&
          bytes[0] === 0x52 &&
          bytes[1] === 0x49 &&
          bytes[2] === 0x46 &&
          bytes[3] === 0x46 &&
          bytes[8] === 0x57 &&
          bytes[9] === 0x45 &&
          bytes[10] === 0x42 &&
          bytes[11] === 0x50;

        const detectedMime = isPng
          ? "image/png"
          : isJpeg
            ? "image/jpeg"
            : isWebp
              ? "image/webp"
              : "";

        if (!detectedMime || detectedMime !== uploaded.type) {
          return jsonResponse({
            success: false,
            error: "Formato no permitido. Utiliza PNG, JPG o WebP."
          }, 400);
        }

        const extension =
          detectedMime === "image/png" ? "png" :
          detectedMime === "image/jpeg" ? "jpg" : "webp";

        const previousMediaUsage = await buildMediaUsageMap(env);
        const digestBuffer = await crypto.subtle.digest("SHA-256", bytes);
        const digest = Array.from(new Uint8Array(digestBuffer), (value) => value.toString(16).padStart(2, "0")).join("");
        const key = `media/${digest}.${extension}`;
        const publicUrl = mediaPublicUrl(key);
        const existingObject = await env.ASSETS.head(key);
        const needsGraceRefresh = Boolean(existingObject && existingObject.uploaded.getTime() <= Date.now() - ORPHAN_MEDIA_GRACE_MS);
        if (!existingObject || needsGraceRefresh) {
          await env.ASSETS.put(key, bytes, {
            httpMetadata: {
              contentType: detectedMime,
              cacheControl: "public, max-age=31536000, immutable"
            },
            customMetadata: {
              originalName: cleanOriginalFilename(uploaded.name),
              uploadedById: admin.id,
              assetKind: type,
              sha256: digest
            }
          });
        }

        const urlColumn = type === "logo" ? "logo_url" : "favicon_url";
        const keyColumn = type === "logo" ? "logo_key" : "favicon_key";

        await env.DB.prepare(`
          UPDATE site_settings
          SET ${urlColumn} = ?, ${keyColumn} = ?
          WHERE id = 'default'
        `).bind(publicUrl, key).run();
        await cleanupReleasedMediaReferences(env, previousMediaUsage);

        return type === "logo"
          ? jsonResponse({ success: true, data: { logo: publicUrl } })
          : jsonResponse({ success: true, data: { favicon: publicUrl } });
      }
      // Upload a photograph directly for the module that will use it; identical bytes share one R2 object.
      if (path === "/api/media/upload" && request.method === "POST") {
        const admin = await getAdminForRequest(request, env);
        if (!admin) {
          return jsonResponse({ success: false, error: "Debes iniciar sesión para cargar imágenes." }, 401);
        }

        let formData: FormData;
        try { formData = await request.formData(); }
        catch { return jsonResponse({ success: false, error: "No se pudo leer la imagen enviada." }, 400); }

        const kindValue = formData.get("kind");
        const imageField = formData.get("image");
        const fileField = formData.get("file");
        let uploaded: File | null = null;
        const allowedKinds = new Set(["category", "product", "homepage", "gallery", "page"]);

        if (imageField instanceof File) {
          if (typeof kindValue !== "string" || !allowedKinds.has(kindValue) || (kindValue !== "category" && kindValue !== "product")) {
            return jsonResponse({ success: false, error: "El tipo de imagen no es válido para este formulario." }, 400);
          }
          uploaded = imageField;
        } else if (fileField instanceof File) {
          if (typeof kindValue !== "string" || !allowedKinds.has(kindValue)) {
            return jsonResponse({ success: false, error: "Selecciona la sección de la tienda donde utilizarás esta fotografía. No se permiten cargas a una biblioteca de archivos sin uso." }, 400);
          }
          uploaded = fileField;
        }

        if (!uploaded) return jsonResponse({ success: false, error: "Selecciona una imagen para el módulo correspondiente." }, 400);
        if (uploaded.size < 1 || uploaded.size > 5 * 1024 * 1024) {
          return jsonResponse({ success: false, error: "La imagen debe pesar más de 0 y máximo 5 MB." }, 400);
        }

        const bytes = new Uint8Array(await uploaded.arrayBuffer());
        const isPng = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 &&
          bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d &&
          bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
        const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
        const isWebp = bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 &&
          bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 &&
          bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
        const mime = isPng ? "image/png" : isJpeg ? "image/jpeg" : isWebp ? "image/webp" : "";

        if (!mime || mime !== uploaded.type) {
          return jsonResponse({ success: false, error: "Formato no permitido. Utiliza PNG, JPG o WebP." }, 400);
        }

        const extension = mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : "webp";
        const digestBuffer = await crypto.subtle.digest("SHA-256", bytes);
        const digest = Array.from(new Uint8Array(digestBuffer), (value) => value.toString(16).padStart(2, "0")).join("");
        const key = `media/${digest}.${extension}`;
        const publicUrl = mediaPublicUrl(key);

        // Byte-identical photographs across any modules share one R2 object.
        const existingObject = await env.ASSETS.head(key);
        const needsGraceRefresh = Boolean(existingObject && existingObject.uploaded.getTime() <= Date.now() - ORPHAN_MEDIA_GRACE_MS);
        if (!existingObject || needsGraceRefresh) {
          await env.ASSETS.put(key, bytes, {
            httpMetadata: {
              contentType: mime,
              cacheControl: "public, max-age=31536000, immutable"
            },
            customMetadata: {
              originalName: cleanOriginalFilename(uploaded.name),
              uploadedById: admin.id,
              assetKind: String(kindValue),
              sha256: digest
            }
          });
        }

        return jsonResponse({ success: true, data: { url: publicUrl, key } });
      }

      // Public and administrative gallery reads use the D1 gallery_images table.
      if (path === "/api/gallery" && request.method === "GET") {
        const category = url.searchParams.get("category");
        const validCategory = category === "FOOD" || category === "EVENTS" ? category : null;
        const result = validCategory
          ? await env.DB.prepare(`
              SELECT id, image_url AS url, alt_text AS alt, category,
                     sort_order AS sortOrder, is_active AS isActive
              FROM gallery_images WHERE is_active = 1 AND category = ?
              ORDER BY sort_order ASC, created_at ASC
            `).bind(validCategory).all<Record<string, unknown>>()
          : await env.DB.prepare(`
              SELECT id, image_url AS url, alt_text AS alt, category,
                     sort_order AS sortOrder, is_active AS isActive
              FROM gallery_images WHERE is_active = 1
              ORDER BY sort_order ASC, created_at ASC
            `).all<Record<string, unknown>>();
        return jsonResponse({ success: true, data: result.results.map(row => ({
          ...row, isActive: Number(row.isActive) === 1, sortOrder: Number(row.sortOrder)
        })) });
      }

      if (path === "/api/gallery/admin" && request.method === "GET") {
        const admin = await getAdminForRequest(request, env);
        if (!admin) return jsonResponse({ success: false, error: "Debes iniciar sesión para consultar la galería." }, 401);
        const result = await env.DB.prepare(`
          SELECT id, image_url AS url, alt_text AS alt, category,
                 sort_order AS sortOrder, is_active AS isActive
          FROM gallery_images WHERE is_active = 1 ORDER BY category ASC, sort_order ASC, created_at ASC
        `).all<Record<string, unknown>>();
        return jsonResponse({ success: true, data: result.results.map(row => ({
          ...row, isActive: Number(row.isActive) === 1, sortOrder: Number(row.sortOrder)
        })) });
      }

      if (path === "/api/gallery" && request.method === "POST") {
        const admin = await getAdminForRequest(request, env);
        if (!admin || (admin.role !== "SUPER_ADMIN" && admin.role !== "MANAGER")) {
          return jsonResponse({ success: false, error: "No tienes autorización para administrar la galería." }, 403);
        }
        const parsed: unknown = await request.json().catch(() => null);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return jsonResponse({ success: false, error: "Los datos de la fotografía no son válidos." }, 400);
        }
        const body = parsed as Record<string, unknown>;
        const imageUrl = typeof body.url === "string" ? body.url.trim() : "";
        const alt = typeof body.alt === "string" ? body.alt.trim() : "";
        const category = body.category;
        const sortOrder = body.sortOrder === undefined ? 0 : Number(body.sortOrder);
        const isActive = body.isActive === undefined ? true : body.isActive;
        if (isActive !== true) return jsonResponse({ success: false, error: "La galería solo admite fotografías visibles. Para retirarlas, utiliza la acción Retirar." }, 400);
        if (!imageUrl || imageUrl.length > 1800 || (!/^https?:\/\/\S+$/i.test(imageUrl) && !/^\/(?!\/)[A-Za-z0-9/_\-.,?=&%#]+$/.test(imageUrl))) {
          return jsonResponse({ success: false, error: "Selecciona una imagen con una dirección interna o HTTPS válida." }, 400);
        }
        if (!alt || alt.length > 200) return jsonResponse({ success: false, error: "Escribe un texto alternativo de máximo 200 caracteres." }, 400);
        if (category !== "FOOD" && category !== "EVENTS") return jsonResponse({ success: false, error: "Selecciona la categoría Comidas o Eventos." }, 400);
        if (!Number.isSafeInteger(sortOrder) || sortOrder < 0 || sortOrder > 1000000 || typeof isActive !== "boolean") {
          return jsonResponse({ success: false, error: "El orden o la visibilidad de la fotografía no son válidos." }, 400);
        }
        const match = imageUrl.match(/^\/api\/media\/(.+)$/);
        let imageKey: string | null = null;
        if (match) {
          try { imageKey = decodeURIComponent(match[1]); }
          catch { return jsonResponse({ success: false, error: "La dirección de la imagen no es válida." }, 400); }
        }
        if (imageKey && !isManagedMediaKey(imageKey)) return jsonResponse({ success: false, error: "La imagen seleccionada no pertenece al almacenamiento administrado." }, 400);
        if (!(await mediaReferenceStillExists(env, imageUrl))) return jsonResponse({ success: false, error: "La fotografía ya no está disponible. Vuelve a cargarla desde tu computador o celular." }, 409);
        const id = crypto.randomUUID();
        await env.DB.prepare(`
          INSERT INTO gallery_images (id, image_key, image_url, alt_text, category, sort_order, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(id, imageKey, imageUrl, alt, category, sortOrder, isActive ? 1 : 0).run();
        return jsonResponse({ success: true, data: { id, url: imageUrl, alt, category, sortOrder, isActive } });
      }

      const galleryItemMatch = path.match(/^\/api\/gallery\/([^/]+)$/);
      if (galleryItemMatch && (request.method === "PATCH" || request.method === "DELETE")) {
        const admin = await getAdminForRequest(request, env);
        if (!admin || (admin.role !== "SUPER_ADMIN" && admin.role !== "MANAGER")) {
          return jsonResponse({ success: false, error: "No tienes autorización para administrar la galería." }, 403);
        }
        let id: string;
        try { id = decodeURIComponent(galleryItemMatch[1]); }
        catch { return jsonResponse({ success: false, error: "Identificador de fotografía no válido." }, 400); }
        const existing = await env.DB.prepare(`
          SELECT id, image_url AS url, alt_text AS alt, category,
                 sort_order AS sortOrder, is_active AS isActive
          FROM gallery_images WHERE id = ? LIMIT 1
        `).bind(id).first<Record<string, unknown>>();
        if (!existing) return jsonResponse({ success: false, error: "No se encontró la fotografía de la galería." }, 404);

        if (request.method === "DELETE") {
          const previousMediaUsage = await buildMediaUsageMap(env);
          await env.DB.prepare("DELETE FROM gallery_images WHERE id = ?").bind(id).run();
          await cleanupReleasedMediaReferences(env, previousMediaUsage);
          return jsonResponse({ success: true, message: "La fotografía se retiró de la galería. Si ninguna otra sección la utiliza, su archivo también se retiró del almacenamiento." });
        }

        const parsed: unknown = await request.json().catch(() => null);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return jsonResponse({ success: false, error: "Los cambios de la fotografía no son válidos." }, 400);
        }
        const body = parsed as Record<string, unknown>;
        const fields: string[] = [];
        const values: Array<string | number | null> = [];
        let proposedImageUrl: string | null = null;
        if (Object.prototype.hasOwnProperty.call(body, "url")) {
          const imageUrl = typeof body.url === "string" ? body.url.trim() : "";
          if (!imageUrl || imageUrl.length > 1800 || (!/^https?:\/\/\S+$/i.test(imageUrl) && !/^\/(?!\/)[A-Za-z0-9/_\-.,?=&%#]+$/.test(imageUrl))) {
            return jsonResponse({ success: false, error: "La dirección de la imagen no es válida." }, 400);
          }
          proposedImageUrl = imageUrl;
          const match = imageUrl.match(/^\/api\/media\/(.+)$/);
          let imageKey: string | null = null;
          if (match) {
            try { imageKey = decodeURIComponent(match[1]); }
            catch { return jsonResponse({ success: false, error: "La dirección de la imagen no es válida." }, 400); }
          }
          if (imageKey && !isManagedMediaKey(imageKey)) return jsonResponse({ success: false, error: "La imagen seleccionada no pertenece a la biblioteca." }, 400);
          fields.push("image_url = ?", "image_key = ?");
          values.push(imageUrl, imageKey);
        }
        if (Object.prototype.hasOwnProperty.call(body, "alt")) {
          const alt = typeof body.alt === "string" ? body.alt.trim() : "";
          if (!alt || alt.length > 200) return jsonResponse({ success: false, error: "El texto alternativo debe tener entre 1 y 200 caracteres." }, 400);
          fields.push("alt_text = ?"); values.push(alt);
        }
        if (Object.prototype.hasOwnProperty.call(body, "category")) {
          if (body.category !== "FOOD" && body.category !== "EVENTS") return jsonResponse({ success: false, error: "La categoría seleccionada no es válida." }, 400);
          fields.push("category = ?"); values.push(body.category);
        }
        if (Object.prototype.hasOwnProperty.call(body, "sortOrder")) {
          const sortOrder = Number(body.sortOrder);
          if (!Number.isSafeInteger(sortOrder) || sortOrder < 0 || sortOrder > 1000000) return jsonResponse({ success: false, error: "El orden de la fotografía no es válido." }, 400);
          fields.push("sort_order = ?"); values.push(sortOrder);
        }
        if (Object.prototype.hasOwnProperty.call(body, "isActive")) {
          if (typeof body.isActive !== "boolean") return jsonResponse({ success: false, error: "La visibilidad debe ser verdadera o falsa." }, 400);
          if (body.isActive === false) {
            const previousMediaUsage = await buildMediaUsageMap(env);
            await env.DB.prepare("DELETE FROM gallery_images WHERE id = ?").bind(id).run();
            await cleanupReleasedMediaReferences(env, previousMediaUsage);
            return jsonResponse({ success: true, message: "La fotografía se retiró de la galería. Si ninguna otra sección la utiliza, su copia en la nube fue eliminada." });
          }
        }
        if (proposedImageUrl && !(await mediaReferenceStillExists(env, proposedImageUrl))) {
          return jsonResponse({ success: false, error: "La fotografía ya no está disponible. Vuelve a cargarla desde tu computador o celular." }, 409);
        }
        if (!fields.length) return jsonResponse({ success: false, error: "No se recibieron cambios para guardar." }, 400);
        const previousMediaUsage = Object.prototype.hasOwnProperty.call(body, "url")
          ? await buildMediaUsageMap(env)
          : null;
        values.push(id);
        await env.DB.prepare(`UPDATE gallery_images SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
        if (previousMediaUsage) await cleanupReleasedMediaReferences(env, previousMediaUsage);
        const updated = await env.DB.prepare(`
          SELECT id, image_url AS url, alt_text AS alt, category,
                 sort_order AS sortOrder, is_active AS isActive
          FROM gallery_images WHERE id = ? LIMIT 1
        `).bind(id).first<Record<string, unknown>>();
        return jsonResponse({ success: true, data: updated ? {
          ...updated, isActive: Number(updated.isActive) === 1, sortOrder: Number(updated.sortOrder)
        } : null });
      }

      // Administrative login
      // Administrative login
      if (path === "/api/auth/staff/login" && request.method === "POST") {
        if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32) {
          return jsonResponse({
            success: false,
            error: "La autenticación no está configurada."
          }, 503);
        }

        let body: unknown;

        try {
          body = await request.json();
        } catch {
          return jsonResponse({
            success: false,
            error: "La solicitud no contiene JSON válido."
          }, 400);
        }

        if (!body || typeof body !== "object" || Array.isArray(body)) {
          return jsonResponse({
            success: false,
            error: "Los datos de acceso no son válidos."
          }, 400);
        }

        const credentials = body as Record<string, unknown>;

        if (
          typeof credentials.email !== "string" ||
          typeof credentials.password !== "string"
        ) {
          return jsonResponse({
            success: false,
            error: "Debes proporcionar correo y contraseña."
          }, 400);
        }

        const email = credentials.email.trim().toLowerCase();
        const password = credentials.password;

        if (
          email.length > 254 ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
          password.length < 1 ||
          password.length > 128
        ) {
          return jsonResponse({
            success: false,
            error: "Correo o contraseña incorrectos."
          }, 401);
        }

        const admin = await env.DB.prepare(`
          SELECT
            id,
            email,
            password_hash,
            full_name,
            role,
            is_active,
            auth_version
          FROM admin_users
          WHERE email = ?
          LIMIT 1
        `).bind(email).first<{
          id: string;
          email: string;
          password_hash: string;
          full_name: string;
          role: string;
          is_active: number;
          auth_version: number;
        }>();

        // Verification with a dummy hash helps reduce email enumeration
        // through response timing when the account does not exist.
        const dummyHash =
          "pbkdf2_sha256$310000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

        if (!admin || admin.is_active !== 1) {
          console.log("AUTH_DIAG_LOGIN: rechazo=cuenta_no_encontrada_o_inactiva");
          await verifyPassword(password, dummyHash);

          return jsonResponse({
            success: false,
            error: "Correo o contraseña incorrectos."
          }, 401);
        }

        if (
          admin.role !== "SUPER_ADMIN" &&
          admin.role !== "MANAGER" &&
          admin.role !== "STAFF"
        ) {
          console.log("AUTH_DIAG_LOGIN: rechazo=rol_no_permitido");
          await verifyPassword(password, dummyHash);

          return jsonResponse({
            success: false,
            error: "Correo o contraseña incorrectos."
          }, 401);
        }

        const passwordValid = await verifyPassword(
          password,
          admin.password_hash
        );

        if (!passwordValid) {
          // Diagnostic metadata only: no credentials, hash contents, or tokens are logged.
          const diagNonce = request.headers.get("X-LDTA-Diag-Nonce") || "";
          const diagExpected = request.headers.get("X-LDTA-Diag-Fingerprint") || "";
          let diagPayloadMatch = "sin_marca";
          if (/^[0-9a-f]{32}$/.test(diagNonce) && /^[0-9a-f]{64}$/.test(diagExpected)) {
            const diagBytes = new TextEncoder().encode(`${diagNonce}:${password}`);
            const diagDigest = await crypto.subtle.digest("SHA-256", diagBytes);
            const diagActual = Array.from(new Uint8Array(diagDigest)).map(v => v.toString(16).padStart(2, "0")).join("");
            diagPayloadMatch = diagActual === diagExpected ? "coincide" : "no_coincide";
          }
          const diagHashBytes = new TextEncoder().encode(admin.password_hash);
          const diagHashDigest = await crypto.subtle.digest("SHA-256", diagHashBytes);
          const diagHashFingerprint = Array.from(new Uint8Array(diagHashDigest)).map(v => v.toString(16).padStart(2, "0")).join("").slice(0, 16);
          const diagHashParts = admin.password_hash.split("$");
          console.log("AUTH_DIAG_DETAIL " + JSON.stringify({
            payload: diagPayloadMatch,
            passwordChars: password.length,
            passwordUtf8Bytes: new TextEncoder().encode(password).length,
            hashChars: admin.password_hash.length,
            hashFingerprint: diagHashFingerprint,
            algorithm: diagHashParts[0] || "",
            iterations: diagHashParts[1] || "",
            saltChars: diagHashParts[2] ? diagHashParts[2].length : 0,
            digestChars: diagHashParts[3] ? diagHashParts[3].length : 0,
            accountActive: admin.is_active,
            accountRole: admin.role
          }));
          console.log("AUTH_DIAG_LOGIN: rechazo=hash_no_coincide_en_worker");
          return jsonResponse({
            success: false,
            error: "Correo o contraseña incorrectos."
          }, 401);
        }

        console.log("AUTH_DIAG_LOGIN: verificacion_aceptada; generando_sesion");
        const token = await signAuthToken({
          id: admin.id,
          email: admin.email,
          role: admin.role as AdminRole,
          authVersion: admin.auth_version
        }, env.AUTH_SECRET);

        return jsonResponse({
          success: true,
          data: {
            token,
            user: {
              id: admin.id,
              email: admin.email,
              name: admin.full_name,
              role: admin.role
            }
          }
        });
      }

      // Check whether the signed-in account already has an offline recovery code.
      if (path === "/api/auth/recovery-code/status" && request.method === "GET") {
        const admin = await getAdminForRequest(request, env);
        if (!admin) return jsonResponse({ success: false, error: "La sesión no es válida. Inicia sesión nuevamente." }, 401);
        const row = await env.DB.prepare(`
          SELECT recovery_code_hash IS NOT NULL AS configured
          FROM admin_users WHERE id = ? LIMIT 1
        `).bind(admin.id).first<{ configured: number }>();
        return jsonResponse({ success: true, data: { configured: row?.configured === 1 } });
      }

      // Create or rotate the one-time recovery code. The raw code is returned only once.
      if (path === "/api/auth/recovery-code/create" && request.method === "POST") {
        const admin = await getAdminForRequest(request, env);
        if (!admin) return jsonResponse({ success: false, error: "La sesión no es válida. Inicia sesión nuevamente." }, 401);
        let body: unknown;
        try { body = await request.json(); } catch { return jsonResponse({ success: false, error: "La solicitud no contiene JSON válido." }, 400); }
        const currentPassword = body && typeof body === "object" && !Array.isArray(body)
          ? (body as Record<string, unknown>).currentPassword : null;
        if (typeof currentPassword !== "string" || currentPassword.length < 1 || currentPassword.length > 128) {
          return jsonResponse({ success: false, error: "Escribe tu contraseña actual para crear el código." }, 400);
        }
        const account = await env.DB.prepare(`
          SELECT password_hash FROM admin_users WHERE id = ? AND is_active = 1 LIMIT 1
        `).bind(admin.id).first<{ password_hash: string }>();
        if (!account || !(await verifyPassword(currentPassword, account.password_hash))) {
          return jsonResponse({ success: false, error: "La contraseña actual no es correcta." }, 400);
        }
        const recoveryCode = createAccountRecoveryCode();
        const recoveryCodeHash = await hashPassword(recoveryCode);
        await env.DB.prepare(`
          UPDATE admin_users
          SET recovery_code_hash = ?, recovery_code_failures = 0, recovery_locked_until = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(recoveryCodeHash, admin.id).run();
        return jsonResponse({ success: true, data: { recoveryCode } });
      }

      // Change a password from inside the account. The auth version invalidates older sessions.
      if (path === "/api/auth/password/change" && request.method === "POST") {
        const admin = await getAdminForRequest(request, env);
        if (!admin) return jsonResponse({ success: false, error: "La sesión no es válida. Inicia sesión nuevamente." }, 401);
        let body: unknown;
        try { body = await request.json(); } catch { return jsonResponse({ success: false, error: "La solicitud no contiene JSON válido." }, 400); }
        const values = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
        const currentPassword = values.currentPassword;
        const newPassword = values.newPassword;
        if (typeof currentPassword !== "string" || currentPassword.length < 1 || currentPassword.length > 128) {
          return jsonResponse({ success: false, error: "Escribe tu contraseña actual." }, 400);
        }
        if (!validNewPassword(newPassword)) {
          return jsonResponse({ success: false, error: "La nueva contraseña debe tener entre 12 y 128 caracteres." }, 400);
        }
        if (newPassword === currentPassword) {
          return jsonResponse({ success: false, error: "La nueva contraseña debe ser diferente de la actual." }, 400);
        }
        const account = await env.DB.prepare(`
          SELECT password_hash, auth_version FROM admin_users WHERE id = ? AND is_active = 1 LIMIT 1
        `).bind(admin.id).first<{ password_hash: string; auth_version: number }>();
        if (!account || !(await verifyPassword(currentPassword, account.password_hash))) {
          return jsonResponse({ success: false, error: "La contraseña actual no es correcta." }, 400);
        }
        const passwordHash = await hashPassword(newPassword);
        const nextAuthVersion = account.auth_version + 1;
        const update = await env.DB.prepare(`
          UPDATE admin_users SET password_hash = ?, auth_version = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND auth_version = ?
        `).bind(passwordHash, nextAuthVersion, admin.id, account.auth_version).run();
        if (update.meta?.changes === 0) return jsonResponse({ success: false, error: "La cuenta cambió durante la operación. Inicia sesión e inténtalo nuevamente." }, 409);
        const token = await signAuthToken({ id: admin.id, email: admin.email, role: admin.role, authVersion: nextAuthVersion }, env.AUTH_SECRET || "");
        return jsonResponse({ success: true, data: { token } });
      }

      // Recover a forgotten password with the one-time offline recovery code.
      if (path === "/api/auth/password/recover" && request.method === "POST") {
        if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32) return jsonResponse({ success: false, error: "La autenticación no está configurada." }, 503);
        let body: unknown;
        try { body = await request.json(); } catch { return jsonResponse({ success: false, error: "La solicitud no contiene JSON válido." }, 400); }
        const values = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
        const email = typeof values.email === "string" ? values.email.trim().toLowerCase() : "";
        const recoveryCode = typeof values.recoveryCode === "string" ? values.recoveryCode.trim().toUpperCase() : "";
        const newPassword = values.newPassword;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || recoveryCode.length < 12 || recoveryCode.length > 128) {
          return jsonResponse({ success: false, error: "No se pudo validar el correo o el código de recuperación." }, 400);
        }
        if (!validNewPassword(newPassword)) {
          return jsonResponse({ success: false, error: "La nueva contraseña debe tener entre 12 y 128 caracteres." }, 400);
        }
        const account = await env.DB.prepare(`
          SELECT id, email, role, recovery_code_hash, recovery_code_failures, recovery_locked_until, auth_version
          FROM admin_users WHERE email = ? COLLATE NOCASE AND is_active = 1 LIMIT 1
        `).bind(email).first<{
          id: string; email: string; role: string; recovery_code_hash: string | null;
          recovery_code_failures: number; recovery_locked_until: string | null; auth_version: number;
        }>();
        const lockedUntil = account?.recovery_locked_until ? Date.parse(`${account.recovery_locked_until.replace(" ", "T")}Z`) : 0;
        if (account?.recovery_locked_until && Number.isFinite(lockedUntil) && lockedUntil > Date.now()) {
          return jsonResponse({ success: false, error: "Se bloquearon temporalmente los intentos. Espera 15 minutos y vuelve a intentarlo." }, 429);
        }
        if (!account || !account.recovery_code_hash || (account.role !== "SUPER_ADMIN" && account.role !== "MANAGER" && account.role !== "STAFF")) {
          const dummyRecoveryHash = "pbkdf2_sha256$310000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
          await verifyPassword(recoveryCode, dummyRecoveryHash);
          return jsonResponse({ success: false, error: "No se pudo validar el correo o el código. Si aún puedes entrar al panel, crea un nuevo código en Seguridad de la cuenta." }, 400);
        }
        const recoveryValid = await verifyPassword(recoveryCode, account.recovery_code_hash);
        if (!recoveryValid) {
          const failures = Math.min((account.recovery_code_failures || 0) + 1, 5);
          await env.DB.prepare(`
            UPDATE admin_users SET recovery_code_failures = ?,
              recovery_locked_until = CASE WHEN ? >= 5 THEN datetime('now', '+15 minutes') ELSE recovery_locked_until END
            WHERE id = ?
          `).bind(failures, failures, account.id).run();
          return jsonResponse({ success: false, error: "El correo o el código de recuperación no coincide. Revisa el código e inténtalo de nuevo." }, 400);
        }
        const passwordHash = await hashPassword(newPassword);
        const update = await env.DB.prepare(`
          UPDATE admin_users SET password_hash = ?, auth_version = auth_version + 1,
            recovery_code_hash = NULL, recovery_code_failures = 0, recovery_locked_until = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND recovery_code_hash = ? AND auth_version = ?
        `).bind(passwordHash, account.id, account.recovery_code_hash, account.auth_version).run();
        if (update.meta?.changes === 0) return jsonResponse({ success: false, error: "El código ya fue utilizado o la cuenta cambió. Solicita un nuevo código desde Seguridad de la cuenta si puedes iniciar sesión." }, 409);
        return jsonResponse({ success: true, data: { message: "La contraseña se actualizó. El código de recuperación usado quedó desactivado." } });
      }

      // Verify current administrative session
      if (path === "/api/auth/me" && request.method === "GET") {
        if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32) {
          return jsonResponse({
            success: false,
            error: "La autenticación no está configurada."
          }, 503);
        }

        const authorization = request.headers.get("Authorization") || "";
        const token = authorization.startsWith("Bearer ")
          ? authorization.slice(7).trim()
          : "";

        if (!token) {
          return jsonResponse({
            success: false,
            error: "Sesión no válida o vencida."
          }, 401);
        }

        const identity = await verifyAuthToken(token, env.AUTH_SECRET);

        if (!identity) {
          return jsonResponse({
            success: false,
            error: "Sesión no válida o vencida."
          }, 401);
        }

        const admin = await env.DB.prepare(`
          SELECT id, email, full_name, role, is_active, auth_version
          FROM admin_users
          WHERE id = ?
          LIMIT 1
        `).bind(identity.id).first<{
          id: string;
          email: string;
          full_name: string;
          role: string;
          is_active: number;
          auth_version: number;
        }>();

        if (
          !admin ||
          admin.is_active !== 1 ||
          admin.auth_version !== identity.authVersion ||
          (
            admin.role !== "SUPER_ADMIN" &&
            admin.role !== "MANAGER" &&
            admin.role !== "STAFF"
          )
        ) {
          return jsonResponse({
            success: false,
            error: "La cuenta administrativa no está activa."
          }, 401);
        }

        return jsonResponse({
          success: true,
          data: {
            user: {
              id: admin.id,
              email: admin.email,
              name: admin.full_name,
              role: admin.role
            }
          }
        });
      }
      // Administrative order list and detail. These routes expose customer and
      // delivery data only to authenticated administrators.
      if (path === "/api/admin/orders" && request.method === "GET") {
        const admin = await getAdminForRequest(request, env);
        if (!admin) {
          return jsonResponse({ success: false, error: "Debes iniciar sesión como administrador." }, 401);
        }

        const requestedPage = Number(url.searchParams.get("page") || 1);
        const requestedLimit = Number(url.searchParams.get("limit") || 20);
        const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
        const limit = Number.isSafeInteger(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : 20;
        const offset = (page - 1) * limit;
        const status = (url.searchParams.get("status") || "").trim().toUpperCase();
        const orderType = (url.searchParams.get("orderType") || "").trim().toUpperCase();
        const view = (url.searchParams.get("view") || "").trim().toLowerCase();
        const search = (url.searchParams.get("q") || "").trim().slice(0, 100);
        const allowedStatuses = new Set([
          "PENDING", "CONFIRMED", "PREPARING", "READY",
          "OUT_FOR_DELIVERY", "DELIVERED", "PICKED_UP", "CANCELLED"
        ]);
        if (view && view !== "kitchen" && view !== "history") {
          return jsonResponse({ success: false, error: "La vista de pedidos no es válida." }, 400);
        }

        const conditions: string[] = [];
        const values: (string | number | null)[] = [];
        if (view === "kitchen") {
          conditions.push("status IN ('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY')");
        } else if (view === "history") {
          conditions.push("status IN ('DELIVERED', 'PICKED_UP', 'CANCELLED')");
        }
        if (status) {
          if (!allowedStatuses.has(status)) {
            return jsonResponse({ success: false, error: "El filtro de estado no es válido." }, 400);
          }
          conditions.push("status = ?");
          values.push(status);
        }
        if (orderType) {
          if (orderType !== "DELIVERY" && orderType !== "PICKUP") {
            return jsonResponse({ success: false, error: "El filtro de modalidad no es válido." }, 400);
          }
          conditions.push("order_type = ?");
          values.push(orderType);
        }
        if (search) {
          conditions.push("(order_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)");
          const pattern = `%${search}%`;
          values.push(pattern, pattern, pattern);
        }

        const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
        const count = await env.DB.prepare(`
          SELECT COUNT(*) AS total FROM orders ${where}
        `).bind(...values).first<{ total: number }>();

        const orderSort = view === "kitchen"
          ? `ORDER BY CASE status WHEN 'PENDING' THEN 0 WHEN 'CONFIRMED' THEN 0 WHEN 'PREPARING' THEN 1 ELSE 2 END, created_at ASC`
          : view === "history"
            ? `ORDER BY created_at DESC`
            : `ORDER BY CASE status WHEN 'PENDING' THEN 0 WHEN 'CONFIRMED' THEN 1 ELSE 2 END, created_at DESC`;
        const rows = await env.DB.prepare(`
          SELECT id, order_number AS orderNumber,
                 customer_name AS customerName, customer_phone AS customerPhone,
                 customer_email AS customerEmail, order_type AS orderType,
                 status, item_quantity_total AS itemQuantityTotal,
                 (SELECT GROUP_CONCAT(CAST(oi.quantity AS TEXT) || ' × ' || oi.product_name_snapshot, ' · ')
                    FROM order_items oi WHERE oi.order_id = orders.id) AS itemsSummary,
                 subtotal_cop AS subtotal, delivery_fee_cop AS deliveryFee,
                 total_cop AS total, payment_method AS paymentMethod,
                 payment_status AS paymentStatus,
                 whatsapp_updates_consent AS whatsappUpdatesConsent,
                 address_line AS addressLine,
                 customer_notes AS customerNotes, neighborhood, city,
                 scheduled_for AS scheduledAt, created_at AS createdAt
          FROM orders
          ${where}
          ${orderSort}
          LIMIT ? OFFSET ?
        `).bind(...values, limit, offset).all<{
          id: string;
          orderNumber: string;
          customerName: string;
          customerPhone: string;
          customerEmail: string | null;
          orderType: string;
          status: string;
          itemQuantityTotal: number;
          itemsSummary: string | null;
          subtotal: number;
          deliveryFee: number;
          total: number;
          paymentMethod: string;
          paymentStatus: string;
          whatsappUpdatesConsent: number;
          addressLine: string | null;
          customerNotes: string | null;
          neighborhood: string | null;
          city: string | null;
          scheduledAt: string | null;
          createdAt: string;
        }>();

        const total = Number(count?.total ?? 0);
        return jsonResponse({
          success: true,
          data: rows.results,
          pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
        });
      }

      const adminOrderMatch = path.match(/^\/api\/admin\/orders\/([^/]+)$/);
      if (adminOrderMatch && request.method === "GET") {
        const admin = await getAdminForRequest(request, env);
        if (!admin) {
          return jsonResponse({ success: false, error: "Debes iniciar sesión como administrador." }, 401);
        }

        const orderId = decodeURIComponent(adminOrderMatch[1]);
        const order = await env.DB.prepare(`
          SELECT id, order_number AS orderNumber, customer_name AS customerName,
                 customer_phone AS customerPhone, customer_email AS customerEmail,
                 order_type AS orderType, status, address_line AS addressLine,
                 neighborhood, city, address_reference AS addressReference,
                 delivery_zone_name_snapshot AS deliveryZoneName,
                 item_quantity_total AS itemQuantityTotal,
                 subtotal_cop AS subtotal, delivery_fee_cop AS deliveryFee,
                 discount_cop AS discount, total_cop AS total,
                 payment_method AS paymentMethod,
                 payment_method_detail AS paymentMethodDetail,
                 payment_status AS paymentStatus,
                 scheduled_for AS scheduledAt, customer_notes AS customerNotes,
                 admin_notes AS adminNotes,
                 delivery_person_name AS deliveryPersonName,
                 whatsapp_updates_consent AS whatsappUpdatesConsent,
                 whatsapp_updates_consent_at AS whatsappUpdatesConsentAt,
                 created_at AS createdAt, updated_at AS updatedAt
          FROM orders WHERE id = ? LIMIT 1
        `).bind(orderId).first<{
          id: string;
          orderNumber: string;
          customerName: string;
          customerPhone: string;
          customerEmail: string | null;
          orderType: string;
          status: string;
          addressLine: string | null;
          neighborhood: string | null;
          city: string | null;
          addressReference: string | null;
          deliveryZoneName: string | null;
          itemQuantityTotal: number;
          subtotal: number;
          deliveryFee: number;
          discount: number;
          total: number;
          paymentMethod: string;
          paymentMethodDetail: string | null;
          paymentStatus: string;
          scheduledAt: string | null;
          customerNotes: string | null;
          adminNotes: string | null;
          deliveryPersonName: string | null;
          whatsappUpdatesConsent: number;
          whatsappUpdatesConsentAt: string | null;
          createdAt: string;
          updatedAt: string;
        }>();

        if (!order) {
          return jsonResponse({ success: false, error: "No se encontró el pedido." }, 404);
        }

        const itemRows = await env.DB.prepare(`
          SELECT id, product_name_snapshot AS name, unit_price_cop AS unitPrice,
                 quantity, line_total_cop AS subtotal,
                 options_snapshot_json AS optionsJson, item_notes AS comment
          FROM order_items WHERE order_id = ? ORDER BY rowid ASC
        `).bind(orderId).all<{
          id: string;
          name: string;
          unitPrice: number;
          quantity: number;
          subtotal: number;
          optionsJson: string;
          comment: string | null;
        }>();

        const items = itemRows.results.map(item => {
          let options: unknown[] = [];
          try {
            const parsed: unknown = JSON.parse(item.optionsJson || "[]");
            if (Array.isArray(parsed)) options = parsed;
          } catch {
            options = [];
          }
          return { ...item, options };
        });

        return jsonResponse({ success: true, data: { ...order, tax: 0, items } });
      }

      if (adminOrderMatch && request.method === "PATCH") {
        const admin = await getAdminForRequest(request, env);
        if (!admin) {
          return jsonResponse({ success: false, error: "Debes iniciar sesión como administrador." }, 401);
        }

        const orderId = decodeURIComponent(adminOrderMatch[1]);
        let body: Record<string, unknown>;
        try {
          body = await request.json() as Record<string, unknown>;
        } catch {
          return jsonResponse({ success: false, error: "El contenido enviado no es válido." }, 400);
        }

        const current = await env.DB.prepare(
          "SELECT status, order_type AS orderType FROM orders WHERE id = ? LIMIT 1"
        ).bind(orderId).first<{ status: string; orderType: string }>();
        if (!current) {
          return jsonResponse({ success: false, error: "No se encontró el pedido." }, 404);
        }

        const updates: string[] = [];
        const updateValues: (string | number | null)[] = [];
        const details: Record<string, unknown> = {};

        if (Object.prototype.hasOwnProperty.call(body, "status")) {
          const nextStatus = typeof body.status === "string" ? body.status.trim().toUpperCase() : "";
          const transitions: Record<string, string[]> = {
            // One action accepts the order and starts kitchen preparation.
            PENDING: ["PREPARING", "CANCELLED"],
            // Older orders already marked CONFIRMED remain operable.
            CONFIRMED: ["PREPARING", "CANCELLED"],
            // Erika marks the order ready once. Delivery moves directly to
            // OUT_FOR_DELIVERY; pickup moves to READY (ready to collect).
            PREPARING: current.orderType === "DELIVERY"
              ? ["OUT_FOR_DELIVERY", "CANCELLED"]
              : ["READY", "CANCELLED"],
            // Once prepared, the order stays visible in the Ready view until
            // the customer collects it or the delivery is confirmed complete.
            READY: current.orderType === "DELIVERY"
              ? ["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"]
              : ["PICKED_UP", "CANCELLED"],
            OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
            DELIVERED: [], PICKED_UP: [], CANCELLED: []
          };
          if (!(transitions[current.status] || []).includes(nextStatus)) {
            return jsonResponse({ success: false, error: "Ese cambio de estado no está permitido. Revisa el estado actual del pedido." }, 409);
          }
          updates.push("status = ?");
          updateValues.push(nextStatus);
          details.status = { from: current.status, to: nextStatus };
        }

        if (Object.prototype.hasOwnProperty.call(body, "paymentStatus")) {
          const paymentStatus = typeof body.paymentStatus === "string" ? body.paymentStatus.trim().toUpperCase() : "";
          if (!["PENDING", "PAID", "FAILED", "REFUNDED"].includes(paymentStatus)) {
            return jsonResponse({ success: false, error: "El estado del pago no es válido." }, 400);
          }
          updates.push("payment_status = ?");
          updateValues.push(paymentStatus);
          details.paymentStatus = paymentStatus;
        }

        if (Object.prototype.hasOwnProperty.call(body, "adminNotes")) {
          if (body.adminNotes !== null && typeof body.adminNotes !== "string") {
            return jsonResponse({ success: false, error: "Las notas internas deben ser texto." }, 400);
          }
          const notes = typeof body.adminNotes === "string" ? body.adminNotes.trim().slice(0, 1500) : null;
          updates.push("admin_notes = ?");
          updateValues.push(notes);
          details.adminNotesUpdated = true;
        }

        if (Object.prototype.hasOwnProperty.call(body, "deliveryPersonName")) {
          if (body.deliveryPersonName !== null && typeof body.deliveryPersonName !== "string") {
            return jsonResponse({ success: false, error: "El nombre del domiciliario debe ser texto." }, 400);
          }
          const deliveryPerson = typeof body.deliveryPersonName === "string"
            ? body.deliveryPersonName.trim().slice(0, 120)
            : null;
          updates.push("delivery_person_name = ?");
          updateValues.push(deliveryPerson);
          details.deliveryPersonUpdated = true;
        }

        if (!updates.length) {
          return jsonResponse({ success: false, error: "No hay cambios para guardar." }, 400);
        }

        updates.push("updated_at = CURRENT_TIMESTAMP");
        await env.DB.prepare(`UPDATE orders SET ${updates.join(", ")} WHERE id = ?`)
          .bind(...updateValues, orderId)
          .run();

        await env.DB.prepare(`
          INSERT INTO audit_logs (id, admin_user_id, action, entity_type, entity_id, details_json)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          crypto.randomUUID(), admin.id, "ORDER_UPDATED", "ORDER", orderId, JSON.stringify(details)
        ).run();

        return jsonResponse({ success: true, message: "El pedido se actualizó correctamente." });
      }

      // Private event requests list - SUPER_ADMIN and MANAGER only
      if (path === "/api/admin/events" && request.method === "GET") {
        const admin = await getAdminForRequest(request, env);

        if (!admin) {
          return jsonResponse({
            success: false,
            error: "Debes iniciar sesión para consultar las solicitudes."
          }, 401);
        }

        if (admin.role !== "SUPER_ADMIN" && admin.role !== "MANAGER") {
          return jsonResponse({
            success: false,
            error: "No tienes permisos para consultar eventos."
          }, 403);
        }

        const page = Math.max(
          1,
          Number.parseInt(url.searchParams.get("page") || "1", 10) || 1
        );

        const limit = Math.min(
          100,
          Math.max(
            1,
            Number.parseInt(url.searchParams.get("limit") || "20", 10) || 20
          )
        );

        const conditions: string[] = [];
        const params: (string | number | null)[] = [];

        const allowedStatuses = [
          "PENDING",
          "IN_REVIEW",
          "QUOTED",
          "ACCEPTED",
          "REJECTED",
          "CANCELLED"
        ];

        const status = url.searchParams.get("status");

        if (status && status !== "ALL") {
          if (!allowedStatuses.includes(status)) {
            return jsonResponse({
              success: false,
              error: "El filtro de estado no es válido."
            }, 400);
          }

          conditions.push("status = ?");
          params.push(status);
        }

        const search = (url.searchParams.get("search") || "").trim();

        if (search.length > 0) {
          if (search.length > 100) {
            return jsonResponse({
              success: false,
              error: "La búsqueda supera los 100 caracteres."
            }, 400);
          }

          conditions.push(
            "(request_number LIKE ? OR contact_name LIKE ? OR contact_phone LIKE ?)"
          );

          const term = `%${search}%`;
          params.push(term, term, term);
        }

        const where = conditions.length > 0
          ? "WHERE " + conditions.join(" AND ")
          : "";

        const count = await env.DB.prepare(`
          SELECT COUNT(*) AS total
          FROM event_requests
          ${where}
        `).bind(...params).first<{ total: number }>();

        const result = await env.DB.prepare(`
          SELECT
            id,
            request_number AS requestNumber,
            contact_name AS contactName,
            contact_phone AS contactPhone,
            contact_email AS contactEmail,
            event_type AS eventType,
            event_date AS eventDate,
            guest_count AS guestCount,
            city,
            neighborhood,
            venue_address AS venueAddress,
            budget_cop AS budgetCop,
            requested_food AS requestedFood,
            event_details AS eventDetails,
            status,
            whatsapp_consent AS whatsappConsent,
            whatsapp_consent_at AS whatsappConsentAt,
            quoted_total_cop AS quotedTotalCop,
            delivery_fee_cop AS deliveryFeeCop,
            deposit_required_cop AS depositRequiredCop,
            deposit_paid_cop AS depositPaidCop,
            operational_status AS operationalStatus,
            planned_delivery_at AS plannedDeliveryAt,
            delivery_responsible AS deliveryResponsible,
            delivery_notes AS deliveryNotes,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM event_requests
          ${where}
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?
        `).bind(...params, limit, (page - 1) * limit)
          .all<Record<string, unknown>>();

        const total = Number(count?.total ?? 0);
        const financialSummary = await env.DB.prepare(`
          SELECT
            COUNT(CASE WHEN status NOT IN ('REJECTED', 'CANCELLED') THEN 1 END) AS activeEvents,
            COUNT(CASE WHEN operational_status IN ('CONFIRMED', 'PREPARING', 'READY', 'DISPATCHED') THEN 1 END) AS inProgressEvents,
            COALESCE(SUM(CASE WHEN status NOT IN ('REJECTED', 'CANCELLED') AND quoted_total_cop IS NOT NULL
              THEN quoted_total_cop + COALESCE(delivery_fee_cop, 0) ELSE 0 END), 0) AS quotedTotalCop,
            COALESCE(SUM(CASE WHEN status NOT IN ('REJECTED', 'CANCELLED') THEN deposit_paid_cop ELSE 0 END), 0) AS receivedCop,
            COALESCE(SUM(CASE WHEN status NOT IN ('REJECTED', 'CANCELLED') AND quoted_total_cop IS NOT NULL
              THEN MAX(0, quoted_total_cop + COALESCE(delivery_fee_cop, 0) - deposit_paid_cop) ELSE 0 END), 0) AS outstandingCop
          FROM event_requests
        `).first<Record<string, number>>();

        return jsonResponse({
          success: true,
          data: result.results,
          financialSummary: {
            activeEvents: Number(financialSummary?.activeEvents ?? 0),
            inProgressEvents: Number(financialSummary?.inProgressEvents ?? 0),
            quotedTotalCop: Number(financialSummary?.quotedTotalCop ?? 0),
            receivedCop: Number(financialSummary?.receivedCop ?? 0),
            outstandingCop: Number(financialSummary?.outstandingCop ?? 0)
          },
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        });
      }
      // Record an auditable event payment. Accumulated payments remain mirrored
      // in event_requests.deposit_paid_cop for quotations and WhatsApp messages.
      if (path.startsWith("/api/admin/events/") && path.endsWith("/payments") && request.method === "POST") {
        const admin = await getAdminForRequest(request, env);
        if (!admin) return jsonResponse({ success: false, error: "Debes iniciar sesión." }, 401);
        if (admin.role !== "SUPER_ADMIN" && admin.role !== "MANAGER") {
          return jsonResponse({ success: false, error: "No tienes permisos para registrar pagos." }, 403);
        }

        const paymentPathMatch = path.match(/^\/api\/admin\/events\/([^/]+)\/payments$/);
        if (!paymentPathMatch) return jsonResponse({ success: false, error: "Ruta de pago no válida." }, 400);
        let eventId: string;
        try { eventId = decodeURIComponent(paymentPathMatch[1]); }
        catch { return jsonResponse({ success: false, error: "Identificador de evento no válido." }, 400); }

        let parsedBody: unknown;
        try { parsedBody = await request.json(); }
        catch { return jsonResponse({ success: false, error: "El contenido enviado no es JSON válido." }, 400); }
        if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
          return jsonResponse({ success: false, error: "Los datos del abono no son válidos." }, 400);
        }
        const body = parsedBody as Record<string, unknown>;
        const amount = Number(body.amountCop);
        const method = typeof body.paymentMethod === "string" ? body.paymentMethod : "";
        const paidAt = typeof body.paidAt === "string" ? body.paidAt.trim() : "";
        const reference = typeof body.reference === "string" ? body.reference.trim() : "";
        const notes = typeof body.notes === "string" ? body.notes.trim() : "";
        const allowedPaymentMethods = ["CASH", "TRANSFER", "NEQUI", "BRE_B", "OTHER"];

        if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1000000000) {
          return jsonResponse({ success: false, error: "El valor del abono debe ser un número entero mayor que cero." }, 400);
        }
        if (!allowedPaymentMethods.includes(method)) {
          return jsonResponse({ success: false, error: "Selecciona un medio de pago válido." }, 400);
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(paidAt) || Number.isNaN(Date.parse(`${paidAt}T12:00:00-05:00`))) {
          return jsonResponse({ success: false, error: "La fecha del abono no es válida." }, 400);
        }
        if (reference.length > 120 || notes.length > 1000) {
          return jsonResponse({ success: false, error: "La referencia o las notas superan el máximo permitido." }, 400);
        }

        const existingEvent = await env.DB.prepare(`
          SELECT id, quoted_total_cop, delivery_fee_cop, deposit_paid_cop
          FROM event_requests WHERE id = ? LIMIT 1
        `).bind(eventId).first<{
          id: string; quoted_total_cop: number | null; delivery_fee_cop: number; deposit_paid_cop: number;
        }>();
        if (!existingEvent) return jsonResponse({ success: false, error: "No se encontró la solicitud de evento." }, 404);
        if (existingEvent.quoted_total_cop === null) {
          return jsonResponse({ success: false, error: "Primero guarda la cotización del evento antes de registrar abonos." }, 400);
        }
        const eventTotal = Number(existingEvent.quoted_total_cop ?? 0) + Number(existingEvent.delivery_fee_cop ?? 0);
        const receivedSoFar = Number(existingEvent.deposit_paid_cop ?? 0);
        const outstanding = Math.max(0, eventTotal - receivedSoFar);
        if (amount > outstanding) {
          return jsonResponse({ success: false, error: `El abono supera el saldo pendiente. El máximo que puedes registrar es ${outstanding} COP.` }, 400);
        }

        const paymentId = crypto.randomUUID();
        await env.DB.batch([
          env.DB.prepare(`
            INSERT INTO event_payments (id, event_request_id, amount_cop, payment_method, paid_at, reference, notes, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(paymentId, eventId, amount, method, paidAt, reference || null, notes || null, admin.id),
          env.DB.prepare(`
            UPDATE event_requests SET deposit_paid_cop = deposit_paid_cop + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
          `).bind(amount, eventId),
          env.DB.prepare(`
            INSERT INTO audit_logs (id, admin_user_id, action, entity_type, entity_id, details_json)
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(crypto.randomUUID(), admin.id, "EVENT_PAYMENT_RECORDED", "EVENT", eventId,
            JSON.stringify({ paymentId, amountCop: amount, paymentMethod: method, paidAt, reference: reference || null }))
        ]);

        return jsonResponse({ success: true, data: {
          id: paymentId, eventRequestId: eventId, amountCop: amount, paymentMethod: method,
          paidAt, reference: reference || null, notes: notes || null,
          totalReceivedCop: receivedSoFar + amount, outstandingCop: Math.max(0, eventTotal - receivedSoFar - amount)
        } }, 201);
      }
      // Private event detail and quotation management
      if (
        path.startsWith("/api/admin/events/") &&
        (request.method === "GET" || request.method === "PATCH")
      ) {
        const admin = await getAdminForRequest(request, env);

        if (!admin) {
          return jsonResponse({
            success: false,
            error: "Debes iniciar sesión."
          }, 401);
        }

        if (admin.role !== "SUPER_ADMIN" && admin.role !== "MANAGER") {
          return jsonResponse({
            success: false,
            error: "No tienes permisos para gestionar eventos."
          }, 403);
        }

        const rawId = path.slice("/api/admin/events/".length);
        let eventId: string;

        try {
          eventId = decodeURIComponent(rawId);
        } catch {
          return jsonResponse({
            success: false,
            error: "Identificador de solicitud no válido."
          }, 400);
        }

        if (!eventId || eventId.length > 100 || eventId.includes("/")) {
          return jsonResponse({
            success: false,
            error: "Identificador de solicitud no válido."
          }, 400);
        }

        if (request.method === "PATCH") {
          let parsedBody: unknown;

          try {
            parsedBody = await request.json();
          } catch {
            return jsonResponse({
              success: false,
              error: "El contenido enviado no es JSON válido."
            }, 400);
          }

          if (
            !parsedBody ||
            typeof parsedBody !== "object" ||
            Array.isArray(parsedBody)
          ) {
            return jsonResponse({
              success: false,
              error: "Los datos enviados no son válidos."
            }, 400);
          }

          const body = parsedBody as Record<string, unknown>;

          const hasStatus = Object.prototype.hasOwnProperty.call(body, "status");
          const hasTotal = Object.prototype.hasOwnProperty.call(body, "quotedTotalCop");
          const hasDeliveryFee = Object.prototype.hasOwnProperty.call(body, "deliveryFeeCop");
          const hasDepositRequired = Object.prototype.hasOwnProperty.call(body, "depositRequiredCop");
          const hasDepositPaid = Object.prototype.hasOwnProperty.call(body, "depositPaidCop");
          const hasOperationalStatus = Object.prototype.hasOwnProperty.call(body, "operationalStatus");
          const hasPlannedDeliveryAt = Object.prototype.hasOwnProperty.call(body, "plannedDeliveryAt");
          const hasDeliveryResponsible = Object.prototype.hasOwnProperty.call(body, "deliveryResponsible");
          const hasDeliveryNotes = Object.prototype.hasOwnProperty.call(body, "deliveryNotes");
          const hasQuoteDetails = Object.prototype.hasOwnProperty.call(body, "quoteDetails");
          const hasAdminNotes = Object.prototype.hasOwnProperty.call(body, "adminNotes");

          if (hasDepositPaid) {
            return jsonResponse({ success: false, error: "Los abonos deben registrarse en el Historial de pagos para conservar cada movimiento." }, 400);
          }

          if (!hasStatus && !hasTotal && !hasDeliveryFee && !hasDepositRequired && !hasQuoteDetails && !hasAdminNotes && !hasOperationalStatus && !hasPlannedDeliveryAt && !hasDeliveryResponsible && !hasDeliveryNotes) {
            return jsonResponse({
              success: false,
              error: "No hay cambios para guardar."
            }, 400);
          }

          const allowedStatuses = [
            "PENDING",
            "IN_REVIEW",
            "QUOTED",
            "ACCEPTED",
            "REJECTED",
            "CANCELLED"
          ];

          const allowedOperationalStatuses = ["PENDING", "CONFIRMED", "PREPARING", "READY", "DISPATCHED", "DELIVERED", "COMPLETED", "CANCELLED"];
          const nextStatus: string | null = hasStatus ? body.status as string : null;
          const nextOperationalStatus: string | null = hasOperationalStatus ? body.operationalStatus as string : null;
          if (hasOperationalStatus && (typeof nextOperationalStatus !== "string" || !allowedOperationalStatuses.includes(nextOperationalStatus))) {
            return jsonResponse({ success: false, error: "El estado operativo del evento no es válido." }, 400);
          }

          if (
            hasStatus &&
            (typeof nextStatus !== "string" ||
              !allowedStatuses.includes(nextStatus))
          ) {
            return jsonResponse({
              success: false,
              error: "El estado seleccionado no es válido."
            }, 400);
          }

          let quotedTotal: number | null = null;

          if (hasTotal && body.quotedTotalCop !== null) {
            quotedTotal = Number(body.quotedTotalCop);

            if (
              !Number.isSafeInteger(quotedTotal) ||
              quotedTotal < 0 ||
              quotedTotal > 1000000000
            ) {
              return jsonResponse({
                success: false,
                error: "El valor de la cotización no es válido."
              }, 400);
            }
          }

          const readCopValue = (value: unknown, fieldLabel: string): number => {
            const amount = Number(value ?? 0);
            if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1000000000) {
              throw new Error(`El valor de ${fieldLabel} debe ser un número entero entre 0 y 1.000.000.000 COP.`);
            }
            return amount;
          };

          let deliveryFee = 0;
          let depositRequired = 0;
          let depositPaid = 0;

          try {
            if (hasDeliveryFee) deliveryFee = readCopValue(body.deliveryFeeCop, "domicilio del evento");
            if (hasDepositRequired) depositRequired = readCopValue(body.depositRequiredCop, "anticipo solicitado");
            if (hasDepositPaid) depositPaid = readCopValue(body.depositPaidCop, "anticipo recibido");
          } catch (validationError) {
            return jsonResponse({
              success: false,
              error: validationError instanceof Error ? validationError.message : "Los valores financieros no son válidos."
            }, 400);
          }

          let quoteDetails: string | null = null;

          if (hasQuoteDetails) {
            if (body.quoteDetails !== null && typeof body.quoteDetails !== "string") {
              return jsonResponse({
                success: false,
                error: "Los detalles de la cotización no son válidos."
              }, 400);
            }

            quoteDetails = typeof body.quoteDetails === "string"
              ? body.quoteDetails.trim()
              : null;

            if (quoteDetails && quoteDetails.length > 4000) {
              return jsonResponse({
                success: false,
                error: "Los detalles de la cotización superan 4.000 caracteres."
              }, 400);
            }
          }

          let adminNotes: string | null = null;

          if (hasAdminNotes) {
            if (body.adminNotes !== null && typeof body.adminNotes !== "string") {
              return jsonResponse({
                success: false,
                error: "Las notas administrativas no son válidas."
              }, 400);
            }

            adminNotes = typeof body.adminNotes === "string"
              ? body.adminNotes.trim()
              : null;

            if (adminNotes && adminNotes.length > 2000) {
              return jsonResponse({
                success: false,
                error: "Las notas internas superan 2.000 caracteres."
              }, 400);
            }
          }

          const readOptionalText = (value: unknown, fieldLabel: string, maxLength: number): string | null => {
            if (value === null || value === undefined) return null;
            if (typeof value !== "string") throw new Error(`El campo ${fieldLabel} no es válido.`);
            const normalized = value.trim();
            if (normalized.length > maxLength) throw new Error(`El campo ${fieldLabel} supera ${maxLength} caracteres.`);
            return normalized || null;
          };
          let plannedDeliveryAt: string | null = null;
          let deliveryResponsible: string | null = null;
          let deliveryNotes: string | null = null;
          try {
            if (hasPlannedDeliveryAt) {
              plannedDeliveryAt = readOptionalText(body.plannedDeliveryAt, "fecha y hora de entrega", 40);
              if (plannedDeliveryAt && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(plannedDeliveryAt)) {
                throw new Error("La fecha y hora de entrega debe tener el formato AAAA-MM-DDTHH:mm.");
              }
            }
            if (hasDeliveryResponsible) deliveryResponsible = readOptionalText(body.deliveryResponsible, "responsable de entrega", 120);
            if (hasDeliveryNotes) deliveryNotes = readOptionalText(body.deliveryNotes, "indicaciones de entrega", 2000);
          } catch (trackingError) {
            return jsonResponse({ success: false, error: trackingError instanceof Error ? trackingError.message : "Los datos de entrega no son válidos." }, 400);
          }

          const existing = await env.DB.prepare(`
            SELECT id, quoted_total_cop, delivery_fee_cop, deposit_required_cop, deposit_paid_cop, operational_status
            FROM event_requests WHERE id = ? LIMIT 1
          `).bind(eventId).first<{
            id: string;
            quoted_total_cop: number | null;
            delivery_fee_cop: number;
            deposit_required_cop: number;
            deposit_paid_cop: number;
            operational_status: string;
          }>();

          if (!existing) {
            return jsonResponse({
              success: false,
              error: "No se encontró la solicitud de evento."
            }, 404);
          }

          const nextQuotedTotal = hasTotal
            ? (quotedTotal ?? 0)
            : Number(existing.quoted_total_cop ?? 0);
          const nextDeliveryFee = hasDeliveryFee
            ? deliveryFee
            : Number(existing.delivery_fee_cop ?? 0);
          const nextDepositRequired = hasDepositRequired
            ? depositRequired
            : Number(existing.deposit_required_cop ?? 0);
          const nextDepositPaid = hasDepositPaid
            ? depositPaid
            : Number(existing.deposit_paid_cop ?? 0);
          const eventTotal = nextQuotedTotal + nextDeliveryFee;

          if (nextDepositRequired > eventTotal) {
            return jsonResponse({
              success: false,
              error: "El anticipo solicitado no puede superar el total del evento."
            }, 400);
          }

          if (nextDepositPaid > eventTotal) {
            return jsonResponse({
              success: false,
              error: "El anticipo recibido no puede superar el total del evento."
            }, 400);
          }

          const update = await env.DB.prepare(`
            UPDATE event_requests
            SET
              status = CASE WHEN ? = 1 THEN ? ELSE status END,
              quoted_total_cop = CASE WHEN ? = 1 THEN ? ELSE quoted_total_cop END,
              delivery_fee_cop = CASE WHEN ? = 1 THEN ? ELSE delivery_fee_cop END,
              deposit_required_cop = CASE WHEN ? = 1 THEN ? ELSE deposit_required_cop END,
              quote_details = CASE WHEN ? = 1 THEN ? ELSE quote_details END,
              admin_notes = CASE WHEN ? = 1 THEN ? ELSE admin_notes END,
              operational_status = CASE WHEN ? = 1 THEN ? ELSE operational_status END,
              planned_delivery_at = CASE WHEN ? = 1 THEN ? ELSE planned_delivery_at END,
              delivery_responsible = CASE WHEN ? = 1 THEN ? ELSE delivery_responsible END,
              delivery_notes = CASE WHEN ? = 1 THEN ? ELSE delivery_notes END,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(
            hasStatus ? 1 : 0,
            nextStatus,
            hasTotal ? 1 : 0,
            quotedTotal,
            hasDeliveryFee ? 1 : 0,
            deliveryFee,
            hasDepositRequired ? 1 : 0,
            depositRequired,
            hasQuoteDetails ? 1 : 0,
            quoteDetails,
            hasAdminNotes ? 1 : 0,
            adminNotes,
            hasOperationalStatus ? 1 : 0,
            nextOperationalStatus,
            hasPlannedDeliveryAt ? 1 : 0,
            plannedDeliveryAt,
            hasDeliveryResponsible ? 1 : 0,
            deliveryResponsible,
            hasDeliveryNotes ? 1 : 0,
            deliveryNotes,
            eventId
          ).run();

          if (!update.success) {
            throw new Error("No fue posible guardar la cotización y sus valores.");
          }

          if (hasOperationalStatus && nextOperationalStatus !== existing.operational_status) {
            await env.DB.prepare(`
              INSERT INTO event_status_history (id, event_request_id, from_status, to_status, changed_by, notes)
              VALUES (?, ?, ?, ?, ?, ?)
            `).bind(
              crypto.randomUUID(), eventId, existing.operational_status, nextOperationalStatus,
              admin.id, hasDeliveryNotes ? deliveryNotes : null
            ).run();
          }

          await env.DB.prepare(`
            INSERT INTO audit_logs (id, admin_user_id, action, entity_type, entity_id, details_json)
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(
            crypto.randomUUID(),
            admin.id,
            "EVENT_UPDATED",
            "EVENT",
            eventId,
            JSON.stringify({
              status: hasStatus ? nextStatus : undefined,
              quotedTotalCop: hasTotal ? quotedTotal : undefined,
              deliveryFeeCop: hasDeliveryFee ? deliveryFee : undefined,
              depositRequiredCop: hasDepositRequired ? depositRequired : undefined,
              operationalStatus: hasOperationalStatus ? nextOperationalStatus : undefined,
              plannedDeliveryAt: hasPlannedDeliveryAt ? plannedDeliveryAt : undefined,
              deliveryResponsible: hasDeliveryResponsible ? deliveryResponsible : undefined,
              deliveryNotesChanged: hasDeliveryNotes,
              quoteDetailsChanged: hasQuoteDetails,
              adminNotesChanged: hasAdminNotes
            })
          ).run();
        }

        const eventRequest = await env.DB.prepare(`
          SELECT
            id,
            request_number AS requestNumber,
            contact_name AS contactName,
            contact_phone AS contactPhone,
            contact_email AS contactEmail,
            event_type AS eventType,
            event_date AS eventDate,
            guest_count AS guestCount,
            city,
            neighborhood,
            venue_address AS venueAddress,
            budget_cop AS budgetCop,
            requested_food AS requestedFood,
            event_details AS eventDetails,
            status,
            whatsapp_consent AS whatsappConsent,
            whatsapp_consent_at AS whatsappConsentAt,
            quoted_total_cop AS quotedTotalCop,
            delivery_fee_cop AS deliveryFeeCop,
            deposit_required_cop AS depositRequiredCop,
            deposit_paid_cop AS depositPaidCop,
            operational_status AS operationalStatus,
            planned_delivery_at AS plannedDeliveryAt,
            delivery_responsible AS deliveryResponsible,
            delivery_notes AS deliveryNotes,
            quote_details AS quoteDetails,
            admin_notes AS adminNotes,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM event_requests
          WHERE id = ?
          LIMIT 1
        `).bind(eventId).first<Record<string, unknown>>();

        if (!eventRequest) {
          return jsonResponse({
            success: false,
            error: "No se encontró la solicitud de evento."
          }, 404);
        }

        // Resolve the event-transport tariff on the server from the request's
        // municipality and sector. This keeps the quotation independent from
        // a second client-side fetch and guarantees that a sector override
        // (for example El Poblado) wins over the municipality-wide tariff.
        const eventCity = typeof eventRequest.city === "string" ? eventRequest.city : "";
        const eventSector = typeof eventRequest.neighborhood === "string" ? eventRequest.neighborhood : "";
        const normalizeEventMunicipality = (value: string): string => value
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          // Public event forms may store labels as part of the value, e.g.
          // "Municipio: Medellín, Antioquia.". Strip the label before matching.
          .replace(/^\s*(?:municipio|ciudad)\s*:\s*/i, "")
          .replace(/[,.():\-]+/g, " ")
          .replace(/\b(antioquia|colombia)\b/gi, " ")
          .replace(/\s+/g, " ")
          .trim()
          .toLocaleLowerCase("es");
        const normalizeEventSector = (value: string): string => value
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          // Also tolerate sector labels and trailing punctuation in requests.
          .replace(/^\s*(?:sector|barrio|comuna)\s*:\s*/i, "")
          .replace(/[,.():]+/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .toLocaleLowerCase("es");
        const eventCityKey = normalizeEventMunicipality(eventCity);
        const eventSectorKeys = new Set(
          eventSector.split(/[;,|]/).map(normalizeEventSector).filter(Boolean)
        );
        const eventZonesResult = await env.DB.prepare(`
          SELECT id, name, city, neighborhoods_json, fee_cop
          FROM event_delivery_zones
          WHERE is_active = 1
          ORDER BY updated_at DESC, created_at DESC
        `).all<{
          id: string;
          name: string;
          city: string;
          neighborhoods_json: string;
          fee_cop: number;
        }>();
        const matchingCityZones = eventZonesResult.results.filter(zone =>
          normalizeEventMunicipality(zone.city) === eventCityKey
        );
        let suggestedDeliveryZone: Record<string, unknown> | null = null;
        if (eventCityKey && matchingCityZones.length > 0) {
          const specificZone = matchingCityZones.find(zone => {
            let areas: unknown = [];
            try { areas = JSON.parse(zone.neighborhoods_json || "[]"); } catch { areas = []; }
            const fullEventSectorKey = normalizeEventSector(eventSector);
            return Array.isArray(areas) && areas.some(area => {
              if (typeof area !== "string") return false;
              const areaKey = normalizeEventSector(area);
              return Boolean(areaKey) && (
                eventSectorKeys.has(areaKey) ||
                fullEventSectorKey === areaKey ||
                fullEventSectorKey.startsWith(`${areaKey} `) ||
                fullEventSectorKey.endsWith(` ${areaKey}`) ||
                fullEventSectorKey.includes(` ${areaKey} `)
              );
            });
          });
          const generalZone = matchingCityZones.find(zone => {
            let areas: unknown = [];
            try { areas = JSON.parse(zone.neighborhoods_json || "[]"); } catch { areas = []; }
            return Array.isArray(areas) && areas.length === 0;
          });
          const selectedZone = specificZone || generalZone;
          if (selectedZone) {
            let areas: unknown = [];
            try { areas = JSON.parse(selectedZone.neighborhoods_json || "[]"); } catch { areas = []; }
            suggestedDeliveryZone = {
              id: selectedZone.id,
              name: selectedZone.name,
              city: selectedZone.city,
              neighborhoods: Array.isArray(areas) ? areas.filter((area): area is string => typeof area === "string") : [],
              feeCop: Number(selectedZone.fee_cop),
              isActive: true
            };
          }
        }

        const paymentHistory = await env.DB.prepare(`
          SELECT id, amount_cop AS amountCop, payment_method AS paymentMethod,
                 paid_at AS paidAt, reference, notes, created_by AS createdBy, created_at AS createdAt
          FROM event_payments
          WHERE event_request_id = ?
          ORDER BY paid_at DESC, created_at DESC
        `).bind(eventId).all<Record<string, unknown>>();
        const operationalHistory = await env.DB.prepare(`
          SELECT id, from_status AS fromStatus, to_status AS toStatus,
                 changed_by AS changedBy, notes, created_at AS createdAt
          FROM event_status_history
          WHERE event_request_id = ?
          ORDER BY created_at DESC
        `).bind(eventId).all<Record<string, unknown>>();

        return jsonResponse({
          success: true,
          data: {
            ...eventRequest,
            suggestedDeliveryZone,
            paymentHistory: paymentHistory.results,
            operationalHistory: operationalHistory.results
          }
        });
      }
      // Protected dashboard statistics
      if (path === "/api/dashboard/stats" && request.method === "GET") {
        if (!(await isAuthenticatedAdmin(request, env))) {
          return jsonResponse({
            success: false,
            error: "No tienes autorización para consultar estas estadísticas."
          }, 401);
        }

        const metrics = await env.DB.prepare(`
          SELECT
            (SELECT COUNT(*) FROM orders
              WHERE status <> 'CANCELLED'
              AND date(created_at, '-5 hours') = date('now', '-5 hours')
            ) AS ordersToday,

            (SELECT COALESCE(SUM(total_cop), 0) FROM orders
              WHERE status <> 'CANCELLED'
              AND payment_status = 'PAID'
              AND date(created_at, '-5 hours') = date('now', '-5 hours')
            ) AS revenueToday,

            (SELECT COUNT(*) FROM orders
              WHERE status <> 'CANCELLED'
              AND date(created_at, '-5 hours') >= date('now', '-5 hours', '-6 days')
            ) AS ordersThisWeek,

            (SELECT COALESCE(SUM(total_cop), 0) FROM orders
              WHERE status <> 'CANCELLED'
              AND payment_status = 'PAID'
              AND date(created_at, '-5 hours') >= date('now', '-5 hours', '-6 days')
            ) AS revenueThisWeek,

            (SELECT COUNT(*) FROM orders
              WHERE status <> 'CANCELLED'
              AND date(created_at, '-5 hours') >= date('now', '-5 hours', 'start of month')
            ) AS ordersThisMonth,

            (SELECT COALESCE(SUM(total_cop), 0) FROM orders
              WHERE status <> 'CANCELLED'
              AND payment_status = 'PAID'
              AND date(created_at, '-5 hours') >= date('now', '-5 hours', 'start of month')
            ) AS revenueThisMonth,

            (SELECT COUNT(*) FROM orders
              WHERE status <> 'CANCELLED'
            ) AS totalOrders,

            (SELECT COALESCE(SUM(total_cop), 0) FROM orders
              WHERE status <> 'CANCELLED'
              AND payment_status = 'PAID'
            ) AS totalRevenue,

            (SELECT COUNT(*) FROM products
              WHERE is_available = 1
            ) AS activeItems,

            (SELECT COUNT(DISTINCT customer_phone) FROM orders
              WHERE customer_phone <> ''
            ) AS totalCustomers,

            (SELECT COUNT(*) FROM event_requests
              WHERE status IN ('PENDING', 'IN_REVIEW')
            ) AS pendingEvents
        `).first<Record<string, number>>();

        const recentOrders = await env.DB.prepare(`
          SELECT
            id,
            order_number AS orderNumber,
            status,
            total_cop AS total,
            order_type AS orderType,
            created_at AS createdAt,
            customer_name AS customerName
          FROM orders
          ORDER BY created_at DESC
          LIMIT 8
        `).all<{
          id: string;
          orderNumber: string;
          status: string;
          total: number;
          orderType: string;
          createdAt: string;
          customerName: string;
        }>();

        const topItems = await env.DB.prepare(`
          SELECT
            COALESCE(MIN(product_id), product_name_snapshot) AS menuItemId,
            product_name_snapshot AS name,
            SUM(quantity) AS totalQuantity
          FROM order_items
          GROUP BY product_name_snapshot
          ORDER BY totalQuantity DESC
          LIMIT 5
        `).all<{
          menuItemId: string;
          name: string;
          totalQuantity: number;
        }>();

        return jsonResponse({
          success: true,
          data: {
            metrics: {
              ordersToday: Number(metrics?.ordersToday ?? 0),
              revenueToday: Number(metrics?.revenueToday ?? 0),
              ordersThisWeek: Number(metrics?.ordersThisWeek ?? 0),
              revenueThisWeek: Number(metrics?.revenueThisWeek ?? 0),
              ordersThisMonth: Number(metrics?.ordersThisMonth ?? 0),
              revenueThisMonth: Number(metrics?.revenueThisMonth ?? 0),
              totalOrders: Number(metrics?.totalOrders ?? 0),
              totalRevenue: Number(metrics?.totalRevenue ?? 0),
              activeItems: Number(metrics?.activeItems ?? 0),
              totalCustomers: Number(metrics?.totalCustomers ?? 0),
              pendingReservations: 0,
              pendingEvents: Number(metrics?.pendingEvents ?? 0),
              pendingReviews: 0
            },
            recentOrders: recentOrders.results.map(order => ({
              id: order.id,
              orderNumber: order.orderNumber,
              status: order.status,
              total: Number(order.total),
              orderType: order.orderType,
              createdAt: order.createdAt,
              customer: { name: order.customerName }
            })),
            topItems: topItems.results.map(item => ({
              menuItemId: item.menuItemId,
              name: item.name,
              totalQuantity: Number(item.totalQuantity)
            }))
          }
        });
      }

      // Protected dashboard analytics
      if (path === "/api/dashboard/analytics" && request.method === "GET") {
        if (!(await isAuthenticatedAdmin(request, env))) {
          return jsonResponse({
            success: false,
            error: "No tienes autorización para consultar estas estadísticas."
          }, 401);
        }

        const requestedDays = Number.parseInt(
          url.searchParams.get("days") || "30",
          10
        );

        const days = [7, 14, 30, 60, 90].includes(requestedDays)
          ? requestedDays
          : 30;

        const dateModifier = `-${days - 1} days`;

        const dailyStats = await env.DB.prepare(`
          SELECT
            date(created_at, '-5 hours') AS date,
            COUNT(*) AS orders,
            COALESCE(SUM(
              CASE WHEN payment_status = 'PAID' THEN total_cop ELSE 0 END
            ), 0) AS revenue
          FROM orders
          WHERE status <> 'CANCELLED'
            AND date(created_at, '-5 hours') >= date('now', '-5 hours', ?)
          GROUP BY date(created_at, '-5 hours')
          ORDER BY date ASC
        `).bind(dateModifier).all<{
          date: string;
          orders: number;
          revenue: number;
        }>();

        const orderTypes = await env.DB.prepare(`
          SELECT order_type AS type, COUNT(*) AS count
          FROM orders
          WHERE status <> 'CANCELLED'
            AND date(created_at, '-5 hours') >= date('now', '-5 hours', ?)
          GROUP BY order_type
        `).bind(dateModifier).all<{ type: string; count: number }>();

        const orderStatuses = await env.DB.prepare(`
          SELECT status, COUNT(*) AS count
          FROM orders
          WHERE date(created_at, '-5 hours') >= date('now', '-5 hours', ?)
          GROUP BY status
        `).bind(dateModifier).all<{ status: string; count: number }>();

        const hourly = await env.DB.prepare(`
          SELECT
            CAST(strftime('%H', created_at, '-5 hours') AS INTEGER) AS hour,
            COUNT(*) AS orders
          FROM orders
          WHERE status <> 'CANCELLED'
            AND date(created_at, '-5 hours') >= date('now', '-5 hours', ?)
          GROUP BY hour
          ORDER BY hour ASC
        `).bind(dateModifier).all<{ hour: number; orders: number }>();

        const categoryRevenue = await env.DB.prepare(`
          SELECT
            c.name AS name,
            COALESCE(SUM(oi.line_total_cop), 0) AS revenue,
            COUNT(DISTINCT o.id) AS orders
          FROM order_items oi
          INNER JOIN orders o ON o.id = oi.order_id
          INNER JOIN products p ON p.id = oi.product_id
          INNER JOIN categories c ON c.id = p.category_id
          WHERE o.status <> 'CANCELLED'
            AND date(o.created_at, '-5 hours') >= date('now', '-5 hours', ?)
          GROUP BY c.id, c.name
          ORDER BY revenue DESC
        `).bind(dateModifier).all<{
          name: string;
          revenue: number;
          orders: number;
        }>();

        return jsonResponse({
          success: true,
          data: {
            dailyStats: dailyStats.results.map(item => ({
              date: item.date,
              orders: Number(item.orders),
              revenue: Number(item.revenue)
            })),
            orderTypeDistribution: orderTypes.results.map(item => ({
              type: item.type,
              count: Number(item.count)
            })),
            orderStatusDistribution: orderStatuses.results.map(item => ({
              status: item.status,
              count: Number(item.count)
            })),
            hourlyDistribution: hourly.results.map(item => ({
              hour: Number(item.hour),
              orders: Number(item.orders)
            })),
            categoryRevenue: categoryRevenue.results.map(item => ({
              name: item.name,
              revenue: Number(item.revenue),
              orders: Number(item.orders)
            }))
          }
        });
      }
      // Health check
      if (path === "/api/health" && request.method === "GET") {
        const result = await env.DB
          .prepare("SELECT 1 AS ok")
          .first<{ ok: number }>();

        return jsonResponse({
          success: true,
          service: "Las Delicias de la Tía API",
          database: result?.ok === 1 ? "connected" : "unknown",
          timestamp: new Date().toISOString()
        });
      }

      // Public payment methods: expose only enabled customer-facing payment instructions.
      if (path === "/api/payment-methods" && request.method === "GET") {
        const result = await env.DB.prepare(`
          SELECT method_code AS methodCode, display_name AS displayName,
                 account_holder AS accountHolder, account_type AS accountType,
                 account_number AS accountNumber, bank_name AS bankName,
                 payment_key AS paymentKey
          FROM payment_methods
          WHERE is_enabled = 1
          ORDER BY sort_order ASC
        `).all<{
          methodCode: string;
          displayName: string;
          accountHolder: string;
          accountType: string | null;
          accountNumber: string | null;
          bankName: string | null;
          paymentKey: string | null;
        }>();

        return jsonResponse({ success: true, data: result.results });
      }

      // Protected payment configuration for the SUPER_ADMIN.
      if (path === "/api/settings/payment" && request.method === "GET") {
        const admin = await getAdminForRequest(request, env);
        if (!admin || admin.role !== "SUPER_ADMIN") {
          return jsonResponse({ success: false, error: "No tienes autorización para consultar los medios de pago." }, 403);
        }

        const result = await env.DB.prepare(`
          SELECT method_code AS methodCode, display_name AS displayName,
                 account_holder AS accountHolder, account_type AS accountType,
                 account_number AS accountNumber, bank_name AS bankName,
                 payment_key AS paymentKey, is_enabled AS isEnabled
          FROM payment_methods
          ORDER BY sort_order ASC
        `).all<{
          methodCode: string;
          displayName: string;
          accountHolder: string;
          accountType: string | null;
          accountNumber: string | null;
          bankName: string | null;
          paymentKey: string | null;
          isEnabled: number;
        }>();

        return jsonResponse({
          success: true,
          data: {
            methods: result.results.map(method => ({
              ...method,
              isEnabled: method.isEnabled === 1
            }))
          }
        });
      }

      if (path === "/api/settings/payment" && request.method === "PUT") {
        const admin = await getAdminForRequest(request, env);
        if (!admin || admin.role !== "SUPER_ADMIN") {
          return jsonResponse({ success: false, error: "No tienes autorización para modificar los medios de pago." }, 403);
        }

        const parsedBody: unknown = await request.json().catch(() => null);
        if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
          return jsonResponse({ success: false, error: "Los datos enviados no son válidos." }, 400);
        }

        const body = parsedBody as Record<string, unknown>;
        if (!Array.isArray(body.methods) || body.methods.length !== 3) {
          return jsonResponse({ success: false, error: "Debes enviar la configuración de Bancolombia, Nequi y Llave Bre-B." }, 400);
        }

        const allowed = new Set(["BANCOLOMBIA", "NEQUI", "BREB"]);
        const seen = new Set<string>();
        const displayNames: Record<string, string> = {
          BANCOLOMBIA: "Bancolombia",
          NEQUI: "Nequi",
          BREB: "Llave Bre-B"
        };

        const statements: D1PreparedStatement[] = [];

        for (const rawMethod of body.methods) {
          if (!rawMethod || typeof rawMethod !== "object" || Array.isArray(rawMethod)) {
            return jsonResponse({ success: false, error: "Hay un medio de pago con datos inválidos." }, 400);
          }

          const method = rawMethod as Record<string, unknown>;
          const code = typeof method.methodCode === "string" ? method.methodCode : "";

          if (!allowed.has(code) || seen.has(code)) {
            return jsonResponse({ success: false, error: "Hay un medio de pago duplicado o no permitido." }, 400);
          }
          seen.add(code);

          if (typeof method.isEnabled !== "boolean") {
            return jsonResponse({ success: false, error: "El estado de cada medio debe ser verdadero o falso." }, 400);
          }

          const readText = (value: unknown, maxLength: number): string | null => {
            if (value === null || value === undefined) return null;
            if (typeof value !== "string") return null;
            const trimmed = value.trim();
            return trimmed ? trimmed.slice(0, maxLength) : null;
          };

          const holder = readText(method.accountHolder, 120);
          const accountType = readText(method.accountType, 30);
          const accountNumber = readText(method.accountNumber, 80);
          const bankName = readText(method.bankName, 100);
          const paymentKey = readText(method.paymentKey, 120);

          if (
            (method.accountHolder !== undefined && method.accountHolder !== null && typeof method.accountHolder !== "string") ||
            (method.accountType !== undefined && method.accountType !== null && typeof method.accountType !== "string") ||
            (method.accountNumber !== undefined && method.accountNumber !== null && typeof method.accountNumber !== "string") ||
            (method.bankName !== undefined && method.bankName !== null && typeof method.bankName !== "string") ||
            (method.paymentKey !== undefined && method.paymentKey !== null && typeof method.paymentKey !== "string")
          ) {
            return jsonResponse({ success: false, error: "Los datos de una cuenta deben ser texto válido." }, 400);
          }

          if (method.isEnabled && !holder) {
            return jsonResponse({ success: false, error: `Indica el titular de ${displayNames[code]}.` }, 400);
          }

          if (method.isEnabled && code === "BANCOLOMBIA" && (!accountType || !accountNumber)) {
            return jsonResponse({ success: false, error: "Para activar Bancolombia debes indicar el tipo y número de cuenta." }, 400);
          }

          if (method.isEnabled && code === "NEQUI" && !accountNumber) {
            return jsonResponse({ success: false, error: "Para activar Nequi debes indicar el número celular receptor." }, 400);
          }

          if (method.isEnabled && code === "BREB" && !paymentKey) {
            return jsonResponse({ success: false, error: "Para activar Llave Bre-B debes indicar la llave receptora." }, 400);
          }

          statements.push(env.DB.prepare(`
            UPDATE payment_methods
            SET account_holder = ?, account_type = ?, account_number = ?,
                bank_name = ?, payment_key = ?, is_enabled = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE method_code = ?
          `).bind(
            holder || "",
            accountType,
            accountNumber,
            bankName,
            paymentKey,
            method.isEnabled ? 1 : 0,
            code
          ));
        }

        if (seen.size !== 3) {
          return jsonResponse({ success: false, error: "La configuración debe incluir los tres medios de pago." }, 400);
        }

        await env.DB.batch(statements);

        return jsonResponse({
          success: true,
          message: "Los medios de pago se actualizaron correctamente."
        });
      }
      // Public social links used by the storefront footer.
      if (path === "/api/social-links" && request.method === "GET") {
        const result = await env.DB.prepare(`
          SELECT id, label, url, sort_order AS sortOrder
          FROM social_links
          WHERE is_enabled = 1 AND url <> ''
          ORDER BY sort_order ASC
        `).all<{
          id: string;
          label: string;
          url: string;
          sortOrder: number;
        }>();

        return jsonResponse({ success: true, data: result.results });
      }

      // Protected social links configuration for SUPER_ADMIN and MANAGER.
      if (
        path === "/api/settings/social-links" &&
        (request.method === "GET" || request.method === "PUT")
      ) {
        const admin = await getAdminForRequest(request, env);
        if (!admin || (admin.role !== "SUPER_ADMIN" && admin.role !== "MANAGER")) {
          return jsonResponse({ success: false, error: "No tienes autorización para administrar los enlaces." }, 403);
        }

        if (request.method === "GET") {
          const result = await env.DB.prepare(`
            SELECT id, label, url, is_enabled AS isEnabled, sort_order AS sortOrder
            FROM social_links
            ORDER BY sort_order ASC
          `).all<{
            id: string;
            label: string;
            url: string;
            isEnabled: number;
            sortOrder: number;
          }>();

          return jsonResponse({
            success: true,
            data: {
              links: result.results.map(link => ({
                ...link,
                isEnabled: link.isEnabled === 1
              }))
            }
          });
        }

        const parsedBody: unknown = await request.json().catch(() => null);
        if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
          return jsonResponse({ success: false, error: "Los datos enviados no son válidos." }, 400);
        }

        const body = parsedBody as Record<string, unknown>;
        if (!Array.isArray(body.links) || body.links.length !== 6) {
          return jsonResponse({ success: false, error: "Debes configurar los cuatro enlaces principales y los dos enlaces adicionales." }, 400);
        }

        const fixedLabels: Record<string, string> = {
          facebook: "Facebook",
          instagram: "Instagram",
          tiktok: "TikTok",
          website: "Página web"
        };
        const allowedIds = ["facebook", "instagram", "tiktok", "website", "custom_1", "custom_2"];
        const seen = new Set<string>();
        const statements: D1PreparedStatement[] = [];

        for (const rawLink of body.links) {
          if (!rawLink || typeof rawLink !== "object" || Array.isArray(rawLink)) {
            return jsonResponse({ success: false, error: "Hay un enlace con datos inválidos." }, 400);
          }

          const link = rawLink as Record<string, unknown>;
          const id = typeof link.id === "string" ? link.id : "";
          if (!allowedIds.includes(id) || seen.has(id)) {
            return jsonResponse({ success: false, error: "Hay un enlace duplicado o no permitido." }, 400);
          }
          seen.add(id);

          if (typeof link.isEnabled !== "boolean") {
            return jsonResponse({ success: false, error: "El estado de cada enlace debe ser verdadero o falso." }, 400);
          }

          const urlValue = typeof link.url === "string" ? link.url.trim() : "";
          if (link.url !== undefined && typeof link.url !== "string") {
            return jsonResponse({ success: false, error: "La dirección de un enlace debe ser texto." }, 400);
          }
          if (urlValue.length > 500) {
            return jsonResponse({ success: false, error: "Cada dirección puede tener máximo 500 caracteres." }, 400);
          }
          if (urlValue) {
            try {
              const parsedUrl = new URL(urlValue);
              if (parsedUrl.protocol !== "https:" || !parsedUrl.hostname || parsedUrl.username || parsedUrl.password) {
                return jsonResponse({ success: false, error: "Usa una dirección web segura que comience por https://." }, 400);
              }
            } catch {
              return jsonResponse({ success: false, error: "Una de las direcciones web no es válida." }, 400);
            }
          }

          const isCustom = id === "custom_1" || id === "custom_2";
          const labelValue = isCustom
            ? (typeof link.label === "string" ? link.label.trim() : "")
            : fixedLabels[id];
          const defaultCustomLabel = id === "custom_1" ? "Enlace adicional 1" : "Enlace adicional 2";
          const label = isCustom ? (labelValue || defaultCustomLabel) : fixedLabels[id];

          if (isCustom && label.length > 60) {
            return jsonResponse({ success: false, error: "El nombre de cada enlace adicional puede tener máximo 60 caracteres." }, 400);
          }
          if (link.isEnabled && !urlValue) {
            return jsonResponse({ success: false, error: `Agrega la dirección de ${label} o desactiva el enlace.` }, 400);
          }
          if (isCustom && urlValue && !labelValue) {
            return jsonResponse({ success: false, error: "Escribe el nombre de cada enlace adicional." }, 400);
          }

          statements.push(env.DB.prepare(`
            UPDATE social_links
            SET label = ?, url = ?, is_enabled = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(label, urlValue, link.isEnabled ? 1 : 0, id));
        }

        if (seen.size !== allowedIds.length) {
          return jsonResponse({ success: false, error: "Debes enviar exactamente los seis espacios de enlaces." }, 400);
        }

        await env.DB.batch(statements);
        return jsonResponse({
          success: true,
          message: "Los enlaces se guardaron correctamente. Actualiza la tienda para ver los cambios."
        });
      }

      // Contenido editable de la tienda: GET público, PUT solo para administradores autorizados.
      if (path === "/api/settings/storefront-content" && request.method === "GET") {
        const row = await env.DB.prepare("SELECT storefront_content_json FROM site_settings WHERE id = 'default' LIMIT 1").first<{ storefront_content_json: string | null }>();
        if (!row) return jsonResponse({ success: false, error: "No se encontró la configuración de la tienda." }, 404);
        return jsonResponse({ success: true, data: readStorefrontContent(row.storefront_content_json) });
      }

      if (path === "/api/settings/storefront-content" && request.method === "PUT") {
        const admin = await getAdminForRequest(request, env);
        if (!admin || (admin.role !== "SUPER_ADMIN" && admin.role !== "MANAGER")) {
          return jsonResponse({ success: false, error: "No tienes autorización para administrar el contenido de la tienda." }, 403);
        }
        const parsedBody: unknown = await request.json().catch(() => null);
        if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
          return jsonResponse({ success: false, error: "Los datos enviados no son válidos." }, 400);
        }
        const submitted = (parsedBody as Record<string, unknown>).content;
        if (!submitted || typeof submitted !== "object" || Array.isArray(submitted)) {
          return jsonResponse({ success: false, error: "No se recibieron los textos de la tienda." }, 400);
        }
        const row = await env.DB.prepare("SELECT storefront_content_json FROM site_settings WHERE id = 'default' LIMIT 1").first<{ storefront_content_json: string | null }>();
        if (!row) return jsonResponse({ success: false, error: "No se encontró la configuración de la tienda." }, 404);
        const content = readStorefrontContent(row.storefront_content_json);
        const incoming = submitted as Record<string, unknown>;
        let savedDesignTokens: Record<string, string> | null = null;
        for (const [key, fallback] of Object.entries(DEFAULT_STOREFRONT_CONTENT)) {
          if (!Object.prototype.hasOwnProperty.call(incoming, key)) continue;
          const value = incoming[key];
          if (typeof fallback === "boolean") {
            if (typeof value !== "boolean") return jsonResponse({ success: false, error: `La opción ${key} debe ser booleana.` }, 400);
            content[key] = value;
          } else {
            if (typeof value !== "string") return jsonResponse({ success: false, error: `El campo ${key} debe contener texto.` }, 400);
            const clean = value.trim();
            const maxLength = key === "businessActivity" ? 120 : key === "designTokensJson" ? 1200 : key === "pageBuilderJson" ? 32000 : 600;
            if (clean.length > maxLength) return jsonResponse({ success: false, error: `El campo ${key} supera los ${maxLength} caracteres.` }, 400);
            if (key === "homeSectionOrder") {
              const allowedSections = ["hero", "catalog", "events", "features", "closing"];
              const submittedOrder = clean.split(",");
              if (
                submittedOrder.length !== allowedSections.length ||
                new Set(submittedOrder).size !== allowedSections.length ||
                submittedOrder.some((section) => !allowedSections.includes(section))
              ) {
                return jsonResponse({ success: false, error: "El orden de la portada no es válido." }, 400);
              }
            }
            if (key === "pageBuilderJson") {
              let parsedSections: unknown;
              try { parsedSections = clean ? JSON.parse(clean) : []; }
              catch { return jsonResponse({ success: false, error: "La estructura de secciones no contiene un JSON válido." }, 400); }
              if (!Array.isArray(parsedSections) || parsedSections.length > 10) {
                return jsonResponse({ success: false, error: "Puedes configurar hasta 10 secciones adicionales en la portada." }, 400);
              }
              const allowedTypes = ["announcement", "text", "imageText", "features", "cta"];
              const seenIds = new Set<string>();
              const cleanSections: Array<Record<string, unknown>> = [];
              const textLimits: Record<string, number> = {
                eyebrow: 90, title: 140, description: 700, imageUrl: 1800, imageAlt: 180,
                buttonLabel: 70, buttonUrl: 500,
                feature1Title: 90, feature1Description: 220,
                feature2Title: 90, feature2Description: 220,
                feature3Title: 90, feature3Description: 220,
              };
              for (const item of parsedSections) {
                if (!item || typeof item !== "object" || Array.isArray(item)) {
                  return jsonResponse({ success: false, error: "Una de las secciones tiene un formato incorrecto." }, 400);
                }
                const section = item as Record<string, unknown>;
                if (typeof section.id !== "string" || !/^[a-zA-Z0-9_-]{1,48}$/.test(section.id) || seenIds.has(section.id)) {
                  return jsonResponse({ success: false, error: "Cada sección debe tener un identificador único válido." }, 400);
                }
                if (typeof section.type !== "string" || !allowedTypes.includes(section.type)) {
                  return jsonResponse({ success: false, error: "El tipo de una sección no está permitido." }, 400);
                }
                if (typeof section.visible !== "boolean") {
                  return jsonResponse({ success: false, error: "La visibilidad de cada sección debe ser verdadera o falsa." }, 400);
                }
                const normalized: Record<string, unknown> = { id: section.id, type: section.type, visible: section.visible };
                for (const [field, limit] of Object.entries(textLimits)) {
                  const value = section[field] === undefined ? "" : section[field];
                  if (typeof value !== "string" || value.length > limit) {
                    return jsonResponse({ success: false, error: `El campo ${field} de una sección no es válido o supera ${limit} caracteres.` }, 400);
                  }
                  normalized[field] = value.trim();
                }
                const imageUrl = String(normalized.imageUrl || "");
                if (imageUrl && !(imageUrl.startsWith("/") && !imageUrl.startsWith("//")) && !/^https:\/\//i.test(imageUrl)) {
                  return jsonResponse({ success: false, error: "La imagen debe usar una ruta del sitio o una dirección HTTPS segura." }, 400);
                }
                if (section.visible === true && imageUrl && !(await mediaReferenceStillExists(env, imageUrl))) {
                  return jsonResponse({ success: false, error: "La fotografía del bloque ya no está disponible. Vuelve a cargarla desde tu computador o celular." }, 409);
                }
                const buttonUrl = String(normalized.buttonUrl || "");
                if (buttonUrl && !(buttonUrl.startsWith("/") && !buttonUrl.startsWith("//")) && !/^https:\/\//i.test(buttonUrl) && !/^mailto:/i.test(buttonUrl) && !/^tel:/i.test(buttonUrl) && !buttonUrl.startsWith("#")) {
                  return jsonResponse({ success: false, error: "El enlace del botón no es válido. Usa una ruta interna, HTTPS, correo o teléfono." }, 400);
                }
                seenIds.add(section.id);
                cleanSections.push(normalized);
              }
              content[key] = JSON.stringify(cleanSections);
              continue;
            }
            if (key === "designTokensJson" && clean === "") {
              content[key] = "";
              continue;
            }
            if (key === "designTokensJson") {
              let parsedTokens: unknown;
              try { parsedTokens = JSON.parse(clean); } catch { return jsonResponse({ success: false, error: "La configuración visual no contiene un JSON válido." }, 400); }
              if (!parsedTokens || typeof parsedTokens !== "object" || Array.isArray(parsedTokens)) {
                return jsonResponse({ success: false, error: "La configuración visual no tiene el formato esperado." }, 400);
              }
              const tokens = parsedTokens as Record<string, unknown>;
              const colorKeys = ["primary", "secondary", "accent", "background", "surface", "text", "muted", "border"];
              for (const colorKey of colorKeys) {
                if (typeof tokens[colorKey] !== "string" || !/^#[0-9a-fA-F]{6}$/.test(tokens[colorKey] as string)) {
                  return jsonResponse({ success: false, error: `El color visual ${colorKey} no es válido.` }, 400);
                }
              }
              if (!(["inter", "system", "georgia"] as unknown[]).includes(tokens.fontFamily)) {
                return jsonResponse({ success: false, error: "La tipografía seleccionada no es válida." }, 400);
              }
              if (!(["compact", "comfortable", "rounded"] as unknown[]).includes(tokens.cardRadius)) {
                return jsonResponse({ success: false, error: "El redondeo de tarjetas no es válido." }, 400);
              }
              if (!(["standard", "wide", "extra-wide"] as unknown[]).includes(tokens.contentWidth)) {
                return jsonResponse({ success: false, error: "El ancho de contenido no es válido." }, 400);
              }
              if (!(["none", "soft", "elevated"] as unknown[]).includes(tokens.shadow)) {
                return jsonResponse({ success: false, error: "El estilo de sombra no es válido." }, 400);
              }
              savedDesignTokens = Object.fromEntries([
                ...colorKeys.map((colorKey) => [colorKey, String(tokens[colorKey]).toLowerCase()]),
                ["fontFamily", String(tokens.fontFamily)],
                ["cardRadius", String(tokens.cardRadius)],
                ["contentWidth", String(tokens.contentWidth)],
                ["shadow", String(tokens.shadow)],
              ]);
              content[key] = JSON.stringify(savedDesignTokens);
              continue;
            }
            content[key] = clean;
          }
        }
        const previousMediaUsage = Object.prototype.hasOwnProperty.call(incoming, "pageBuilderJson")
          ? await buildMediaUsageMap(env)
          : null;
        if (savedDesignTokens) {
          await env.DB.prepare("UPDATE site_settings SET storefront_content_json = ?, primary_color = ?, secondary_color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 'default'")
            .bind(JSON.stringify(content), savedDesignTokens.primary, savedDesignTokens.secondary).run();
        } else {
          await env.DB.prepare("UPDATE site_settings SET storefront_content_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 'default'").bind(JSON.stringify(content)).run();
        }
        if (previousMediaUsage) await cleanupReleasedMediaReferences(env, previousMediaUsage);
        return jsonResponse({ success: true, message: "El contenido y la configuración visual de la tienda se guardaron correctamente.", data: content });
      }

      // Restauración protegida de la plantilla original y recuperación de la personalización anterior.
      // Esta operación solo modifica configuración de presentación; nunca toca pedidos, clientes,
      // catálogo, inventario, pagos, cotizaciones, usuarios ni zonas de entrega.
      if (path === "/api/settings/presentation/restore-status" && request.method === "GET") {
        const admin = await getAdminForRequest(request, env);
        if (!admin || admin.role !== "SUPER_ADMIN") {
          return jsonResponse({ success: false, error: "Solo el superadministrador puede consultar la restauración de plantilla." }, 403);
        }
        const backup = await env.DB.prepare(`
          SELECT id, created_at
          FROM audit_logs
          WHERE action = 'PRESENTATION_BACKUP_BEFORE_TEMPLATE_RESTORE'
            AND entity_type = 'SITE_PRESENTATION'
          ORDER BY created_at DESC
          LIMIT 1
        `).first<{ id: string; created_at: string }>();
        return jsonResponse({
          success: true,
          data: {
            hasPreviousPersonalization: Boolean(backup),
            backupCreatedAt: backup?.created_at || null,
          },
        });
      }

      if (path === "/api/settings/presentation/restore-original" && request.method === "POST") {
        const admin = await getAdminForRequest(request, env);
        if (!admin || admin.role !== "SUPER_ADMIN") {
          return jsonResponse({ success: false, error: "Solo el superadministrador puede restaurar la plantilla original." }, 403);
        }
        const body: unknown = await request.json().catch(() => null);
        if (!body || typeof body !== "object" || Array.isArray(body)
          || (body as Record<string, unknown>).confirmation !== "RESTAURAR ORIGINAL") {
          return jsonResponse({ success: false, error: "Escribe RESTAURAR ORIGINAL para confirmar la operación." }, 400);
        }

        const current = await env.DB.prepare(`
          SELECT business_name, site_title, tagline_primary, tagline_secondary,
                 logo_key, logo_url, favicon_key, favicon_url,
                 primary_color, secondary_color, text_color,
                 homepage_featured_images_json, storefront_content_json
          FROM site_settings
          WHERE id = 'default'
          LIMIT 1
        `).first<Record<string, unknown>>();
        if (!current) return jsonResponse({ success: false, error: "No se encontró la configuración de la tienda." }, 404);

        const backupPayload = JSON.stringify({
          version: 1,
          savedAt: new Date().toISOString(),
          settings: current,
        });
        if (backupPayload.length > 250000) {
          return jsonResponse({ success: false, error: "La personalización actual supera el tamaño permitido para el respaldo automático." }, 413);
        }

        const originalContent: Record<string, string | boolean> = {
          ...DEFAULT_STOREFRONT_CONTENT,
          designTokensJson: JSON.stringify(ORIGINAL_TEMPLATE_DESIGN_TOKENS),
          pageBuilderJson: ORIGINAL_TEMPLATE_PAGE_BUILDER_JSON,
        };
        const restoredContentJson = JSON.stringify(originalContent);
        const backupId = crypto.randomUUID();
        const restoreAuditId = crypto.randomUUID();
        const previousMediaUsage = await buildMediaUsageMap(env);

        await env.DB.batch([
          env.DB.prepare(`
            INSERT INTO audit_logs (id, admin_user_id, action, entity_type, entity_id, details_json)
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(
            backupId, admin.id, "PRESENTATION_BACKUP_BEFORE_TEMPLATE_RESTORE",
            "SITE_PRESENTATION", "default", backupPayload
          ),
          env.DB.prepare(`
            UPDATE site_settings
            SET business_name = ?,
                site_title = ?,
                tagline_primary = ?,
                tagline_secondary = ?,
                logo_key = ?,
                logo_url = ?,
                favicon_key = NULL,
                favicon_url = NULL,
                primary_color = ?,
                secondary_color = ?,
                text_color = ?,
                homepage_featured_images_json = ?,
                storefront_content_json = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 'default'
          `).bind(
            "Las Delicias de la Tía",
            "Las Delicias de la Tía | Comidas para toda ocasión",
            "Comidas para toda ocasión",
            "Para cada antojo, una experiencia",
            "brand/las-delicias-de-la-tia-logo.png",
            "/brand/las-delicias-de-la-tia-logo.png",
            ORIGINAL_TEMPLATE_DESIGN_TOKENS.primary,
            ORIGINAL_TEMPLATE_DESIGN_TOKENS.secondary,
            ORIGINAL_TEMPLATE_DESIGN_TOKENS.text,
            ORIGINAL_TEMPLATE_FEATURED_IMAGES_JSON,
            restoredContentJson
          ),
          env.DB.prepare(`
            INSERT INTO audit_logs (id, admin_user_id, action, entity_type, entity_id, details_json)
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(
            restoreAuditId, admin.id, "ORIGINAL_PRESENTATION_TEMPLATE_RESTORED",
            "SITE_PRESENTATION", "default",
            JSON.stringify({ backupId, template: "las-delicias-original-v1", preservedBusinessData: true })
          ),
        ]);
        await cleanupReleasedMediaReferences(env, previousMediaUsage);

        return jsonResponse({
          success: true,
          message: "La plantilla original fue restaurada. La personalización anterior quedó respaldada y puede recuperarse.",
          data: { backupCreated: true, backupId, template: "las-delicias-original-v1" },
        });
      }

      if (path === "/api/settings/presentation/restore-previous" && request.method === "POST") {
        const admin = await getAdminForRequest(request, env);
        if (!admin || admin.role !== "SUPER_ADMIN") {
          return jsonResponse({ success: false, error: "Solo el superadministrador puede recuperar una personalización anterior." }, 403);
        }
        const body: unknown = await request.json().catch(() => null);
        if (!body || typeof body !== "object" || Array.isArray(body)
          || (body as Record<string, unknown>).confirmation !== "RECUPERAR MI DISEÑO") {
          return jsonResponse({ success: false, error: "Escribe RECUPERAR MI DISEÑO para confirmar la operación." }, 400);
        }

        const backup = await env.DB.prepare(`
          SELECT details_json
          FROM audit_logs
          WHERE action = 'PRESENTATION_BACKUP_BEFORE_TEMPLATE_RESTORE'
            AND entity_type = 'SITE_PRESENTATION'
          ORDER BY created_at DESC
          LIMIT 1
        `).first<{ details_json: string | null }>();
        if (!backup?.details_json) {
          return jsonResponse({ success: false, error: "Todavía no existe una personalización respaldada para recuperar." }, 404);
        }

        let snapshot: Record<string, unknown>;
        try {
          const parsed = JSON.parse(backup.details_json) as Record<string, unknown>;
          if (!parsed || typeof parsed !== "object" || !parsed.settings || typeof parsed.settings !== "object") {
            throw new Error("invalid snapshot");
          }
          snapshot = parsed.settings as Record<string, unknown>;
        } catch {
          return jsonResponse({ success: false, error: "El respaldo de personalización no se puede leer." }, 500);
        }

        const contentRaw = typeof snapshot.storefront_content_json === "string"
          ? snapshot.storefront_content_json : "{}";
        const restoredContent = readStorefrontContent(contentRaw);
        const hex = (value: unknown, fallback: string) =>
          typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
        const stringOr = (value: unknown, fallback: string) =>
          typeof value === "string" ? value : fallback;
        const nullableString = (value: unknown) =>
          typeof value === "string" ? value : null;

        let snapshotTokens: Record<string, unknown> = {};
        try {
          const parsedTokens = JSON.parse(String(restoredContent.designTokensJson || "{}"));
          if (parsedTokens && typeof parsedTokens === "object" && !Array.isArray(parsedTokens)) {
            snapshotTokens = parsedTokens as Record<string, unknown>;
          }
        } catch { /* Se usan los colores guardados en site_settings. */ }

        const primary = hex(snapshot.primary_color, hex(snapshotTokens.primary, ORIGINAL_TEMPLATE_DESIGN_TOKENS.primary));
        const secondary = hex(snapshot.secondary_color, hex(snapshotTokens.secondary, ORIGINAL_TEMPLATE_DESIGN_TOKENS.secondary));
        const text = hex(snapshot.text_color, ORIGINAL_TEMPLATE_DESIGN_TOKENS.text);
        const featuredImagesRaw = stringOr(snapshot.homepage_featured_images_json, "[]");
        let featuredImagesList: unknown[];
        try {
          const parsedImages: unknown = JSON.parse(featuredImagesRaw);
          if (!Array.isArray(parsedImages)) throw new Error("invalid images");
          featuredImagesList = parsedImages;
        } catch {
          return jsonResponse({ success: false, error: "El respaldo de imágenes principales no es válido." }, 500);
        }
        let missingRestoredMedia = false;
        const availableFeaturedImages: string[] = [];
        for (const value of featuredImagesList) {
          if (typeof value !== "string" || !value.trim()) continue;
          if (await mediaReferenceStillExists(env, value)) availableFeaturedImages.push(value);
          else missingRestoredMedia = true;
        }
        const featuredImages = JSON.stringify(availableFeaturedImages.slice(0, 3));

        const snapshotLogoUrl = stringOr(snapshot.logo_url, "/brand/las-delicias-de-la-tia-logo.png");
        const snapshotLogoKey = stringOr(snapshot.logo_key, "brand/las-delicias-de-la-tia-logo.png");
        const logoExists = await mediaReferenceStillExists(env, snapshotLogoUrl) && await mediaReferenceStillExists(env, snapshotLogoKey);
        if (!logoExists) missingRestoredMedia = true;
        const restoredLogoUrl = logoExists ? snapshotLogoUrl : "/brand/las-delicias-de-la-tia-logo.png";
        const restoredLogoKey = logoExists ? snapshotLogoKey : "brand/las-delicias-de-la-tia-logo.png";

        const snapshotFaviconUrl = nullableString(snapshot.favicon_url);
        const snapshotFaviconKey = nullableString(snapshot.favicon_key);
        const faviconExists = (!snapshotFaviconUrl && !snapshotFaviconKey)
          || ((!snapshotFaviconUrl || await mediaReferenceStillExists(env, snapshotFaviconUrl))
            && (!snapshotFaviconKey || await mediaReferenceStillExists(env, snapshotFaviconKey)));
        if (!faviconExists) missingRestoredMedia = true;
        const restoredFaviconUrl = faviconExists ? snapshotFaviconUrl : null;
        const restoredFaviconKey = faviconExists ? snapshotFaviconKey : null;

        const restoredPageBuilder = await sanitizeRestoredPageBuilder(env, String(restoredContent.pageBuilderJson || ""));
        restoredContent.pageBuilderJson = restoredPageBuilder.json;
        if (restoredPageBuilder.missing) missingRestoredMedia = true;

        const updatedContent = JSON.stringify(restoredContent);
        // Apply the full presentation snapshot and write its audit record atomically.
        // Business data lives in separate tables/columns and is intentionally untouched.
        const previousMediaUsage = await buildMediaUsageMap(env);
        await env.DB.batch([
          env.DB.prepare(`
            UPDATE site_settings
            SET business_name = ?,
                site_title = ?,
                tagline_primary = ?,
                tagline_secondary = ?,
                logo_key = ?,
                logo_url = ?,
                favicon_key = ?,
                favicon_url = ?,
                primary_color = ?,
                secondary_color = ?,
                text_color = ?,
                homepage_featured_images_json = ?,
                storefront_content_json = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 'default'
          `).bind(
            stringOr(snapshot.business_name, "Las Delicias de la Tía"),
            stringOr(snapshot.site_title, "Las Delicias de la Tía | Comidas para toda ocasión"),
            stringOr(snapshot.tagline_primary, "Comidas para toda ocasión"),
            stringOr(snapshot.tagline_secondary, "Para cada antojo, una experiencia"),
            restoredLogoKey,
            restoredLogoUrl,
            restoredFaviconKey,
            restoredFaviconUrl,
            primary, secondary, text, featuredImages, updatedContent
          ),
          env.DB.prepare(`
            INSERT INTO audit_logs (id, admin_user_id, action, entity_type, entity_id, details_json)
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(
            crypto.randomUUID(), admin.id, "PREVIOUS_PRESENTATION_PERSONALIZATION_RESTORED",
            "SITE_PRESENTATION", "default",
            JSON.stringify({ source: "PRESENTATION_BACKUP_BEFORE_TEMPLATE_RESTORE" })
          ),
        ]);
        await cleanupReleasedMediaReferences(env, previousMediaUsage);

        return jsonResponse({
          success: true,
          message: missingRestoredMedia
            ? "La personalización anterior fue recuperada. Algunas fotografías ya no estaban en la nube para ahorrar espacio; vuelve a cargarlas desde tu computador o celular en los módulos correspondientes."
            : "La personalización anterior fue recuperada correctamente.",
          data: { requiresPhotoUpload: missingRestoredMedia }
        });
      }

      // Public business settings
      if (path === "/api/settings" && request.method === "GET") {
        const row = await env.DB.prepare(`
          SELECT
            id,
            business_name,
            site_title,
            tagline_primary,
            tagline_secondary,
            logo_url,
            favicon_url,
            primary_color,
            secondary_color,
            currency_code,
            timezone,
            contact_phone,
            contact_whatsapp,
            allow_guest_checkout,
            allow_delivery,
            allow_pickup,
            free_delivery_enabled,
            free_delivery_min_units,
            accept_orders,
            allow_scheduled_orders,
            allow_cash_payment,
            minimum_delivery_order_cop,
            minimum_pickup_order_cop,
            delivery_prep_minutes,
            pickup_prep_minutes,
            homepage_featured_images_json
          FROM site_settings
          WHERE id = 'default'
          LIMIT 1
        `).first<{
          id: string;
          business_name: string;
          site_title: string;
          tagline_primary: string;
          tagline_secondary: string;
          logo_url: string;
          favicon_url: string | null;
          primary_color: string;
          secondary_color: string;
          currency_code: string;
          timezone: string;
          contact_phone: string;
          contact_whatsapp: string;
          allow_guest_checkout: number;
          allow_delivery: number;
          allow_pickup: number;
          free_delivery_enabled: number;
          free_delivery_min_units: number;
          accept_orders: number;
          allow_scheduled_orders: number;
          allow_cash_payment: number;
          minimum_delivery_order_cop: number;
          minimum_pickup_order_cop: number;
          delivery_prep_minutes: number;
          pickup_prep_minutes: number;
          homepage_featured_images_json: string | null;
        }>();

        if (!row) {
          return jsonResponse({
            success: false,
            error: "Configuración comercial no encontrada"
          }, 404);
        }

        return jsonResponse({
          success: true,
          data: {
            id: row.id,
            siteName: row.business_name,
            siteTitle: row.site_title,
            favicon: row.favicon_url,
            logo: row.logo_url,
            colorPrimary: row.primary_color,
            colorSecondary: row.secondary_color,
            darkMode: "light",
            storefrontTemplate: "classic",
            heroSection: null,
            featuresSection: null,
            ctaSection: null,
            taglinePrimary: row.tagline_primary,
            taglineSecondary: row.tagline_secondary,
            currencyCode: row.currency_code,
            timezone: row.timezone,
            contactPhone: row.contact_phone,
            contactWhatsapp: row.contact_whatsapp,
            allowGuestCheckout: row.allow_guest_checkout === 1,
            allowDelivery: row.allow_delivery === 1,
            allowPickup: row.allow_pickup === 1,
            freeDeliveryEnabled: row.free_delivery_enabled === 1,
            freeDeliveryMinUnits: row.free_delivery_min_units,
            acceptOrders: row.accept_orders === 1,
            allowScheduledOrders: row.allow_scheduled_orders === 1,
            allowCashPayment: row.allow_cash_payment === 1,
            minimumDeliveryOrderCop: row.minimum_delivery_order_cop,
            minimumPickupOrderCop: row.minimum_pickup_order_cop,
            deliveryPrepMinutes: row.delivery_prep_minutes,
            pickupPrepMinutes: row.pickup_prep_minutes,
            homepageFeaturedImages: parseImageGallery(row.homepage_featured_images_json, null, 3)
          }
        });
      }

      // ActualizaciÃ³n de los datos generales del negocio.
      if (path === "/api/settings" && request.method === "PUT") {
        const admin = await getAdminForRequest(request, env);
        if (!admin || (admin.role !== "SUPER_ADMIN" && admin.role !== "MANAGER")) {
          return jsonResponse({ success: false, error: "No tienes autorizaciÃ³n para modificar la configuraciÃ³n." }, 403);
        }

        const parsedBody: unknown = await request.json().catch(() => null);
        if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
          return jsonResponse({ success: false, error: "Los datos enviados no son vÃ¡lidos." }, 400);
        }

        const body = parsedBody as Record<string, unknown>;
        const assignments: string[] = [];
        const values: string[] = [];
        const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key);
        const addText = (key: string, column: string, label: string, min: number, max: number) => {
          if (!has(key)) return null;
          const value = typeof body[key] === "string" ? body[key].trim() : "";
          if (value.length < min || value.length > max) {
            return `${label}: escribe entre ${min} y ${max} caracteres.`;
          }
          assignments.push(`${column} = ?`);
          values.push(value);
          return null;
        };

        const addColor = (key: string, column: string, label: string) => {
          if (!has(key)) return null;
          const value = typeof body[key] === "string" ? body[key].trim().toLowerCase() : "";
          if (!/^#[0-9a-f]{6}$/.test(value)) {
            return `${label}: utiliza un código hexadecimal de seis dígitos, por ejemplo #74152f.`;
          }
          assignments.push(`${column} = ?`);
          values.push(value);
          return null;
        };

        const errors = [
          addText("siteName", "business_name", "Nombre del negocio", 2, 120),
          addText("siteTitle", "site_title", "TÃ­tulo de la tienda", 2, 180),
          addText("taglinePrimary", "tagline_primary", "Frase principal", 1, 180),
          addText("taglineSecondary", "tagline_secondary", "Frase complementaria", 1, 180),
          addText("contactPhone", "contact_phone", "TelÃ©fono de contacto", 7, 25),
          addText("contactWhatsapp", "contact_whatsapp", "WhatsApp de pedidos", 7, 25),
          addColor("colorPrimary", "primary_color", "Color principal"),
          addColor("colorSecondary", "secondary_color", "Color secundario")
        ].filter((message): message is string => message !== null);

        if (errors.length) {
          return jsonResponse({ success: false, error: errors[0] }, 400);
        }
        if (!assignments.length) {
          return jsonResponse({ success: false, error: "No se recibieron cambios para guardar." }, 400);
        }

        for (const [key, label] of [["contactPhone", "telÃ©fono"], ["contactWhatsapp", "WhatsApp"]] as const) {
          if (has(key)) {
            const value = String(body[key]).trim();
            if (value.replace(/\D/g, "").length < 7) {
              return jsonResponse({ success: false, error: `El nÃºmero de ${label} no es vÃ¡lido.` }, 400);
            }
          }
        }

        await env.DB.prepare(`
          UPDATE site_settings
          SET ${assignments.join(", ")}, updated_at = CURRENT_TIMESTAMP
          WHERE id = 'default'
        `).bind(...values).run();

        return jsonResponse({
          success: true,
          message: "La configuraciÃ³n del negocio se guardÃ³ correctamente."
        });
      }
      // Configuración de las tres fotografías destacadas de la portada.
      if (path === "/api/settings/homepage" && request.method === "PUT") {
        const admin = await getAdminForRequest(request, env);
        if (!admin || (admin.role !== "SUPER_ADMIN" && admin.role !== "MANAGER")) {
          return jsonResponse({ success: false, error: "No tienes autorización para modificar la portada." }, 403);
        }

        const parsedBody: unknown = await request.json().catch(() => null);
        if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
          return jsonResponse({ success: false, error: "Los datos de la portada no son válidos." }, 400);
        }

        const body = parsedBody as Record<string, unknown>;
        if (!Object.prototype.hasOwnProperty.call(body, "images")) {
          return jsonResponse({ success: false, error: "Debes enviar la selección de fotografías." }, 400);
        }

        const submitted = validateImageGallery(body.images, 3);
        if (!submitted.valid) {
          return jsonResponse({ success: false, error: submitted.error || "La selección de fotografías no es válida." }, 400);
        }
        if (submitted.images.length !== 0 && submitted.images.length !== 3) {
          return jsonResponse({ success: false, error: "Selecciona las tres fotografías de la portada o deja la lista vacía para volver a la selección automática." }, 400);
        }
        if (new Set(submitted.images).size !== submitted.images.length) {
          return jsonResponse({ success: false, error: "Selecciona tres fotografías diferentes." }, 400);
        }
        const unavailableImage = await findUnavailableManagedMediaReference(env, submitted.images);
        if (unavailableImage) {
          return jsonResponse({ success: false, error: "Una fotografía de la portada ya no está disponible. Vuelve a cargarla desde tu computador o celular." }, 409);
        }

        const previousMediaUsage = await buildMediaUsageMap(env);
        await env.DB.prepare(`
          UPDATE site_settings
          SET homepage_featured_images_json = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = 'default'
        `).bind(JSON.stringify(submitted.images)).run();
        await cleanupReleasedMediaReferences(env, previousMediaUsage);

        return jsonResponse({
          success: true,
          message: submitted.images.length === 3
            ? "Las fotografías de la portada se guardaron correctamente."
            : "La portada volvió a utilizar la selección automática de fotografías.",
          data: { images: submitted.images }
        });
      }

      // Configuración de operación: accesible a administradores y encargados.
      if (path === "/api/settings/operations" && (request.method === "GET" || request.method === "PUT")) {
        const admin = await getAdminForRequest(request, env);
        if (!admin || (admin.role !== "SUPER_ADMIN" && admin.role !== "MANAGER")) {
          return jsonResponse({ success: false, error: "No tienes autorización para consultar o modificar la operación del negocio." }, 403);
        }

        if (request.method === "GET") {
          const row = await env.DB.prepare(`
            SELECT accept_orders, allow_delivery, allow_pickup, allow_scheduled_orders,
                   allow_guest_checkout, allow_cash_payment, free_delivery_enabled,
                   free_delivery_min_units, minimum_delivery_order_cop,
                   minimum_pickup_order_cop, delivery_prep_minutes, pickup_prep_minutes
            FROM site_settings WHERE id = 'default' LIMIT 1
          `).first<{
            accept_orders: number; allow_delivery: number; allow_pickup: number;
            allow_scheduled_orders: number; allow_guest_checkout: number; allow_cash_payment: number;
            free_delivery_enabled: number; free_delivery_min_units: number;
            minimum_delivery_order_cop: number; minimum_pickup_order_cop: number;
            delivery_prep_minutes: number; pickup_prep_minutes: number;
          }>();
          if (!row) return jsonResponse({ success: false, error: "No se encontró la configuración del negocio." }, 404);
          return jsonResponse({ success: true, data: {
            acceptOrders: row.accept_orders === 1,
            allowDelivery: row.allow_delivery === 1,
            allowPickup: row.allow_pickup === 1,
            allowScheduledOrders: row.allow_scheduled_orders === 1,
            allowGuestCheckout: row.allow_guest_checkout === 1,
            allowCashPayment: row.allow_cash_payment === 1,
            freeDeliveryEnabled: row.free_delivery_enabled === 1,
            freeDeliveryMinUnits: row.free_delivery_min_units,
            minimumDeliveryOrderCop: row.minimum_delivery_order_cop,
            minimumPickupOrderCop: row.minimum_pickup_order_cop,
            deliveryPrepMinutes: row.delivery_prep_minutes,
            pickupPrepMinutes: row.pickup_prep_minutes
          }});
        }

        const parsedBody: unknown = await request.json().catch(() => null);
        if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
          return jsonResponse({ success: false, error: "Los datos de operación no son válidos." }, 400);
        }
        const body = parsedBody as Record<string, unknown>;
        const booleanFields = ["acceptOrders", "allowDelivery", "allowPickup", "allowScheduledOrders", "allowGuestCheckout", "allowCashPayment", "freeDeliveryEnabled"] as const;
        for (const field of booleanFields) {
          if (typeof body[field] !== "boolean") {
            return jsonResponse({ success: false, error: `El campo ${field} debe estar activado o desactivado.` }, 400);
          }
        }
        if (body.allowGuestCheckout !== true) {
          return jsonResponse({ success: false, error: "Los pedidos sin registro deben mantenerse habilitados mientras no existan cuentas de clientes." }, 400);
        }
        const integerFields = [
          ["freeDeliveryMinUnits", 1, 1000, "La cantidad mínima para domicilio gratis"],
          ["minimumDeliveryOrderCop", 0, 100000000, "El pedido mínimo para domicilio"],
          ["minimumPickupOrderCop", 0, 100000000, "El pedido mínimo para recoger"],
          ["deliveryPrepMinutes", 0, 1440, "El tiempo de preparación para domicilio"],
          ["pickupPrepMinutes", 0, 1440, "El tiempo de preparación para recoger"]
        ] as const;
        const numeric: Record<string, number> = {};
        for (const [field, min, max, label] of integerFields) {
          const value = body[field];
          if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) {
            return jsonResponse({ success: false, error: `${label} debe ser un número entre ${min} y ${max}.` }, 400);
          }
          numeric[field] = value;
        }
        await env.DB.prepare(`
          UPDATE site_settings SET
            accept_orders = ?, allow_delivery = ?, allow_pickup = ?,
            allow_scheduled_orders = ?, allow_guest_checkout = ?, allow_cash_payment = ?,
            free_delivery_enabled = ?, free_delivery_min_units = ?,
            minimum_delivery_order_cop = ?, minimum_pickup_order_cop = ?,
            delivery_prep_minutes = ?, pickup_prep_minutes = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = 'default'
        `).bind(
          body.acceptOrders ? 1 : 0, body.allowDelivery ? 1 : 0, body.allowPickup ? 1 : 0,
          body.allowScheduledOrders ? 1 : 0, body.allowGuestCheckout ? 1 : 0, body.allowCashPayment ? 1 : 0,
          body.freeDeliveryEnabled ? 1 : 0, numeric.freeDeliveryMinUnits,
          numeric.minimumDeliveryOrderCop, numeric.minimumPickupOrderCop,
          numeric.deliveryPrepMinutes, numeric.pickupPrepMinutes
        ).run();
        return jsonResponse({ success: true, message: "La configuración de pedidos y recogidas se guardó correctamente." });
      }

      // Dirección de operación privada: nunca se incluye en la API pública de la tienda.
      if (path === "/api/settings/private-location" && (request.method === "GET" || request.method === "PUT")) {
        const admin = await getAdminForRequest(request, env);
        if (!admin || admin.role !== "SUPER_ADMIN") {
          return jsonResponse({ success: false, error: "Solo el administrador principal puede consultar o modificar la dirección privada." }, 403);
        }
        if (request.method === "GET") {
          const row = await env.DB.prepare(`
            SELECT base_address, base_neighborhood, base_city, base_department, internal_notes
            FROM private_business_settings WHERE id = 'default' LIMIT 1
          `).first<{
            base_address: string | null; base_neighborhood: string | null; base_city: string | null;
            base_department: string | null; internal_notes: string | null;
          }>();
          return jsonResponse({ success: true, data: {
            baseAddress: row?.base_address || "", baseNeighborhood: row?.base_neighborhood || "",
            baseCity: row?.base_city || "", baseDepartment: row?.base_department || "",
            internalNotes: row?.internal_notes || ""
          }});
        }
        const parsedBody: unknown = await request.json().catch(() => null);
        if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
          return jsonResponse({ success: false, error: "Los datos de dirección no son válidos." }, 400);
        }
        const body = parsedBody as Record<string, unknown>;
        const fields = [
          ["baseAddress", 250, "La dirección"], ["baseNeighborhood", 100, "El barrio"],
          ["baseCity", 120, "El municipio"], ["baseDepartment", 120, "El departamento"],
          ["internalNotes", 1000, "Las indicaciones internas"]
        ] as const;
        const values: string[] = [];
        for (const [field, max, label] of fields) {
          const value = body[field];
          if (typeof value !== "string" || value.trim().length > max) {
            return jsonResponse({ success: false, error: `${label} debe ser texto de máximo ${max} caracteres.` }, 400);
          }
          values.push(value.trim());
        }
        await env.DB.prepare(`
          UPDATE private_business_settings SET
            base_address = ?, base_neighborhood = ?, base_city = ?, base_department = ?,
            internal_notes = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = 'default'
        `).bind(...values).run();
        return jsonResponse({ success: true, message: "La dirección privada del negocio se guardó correctamente." });
      }

      // Horarios semanales de atención. Los siete días se guardan de forma independiente.
      if (path === "/api/settings/hours" && (request.method === "GET" || request.method === "PUT")) {
        const admin = await getAdminForRequest(request, env);
        if (!admin || (admin.role !== "SUPER_ADMIN" && admin.role !== "MANAGER")) {
          return jsonResponse({ success: false, error: "No tienes autorización para consultar o modificar los horarios." }, 403);
        }
        if (request.method === "GET") {
          const [hours, notes] = await Promise.all([
            env.DB.prepare("SELECT day_of_week AS dayOfWeek, is_open AS isOpen, opens_at AS opensAt, closes_at AS closesAt FROM business_hours ORDER BY day_of_week").all<{
              dayOfWeek: number; isOpen: number; opensAt: string | null; closesAt: string | null;
            }>(),
            env.DB.prepare("SELECT special_notes AS specialNotes FROM business_hours_settings WHERE id = 'default' LIMIT 1").first<{ specialNotes: string | null }>()
          ]);
          return jsonResponse({ success: true, data: {
            days: hours.results.map(day => ({ ...day, isOpen: day.isOpen === 1 })),
            specialNotes: notes?.specialNotes || ""
          }});
        }
        const parsedBody: unknown = await request.json().catch(() => null);
        if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
          return jsonResponse({ success: false, error: "Los horarios enviados no son válidos." }, 400);
        }
        const body = parsedBody as Record<string, unknown>;
        if (!Array.isArray(body.days) || body.days.length !== 7) {
          return jsonResponse({ success: false, error: "Debes configurar los siete días de la semana." }, 400);
        }
        const notes = typeof body.specialNotes === "string" ? body.specialNotes.trim() : "";
        if (notes.length > 1000) return jsonResponse({ success: false, error: "Las notas no pueden superar 1000 caracteres." }, 400);
        const seen = new Set<number>();
        const statements: D1PreparedStatement[] = [];
        for (const rawDay of body.days) {
          if (!rawDay || typeof rawDay !== "object" || Array.isArray(rawDay)) {
            return jsonResponse({ success: false, error: "Hay un día con información inválida." }, 400);
          }
          const day = rawDay as Record<string, unknown>;
          const dayOfWeek = day.dayOfWeek;
          if (typeof dayOfWeek !== "number" || !Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7 || seen.has(dayOfWeek) || typeof day.isOpen !== "boolean") {
            return jsonResponse({ success: false, error: "Cada día debe tener un número único del 1 al 7 y un estado válido." }, 400);
          }
          seen.add(dayOfWeek);
          let opensAt: string | null = null;
          let closesAt: string | null = null;
          if (day.isOpen) {
            if (typeof day.opensAt !== "string" || typeof day.closesAt !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(day.opensAt) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(day.closesAt) || day.closesAt <= day.opensAt) {
              return jsonResponse({ success: false, error: "Indica una hora de apertura y otra de cierre válidas para cada día activo." }, 400);
            }
            opensAt = day.opensAt;
            closesAt = day.closesAt;
          }
          statements.push(env.DB.prepare(`
            INSERT INTO business_hours (day_of_week, is_open, opens_at, closes_at, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(day_of_week) DO UPDATE SET
              is_open = excluded.is_open, opens_at = excluded.opens_at,
              closes_at = excluded.closes_at, updated_at = CURRENT_TIMESTAMP
          `).bind(dayOfWeek, day.isOpen ? 1 : 0, opensAt, closesAt));
        }
        if (seen.size !== 7) return jsonResponse({ success: false, error: "Debes incluir cada día de lunes a domingo una sola vez." }, 400);
        statements.push(env.DB.prepare("UPDATE business_hours_settings SET special_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 'default'").bind(notes || null));
        await env.DB.batch(statements);
        return jsonResponse({ success: true, message: "Los horarios de atención se guardaron correctamente." });
      }

      // Public event quotation requests (guest submissions)
      if (path === "/api/events" && request.method === "POST") {
        const eventContentRow = await env.DB.prepare(
          "SELECT storefront_content_json FROM site_settings WHERE id = 'default' LIMIT 1"
        ).first<{ storefront_content_json: string | null }>();
        const eventContent = readStorefrontContent(eventContentRow?.storefront_content_json);
        const eventValidationMessage = (key: string, fallback: string): string => {
          const configured = eventContent[key];
          return typeof configured === "string" && configured.trim() ? configured : fallback;
        };
        const parsedBody: unknown = await request.json().catch(() => null);

        if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
          return jsonResponse({
            success: false,
            error: eventValidationMessage("eventsInvalidPayloadError", "El contenido de la solicitud no es válido.")
          }, 400);
        }

        const body = parsedBody as Record<string, unknown>;
        const readText = (key: string): string => {
          const value = body[key];
          return typeof value === "string" ? value.trim() : "";
        };

        const contactName = readText("contactName");
        const contactPhone = readText("contactPhone");
        const contactEmail = readText("contactEmail");
        const eventType = readText("eventType");
        const eventDate = readText("eventDate");
        const city = readText("city");
        const neighborhood = readText("neighborhood");
        const venueAddress = readText("venueAddress");
        const requestedFood = readText("requestedFood");
        const eventDetails = readText("eventDetails");
        const whatsappConsent = body.whatsappConsent === true;

        if (contactName.length < 2 || contactName.length > 100) {
          return jsonResponse({
            success: false,
            error: eventValidationMessage("eventsInvalidNameError", "Escribe un nombre válido de entre 2 y 100 caracteres.")
          }, 400);
        }

        if (contactPhone.length > 25 || contactPhone.replace(/\D/g, "").length < 7) {
          return jsonResponse({
            success: false,
            error: eventValidationMessage("eventsInvalidPhoneError", "Escribe un número de teléfono válido.")
          }, 400);
        }

        if (eventType.length < 2 || eventType.length > 80) {
          return jsonResponse({
            success: false,
            error: eventValidationMessage("eventsInvalidTypeError", "Selecciona o escribe un tipo de evento válido.")
          }, 400);
        }

        if (
          contactEmail.length > 150 ||
          (contactEmail !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))
        ) {
          return jsonResponse({
            success: false,
            error: eventValidationMessage("eventsInvalidEmailError", "El correo electrónico no es válido.")
          }, 400);
        }

        if (eventDate !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
          return jsonResponse({
            success: false,
            error: eventValidationMessage("eventsInvalidDateError", "La fecha del evento no tiene un formato válido.")
          }, 400);
        }

        const rawGuestCount = body.guestCount;
        const guestCount = rawGuestCount === undefined || rawGuestCount === null || rawGuestCount === ""
          ? null
          : Number(rawGuestCount);

        if (
          guestCount !== null &&
          (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 10000)
        ) {
          return jsonResponse({
            success: false,
            error: eventValidationMessage("eventsInvalidGuestCountError", "El número de invitados debe estar entre 1 y 10.000.")
          }, 400);
        }

        const rawBudget = body.budgetCop;
        const budgetCop = rawBudget === undefined || rawBudget === null || rawBudget === ""
          ? null
          : Number(rawBudget);

        if (
          budgetCop !== null &&
          (!Number.isSafeInteger(budgetCop) || budgetCop < 0 || budgetCop > 1000000000)
        ) {
          return jsonResponse({
            success: false,
            error: eventValidationMessage("eventsInvalidBudgetError", "El presupuesto indicado no es válido.")
          }, 400);
        }

        const fieldLimits: Record<string, number> = {
          city: 100,
          neighborhood: 100,
          venueAddress: 250,
          requestedFood: 2000,
          eventDetails: 2000
        };

        const submittedFields: Record<string, string> = {
          city,
          neighborhood,
          venueAddress,
          requestedFood,
          eventDetails
        };

        for (const [field, maximum] of Object.entries(fieldLimits)) {
          if (submittedFields[field].length > maximum) {
            return jsonResponse({
              success: false,
              error: eventValidationMessage("eventsInvalidFieldLengthError", "El campo {field} supera el límite permitido de {maximum} caracteres.").replaceAll("{field}", field).replaceAll("{maximum}", String(maximum))
            }, 400);
          }
        }

        const id = crypto.randomUUID();
        const requestNumber = `EV-${Date.now()}-${id.slice(0, 8).toUpperCase()}`;

        await env.DB.prepare(`
          INSERT INTO event_requests (
            id,
            request_number,
            contact_name,
            contact_phone,
            contact_email,
            event_type,
            event_date,
            guest_count,
            city,
            neighborhood,
            venue_address,
            budget_cop,
            requested_food,
            event_details,
            status,
            whatsapp_consent,
            whatsapp_consent_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?,
            CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END
          )
        `).bind(
          id,
          requestNumber,
          contactName,
          contactPhone,
          contactEmail || null,
          eventType,
          eventDate || null,
          guestCount,
          city || null,
          neighborhood || null,
          venueAddress || null,
          budgetCop,
          requestedFood || null,
          eventDetails || null,
          whatsappConsent ? 1 : 0,
          whatsappConsent ? 1 : 0
        ).run();

        return jsonResponse({
          success: true,
          message: "Tu solicitud de cotización fue recibida correctamente.",
          data: {
            id,
            requestNumber,
            status: "PENDING"
          }
        }, 201);
      }
      // Category administration routes. Keep the existing public GET route unchanged.
      if (path === "/api/menu/categories" && request.method === "POST") {
        const admin = await getAdminForRequest(request, env);
        if (!admin) {
          return jsonResponse({ success: false, error: "Debes iniciar sesión para gestionar categorías." }, 401);
        }
        if (admin.role !== "SUPER_ADMIN" && admin.role !== "MANAGER") {
          return jsonResponse({ success: false, error: "No tienes permisos para gestionar categorías." }, 403);
        }

        let rawBody: unknown;
        try {
          rawBody = await request.json();
        } catch {
          return jsonResponse({ success: false, error: "La solicitud no contiene JSON válido." }, 400);
        }
        if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
          return jsonResponse({ success: false, error: "Los datos de la categoría no son válidos." }, 400);
        }

        const body = rawBody as Record<string, unknown>;
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const description = typeof body.description === "string" ? body.description.trim() : "";
        const rawSlug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
        const slug = (rawSlug || name)
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
        const parentId = typeof body.parentId === "string" && body.parentId.trim()
          ? body.parentId.trim()
          : null;
        const sortOrder = Number(body.sortOrder ?? body.order ?? 0);
        const isActive = body.isActive === undefined ? true : body.isActive;
        const submittedImages = readSubmittedImageGallery(body);
        if (!submittedImages.valid) {
          return jsonResponse({ success: false, error: submittedImages.error }, 400);
        }
        const unavailableImage = await findUnavailableManagedMediaReference(env, submittedImages.images);
        if (unavailableImage) {
          return jsonResponse({ success: false, error: "Una fotografía de la categoría ya no está disponible. Vuelve a cargarla desde tu computador o celular." }, 409);
        }
        const images = submittedImages.images;
        const mainImage = images[0] ?? null;

        if (!name || name.length > 100) {
          return jsonResponse({ success: false, error: "El nombre es obligatorio y debe tener máximo 100 caracteres." }, 400);
        }
        if (!slug || slug.length > 120 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
          return jsonResponse({ success: false, error: "El identificador URL debe usar minúsculas, números y guiones." }, 400);
        }
        if (description.length > 1000) {
          return jsonResponse({ success: false, error: "La descripción no puede superar 1.000 caracteres." }, 400);
        }
        if (!Number.isSafeInteger(sortOrder) || sortOrder < 0) {
          return jsonResponse({ success: false, error: "El orden de clasificación debe ser un entero igual o mayor que cero." }, 400);
        }
        if (typeof isActive !== "boolean") {
          return jsonResponse({ success: false, error: "El estado de la categoría no es válido." }, 400);
        }

        if (parentId) {
          const parent = await env.DB.prepare(
            "SELECT id, parent_id AS parentId FROM categories WHERE id = ? LIMIT 1"
          ).bind(parentId).first<{ id: string; parentId: string | null }>();
          if (!parent) {
            return jsonResponse({ success: false, error: "La categoría matriz seleccionada no existe." }, 400);
          }
          if (parent.parentId) {
            return jsonResponse({ success: false, error: "Por ahora solo se permiten subcategorías de categorías principales." }, 400);
          }
        }

        const duplicate = await env.DB.prepare(
          "SELECT id FROM categories WHERE slug = ? LIMIT 1"
        ).bind(slug).first<{ id: string }>();
        if (duplicate) {
          return jsonResponse({ success: false, error: "Ya existe una categoría con ese identificador URL." }, 409);
        }

        const categoryId = crypto.randomUUID();
        const insert = await env.DB.prepare(`
          INSERT INTO categories (
            id, name, slug, description, image_url, image_gallery_json, parent_id, sort_order, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          categoryId,
          name,
          slug,
          description || null,
          mainImage,
          images.length ? JSON.stringify(images) : null,
          parentId,
          sortOrder,
          isActive ? 1 : 0
        ).run();

        if (!insert.success) {
          throw new Error("No fue posible crear la categoría.");
        }

        return jsonResponse({
          success: true,
          message: "La categoría fue creada correctamente.",
          data: {
            id: categoryId,
            name,
            slug,
            description: description || null,
            image: mainImage,
            images,
            parentId,
            sortOrder,
            isActive,
            _count: { menuItems: 0 },
            children: []
          }
        }, 201);
      }

      const categoryDetailMatch = path.match(/^\/api\/menu\/categories\/([^/]+)$/);
      if (categoryDetailMatch && ["GET", "PATCH", "DELETE"].includes(request.method)) {
        const admin = await getAdminForRequest(request, env);
        if (!admin) {
          return jsonResponse({ success: false, error: "Debes iniciar sesión para gestionar categorías." }, 401);
        }
        if (admin.role !== "SUPER_ADMIN" && admin.role !== "MANAGER") {
          return jsonResponse({ success: false, error: "No tienes permisos para gestionar categorías." }, 403);
        }

        let categoryId: string;
        try {
          categoryId = decodeURIComponent(categoryDetailMatch[1]);
        } catch {
          return jsonResponse({ success: false, error: "Identificador de categoría no válido." }, 400);
        }
        if (!categoryId || categoryId.length > 100) {
          return jsonResponse({ success: false, error: "Identificador de categoría no válido." }, 400);
        }

        const existing = await env.DB.prepare(`
          SELECT id, name, slug, description, image_url AS image,
                 image_gallery_json AS imageGalleryJson,
                 parent_id AS parentId, sort_order AS sortOrder, is_active AS isActive
          FROM categories WHERE id = ? LIMIT 1
        `).bind(categoryId).first<{
          id: string;
          name: string;
          slug: string;
          description: string | null;
          image: string | null;
          imageGalleryJson: string | null;
          parentId: string | null;
          sortOrder: number;
          isActive: number;
        }>();
        if (!existing) {
          return jsonResponse({ success: false, error: "No se encontró la categoría." }, 404);
        }

        if (request.method === "GET") {
          const count = await env.DB.prepare(
            "SELECT COUNT(*) AS total FROM products WHERE category_id = ?"
          ).bind(categoryId).first<{ total: number }>();
          return jsonResponse({
            success: true,
            data: {
              ...existing,
              images: parseImageGallery(existing.imageGalleryJson, existing.image),
              isActive: existing.isActive === 1,
              _count: { menuItems: Number(count?.total ?? 0) }
            }
          });
        }

        if (request.method === "DELETE") {
          const productCount = await env.DB.prepare(
            "SELECT COUNT(*) AS total FROM products WHERE category_id = ?"
          ).bind(categoryId).first<{ total: number }>();
          if (Number(productCount?.total ?? 0) > 0) {
            return jsonResponse({ success: false, error: "No puedes eliminar esta categoría porque tiene productos asociados. Reasigna primero esos productos." }, 409);
          }
          const childCount = await env.DB.prepare(
            "SELECT COUNT(*) AS total FROM categories WHERE parent_id = ?"
          ).bind(categoryId).first<{ total: number }>();
          if (Number(childCount?.total ?? 0) > 0) {
            return jsonResponse({ success: false, error: "No puedes eliminar esta categoría porque tiene subcategorías. Elimínalas o reasígnalas primero." }, 409);
          }
          const previousMediaUsage = await buildMediaUsageMap(env);
          const deletion = await env.DB.prepare(
            "DELETE FROM categories WHERE id = ?"
          ).bind(categoryId).run();
          if (!deletion.success) {
            throw new Error("No fue posible eliminar la categoría.");
          }
          await cleanupReleasedMediaReferences(env, previousMediaUsage);
          return jsonResponse({
            success: true,
            message: "La categoría fue eliminada correctamente.",
            data: { id: categoryId }
          });
        }

        let rawBody: unknown;
        try {
          rawBody = await request.json();
        } catch {
          return jsonResponse({ success: false, error: "La solicitud no contiene JSON válido." }, 400);
        }
        if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
          return jsonResponse({ success: false, error: "Los datos de la categoría no son válidos." }, 400);
        }

        const body = rawBody as Record<string, unknown>;
        const fields: string[] = [];
        const values: (string | number | null)[] = [];
        const submittedImages = readSubmittedImageGallery(body);
        if (!submittedImages.valid) {
          return jsonResponse({ success: false, error: submittedImages.error }, 400);
        }
        if (submittedImages.provided) {
          const unavailableImage = await findUnavailableManagedMediaReference(env, submittedImages.images);
          if (unavailableImage) {
            return jsonResponse({ success: false, error: "Una fotografía de la categoría ya no está disponible. Vuelve a cargarla desde tu computador o celular." }, 409);
          }
        }
        if (submittedImages.provided) {
          fields.push("image_url = ?");
          values.push(submittedImages.images[0] ?? null);
          fields.push("image_key = ?");
          values.push(null);
          fields.push("image_gallery_json = ?");
          values.push(submittedImages.images.length ? JSON.stringify(submittedImages.images) : null);
        }

        if (Object.prototype.hasOwnProperty.call(body, "name")) {
          const name = typeof body.name === "string" ? body.name.trim() : "";
          if (!name || name.length > 100) {
            return jsonResponse({ success: false, error: "El nombre es obligatorio y debe tener máximo 100 caracteres." }, 400);
          }
          fields.push("name = ?");
          values.push(name);
        }

        if (Object.prototype.hasOwnProperty.call(body, "description")) {
          if (body.description !== null && typeof body.description !== "string") {
            return jsonResponse({ success: false, error: "La descripción no es válida." }, 400);
          }
          const description = typeof body.description === "string" ? body.description.trim() : "";
          if (description.length > 1000) {
            return jsonResponse({ success: false, error: "La descripción no puede superar 1.000 caracteres." }, 400);
          }
          fields.push("description = ?");
          values.push(description || null);
        }

        if (Object.prototype.hasOwnProperty.call(body, "parentId")) {
          const parentId = typeof body.parentId === "string" && body.parentId.trim()
            ? body.parentId.trim()
            : null;
          if (parentId === categoryId) {
            return jsonResponse({ success: false, error: "Una categoría no puede ser su propia categoría matriz." }, 400);
          }
          if (parentId) {
            const parent = await env.DB.prepare(
              "SELECT id, parent_id AS parentId FROM categories WHERE id = ? LIMIT 1"
            ).bind(parentId).first<{ id: string; parentId: string | null }>();
            if (!parent) {
              return jsonResponse({ success: false, error: "La categoría matriz seleccionada no existe." }, 400);
            }
            if (parent.parentId) {
              return jsonResponse({ success: false, error: "Por ahora solo se permiten subcategorías de categorías principales." }, 400);
            }
            const existingParent = existing.parentId;
            if (!existingParent && parentId !== categoryId) {
              const categoryHasChildren = await env.DB.prepare(
                "SELECT COUNT(*) AS total FROM categories WHERE parent_id = ?"
              ).bind(categoryId).first<{ total: number }>();
              if (Number(categoryHasChildren?.total ?? 0) > 0) {
                return jsonResponse({ success: false, error: "No puedes convertir en subcategoría una categoría que ya tiene subcategorías." }, 409);
              }
            }
          }
          fields.push("parent_id = ?");
          values.push(parentId);
        }

        if (Object.prototype.hasOwnProperty.call(body, "sortOrder") || Object.prototype.hasOwnProperty.call(body, "order")) {
          const sortOrder = Number(body.sortOrder ?? body.order);
          if (!Number.isSafeInteger(sortOrder) || sortOrder < 0) {
            return jsonResponse({ success: false, error: "El orden de clasificación debe ser un entero igual o mayor que cero." }, 400);
          }
          fields.push("sort_order = ?");
          values.push(sortOrder);
        }

        if (Object.prototype.hasOwnProperty.call(body, "isActive")) {
          if (typeof body.isActive !== "boolean") {
            return jsonResponse({ success: false, error: "El estado de la categoría no es válido." }, 400);
          }
          fields.push("is_active = ?");
          values.push(body.isActive ? 1 : 0);
        }

        if (fields.length === 0) {
          return jsonResponse({ success: false, error: "No hay cambios para guardar." }, 400);
        }

        const previousMediaUsage = submittedImages.provided ? await buildMediaUsageMap(env) : null;
        fields.push("updated_at = CURRENT_TIMESTAMP");
        const update = await env.DB.prepare(
          `UPDATE categories SET ${fields.join(", ")} WHERE id = ?`
        ).bind(...values, categoryId).run();
        if (previousMediaUsage) await cleanupReleasedMediaReferences(env, previousMediaUsage);
        if (!update.success) {
          throw new Error("No fue posible actualizar la categoría.");
        }

        const updated = await env.DB.prepare(`
          SELECT id, name, slug, description, image_url AS image,
                 image_gallery_json AS imageGalleryJson,
                 parent_id AS parentId, sort_order AS sortOrder, is_active AS isActive
          FROM categories WHERE id = ? LIMIT 1
        `).bind(categoryId).first<{
          id: string;
          name: string;
          slug: string;
          description: string | null;
          image: string | null;
          imageGalleryJson: string | null;
          parentId: string | null;
          sortOrder: number;
          isActive: number;
        }>();
        return jsonResponse({
          success: true,
          message: "La categoría fue actualizada correctamente.",
          data: updated ? { ...updated, images: parseImageGallery(updated.imageGalleryJson, updated.image), isActive: updated.isActive === 1 } : null
        });
      }

      // Public categories
      if (path === "/api/menu/categories" && request.method === "GET") {
        const result = await env.DB.prepare(`
          SELECT
            id,
            name,
            slug,
            description,
            image_url AS image,
            image_gallery_json AS imageGalleryJson,
            parent_id AS parentId,
            sort_order AS sortOrder,
            is_active AS isActive,
            (
              SELECT COUNT(*)
              FROM products p
              WHERE p.category_id = categories.id
                AND p.is_available = 1
            ) AS menuItemCount
          FROM categories
          WHERE is_active = 1
          ORDER BY sort_order ASC, name ASC
        `).all<CategoryRow>();

        const toCategory = (category: CategoryRow) => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          image: category.image,
          images: parseImageGallery(category.imageGalleryJson, category.image),
          parentId: category.parentId,
          sortOrder: category.sortOrder,
          isActive: category.isActive === 1,
          _count: { menuItems: category.menuItemCount },
          children: []
        });

        const categories = result.results
          .filter(category => !category.parentId)
          .map(category => ({
            ...toCategory(category),
            children: result.results
              .filter(child => child.parentId === category.id)
              .map(toCategory)
          }));

        return jsonResponse({
          success: true,
          data: categories
        });
      }

      // Product administration. Public visitors can only read available products.
      // SUPER_ADMIN and MANAGER can create, edit and remove catalogue items.
      const menuItemDetailMatch = path.match(/^\/api\/menu\/items\/([^/]+)$/);

      if (menuItemDetailMatch && ["GET", "PATCH", "DELETE"].includes(request.method)) {
        const admin = await getAdminForRequest(request, env);
        const canManage = !!admin &&
          (admin.role === "SUPER_ADMIN" || admin.role === "MANAGER");

        // Los clientes pueden consultar productos disponibles.
        // Editar y eliminar siguen siendo funciones exclusivas de administradores.
        if (request.method !== "GET" && !canManage) {
          if (!admin) {
            return jsonResponse({
              success: false,
              error: "Debes iniciar sesión para gestionar productos."
            }, 401);
          }

          return jsonResponse({
            success: false,
            error: "No tienes permisos para gestionar productos."
          }, 403);
        }

        let productId: string;
        try {
          productId = decodeURIComponent(menuItemDetailMatch[1]);
        } catch {
          return jsonResponse({
            success: false,
            error: "Identificador de producto no válido."
          }, 400);
        }

        if (!productId || productId.length > 100) {
          return jsonResponse({
            success: false,
            error: "Identificador de producto no válido."
          }, 400);
        }

        if (request.method === "GET") {
          const product = await env.DB.prepare(`
            SELECT
              p.id,
              p.name,
              p.slug,
              p.description,
              p.price_cop AS price,
              COALESCE(p.image_url, p.image_key) AS image,
              p.image_url AS imageUrl,
              p.image_gallery_json AS imageGalleryJson,
              p.is_available AS isActive,
              p.track_stock AS trackStock,
              p.stock_quantity AS stockQty,
              p.sort_order AS sortOrder,
              p.category_id AS categoryId,
              c.name AS categoryName
            FROM products p
            INNER JOIN categories c ON c.id = p.category_id
            WHERE p.id = ?
            LIMIT 1
          `).bind(productId).first<{
            id: string;
            name: string;
            slug: string;
            description: string | null;
            price: number;
            image: string | null;
            imageUrl: string | null;
            imageGalleryJson: string | null;
            isActive: number;
            trackStock: number;
            stockQty: number;
            sortOrder: number;
            categoryId: string;
            categoryName: string;
          }>();

          if (!product) {
            return jsonResponse({
              success: false,
              error: "No se encontró el producto."
            }, 404);
          }

          const optionRows = await env.DB.prepare(`
            SELECT
              id,
              name,
              selection_type AS selectionType,
              is_required AS isRequired,
              min_select AS minSelect,
              max_select AS maxSelect,
              sort_order AS sortOrder
            FROM product_options
            WHERE product_id = ?
            ORDER BY sort_order ASC, name ASC
          `).bind(productId).all<{
            id: string;
            name: string;
            selectionType: string;
            isRequired: number;
            minSelect: number;
            maxSelect: number;
            sortOrder: number;
          }>();

          const options = [];
          for (const option of optionRows.results) {
            const valueRows = await env.DB.prepare(`
              SELECT
                id,
                name,
                price_delta_cop AS priceModifier,
                sort_order AS sortOrder
              FROM product_option_values
              WHERE option_id = ?
                AND is_available = 1
              ORDER BY sort_order ASC, name ASC
            `).bind(option.id).all<{
              id: string;
              name: string;
              priceModifier: number;
              sortOrder: number;
            }>();

            options.push({
              id: option.id,
              name: option.name,
              displayType: option.selectionType === "MULTIPLE" ? "CHECKBOX" : "SELECT",
              isRequired: option.isRequired === 1,
              minSelect: option.minSelect,
              maxSelect: option.maxSelect,
              sortOrder: option.sortOrder,
              values: valueRows.results.map(value => ({
                id: value.id,
                name: value.name,
                priceModifier: Number(value.priceModifier),
                isDefault: false,
                sortOrder: value.sortOrder
              }))
            });
          }

          return jsonResponse({
            success: true,
            data: {
              ...product,
              images: parseImageGallery(product.imageGalleryJson, product.image, 6),
              isActive: product.isActive === 1,
              trackStock: product.trackStock === 1,
              category: { id: product.categoryId, name: product.categoryName },
              options,
              // The current D1 schema does not include allergens or mealtimes.
              allergens: [],
              mealtimes: []
            }
          });
        }

        if (request.method === "DELETE") {
          const existing = await env.DB.prepare(
            "SELECT id FROM products WHERE id = ? LIMIT 1"
          ).bind(productId).first<{ id: string }>();

          if (!existing) {
            return jsonResponse({
              success: false,
              error: "No se encontró el producto."
            }, 404);
          }

          // order_items.product_id uses ON DELETE SET NULL and keeps its
          // product_name_snapshot, so historical orders remain readable.
          const previousMediaUsage = await buildMediaUsageMap(env);
          await env.DB.prepare(
            "DELETE FROM products WHERE id = ?"
          ).bind(productId).run();
          await cleanupReleasedMediaReferences(env, previousMediaUsage);

          return jsonResponse({
            success: true,
            message: "Producto eliminado correctamente."
          });
        }

        // PATCH: update product fields and, when supplied, replace its options.
        let parsedBody: unknown;
        try {
          parsedBody = await request.json();
        } catch {
          return jsonResponse({
            success: false,
            error: "El contenido enviado no es JSON válido."
          }, 400);
        }

        if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
          return jsonResponse({
            success: false,
            error: "Los datos del producto no son válidos."
          }, 400);
        }

        const body = parsedBody as Record<string, unknown>;
        const fields: string[] = [];
        const values: (string | number | null)[] = [];

        const hasName = Object.prototype.hasOwnProperty.call(body, "name");
        const hasDescription = Object.prototype.hasOwnProperty.call(body, "description");
        const hasPrice = Object.prototype.hasOwnProperty.call(body, "price");
        const hasIsActive = Object.prototype.hasOwnProperty.call(body, "isActive");
        const hasSortOrder = Object.prototype.hasOwnProperty.call(body, "sortOrder");
        const hasTrackStock = Object.prototype.hasOwnProperty.call(body, "trackStock");
        const hasStockQty = Object.prototype.hasOwnProperty.call(body, "stockQty");
        const hasCategoryId = Object.prototype.hasOwnProperty.call(body, "categoryId");
        const hasImages = Object.prototype.hasOwnProperty.call(body, "images");
        const hasImageUrl = Object.prototype.hasOwnProperty.call(body, "imageUrl");
        const hasOptions = Object.prototype.hasOwnProperty.call(body, "options");

        if (
          !hasName && !hasDescription && !hasPrice && !hasIsActive &&
          !hasSortOrder && !hasTrackStock && !hasStockQty &&
          !hasCategoryId && !hasImageUrl && !hasImages && !hasOptions &&
          !Object.prototype.hasOwnProperty.call(body, "allergenIds") &&
          !Object.prototype.hasOwnProperty.call(body, "mealtimeIds")
        ) {
          return jsonResponse({
            success: false,
            error: "No hay cambios para guardar."
          }, 400);
        }

        if (hasName) {
          if (typeof body.name !== "string" || body.name.trim().length < 2 || body.name.trim().length > 120) {
            return jsonResponse({ success: false, error: "El nombre debe tener entre 2 y 120 caracteres." }, 400);
          }
          fields.push("name = ?");
          values.push(body.name.trim());
        }

        if (hasDescription) {
          if (body.description !== null && typeof body.description !== "string") {
            return jsonResponse({ success: false, error: "La descripción no es válida." }, 400);
          }
          const description = typeof body.description === "string" ? body.description.trim() : null;
          if (description && description.length > 2000) {
            return jsonResponse({ success: false, error: "La descripción supera los 2.000 caracteres." }, 400);
          }
          fields.push("description = ?");
          values.push(description || null);
        }

        if (hasPrice) {
          const price = Number(body.price);
          if (!Number.isSafeInteger(price) || price < 0 || price > 1000000000) {
            return jsonResponse({ success: false, error: "El precio debe ser un valor entero en pesos colombianos." }, 400);
          }
          fields.push("price_cop = ?");
          values.push(price);
        }

        if (hasIsActive) {
          if (typeof body.isActive !== "boolean") {
            return jsonResponse({ success: false, error: "El estado del producto no es válido." }, 400);
          }
          fields.push("is_available = ?");
          values.push(body.isActive ? 1 : 0);
        }

        if (hasSortOrder) {
          const sortOrder = Number(body.sortOrder);
          if (!Number.isSafeInteger(sortOrder) || sortOrder < 0 || sortOrder > 1000000) {
            return jsonResponse({ success: false, error: "El orden del producto no es válido." }, 400);
          }
          fields.push("sort_order = ?");
          values.push(sortOrder);
        }

        if (hasTrackStock) {
          if (typeof body.trackStock !== "boolean") {
            return jsonResponse({ success: false, error: "La configuración de inventario no es válida." }, 400);
          }
          fields.push("track_stock = ?");
          values.push(body.trackStock ? 1 : 0);
        }

        if (hasStockQty) {
          const stockQty = Number(body.stockQty);
          if (!Number.isSafeInteger(stockQty) || stockQty < 0 || stockQty > 1000000000) {
            return jsonResponse({ success: false, error: "La existencia debe ser un número entero igual o mayor que cero." }, 400);
          }
          fields.push("stock_quantity = ?");
          values.push(stockQty);
        }

        if (hasCategoryId) {
          if (typeof body.categoryId !== "string" || !body.categoryId.trim()) {
            return jsonResponse({ success: false, error: "Selecciona una categoría válida." }, 400);
          }
          const category = await env.DB.prepare(
            "SELECT id FROM categories WHERE id = ? AND is_active = 1 LIMIT 1"
          ).bind(body.categoryId.trim()).first<{ id: string }>();
          if (!category) {
            return jsonResponse({ success: false, error: "La categoría seleccionada no existe o está inactiva." }, 400);
          }
          fields.push("category_id = ?");
          values.push(body.categoryId.trim());
        }

        const submittedImages = readSubmittedImageGallery(body, 6);
        if (!submittedImages.valid) {
          return jsonResponse({ success: false, error: submittedImages.error }, 400);
        }
        if (submittedImages.provided) {
          const unavailableImage = await findUnavailableManagedMediaReference(env, submittedImages.images);
          if (unavailableImage) {
            return jsonResponse({ success: false, error: "Una fotografía del producto ya no está disponible. Vuelve a cargarla desde tu computador o celular." }, 409);
          }
        }
        if (submittedImages.provided) {
          fields.push("image_url = ?");
          values.push(submittedImages.images[0] ?? null);
          fields.push("image_key = ?");
          values.push(null);
          fields.push("image_gallery_json = ?");
          values.push(submittedImages.images.length ? JSON.stringify(submittedImages.images) : null);
        }

        let normalizedOptions: Array<{
          name: string;
          selectionType: "SINGLE" | "MULTIPLE";
          isRequired: boolean;
          minSelect: number;
          maxSelect: number;
          sortOrder: number;
          values: Array<{ name: string; priceModifier: number; sortOrder: number }>;
        }> | null = null;

        if (hasOptions) {
          if (!Array.isArray(body.options) || body.options.length > 30) {
            return jsonResponse({ success: false, error: "Los grupos de opciones no son válidos." }, 400);
          }

          normalizedOptions = [];
          for (const rawOption of body.options) {
            if (!rawOption || typeof rawOption !== "object" || Array.isArray(rawOption)) {
              return jsonResponse({ success: false, error: "Hay un grupo de opciones no válido." }, 400);
            }
            const option = rawOption as Record<string, unknown>;
            const optionName = typeof option.name === "string" ? option.name.trim() : "";
            const displayType = typeof option.displayType === "string" ? option.displayType : "SELECT";
            if (!optionName || optionName.length > 100) {
              return jsonResponse({ success: false, error: "Cada grupo de opciones debe tener un nombre de máximo 100 caracteres." }, 400);
            }
            if (!["SELECT", "RADIO", "CHECKBOX"].includes(displayType)) {
              return jsonResponse({ success: false, error: "El tipo de opción seleccionado no es compatible con el catálogo actual." }, 400);
            }
            const selectionType = displayType === "CHECKBOX" ? "MULTIPLE" : "SINGLE";
            const isRequired = option.isRequired === true;
            const minSelect = Number(option.minSelect ?? 0);
            const maxSelect = displayType === "CHECKBOX"
              ? Math.max(Number(option.maxSelect ?? 1), Array.isArray(option.values) ? option.values.length : 1)
              : Number(option.maxSelect ?? 1);
            const sortOrder = Number(option.sortOrder ?? 0);
            if (
              !Number.isSafeInteger(minSelect) || minSelect < 0 ||
              !Number.isSafeInteger(maxSelect) || maxSelect < 1 || maxSelect > 50 ||
              minSelect > maxSelect ||
              !Number.isSafeInteger(sortOrder) || sortOrder < 0
            ) {
              return jsonResponse({ success: false, error: "Los límites u orden de un grupo de opciones no son válidos." }, 400);
            }
            if (!Array.isArray(option.values) || option.values.length < 1 || option.values.length > 50) {
              return jsonResponse({ success: false, error: "Cada grupo debe tener entre 1 y 50 valores." }, 400);
            }

            const optionValues: Array<{ name: string; priceModifier: number; sortOrder: number }> = [];
            for (const rawValue of option.values) {
              if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
                return jsonResponse({ success: false, error: "Hay un valor de opción no válido." }, 400);
              }
              const optionValue = rawValue as Record<string, unknown>;
              const valueName = typeof optionValue.name === "string" ? optionValue.name.trim() : "";
              const priceModifier = Number(optionValue.priceModifier ?? 0);
              const valueSortOrder = Number(optionValue.sortOrder ?? 0);
              if (!valueName || valueName.length > 100) {
                return jsonResponse({ success: false, error: "Cada valor de opción debe tener un nombre de máximo 100 caracteres." }, 400);
              }
              if (!Number.isSafeInteger(priceModifier) || Math.abs(priceModifier) > 1000000000) {
                return jsonResponse({ success: false, error: "Los recargos de opciones deben ser valores enteros en pesos colombianos." }, 400);
              }
              if (!Number.isSafeInteger(valueSortOrder) || valueSortOrder < 0) {
                return jsonResponse({ success: false, error: "El orden de los valores no es válido." }, 400);
              }
              optionValues.push({ name: valueName, priceModifier, sortOrder: valueSortOrder });
            }

            normalizedOptions.push({
              name: optionName,
              selectionType,
              isRequired,
              minSelect,
              maxSelect,
              sortOrder,
              values: optionValues
            });
          }
        }

        const existing = await env.DB.prepare(
          "SELECT id FROM products WHERE id = ? LIMIT 1"
        ).bind(productId).first<{ id: string }>();

        if (!existing) {
          return jsonResponse({ success: false, error: "No se encontró el producto." }, 404);
        }

        const previousMediaUsage = submittedImages.provided ? await buildMediaUsageMap(env) : null;
        if (fields.length > 0) {
          fields.push("updated_at = CURRENT_TIMESTAMP");
          await env.DB.prepare(`
            UPDATE products
            SET ${fields.join(", ")}
            WHERE id = ?
          `).bind(...values, productId).run();
        }
        if (previousMediaUsage) await cleanupReleasedMediaReferences(env, previousMediaUsage);

        if (normalizedOptions !== null) {
          await env.DB.prepare(
            "DELETE FROM product_options WHERE product_id = ?"
          ).bind(productId).run();

          for (const option of normalizedOptions) {
            const optionId = crypto.randomUUID();
            await env.DB.prepare(`
              INSERT INTO product_options (
                id, product_id, name, selection_type, is_required,
                min_select, max_select, sort_order
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              optionId,
              productId,
              option.name,
              option.selectionType,
              option.isRequired ? 1 : 0,
              option.minSelect,
              option.maxSelect,
              option.sortOrder
            ).run();

            for (const value of option.values) {
              await env.DB.prepare(`
                INSERT INTO product_option_values (
                  id, option_id, name, price_delta_cop, is_available, sort_order
                ) VALUES (?, ?, ?, ?, 1, ?)
              `).bind(
                crypto.randomUUID(),
                optionId,
                value.name,
                value.priceModifier,
                value.sortOrder
              ).run();
            }
          }
        }

        return jsonResponse({
          success: true,
          message: "Producto actualizado correctamente."
        });
      }

      // Create product. Images are stored as a URL/path in image_url; this
      // Worker has no file-storage binding configured for binary uploads.
      if (path === "/api/menu/items" && request.method === "POST") {
        const admin = await getAdminForRequest(request, env);
        if (!admin) {
          return jsonResponse({ success: false, error: "Debes iniciar sesión." }, 401);
        }
        if (admin.role !== "SUPER_ADMIN" && admin.role !== "MANAGER") {
          return jsonResponse({ success: false, error: "No tienes permisos para crear productos." }, 403);
        }

        let parsedBody: unknown;
        try {
          parsedBody = await request.json();
        } catch {
          return jsonResponse({ success: false, error: "El contenido enviado no es JSON válido." }, 400);
        }
        if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
          return jsonResponse({ success: false, error: "Los datos del producto no son válidos." }, 400);
        }

        const body = parsedBody as Record<string, unknown>;
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const slugInput = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
        const slug = slugInput
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
        const description = typeof body.description === "string" ? body.description.trim() : "";
        const categoryId = typeof body.categoryId === "string" ? body.categoryId.trim() : "";
        const price = Number(body.price);
        const sortOrder = Number(body.sortOrder ?? 0);
        const stockQty = Number(body.stockQty ?? 0);
        const isActive = body.isActive !== false;
        const trackStock = body.trackStock === true;
        const submittedImages = readSubmittedImageGallery(body, 6);
        if (!submittedImages.valid) {
          return jsonResponse({ success: false, error: submittedImages.error }, 400);
        }
        const unavailableImage = await findUnavailableManagedMediaReference(env, submittedImages.images);
        if (unavailableImage) {
          return jsonResponse({ success: false, error: "Una fotografía del producto ya no está disponible. Vuelve a cargarla desde tu computador o celular." }, 409);
        }
        const images = submittedImages.images;
        const imageUrl = images[0] ?? "";

        if (name.length < 2 || name.length > 120) {
          return jsonResponse({ success: false, error: "El nombre debe tener entre 2 y 120 caracteres." }, 400);
        }
        if (!slug || slug.length > 150) {
          return jsonResponse({ success: false, error: "El enlace del producto no es válido. Revisa el nombre." }, 400);
        }
        if (!categoryId) {
          return jsonResponse({ success: false, error: "Selecciona una categoría." }, 400);
        }
        if (!Number.isSafeInteger(price) || price < 0 || price > 1000000000) {
          return jsonResponse({ success: false, error: "El precio debe ser un valor entero en pesos colombianos." }, 400);
        }
        if (!Number.isSafeInteger(sortOrder) || sortOrder < 0 || sortOrder > 1000000) {
          return jsonResponse({ success: false, error: "El orden del producto no es válido." }, 400);
        }
        if (!Number.isSafeInteger(stockQty) || stockQty < 0 || stockQty > 1000000000) {
          return jsonResponse({ success: false, error: "La existencia debe ser un número entero igual o mayor que cero." }, 400);
        }
        if (description.length > 2000) {
          return jsonResponse({ success: false, error: "La descripción supera los 2.000 caracteres." }, 400);
        }
        const category = await env.DB.prepare(
          "SELECT id FROM categories WHERE id = ? AND is_active = 1 LIMIT 1"
        ).bind(categoryId).first<{ id: string }>();
        if (!category) {
          return jsonResponse({ success: false, error: "La categoría seleccionada no existe o está inactiva." }, 400);
        }

        const duplicate = await env.DB.prepare(
          "SELECT id FROM products WHERE slug = ? LIMIT 1"
        ).bind(slug).first<{ id: string }>();
        if (duplicate) {
          return jsonResponse({ success: false, error: "Ya existe un producto con ese nombre o enlace." }, 409);
        }

        const rawOptions = body.options === undefined ? [] : body.options;
        if (!Array.isArray(rawOptions) || rawOptions.length > 30) {
          return jsonResponse({ success: false, error: "Los grupos de opciones no son válidos." }, 400);
        }

        const normalizedOptions: Array<{
          name: string;
          selectionType: "SINGLE" | "MULTIPLE";
          isRequired: boolean;
          minSelect: number;
          maxSelect: number;
          sortOrder: number;
          values: Array<{ name: string; priceModifier: number; sortOrder: number }>;
        }> = [];

        for (const rawOption of rawOptions) {
          if (!rawOption || typeof rawOption !== "object" || Array.isArray(rawOption)) {
            return jsonResponse({ success: false, error: "Hay un grupo de opciones no válido." }, 400);
          }
          const option = rawOption as Record<string, unknown>;
          const optionName = typeof option.name === "string" ? option.name.trim() : "";
          const displayType = typeof option.displayType === "string" ? option.displayType : "SELECT";
          if (!optionName || optionName.length > 100) {
            return jsonResponse({ success: false, error: "Cada grupo de opciones debe tener un nombre de máximo 100 caracteres." }, 400);
          }
          if (!["SELECT", "RADIO", "CHECKBOX"].includes(displayType)) {
            return jsonResponse({ success: false, error: "El tipo de opción seleccionado no es compatible con el catálogo actual." }, 400);
          }
          const selectionType = displayType === "CHECKBOX" ? "MULTIPLE" : "SINGLE";
          const isRequired = option.isRequired === true;
          const minSelect = Number(option.minSelect ?? 0);
          const maxSelect = displayType === "CHECKBOX"
              ? Math.max(Number(option.maxSelect ?? 1), Array.isArray(option.values) ? option.values.length : 1)
              : Number(option.maxSelect ?? 1);
          const optionSortOrder = Number(option.sortOrder ?? 0);
          if (
            !Number.isSafeInteger(minSelect) || minSelect < 0 ||
            !Number.isSafeInteger(maxSelect) || maxSelect < 1 || maxSelect > 50 ||
            minSelect > maxSelect ||
            !Number.isSafeInteger(optionSortOrder) || optionSortOrder < 0
          ) {
            return jsonResponse({ success: false, error: "Los límites u orden de un grupo de opciones no son válidos." }, 400);
          }
          if (!Array.isArray(option.values) || option.values.length < 1 || option.values.length > 50) {
            return jsonResponse({ success: false, error: "Cada grupo debe tener entre 1 y 50 valores." }, 400);
          }

          const optionValues: Array<{ name: string; priceModifier: number; sortOrder: number }> = [];
          for (const rawValue of option.values) {
            if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
              return jsonResponse({ success: false, error: "Hay un valor de opción no válido." }, 400);
            }
            const optionValue = rawValue as Record<string, unknown>;
            const valueName = typeof optionValue.name === "string" ? optionValue.name.trim() : "";
            const priceModifier = Number(optionValue.priceModifier ?? 0);
            const valueSortOrder = Number(optionValue.sortOrder ?? 0);
            if (!valueName || valueName.length > 100) {
              return jsonResponse({ success: false, error: "Cada valor de opción debe tener un nombre de máximo 100 caracteres." }, 400);
            }
            if (!Number.isSafeInteger(priceModifier) || Math.abs(priceModifier) > 1000000000) {
              return jsonResponse({ success: false, error: "Los recargos de opciones deben ser valores enteros en pesos colombianos." }, 400);
            }
            if (!Number.isSafeInteger(valueSortOrder) || valueSortOrder < 0) {
              return jsonResponse({ success: false, error: "El orden de los valores no es válido." }, 400);
            }
            optionValues.push({ name: valueName, priceModifier, sortOrder: valueSortOrder });
          }

          normalizedOptions.push({
            name: optionName,
            selectionType,
            isRequired,
            minSelect,
            maxSelect,
            sortOrder: optionSortOrder,
            values: optionValues
          });
        }

        const productId = crypto.randomUUID();
        await env.DB.prepare(`
          INSERT INTO products (
            id, category_id, name, slug, description, price_cop,
            image_url, image_gallery_json, is_available, track_stock, stock_quantity, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          productId,
          categoryId,
          name,
          slug,
          description || null,
          price,
          imageUrl || null,
          images.length ? JSON.stringify(images) : null,
          isActive ? 1 : 0,
          trackStock ? 1 : 0,
          stockQty,
          sortOrder
        ).run();

        try {
          for (const option of normalizedOptions) {
            const optionId = crypto.randomUUID();
            await env.DB.prepare(`
              INSERT INTO product_options (
                id, product_id, name, selection_type, is_required,
                min_select, max_select, sort_order
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              optionId,
              productId,
              option.name,
              option.selectionType,
              option.isRequired ? 1 : 0,
              option.minSelect,
              option.maxSelect,
              option.sortOrder
            ).run();

            for (const value of option.values) {
              await env.DB.prepare(`
                INSERT INTO product_option_values (
                  id, option_id, name, price_delta_cop, is_available, sort_order
                ) VALUES (?, ?, ?, ?, 1, ?)
              `).bind(
                crypto.randomUUID(),
                optionId,
                value.name,
                value.priceModifier,
                value.sortOrder
              ).run();
            }
          }
        } catch (error) {
          await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(productId).run();
          throw error;
        }

        return jsonResponse({
          success: true,
          message: "Producto creado correctamente.",
          data: { id: productId }
        }, 201);
      }

      // Product list serves both the storefront and authenticated admin.
      // The admin can also see inactive products; public visitors cannot.
      if (path === "/api/menu/items" && request.method === "GET") {
        const admin = await getAdminForRequest(request, env);
        const canManage = !!admin &&
          (admin.role === "SUPER_ADMIN" || admin.role === "MANAGER");

        const page = Math.max(
          1,
          Number.parseInt(url.searchParams.get("page") || "1", 10) || 1
        );
        const limit = Math.min(
          50,
          Math.max(1, Number.parseInt(url.searchParams.get("limit") || "20", 10) || 20)
        );

        const conditions = canManage
          ? ["1 = 1"]
          : ["p.is_available = 1", "c.is_active = 1"];
        const params: (string | number | null)[] = [];

        const categoryId = url.searchParams.get("categoryId");
        const search = (url.searchParams.get("search") || "").trim();

        if (categoryId) {
          conditions.push("p.category_id = ?");
          params.push(categoryId);
        }
        if (search) {
          if (search.length > 100) {
            return jsonResponse({ success: false, error: "La búsqueda supera los 100 caracteres." }, 400);
          }
          conditions.push("(p.name LIKE ? OR p.description LIKE ?)");
          params.push(`%${search}%`, `%${search}%`);
        }

        const where = conditions.join(" AND ");
        const count = await env.DB.prepare(`
          SELECT COUNT(*) AS total
          FROM products p
          INNER JOIN categories c ON c.id = p.category_id
          WHERE ${where}
        `).bind(...params).first<{ total: number }>();

        const result = await env.DB.prepare(`
          SELECT
            p.id,
            p.name,
            p.slug,
            p.description,
            p.price_cop AS price,
            COALESCE(p.image_url, p.image_key) AS image,
            p.image_gallery_json AS imageGalleryJson,
            p.is_available AS isActive,
            p.track_stock AS trackStock,
            p.stock_quantity AS stockQty,
            p.sort_order AS sortOrder,
            p.category_id AS categoryId,
            c.name AS categoryName,
            (SELECT COUNT(*) FROM product_options po WHERE po.product_id = p.id) AS optionCount
          FROM products p
          INNER JOIN categories c ON c.id = p.category_id
          WHERE ${where}
          ORDER BY p.sort_order ASC, p.name ASC
          LIMIT ? OFFSET ?
        `).bind(...params, limit, (page - 1) * limit).all<ProductRow & { optionCount: number }>();

        const items = result.results.map(product => ({
          id: product.id,
          name: product.name,
          slug: product.slug,
          description: product.description,
          price: Number(product.price),
          image: product.image,
          images: parseImageGallery(product.imageGalleryJson, product.image, 6),
          isActive: product.isActive === 1,
          trackStock: product.trackStock === 1,
          stockQty: Number(product.stockQty),
          sortOrder: Number(product.sortOrder),
          categoryId: product.categoryId,
          category: {
            id: product.categoryId,
            name: product.categoryName
          },
          _count: {
            options: Number(product.optionCount ?? 0),
            allergens: 0,
            mealtimes: 0
          }
        }));

        const total = Number(count?.total ?? 0);
        return jsonResponse({
          success: true,
          data: items,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        });
      }


      // Delivery zones for the single home-based business.
      // Event transport tariffs are stored separately from daily product delivery zones.
      // A municipality-wide tariff may coexist with sector-specific overrides; the
      // exact sector takes precedence in the admin quotation screen.
      if (path === "/api/event-delivery-zones" && request.method === "GET") {
        const admin = await getAdminForRequest(request, env);
        if (!admin || (admin.role !== "SUPER_ADMIN" && admin.role !== "MANAGER")) {
          return jsonResponse({ success: false, error: "No tienes autorización para consultar las tarifas de transporte de eventos." }, 403);
        }

        const result = await env.DB.prepare(`
          SELECT id, name, city, neighborhoods_json, fee_cop, is_active
          FROM event_delivery_zones
          ORDER BY city ASC, name ASC
        `).all<{
          id: string; name: string; city: string; neighborhoods_json: string;
          fee_cop: number; is_active: number;
        }>();

        const data = result.results.map(zone => {
          let neighborhoods: string[] = [];
          try {
            const parsed: unknown = JSON.parse(zone.neighborhoods_json || "[]");
            if (Array.isArray(parsed)) neighborhoods = parsed.filter((value): value is string => typeof value === "string");
          } catch { neighborhoods = []; }
          return {
            id: zone.id,
            name: zone.name,
            city: zone.city,
            neighborhoods,
            feeCop: Number(zone.fee_cop),
            isActive: zone.is_active === 1
          };
        });

        return jsonResponse({ success: true, data });
      }

      if (path === "/api/event-delivery-zones" && request.method === "POST") {
        const admin = await getAdminForRequest(request, env);
        if (!admin || (admin.role !== "SUPER_ADMIN" && admin.role !== "MANAGER")) {
          return jsonResponse({ success: false, error: "No tienes autorización para gestionar el transporte de eventos." }, 403);
        }

        const parsedBody: unknown = await request.json().catch(() => null);
        if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
          return jsonResponse({ success: false, error: "Los datos de la zona de eventos no son válidos." }, 400);
        }
        const body = parsedBody as Record<string, unknown>;
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const city = typeof body.city === "string" ? body.city.trim() : "";
        const rawNeighborhoods = body.neighborhoods === undefined ? [] : body.neighborhoods;
        if (!Array.isArray(rawNeighborhoods)) {
          return jsonResponse({ success: false, error: "Los barrios o sectores deben enviarse como una lista." }, 400);
        }
        const neighborhoods = rawNeighborhoods
          .filter((value): value is string => typeof value === "string")
          .map(value => value.trim().replace(/\s+/g, " "))
          .filter(Boolean)
          .filter((value, index, values) => values.findIndex(item => normalizeDeliveryZoneKey(item) === normalizeDeliveryZoneKey(value)) === index);
        const feeCop = body.feeCop;

        if (!name || !city || neighborhoods.length > 100) {
          return jsonResponse({ success: false, error: "Indica el nombre, el municipio y hasta 100 sectores. Puedes dejar los sectores vacíos para cubrir todo el municipio." }, 400);
        }
        if (typeof feeCop !== "number" || !Number.isSafeInteger(feeCop) || feeCop < 0 || feeCop > 1000000000) {
          return jsonResponse({ success: false, error: "Indica una tarifa de transporte válida en pesos colombianos." }, 400);
        }

        const activeZones = await env.DB.prepare(`
          SELECT id, name, city, neighborhoods_json
          FROM event_delivery_zones WHERE is_active = 1
        `).all<{ id: string; name: string; city: string; neighborhoods_json: string }>();
        const requestedKeys = new Set(neighborhoods.map(normalizeDeliveryZoneKey));
        for (const zone of activeZones.results) {
          if (normalizeDeliveryZoneKey(zone.city) !== normalizeDeliveryZoneKey(city)) continue;
          let existingAreas: unknown = [];
          try { existingAreas = JSON.parse(zone.neighborhoods_json || "[]"); } catch { existingAreas = []; }
          const existingNeighborhoods = Array.isArray(existingAreas)
            ? existingAreas.filter((value): value is string => typeof value === "string")
            : [];
          const overlaps = neighborhoods.length === 0 && existingNeighborhoods.length === 0
            ? ["la tarifa general del municipio"]
            : (neighborhoods.length > 0 && existingNeighborhoods.length > 0
              ? existingNeighborhoods.filter(area => requestedKeys.has(normalizeDeliveryZoneKey(area)))
              : []);
          if (overlaps.length > 0) {
            return jsonResponse({
              success: false,
              error: `La zona se cruza con "${zone.name}" (${overlaps.join(", ")}). Puedes mantener una tarifa general por municipio y crear sectores específicos con prioridad, pero no repetir un mismo sector en dos tarifas específicas.`
            }, 409);
          }
        }

        const id = crypto.randomUUID();
        await env.DB.prepare(`
          INSERT INTO event_delivery_zones (id, name, city, neighborhoods_json, fee_cop, is_active)
          VALUES (?, ?, ?, ?, ?, 1)
        `).bind(id, name, city, JSON.stringify(neighborhoods), feeCop).run();

        return jsonResponse({
          success: true,
          data: { id, name, city, neighborhoods, feeCop, isActive: true }
        }, 201);
      }

      const eventDeliveryZoneMatch = path.match(/^\/api\/event-delivery-zones\/([^/]+)$/);
      if (eventDeliveryZoneMatch && request.method === "PATCH") {
        const admin = await getAdminForRequest(request, env);
        if (!admin || (admin.role !== "SUPER_ADMIN" && admin.role !== "MANAGER")) {
          return jsonResponse({ success: false, error: "No tienes autorización para gestionar el transporte de eventos." }, 403);
        }

        const id = eventDeliveryZoneMatch[1];
        const existing = await env.DB.prepare(`
          SELECT id, name, city, neighborhoods_json, fee_cop, is_active
          FROM event_delivery_zones WHERE id = ? LIMIT 1
        `).bind(id).first<{
          id: string; name: string; city: string; neighborhoods_json: string; fee_cop: number; is_active: number;
        }>();
        if (!existing) return jsonResponse({ success: false, error: "No se encontró la tarifa de transporte." }, 404);

        const parsedBody: unknown = await request.json().catch(() => null);
        if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
          return jsonResponse({ success: false, error: "Los cambios enviados no son válidos." }, 400);
        }
        const body = parsedBody as Record<string, unknown>;
        const nextName = body.name === undefined ? existing.name : (typeof body.name === "string" ? body.name.trim() : "");
        const nextCity = body.city === undefined ? existing.city : (typeof body.city === "string" ? body.city.trim() : "");
        let nextNeighborhoods: string[] = [];
        try {
          const parsed: unknown = JSON.parse(existing.neighborhoods_json || "[]");
          if (Array.isArray(parsed)) nextNeighborhoods = parsed.filter((value): value is string => typeof value === "string");
        } catch { nextNeighborhoods = []; }
        if (body.neighborhoods !== undefined) {
          if (!Array.isArray(body.neighborhoods)) return jsonResponse({ success: false, error: "Los barrios o sectores deben enviarse como una lista." }, 400);
          nextNeighborhoods = body.neighborhoods
            .filter((value): value is string => typeof value === "string")
            .map(value => value.trim().replace(/\s+/g, " "))
            .filter(Boolean)
            .filter((value, index, values) => values.findIndex(item => normalizeDeliveryZoneKey(item) === normalizeDeliveryZoneKey(value)) === index);
        }
        const nextFeeCop = body.feeCop === undefined ? Number(existing.fee_cop) : body.feeCop;
        const nextIsActive = body.isActive === undefined ? existing.is_active === 1 : body.isActive;
        if (!nextName || !nextCity || nextNeighborhoods.length > 100) return jsonResponse({ success: false, error: "El nombre, municipio y máximo 100 sectores son obligatorios." }, 400);
        if (typeof nextFeeCop !== "number" || !Number.isSafeInteger(nextFeeCop) || nextFeeCop < 0 || nextFeeCop > 1000000000) return jsonResponse({ success: false, error: "La tarifa debe ser un valor entero no negativo en pesos colombianos." }, 400);
        if (typeof nextIsActive !== "boolean") return jsonResponse({ success: false, error: "El estado debe ser activo o pausado." }, 400);

        if (nextIsActive) {
          const activeZones = await env.DB.prepare(`
            SELECT id, name, city, neighborhoods_json FROM event_delivery_zones
            WHERE is_active = 1 AND id <> ?
          `).bind(id).all<{ id: string; name: string; city: string; neighborhoods_json: string }>();
          const requestedKeys = new Set(nextNeighborhoods.map(normalizeDeliveryZoneKey));
          for (const zone of activeZones.results) {
            if (normalizeDeliveryZoneKey(zone.city) !== normalizeDeliveryZoneKey(nextCity)) continue;
            let existingAreas: unknown = [];
            try { existingAreas = JSON.parse(zone.neighborhoods_json || "[]"); } catch { existingAreas = []; }
            const existingNeighborhoods = Array.isArray(existingAreas)
              ? existingAreas.filter((value): value is string => typeof value === "string")
              : [];
            const overlaps = nextNeighborhoods.length === 0 && existingNeighborhoods.length === 0
              ? ["la tarifa general del municipio"]
              : (nextNeighborhoods.length > 0 && existingNeighborhoods.length > 0
                ? existingNeighborhoods.filter(area => requestedKeys.has(normalizeDeliveryZoneKey(area)))
                : []);
            if (overlaps.length > 0) {
              return jsonResponse({ success: false, error: `La zona se cruza con "${zone.name}" (${overlaps.join(", ")}). No repitas un sector en dos tarifas específicas.` }, 409);
            }
          }
        }

        await env.DB.prepare(`
          UPDATE event_delivery_zones
          SET name = ?, city = ?, neighborhoods_json = ?, fee_cop = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(nextName, nextCity, JSON.stringify(nextNeighborhoods), nextFeeCop, nextIsActive ? 1 : 0, id).run();

        return jsonResponse({ success: true, data: { id, name: nextName, city: nextCity, neighborhoods: nextNeighborhoods, feeCop: nextFeeCop, isActive: nextIsActive } });
      }

      if (eventDeliveryZoneMatch && request.method === "DELETE") {
        const admin = await getAdminForRequest(request, env);
        if (!admin || (admin.role !== "SUPER_ADMIN" && admin.role !== "MANAGER")) {
          return jsonResponse({ success: false, error: "No tienes autorización para eliminar tarifas de eventos." }, 403);
        }
        const id = eventDeliveryZoneMatch[1];
        const existing = await env.DB.prepare("SELECT id FROM event_delivery_zones WHERE id = ? LIMIT 1").bind(id).first<{ id: string }>();
        if (!existing) return jsonResponse({ success: false, error: "No se encontró la tarifa de transporte." }, 404);
        await env.DB.prepare("DELETE FROM event_delivery_zones WHERE id = ?").bind(id).run();
        return jsonResponse({ success: true, message: "Tarifa de transporte eliminada. Las cotizaciones guardadas no cambian." });
      }

      if (path === "/api/delivery-zones" && request.method === "GET") {
        const admin = await getAdminForRequest(request, env);
        const canManage = !!admin &&
          (admin.role === "SUPER_ADMIN" || admin.role === "MANAGER");

        const result = await env.DB.prepare(`
          SELECT id, name, city, neighborhoods_json, fee_cop,
                 minimum_order_cop, is_active
          FROM delivery_zones
          ${canManage ? "" : "WHERE is_active = 1"}
          ORDER BY city ASC, name ASC
        `).all<{
          id: string;
          name: string;
          city: string | null;
          neighborhoods_json: string;
          fee_cop: number;
          minimum_order_cop: number;
          is_active: number;
        }>();

        const data = result.results.map(zone => {
          let neighborhoods: string[] = [];
          try {
            const parsed: unknown = JSON.parse(zone.neighborhoods_json || "[]");
            if (Array.isArray(parsed)) {
              neighborhoods = parsed.filter(
                (value): value is string => typeof value === "string"
              );
            }
          } catch {
            neighborhoods = [];
          }

          return {
            id: zone.id,
            name: zone.name,
            city: zone.city,
            neighborhoods,
            feeCop: Number(zone.fee_cop),
            minimumOrderCop: Number(zone.minimum_order_cop),
            isActive: zone.is_active === 1
          };
        });

        return jsonResponse({ success: true, data });
      }

      if (path === "/api/delivery-zones" && request.method === "POST") {
        const admin = await getAdminForRequest(request, env);
        if (!admin || (admin.role !== "SUPER_ADMIN" && admin.role !== "MANAGER")) {
          return jsonResponse({ success: false, error: "No tienes autorización para gestionar zonas de domicilio." }, 403);
        }

        const parsedBody: unknown = await request.json().catch(() => null);
        if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
          return jsonResponse({ success: false, error: "Los datos de la zona no son válidos." }, 400);
        }

        const body = parsedBody as Record<string, unknown>;
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const city = typeof body.city === "string" ? body.city.trim() : "";
        const neighborhoodsRaw = Array.isArray(body.neighborhoods) ? body.neighborhoods : [];
        const neighborhoods = neighborhoodsRaw
          .filter((value): value is string => typeof value === "string")
          .map(value => value.trim())
          .filter(Boolean)
          .filter((value, index, values) =>
            values.findIndex(item => normalizeDeliveryZoneKey(item) === normalizeDeliveryZoneKey(value)) === index
          );

        const feeCop = body.feeCop;
        const minimumOrderCop = body.minimumOrderCop;

        if (!name || !city || neighborhoods.length === 0 || neighborhoods.length > 100) {
          return jsonResponse({ success: false, error: "Indica el nombre, la ciudad y al menos un barrio (máximo 100)." }, 400);
        }

        if (
          typeof feeCop !== "number" ||
          !Number.isSafeInteger(feeCop) ||
          feeCop < 0 ||
          typeof minimumOrderCop !== "number" ||
          !Number.isSafeInteger(minimumOrderCop) ||
          minimumOrderCop < 0
        ) {
          return jsonResponse({ success: false, error: "Los valores del domicilio y pedido mínimo deben ser pesos enteros no negativos." }, 400);
        }
        const activeZones = await env.DB.prepare(`
          SELECT id, name, city, neighborhoods_json
          FROM delivery_zones
          WHERE is_active = 1
        `).all<{ id: string; name: string; city: string | null; neighborhoods_json: string }>();
        const requestedNeighborhoods = new Set(neighborhoods.map(normalizeDeliveryZoneKey));
        for (const zone of activeZones.results) {
          if (normalizeDeliveryZoneKey(zone.city || "") !== normalizeDeliveryZoneKey(city)) continue;
          let currentNeighborhoods: unknown = [];
          try { currentNeighborhoods = JSON.parse(zone.neighborhoods_json || "[]"); } catch { currentNeighborhoods = []; }
          if (!Array.isArray(currentNeighborhoods)) continue;
          const conflicts = currentNeighborhoods.filter((value): value is string =>
            typeof value === "string" && requestedNeighborhoods.has(normalizeDeliveryZoneKey(value))
          );
          if (conflicts.length > 0) {
            return jsonResponse({
              success: false,
              error: `Los barrios ${conflicts.join(", ")} ya están asignados a la zona "${zone.name}" en ese municipio. Cada barrio debe pertenecer a una sola zona activa para evitar tarifas duplicadas.`
            }, 409);
          }
        }

        const id = crypto.randomUUID();
        await env.DB.prepare(`
          INSERT INTO delivery_zones (
            id, name, city, neighborhoods_json,
            fee_cop, minimum_order_cop, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, 1)
        `).bind(
          id, name, city, JSON.stringify(neighborhoods),
          feeCop, minimumOrderCop
        ).run();

        return jsonResponse({
          success: true,
          data: {
            id, name, city, neighborhoods, feeCop,
            minimumOrderCop, isActive: true
          }
        }, 201);
      }

      const deliveryZoneMatch = path.match(/^\/api\/delivery-zones\/([^/]+)$/);

      if (deliveryZoneMatch && request.method === "PATCH") {
        const admin = await getAdminForRequest(request, env);
        if (!admin || (admin.role !== "SUPER_ADMIN" && admin.role !== "MANAGER")) {
          return jsonResponse({ success: false, error: "No tienes autorización para gestionar zonas de domicilio." }, 403);
        }

        const id = deliveryZoneMatch[1];
        const existing = await env.DB.prepare(
          "SELECT id, name, city, neighborhoods_json, is_active FROM delivery_zones WHERE id = ? LIMIT 1"
        ).bind(id).first<{
          id: string;
          name: string;
          city: string | null;
          neighborhoods_json: string;
          is_active: number;
        }>();

        if (!existing) {
          return jsonResponse({ success: false, error: "No se encontró la zona de domicilio." }, 404);
        }

        const parsedBody: unknown = await request.json().catch(() => null);
        if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
          return jsonResponse({ success: false, error: "Los datos enviados no son válidos." }, 400);
        }

        const body = parsedBody as Record<string, unknown>;
        const fields: string[] = [];
        const values: (string | number | null)[] = [];

        if ("name" in body) {
          if (typeof body.name !== "string" || !body.name.trim()) {
            return jsonResponse({ success: false, error: "El nombre de la zona es obligatorio." }, 400);
          }
          fields.push("name = ?");
          values.push(body.name.trim());
        }

        if ("city" in body) {
          if (typeof body.city !== "string" || !body.city.trim()) {
            return jsonResponse({ success: false, error: "La ciudad es obligatoria." }, 400);
          }
          fields.push("city = ?");
          values.push(body.city.trim());
        }

        if ("neighborhoods" in body) {
          if (!Array.isArray(body.neighborhoods)) {
            return jsonResponse({ success: false, error: "Los barrios deben enviarse como una lista." }, 400);
          }
          const neighborhoods = body.neighborhoods
            .filter((value): value is string => typeof value === "string")
            .map(value => value.trim())
            .filter(Boolean)
            .filter((value, index, values) =>
              values.findIndex(item => normalizeDeliveryZoneKey(item) === normalizeDeliveryZoneKey(value)) === index
            );

          if (neighborhoods.length === 0 || neighborhoods.length > 100) {
            return jsonResponse({ success: false, error: "La zona debe tener entre 1 y 100 barrios válidos." }, 400);
          }
          fields.push("neighborhoods_json = ?");
          values.push(JSON.stringify(neighborhoods));
        }

        if ("feeCop" in body) {
          if (typeof body.feeCop !== "number" || !Number.isSafeInteger(body.feeCop) || body.feeCop < 0) {
            return jsonResponse({ success: false, error: "El costo del domicilio debe ser un valor entero no negativo." }, 400);
          }
          fields.push("fee_cop = ?");
          values.push(body.feeCop);
        }

        if ("minimumOrderCop" in body) {
          if (typeof body.minimumOrderCop !== "number" || !Number.isSafeInteger(body.minimumOrderCop) || body.minimumOrderCop < 0) {
            return jsonResponse({ success: false, error: "El pedido mínimo debe ser un valor entero no negativo." }, 400);
          }
          fields.push("minimum_order_cop = ?");
          values.push(body.minimumOrderCop);
        }

        if ("isActive" in body) {
          if (typeof body.isActive !== "boolean") {
            return jsonResponse({ success: false, error: "El estado activo debe ser verdadero o falso." }, 400);
          }
          fields.push("is_active = ?");
          values.push(body.isActive ? 1 : 0);
        }

        const requestedZoneIsActive = "isActive" in body
          ? body.isActive === true
          : existing.is_active === 1;
        if (requestedZoneIsActive) {
          const requestedCity = typeof body.city === "string" ? body.city.trim() : (existing.city || "");
          let requestedNeighborhoods: unknown = [];
          if (Array.isArray(body.neighborhoods)) {
            requestedNeighborhoods = body.neighborhoods
              .filter((value): value is string => typeof value === "string")
              .map(value => value.trim())
              .filter(Boolean);
          } else {
            try { requestedNeighborhoods = JSON.parse(existing.neighborhoods_json || "[]"); } catch { requestedNeighborhoods = []; }
          }
          const requestedKeys = new Set(
            (Array.isArray(requestedNeighborhoods) ? requestedNeighborhoods : [])
              .filter((value): value is string => typeof value === "string")
              .map(normalizeDeliveryZoneKey)
          );
          const otherActiveZones = await env.DB.prepare(`
            SELECT id, name, city, neighborhoods_json
            FROM delivery_zones
            WHERE is_active = 1 AND id <> ?
          `).bind(id).all<{ id: string; name: string; city: string | null; neighborhoods_json: string }>();
          for (const zone of otherActiveZones.results) {
            if (normalizeDeliveryZoneKey(zone.city || "") !== normalizeDeliveryZoneKey(requestedCity)) continue;
            let currentNeighborhoods: unknown = [];
            try { currentNeighborhoods = JSON.parse(zone.neighborhoods_json || "[]"); } catch { currentNeighborhoods = []; }
            if (!Array.isArray(currentNeighborhoods)) continue;
            const conflicts = currentNeighborhoods.filter((value): value is string =>
              typeof value === "string" && requestedKeys.has(normalizeDeliveryZoneKey(value))
            );
            if (conflicts.length > 0) {
              return jsonResponse({
                success: false,
                error: `Los barrios ${conflicts.join(", ")} ya están asignados a la zona "${zone.name}" en ese municipio. Cada barrio debe pertenecer a una sola zona activa para evitar tarifas duplicadas.`
              }, 409);
            }
          }
        }

        if (fields.length === 0) {
          return jsonResponse({ success: false, error: "No se recibieron cambios válidos." }, 400);
        }

        fields.push("updated_at = CURRENT_TIMESTAMP");
        values.push(id);

        await env.DB.prepare(
          `UPDATE delivery_zones SET ${fields.join(", ")} WHERE id = ?`
        ).bind(...values).run();

        return jsonResponse({ success: true, message: "Zona actualizada correctamente." });
      }

      if (deliveryZoneMatch && request.method === "DELETE") {
        const admin = await getAdminForRequest(request, env);
        if (!admin || (admin.role !== "SUPER_ADMIN" && admin.role !== "MANAGER")) {
          return jsonResponse({ success: false, error: "No tienes autorización para gestionar zonas de domicilio." }, 403);
        }

        const id = deliveryZoneMatch[1];
        const existing = await env.DB.prepare(
          "SELECT id FROM delivery_zones WHERE id = ? LIMIT 1"
        ).bind(id).first<{ id: string }>();

        if (!existing) {
          return jsonResponse({ success: false, error: "No se encontró la zona de domicilio." }, 404);
        }

        const relatedOrders = await env.DB.prepare(
          "SELECT COUNT(*) AS total FROM orders WHERE delivery_zone_id = ?"
        ).bind(id).first<{ total: number }>();

        if (Number(relatedOrders?.total ?? 0) > 0) {
          return jsonResponse({
            success: false,
            error: "Esta zona está asociada a pedidos anteriores. Desactívala en lugar de eliminarla."
          }, 409);
        }

        await env.DB.prepare(
          "DELETE FROM delivery_zones WHERE id = ?"
        ).bind(id).run();

        return jsonResponse({ success: true, message: "Zona eliminada correctamente." });
      }
      // Public guest order creation. Prices and delivery fees are calculated server-side.
      // Supports DELIVERY and PICKUP, with cash or configured advance-transfer methods.
      if (path === "/api/orders" && request.method === "POST") {
        const parsedBody: unknown = await request.json().catch(() => null);

        if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
          return jsonResponse({ success: false, error: "Los datos del pedido no son válidos." }, 400);
        }

        const body = parsedBody as Record<string, unknown>;
        const orderType = String(body.orderType || "").trim().toUpperCase();

        if (orderType !== "DELIVERY" && orderType !== "PICKUP") {
          return jsonResponse({
            success: false,
            error: "Selecciona domicilio o recogida en el establecimiento."
          }, 400);
        }

        const paymentMethodInput = String(body.paymentMethod || "").trim().toUpperCase();
        const paymentMethodAliases: Record<string, string> = {
          CASH: "CASH",
          EFECTIVO: "CASH",
          BANCOLOMBIA: "BANCOLOMBIA",
          NEQUI: "NEQUI",
          BREB: "BREB",
          "LLAVE BRE-B": "BREB"
        };
        const selectedPaymentMethod = paymentMethodAliases[paymentMethodInput];

        if (!selectedPaymentMethod) {
          return jsonResponse({
            success: false,
            error: "Selecciona efectivo, Bancolombia, Nequi o Llave Bre-B."
          }, 400);
        }

        const settings = await env.DB.prepare(`
          SELECT allow_delivery, allow_pickup, free_delivery_enabled, free_delivery_min_units,
                 accept_orders, allow_scheduled_orders, allow_cash_payment,
                 allow_guest_checkout, minimum_delivery_order_cop, minimum_pickup_order_cop
          FROM site_settings
          WHERE id = 'default'
          LIMIT 1
        `).first<{
          allow_delivery: number;
          allow_pickup: number;
          free_delivery_enabled: number;
          free_delivery_min_units: number;
          accept_orders: number;
          allow_scheduled_orders: number;
          allow_cash_payment: number;
          allow_guest_checkout: number;
          minimum_delivery_order_cop: number;
          minimum_pickup_order_cop: number;
        }>();

        if (!settings) {
          return jsonResponse({
            success: false,
            error: "No fue posible consultar la configuración del negocio."
          }, 500);
        }

        if (settings.accept_orders !== 1 || settings.allow_guest_checkout !== 1) {
          return jsonResponse({ success: false, error: "El negocio no está recibiendo pedidos en línea en este momento." }, 409);
        }

        if (selectedPaymentMethod === "CASH" && settings.allow_cash_payment !== 1) {
          return jsonResponse({ success: false, error: "El pago en efectivo no está disponible. Selecciona otro medio de pago." }, 409);
        }

        const scheduledAtInput = typeof body.scheduledAt === "string" && body.scheduledAt.trim()
          ? body.scheduledAt.trim().slice(0, 40)
          : null;
        if (scheduledAtInput && settings.allow_scheduled_orders !== 1) {
          return jsonResponse({ success: false, error: "Los pedidos programados no están disponibles actualmente." }, 409);
        }

        if (orderType === "DELIVERY" && settings.allow_delivery !== 1) {
          return jsonResponse({ success: false, error: "El servicio a domicilio no está disponible." }, 409);
        }

        if (orderType === "PICKUP" && settings.allow_pickup !== 1) {
          return jsonResponse({ success: false, error: "La recogida en el establecimiento no está disponible." }, 409);
        }

        // The database stores CASH for cash-on-delivery and TRANSFER for advance transfers.
        // The exact electronic method is stored separately in payment_method_detail.
        const storedPaymentMethod: "CASH" | "TRANSFER" =
          selectedPaymentMethod === "CASH" ? "CASH" : "TRANSFER";
        let paymentMethodDetail: string | null = null;

        if (selectedPaymentMethod !== "CASH") {
          const activePaymentMethod = await env.DB.prepare(`
            SELECT method_code
            FROM payment_methods
            WHERE method_code = ? AND is_enabled = 1
            LIMIT 1
          `).bind(selectedPaymentMethod).first<{ method_code: string }>();

          if (!activePaymentMethod) {
            return jsonResponse({
              success: false,
              error: "Ese medio de pago no está habilitado actualmente. Selecciona otro o comunícate con el negocio."
            }, 409);
          }

          paymentMethodDetail = activePaymentMethod.method_code;
        }

        const customerName = typeof body.guestName === "string" ? body.guestName.trim() : "";
        const customerPhone = typeof body.guestPhone === "string" ? body.guestPhone.trim() : "";
        const customerEmail = typeof body.guestEmail === "string" ? body.guestEmail.trim() : "";
        // WhatsApp notifications are optional and require the customer's explicit opt-in.
        const whatsappUpdatesConsent = body.whatsappUpdatesConsent === true;
        const whatsappUpdatesConsentAt = whatsappUpdatesConsent ? new Date().toISOString() : null;

        if (!customerName || customerName.length > 120 || !customerPhone || customerPhone.length > 30) {
          return jsonResponse({ success: false, error: "Escribe el nombre y el teléfono de contacto del cliente." }, 400);
        }

        if (customerEmail && (customerEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail))) {
          return jsonResponse({ success: false, error: "El correo electrónico no es válido." }, 400);
        }

        const normalizeText = (value: string) =>
          value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("es");

        let addressLine: string | null = null;
        let addressReference: string | null = null;
        let neighborhood: string | null = null;
        let orderCity: string | null = null;
        let matchedZone: {
          id: string;
          name: string;
          city: string | null;
          neighborhoods_json: string;
          fee_cop: number;
          minimum_order_cop: number;
        } | null = null;

        if (orderType === "DELIVERY") {
          const address = body.address;
          if (!address || typeof address !== "object" || Array.isArray(address)) {
            return jsonResponse({ success: false, error: "Debes indicar la dirección de entrega." }, 400);
          }

          const addressData = address as Record<string, unknown>;
          addressLine = typeof addressData.line1 === "string" ? addressData.line1.trim() : "";
          addressReference = typeof addressData.line2 === "string" ? addressData.line2.trim() : "";
          neighborhood = typeof addressData.neighborhood === "string" ? addressData.neighborhood.trim() : "";
          const city = typeof addressData.city === "string" ? addressData.city.trim() : "";

          if (
            !addressLine || addressLine.length > 250 ||
            !neighborhood || neighborhood.length > 100 ||
            !city || city.length > 120 ||
            addressReference.length > 250
          ) {
            return jsonResponse({
              success: false,
              error: "Completa la dirección, el barrio y el municipio."
            }, 400);
          }

          const zonesResult = await env.DB.prepare(`
            SELECT id, name, city, neighborhoods_json, fee_cop, minimum_order_cop
            FROM delivery_zones
            WHERE is_active = 1
          `).all<{
            id: string;
            name: string;
            city: string | null;
            neighborhoods_json: string;
            fee_cop: number;
            minimum_order_cop: number;
          }>();

          for (const zone of zonesResult.results) {
            if (normalizeText(zone.city || "") !== normalizeText(city)) continue;

            let neighborhoods: unknown;
            try {
              neighborhoods = JSON.parse(zone.neighborhoods_json || "[]");
            } catch {
              neighborhoods = [];
            }

            if (Array.isArray(neighborhoods)) {
              const matchesExactNeighborhood = neighborhoods.some((entry) =>
                typeof entry === "string" && normalizeText(entry) === normalizeText(neighborhood || "")
              );
              const allowsOtherNeighborhood = neighborhoods.some((entry) =>
                typeof entry === "string" && normalizeText(entry) === normalizeText("Otro barrio o sector")
              );

              // Prefer an exact neighborhood tariff. If none exists, use the
              // municipality's general fallback zone.
              if (matchesExactNeighborhood) {
                matchedZone = zone;
                break;
              }
              if (allowsOtherNeighborhood && !matchedZone) {
                matchedZone = zone;
              }
            }
          }

          if (!matchedZone) {
            return jsonResponse({
              success: false,
              error: "Todavía no tenemos cobertura para ese barrio. Verifica el municipio y el barrio o comunícate con el negocio."
            }, 400);
          }

          orderCity = matchedZone.city;
        }

        if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 30) {
          return jsonResponse({ success: false, error: "El pedido debe contener entre 1 y 30 productos." }, 400);
        }

        const normalizedItems: {
          id: string;
          productId: string;
          name: string;
          unitPrice: number;
          quantity: number;
          lineTotal: number;
          optionsSnapshot: string;
          itemNotes: string | null;
          responseOptions: { id: string; name: string; value: string; priceModifier: number }[];
        }[] = [];

        let subtotal = 0;
        let quantityTotal = 0;

        for (const rawItem of body.items) {
          if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) {
            return jsonResponse({ success: false, error: "Hay un producto con información inválida." }, 400);
          }

          const item = rawItem as Record<string, unknown>;
          const productId = typeof item.menuItemId === "string" ? item.menuItemId : "";
          const quantity = item.quantity;

          if (!productId || typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 50) {
            return jsonResponse({ success: false, error: "Un producto tiene un identificador o cantidad inválidos." }, 400);
          }

          const product = await env.DB.prepare(`
            SELECT id, name, price_cop AS price, is_available AS isAvailable,
                   track_stock AS trackStock, stock_quantity AS stockQuantity
            FROM products
            WHERE id = ?
            LIMIT 1
          `).bind(productId).first<{
            id: string;
            name: string;
            price: number;
            isAvailable: number;
            trackStock: number;
            stockQuantity: number;
          }>();

          if (!product || product.isAvailable !== 1) {
            return jsonResponse({ success: false, error: "Uno de los productos ya no está disponible." }, 409);
          }

          if (product.trackStock === 1) {
            return jsonResponse({ success: false, error: "Este producto requiere una validación de inventario que aún no está habilitada para pedidos en línea." }, 409);
          }

          const optionGroups = await env.DB.prepare(`
            SELECT id, name, selection_type AS selectionType,
                   is_required AS isRequired, min_select AS minSelect,
                   max_select AS maxSelect
            FROM product_options
            WHERE product_id = ?
          `).bind(productId).all<{
            id: string;
            name: string;
            selectionType: string;
            isRequired: number;
            minSelect: number;
            maxSelect: number;
          }>();

          if (item.options !== undefined && !Array.isArray(item.options)) {
            return jsonResponse({ success: false, error: "Las opciones de un producto no son válidas." }, 400);
          }

          const submittedOptions = Array.isArray(item.options) ? item.options : [];
          const selectedCounts = new Map<string, number>();
          const selectedIds = new Set<string>();
          const optionSnapshots: {
            id: string;
            name: string;
            value: string;
            priceModifier: number;
          }[] = [];

          let optionsTotal = 0;

          for (const rawOption of submittedOptions) {
            if (!rawOption || typeof rawOption !== "object" || Array.isArray(rawOption)) {
              return jsonResponse({ success: false, error: "Una opción de producto no es válida." }, 400);
            }

            const optionInput = rawOption as Record<string, unknown>;
            const valueId = typeof optionInput.menuOptionValueId === "string" ? optionInput.menuOptionValueId : "";

            if (!valueId || selectedIds.has(valueId)) {
              return jsonResponse({ success: false, error: "Hay opciones repetidas o inválidas en un producto." }, 400);
            }

            const selectedValue = await env.DB.prepare(`
              SELECT pov.id, pov.name AS valueName,
                     pov.price_delta_cop AS priceModifier,
                     po.id AS optionId, po.name AS optionName,
                     po.max_select AS maxSelect,
                     po.selection_type AS selectionType
              FROM product_option_values pov
              INNER JOIN product_options po ON po.id = pov.option_id
              WHERE pov.id = ?
                AND po.product_id = ?
                AND pov.is_available = 1
            `).bind(valueId, productId).first<{
              id: string;
              valueName: string;
              priceModifier: number;
              optionId: string;
              optionName: string;
              maxSelect: number;
              selectionType: string;
            }>();

            if (!selectedValue) {
              return jsonResponse({ success: false, error: "Una opción seleccionada ya no está disponible." }, 409);
            }

            selectedIds.add(valueId);
            const count = (selectedCounts.get(selectedValue.optionId) || 0) + 1;
            selectedCounts.set(selectedValue.optionId, count);

            const maxAllowed = selectedValue.selectionType === "SINGLE"
              ? 1
              : Number(selectedValue.maxSelect);

            if (count > maxAllowed) {
              return jsonResponse({ success: false, error: "Seleccionaste demasiadas opciones para un producto." }, 400);
            }

            const modifier = Number(selectedValue.priceModifier);
            if (!Number.isSafeInteger(modifier)) {
              return jsonResponse({ success: false, error: "El precio de una opción no es válido." }, 500);
            }

            optionsTotal += modifier;
            optionSnapshots.push({
              id: selectedValue.id,
              name: selectedValue.optionName,
              value: selectedValue.valueName,
              priceModifier: modifier
            });
          }

          for (const group of optionGroups.results) {
            const selectedCount = selectedCounts.get(group.id) || 0;
            if (group.isRequired === 1 && selectedCount < group.minSelect) {
              return jsonResponse({
                success: false,
                error: `Debes completar las opciones obligatorias de ${product.name}: ${group.name}.`
              }, 400);
            }
            if (selectedCount > group.maxSelect) {
              return jsonResponse({ success: false, error: `Hay demasiadas opciones seleccionadas para ${product.name}.` }, 400);
            }
          }

          const unitPrice = Number(product.price);
          const finalUnitPrice = unitPrice + optionsTotal;
          const lineTotal = finalUnitPrice * quantity;

          if (
            !Number.isSafeInteger(unitPrice) || unitPrice < 0 ||
            !Number.isSafeInteger(finalUnitPrice) || finalUnitPrice < 0 ||
            !Number.isSafeInteger(lineTotal) || lineTotal < 0
          ) {
            return jsonResponse({ success: false, error: "No fue posible calcular el precio de un producto." }, 500);
          }

          const itemNotes = typeof item.comment === "string" ? item.comment.trim().slice(0, 500) : null;

          normalizedItems.push({
            id: crypto.randomUUID(),
            productId,
            name: product.name,
            unitPrice,
            quantity,
            lineTotal,
            optionsSnapshot: JSON.stringify(optionSnapshots),
            itemNotes,
            responseOptions: optionSnapshots
          });

          subtotal += lineTotal;
          quantityTotal += quantity;
        }

        if (quantityTotal < 1 || quantityTotal > 100 || !Number.isSafeInteger(subtotal) || subtotal < 0) {
          return jsonResponse({ success: false, error: "La cantidad total o el valor del pedido no son válidos." }, 400);
        }

        const configuredMinimum = orderType === "DELIVERY"
          ? Number(settings.minimum_delivery_order_cop)
          : Number(settings.minimum_pickup_order_cop);
        if (subtotal < configuredMinimum) {
          const formattedMinimum = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(configuredMinimum);
          return jsonResponse({ success: false, error: `El pedido mínimo para esta modalidad es ${formattedMinimum}.` }, 400);
        }

        // La zona puede tener un mínimo adicional al configurado para todo el negocio.
        if (orderType === "DELIVERY" && matchedZone && subtotal < Number(matchedZone.minimum_order_cop)) {
          return jsonResponse({
            success: false,
            error: `El pedido mínimo para esta zona es ${new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(matchedZone.minimum_order_cop))}.`
          }, 400);
        }

        const freeDeliveryApplies =
          orderType === "DELIVERY" &&
          settings.free_delivery_enabled === 1 &&
          quantityTotal >= Number(settings.free_delivery_min_units);

        // Pickup is always free. Delivery uses the matched zone fee, unless its
        // configured free-delivery threshold applies.
        const deliveryFee = orderType === "PICKUP"
          ? 0
          : freeDeliveryApplies
            ? 0
            : Number(matchedZone?.fee_cop ?? 0);
        const discount = 0;
        const total = subtotal + deliveryFee;

        if (!Number.isSafeInteger(deliveryFee) || deliveryFee < 0 || !Number.isSafeInteger(total)) {
          return jsonResponse({ success: false, error: "No fue posible calcular el total del pedido." }, 400);
        }

        const id = crypto.randomUUID();
        const orderNumber = `LD-${Date.now()}-${id.slice(0, 8).toUpperCase()}`;
        const customerNotes = typeof body.comment === "string" ? body.comment.trim().slice(0, 1000) : null;
        const scheduledAt = scheduledAtInput;

        const statements: D1PreparedStatement[] = [
          env.DB.prepare(`
            INSERT INTO orders (
              id, order_number, customer_name, customer_phone, customer_email,
              order_type, status, address_line, neighborhood, city,
              address_reference, delivery_zone_id, delivery_zone_name_snapshot,
              item_quantity_total, subtotal_cop, delivery_fee_cop, discount_cop,
              total_cop, payment_method, payment_method_detail, payment_status,
              scheduled_for, customer_notes,
              whatsapp_updates_consent, whatsapp_updates_consent_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            id, orderNumber, customerName, customerPhone, customerEmail || null,
            orderType, "PENDING", addressLine, neighborhood, orderCity,
            addressReference || null, matchedZone?.id ?? null, matchedZone?.name ?? null,
            quantityTotal, subtotal, deliveryFee, discount, total,
            storedPaymentMethod, paymentMethodDetail, "PENDING", scheduledAt, customerNotes,
            whatsappUpdatesConsent ? 1 : 0, whatsappUpdatesConsentAt
          )
        ];

        for (const item of normalizedItems) {
          statements.push(
            env.DB.prepare(`
              INSERT INTO order_items (
                id, order_id, product_id, product_name_snapshot,
                unit_price_cop, quantity, line_total_cop,
                options_snapshot_json, item_notes
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              item.id, id, item.productId, item.name, item.unitPrice,
              item.quantity, item.lineTotal, item.optionsSnapshot, item.itemNotes
            )
          );
        }

        await env.DB.batch(statements);

        const createdAt = new Date().toISOString();
        const responseOrder = {
          id,
          orderNumber,
          orderType,
          status: "PENDING",
          paymentMethod: selectedPaymentMethod,
          paymentStatus: "PENDING",
          subtotal,
          tax: 0,
          deliveryFee,
          discount,
          total,
          comment: customerNotes,
          scheduledAt,
          createdAt,
          items: normalizedItems.map(item => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.lineTotal,
            comment: item.itemNotes,
            options: item.responseOptions
          }))
        };

        return jsonResponse({ success: true, data: responseOrder }, 201);
      }

      // Public order detail by unguessable order ID. Customer contact data is not exposed.
      const publicOrderMatch = path.match(/^\/api\/orders\/([^/]+)$/);
      if (publicOrderMatch && request.method === "GET") {
        const orderId = publicOrderMatch[1];

        const order = await env.DB.prepare(`
          SELECT id, order_number AS orderNumber, order_type AS orderType,
                 status, payment_method AS paymentMethod,
                 payment_method_detail AS paymentMethodDetail,
                 payment_status AS paymentStatus,
                 subtotal_cop AS subtotal,
                 delivery_fee_cop AS deliveryFee, discount_cop AS discount,
                 total_cop AS total, customer_notes AS comment,
                 scheduled_for AS scheduledAt, created_at AS createdAt
          FROM orders
          WHERE id = ?
          LIMIT 1
        `).bind(orderId).first<{
          id: string;
          orderNumber: string;
          orderType: string;
          status: string;
          paymentMethod: string;
          paymentMethodDetail: string | null;
          paymentStatus: string;
          subtotal: number;
          deliveryFee: number;
          discount: number;
          total: number;
          comment: string | null;
          scheduledAt: string | null;
          createdAt: string;
        }>();

        if (!order) {
          return jsonResponse({ success: false, error: "No se encontró el pedido." }, 404);
        }

        const itemsResult = await env.DB.prepare(`
          SELECT id, product_name_snapshot AS name, unit_price_cop AS unitPrice,
                 quantity, line_total_cop AS subtotal,
                 options_snapshot_json AS optionsJson, item_notes AS comment
          FROM order_items
          WHERE order_id = ?
        `).bind(orderId).all<{
          id: string;
          name: string;
          unitPrice: number;
          quantity: number;
          subtotal: number;
          optionsJson: string;
          comment: string | null;
        }>();

        const items = itemsResult.results.map(item => {
          let options: unknown[] = [];
          try {
            const parsed: unknown = JSON.parse(item.optionsJson || "[]");
            if (Array.isArray(parsed)) options = parsed;
          } catch {
            options = [];
          }

          return {
            id: item.id,
            name: item.name,
            unitPrice: Number(item.unitPrice),
            quantity: Number(item.quantity),
            subtotal: Number(item.subtotal),
            comment: item.comment,
            options
          };
        });

        return jsonResponse({
          success: true,
          data: {
            ...order,
            subtotal: Number(order.subtotal),
            tax: 0,
            deliveryFee: Number(order.deliveryFee),
            discount: Number(order.discount),
            total: Number(order.total),
            items
          }
        });
      }
      return jsonResponse({
        success: false,
        error: "Ruta no encontrada"
      }, 404);

    } catch (error) {
      console.error("API request error:", error);

      return jsonResponse({
        success: false,
        error: "No fue posible completar la solicitud."
      }, 500);
    }
  },

  // R2 cleanup runs on a schedule so abandoned/cancelled uploads cannot accumulate.
  async scheduled(_controller: { scheduledTime: number; cron: string }, env: Env): Promise<void> {
    const result = await cleanupExpiredOrphanMedia(env);
    console.log(`Media cleanup: ${result.deleted} orphaned files removed (${result.bytes} bytes).`);
  }
};