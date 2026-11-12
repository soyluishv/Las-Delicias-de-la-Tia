import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export default function AccountSecurity() {
  const { user, login } = useAuth();
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [recoveryConfigured, setRecoveryConfigured] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [changeError, setChangeError] = useState('');
  const [changeSuccess, setChangeSuccess] = useState('');

  const [recoveryCurrentPassword, setRecoveryCurrentPassword] = useState('');
  const [generatingCode, setGeneratingCode] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    api.get<ApiEnvelope<{ configured: boolean }>>('/auth/recovery-code/status')
      .then((result) => {
        if (active) setRecoveryConfigured(Boolean(result.data?.configured));
      })
      .catch((error: unknown) => {
        if (active) setRecoveryError(error instanceof Error ? error.message : 'No se pudo consultar el estado del código.');
      })
      .finally(() => { if (active) setLoadingStatus(false); });
    return () => { active = false; };
  }, []);

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setChangeError('');
    setChangeSuccess('');
    if (newPassword !== confirmPassword) {
      setChangeError('La confirmación no coincide con la nueva contraseña.');
      return;
    }
    if (newPassword.length < 12) {
      setChangeError('La nueva contraseña debe tener al menos 12 caracteres.');
      return;
    }
    setChangingPassword(true);
    try {
      const result = await api.post<ApiEnvelope<{ token: string }>>('/auth/password/change', {
        currentPassword,
        newPassword,
      });
      login(result.data.token);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setChangeSuccess('Tu contraseña se actualizó correctamente. La sesión de este navegador continúa protegida con la nueva clave.');
    } catch (error) {
      setChangeError(error instanceof Error ? error.message : 'No se pudo cambiar la contraseña.');
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleGenerateRecoveryCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRecoveryError('');
    setRecoverySuccess('');
    setRecoveryCode('');
    setCopied(false);
    setGeneratingCode(true);
    try {
      const result = await api.post<ApiEnvelope<{ recoveryCode: string }>>('/auth/recovery-code/create', {
        currentPassword: recoveryCurrentPassword,
      });
      setRecoveryCode(result.data.recoveryCode);
      setRecoveryConfigured(true);
      setRecoveryCurrentPassword('');
      setRecoverySuccess('Código creado. Guárdalo ahora en un lugar seguro; por seguridad solo se muestra esta vez.');
    } catch (error) {
      setRecoveryError(error instanceof Error ? error.message : 'No se pudo crear el código de recuperación.');
    } finally {
      setGeneratingCode(false);
    }
  }

  async function copyRecoveryCode() {
    if (!recoveryCode) return;
    try {
      await navigator.clipboard.writeText(recoveryCode);
      setCopied(true);
    } catch {
      setRecoveryError('El navegador no permitió copiarlo. Selecciona el código y cópialo manualmente.');
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <Link to="/" className="text-sm font-medium text-[#8F4F43] hover:underline">← Volver al panel</Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#A96B5D]">Cuenta administrativa</p>
        <h1 className="mt-1 text-2xl font-bold text-[#3B222B]">Seguridad de la cuenta</h1>
        <p className="mt-1 text-sm text-gray-600">Cambia tu contraseña y prepara una forma segura de recuperar el acceso.</p>
      </header>

      <section className="rounded-2xl border border-[#E8DDD7] bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold text-[#3B222B]">Cuenta actual</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-[#FAF6F3] p-3"><p className="text-xs text-gray-500">Nombre</p><p className="mt-1 font-semibold text-gray-900">{user?.name || '—'}</p></div>
          <div className="rounded-xl bg-[#FAF6F3] p-3"><p className="text-xs text-gray-500">Correo de acceso</p><p className="mt-1 font-semibold text-gray-900">{user?.email || '—'}</p></div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#E8DDD7] bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold text-[#3B222B]">Cambiar contraseña</h2>
        <p className="mt-1 text-sm text-gray-600">Puedes cambiarla cuando quieras. Por seguridad, debes escribir primero la contraseña actual.</p>
        {changeError && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{changeError}</div>}
        {changeSuccess && <div role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{changeSuccess}</div>}
        <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
          <div><label htmlFor="current-password" className="mb-1 block text-sm font-medium text-gray-700">Contraseña actual</label><input id="current-password" type="password" autoComplete="current-password" required maxLength={128} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#A96B5D] focus:ring-2 focus:ring-[#F1E2DC]" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="new-password" className="mb-1 block text-sm font-medium text-gray-700">Nueva contraseña</label><input id="new-password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#A96B5D] focus:ring-2 focus:ring-[#F1E2DC]" /><p className="mt-1 text-xs text-gray-500">Mínimo 12 caracteres.</p></div>
            <div><label htmlFor="confirm-password" className="mb-1 block text-sm font-medium text-gray-700">Confirmar nueva contraseña</label><input id="confirm-password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#A96B5D] focus:ring-2 focus:ring-[#F1E2DC]" /></div>
          </div>
          <button type="submit" disabled={changingPassword} className="rounded-lg bg-[#8F4F43] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#744037] disabled:opacity-50">{changingPassword ? 'Actualizando…' : 'Guardar nueva contraseña'}</button>
        </form>
      </section>

      <section className="rounded-2xl border border-[#E8DDD7] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-lg font-bold text-[#3B222B]">Código de recuperación</h2><p className="mt-1 text-sm text-gray-600">Sirve para crear una contraseña nueva si algún día olvidas la actual y no puedes entrar al panel.</p></div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${recoveryConfigured ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{loadingStatus ? 'Consultando…' : recoveryConfigured ? 'Configurado' : 'Pendiente de configurar'}</span>
        </div>
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Importante</p>
          <p className="mt-1">El código se muestra una sola vez. Escríbelo o guárdalo en un lugar privado fuera de este computador. No lo compartas con nadie. Si lo pierdes, mientras puedas entrar al panel puedes generar uno nuevo; el anterior dejará de servir.</p>
        </div>
        {recoveryError && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{recoveryError}</div>}
        {recoverySuccess && <div role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{recoverySuccess}</div>}
        {recoveryCode && <div className="mt-4 rounded-xl border-2 border-dashed border-[#C98B78] bg-[#FCF7F4] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[#8F4F43]">Tu nuevo código · guárdalo ahora</p><p className="mt-2 break-all font-mono text-lg font-bold tracking-wide text-[#3B222B]">{recoveryCode}</p><button type="button" onClick={copyRecoveryCode} className="mt-3 rounded-lg border border-[#C98B78] px-3 py-2 text-sm font-semibold text-[#8F4F43] hover:bg-white">{copied ? 'Copiado' : 'Copiar código'}</button></div>}
        <form onSubmit={handleGenerateRecoveryCode} className="mt-4 space-y-3">
          <label htmlFor="recovery-current-password" className="block text-sm font-medium text-gray-700">Confirma tu contraseña actual para {recoveryConfigured ? 'renovar' : 'crear'} el código</label>
          <input id="recovery-current-password" type="password" autoComplete="current-password" required maxLength={128} value={recoveryCurrentPassword} onChange={(event) => setRecoveryCurrentPassword(event.target.value)} className="w-full max-w-lg rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#A96B5D] focus:ring-2 focus:ring-[#F1E2DC]" />
          <div><button type="submit" disabled={generatingCode || loadingStatus} className="rounded-lg border border-[#8F4F43] px-5 py-2.5 text-sm font-semibold text-[#8F4F43] transition hover:bg-[#FCF7F4] disabled:opacity-50">{generatingCode ? 'Generando…' : recoveryConfigured ? 'Renovar código de recuperación' : 'Crear código de recuperación'}</button></div>
        </form>
      </section>
    </div>
  );
}
