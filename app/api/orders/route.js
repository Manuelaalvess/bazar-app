export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createOrder, listOrders } from '../../../lib/db';
import { COOKIE_NAME, verifySessionToken } from '../../../lib/auth';
import { cookies } from 'next/headers';

function isAdmin() {
  const token = cookies().get(COOKIE_NAME)?.value;
  return token ? verifySessionToken(token) : false;
}

export async function GET() {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  const orders = await listOrders();
  return NextResponse.json({ orders });
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
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
}
