import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useTheme } from '../context/ThemeContext.js';

interface EventForm {
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  eventType: string;
  eventDate: string;
  guestCount: string;
  city: string;
  neighborhood: string;
  venueAddress: string;
  budgetCop: string;
  requestedFood: string;
  eventDetails: string;
  whatsappConsent: boolean;
}

const initialForm: EventForm = {
  contactName: '', contactPhone: '', contactEmail: '', eventType: '', eventDate: '',
  guestCount: '', city: '', neighborhood: '', venueAddress: '', budgetCop: '',
  requestedFood: '', eventDetails: '', whatsappConsent: false,
};

const inputClass = 'w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-[#A71942] focus:ring-2 focus:ring-[#A71942]/10';
const labelClass = 'mb-2 block text-sm font-semibold text-gray-700';

export default function Events() {
  const { settings } = useTheme();
  const content = settings.storefrontContent;
  const businessName = settings.siteName || 'Las Delicias de la Tía';
  const [form, setForm] = useState<EventForm>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const eventTypes = useMemo(() => {
    const options = content.eventsTypeOptions.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    return options.length ? [...new Set(options)] : ['Otro evento'];
  }, [content.eventsTypeOptions]);

  const today = new Date();
  const minDate = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');

  function updateField(field: keyof EventForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        guestCount: form.guestCount === '' ? null : Number(form.guestCount),
        budgetCop: form.budgetCop === '' ? null : Number(form.budgetCop),
      };
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as {
        success?: boolean;
        message?: string;
        error?: string;
        data?: { requestNumber?: string };
      };
      if (!response.ok || !result.success) {
        throw new Error(result.error || content.eventsRequestErrorMessage);
      }
      const number = result.data?.requestNumber || '';
      setSuccess(content.eventsSuccessMessage.replaceAll('{number}', number));
      setForm(initialForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : content.eventsGenericErrorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  const consentText = content.eventsConsentText.replaceAll('{businessName}', businessName);

  return (
    <main data-ld-page="events" className="min-h-screen bg-[#FFF8F1] px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10 text-center">
          <span className="inline-block rounded-full bg-[#FCE8E7] px-4 py-2 text-xs font-extrabold tracking-widest text-[#921638]">
            {content.eventsPageBadge.replaceAll('{businessName}', businessName)}
          </span>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-[#76152F] sm:text-4xl">{content.eventsPageTitle}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-gray-600">{content.eventsPageDescription}</p>
          <p className="mt-3 text-sm font-semibold text-[#A71942]">{content.eventsPageTagline}</p>
        </div>

        <form onSubmit={handleSubmit} className="ld-event-form space-y-8 rounded-3xl border border-[#F0DDD5] bg-white p-5 shadow-xl shadow-[#76152F]/5 sm:p-9">
          <section>
            <h2 className="mb-5 text-xl font-bold text-[#76152F]">{content.eventsContactSectionTitle}</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="contactName">{content.eventsNameLabel}</label>
                <input id="contactName" className={inputClass} value={form.contactName} onChange={(e) => updateField('contactName', e.target.value)} placeholder={content.eventsNamePlaceholder} maxLength={100} autoComplete="name" required />
              </div>
              <div>
                <label className={labelClass} htmlFor="contactPhone">{content.eventsPhoneLabel}</label>
                <input id="contactPhone" type="tel" className={inputClass} value={form.contactPhone} onChange={(e) => updateField('contactPhone', e.target.value)} placeholder={content.eventsPhonePlaceholder} maxLength={25} autoComplete="tel" required />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="contactEmail">{content.eventsEmailLabel}</label>
                <input id="contactEmail" type="email" className={inputClass} value={form.contactEmail} onChange={(e) => updateField('contactEmail', e.target.value)} placeholder={content.eventsEmailPlaceholder} maxLength={150} autoComplete="email" />
              </div>
              <div className="sm:col-span-2 rounded-xl border border-[#F0DDD5] bg-[#FFF8F1] p-4">
                <label htmlFor="whatsappConsent" className="flex cursor-pointer items-start gap-3">
                  <input id="whatsappConsent" type="checkbox" checked={form.whatsappConsent} onChange={(e) => setForm((current) => ({ ...current, whatsappConsent: e.target.checked }))} className="mt-1 h-4 w-4 shrink-0 accent-[#A71942]" />
                  <span className="text-sm leading-relaxed text-gray-700">{consentText}</span>
                </label>
                <p className="mt-2 pl-7 text-xs text-gray-500">{content.eventsConsentHelp}</p>
              </div>
            </div>
          </section>

          <div className="border-t border-gray-100" />
          <section>
            <h2 className="mb-5 text-xl font-bold text-[#76152F]">{content.eventsDetailsSectionTitle}</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="eventType">{content.eventsTypeLabel}</label>
                <select id="eventType" className={inputClass} value={form.eventType} onChange={(e) => updateField('eventType', e.target.value)} required>
                  <option value="">{content.eventsTypePlaceholder}</option>
                  {eventTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="eventDate">{content.eventsDateLabel}</label>
                <input id="eventDate" type="date" min={minDate} className={inputClass} value={form.eventDate} onChange={(e) => updateField('eventDate', e.target.value)} />
              </div>
              <div>
                <label className={labelClass} htmlFor="guestCount">{content.eventsGuestCountLabel}</label>
                <input id="guestCount" type="number" min="1" max="10000" step="1" className={inputClass} value={form.guestCount} onChange={(e) => updateField('guestCount', e.target.value)} placeholder={content.eventsGuestCountPlaceholder} />
              </div>
            </div>
          </section>

          <div className="border-t border-gray-100" />
          <section>
            <h2 className="mb-5 text-xl font-bold text-[#76152F]">{content.eventsLocationSectionTitle}</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="city">{content.eventsCityLabel}</label>
                <input id="city" className={inputClass} value={form.city} onChange={(e) => updateField('city', e.target.value)} placeholder={content.eventsCityPlaceholder} maxLength={100} />
              </div>
              <div>
                <label className={labelClass} htmlFor="neighborhood">{content.eventsNeighborhoodLabel}</label>
                <input id="neighborhood" className={inputClass} value={form.neighborhood} onChange={(e) => updateField('neighborhood', e.target.value)} placeholder={content.eventsNeighborhoodPlaceholder} maxLength={100} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="venueAddress">{content.eventsAddressLabel}</label>
                <input id="venueAddress" className={inputClass} value={form.venueAddress} onChange={(e) => updateField('venueAddress', e.target.value)} placeholder={content.eventsAddressPlaceholder} maxLength={250} />
              </div>
            </div>
          </section>

          <div className="border-t border-gray-100" />
          <section>
            <h2 className="mb-5 text-xl font-bold text-[#76152F]">{content.eventsFoodBudgetSectionTitle}</h2>
            <div className="space-y-5">
              <div>
                <label className={labelClass} htmlFor="requestedFood">{content.eventsFoodLabel}</label>
                <textarea id="requestedFood" rows={3} maxLength={2000} className={inputClass} value={form.requestedFood} onChange={(e) => updateField('requestedFood', e.target.value)} placeholder={content.eventsFoodPlaceholder} />
              </div>
              <div>
                <label className={labelClass} htmlFor="budgetCop">{content.eventsBudgetLabel}</label>
                <input id="budgetCop" type="number" min="0" max="1000000000" step="1" className={inputClass} value={form.budgetCop} onChange={(e) => updateField('budgetCop', e.target.value)} placeholder={content.eventsBudgetPlaceholder} />
              </div>
              <div>
                <label className={labelClass} htmlFor="eventDetails">{content.eventsAdditionalDetailsLabel}</label>
                <textarea id="eventDetails" rows={4} maxLength={2000} className={inputClass} value={form.eventDetails} onChange={(e) => updateField('eventDetails', e.target.value)} placeholder={content.eventsAdditionalDetailsPlaceholder} />
              </div>
            </div>
          </section>

          {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          {success && <div role="status" className="rounded-xl bg-green-50 p-4 text-sm leading-relaxed text-green-800">{success}</div>}

          <button type="submit" disabled={submitting} className="w-full rounded-xl bg-[#A71942] px-6 py-4 font-bold text-white shadow-lg shadow-[#A71942]/20 transition hover:bg-[#821333] disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? content.eventsSubmittingLabel : content.eventsSubmitLabel}
          </button>
          <p className="text-center text-xs leading-relaxed text-gray-500">{content.eventsPrivacyNote}</p>
        </form>
      </div>
    </main>
  );
}
