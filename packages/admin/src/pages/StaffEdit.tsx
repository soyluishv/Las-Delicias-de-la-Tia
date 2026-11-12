import { useState, useEffect, FormEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';

interface Staff {
  id: string;
  email: string;
  name: string;
  role: string;
  phone: string | null;
  isActive: boolean;
  locationId: string | null;
  location: { id: string; name: string } | null;
}

export default function StaffEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [staff, setStaff] = useState<Staff | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token') || '';

  useEffect(() => {
    fetch(`/api/staff/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((staffData) => {
        if (!staffData.success) throw new Error(staffData.error || 'No se pudo cargar el usuario.');
        const s = staffData.data;
        setStaff(s);
        setName(s.name);
        setRole(s.role);
        setPhone(s.phone || '');
        setIsActive(s.isActive);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const res = await fetch(`/api/staff/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name,
          role,
          phone: phone || null,
          isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo actualizar el usuario.');
      navigate('/staff');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!staff) {
    return <div className="bg-red-50 text-red-700 p-4 rounded-lg">{error || 'No se encontró el usuario.'}</div>;
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/staff" className="text-gray-400 hover:text-gray-600">
          ← Volver
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Editar usuario</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
          <input
            type="email"
            value={staff.email}
            disabled
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          >
            <option value="STAFF">Personal</option>
            <option value="MANAGER">Gerente</option>
            <option value="SUPER_ADMIN">Superadministrador</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isActive"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <label htmlFor="isActive" className="text-sm text-gray-700">Usuario activo</label>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  );
}
