'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

function formatBRL(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const STATUS_LABEL = {
  pending: 'pendente',
  confirmed: 'confirmado',
  delivered: 'entregue',
  cancelled: 'cancelado',
  available: 'disponível',
  reserved: 'reservado',
  sold: 'vendido',
};

const EMPTY_FORM = { name: '', category: 'vestido', size: '', price: '', imageUrl: '', description: '' };

export default function AdminDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [ordersRes, itemsRes] = await Promise.all([fetch('/api/orders'), fetch('/api/items')]);
    if (ordersRes.status === 401) {
      router.push('/admin/login');
      return;
    }
    const ordersData = await ordersRes.json();
    const itemsData = await itemsRes.json();
    setOrders(ordersData.orders || []);
    setItems(itemsData.items || []);
    setLoading(false);
  }

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
    router.refresh();
  }

  async function updateOrder(orderId, status) {
    await fetch(`/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    loadAll();
  }

  function startEdit(item) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      category: item.category,
      size: item.size,
      price: String(item.price),
      imageUrl: item.imageUrl || '',
      description: item.description || '',
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSaveItem(e) {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      category: form.category,
      size: form.size.trim(),
      price: parseFloat(form.price),
      imageUrl: form.imageUrl.trim() || null,
      description: form.description.trim() || null,
    };
    if (!payload.name || !payload.size || Number.isNaN(payload.price)) return;

    if (editingId) {
      await fetch(`/api/items/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    resetForm();
    loadAll();
  }

  async function handleDeleteItem(id) {
    if (!confirm('Excluir esta peça definitivamente?')) return;
    await fetch(`/api/items/${id}`, { method: 'DELETE' });
    loadAll();
  }

  async function markSold(item) {
    await fetch(`/api/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: item.status === 'sold' ? 'available' : 'sold' }),
    });
    loadAll();
  }

  return (
    <div className="wrap admin-shell">
      <div className="admin-header">
        <h1>Área da loja</h1>
        <button className="mini-btn" onClick={handleLogout}>sair</button>
      </div>

      <div className="admin-tabs">
        <button className={`admin-tab ${tab === 'orders' ? 'active' : ''}`} onClick={() => setTab('orders')}>pedidos</button>
        <button className={`admin-tab ${tab === 'items' ? 'active' : ''}`} onClick={() => setTab('items')}>peças</button>
      </div>

      {loading ? (
        <p className="empty-note">Carregando…</p>
      ) : tab === 'orders' ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>cliente</th>
                <th>peças</th>
                <th>total</th>
                <th>status</th>
                <th>ações</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr><td colSpan={5} style={{ color: 'var(--ink-soft)' }}>Nenhum pedido ainda.</td></tr>
              )}
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <div>{order.customerName}</div>
                    <div className="mono" style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{order.phone}</div>
                  </td>
                  <td>
                    {order.items.map((it) => (
                      <div key={it.id} style={{ fontSize: 13 }}>{it.name} · tam. {it.size}</div>
                    ))}
                  </td>
                  <td className="mono">{formatBRL(order.total)}</td>
                  <td><span className={`pill ${order.status}`}>{STATUS_LABEL[order.status]}</span></td>
                  <td>
                    <div className="row-actions">
                      {order.status === 'pending' && (
                        <button className="mini-btn" onClick={() => updateOrder(order.id, 'confirmed')}>confirmar</button>
                      )}
                      {order.status === 'confirmed' && (
                        <button className="mini-btn" onClick={() => updateOrder(order.id, 'delivered')}>marcar entregue</button>
                      )}
                      {order.status !== 'cancelled' && order.status !== 'delivered' && (
                        <button className="mini-btn danger" onClick={() => updateOrder(order.id, 'cancelled')}>cancelar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <form className="admin-form" onSubmit={handleSaveItem}>
            <div className="form-field">
              <label>Nome da peça</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-field">
              <label>Categoria</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                style={{ width: '100%', padding: '11px 12px', border: '1px solid var(--line)', borderRadius: 6 }}
              >
                <option value="vestido">vestido</option>
                <option value="blusa">blusa</option>
                <option value="calca">calça / saia</option>
                <option value="casaco">casaco</option>
              </select>
            </div>
            <div className="form-field">
              <label>Tamanho</label>
              <input value={form.size} onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))} placeholder="P, M, 38…" />
            </div>
            <div className="form-field">
              <label>Preço (R$)</label>
              <input value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="60" inputMode="decimal" />
            </div>
            <div className="form-field full">
              <label>URL da foto (opcional)</label>
              <input value={form.imageUrl} onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="form-field full">
              <label>Descrição curta (opcional)</label>
              <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="usado poucas vezes" />
            </div>
            <div className="full" style={{ display: 'flex', gap: 10 }}>
              <button className="submit-btn" style={{ width: 'auto', padding: '11px 22px' }} type="submit">
                {editingId ? 'salvar alterações' : 'adicionar peça'}
              </button>
              {editingId && <button type="button" className="mini-btn" onClick={resetForm}>cancelar edição</button>}
            </div>
          </form>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>peça</th>
                  <th>preço</th>
                  <th>status</th>
                  <th>ações</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr><td colSpan={4} style={{ color: 'var(--ink-soft)' }}>Nenhuma peça cadastrada.</td></tr>
                )}
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div>{item.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{item.category} · tam. {item.size}</div>
                    </td>
                    <td className="mono">{formatBRL(item.price)}</td>
                    <td><span className={`pill ${item.status}`}>{STATUS_LABEL[item.status]}</span></td>
                    <td>
                      <div className="row-actions">
                        <button className="mini-btn" onClick={() => startEdit(item)}>editar</button>
                        <button className="mini-btn" onClick={() => markSold(item)}>
                          {item.status === 'sold' ? 'reabrir' : 'marcar vendida'}
                        </button>
                        <button className="mini-btn danger" onClick={() => handleDeleteItem(item.id)}>excluir</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
