require('dotenv').config();
const { createItem } = require('../lib/db');

const seedItems = [
  { name: 'Vestido midi floral', category: 'vestido', size: 'M', price: 60, description: 'usado poucas vezes' },
  { name: 'Blusa manga bufante', category: 'blusa', size: 'P', price: 35, description: 'como nova' },
  { name: 'Calça alfaiataria', category: 'calca', size: '38', price: 45, description: 'seminova' },
  { name: 'Casaco de tricô', category: 'casaco', size: 'M', price: 55, description: 'quentinho pro inverno' },
  { name: 'Vestido de festa curto', category: 'vestido', size: 'P', price: 70, description: 'usado 1x' },
  { name: 'Saia midi plissada', category: 'calca', size: 'único', price: 30, description: 'bom estado' },
];

async function main() {
  for (const item of seedItems) {
    await createItem(item);
    console.log(`Peça criada: ${item.name}`);
  }
  console.log('\nCatálogo populado com sucesso.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
