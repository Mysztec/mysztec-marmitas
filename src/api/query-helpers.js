/**
 * Funcoes puras da camada de dados.
 *
 * Vivem separadas do client para poderem ser testadas sem credenciais do
 * Supabase — e por isso a suite roda em CI sem nenhum segredo configurado.
 */

/**
 * Traduz a ordenacao em string herdada do Base44.
 *   'nome'  -> { column: 'nome', ascending: true }
 *   '-date' -> { column: 'date', ascending: false }
 */
export const parseSort = (sort) => {
  if (!sort) return null;
  const descending = sort.startsWith('-');
  return { column: descending ? sort.slice(1) : sort, ascending: !descending };
};

/**
 * O Base44 aceitava string vazia em campo de referencia; no Postgres uma coluna
 * uuid ou date rejeita '' com erro de sintaxe. Os formularios usam '' como
 * "nao selecionado", entao a conversao acontece aqui — num lugar so, em vez de
 * espalhada por cada tela.
 */
const NULLABLE_WHEN_EMPTY = (key) =>
  key === 'id' || key === 'date' || key.endsWith('_id') || key.endsWith('_at');

export const normalizeRecord = (record) => {
  const out = {};
  for (const [key, value] of Object.entries(record)) {
    out[key] = value === '' && NULLABLE_WHEN_EMPTY(key) ? null : value;
  }
  return out;
};
