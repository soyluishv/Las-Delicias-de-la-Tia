import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

type PaymentMethodCode = 'BANCOLOMBIA' | 'NEQUI' | 'BREB';

interface PaymentMethod {
  methodCode: PaymentMethodCode;
  displayName: string;
  accountHolder: string;
  accountType: string | null;
  accountNumber: string | null;
  bankName: string | null;
  paymentKey: string | null;
  isEnabled: boolean;
}

const METHOD_ORDER: PaymentMethodCode[] = ['BANCOLOMBIA', 'NEQUI', 'BREB'];

const EMPTY_METHODS: PaymentMethod[] = [
  {
    methodCode: 'BANCOLOMBIA',
    displayName: 'Bancolombia',
    accountHolder: '',
    accountType: '',
    accountNumber: '',
    bankName: 'Bancolombia',
    paymentKey: '',
    isEnabled: false,
  },
  {
    methodCode: 'NEQUI',
    displayName: 'Nequi',
    accountHolder: '',
    accountType: '',
    accountNumber: '',
    bankName: 'Nequi',
    paymentKey: '',
    isEnabled: false,
  },
  {
    methodCode: 'BREB',
    displayName: 'Llave Bre-B',
    accountHolder: '',
    accountType: '',
    accountNumber: '',
    bankName: '',
    paymentKey: '',
    isEnabled: false,
  },
];

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100';
const labelClass = 'mb-1 block text-sm font-medium text-gray-700';

function normalizeMethods(rawMethods: unknown): PaymentMethod[] {
  if (!Array.isArray(rawMethods)) return EMPTY_METHODS;

  return METHOD_ORDER.map((code) => {
    const raw = rawMethods.find(
      (method: unknown) =>
        !!method &&
        typeof method === 'object' &&
        (method as Record<string, unknown>).methodCode === code,
    ) as Record<string, unknown> | undefined;

    const fallback = EMPTY_METHODS.find((method) => method.methodCode === code)!;
    if (!raw) return { ...fallback };

    return {
      methodCode: code,
      displayName: fallback.displayName,
      accountHolder: typeof raw.accountHolder === 'string' ? raw.accountHolder : '',
      accountType: typeof raw.accountType === 'string' ? raw.accountType : '',
      accountNumber: typeof raw.accountNumber === 'string' ? raw.accountNumber : '',
      bankName: typeof raw.bankName === 'string' ? raw.bankName : fallback.bankName,
      paymentKey: typeof raw.paymentKey === 'string' ? raw.paymentKey : '',
      isEnabled: raw.isEnabled === true,
    };
  });
}

