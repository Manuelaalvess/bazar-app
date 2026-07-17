export const size = { width: 32, height: 32 };
export const contentType = 'image/svg+xml';

const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME || 'Bazar da Nat';
const letter = STORE_NAME.trim().split(' ').pop()?.[0]?.toUpperCase() || 'B';

export default function Icon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <rect width="32" height="32" rx="6" fill="#F6E9E4" />
    <text x="16" y="22" font-family="Georgia, serif" font-size="18" font-weight="600" fill="#5C2F42" text-anchor="middle">${letter}</text>
  </svg>`;
  return new Response(svg, {
    headers: { 'Content-Type': 'image/svg+xml' },
  });
}
