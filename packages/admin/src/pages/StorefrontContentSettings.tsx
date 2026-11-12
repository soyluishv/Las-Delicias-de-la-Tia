import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { DEFAULT_STOREFRONT_CONTENT, type StorefrontContent } from '../lib/storefrontContent.js';

function tokenHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type Field = { key: keyof StorefrontContent; label: string; multiline?: boolean; help?: string };
type Group = { title: string; description: string; fields: Field[] };

const groups: Group[] = [
  { title: 'Navegación y catálogo', description: 'Cambia el nombre de las secciones, el botón del pedido y los textos del catálogo.', fields: [
    { key: 'navHomeLabel', label: 'Nombre de Inicio' },
    { key: 'navCatalogLabel', label: 'Nombre del catálogo (Menú, Productos, Colección...)' },
    { key: 'navEventsLabel', label: 'Nombre de la sección adicional' },
    { key: 'navGalleryLabel', label: 'Nombre de la galería' },
    { key: 'cartButtonLabel', label: 'Texto del botón del carrito' },
    { key: 'catalogPageDescription', label: 'Descripción de la página del catálogo', multiline: true },
    { key: 'catalogIntroBadge', label: 'Etiqueta pequeña superior del catálogo' },
    { key: 'catalogSearchPlaceholder', label: 'Texto del buscador' },
    { key: 'catalogAllLabel', label: 'Botón para mostrar todas las categorías' },
    { key: 'catalogCategoriesEyebrow', label: 'Etiqueta de categorías' },
    { key: 'catalogCategoriesTitle', label: 'Título de categorías' },
    { key: 'catalogCategoriesDescription', label: 'Descripción de categorías' },
    { key: 'catalogCategoriesTotalSingular', label: 'Nombre de categoría en singular' },
    { key: 'catalogCategoriesTotalPlural', label: 'Nombre de categoría en plural' },
    { key: 'catalogCategoryCountSingular', label: 'Contador de categoría: singular' },
    { key: 'catalogCategoryCountPlural', label: 'Contador de categoría: plural' },
    { key: 'catalogCategoryEmptyLabel', label: 'Texto de categoría sin productos' },
    { key: 'catalogResultsEyebrow', label: 'Etiqueta sobre los resultados' },
    { key: 'catalogSearchResultsTitle', label: 'Título de resultados de búsqueda' },
    { key: 'catalogProductsTitle', label: 'Título general de productos' },
    { key: 'catalogShowAllCategoriesLabel', label: 'Botón para volver a todas las categorías' },
    { key: 'catalogEmptyTitle', label: 'Título cuando no hay productos', multiline: false },
    { key: 'catalogEmptyDescription', label: 'Descripción cuando no hay productos', multiline: true },
    { key: 'catalogProductAvailableLabel', label: 'Etiqueta de disponibilidad' },
    { key: 'catalogProductDetailsLabel', label: 'Botón de detalle de producto' },
    { key: 'catalogProductPlaceholderEmoji', label: 'Icono provisional para productos sin fotografía (emoji)' },
    { key: 'catalogLoadError', label: 'Mensaje de error del catálogo' },
  ] },
  { title: 'Portada principal', description: 'Adapta el mensaje de bienvenida y la presentación visual sin reemplazar las fotografías ni el catálogo.', fields: [
    { key: 'homeHeroBadge', label: 'Etiqueta superior de la portada' },
    { key: 'homeHeroTitle', label: 'Título principal' },
    { key: 'homeHeroSubtitle', label: 'Frase destacada' },
    { key: 'homeHeroDescription', label: 'Descripción principal', multiline: true },
    { key: 'homeHeroPrimaryLabel', label: 'Texto del botón principal' },
    { key: 'homeHeroEventsLabel', label: 'Texto del botón secundario' },
    { key: 'homeBenefit1', label: 'Beneficio 1' },
    { key: 'homeBenefit2', label: 'Beneficio 2' },
    { key: 'homeBenefit3', label: 'Beneficio 3' },
    { key: 'homeHeroPhotoBadge', label: 'Etiqueta de fotografía principal' },
    { key: 'homeHeroPhotoTitle', label: 'Texto sobre fotografía principal' },
    { key: 'homeHeroSideCaption1', label: 'Texto de fotografía secundaria 1' },
    { key: 'homeHeroSideCaption2', label: 'Texto de fotografía secundaria 2' },
    { key: 'homeHeroLogoTitle', label: 'Título del recuadro de identidad' },
    { key: 'homeHeroLogoDescription', label: 'Descripción del recuadro de identidad' },
  ] },
  { title: 'Destacados y secciones complementarias', description: 'Personaliza las secciones de productos destacados, eventos, ventajas y el cierre de la portada.', fields: [
    { key: 'homeCatalogEyebrow', label: 'Etiqueta de categorías en portada' },
    { key: 'homeCatalogTitle', label: 'Título de categorías en portada' },
    { key: 'homeCatalogDescription', label: 'Descripción de categorías en portada', multiline: true },
    { key: 'homeCatalogButtonLabel', label: 'Botón para abrir el catálogo' },
    { key: 'homeFeaturedEyebrow', label: 'Etiqueta de productos destacados' },
    { key: 'homeFeaturedTitle', label: 'Título de productos destacados' },
    { key: 'homeFeaturedBadge', label: 'Etiqueta de producto destacado' },
    { key: 'homeProductCardBadge', label: 'Etiqueta de tarjeta de producto' },
    { key: 'homeProductCardButton', label: 'Botón de tarjeta de producto' },
    { key: 'homeCatalogEmptyTitle', label: 'Título si no hay destacados' },
    { key: 'homeCatalogEmptyDescription', label: 'Descripción si no hay destacados', multiline: true },
    { key: 'homeEventsBadge', label: 'Etiqueta de eventos' },
    { key: 'homeEventsTitle', label: 'Título de eventos' },
    { key: 'homeEventsDescription', label: 'Descripción de eventos', multiline: true },
    { key: 'homeEventsServiceNote', label: 'Nota de servicio' },
    { key: 'homeEventsPrimaryLabel', label: 'Botón principal de eventos' },
    { key: 'homeEventsSecondaryLabel', label: 'Botón secundario de eventos' },
    { key: 'homeFeature1Title', label: 'Ventaja 1 — título' },
    { key: 'homeFeature1Description', label: 'Ventaja 1 — descripción', multiline: true },
    { key: 'homeFeature2Title', label: 'Ventaja 2 — título' },
    { key: 'homeFeature2Description', label: 'Ventaja 2 — descripción', multiline: true },
    { key: 'homeFeature3Title', label: 'Ventaja 3 — título' },
    { key: 'homeFeature3Description', label: 'Ventaja 3 — descripción', multiline: true },
    { key: 'homeClosingEyebrow', label: 'Etiqueta del bloque final' },
    { key: 'homeClosingTitle', label: 'Título del bloque final' },
    { key: 'homeClosingDescription', label: 'Descripción del bloque final', multiline: true },
    { key: 'homeClosingButtonLabel', label: 'Botón del bloque final' },
  ] },
  { title: 'Carrito y finalización de compra', description: 'Personaliza los textos que ve el cliente al revisar su carrito y completar la compra. Estos rótulos no cambian las modalidades, cobertura, tarifas ni cálculos de entrega.', fields: [
    { key: 'cartPanelTitle', label: 'Título del carrito' },
    { key: 'cartEmptyTitle', label: 'Mensaje cuando el carrito está vacío' },
    { key: 'cartBrowseLabel', label: 'Botón para volver al catálogo' },
    { key: 'cartCheckoutLabel', label: 'Botón para continuar desde el carrito' },
    { key: 'checkoutEmptyTitle', label: 'Título del checkout vacío' },
    { key: 'checkoutEmptyDescription', label: 'Descripción del checkout vacío', multiline: true },
    { key: 'checkoutEmptyButtonLabel', label: 'Botón para volver al catálogo' },
    { key: 'checkoutTitle', label: 'Título de finalización' },
    { key: 'checkoutSubtitle', label: 'Descripción de finalización', multiline: true },
    { key: 'checkoutReceiveTitle', label: 'Título para elegir cómo recibir' },
    { key: 'checkoutDeliveryLabel', label: 'Nombre de la modalidad de entrega' },
    { key: 'checkoutDeliveryDescription', label: 'Descripción de la modalidad de entrega', multiline: true },
    { key: 'checkoutPickupLabel', label: 'Nombre de la modalidad para recoger' },
    { key: 'checkoutPickupDescription', label: 'Descripción de la modalidad para recoger', multiline: true },
    { key: 'checkoutAddressTitle', label: 'Título de los datos de dirección' },
    { key: 'checkoutDeliveryFeeLabel', label: 'Nombre del costo de entrega' },
    { key: 'checkoutFreeDeliveryMessage', label: 'Mensaje de entrega gratis' },
    { key: 'checkoutPickupNoticeTitle', label: 'Título del aviso de recogida' },
    { key: 'checkoutPickupNoticeDescription', label: 'Descripción del aviso de recogida', multiline: true },
    { key: 'checkoutPickupSummaryNote', label: 'Nota de recogida en el resumen' },
    { key: 'checkoutSummaryTitle', label: 'Título del resumen de compra' },
    { key: 'checkoutNotesTitle', label: 'Título del campo de notas' },
    { key: 'checkoutContactDescription', label: 'Descripción de datos de contacto', multiline: true },
    { key: 'checkoutCashPaymentTitle', label: 'Nombre del pago en efectivo' },
    { key: 'checkoutCashPaymentDescription', label: 'Descripción del pago en efectivo' },
    { key: 'checkoutSubmitLabel', label: 'Texto del botón de confirmación' },
    { key: 'checkoutLoadingLabel', label: 'Texto mientras se registra' },
    { key: 'checkoutPriceValidationNote', label: 'Aviso de validación de precios', multiline: true },
  ] },
  { title: 'Formulario de compra y entrega', description: 'Edita los textos visibles de la dirección, cobertura, programación, notas y datos de contacto del checkout.', fields: [
    { key: 'checkoutNoDeliveryModesMessage', label: "Aviso: no hay modalidades de entrega" },
    { key: 'checkoutCityLabel', label: "Etiqueta del municipio" },
    { key: 'checkoutCityPlaceholder', label: "Ayuda para seleccionar municipio" },
    { key: 'checkoutNeighborhoodLabel', label: "Etiqueta del barrio" },
    { key: 'checkoutNeighborhoodPlaceholder', label: "Ayuda para seleccionar barrio" },
    { key: 'checkoutOtherNeighborhoodLabel', label: "Etiqueta para otro barrio" },
    { key: 'checkoutOtherNeighborhoodPlaceholder', label: "Ejemplo de otro barrio" },
    { key: 'checkoutOtherNeighborhoodFeeNote', label: "Nota de tarifa para otro barrio", multiline: true },
    { key: 'checkoutAddressLabel', label: "Etiqueta de dirección" },
    { key: 'checkoutAddressPlaceholder', label: "Ejemplo de dirección" },
    { key: 'checkoutAddressExtraLabel', label: "Etiqueta de indicaciones adicionales" },
    { key: 'checkoutAddressExtraPlaceholder', label: "Ayuda de indicaciones adicionales" },
    { key: 'checkoutNoNeighborhoodsMessage', label: "Aviso: no hay barrios configurados", multiline: true },
    { key: 'checkoutScheduledTitle', label: "Título de programación del pedido" },
    { key: 'checkoutScheduleAsapLabel', label: "Opción: lo antes posible" },
    { key: 'checkoutScheduleLaterLabel', label: "Opción: programar fecha y hora" },
    { key: 'checkoutNotesPlaceholder', label: "Ayuda del campo de notas" },
    { key: 'checkoutContactTitle', label: "Título de datos de contacto" },
    { key: 'checkoutCustomerNameLabel', label: "Etiqueta de nombre completo" },
    { key: 'checkoutCustomerPhoneLabel', label: "Etiqueta de teléfono" },
    { key: 'checkoutCustomerEmailLabel', label: "Etiqueta de correo electrónico" },
    { key: 'checkoutWhatsappConsentLabel', label: "Texto de autorización de avisos por WhatsApp", multiline: true },
    { key: 'checkoutWhatsappConsentDescription', label: "Descripción de autorización de WhatsApp", multiline: true },
  ] },
  { title: 'Pagos, resumen y validaciones de compra', description: 'Personaliza las etiquetas de pago, el resumen, los avisos y los mensajes de validación. Los textos con {amount} conservan ese marcador para insertar el valor calculado.', fields: [
    { key: 'checkoutFreeDeliveryLabel', label: "Etiqueta de domicilio gratuito" },
    { key: 'checkoutMinimumOrderMessage', label: "Texto de pedido mínimo ({amount})", help: "Conserva {amount}; el sistema lo reemplaza por el valor calculado." },
    { key: 'checkoutBelowMinimumMessage', label: "Aviso de cuánto falta para el pedido mínimo ({amount})", help: "Conserva {amount}; el sistema lo reemplaza por el valor faltante." },
    { key: 'checkoutPickupMinimumMessage', label: "Pedido mínimo para recoger ({amount})", help: "Conserva {amount}; el sistema lo reemplaza por el valor calculado." },
    { key: 'checkoutPickupMinimumBelowMessage', label: "Texto adicional si falta dinero para recoger ({amount})", help: "Conserva {amount}; el sistema lo reemplaza por el valor faltante." },
    { key: 'checkoutPaymentMethodTitle', label: "Título de medios de pago" },
    { key: 'checkoutNoPaymentMethodsMessage', label: "Aviso: no hay medios de pago", multiline: true },
    { key: 'checkoutPaymentDetailsTitle', label: "Título de datos de pago" },
    { key: 'checkoutPaymentAccountHolderLabel', label: "Etiqueta de titular de cuenta" },
    { key: 'checkoutPaymentAccountHolderFallback', label: "Texto si no hay titular registrado" },
    { key: 'checkoutPaymentBankLabel', label: "Etiqueta de entidad financiera" },
    { key: 'checkoutPaymentAccountTypeLabel', label: "Etiqueta de tipo de cuenta" },
    { key: 'checkoutPaymentAccountNumberLabel', label: "Etiqueta de cuenta o celular" },
    { key: 'checkoutPaymentKeyLabel', label: "Etiqueta de llave Bre-B" },
    { key: 'checkoutPaymentAdvanceNotice', label: "Aviso de pago anticipado", multiline: true },
    { key: 'checkoutCashPendingNotice', label: "Aviso de pago en efectivo pendiente", multiline: true },
    { key: 'checkoutSubtotalLabel', label: "Etiqueta de subtotal" },
    { key: 'checkoutTotalLabel', label: "Etiqueta de total" },
    { key: 'checkoutConfigurationLoadingMessage', label: "Mensaje mientras se carga la configuración" },
    { key: 'checkoutConfigurationErrorMessage', label: "Error al cargar la configuración" },
    { key: 'checkoutOrdersUnavailableMessage', label: "Aviso cuando el negocio no recibe pedidos", multiline: true },
    { key: 'checkoutScheduledUnavailableError', label: "Error: pedidos programados no disponibles" },
    { key: 'checkoutCashUnavailableError', label: "Error: pago en efectivo no disponible" },
    { key: 'checkoutDeliveryUnavailableError', label: "Error: domicilio no disponible" },
    { key: 'checkoutCoverageUnavailableError', label: "Error: zona fuera de cobertura", multiline: true },
    { key: 'checkoutMinimumOrderError', label: "Error de pedido mínimo ({amount})", help: "Conserva {amount}; el sistema lo reemplaza por el valor calculado." },
    { key: 'checkoutOtherNeighborhoodRequiredError', label: "Error: falta escribir el barrio" },
    { key: 'checkoutOtherNeighborhoodLengthError', label: "Error: barrio demasiado largo" },
    { key: 'checkoutAddressRequiredError', label: "Error: falta la dirección" },
    { key: 'checkoutPickupUnavailableError', label: "Error: recogida no disponible" },
    { key: 'checkoutCustomerContactRequiredError', label: "Error: faltan datos de contacto" },
    { key: 'checkoutPaymentUnavailableError', label: "Error: medio de pago no disponible" },
    { key: 'checkoutOrderCreateError', label: "Error al registrar el pedido", multiline: true },
    { key: 'checkoutUnexpectedError', label: "Error inesperado al registrar el pedido" },
  ] },
  { title: 'Pie de página y contacto', description: 'Cambia la descripción comercial y los mensajes de contacto. El nombre, logotipo, teléfono y WhatsApp se administran en Datos del negocio e Identidad visual.', fields: [
    { key: 'footerBusinessDescription', label: 'Descripción del negocio', multiline: true },
    { key: 'footerServiceBadge', label: 'Mensaje de atención' },
    { key: 'footerNavigationTitle', label: 'Título de navegación' },
    { key: 'footerContactTitle', label: 'Título de contacto' },
    { key: 'footerContactDescription', label: 'Descripción de contacto', multiline: true },
    { key: 'footerWhatsappButtonLabel', label: 'Texto del botón de WhatsApp' },
    { key: 'footerEventsButtonLabel', label: 'Botón de eventos o sección adicional' },
    { key: 'footerSocialEyebrow', label: 'Etiqueta de redes sociales' },
    { key: 'footerSocialTitle', label: 'Título de redes sociales' },
    { key: 'footerSocialDescription', label: 'Descripción de redes sociales', multiline: true },
  ] },
  { title: 'Formulario de cotizaciones', description: 'Edita los títulos, etiquetas, ayudas, opciones y mensajes de la solicitud de cotización. Las opciones de evento se escriben una por línea.', fields: [
    { key: 'eventsPageBadge', label: 'Etiqueta superior de cotizaciones' },
    { key: 'eventsPageTitle', label: 'Título de la página de cotizaciones' },
    { key: 'eventsPageDescription', label: 'Descripción de la página de cotizaciones', multiline: true },
    { key: 'eventsPageTagline', label: 'Frase complementaria' },
    { key: 'eventsContactSectionTitle', label: 'Título de información de contacto' },
    { key: 'eventsNameLabel', label: 'Etiqueta de nombre' },
    { key: 'eventsNamePlaceholder', label: 'Ayuda del campo de nombre' },
    { key: 'eventsPhoneLabel', label: 'Etiqueta de teléfono' },
    { key: 'eventsPhonePlaceholder', label: 'Ayuda del campo de teléfono' },
    { key: 'eventsEmailLabel', label: 'Etiqueta de correo' },
    { key: 'eventsEmailPlaceholder', label: 'Ayuda del campo de correo' },
    { key: 'eventsConsentText', label: 'Texto de autorización de WhatsApp', multiline: true },
    { key: 'eventsConsentHelp', label: 'Ayuda de autorización de WhatsApp' },
    { key: 'eventsDetailsSectionTitle', label: 'Título de información del evento' },
    { key: 'eventsTypeLabel', label: 'Etiqueta del tipo de evento' },
    { key: 'eventsTypePlaceholder', label: 'Ayuda del selector de evento' },
    { key: 'eventsTypeOptions', label: 'Opciones de tipo de evento (una por línea)', multiline: true },
    { key: 'eventsDateLabel', label: 'Etiqueta de fecha' },
    { key: 'eventsGuestCountLabel', label: 'Etiqueta del número de invitados' },
    { key: 'eventsGuestCountPlaceholder', label: 'Ayuda del número de invitados' },
    { key: 'eventsLocationSectionTitle', label: 'Título del lugar del evento' },
    { key: 'eventsCityLabel', label: 'Etiqueta de ciudad o municipio' },
    { key: 'eventsCityPlaceholder', label: 'Ayuda de ciudad o municipio' },
    { key: 'eventsNeighborhoodLabel', label: 'Etiqueta de barrio o sector' },
    { key: 'eventsNeighborhoodPlaceholder', label: 'Ayuda de barrio o sector' },
    { key: 'eventsAddressLabel', label: 'Etiqueta de dirección o lugar' },
    { key: 'eventsAddressPlaceholder', label: 'Ayuda de dirección o lugar' },
    { key: 'eventsFoodBudgetSectionTitle', label: 'Título de comidas y presupuesto' },
    { key: 'eventsFoodLabel', label: 'Etiqueta de comidas o productos' },
    { key: 'eventsFoodPlaceholder', label: 'Ayuda de comidas o productos' },
    { key: 'eventsBudgetLabel', label: 'Etiqueta de presupuesto' },
    { key: 'eventsBudgetPlaceholder', label: 'Ayuda de presupuesto' },
    { key: 'eventsAdditionalDetailsLabel', label: 'Etiqueta de detalles adicionales' },
    { key: 'eventsAdditionalDetailsPlaceholder', label: 'Ayuda de detalles adicionales' },
    { key: 'eventsSubmitLabel', label: 'Texto del botón de envío' },
    { key: 'eventsSubmittingLabel', label: 'Texto durante el envío' },
    { key: 'eventsSuccessMessage', label: 'Mensaje de confirmación ({number} se reemplaza por el consecutivo)', multiline: true },
    { key: 'eventsPrivacyNote', label: 'Aviso de privacidad del formulario', multiline: true },
    { key: 'eventsRequestErrorMessage', label: 'Mensaje de error de solicitud' },
    { key: 'eventsGenericErrorMessage', label: 'Mensaje de error general' },
    { key: 'eventsInvalidPayloadError', label: 'Error cuando los datos enviados no son válidos' },
    { key: 'eventsInvalidNameError', label: 'Error de nombre no válido' },
    { key: 'eventsInvalidPhoneError', label: 'Error de teléfono no válido' },
    { key: 'eventsInvalidTypeError', label: 'Error de tipo de evento no válido' },
    { key: 'eventsInvalidEmailError', label: 'Error de correo no válido' },
    { key: 'eventsInvalidDateError', label: 'Error de fecha no válida' },
    { key: 'eventsInvalidGuestCountError', label: 'Error de número de invitados no válido' },
    { key: 'eventsInvalidBudgetError', label: 'Error de presupuesto no válido' },
    { key: 'eventsInvalidFieldLengthError', label: 'Error de longitud de campo ({field} y {maximum} son variables)' }
  ] },
];

