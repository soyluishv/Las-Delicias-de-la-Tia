import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.js';
import { useAuth } from '../context/AuthContext.js';
import { useTheme } from '../context/ThemeContext.js';

type OrderType = 'delivery' | 'pickup';
type PaymentMethodCode = 'BANCOLOMBIA' | 'NEQUI' | 'BREB';
type PaymentMethod = 'CASH' | PaymentMethodCode;

interface CheckoutSettings {
  allowDelivery: boolean;
  allowPickup: boolean;
  freeDeliveryEnabled: boolean;
  freeDeliveryMinUnits: number;
  acceptOrders: boolean;
  allowGuestCheckout: boolean;
  allowScheduledOrders: boolean;
  allowCashPayment: boolean;
  minimumDeliveryOrderCop: number;
  minimumPickupOrderCop: number;
  deliveryPrepMinutes: number;
  pickupPrepMinutes: number;
}

interface DeliveryZone {
  id: string;
  name: string;
  city: string | null;
  neighborhoods: string[];
  feeCop: number;
  minimumOrderCop: number;
  isActive: boolean;
}

interface PaymentMethodInfo {
  methodCode: PaymentMethodCode;
  displayName: string;
  accountHolder: string;
  accountType: string | null;
  accountNumber: string | null;
  bankName: string | null;
  paymentKey: string | null;
}

interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const inputClassName =
  'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500';

const OTHER_NEIGHBORHOOD_OPTION = 'Otro barrio o sector';

function formatCOP(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(Math.round(value || 0));
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('es');
}

