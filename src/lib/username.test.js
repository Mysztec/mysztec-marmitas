import { describe, expect, it } from 'vitest';
import { isValidUsername, usernameToEmail } from './username';

describe('usernameToEmail', () => {
  it('acopla o dominio sintetico ao nome de usuario', () => {
    expect(usernameToEmail('joao.silva')).toBe('joao.silva@mysztec.local');
  });

  it('normaliza caixa e espacos', () => {
    expect(usernameToEmail('  Joao.Silva ')).toBe('joao.silva@mysztec.local');
  });

  it('respeita um dominio customizado', () => {
    expect(usernameToEmail('ana', 'empresa.com')).toBe('ana@empresa.com');
  });

  it('deixa passar quem ja digitou um e-mail', () => {
    expect(usernameToEmail('ana@empresa.com')).toBe('ana@empresa.com');
  });
});

describe('isValidUsername', () => {
  it('aceita o formato esperado', () => {
    expect(isValidUsername('joao.silva')).toBe(true);
    expect(isValidUsername('ana_2')).toBe(true);
    expect(isValidUsername('unidade-01')).toBe(true);
  });

  it('rejeita curto demais, longo demais e caracteres invalidos', () => {
    expect(isValidUsername('ab')).toBe(false);
    expect(isValidUsername('a'.repeat(33))).toBe(false);
    expect(isValidUsername('joao silva')).toBe(false);
    expect(isValidUsername('joão')).toBe(false);
  });
});