const HOME_SECTIONS = [
  { id: 'hero', label: 'Portada principal', visibleKey: 'homeShowHeroSection' },
  { id: 'catalog', label: 'Catálogo destacado', visibleKey: 'homeShowCatalogSection' },
  { id: 'events', label: 'Eventos o sección adicional', visibleKey: 'homeShowEventsSection' },
  { id: 'features', label: 'Ventajas y beneficios', visibleKey: 'homeShowFeaturesSection' },
  { id: 'closing', label: 'Bloque final', visibleKey: 'homeShowClosingSection' },
] as const;

type HomeSectionId = typeof HOME_SECTIONS[number]['id'];

function normalizeHomeSectionOrder(value: string): HomeSectionId[] {
  const validIds = HOME_SECTIONS.map((section) => section.id) as HomeSectionId[];
  const requested = value.split(',').map((item) => item.trim()).filter((item): item is HomeSectionId => validIds.includes(item as HomeSectionId));
  const unique = requested.filter((item, index) => requested.indexOf(item) === index);
  return [...unique, ...validIds.filter((item) => !unique.includes(item))];
}

const toggles: { key: keyof StorefrontContent; label: string; help: string }[] = [
  { key: 'homeShowHeroSection', label: 'Mostrar la portada principal', help: 'Oculta el bloque de bienvenida sin eliminar sus textos ni las fotografías configuradas.' },
  { key: 'homeShowCatalogSection', label: 'Mostrar el catálogo destacado en la portada', help: 'Oculta solo el bloque de productos destacados del inicio. La página completa del catálogo seguirá disponible.' },
  { key: 'navShowEvents', label: 'Mostrar la sección adicional en la navegación', help: 'Desactívala si no utilizas la página de eventos.' },
  { key: 'navShowGallery', label: 'Mostrar la galería en la navegación', help: 'Oculta el acceso sin borrar fotografías ni datos.' },
  { key: 'homeShowHeroEventsButton', label: 'Mostrar el botón secundario de la portada', help: 'El botón abre la página de eventos.' },
  { key: 'homeShowEventsSection', label: 'Mostrar el bloque de eventos en la portada', help: 'Ocúltalo cuando no ofrezcas eventos.' },
  { key: 'homeShowFeaturesSection', label: 'Mostrar el bloque de ventajas', help: 'Puedes reutilizarlo para destacar beneficios de cualquier negocio.' },
  { key: 'homeShowClosingSection', label: 'Mostrar el bloque final de la portada', help: 'Oculta el cierre visual sin quitar el catálogo.' },
  { key: 'footerShowEventsButton', label: 'Mostrar botón de eventos en el pie de página', help: 'Se oculta si también desactivas la sección adicional.' },
];

