import './globals.css';

// Permite reaproveitar o mesmo código para lojas diferentes (ex.: vitrine de
// portfólio vs. loja real) sem duplicar arquivos — cada deploy define seu
// próprio nome via variável de ambiente.
const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME || 'Bazar da Nat';

export const metadata = {
  title: `${STORE_NAME} — peças selecionadas`,
  description: 'Catálogo de roupas femininas em ótimo estado. Reserve pelo site, pague por Pix.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
