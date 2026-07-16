import { handleUpload } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { isAdminRequest } from '../../../../lib/auth';

// Gera um token de upload de curta duração para o navegador enviar o
// arquivo direto pro Vercel Blob (sem passar pelo corpo desta função —
// evita o limite de tamanho de request do runtime serverless).
export async function POST(request) {
  if (!isAdminRequest()) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const body = await request.json();

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        addRandomSuffix: true,
        maximumSizeInBytes: 8 * 1024 * 1024,
      }),
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(jsonResponse);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
