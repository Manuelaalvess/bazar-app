import { NextResponse } from 'next/server';
import { updateOrderStatus } from '../../../../lib/db';
import { isAdminRequest } from '../../../../lib/auth';

export async function PATCH(request, { params }) {
  if (!isAdminRequest()) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  const { status } = await request.json();
  const allowed = ['pending', 'confirmed', 'delivered', 'cancelled'];
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: 'Status inválido' }, { status: 400 });
  }
  try {
    const order = await updateOrderStatus(params.id, status);
    if (!order) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    return NextResponse.json({ order });
  } catch (err) {
    if (err.message === 'Transição de status inválida.') {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: 'Não foi possível atualizar o pedido.' }, { status: 500 });
  }
}
