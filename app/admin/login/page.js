'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setError('Senha incorreta.');
      } else if (res.status === 429) {
        setError('Muitas tentativas. Aguarde alguns minutos.');
      } else if (res.status === 400) {
        setError('Requisição inválida.');
      } else if (res.status === 500) {
        setError('Serviço temporariamente indisponível. Tente mais tarde.');
      } else {
        setError(data.error || 'Não foi possível entrar. Tente novamente.');
      }
      return;
    }
    router.push('/admin');
    router.refresh();
  }

  return (
    <div className="login-shell">
      <h1>Área da loja</h1>
      <p>Entre com a senha para gerenciar peças e pedidos.</p>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label>Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </div>
        {error && <p className="form-error">{error}</p>}
        <button className="submit-btn" type="submit" disabled={loading}>
          {loading ? 'entrando…' : 'entrar'}
        </button>
      </form>
    </div>
  );
}
