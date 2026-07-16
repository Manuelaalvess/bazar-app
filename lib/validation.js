// Retorna a própria URL se for https válida, `null` se vazia/ausente
// (campo opcional), ou `false` se inválida.
function validateImageUrl(url) {
  if (url == null || url === '') return null;
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? url : false;
  } catch {
    return false;
  }
}

module.exports = { validateImageUrl };
