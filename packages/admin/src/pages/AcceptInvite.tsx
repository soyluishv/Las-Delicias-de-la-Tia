import { useState, useEffect, type FormEvent } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const tokenParam = searchParams.get('token') || '';
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validating, setValidating] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [tokenError, setTokenError] = useState('');

  useEffect(() => {
    if (!tokenParam) { setTokenError('No se encontró el código de invitación.'); setValidating(false); return; }
    fetch(`/api/staff/invite/${tokenParam}`).then((response) => response.json()).then((result) => {
      if (!result.success) throw new Error(result.error || 'La invitación no es válida.');
      setEmail(result.data.email); setRole(result.data.role);
    }).catch((loadError) => setTokenError(loadError instanceof Error ? loadError.message : 'No se pudo validar la invitación.')).finally(() => setValidating(false));
  }, [tokenParam]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden.'); return; }
    setSubmitting(true);
    try {
      const response = await fetch('/api/staff/accept-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tokenParam, name, password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No fue posible aceptar la invitación.');
      login(result.data.token); navigate('/');
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : 'Ocurrió un error al aceptar la invitación.'); }
    finally { setSubmitting(false); }
  }

  const roleLabels: Record<string, string> = { SUPER_ADMIN: 'Superadministrador', MANAGER: 'Gerente', STAFF: 'Personal' };
  if (validating) return <div className="flex min-h-screen items-center justify-center bg-[#2B1720]"><div className="h-9 w-9 animate-spin rounded-full border-4 border-[#E9B9A9] border-t-transparent" /></div>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#2B1720] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center"><img src="/brand/las-delicias-de-la-tia-logo.png" alt="Logotipo de Las Delicias de la Tía" className="mx-auto h-24 w-24 rounded-2xl bg-white p-2 object-contain" /><h1 className="mt-4 text-xl font-bold text-white">Las Delicias de la Tía</h1><p className="mt-1 text-sm text-white/65">Acceso al panel de administración</p></div>
        <div className="rounded-2xl bg-white p-7 shadow-2xl">
          {tokenError ? <><div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-xl text-red-700">!</div><h2 className="text-lg font-bold text-gray-900">Invitación no válida</h2><p className="mt-2 text-sm text-gray-600">{tokenError}</p></> : <form onSubmit={handleSubmit} className="space-y-4">
            <div><h2 className="text-xl font-bold text-[#3B222B]">Activa tu acceso</h2><p className="mt-1 text-sm text-gray-600">Has recibido una invitación como <strong>{roleLabels[role] || role}</strong>.</p><p className="mt-1 text-xs text-gray-400">{email}</p></div>
            {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <div><label className="mb-1 block text-sm font-medium text-gray-700">Nombre completo</label><input value={name} onChange={(event) => setName(event.target.value)} required autoFocus className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm" /></div>
            <div><label className="mb-1 block text-sm font-medium text-gray-700">Crear contraseña</label><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} autoComplete="new-password" className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm" /></div>
            <div><label className="mb-1 block text-sm font-medium text-gray-700">Confirmar contraseña</label><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={6} autoComplete="new-password" className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm" /></div>
            <button type="submit" disabled={submitting} className="w-full rounded-lg bg-[#8F4F43] py-2.5 text-sm font-semibold text-white hover:bg-[#744037] disabled:opacity-50">{submitting ? 'Activando acceso…' : 'Aceptar invitación'}</button>
          </form>}
        </div>
      </div>
    </div>
  );
}
