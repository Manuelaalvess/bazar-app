const { Pool } = require('pg');
const crypto = require('crypto');

// Reaproveita a mesma pool de conexões entre requisições (padrão recomendado
// para apps serverless na Vercel, onde cada função pode ser reaproveitada
// entre chamadas — abrir uma conexão nova a cada request esgotaria o limite
// de conexões do banco rapidamente).
function getPool() {
  if (!global._pgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL não configurada. Veja o README para instruções.');
    }
    global._pgPool = new Pool({
      connectionString,
      // rejectUnauthorized: false aceita o certificado do provedor (Neon,
      // Supabase etc.) sem validar a cadeia de CA completa — abre uma janela
      // teórica de MITM, mas é o que permite conectar sem embutir o CA bundle
      // de cada provedor gerenciado como dependência extra. Trade-off aceito
      // aqui pela simplicidade do deploy serverless; se um dia for preciso
      // fechar essa janela, a alternativa é carregar o CA do provedor via
      // `ssl: { ca: process.env.DATABASE_CA_CERT }` e usar rejectUnauthorized: true.
      ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
      max: 5,
    });
  }
  return global._pgPool;
}

function id() {
  return crypto.randomUUID();
}

function mapItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    size: row.size,
    price: Number(row.price),
    imageUrl: row.image_url,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapOrder(row) {
  if (!row) return null;
  return {
    id: row.id,
    customerName: row.customer_name,
    phone: row.phone,
    status: row.status,
    total: Number(row.total),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  size TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  image_url TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id),
  price_at_order NUMERIC(10,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_item_id ON order_items(item_id);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
`;

// CHECK constraints ficam fora do CREATE TABLE IF NOT EXISTS porque esse
// comando não altera tabelas já existentes — bancos criados antes desta
// mudança só ganham as constraints na próxima inicialização do app, via
// esses ALTERs idempotentes (DROP IF EXISTS + ADD).
const CONSTRAINTS_SQL = `
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_status_check;
ALTER TABLE items ADD CONSTRAINT items_status_check
  CHECK (status IN ('available', 'reserved', 'sold'));

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'confirmed', 'delivered', 'cancelled'));
`;

// Garante que as tabelas existem — chamado de forma preguiçosa (lazy) na
// primeira query de cada ambiente novo, para simplificar o setup em produção.
let schemaReady = false;
async function ensureSchema(client) {
  if (schemaReady) return;
  await client.query(SCHEMA_SQL);
  schemaReady = true;
}

let constraintsReady = false;
async function ensureConstraints(client) {
  if (constraintsReady) return;
  await client.query(CONSTRAINTS_SQL);
  constraintsReady = true;
}

async function withClient(fn) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    await ensureConstraints(client);
    return await fn(client);
  } finally {
    client.release();
  }
}

// ---------- Items ----------

async function listItems({ includeAll = false } = {}) {
  return withClient(async (client) => {
    const query = includeAll
      ? `SELECT * FROM items ORDER BY created_at DESC`
      : `SELECT * FROM items WHERE status != 'sold' ORDER BY created_at DESC`;
    const { rows } = await client.query(query);
    return rows.map(mapItem);
  });
}

async function getItem(itemId) {
  return withClient(async (client) => {
    const { rows } = await client.query(`SELECT * FROM items WHERE id = $1`, [itemId]);
    return mapItem(rows[0]);
  });
}

async function createItem(data) {
  return withClient(async (client) => {
    const newId = id();
    const { rows } = await client.query(
      `INSERT INTO items (id, name, category, size, price, image_url, description, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'available')
       RETURNING *`,
      [newId, data.name, data.category, data.size, data.price, data.imageUrl || null, data.description || null]
    );
    return mapItem(rows[0]);
  });
}

async function updateItem(itemId, data) {
  return withClient(async (client) => {
    const current = mapItem((await client.query(`SELECT * FROM items WHERE id = $1`, [itemId])).rows[0]);
    if (!current) return null;
    const merged = { ...current, ...data };

    // Uma peça com pedido pending/confirmed representa dinheiro/combinação
    // em andamento com a cliente — marcar como vendida por fora desse fluxo
    // (ex.: venda direta, fora do site) esconderia esse pedido sem cancelá-lo.
    if (merged.status === 'sold' && current.status !== 'sold') {
      const { rows: activeOrderRows } = await client.query(
        `SELECT 1 FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE oi.item_id = $1 AND o.status IN ('pending', 'confirmed')
         LIMIT 1`,
        [itemId]
      );
      if (activeOrderRows.length > 0) {
        throw new Error('Esta peça está em um pedido ativo e não pode ser marcada como vendida diretamente.');
      }
    }

    const { rows } = await client.query(
      `UPDATE items SET name=$1, category=$2, size=$3, price=$4, image_url=$5, description=$6, status=$7, updated_at=now()
       WHERE id=$8 RETURNING *`,
      [merged.name, merged.category, merged.size, merged.price, merged.imageUrl, merged.description, merged.status, itemId]
    );
    return mapItem(rows[0]);
  });
}

async function deleteItem(itemId) {
  return withClient(async (client) => {
    await client.query(`DELETE FROM items WHERE id = $1`, [itemId]);
  });
}

// ---------- Orders ----------

const DEADLOCK_ERROR_CODE = '40P01';
const CREATE_ORDER_MAX_ATTEMPTS = 3;

// Uma única tentativa de criar o pedido, dentro de uma transação. Extraída
// do wrapper createOrder para permitir retry em caso de deadlock.
async function createOrderOnce(client, { customerName, phone, itemIds }) {
  await client.query('BEGIN');
  try {
    const items = [];
    for (const itemId of itemIds) {
      // SELECT ... FOR UPDATE trava a linha até o fim da transação, então
      // duas reservas simultâneas na mesma peça são resolvidas em fila,
      // não em condição de corrida.
      const { rows } = await client.query(`SELECT * FROM items WHERE id = $1 FOR UPDATE`, [itemId]);
      const item = mapItem(rows[0]);
      if (!item) throw new Error(`Peça não encontrada`);
      if (item.status !== 'available') {
        throw new Error(`A peça "${item.name}" já não está mais disponível`);
      }
      items.push(item);
    }

    const total = items.reduce((sum, it) => sum + it.price, 0);
    const orderId = id();

    await client.query(
      `INSERT INTO orders (id, customer_name, phone, status, total) VALUES ($1, $2, $3, 'pending', $4)`,
      [orderId, customerName, phone, total]
    );

    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (id, order_id, item_id, price_at_order) VALUES ($1, $2, $3, $4)`,
        [id(), orderId, item.id, item.price]
      );
      await client.query(`UPDATE items SET status='reserved', updated_at=now() WHERE id=$1`, [item.id]);
    }

    await client.query('COMMIT');
    return getOrderWithClient(client, orderId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

// Cria um pedido de forma atômica: valida que todas as peças ainda estão
// disponíveis, marca cada uma como 'reserved' e grava o pedido — tudo dentro
// de uma única transação. Se qualquer peça já tiver sido reservada por outra
// pessoa, a transação inteira é desfeita (evita vender a mesma peça duas vezes,
// mesmo com duas pessoas clicando ao mesmo tempo).
//
// Duas reservas simultâneas que travam as mesmas peças em ordens diferentes
// (ex.: carrinho A = [X, Y], carrinho B = [Y, X]) podem gerar deadlock —
// o Postgres detecta e aborta uma das transações automaticamente. Como isso
// não é erro do usuário, tentamos de novo (com backoff) antes de desistir.
async function createOrder(params) {
  return withClient(async (client) => {
    let lastErr;
    for (let attempt = 1; attempt <= CREATE_ORDER_MAX_ATTEMPTS; attempt++) {
      try {
        return await createOrderOnce(client, params);
      } catch (err) {
        lastErr = err;
        if (err.code !== DEADLOCK_ERROR_CODE || attempt === CREATE_ORDER_MAX_ATTEMPTS) {
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
      }
    }
    throw lastErr;
  });
}

async function getOrderWithClient(client, orderId) {
  const { rows } = await client.query(`SELECT * FROM orders WHERE id = $1`, [orderId]);
  const order = mapOrder(rows[0]);
  if (!order) return null;
  const { rows: itemRows } = await client.query(
    `SELECT oi.id, oi.price_at_order, i.id as item_id, i.name, i.category, i.size
     FROM order_items oi JOIN items i ON i.id = oi.item_id
     WHERE oi.order_id = $1`,
    [orderId]
  );
  return {
    ...order,
    items: itemRows.map((r) => ({
      id: r.id,
      priceAtOrder: Number(r.price_at_order),
      itemId: r.item_id,
      name: r.name,
      category: r.category,
      size: r.size,
    })),
  };
}

async function listOrders() {
  return withClient(async (client) => {
    const { rows } = await client.query(`SELECT * FROM orders ORDER BY created_at DESC`);
    if (rows.length === 0) return [];

    const orderIds = rows.map((r) => r.id);
    const { rows: itemRows } = await client.query(
      `SELECT oi.id, oi.order_id, oi.price_at_order, i.id as item_id, i.name, i.category, i.size
       FROM order_items oi JOIN items i ON i.id = oi.item_id
       WHERE oi.order_id = ANY($1::text[])`,
      [orderIds]
    );

    const itemsByOrderId = new Map();
    for (const r of itemRows) {
      const list = itemsByOrderId.get(r.order_id) || [];
      list.push({
        id: r.id,
        priceAtOrder: Number(r.price_at_order),
        itemId: r.item_id,
        name: r.name,
        category: r.category,
        size: r.size,
      });
      itemsByOrderId.set(r.order_id, list);
    }

    return rows.map((row) => ({
      ...mapOrder(row),
      items: itemsByOrderId.get(row.id) || [],
    }));
  });
}

async function getOrder(orderId) {
  return withClient((client) => getOrderWithClient(client, orderId));
}

// Transições permitidas por status atual — evita, por exemplo, "confirmar"
// um pedido já entregue ou reabrir um cancelado.
const ORDER_STATUS_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

// Atualiza o status do pedido. Se cancelado, libera as peças de volta pro catálogo.
async function updateOrderStatus(orderId, status) {
  return withClient(async (client) => {
    await client.query('BEGIN');
    try {
      const order = await getOrderWithClient(client, orderId);
      if (!order) {
        await client.query('ROLLBACK');
        return null;
      }

      if (status === order.status) {
        await client.query('COMMIT');
        return order;
      }
      if (!(ORDER_STATUS_TRANSITIONS[order.status] || []).includes(status)) {
        throw new Error('Transição de status inválida.');
      }

      await client.query(`UPDATE orders SET status=$1, updated_at=now() WHERE id=$2`, [status, orderId]);

      if (status === 'cancelled') {
        for (const it of order.items) {
          await client.query(`UPDATE items SET status='available', updated_at=now() WHERE id=$1`, [it.itemId]);
        }
      } else if (status === 'delivered' || status === 'confirmed') {
        const itemStatus = status === 'delivered' ? 'sold' : 'reserved';
        for (const it of order.items) {
          await client.query(`UPDATE items SET status=$1, updated_at=now() WHERE id=$2`, [itemStatus, it.itemId]);
        }
      }

      await client.query('COMMIT');
      return getOrderWithClient(client, orderId);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });
}

// Remove uma peça de um pedido ainda em andamento (pending/confirmed) sem
// cancelar o resto — a peça volta a ficar disponível no catálogo e o total
// do pedido é recalculado. Se essa era a última peça, o pedido inteiro é
// cancelado (não faz sentido um pedido pending sem nenhuma peça).
async function removeOrderItem(orderId, itemId) {
  return withClient(async (client) => {
    await client.query('BEGIN');
    try {
      const order = await getOrderWithClient(client, orderId);
      if (!order) {
        await client.query('ROLLBACK');
        return null;
      }
      if (order.status !== 'pending' && order.status !== 'confirmed') {
        throw new Error('Só é possível remover peças de pedidos pendentes ou confirmados.');
      }
      const orderItem = order.items.find((it) => it.itemId === itemId);
      if (!orderItem) {
        throw new Error('Peça não encontrada neste pedido.');
      }

      await client.query(`DELETE FROM order_items WHERE id = $1`, [orderItem.id]);
      await client.query(`UPDATE items SET status='available', updated_at=now() WHERE id=$1`, [itemId]);

      const remainingItems = order.items.filter((it) => it.itemId !== itemId);
      if (remainingItems.length === 0) {
        await client.query(`UPDATE orders SET status='cancelled', total=0, updated_at=now() WHERE id=$1`, [orderId]);
      } else {
        const newTotal = remainingItems.reduce((sum, it) => sum + it.priceAtOrder, 0);
        await client.query(`UPDATE orders SET total=$1, updated_at=now() WHERE id=$2`, [newTotal, orderId]);
      }

      await client.query('COMMIT');
      return getOrderWithClient(client, orderId);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });
}

module.exports = {
  listItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  createOrder,
  listOrders,
  getOrder,
  updateOrderStatus,
  removeOrderItem,
};