type StoreProfile = 'general' | 'food' | 'clothing' | 'footwear' | 'instruments';

const profileLabels: Record<StoreProfile, string> = {
  general: 'Comercio general',
  food: 'Comida y bebidas',
  clothing: 'Ropa y accesorios',
  footwear: 'Tenis y calzado',
  instruments: 'Instrumentos musicales',
};

// Text presets only. They do not change products, prices, categories, photos, stock or orders.
const profileContent: Record<StoreProfile, Partial<StorefrontContent>> = {
  general: {
    navCatalogLabel: 'Productos', navEventsLabel: 'Novedades', navGalleryLabel: 'Galería',
    navShowEvents: false, navShowGallery: false, cartButtonLabel: 'Mi carrito',
    cartPanelTitle: 'Tu carrito', cartEmptyTitle: 'Tu carrito está vacío', cartBrowseLabel: 'Ver productos', cartCheckoutLabel: 'Continuar a la compra',
    checkoutEmptyTitle: 'Tu carrito está vacío', checkoutEmptyDescription: 'Agrega productos al carrito para continuar con tu compra.', checkoutEmptyButtonLabel: 'Ver productos',
    checkoutTitle: 'Finalizar compra', checkoutSubtitle: 'Completa tus datos y elige cómo deseas recibir tu compra.',
    checkoutReceiveTitle: '¿Cómo deseas recibir tu compra?', checkoutDeliveryLabel: 'Entrega a domicilio',
    checkoutDeliveryDescription: 'Recibe tu compra en la dirección que indiques.', checkoutPickupLabel: 'Recoger en el punto acordado',
    checkoutPickupDescription: 'El negocio confirmará contigo el lugar y los datos para recoger.', checkoutAddressTitle: 'Dirección de entrega',
    checkoutDeliveryFeeLabel: 'Costo de entrega', checkoutFreeDeliveryMessage: 'Tu compra cumple la condición de entrega gratis.',
    checkoutPickupNoticeTitle: 'Recogida sin costo', checkoutPickupNoticeDescription: 'No se cobrará el costo de entrega. El negocio confirmará contigo el lugar y la hora para recoger la compra.',
    checkoutPickupSummaryNote: 'Recogida sin costo de entrega.', checkoutSummaryTitle: 'Resumen de la compra', checkoutNotesTitle: 'Notas de la compra',
    checkoutContactDescription: 'Necesitamos estos datos para confirmar y coordinar tu compra.', checkoutCashPaymentTitle: 'Efectivo al recibir o recoger',
    checkoutCashPaymentDescription: 'Pagas cuando recibas o recojas tu compra.', checkoutSubmitLabel: 'Confirmar compra', checkoutLoadingLabel: 'Registrando compra...',
    checkoutPriceValidationNote: 'Los precios y costos de entrega se validarán nuevamente al registrar la compra.', catalogProductPlaceholderEmoji: '📦',
    homeHeroBadge: 'Descubre nuestra tienda', homeHeroTitle: 'Encuentra lo que buscas',
    homeHeroSubtitle: 'Productos para cada gusto y necesidad.',
    homeHeroDescription: 'Explora nuestro catálogo, conoce los detalles de cada producto y encuentra opciones para ti.',
    homeHeroPrimaryLabel: 'Ver productos', homeShowHeroEventsButton: false,
    homeBenefit1: 'Productos seleccionados', homeBenefit2: 'Compra fácil y segura', homeBenefit3: 'Atención personalizada',
    homeHeroPhotoBadge: 'Conoce nuestros productos', homeHeroPhotoTitle: 'Calidad para cada ocasión',
    homeHeroSideCaption1: 'Descubre novedades', homeHeroSideCaption2: 'Encuentra tu favorito',
    homeHeroLogoTitle: 'Nuestra tienda', homeHeroLogoDescription: 'Conoce nuestro catálogo y novedades.',
    homeCatalogEyebrow: 'Explora la tienda', homeCatalogTitle: 'Encuentra tus favoritos',
    homeCatalogDescription: 'Descubre productos, revisa sus características y elige lo que necesitas.',
    homeCatalogButtonLabel: 'Ver todo el catálogo', homeFeaturedEyebrow: 'Selección especial',
    homeFeaturedTitle: 'Productos destacados', homeFeaturedBadge: 'Destacado',
    homeProductCardBadge: 'Recomendado', homeProductCardButton: 'Ver producto',
    homeCatalogEmptyTitle: 'Estamos preparando el catálogo', homeCatalogEmptyDescription: 'Pronto encontrarás nuevos productos.',
    homeShowEventsSection: false, homeEventsBadge: 'Novedades y promociones',
    homeEventsTitle: 'Descubre lo nuevo de nuestra tienda',
    homeEventsDescription: 'Conoce nuevos productos, lanzamientos y noticias de la tienda.',
    homeEventsServiceNote: 'Consulta las novedades disponibles.',
    homeEventsPrimaryLabel: 'Ver novedades', homeEventsSecondaryLabel: 'Explorar productos',
    homeShowFeaturesSection: true,
    homeFeature1Title: 'Compra fácil', homeFeature1Description: 'Encuentra y compara productos desde nuestra tienda.',
    homeFeature2Title: 'Atención cercana', homeFeature2Description: 'Estamos disponibles para resolver tus dudas.',
    homeFeature3Title: 'Opciones para ti', homeFeature3Description: 'Descubre productos para diferentes gustos y necesidades.',
    homeShowClosingSection: true, homeClosingEyebrow: 'Estamos para ayudarte',
    homeClosingTitle: '¿Qué estás buscando?', homeClosingDescription: 'Explora el catálogo y encuentra tu próximo producto.',
    homeClosingButtonLabel: 'Explorar productos',
    catalogPageDescription: 'Explora los productos, consulta sus características y agrega tus favoritos al carrito.',
    catalogIntroBadge: 'Nuestra tienda', catalogSearchPlaceholder: 'Buscar productos...',
    catalogAllLabel: 'Todos', catalogCategoriesEyebrow: 'Explora por categoría',
    catalogCategoriesTitle: 'Categorías', catalogCategoriesDescription: 'Elige una categoría para ver sus productos.',
    catalogCategoryCountSingular: 'producto', catalogCategoryCountPlural: 'productos',
    catalogCategoryEmptyLabel: 'Próximamente', catalogResultsEyebrow: 'Catálogo',
    catalogSearchResultsTitle: 'Resultados de búsqueda', catalogProductsTitle: 'Nuestros productos',
    catalogShowAllCategoriesLabel: 'Ver todas las categorías', catalogEmptyTitle: 'No hay productos en esta selección',
    catalogEmptyDescription: 'Prueba otra categoría o vuelve más tarde para ver las novedades.',
    catalogProductAvailableLabel: 'Disponible', catalogProductDetailsLabel: 'Ver detalles y opciones',
    catalogLoadError: 'No fue posible cargar los productos. Inténtalo de nuevo.',
    footerBusinessDescription: 'Conoce nuestro catálogo de productos y encuentra opciones para tus gustos y necesidades.',
    footerServiceBadge: 'Atención al cliente', footerNavigationTitle: 'Explora nuestra tienda',
    footerContactTitle: 'Estamos para atenderte', footerContactDescription: '¿Tienes alguna pregunta? Escríbenos y con gusto te ayudaremos.',
    footerWhatsappButtonLabel: 'Contáctanos por WhatsApp', footerShowEventsButton: false,
    footerEventsButtonLabel: 'Conoce nuestras novedades', footerSocialEyebrow: 'Conecta con nosotros',
    footerSocialTitle: 'Síguenos y visítanos', footerSocialDescription: 'Conoce novedades, productos y promociones.',
  },
  food: { ...DEFAULT_STOREFRONT_CONTENT },
  clothing: {
    navCatalogLabel: 'Colección', navEventsLabel: 'Novedades', navGalleryLabel: 'Inspiración',
    navShowEvents: false, navShowGallery: false, cartButtonLabel: 'Mi carrito',
    homeHeroBadge: 'Nueva colección', homeHeroTitle: 'Encuentra tu próximo estilo',
    homeHeroSubtitle: 'Prendas y accesorios para expresar quién eres.',
    homeHeroDescription: 'Explora ropa y accesorios para distintas ocasiones. Revisa tallas, colores y detalles antes de elegir.',
    homeHeroPrimaryLabel: 'Ver colección', homeShowHeroEventsButton: false,
    homeBenefit1: 'Estilos para cada ocasión', homeBenefit2: 'Tallas y colores disponibles', homeBenefit3: 'Atención personalizada',
    homeHeroPhotoBadge: 'Descubre la colección', homeHeroPhotoTitle: 'Tu estilo, tu elección',
    homeCatalogEyebrow: 'Explora la colección', homeCatalogTitle: 'Encuentra tus favoritos',
    homeCatalogDescription: 'Conoce las prendas y accesorios disponibles.', homeCatalogButtonLabel: 'Ver toda la colección',
    homeFeaturedEyebrow: 'Favoritos', homeFeaturedTitle: 'Prendas destacadas', homeFeaturedBadge: 'De la colección',
    homeProductCardBadge: 'Recomendado', homeProductCardButton: 'Ver prenda',
    homeShowEventsSection: false, homeShowFeaturesSection: true, homeShowClosingSection: true,
    homeFeature1Title: 'Elige tu estilo', homeFeature1Description: 'Encuentra prendas y accesorios para distintas ocasiones.',
    homeFeature2Title: 'Consulta tus opciones', homeFeature2Description: 'Revisa tallas, colores y disponibilidad de cada producto.',
    homeFeature3Title: 'Te acompañamos', homeFeature3Description: 'Estamos disponibles para ayudarte con tu compra.',
    homeClosingEyebrow: 'Renueva tu estilo', homeClosingTitle: 'Encuentra algo para ti',
    homeClosingDescription: 'Explora la colección y descubre tus próximas prendas favoritas.', homeClosingButtonLabel: 'Ver colección',
    catalogPageDescription: 'Explora la colección, revisa tallas, colores y detalles de cada prenda.',
    catalogIntroBadge: 'Nuestra colección', catalogSearchPlaceholder: 'Buscar prendas y accesorios...',
    catalogCategoriesEyebrow: 'Encuentra tu estilo', catalogCategoriesTitle: 'Colecciones y categorías',
    catalogCategoriesDescription: 'Selecciona una categoría para explorar sus prendas.',
    catalogResultsEyebrow: 'Colección disponible', catalogProductsTitle: 'Prendas y accesorios',
    catalogEmptyDescription: 'Prueba otra categoría o vuelve más tarde para conocer las novedades.',
    footerBusinessDescription: 'Explora nuestras prendas y accesorios. Encuentra estilos para diferentes ocasiones y gustos.',
    footerServiceBadge: 'Asesoría por WhatsApp', footerContactDescription: '¿Necesitas ayuda con una talla, color o producto? Escríbenos.',
    footerWhatsappButtonLabel: 'Consultar por WhatsApp', footerShowEventsButton: false,
    footerSocialDescription: 'Síguenos para conocer nuevas colecciones, estilos y novedades.',
  },
  footwear: {
    navCatalogLabel: 'Calzado', navEventsLabel: 'Novedades', navGalleryLabel: 'Galería',
    navShowEvents: false, navShowGallery: false, cartButtonLabel: 'Mi carrito',
    homeHeroBadge: 'Encuentra tu próximo par', homeHeroTitle: 'Camina con tu propio estilo',
    homeHeroSubtitle: 'Tenis y calzado para cada ocasión.',
    homeHeroDescription: 'Explora referencias, tallas y colores disponibles. Revisa los detalles de cada par antes de comprar.',
    homeHeroPrimaryLabel: 'Ver calzado', homeShowHeroEventsButton: false,
    homeBenefit1: 'Diferentes referencias', homeBenefit2: 'Consulta tallas disponibles', homeBenefit3: 'Atención personalizada',
    homeHeroPhotoBadge: 'Conoce las referencias', homeHeroPhotoTitle: 'El par que buscas puede estar aquí',
    homeCatalogEyebrow: 'Explora el catálogo', homeCatalogTitle: 'Tenis y calzado',
    homeCatalogDescription: 'Encuentra modelos, tallas y colores para tu estilo.', homeCatalogButtonLabel: 'Ver todo el calzado',
    homeFeaturedEyebrow: 'Selección destacada', homeFeaturedTitle: 'Referencias recomendadas',
    homeProductCardBadge: 'Destacado', homeProductCardButton: 'Ver referencia',
    homeShowEventsSection: false, homeShowFeaturesSection: true, homeShowClosingSection: true,
    homeFeature1Title: 'Elige tu referencia', homeFeature1Description: 'Explora diferentes modelos y estilos.',
    homeFeature2Title: 'Consulta tu talla', homeFeature2Description: 'Revisa la disponibilidad antes de comprar.',
    homeFeature3Title: 'Compra con confianza', homeFeature3Description: 'Te ayudamos a resolver tus dudas.',
    homeClosingEyebrow: 'Encuentra tu próximo par', homeClosingTitle: 'Tu siguiente paso empieza aquí',
    homeClosingDescription: 'Explora las referencias disponibles y elige tu estilo.', homeClosingButtonLabel: 'Ver calzado',
    catalogPageDescription: 'Consulta referencias, tallas, colores y características del calzado disponible.',
    catalogIntroBadge: 'Calzado disponible', catalogSearchPlaceholder: 'Buscar tenis o referencias...',
    catalogCategoriesEyebrow: 'Explora por categoría', catalogCategoriesTitle: 'Categorías de calzado',
    catalogCategoriesDescription: 'Selecciona una categoría para ver modelos disponibles.',
    catalogResultsEyebrow: 'Referencias disponibles', catalogProductsTitle: 'Nuestro calzado',
    footerBusinessDescription: 'Encuentra tenis y calzado para diferentes estilos. Consulta referencias, tallas y colores disponibles.',
    footerServiceBadge: 'Asesoría por WhatsApp', footerContactDescription: '¿Buscas una referencia o necesitas consultar una talla? Escríbenos.',
    footerWhatsappButtonLabel: 'Consultar disponibilidad', footerShowEventsButton: false,
    footerSocialDescription: 'Síguenos para conocer nuevas referencias y novedades.',
  },
  instruments: {
    navCatalogLabel: 'Instrumentos', navEventsLabel: 'Novedades', navGalleryLabel: 'Galería',
    navShowEvents: false, navShowGallery: false, cartButtonLabel: 'Mi carrito',
    homeHeroBadge: 'Explora nuestro catálogo musical', homeHeroTitle: 'Encuentra tu próximo sonido',
    homeHeroSubtitle: 'Instrumentos y accesorios para crear música.',
    homeHeroDescription: 'Conoce instrumentos, marcas, modelos y características. Explora opciones para comenzar o llevar tu música más lejos.',
    homeHeroPrimaryLabel: 'Ver instrumentos', homeShowHeroEventsButton: false,
    homeBenefit1: 'Instrumentos y accesorios', homeBenefit2: 'Detalles y especificaciones', homeBenefit3: 'Atención personalizada',
    homeHeroPhotoBadge: 'Explora el catálogo', homeHeroPhotoTitle: 'Tu música comienza aquí',
    homeCatalogEyebrow: 'Catálogo musical', homeCatalogTitle: 'Instrumentos y accesorios',
    homeCatalogDescription: 'Explora instrumentos, consulta características y encuentra lo que necesitas.',
    homeCatalogButtonLabel: 'Ver catálogo musical', homeFeaturedEyebrow: 'Selección destacada',
    homeFeaturedTitle: 'Instrumentos recomendados', homeProductCardBadge: 'Destacado',
    homeProductCardButton: 'Ver instrumento', homeShowEventsSection: false,
    homeShowFeaturesSection: true, homeShowClosingSection: true,
    homeFeature1Title: 'Explora opciones', homeFeature1Description: 'Conoce instrumentos y accesorios para diferentes estilos musicales.',
    homeFeature2Title: 'Consulta características', homeFeature2Description: 'Revisa marca, modelo y detalles de cada instrumento.',
    homeFeature3Title: 'Te asesoramos', homeFeature3Description: 'Estamos disponibles para ayudarte a elegir.',
    homeClosingEyebrow: 'Haz sonar tus ideas', homeClosingTitle: 'Encuentra tu instrumento',
    homeClosingDescription: 'Explora nuestro catálogo y descubre nuevas posibilidades.', homeClosingButtonLabel: 'Ver instrumentos',
    catalogPageDescription: 'Explora instrumentos y accesorios. Consulta marca, modelo y especificaciones.',
    catalogIntroBadge: 'Nuestra tienda musical', catalogSearchPlaceholder: 'Buscar instrumentos o marcas...',
    catalogCategoriesEyebrow: 'Explora por tipo', catalogCategoriesTitle: 'Familias de instrumentos',
    catalogCategoriesDescription: 'Selecciona una categoría para conocer sus productos.',
    catalogResultsEyebrow: 'Disponibles', catalogProductsTitle: 'Instrumentos y accesorios',
    footerBusinessDescription: 'Conoce nuestro catálogo de instrumentos y accesorios musicales. Consulta modelos, marcas y especificaciones.',
    footerServiceBadge: 'Asesoría por WhatsApp', footerContactDescription: '¿Necesitas información sobre un instrumento o sus características? Escríbenos.',
    footerWhatsappButtonLabel: 'Consultar por WhatsApp', footerShowEventsButton: false,
    footerSocialDescription: 'Síguenos para descubrir instrumentos, accesorios y novedades musicales.',
  },
};

