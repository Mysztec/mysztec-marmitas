/**
 * Escapa texto que sera interpolado em HTML montado a mao.
 *
 * Os relatorios de impressao constroem uma pagina por concatenacao de string e
 * a abrem num blob. Sem escape, um nome de funcionario como
 * `<img src=x onerror=...>` viraria script executando no contexto do blob --
 * dados do banco chegando como codigo. O React protege o resto do sistema
 * automaticamente; estas duas telas ficavam de fora.
 */
export const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
