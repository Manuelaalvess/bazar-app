import { NextResponse } from 'next/server';
import { updateItem, deleteItem } from '../../../../lib/db';
import { isAdminRequest } from '../../../../lib/auth';
import { validateImageUrl } from '../../../../lib/validation';

export async function PATCH(request, { params }) {
  if (!isAdminRequest()) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  const body = await request.json();
  if ('imageUrl' in body) {
    const imageUrl = validateImageUrl(body.imageUrl);
    if (imageUrl === false) {
      return NextResponse.json({ error: 'URL da imagem inválida (use https://)' }, { status: 400 });
    }
    body.imageUrl = imageUrl;
  }
  try {
    const item = await updateItem(params.id, body);
    if (!item) return NextResponse.json({ error: 'Peça não encontrada' }, { status: 404 });
    return NextResponse.json({ item });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
}

export async function DELETE(request, { params }) {
  if (!isAdminRequest()) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  try {
    await deleteItem(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
}
