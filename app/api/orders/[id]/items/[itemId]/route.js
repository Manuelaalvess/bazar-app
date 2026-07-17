import { NextResponse } from 'next/server';
import { removeOrderItem } from '../../../../../../lib/db';
import { isAdminRequest } from '../../../../../../lib/auth';

export async function DELETE(request, { params }) {
  if (!isAdminRequest()) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  try {
    const order = await removeOrderItem(params.id, params.itemId);
    if (!order) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    return NextResponse.json({ order });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
}
