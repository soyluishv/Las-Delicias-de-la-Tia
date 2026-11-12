import { useState, type FormEvent } from 'react';

interface Props { onLogin: (token: string) => void; }
type Screen = 'login' | 'recover';

export default function Login({ onLogin }: Props) {
  const [screen, setScreen] = useState<Screen>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSuccess(''); setLoading(true);
    try {
      const response = await fetch('/api/auth/staff/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No fue posible iniciar sesión.');
      onLogin(result.data.token);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Ocurrió un error al iniciar sesión.');
    } finally { setLoading(false); }
  }

  async function handleRecover(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSuccess('');
    if (newPassword.length < 12) { setError('La nueva contraseña debe tener al menos 12 caracteres.'); return; }
    if (newPassword !== confirmPassword) { setError('La confirmación de la nueva contraseña no coincide.'); return; }
    setLoading(true);
    try {
      const response = await fetch('/api/auth/password/recover', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, recoveryCode, newPassword }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo recuperar el acceso.');
      setPassword(''); setRecoveryCode(''); setNewPassword(''); setConfirmPassword('');
      setScreen('login');
      setSuccess('La contraseña se actualizó correctamente. El código de recuperación utilizado quedó desactivado. Inicia sesión y genera uno nuevo desde Seguridad de la cuenta.');
    } catch (recoverError) {
      setError(recoverError instanceof Error ? recoverError.message : 'No se pudo recuperar el acceso.');
    } finally { setLoading(false); }
  }

  function openRecovery() {
    setError(''); setSuccess(''); setScreen('recover');
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#2B1720] px-4 py-10">
      <div className="pointer-events-none absolute -left-28 -top-28 h-96 w-96 rounded-full bg-[#8F4F43]/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-[#D8A58E]/15 blur-3xl" />
      <div className="relative w-full max-w-md">
        <div className="mb-7 text-center">
          <div className="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl bg-white p-2 shadow-xl"><img src="/brand/las-delicias-de-la-tia-logo.png" alt="Logotipo de Las Delicias de la Tía" className="h-full w-full object-contain" /></div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.24em] text-[#E9B9A9]">Las Delicias de la Tía</p>
          <h1 className="mt-2 text-2xl font-bold text-white">Panel de administración</h1>
          <p className="mt-2 text-sm text-white/65">Gestiona tu negocio desde un solo lugar.</p>
        </div>

        {screen === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-5 rounded-2xl border border-white/10 bg-white p-7 shadow-2xl sm:p-8">
            <div><h2 className="text-xl font-bold text-[#3B222B]">Bienvenido</h2><p className="mt-1 text-sm text-gray-500">Ingresa tus datos para continuar.</p></div>
            {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            {success && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{success}</div>}
            <div><label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-gray-700">Correo electrónico</label><input id="login-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="username" autoFocus className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#A96B5D] focus:ring-2 focus:ring-[#F1E2DC]" /></div>
            <div><label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-gray-700">Contraseña</label><input id="login-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" maxLength={128} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#A96B5D] focus:ring-2 focus:ring-[#F1E2DC]" /></div>
            <button type="submit" disabled={loading} className="w-full rounded-lg bg-[#8F4F43] py-3 text-sm font-semibold text-white transition hover:bg-[#744037] disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'Ingresando…' : 'Iniciar sesión'}</button>
            <div className="text-center"><button type="button" onClick={openRecovery} className="text-sm font-semibold text-[#8F4F43] hover:underline">¿Olvidaste tu contraseña?</button></div>
            <p className="text-center text-xs text-gray-400">Acceso privado de administración.</p>
          </form>
        ) : (
          <form onSubmit={handleRecover} className="space-y-4 rounded-2xl border border-white/10 bg-white p-7 shadow-2xl sm:p-8">
            <div><button type="button" onClick={() => { setScreen('login'); setError(''); }} className="text-sm font-medium text-[#8F4F43] hover:underline">← Volver al inicio de sesión</button><h2 className="mt-3 text-xl font-bold text-[#3B222B]">Recuperar contraseña</h2><p className="mt-1 text-sm text-gray-500">Usa el código único que guardaste previamente en Seguridad de la cuenta.</p></div>
            {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <div><label htmlFor="recover-email" className="mb-1.5 block text-sm font-medium text-gray-700">Correo de acceso</label><input id="recover-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="username" className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#A96B5D] focus:ring-2 focus:ring-[#F1E2DC]" /></div>
            <div><label htmlFor="recovery-code" className="mb-1.5 block text-sm font-medium text-gray-700">Código de recuperación</label><input id="recovery-code" type="text" value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value.toUpperCase())} required autoComplete="off" maxLength={128} spellCheck={false} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 font-mono text-sm uppercase outline-none focus:border-[#A96B5D] focus:ring-2 focus:ring-[#F1E2DC]" /></div>
            <div><label htmlFor="recover-new-password" className="mb-1.5 block text-sm font-medium text-gray-700">Nueva contraseña</label><input id="recover-new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#A96B5D] focus:ring-2 focus:ring-[#F1E2DC]" /><p className="mt-1 text-xs text-gray-500">Mínimo 12 caracteres.</p></div>
            <div><label htmlFor="recover-confirm-password" className="mb-1.5 block text-sm font-medium text-gray-700">Confirmar nueva contraseña</label><input id="recover-confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#A96B5D] focus:ring-2 focus:ring-[#F1E2DC]" /></div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">El código de recuperación se puede utilizar una sola vez. Después de recuperar el acceso, inicia sesión y genera un código nuevo.</div>
            <button type="submit" disabled={loading} className="w-full rounded-lg bg-[#8F4F43] py-3 text-sm font-semibold text-white transition hover:bg-[#744037] disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'Validando…' : 'Restablecer contraseña'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
