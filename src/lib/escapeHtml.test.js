import { describe, expect, it } from 'vitest';
import { escapeHtml } from './escapeHtml';

describe('escapeHtml', () => {
  it('neutraliza uma tentativa de injecao', () => {
    // Nome de funcionario e dado que o admin digita: sem escape, viraria
    // script executando dentro do relatorio de impressao.
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;'
    );
    expect(escapeHtml('<script>roubar()</script>')).toBe(
      '&lt;script&gt;roubar()&lt;/script&gt;'
    );
  });

  it('escapa aspas, que quebrariam um atributo', () => {
    expect(escapeHtml('a"b')).toBe('a&quot;b');
    expect(escapeHtml("a'b")).toBe('a&#39;b');
  });

  it('escapa o & antes dos demais, sem duplicar', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('preserva texto comum, incluindo acentos', () => {
    expect(escapeHtml('João da Silva')).toBe('João da Silva');
    expect(escapeHtml('Setor A - 2')).toBe('Setor A - 2');
  });

  it('trata nulo e indefinido como vazio', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});
