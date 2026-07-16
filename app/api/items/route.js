export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { listItems, createItem } from '../../../lib/db';
import { isAdminRequest } from '../../../lib/auth';
import { validateImageUrl } from '../../../lib/validation';

export async function GET() {
  const admin = isAdminRequest();
  const items = await listItems({ includeAll: admin });
  return NextResponse.json({ items });
}

export async function POST(request) {
  if (!isAdminRequest()) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  const body = await request.json();
  if (!body.name || !body.category || !body.size || typeof body.price !== 'number') {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
  }
  const imageUrl = validateImageUrl(body.imageUrl);
  if (imageUrl === false) {
    return NextResponse.json({ error: 'URL da imagem inválida (use https://)' }, { status: 400 });
  }
  const item = await createItem({ ...body, imageUrl });
  return NextResponse.json({ item }, { status: 201 });
}
