import { NextResponse } from 'next/server';
import { updateOrderStatus } from '../../../../lib/db';
import { COOKIE_NAME, verifySessionToken } from '../../../../lib/auth';
import { cookies } from 'next/headers';

function isAdmin() {
  const token = cookies().get(COOKIE_NAME)?.value;
  return token ? verifySessionToken(token) : false;
}

export async function PATCH(request, { params }) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  const { status } = await request.json();
  const allowed = ['pending', 'confirmed', 'delivered', 'cancelled'];
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: 'Status inválido' }, { status: 400 });
  }
  const order = await updateOrderStatus(params.id, status);
  if (!order) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
  return NextResponse.json({ order });
}
