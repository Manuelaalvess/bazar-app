import './globals.css';

// Permite reaproveitar o mesmo código para lojas diferentes (ex.: vitrine de
// portfólio vs. loja real) sem duplicar arquivos — cada deploy define seu
// próprio nome via variável de ambiente.
const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME || 'Bazar da Nat';
const STORE_LOCATION = process.env.NEXT_PUBLIC_STORE_LOCATION || '';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || '';

const title = `${STORE_NAME} — peças selecionadas`;
const description = STORE_LOCATION
  ? `Catálogo de roupas femininas em ótimo estado, em ${STORE_LOCATION}. Reserve pelo site, pague por Pix.`
  : 'Catálogo de roupas femininas em ótimo estado. Reserve pelo site, pague por Pix.';

export const metadata = {
  title,
  description,
  ...(SITE_URL ? { metadataBase: new URL(SITE_URL) } : {}),
  openGraph: {
    title,
    description,
    type: 'website',
    locale: 'pt_BR',
    ...(SITE_URL ? { url: SITE_URL } : {}),
  },
  // Sem imagem própria ainda — "summary" (sem card grande) evita mostrar um
  // espaço vazio quando o link é compartilhado.
  twitter: {
    card: 'summary',
    title,
    description,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Work+Sans:wght@400;500;600&family=Courier+Prime:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
