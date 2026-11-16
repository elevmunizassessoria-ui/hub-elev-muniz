// Remove caracteres que não servem em nome de pasta/arquivo.
export function nomeSeguro(texto, reserva = 'sem-nome') {
  const limpo = String(texto ?? '')
    .replace(/[<>:"/\|?*\u0000-\u001F]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 120);
  if (!limpo) return reserva;
  if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(limpo)) return `${limpo}_`;
  return limpo;
}