export default function StorefrontContentSettings() {

  const [form, setForm] = useState<StorefrontContent>(DEFAULT_STOREFRONT_CONTENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<StoreProfile | ''>('');
  const homeSectionOrder = normalizeHomeSectionOrder(form.homeSectionOrder);

  useEffect(() => {
    let active = true;
    fetch('/api/settings/storefront-content', { headers: { ...tokenHeaders(), Accept: 'application/json' } })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success || !result.data) throw new Error(result.error || 'No se pudo cargar el contenido.');
        if (active) setForm({ ...DEFAULT_STOREFRONT_CONTENT, ...result.data });
      })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'No se pudo cargar la configuración.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function update<K extends keyof StorefrontContent>(key: K, value: StorefrontContent[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setSuccess('');
  }

  function moveHomeSection(sectionId: HomeSectionId, direction: -1 | 1) {
    const nextOrder = normalizeHomeSectionOrder(form.homeSectionOrder);
    const currentIndex = nextOrder.indexOf(sectionId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= nextOrder.length) return;
    [nextOrder[currentIndex], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[currentIndex]];
    update('homeSectionOrder', nextOrder.join(','));
  }

  function applySelectedProfile() {
    if (!selectedProfile) {
      setSuccess('No aplicaste una plantilla. Puedes escribir tu actividad y personalizar cada texto manualmente.');
      setError('');
      return;
    }
    const confirmed = window.confirm('¿Cargar estos textos de ejemplo? Solo reemplazarán los campos del formulario; tu actividad comercial escrita se conservará. Los cambios se guardarán cuando pulses Guardar contenido.');
    if (!confirmed) return;
    const businessActivity = form.businessActivity;
    const designTokensJson = form.designTokensJson;
    const pageBuilderJson = form.pageBuilderJson;
    const genericBase = { ...DEFAULT_STOREFRONT_CONTENT, ...profileContent.general };
    const nextProfile = selectedProfile === 'food'
      ? { ...DEFAULT_STOREFRONT_CONTENT }
      : { ...genericBase, ...profileContent[selectedProfile] };
    setForm({ ...nextProfile, businessActivity, designTokensJson, pageBuilderJson });
    setSuccess('Textos de ejemplo cargados. Tu actividad comercial se conservó. Revisa y edita los campos antes de guardar.');
    setError('');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(''); setSuccess('');
    try {
      const response = await fetch('/api/settings/storefront-content', {
        method: 'PUT',
        headers: { ...tokenHeaders(), 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ content: form }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'No se pudo guardar el contenido.');
      if (result.data) setForm({ ...DEFAULT_STOREFRONT_CONTENT, ...result.data });
      setSuccess('El contenido de la tienda se guardó correctamente. Actualiza la tienda pública para ver los cambios.');
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Ocurrió un error al guardar.');
    } finally { setSaving(false); }
  }

  if (loading) return <div className="p-6 text-sm text-gray-600">Cargando contenido de la tienda…</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="overflow-hidden rounded-2xl bg-[#2B1720] px-6 py-7 text-white shadow-sm sm:px-8">
        <Link to="/settings" className="text-xs font-semibold text-[#E9B9A9] hover:underline">← Volver a configuración</Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-[#E9B9A9]">Personalización de la tienda</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Contenido de la tienda</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">Adapta los textos y las secciones visibles si cambias de productos o actividad. El nombre, logotipo, lema, teléfono, WhatsApp y colores se conservan en Datos del negocio e Identidad visual. Los rótulos de entrega y recogida solo cambian el texto que ve el cliente: no activan transportadoras, envíos nacionales ni modifican cobertura, tarifas o cálculos. Esta pantalla no modifica productos, precios, fotografías, inventario, pedidos, pagos ni domicilios.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/settings/general" className="rounded-xl border border-[#E8DDD7] bg-white p-4 text-sm shadow-sm transition hover:border-[#C98B78]"><strong className="block text-[#3B222B]">Datos del negocio</strong><span className="mt-1 block text-gray-600">Nombre, lema, título de la tienda, teléfono y WhatsApp.</span></Link>
        <Link to="/design/branding" className="rounded-xl border border-[#E8DDD7] bg-white p-4 text-sm shadow-sm transition hover:border-[#C98B78]"><strong className="block text-[#3B222B]">Identidad visual</strong><span className="mt-1 block text-gray-600">Logotipo, favicon y presentación de marca.</span></Link>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {success && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</div>}

      <form onSubmit={save} className="space-y-5">
        <section className="rounded-2xl border border-[#E8DDD7] bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-[#3B222B]">Actividad comercial y plantillas opcionales</h2>
            <p className="mt-1 text-sm text-gray-500">Tu negocio no está limitado a una lista. Escribe libremente qué vendes o qué servicio ofreces. Las plantillas son solo ejemplos para acelerar la redacción y nunca determinan qué productos puedes publicar.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#49343B]" htmlFor="business-activity">Actividad comercial (texto libre)</label>
              <input id="business-activity" type="text" maxLength={120} value={form.businessActivity} onChange={(event) => update('businessActivity', event.target.value)} placeholder="Ej.: Juguetería, ferretería, venta de alitas, materiales de construcción..." className="w-full rounded-xl border border-[#DCCFC9] bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#A96B5D] focus:ring-2 focus:ring-[#F1E2DC]" />
              <p className="mt-1.5 text-xs leading-5 text-gray-500">Puedes escribir cualquier actividad, incluso una que no exista en los ejemplos. Este dato se guarda y no restringe el catálogo.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#49343B]" htmlFor="store-profile">Plantilla de textos sugeridos (opcional)</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <select id="store-profile" value={selectedProfile} onChange={(event) => setSelectedProfile(event.target.value as StoreProfile | '')} className="min-w-0 flex-1 rounded-xl border border-[#DCCFC9] bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-[#A96B5D] focus:ring-2 focus:ring-[#F1E2DC]">
                  <option value="">No aplicar plantilla</option>
                  {Object.entries(profileLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
                <button type="button" onClick={applySelectedProfile} className="rounded-xl border border-[#8F4F43] px-4 py-2.5 text-sm font-semibold text-[#8F4F43] transition hover:bg-[#FBF3EF]">Cargar ejemplos</button>
              </div>
              <p className="mt-1.5 text-xs leading-5 text-gray-500">Puedes no elegir ninguna. Después de cargar un ejemplo, todos los textos siguen siendo editables.</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-500">Los cambios se guardan solo cuando pulses «Guardar contenido».</p>
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><strong>Importante sobre productos, variantes e inventario:</strong> esta configuración no limita las categorías ni los productos. Los grupos de opciones actuales permiten ofrecer elecciones como talla, color, material, sabor o presentación, pero todavía no crean SKU ni existencias independientes por combinación (por ejemplo, talla M en negro). Además, el Worker actual rechaza los pedidos en línea de productos que tengan activado el control de stock porque aún falta la reserva/validación online de inventario. Mantén ese control desactivado para productos de venta en línea hasta implementar la fase 2.</div>
        </section>

        <section className="rounded-2xl border border-[#E8DDD7] bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4"><h2 className="text-lg font-bold text-[#3B222B]">Visibilidad de secciones</h2><p className="mt-1 text-sm text-gray-500">Oculta secciones que tu negocio no vaya a utilizar, sin borrar sus datos.</p></div>
          <div className="grid gap-3 sm:grid-cols-2">
            {toggles.map((item) => (
              <label key={item.key} className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#EFE6E1] p-3.5 hover:bg-[#FFFBF8]">
                <input type="checkbox" checked={Boolean(form[item.key])} onChange={(event) => update(item.key, event.target.checked as StorefrontContent[typeof item.key])} className="mt-0.5 h-4 w-4 accent-[#8F4F43]" />
                <span><span className="block text-sm font-semibold text-[#49343B]">{item.label}</span><span className="mt-1 block text-xs leading-5 text-gray-500">{item.help}</span></span>
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#E8DDD7] bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-[#3B222B]">Orden de la portada</h2>
            <p className="mt-1 text-sm text-gray-500">Organiza los bloques con las flechas. El orden se conserva aunque ocultes temporalmente una sección.</p>
          </div>
          <ol className="space-y-2">
            {homeSectionOrder.map((sectionId, index) => {
              const section = HOME_SECTIONS.find((item) => item.id === sectionId)!;
              const enabled = Boolean(form[section.visibleKey]);
              return (
                <li key={section.id} className="flex items-center gap-3 rounded-xl border border-[#EFE6E1] p-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F8EEE8] text-sm font-bold text-[#8F4F43]">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-[#49343B]">{section.label}</span>
                    <span className="mt-0.5 block text-xs text-gray-500">{enabled ? 'Visible en la portada' : 'Oculta; conserva su posición'}</span>
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => moveHomeSection(section.id, -1)} disabled={index === 0} aria-label={`Subir ${section.label}`} title="Subir" className="rounded-lg border border-[#DCCFC9] px-3 py-2 text-sm font-semibold text-[#654B4D] hover:bg-[#FAF5F1] disabled:cursor-not-allowed disabled:opacity-30">↑</button>
                    <button type="button" onClick={() => moveHomeSection(section.id, 1)} disabled={index === homeSectionOrder.length - 1} aria-label={`Bajar ${section.label}`} title="Bajar" className="rounded-lg border border-[#DCCFC9] px-3 py-2 text-sm font-semibold text-[#654B4D] hover:bg-[#FAF5F1] disabled:cursor-not-allowed disabled:opacity-30">↓</button>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {groups.map((group) => (
          <section key={group.title} className="rounded-2xl border border-[#E8DDD7] bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5"><h2 className="text-lg font-bold text-[#3B222B]">{group.title}</h2><p className="mt-1 text-sm text-gray-500">{group.description}</p></div>
            <div className="grid gap-4 md:grid-cols-2">
              {group.fields.map((field) => (
                <div key={field.key} className={field.multiline ? 'md:col-span-2' : ''}>
                  <label className="mb-1.5 block text-sm font-semibold text-[#49343B]" htmlFor={String(field.key)}>{field.label}</label>
                  {field.multiline ? (
                    <textarea id={String(field.key)} className="w-full min-h-24 resize-y rounded-xl border border-[#DCCFC9] bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#A96B5D] focus:ring-2 focus:ring-[#F1E2DC]" maxLength={600} value={String(form[field.key])} onChange={(event) => update(field.key, event.target.value as StorefrontContent[typeof field.key])} />
                  ) : (
                    <input id={String(field.key)} className="w-full rounded-xl border border-[#DCCFC9] bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#A96B5D] focus:ring-2 focus:ring-[#F1E2DC]" maxLength={180} value={String(form[field.key])} onChange={(event) => update(field.key, event.target.value as StorefrontContent[typeof field.key])} />
                  )}
                  {field.help && <p className="mt-1.5 text-xs leading-5 text-gray-500">{field.help}</p>}
                </div>
              ))}
            </div>
          </section>
        ))}

        <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E8DDD7] bg-white/95 p-3 shadow-lg backdrop-blur">
          <p className="px-2 text-xs text-gray-500">Solo se guardan textos y opciones de visibilidad. Los datos de productos y pedidos se mantienen separados.</p>
          <button type="submit" disabled={saving} className="rounded-xl bg-[#8F4F43] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#744037] disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar contenido'}</button>
        </div>
      </form>
    </div>
  );
}
