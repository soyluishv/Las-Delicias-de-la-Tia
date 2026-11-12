import { useState } from 'react';
import type { FormEvent } from 'react';

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
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  eventType: '',
  eventDate: '',
  guestCount: '',
  city: '',
  neighborhood: '',
  venueAddress: '',
  budgetCop: '',
  requestedFood: '',
  eventDetails: '',
  whatsappConsent: false,
};

const inputClass =
  'w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-[#A71942] focus:ring-2 focus:ring-[#A71942]/10';

const labelClass =
  'mb-2 block text-sm font-semibold text-gray-700';

export default function Events() {
  const [form, setForm] = useState<EventForm>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const today = new Date();
  const minDate = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');

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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json() as {
        success?: boolean;
        message?: string;
        error?: string;
        data?: { requestNumber?: string };
      };

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'No fue posible enviar tu solicitud.');
      }

      const number = result.data?.requestNumber || '';

      setSuccess(
        `¡Tu solicitud fue recibida! Número de seguimiento: ${number}`
      );

      setForm(initialForm);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Ocurrió un error. Intenta nuevamente.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FFF8F1] px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">

        <div className="mb-10 text-center">
          <span className="inline-block rounded-full bg-[#FCE8E7] px-4 py-2 text-xs font-extrabold tracking-widest text-[#921638]">
            LAS DELICIAS DE LA TÍA
          </span>

          <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-[#76152F] sm:text-4xl">
            Celebremos juntos tus momentos especiales
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-gray-600">
            Cuéntanos qué estás organizando. Queremos conocer los detalles
            de tu evento para preparar una propuesta de comidas a tu medida.
          </p>

          <p className="mt-3 text-sm font-semibold text-[#A71942]">
            Para cada antojo, una experiencia.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-8 rounded-3xl border border-[#F0DDD5] bg-white p-5 shadow-xl shadow-[#76152F]/5 sm:p-9"
        >

          <section>
            <h2 className="mb-5 text-xl font-bold text-[#76152F]">
              1. Información de contacto
            </h2>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="contactName">
                  Nombre completo *
                </label>
                <input
                  id="contactName"
                  className={inputClass}
                  value={form.contactName}
                  onChange={(e) => updateField('contactName', e.target.value)}
                  placeholder="Tu nombre"
                  maxLength={100}
                  autoComplete="name"
                  required
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="contactPhone">
                  Teléfono o WhatsApp *
                </label>
                <input
                  id="contactPhone"
                  type="tel"
                  className={inputClass}
                  value={form.contactPhone}
                  onChange={(e) => updateField('contactPhone', e.target.value)}
                  placeholder="Tu número de contacto"
                  maxLength={25}
                  autoComplete="tel"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="contactEmail">
                  Correo electrónico (opcional)
                </label>
                <input
                  id="contactEmail"
                  type="email"
                  className={inputClass}
                  value={form.contactEmail}
                  onChange={(e) => updateField('contactEmail', e.target.value)}
                  placeholder="correo@ejemplo.com"
                  maxLength={150}
                  autoComplete="email"
                />
              </div>

              <div className="sm:col-span-2 rounded-xl border border-[#F0DDD5] bg-[#FFF8F1] p-4">
                <label htmlFor="whatsappConsent" className="flex cursor-pointer items-start gap-3">
                  <input
                    id="whatsappConsent"
                    type="checkbox"
                    checked={form.whatsappConsent}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        whatsappConsent: e.target.checked,
                      }))
                    }
                    className="mt-1 h-4 w-4 shrink-0 accent-[#A71942]"
                  />
                  <span className="text-sm leading-relaxed text-gray-700">
                    Autorizo a Las Delicias de la Tía a contactarme por WhatsApp
                    para responder esta solicitud y compartir la cotización. Esta
                    autorización es opcional y puedo solicitar que dejen de escribirme.
                  </span>
                </label>
                <p className="mt-2 pl-7 text-xs text-gray-500">
                  Puedes enviar tu solicitud aunque no marques esta casilla.
                </p>
              </div>
            </div>
          </section>

          <div className="border-t border-gray-100" />

          <section>
            <h2 className="mb-5 text-xl font-bold text-[#76152F]">
              2. Información del evento
            </h2>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="eventType">
                  ¿Qué evento estás organizando? *
                </label>
                <select
                  id="eventType"
                  className={inputClass}
                  value={form.eventType}
                  onChange={(e) => updateField('eventType', e.target.value)}
                  required
                >
                  <option value="">Selecciona una opción</option>
                  <option value="Cumpleaños">Cumpleaños</option>
                  <option value="Reunión familiar">Reunión familiar</option>
                  <option value="Evento empresarial">Evento empresarial</option>
                  <option value="Grado">Grado</option>
                  <option value="Bautizo o primera comunión">Bautizo o primera comunión</option>
                  <option value="Aniversario">Aniversario</option>
                  <option value="Otro evento">Otro evento</option>
                </select>
              </div>

              <div>
                <label className={labelClass} htmlFor="eventDate">
                  Fecha del evento
                </label>
                <input
                  id="eventDate"
                  type="date"
                  min={minDate}
                  className={inputClass}
                  value={form.eventDate}
                  onChange={(e) => updateField('eventDate', e.target.value)}
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="guestCount">
                  Número de invitados
                </label>
                <input
                  id="guestCount"
                  type="number"
                  min="1"
                  max="10000"
                  step="1"
                  className={inputClass}
                  value={form.guestCount}
                  onChange={(e) => updateField('guestCount', e.target.value)}
                  placeholder="Ej. 50"
                />
              </div>
            </div>
          </section>

          <div className="border-t border-gray-100" />

          <section>
            <h2 className="mb-5 text-xl font-bold text-[#76152F]">
              3. Lugar del evento
            </h2>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="city">
                  Ciudad o municipio
                </label>
                <input
                  id="city"
                  className={inputClass}
                  value={form.city}
                  onChange={(e) => updateField('city', e.target.value)}
                  placeholder="Ej. Medellín"
                  maxLength={100}
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="neighborhood">
                  Barrio o sector
                </label>
                <input
                  id="neighborhood"
                  className={inputClass}
                  value={form.neighborhood}
                  onChange={(e) => updateField('neighborhood', e.target.value)}
                  placeholder="Nombre del barrio"
                  maxLength={100}
                />
              </div>

              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="venueAddress">
                  Dirección o lugar
                </label>
                <input
                  id="venueAddress"
                  className={inputClass}
                  value={form.venueAddress}
                  onChange={(e) => updateField('venueAddress', e.target.value)}
                  placeholder="Dirección donde se realizará el evento"
                  maxLength={250}
                />
              </div>
            </div>
          </section>

          <div className="border-t border-gray-100" />

          <section>
            <h2 className="mb-5 text-xl font-bold text-[#76152F]">
              4. Comidas y presupuesto
            </h2>

            <div className="space-y-5">
              <div>
                <label className={labelClass} htmlFor="requestedFood">
                  ¿Qué comidas o productos te interesan?
                </label>
                <textarea
                  id="requestedFood"
                  rows={3}
                  maxLength={2000}
                  className={inputClass}
                  value={form.requestedFood}
                  onChange={(e) => updateField('requestedFood', e.target.value)}
                  placeholder="Cuéntanos qué te gustaría incluir en tu evento..."
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="budgetCop">
                  Presupuesto aproximado (COP)
                </label>
                <input
                  id="budgetCop"
                  type="number"
                  min="0"
                  max="1000000000"
                  step="1"
                  className={inputClass}
                  value={form.budgetCop}
                  onChange={(e) => updateField('budgetCop', e.target.value)}
                  placeholder="Ej. 500000"
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="eventDetails">
                  Detalles adicionales
                </label>
                <textarea
                  id="eventDetails"
                  rows={4}
                  maxLength={2000}
                  className={inputClass}
                  value={form.eventDetails}
                  onChange={(e) => updateField('eventDetails', e.target.value)}
                  placeholder="¿Hay algún detalle especial que debamos conocer?"
                />
              </div>
            </div>
          </section>

          {error && (
            <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div role="status" className="rounded-xl bg-green-50 p-4 text-sm leading-relaxed text-green-800">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-[#A71942] px-6 py-4 font-bold text-white shadow-lg shadow-[#A71942]/20 transition hover:bg-[#821333] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Enviando solicitud...' : 'Enviar solicitud de cotización'}
          </button>

          <p className="text-center text-xs leading-relaxed text-gray-500">
            Tus datos se utilizarán para atender esta solicitud y preparar
            tu cotización. No necesitas crear una cuenta.
          </p>
        </form>
      </div>
    </main>
  );
}