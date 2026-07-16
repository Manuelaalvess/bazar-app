import { NextResponse } from 'next/server';
import { updateItem, deleteItem } from '../../../../lib/db';
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
  const body = await request.json();
  const item = await updateItem(params.id, body);
  if (!item) return NextResponse.json({ error: 'Peça não encontrada' }, { status: 404 });
  return NextResponse.json({ item });
}

export async function DELETE(request, { params }) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  await deleteItem(params.id);
  return NextResponse.json({ ok: true });
}
