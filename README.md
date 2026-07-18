# Bazar da Nat — catálogo com carrinho e banco de dados

Aplicação completa para vender roupas por catálogo: a cliente escolhe as peças,
o site reserva automaticamente no banco de dados (ninguém mais consegue "comprar"
a mesma peça, mesmo que duas pessoas cliquem ao mesmo tempo) e abre o WhatsApp
com a mensagem pronta pra você. Você gerencia tudo — peças e pedidos — num painel
próprio.

## Stack usada

- **Next.js 14** (React) — front-end e back-end no mesmo projeto
- **PostgreSQL** — banco de dados relacional real, pronto pra produção e para
  deploy na Vercel (a versão anterior deste projeto usava SQLite local, que não
  funciona bem em ambientes serverless — essa troca resolve isso)
- **node-postgres (`pg`)** — driver oficial, com pool de conexões e transações
- **Cookies assinados (HMAC)** — autenticação simples do painel admin

## Por que Postgres, e não SQLite

Na Vercel (e na maioria dos ambientes serverless), cada requisição pode rodar
num servidor "descartável" — o disco não persiste entre execuções. Um banco em
arquivo (como SQLite) simplesmente perderia dados. Postgres roda separado da
aplicação, num serviço próprio, então os dados sobrevivem normalmente a
deploys, reinícios e múltiplas instâncias do servidor rodando ao mesmo tempo.
É o padrão usado por aplicações profissionais em produção.

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `DATABASE_URL` | sim | connection string do Postgres |
| `ADMIN_PASSWORD` | sim | senha do painel admin — sem ela, o app recusa qualquer login (não existe senha padrão) |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | não | número da loja (DDI 55 + DDD, só números) para o link do WhatsApp após a reserva |
| `NEXT_PUBLIC_STORE_NAME` | não | nome exibido no título, cabeçalho e rodapé (padrão: "Bazar da Nat") — permite reaproveitar o mesmo código pra deploys com nomes diferentes |
| `NEXT_PUBLIC_STORE_LOCATION` | não | cidade/estado exibido no rodapé (ex.: "Nova Friburgo - RJ") — sem ela, o rodapé não mostra localização |
| `NEXT_PUBLIC_SITE_URL` | não | URL canônica do site (ex.: "https://bazar-da-manu.vercel.app") — usada na metadata Open Graph/Twitter para pré-visualização de links compartilhados |
| `BLOB_READ_WRITE_TOKEN` | sim, pro upload de foto | token do Vercel Blob — gerado automaticamente ao conectar um Blob Store ao projeto na Vercel; sem ele, o upload de foto (mas não o cadastro por link) fica indisponível |

## Como rodar no seu computador

Pré-requisitos: Node.js 22+ e acesso a um banco Postgres (veja abaixo as opções).

```bash
npm install
```

### Opção A — banco na nuvem gratuito (recomendado, mesmo para testar local)

