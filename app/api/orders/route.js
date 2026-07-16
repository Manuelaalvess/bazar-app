export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createOrder, listOrders } from '../../../lib/db';
import { isAdminRequest } from '../../../lib/auth';

export async function GET() {
  if (!isAdminRequest()) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  const orders = await listOrders();
  return NextResponse.json({ orders });
}

// createOrder lança mensagens controladas ("peça não encontrada", "peça já
// não está mais disponível") que podem ir direto ao cliente. Qualquer outro
// erro (deadlock após esgotar as tentativas, falha de conexão etc.) é
// convertido numa mensagem genérica para não vazar detalhes do Postgres.
function mapCreateOrderError(err) {
  if (err.code === '40P01' || /deadlock/i.test(err.message || '')) {
    return { status: 409, error: 'Muitas reservas ao mesmo tempo. Tente novamente.' };
  }
  if (err.message === 'Peça não encontrada' || err.message?.startsWith('A peça "')) {
    return { status: 409, error: err.message };
  }
  console.error('Erro ao criar pedido:', err);
  return { status: 500, error: 'Não foi possível concluir a reserva. Tente novamente.' };
}

export async function POST(request) {
  const body = await request.json();
  const { customerName, phone, itemIds } = body;

  if (!customerName || !phone || !Array.isArray(itemIds) || itemIds.length === 0) {
    return NextResponse.json({ error: 'Preencha nome, telefone e selecione ao menos uma peça' }, { status: 400 });
  }

  try {
    const order = await createOrder({ customerName, phone, itemIds });
    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    const { status, error } = mapCreateOrderError(err);
    return NextResponse.json({ error }, { status });
  }
}