export default function Checkout() {
  const { items, subtotal, clear } = useCart();
  const { token } = useAuth();
  const { settings: themeSettings } = useTheme();
  const content = themeSettings.storefrontContent;
  const navigate = useNavigate();

  const [orderType, setOrderType] = useState<OrderType>('delivery');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [address, setAddress] = useState({
    line1: '',
    line2: '',
    neighborhood: '',
    city: ''
  });
  const [otherNeighborhood, setOtherNeighborhood] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [comment, setComment] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [whatsappUpdatesConsent, setWhatsappUpdatesConsent] = useState(false);

  const [settings, setSettings] = useState<CheckoutSettings | null>(null);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodInfo[]>([]);
  const [configurationLoading, setConfigurationLoading] = useState(true);
  const [configurationError, setConfigurationError] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadCheckoutConfiguration() {
      setConfigurationLoading(true);
      setConfigurationError('');

      try {
        const [settingsResponse, zonesResponse, paymentResponse] = await Promise.all([
          fetch('/api/settings'),
          fetch('/api/delivery-zones'),
          fetch('/api/payment-methods')
        ]);

        const settingsResult = await settingsResponse.json() as ApiResult<{
          allowDelivery: boolean;
          allowPickup: boolean;
          freeDeliveryEnabled: boolean;
          freeDeliveryMinUnits: number;
          acceptOrders: boolean;
          allowGuestCheckout: boolean;
          allowScheduledOrders: boolean;
          allowCashPayment: boolean;
          minimumDeliveryOrderCop: number;
          minimumPickupOrderCop: number;
          deliveryPrepMinutes: number;
          pickupPrepMinutes: number;
        }>;

        if (!settingsResponse.ok || !settingsResult.success || !settingsResult.data) {
          throw new Error(settingsResult.error || content.checkoutConfigurationErrorMessage);
        }

        const zonesResult = await zonesResponse.json() as ApiResult<DeliveryZone[]>;
        const paymentResult = await paymentResponse.json() as ApiResult<PaymentMethodInfo[]>;

        if (!active) return;

        const loadedSettings: CheckoutSettings = {
          allowDelivery: settingsResult.data.allowDelivery === true,
          allowPickup: settingsResult.data.allowPickup === true,
          freeDeliveryEnabled: settingsResult.data.freeDeliveryEnabled === true,
          freeDeliveryMinUnits: Number(settingsResult.data.freeDeliveryMinUnits || 0),
          acceptOrders: settingsResult.data.acceptOrders === true,
          allowGuestCheckout: settingsResult.data.allowGuestCheckout === true,
          allowScheduledOrders: settingsResult.data.allowScheduledOrders === true,
          allowCashPayment: settingsResult.data.allowCashPayment === true,
          minimumDeliveryOrderCop: Number(settingsResult.data.minimumDeliveryOrderCop || 0),
          minimumPickupOrderCop: Number(settingsResult.data.minimumPickupOrderCop || 0),
          deliveryPrepMinutes: Number(settingsResult.data.deliveryPrepMinutes || 0),
          pickupPrepMinutes: Number(settingsResult.data.pickupPrepMinutes || 0)
        };

        setSettings(loadedSettings);
        setDeliveryZones(
          zonesResponse.ok && zonesResult.success && Array.isArray(zonesResult.data)
            ? zonesResult.data.filter(zone => zone.isActive)
            : []
        );
        const activePaymentMethods = paymentResponse.ok && paymentResult.success && Array.isArray(paymentResult.data)
          ? paymentResult.data
          : [];
        setPaymentMethods(activePaymentMethods);
        if (!loadedSettings.allowCashPayment && activePaymentMethods.length > 0) {
          setPaymentMethod(activePaymentMethods[0].methodCode);
        }

        if (loadedSettings.allowDelivery) {
          setOrderType('delivery');
        } else if (loadedSettings.allowPickup) {
          setOrderType('pickup');
        }
      } catch {
        if (!active) return;
        setConfigurationError(content.checkoutConfigurationErrorMessage);
      } finally {
        if (active) setConfigurationLoading(false);
      }
    }

    void loadCheckoutConfiguration();
    return () => {
      active = false;
    };
  }, [content.checkoutConfigurationErrorMessage]);

  const availableCities = useMemo(() => {
    const cities = deliveryZones
      .map(zone => zone.city?.trim() || '')
      .filter(Boolean);
    return Array.from(new Set(cities)).sort((a, b) => a.localeCompare(b, 'es'));
  }, [deliveryZones]);

  const availableNeighborhoods = useMemo(() => {
    if (!address.city) return [];

    const neighborhoods = deliveryZones
      .filter(zone => normalizeText(zone.city || '') === normalizeText(address.city))
      .flatMap(zone => zone.neighborhoods);
    const unique = Array.from(new Set(neighborhoods));
    const hasOtherOption = unique.some(item => normalizeText(item) === normalizeText(OTHER_NEIGHBORHOOD_OPTION));
    const regularNeighborhoods = unique
      .filter(item => normalizeText(item) !== normalizeText(OTHER_NEIGHBORHOOD_OPTION))
      .sort((a, b) => a.localeCompare(b, 'es'));

    return hasOtherOption ? [...regularNeighborhoods, OTHER_NEIGHBORHOOD_OPTION] : regularNeighborhoods;
  }, [deliveryZones, address.city]);

  const selectedZone = useMemo(() => {
    if (orderType !== 'delivery' || !address.city || !address.neighborhood) return null;

    return deliveryZones.find(zone =>
      normalizeText(zone.city || '') === normalizeText(address.city) &&
      zone.neighborhoods.some(
        neighborhood => normalizeText(neighborhood) === normalizeText(address.neighborhood)
      )
    ) || null;
  }, [deliveryZones, orderType, address.city, address.neighborhood]);

  const selectedPaymentInfo = paymentMethods.find(
    method => method.methodCode === paymentMethod
  ) || null;

  const quantityTotal = items.reduce((total, item) => total + item.quantity, 0);
  const freeDeliveryApplies = Boolean(
    orderType === 'delivery' &&
    settings?.freeDeliveryEnabled &&
    quantityTotal >= settings.freeDeliveryMinUnits
  );
  const deliveryFee = orderType === 'pickup'
    ? 0
    : freeDeliveryApplies
      ? 0
      : selectedZone?.feeCop ?? 0;
  const total = Math.max(0, Math.round(subtotal + deliveryFee));
  const configuredMinimum = orderType === 'delivery'
    ? settings?.minimumDeliveryOrderCop ?? 0
    : settings?.minimumPickupOrderCop ?? 0;
  const minimumOrder = Math.max(configuredMinimum, orderType === 'delivery' ? selectedZone?.minimumOrderCop ?? 0 : 0);
  const belowMinimum = Boolean(minimumOrder > 0 && subtotal < minimumOrder);

  const canUseDelivery = settings?.allowDelivery === true;
  const canUsePickup = settings?.allowPickup === true;
  const canAcceptOrders = settings?.acceptOrders === true && settings?.allowGuestCheckout === true;
  const electronicPayment = paymentMethod !== 'CASH';
  const canPay = settings?.allowCashPayment === true || paymentMethods.length > 0;

  if (items.length === 0) {
    return (
      <div data-ld-page="checkout" className="ld-checkout mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">{content.checkoutEmptyTitle}</h1>
        <p className="mb-6 text-sm text-gray-600">{content.checkoutEmptyDescription}</p>
        <Link
          to="/menu"
          className="inline-block rounded-lg bg-primary-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-primary-700"
        >
          {content.checkoutEmptyButtonLabel}
        </Link>
      </div>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!settings) {
      setError(content.checkoutConfigurationErrorMessage);
      return;
    }
    if (!settings.acceptOrders || !settings.allowGuestCheckout) {
      setError(content.checkoutOrdersUnavailableMessage);
      return;
    }
    if (!settings.allowScheduledOrders && scheduledAt) {
      setError(content.checkoutScheduledUnavailableError);
      return;
    }
    if (paymentMethod === 'CASH' && !settings.allowCashPayment) {
      setError(content.checkoutCashUnavailableError);
      return;
    }

    if (orderType === 'delivery') {
      if (!settings.allowDelivery) {
        setError(content.checkoutDeliveryUnavailableError);
        return;
      }
      if (!selectedZone) {
        setError(content.checkoutCoverageUnavailableError);
        return;
      }
      if (belowMinimum) {
        setError(content.checkoutMinimumOrderError.replace('{amount}', formatCOP(minimumOrder)));
        return;
      }
      if (address.neighborhood === OTHER_NEIGHBORHOOD_OPTION && !otherNeighborhood.trim()) {
        setError(content.checkoutOtherNeighborhoodRequiredError);
        return;
      }
      if (address.neighborhood === OTHER_NEIGHBORHOOD_OPTION && otherNeighborhood.trim().length > 100) {
        setError(content.checkoutOtherNeighborhoodLengthError);
        return;
      }
      if (!address.line1.trim()) {
        setError(content.checkoutAddressRequiredError);
        return;
      }
    } else if (!settings.allowPickup) {
      setError(content.checkoutPickupUnavailableError);
      return;
    } else if (belowMinimum) {
      setError(content.checkoutMinimumOrderError.replace('{amount}', formatCOP(minimumOrder)));
      return;
    }

    if (!customerName.trim() || !customerPhone.trim()) {
      setError(content.checkoutCustomerContactRequiredError);
      return;
    }

    if (electronicPayment && !selectedPaymentInfo) {
      setError(content.checkoutPaymentUnavailableError);
      return;
    }

    setLoading(true);

    try {
      const orderItems = items.map(item => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        comment: item.comment,
        options: item.options.map(option => ({
          menuOptionValueId: option.valueId,
          name: option.optionName,
          value: option.valueName,
          priceModifier: option.priceModifier
        }))
      }));

      const body: Record<string, unknown> = {
        orderType: orderType === 'delivery' ? 'DELIVERY' : 'PICKUP',
        paymentMethod,
        items: orderItems,
        comment: comment.trim() || undefined,
        scheduledAt: scheduledAt || undefined,
        guestName: customerName.trim(),
        guestPhone: customerPhone.trim(),
        guestEmail: customerEmail.trim() || undefined,
        whatsappUpdatesConsent
      };

      if (orderType === 'delivery') {
        body.address = {
          line1: address.line1.trim(),
          line2: address.line2.trim(),
          neighborhood: address.neighborhood === OTHER_NEIGHBORHOOD_OPTION
            ? otherNeighborhood.trim()
            : address.neighborhood,
          city: address.city
        };
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      const result = await response.json().catch(() => ({})) as ApiResult<{
        id: string;
        orderNumber: string;
        orderType: string;
        status: string;
        paymentMethod: string;
        paymentStatus: string;
      }>;

      if (!response.ok || !result.success || !result.data?.id) {
        setError(content.checkoutOrderCreateError);
        return;
      }

      const orderId = result.data.id;
      clear();
      navigate(`/order/${orderId}`, { state: { order: result.data } });
    } catch {
      setError(content.checkoutUnexpectedError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div data-ld-page="checkout" className="ld-checkout mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold text-gray-900">{content.checkoutTitle}</h1>
      <p className="mb-8 text-sm text-gray-600">{content.checkoutSubtitle}</p>

      {configurationLoading && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          {content.checkoutConfigurationLoadingMessage}
        </div>
      )}

      {configurationError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {configurationError}
        </div>
      )}
      {settings && !canAcceptOrders && (
        <div role="status" className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {content.checkoutOrdersUnavailableMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="ld-checkout-form flex flex-col gap-8 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-6">
          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">{content.checkoutReceiveTitle}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={!canUseDelivery || configurationLoading}
                onClick={() => setOrderType('delivery')}
                className={`rounded-lg border-2 p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  orderType === 'delivery'
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="block font-semibold text-gray-900">{content.checkoutDeliveryLabel}</span>
                <span className="mt-1 block text-sm text-gray-600">{content.checkoutDeliveryDescription}</span>
              </button>
              <button
                type="button"
                disabled={!canUsePickup || configurationLoading}
                onClick={() => setOrderType('pickup')}
                className={`rounded-lg border-2 p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  orderType === 'pickup'
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="block font-semibold text-gray-900">{content.checkoutPickupLabel}</span>
                <span className="mt-1 block text-sm text-gray-600">{content.checkoutPickupDescription}</span>
              </button>
            </div>
            {!configurationLoading && !canUseDelivery && !canUsePickup && (
              <p className="mt-3 text-sm text-red-700">{content.checkoutNoDeliveryModesMessage}</p>
            )}
          </section>

          {orderType === 'delivery' && (
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">{content.checkoutAddressTitle}</h2>
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">{content.checkoutCityLabel}</span>
                  <select
                    required
                    value={address.city}
                    onChange={event => {
                      setAddress({ ...address, city: event.target.value, neighborhood: '' });
                      setOtherNeighborhood('');
                    }}
                    className={inputClassName}
                  >
                    <option value="">{content.checkoutCityPlaceholder}</option>
                    {availableCities.map(city => <option key={city} value={city}>{city}</option>)}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">{content.checkoutNeighborhoodLabel}</span>
                  <select
                    required
                    value={address.neighborhood}
                    onChange={event => {
                      setAddress({ ...address, neighborhood: event.target.value });
                      setOtherNeighborhood('');
                    }}
                    disabled={!address.city || availableNeighborhoods.length === 0}
                    className={inputClassName}
                  >
                    <option value="">{content.checkoutNeighborhoodPlaceholder}</option>
                    {availableNeighborhoods.map(neighborhood => (
                      <option key={neighborhood} value={neighborhood}>{neighborhood}</option>
                    ))}
                  </select>
                </label>

                {address.neighborhood === OTHER_NEIGHBORHOOD_OPTION && (
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700">{content.checkoutOtherNeighborhoodLabel}</span>
                    <input
                      type="text"
                      required
                      maxLength={100}
                      placeholder={content.checkoutOtherNeighborhoodPlaceholder}
                      value={otherNeighborhood}
                      onChange={event => setOtherNeighborhood(event.target.value)}
                      className={inputClassName}
                    />
                    <span className="mt-1 block text-xs text-gray-500">{content.checkoutOtherNeighborhoodFeeNote}</span>
                  </label>
                )}

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">{content.checkoutAddressLabel}</span>
                  <input
                    type="text"
                    required
                    maxLength={250}
                    placeholder={content.checkoutAddressPlaceholder}
                    value={address.line1}
                    onChange={event => setAddress({ ...address, line1: event.target.value })}
                    className={inputClassName}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">{content.checkoutAddressExtraLabel}</span>
                  <input
                    type="text"
                    maxLength={250}
                    placeholder={content.checkoutAddressExtraPlaceholder}
                    value={address.line2}
                    onChange={event => setAddress({ ...address, line2: event.target.value })}
                    className={inputClassName}
                  />
                </label>

                {address.city && availableNeighborhoods.length === 0 && (
                  <p className="text-sm text-amber-700">{content.checkoutNoNeighborhoodsMessage}</p>
                )}

                {selectedZone && (
                  <div className="rounded-lg bg-gray-50 p-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-600">{content.checkoutDeliveryFeeLabel}</span>
                      <strong className="text-gray-900">{freeDeliveryApplies ? content.checkoutFreeDeliveryLabel : formatCOP(selectedZone.feeCop)}</strong>
                    </div>
                    {minimumOrder > 0 && (
                      <p className="mt-1 text-gray-600">{content.checkoutMinimumOrderMessage.replace('{amount}', formatCOP(minimumOrder))}</p>
                    )}
                    {belowMinimum && (
                      <p className="mt-2 font-medium text-red-700">{content.checkoutBelowMinimumMessage.replace('{amount}', formatCOP(minimumOrder - subtotal))}</p>
                    )}
                    {freeDeliveryApplies && (
                      <p className="mt-1 text-green-700">{content.checkoutFreeDeliveryMessage}</p>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {orderType === 'pickup' && (
            <section className="rounded-xl border border-green-200 bg-green-50 p-5">
              <h2 className="font-semibold text-green-900">{content.checkoutPickupNoticeTitle}</h2>
              <p className="mt-1 text-sm text-green-800">
                {content.checkoutPickupNoticeDescription}
              </p>
              {minimumOrder > 0 && <p className={`mt-2 text-sm ${belowMinimum ? 'font-medium text-red-700' : 'text-green-800'}`}>{content.checkoutPickupMinimumMessage.replace('{amount}', formatCOP(minimumOrder))}{belowMinimum ? ` ${content.checkoutPickupMinimumBelowMessage.replace('{amount}', formatCOP(minimumOrder - subtotal))}` : ''}</p>}
            </section>
          )}

          {settings?.allowScheduledOrders && (
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">{content.checkoutScheduledTitle}</h2>
            <div className="space-y-3">
              <label className="flex items-center gap-3 text-sm text-gray-700">
                <input
                  type="radio"
                  name="schedule"
                  checked={!scheduledAt}
                  onChange={() => setScheduledAt('')}
                  className="accent-primary-600"
                />
                {content.checkoutScheduleAsapLabel}
              </label>
              <label className="flex items-center gap-3 text-sm text-gray-700">
                <input
                  type="radio"
                  name="schedule"
                  checked={!!scheduledAt}
                  onChange={() => setScheduledAt(getDefaultScheduleTime())}
                  className="accent-primary-600"
                />
                {content.checkoutScheduleLaterLabel}
              </label>
              {scheduledAt && (
                <input
                  type="datetime-local"
                  required
                  value={scheduledAt}
                  min={getDefaultScheduleTime()}
                  onChange={event => setScheduledAt(event.target.value)}
                  className={inputClassName}
                />
              )}
            </div>
          </section>
          )}

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">{content.checkoutNotesTitle}</h2>
            <textarea
              value={comment}
              onChange={event => setComment(event.target.value)}
              maxLength={1000}
              rows={3}
              placeholder={content.checkoutNotesPlaceholder}
              className={`${inputClassName} resize-y`}
            />
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">{content.checkoutContactTitle}</h2>
            <p className="mb-3 text-sm text-gray-600">{content.checkoutContactDescription}</p>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">{content.checkoutCustomerNameLabel}</span>
                <input
                  type="text"
                  required
                  maxLength={120}
                  autoComplete="name"
                  value={customerName}
                  onChange={event => setCustomerName(event.target.value)}
                  className={inputClassName}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">{content.checkoutCustomerPhoneLabel}</span>
                <input
                  type="tel"
                  required
                  maxLength={30}
                  autoComplete="tel"
                  value={customerPhone}
                  onChange={event => setCustomerPhone(event.target.value)}
                  className={inputClassName}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">{content.checkoutCustomerEmailLabel}</span>
                <input
                  type="email"
                  maxLength={254}
                  autoComplete="email"
                  value={customerEmail}
                  onChange={event => setCustomerEmail(event.target.value)}
                  className={inputClassName}
                />
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <input
                  type="checkbox"
                  checked={whatsappUpdatesConsent}
                  onChange={event => setWhatsappUpdatesConsent(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-primary-600"
                />
                <span className="text-sm text-gray-700">
                  <span className="block font-medium text-gray-900">{content.checkoutWhatsappConsentLabel}</span>
                  <span className="mt-1 block text-xs leading-5 text-gray-500">{content.checkoutWhatsappConsentDescription}</span>
                </span>
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">{content.checkoutPaymentMethodTitle}</h2>
            <div className="space-y-2">
              {settings?.allowCashPayment && <label className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-colors ${paymentMethod === 'CASH' ? 'border-primary-600 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'CASH'}
                  onChange={() => setPaymentMethod('CASH')}
                  className="accent-primary-600"
                />
                <span>
                  <span className="block text-sm font-medium text-gray-900">{content.checkoutCashPaymentTitle}</span>
                  <span className="block text-xs text-gray-600">{content.checkoutCashPaymentDescription}</span>
                </span>
              </label>}

              {paymentMethods.map(method => (
                <label
                  key={method.methodCode}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-colors ${paymentMethod === method.methodCode ? 'border-primary-600 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === method.methodCode}
                    onChange={() => setPaymentMethod(method.methodCode)}
                    className="accent-primary-600"
                  />
                  <span className="text-sm font-medium text-gray-900">{method.displayName}</span>
                </label>
              ))}
            </div>
            {!canPay && <p className="mt-3 text-sm text-red-700">{content.checkoutNoPaymentMethodsMessage}</p>}

            {electronicPayment && selectedPaymentInfo && (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <h3 className="font-semibold text-blue-950">{content.checkoutPaymentDetailsTitle}</h3>
                <dl className="mt-2 space-y-1 text-sm text-blue-950">
                  <div><dt className="inline font-medium">{content.checkoutPaymentAccountHolderLabel} </dt><dd className="inline">{selectedPaymentInfo.accountHolder || content.checkoutPaymentAccountHolderFallback}</dd></div>
                  {selectedPaymentInfo.bankName && <div><dt className="inline font-medium">{content.checkoutPaymentBankLabel} </dt><dd className="inline">{selectedPaymentInfo.bankName}</dd></div>}
                  {selectedPaymentInfo.accountType && <div><dt className="inline font-medium">{content.checkoutPaymentAccountTypeLabel} </dt><dd className="inline">{selectedPaymentInfo.accountType}</dd></div>}
                  {selectedPaymentInfo.accountNumber && <div><dt className="inline font-medium">{content.checkoutPaymentAccountNumberLabel} </dt><dd className="inline">{selectedPaymentInfo.accountNumber}</dd></div>}
                  {selectedPaymentInfo.paymentKey && <div><dt className="inline font-medium">{content.checkoutPaymentKeyLabel} </dt><dd className="inline">{selectedPaymentInfo.paymentKey}</dd></div>}
                </dl>
                <p className="mt-3 text-xs leading-5 text-blue-900">
                  {content.checkoutPaymentAdvanceNotice}
                </p>
              </div>
            )}

            {paymentMethod === 'CASH' && (
              <p className="mt-3 text-sm text-gray-600">
                {content.checkoutCashPendingNotice}
              </p>
            )}
          </section>
        </div>

        <aside className="ld-checkout-summary shrink-0 lg:w-80">
          <div className="sticky top-24 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">{content.checkoutSummaryTitle}</h2>

            <div className="mb-4 space-y-3">
              {items.map(item => {
                const optionsTotal = item.options.reduce((sum, option) => sum + option.priceModifier, 0);
                const itemTotal = (item.price + optionsTotal) * item.quantity;

                return (
                  <div key={item.id} className="flex justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <span className="mr-1 text-gray-500">{item.quantity} ×</span>
                      <span className="text-gray-800">{item.name}</span>
                      {item.options.length > 0 && (
                        <p className="ml-5 text-xs text-gray-500">
                          {item.options.map(option => option.valueName).join(', ')}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 font-medium text-gray-900">{formatCOP(itemTotal)}</span>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2 border-t border-gray-200 pt-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-gray-600">{content.checkoutSubtotalLabel}</span>
                <span className="text-gray-900">{formatCOP(subtotal)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-600">{content.checkoutDeliveryFeeLabel}</span>
                <span className="text-gray-900">{formatCOP(deliveryFee)}</span>
              </div>
              {orderType === 'pickup' && (
                <p className="text-xs text-green-700">{content.checkoutPickupSummaryNote}</p>
              )}
              <div className="flex justify-between gap-3 border-t border-gray-200 pt-3 text-base font-bold">
                <span>{content.checkoutTotalLabel}</span>
                <span className="text-primary-700">{formatCOP(total)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={
                loading ||
                configurationLoading ||
                !settings ||
                !canAcceptOrders ||
                !canPay ||
                belowMinimum ||
                (orderType === 'delivery' && (!canUseDelivery || !selectedZone)) ||
                (orderType === 'pickup' && !canUsePickup)
              }
              className="mt-5 w-full rounded-lg bg-primary-600 py-3 font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? content.checkoutLoadingLabel : `${content.checkoutSubmitLabel} · ${formatCOP(total)}`}
            </button>

            <p className="mt-3 text-center text-xs leading-5 text-gray-500">
              {content.checkoutPriceValidationNote}
            </p>
          </div>
        </aside>
      </form>
    </div>
  );
}

function getDefaultScheduleTime(): string {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}