1. Crie uma conta gratuita no [Neon](https://neon.tech) (ou [Supabase](https://supabase.com)).
2. Crie um projeto/banco novo e copie a "connection string" (algo como
   `postgresql://usuario:senha@host/banco?sslmode=require`).
3. Cole essa string no arquivo `.env`, na variável `DATABASE_URL`.

### Opção B — Postgres instalado na sua máquina

Se preferir rodar localmente, instale o Postgres, crie um banco chamado `bazar`
e ajuste o `.env`:
```
DATABASE_URL="postgresql://postgres:SUASENHA@localhost:5432/bazar"
```

### Depois de configurar o `.env`

```bash
npm run seed     # cria as tabelas automaticamente e popula com peças de exemplo
npm run dev      # ambiente de desenvolvimento em http://localhost:3000
```

As tabelas são criadas automaticamente na primeira execução — não precisa rodar
nenhum comando de migração separado.

Painel da loja: `http://localhost:3000/admin`
Senha: a que você definiu em `.env`, na variável `ADMIN_PASSWORD`. Sem essa variável configurada,
o login fica desabilitado (o servidor recusa qualquer tentativa) — não existe senha padrão de fábrica.
O login também tem limite de 10 tentativas por IP a cada 15 minutos.

## O que o sistema faz

- **Catálogo (`/`)**: peças com foto, tamanho e preço. Cliente adiciona ao carrinho,
  preenche nome e telefone e confirma.
- **Reserva automática e segura contra concorrência**: ao confirmar, a peça é
  travada (`SELECT ... FOR UPDATE`) e marcada como `reservada` dentro de uma
  transação. Se duas clientes tentarem levar a mesma peça ao mesmo tempo, a
  segunda recebe erro na hora — a trava do banco impede que as duas reservas
  aconteçam juntas, mesmo em alta concorrência.
- **WhatsApp**: depois de reservar, abre automaticamente uma conversa com a
  mensagem já escrita (peças, tamanhos e valor total). Também tem um botão
  flutuante fixo pra cliente falar com a loja sem precisar reservar nada
  antes (dúvidas sobre entrega, tamanho etc.).
- **Menu do cabeçalho**: ícone de três linhas com atalhos pra "como funciona",
  contato via WhatsApp e a localização da loja.
- **Zoom na foto**: clicar numa peça do catálogo amplia a imagem numa
  janela por cima da página.
- **Favicon dinâmico**: o ícone da aba do navegador usa a primeira letra do
  nome da loja, gerado automaticamente a partir de `NEXT_PUBLIC_STORE_NAME`.
- **Painel admin (`/admin`)**:
  - aba **pedidos** — confirmar, marcar como entregue ou cancelar (cancelar
    libera as peças de volta pro catálogo); dá pra remover só uma peça
    específica de um pedido com várias, sem cancelar o resto
  - aba **peças** — cadastrar, editar, excluir e marcar peças como vendidas,
    sem mexer em código; a foto pode ser um link ou um upload direto da
    galeria/câmera do celular (via Vercel Blob)

## Antes de usar de verdade

1. Troque `ADMIN_PASSWORD` no `.env` (e nas variáveis de ambiente da Vercel, se for fazer deploy lá) para uma senha só sua.
2. Apague as peças de exemplo pelo painel e cadastre as suas peças reais (com foto).
3. Defina `NEXT_PUBLIC_WHATSAPP_NUMBER` (com DDI 55 + DDD, só números) no `.env` ou nas
   variáveis de ambiente da Vercel — sem ela, a reserva funciona normalmente, só não
   gera o link pronto do WhatsApp.

## Deploy na Vercel

1. Suba este projeto num repositório do GitHub.
2. Importe o repositório na [Vercel](https://vercel.com/new).
3. Em **Settings → Environment Variables**, adicione:
   - `DATABASE_URL` — a connection string do Neon/Supabase (com `?sslmode=require`)
   - `ADMIN_PASSWORD` — sua senha do painel
   - `NEXT_PUBLIC_WHATSAPP_NUMBER` — número da loja para o link do WhatsApp
   - `NEXT_PUBLIC_STORE_NAME`, `NEXT_PUBLIC_STORE_LOCATION`, `NEXT_PUBLIC_SITE_URL` — opcionais, ver tabela acima
4. Em **Storage**, crie um **Blob Store** e conecte ao projeto — isso gera a
   variável `BLOB_READ_WRITE_TOKEN` automaticamente, sem precisar colar nada
   na mão. É o que permite o upload de foto direto da galeria no painel admin.
5. Deploy. Pronto — o banco na nuvem já está acessível de qualquer lugar, e o
   site funciona igual em produção e em desenvolvimento.

Se preferir manter tudo dentro do ecossistema Vercel, existe também o
"Vercel Postgres" (marketplace de integrações da própria Vercel) — funciona do
mesmo jeito, só muda de onde vem a `DATABASE_URL`.

## Estrutura do projeto

```
app/                              páginas e rotas de API (Next.js App Router)
  page.js                         catálogo público, carrinho, menu, zoom na foto
  layout.js                       metadata (título, Open Graph, Twitter) e fontes
  icon.js                         favicon dinâmico (SVG com a inicial da loja)
  robots.js                       robots.txt (bloqueia /admin e /api/)
  admin/                          painel administrativo (protegido por senha)
  api/
    admin/login, admin/logout     autenticação do painel
    admin/upload/                 gera token de upload de foto pro Vercel Blob
    items/, items/[id]/           CRUD de peças
    orders/, orders/[id]/         pedidos e mudança de status
    orders/[id]/items/[itemId]/   remoção de uma peça específica de um pedido
components/
  AdminDashboard.js               lógica do painel (pedidos e gestão de peças)
lib/
  db.js                           toda a lógica de acesso ao banco (única camada que fala com o Postgres)
  auth.js                         geração/verificação do cookie de sessão do admin (isAdminRequest)
  validation.js                   validação de URL de imagem
  schema.sql                      schema de referência (o db.js já cria as tabelas e constraints sozinho)
scripts/
  seed.js                         popula o catálogo com peças de exemplo
```

Se um dia quiser trocar de Postgres para outro banco, a mudança fica isolada
em `lib/db.js` — o resto da aplicação não precisa saber como o banco funciona
por dentro.


