import { NextResponse } from 'next/server';
import { removeOrderItem } from '../../../../../../lib/db';
import { isAdminRequest } from '../../../../../../lib/auth';

export async function DELETE(request, { params }) {
  if (!isAdminRequest()) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  const CONTROLLED_ERRORS = [
    'Só é possível remover peças de pedidos pendentes ou confirmados.',
    'Peça não encontrada neste pedido.',
  ];

  try {
    const order = await removeOrderItem(params.id, params.itemId);
    if (!order) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    return NextResponse.json({ order });
  } catch (err) {
    if (CONTROLLED_ERRORS.includes(err.message)) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: 'Não foi possível remover a peça do pedido.' }, { status: 500 });
  }
}
