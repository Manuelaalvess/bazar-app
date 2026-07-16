'use client';

import { useEffect, useMemo, useState } from 'react';

// Configurada na Vercel (ou no .env local) — sem ela, a reserva ainda
// funciona, só não gera o link pronto do WhatsApp.
const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '';
const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME || 'Bazar da Nat';
const CATEGORIES = [
  { key: 'all', label: 'todas' },
  { key: 'vestido', label: 'vestidos' },
  { key: 'blusa', label: 'blusas' },
  { key: 'calca', label: 'calças e saias' },
  { key: 'casaco', label: 'casacos' },
];

function formatBRL(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function buildWhatsAppMessage({ customerName, items, total }) {
  const lines = items.map((it) => `• ${it.name} (tam. ${it.size}) — ${formatBRL(it.price)}`);
  return (
    `Olá! Sou ${customerName} e acabei de reservar pelo catálogo:\n\n` +
    lines.join('\n') +
    `\n\nTotal: ${formatBRL(total)}\n\nPodemos combinar o Pix e a entrega/retirada?`
  );
}

export default function CatalogPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [form, setForm] = useState({ customerName: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [zoomedImage, setZoomedImage] = useState(null);

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    setLoading(true);
    try {
      const res = await fetch('/api/items');
      if (!res.ok) throw new Error('Falha ao carregar catálogo');
      const data = await res.json();
      setItems(data.items || []);
      setLoadError('');
    } catch (err) {
      setLoadError('Não foi possível carregar o catálogo. Tente recarregar a página.');
    } finally {
      setLoading(false);
    }
  }

  const visibleItems = useMemo(() => {
    return items.filter((it) => filter === 'all' || it.category === filter);
  }, [items, filter]);

  const availableCount = items.filter((it) => it.status === 'available').length;
  const totalCount = items.length;
  const availPct = totalCount ? Math.round((availableCount / totalCount) * 100) : 0;

  const cartItems = items.filter((it) => cart.includes(it.id));
  const cartTotal = cartItems.reduce((sum, it) => sum + it.price, 0);

  function addToCart(itemId) {
    setCart((prev) => (prev.includes(itemId) ? prev : [...prev, itemId]));
  }

  function removeFromCart(itemId) {
    setCart((prev) => prev.filter((id) => id !== itemId));
  }

  async function handleCheckout(e) {
    e.preventDefault();
    setError('');
    if (!form.customerName.trim() || !form.phone.trim()) {
      setError('Preencha seu nome e telefone.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: form.customerName.trim(),
          phone: form.phone.trim(),
          itemIds: cart,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Não foi possível concluir a reserva.');
        setSubmitting(false);
        await fetchItems();
        return;
      }

      const message = buildWhatsAppMessage({
        customerName: form.customerName.trim(),
        items: cartItems,
        total: cartTotal,
      });
      const waUrl = WHATSAPP_NUMBER
        ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
        : null;
      setSuccess({ waUrl });
      setCart([]);
      setForm({ customerName: '', phone: '' });
      await fetchItems();
    } catch (err) {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  function closeCart() {
    setCartOpen(false);
    setSuccess(null);
    setError('');
  }

  return (
    <>
      <header className="site-header wrap">
        <div className="brand">{STORE_NAME.toLowerCase()}</div>
      </header>

      <div className="wrap">
        <section className="hero">
          <span className="eyebrow">catálogo em rotação — peças únicas</span>
          <h1>Peças selecionadas, prontas para uma nova casa.</h1>
          <p>Escolha o que combina com você, reserve pelo site e finalize com Pix — sem loja física, sem complicação.</p>
        </section>

        <div className="avail-bar">
          <span className="mono">{availableCount} de {totalCount} peças disponíveis</span>
          <div className="avail-track">
            <div className="avail-fill" style={{ width: `${availPct}%` }} />
          </div>
        </div>

        <div className="filters">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              className={`filter-btn ${filter === c.key ? 'active' : ''}`}
              onClick={() => setFilter(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="empty-note">Carregando catálogo…</p>
        ) : loadError ? (
          <p className="form-error">{loadError}</p>
        ) : visibleItems.length === 0 ? (
          <p className="empty-note">Nenhuma peça nessa categoria no momento.</p>
        ) : (
          <div className="items-grid">
            {visibleItems.map((item) => {
              const inCart = cart.includes(item.id);
              const available = item.status === 'available';
              return (
                <article className="item-card" key={item.id}>
                  <div
                    className="item-photo"
                    onClick={item.imageUrl ? () => setZoomedImage(item.imageUrl) : undefined}
                    style={item.imageUrl ? { cursor: 'zoom-in' } : undefined}
                  >
                    {item.status !== 'available' && (
                      <span className={`status-pill ${item.status}`}>
                        {item.status === 'reserved' ? 'reservado' : 'vendido'}
                      </span>
                    )}
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} />
                    ) : (
                      <svg className="placeholder-icon" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                        <path d="M8 4 L6 7 L4 9 L6 11 L8 9 V20 H16 V9 L18 11 L20 9 L18 7 L16 4 L13 6 H11 Z" />
                      </svg>
                    )}
                  </div>
                  <div className="item-body">
                    <p className="item-name">{item.name}</p>
                    <p className="item-meta">tam. {item.size}{item.description ? ` · ${item.description}` : ''}</p>
                    <div className="item-footer">
                      <span className="item-price">{formatBRL(item.price)}</span>
                      <button
                        className={`add-btn ${inCart ? 'added-btn' : ''}`}
                        disabled={!available && !inCart}
                        onClick={() => (inCart ? removeFromCart(item.id) : addToCart(item.id))}
                      >
                        {inCart ? 'adicionado' : available ? 'adicionar' : 'indisponível'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <section className="how">
          <h2>Como funciona</h2>
          <div className="how-grid">
            <div className="how-step">
              <span className="num">01</span>
              <h3>Monte sua seleção</h3>
              <p>Adicione ao carrinho as peças que você quer — elas ficam reservadas assim que você confirma.</p>
            </div>
            <div className="how-step">
              <span className="num">02</span>
              <h3>Confirme pelo WhatsApp</h3>
              <p>Ao finalizar, o WhatsApp abre com sua seleção já pronta para envio.</p>
            </div>
            <div className="how-step">
              <span className="num">03</span>
              <h3>Pague e combine</h3>
              <p>Pix na hora e combinamos juntas a entrega ou retirada.</p>
            </div>
          </div>
        </section>
      </div>

      {cart.length > 0 && !cartOpen && (
        <button className="cart-fab" onClick={() => setCartOpen(true)}>
          ver seleção <span className="cart-badge">{cart.length}</span>
        </button>
      )}

      {cartOpen && (
        <div className="overlay" onClick={closeCart}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <h2>Sua seleção</h2>
              <button className="close-btn" onClick={closeCart}>×</button>
            </div>

            {success ? (
              <div>
                <p style={{ marginBottom: 16 }}>Reserva registrada! Finalize com a loja pelo WhatsApp para combinar o Pix e a entrega.</p>
                {success.waUrl ? (
                  <a className="submit-btn" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }} href={success.waUrl} target="_blank" rel="noreferrer">
                    abrir whatsapp
                  </a>
                ) : (
                  <p className="form-error">Reserva registrada, mas o WhatsApp da loja ainda não foi configurado. Entre em contato por outro meio para combinar o Pix e a entrega.</p>
                )}
              </div>
            ) : cartItems.length === 0 ? (
              <p className="empty-note">Sua seleção está vazia.</p>
            ) : (
              <>
                {cartItems.map((it) => (
                  <div className="cart-line" key={it.id}>
                    <span>{it.name} · tam. {it.size}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="mono">{formatBRL(it.price)}</span>
                      <button className="remove" onClick={() => removeFromCart(it.id)}>remover</button>
                    </span>
                  </div>
                ))}
                <div className="cart-total">
                  <span>Total</span>
                  <span className="mono">{formatBRL(cartTotal)}</span>
                </div>

                <form onSubmit={handleCheckout}>
                  <div className="form-field">
                    <label>Seu nome</label>
                    <input
                      value={form.customerName}
                      onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                      placeholder="Como podemos te chamar"
                    />
                  </div>
                  <div className="form-field">
                    <label>Telefone / WhatsApp</label>
                    <input
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  {error && <p className="form-error">{error}</p>}
                  <button className="submit-btn" type="submit" disabled={submitting}>
                    {submitting ? 'reservando…' : 'reservar e finalizar no whatsapp'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {zoomedImage && (
        <div className="overlay lightbox-overlay" onClick={() => setZoomedImage(null)}>
          <button className="lightbox-close" onClick={() => setZoomedImage(null)}>×</button>
          <img className="lightbox-img" src={zoomedImage} alt="Foto ampliada" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      <footer className="site-footer">
        <p>{STORE_NAME} · reservas via site, pagamento por Pix, combinado direto no WhatsApp.</p>
      </footer>
    </>
  );
}
