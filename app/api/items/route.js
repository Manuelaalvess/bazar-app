export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { listItems, createItem } from '../../../lib/db';
import { COOKIE_NAME, verifySessionToken } from '../../../lib/auth';
import { cookies } from 'next/headers';

function isAdmin() {
  const token = cookies().get(COOKIE_NAME)?.value;
  return token ? verifySessionToken(token) : false;
}

export async function GET() {
  const admin = isAdmin();
  const items = await listItems({ includeAll: admin });
  return NextResponse.json({ items });
}

export async function POST(request) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  const body = await request.json();
  if (!body.name || !body.category || !body.size || typeof body.price !== 'number') {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
  }
  const item = await createItem(body);
  return NextResponse.json({ item }, { status: 201 });
}