export default function SettingsPayments() {
  const token = localStorage.getItem('token') || '';
  const [methods, setMethods] = useState<PaymentMethod[]>(EMPTY_METHODS.map((method) => ({ ...method })));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadMethods = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/settings/payment', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'No fue posible cargar los medios de pago.');
      }

      setMethods(normalizeMethods(result.data?.methods));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Error de conexión al cargar los medios de pago.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadMethods();
  }, [loadMethods]);

  function updateMethod(code: PaymentMethodCode, changes: Partial<PaymentMethod>) {
    setMethods((current) =>
      current.map((method) =>
        method.methodCode === code ? { ...method, ...changes } : method,
      ),
    );
    setSuccess('');
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/settings/payment', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          methods: METHOD_ORDER.map((code) => {
            const method = methods.find((entry) => entry.methodCode === code)!;
            return {
              methodCode: method.methodCode,
              isEnabled: method.isEnabled,
              accountHolder: method.accountHolder,
              accountType: method.accountType || null,
              accountNumber: method.accountNumber || null,
              bankName: method.bankName || null,
              paymentKey: method.paymentKey || null,
            };
          }),
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'No fue posible guardar los medios de pago.');
      }

      setSuccess(result.message || 'Los medios de pago se guardaron correctamente.');
      await loadMethods();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Error de conexión al guardar los medios de pago.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Cargando medios de pago…</div>;
  }

  const bancolombia = methods.find((method) => method.methodCode === 'BANCOLOMBIA')!;
  const nequi = methods.find((method) => method.methodCode === 'NEQUI')!;
  const breb = methods.find((method) => method.methodCode === 'BREB')!;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link to="/settings" className="text-sm font-medium text-primary-600 hover:text-primary-700">
            ← Volver a configuración
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Medios de pago</h1>
          <p className="mt-1 text-sm text-gray-600">
            Configura las cuentas y llaves donde recibirás los pagos anticipados.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        Los pagos electrónicos se registran como pendientes. El pedido solo debe marcarse como pagado cuando
        el negocio compruebe que recibió el dinero.
      </div>

      <div className="space-y-5">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Bancolombia</h2>
              <p className="mt-1 text-sm text-gray-500">Transferencias a tu cuenta Bancolombia.</p>
            </div>
            <label className="flex shrink-0 items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={bancolombia.isEnabled}
                onChange={(event) => updateMethod('BANCOLOMBIA', { isEnabled: event.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              Activo
            </label>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="bancolombia-holder">Titular de la cuenta</label>
              <input id="bancolombia-holder" className={inputClass} value={bancolombia.accountHolder} maxLength={120}
                onChange={(event) => updateMethod('BANCOLOMBIA', { accountHolder: event.target.value })}
                placeholder="Nombre del titular" />
            </div>
            <div>
              <label className={labelClass} htmlFor="bancolombia-bank">Banco</label>
              <input id="bancolombia-bank" className={inputClass} value={bancolombia.bankName || ''} maxLength={100}
                onChange={(event) => updateMethod('BANCOLOMBIA', { bankName: event.target.value })}
                placeholder="Bancolombia" />
            </div>
            <div>
              <label className={labelClass} htmlFor="bancolombia-type">Tipo de cuenta</label>
              <select id="bancolombia-type" className={inputClass} value={bancolombia.accountType || ''}
                onChange={(event) => updateMethod('BANCOLOMBIA', { accountType: event.target.value })}>
                <option value="">Selecciona el tipo de cuenta</option>
                <option value="Ahorros">Cuenta de ahorros</option>
                <option value="Corriente">Cuenta corriente</option>
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="bancolombia-number">Número de cuenta</label>
              <input id="bancolombia-number" className={inputClass} value={bancolombia.accountNumber || ''} maxLength={80}
                onChange={(event) => updateMethod('BANCOLOMBIA', { accountNumber: event.target.value })}
                placeholder="Número de cuenta receptora" autoComplete="off" />
            </div>
          </div>
          {bancolombia.isEnabled && (!bancolombia.accountHolder.trim() || !bancolombia.accountType?.trim() || !bancolombia.accountNumber?.trim()) && (
            <p className="mt-3 text-sm text-amber-700">Completa el titular, tipo y número de cuenta antes de guardar.</p>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Nequi</h2>
              <p className="mt-1 text-sm text-gray-500">Pagos enviados al número celular receptor.</p>
            </div>
            <label className="flex shrink-0 items-center gap-2 text-sm font-medium text-gray-700">
              <input type="checkbox" checked={nequi.isEnabled}
                onChange={(event) => updateMethod('NEQUI', { isEnabled: event.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              Activo
            </label>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="nequi-holder">Titular</label>
              <input id="nequi-holder" className={inputClass} value={nequi.accountHolder} maxLength={120}
                onChange={(event) => updateMethod('NEQUI', { accountHolder: event.target.value })}
                placeholder="Nombre del titular" />
            </div>
            <div>
              <label className={labelClass} htmlFor="nequi-number">Número celular de Nequi</label>
              <input id="nequi-number" className={inputClass} value={nequi.accountNumber || ''} maxLength={80}
                onChange={(event) => updateMethod('NEQUI', { accountNumber: event.target.value })}
                placeholder="Celular receptor" inputMode="tel" autoComplete="off" />
            </div>
          </div>
          {nequi.isEnabled && (!nequi.accountHolder.trim() || !nequi.accountNumber?.trim()) && (
            <p className="mt-3 text-sm text-amber-700">Completa el titular y el número celular antes de guardar.</p>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Llave Bre-B</h2>
              <p className="mt-1 text-sm text-gray-500">Transferencias a tu llave receptora.</p>
            </div>
            <label className="flex shrink-0 items-center gap-2 text-sm font-medium text-gray-700">
              <input type="checkbox" checked={breb.isEnabled}
                onChange={(event) => updateMethod('BREB', { isEnabled: event.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              Activo
            </label>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="breb-holder">Titular</label>
              <input id="breb-holder" className={inputClass} value={breb.accountHolder} maxLength={120}
                onChange={(event) => updateMethod('BREB', { accountHolder: event.target.value })}
                placeholder="Nombre del titular" />
            </div>
            <div>
              <label className={labelClass} htmlFor="breb-key">Llave receptora</label>
              <input id="breb-key" className={inputClass} value={breb.paymentKey || ''} maxLength={120}
                onChange={(event) => updateMethod('BREB', { paymentKey: event.target.value })}
                placeholder="Número, documento, correo o llave registrada" autoComplete="off" />
            </div>
          </div>
          {breb.isEnabled && (!breb.accountHolder.trim() || !breb.paymentKey?.trim()) && (
            <p className="mt-3 text-sm text-amber-700">Completa el titular y la llave receptora antes de guardar.</p>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-gray-50 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Efectivo contra entrega o recogida</h2>
              <p className="mt-1 text-sm text-gray-600">
                El cliente paga cuando recibe o recoge su pedido. El pago queda pendiente hasta registrar la recepción.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">Disponible</span>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            El control para activar o desactivar el efectivo no está disponible en la API actual; por eso no mostramos
            un interruptor que no pueda guardar los cambios.
          </p>
        </section>
      </div>

      <div className="mt-6 flex justify-end">
        <button type="button" onClick={handleSave} disabled={saving}
          className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60">
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}
