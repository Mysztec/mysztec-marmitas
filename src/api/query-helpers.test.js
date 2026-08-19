import { describe, expect, it } from 'vitest';
import { normalizeRecord, parseSort } from './query-helpers';

describe('parseSort', () => {
  it('interpreta ordenacao ascendente', () => {
    expect(parseSort('nome')).toEqual({ column: 'nome', ascending: true });
  });

  it('interpreta o prefixo - como descendente', () => {
    expect(parseSort('-date')).toEqual({ column: 'date', ascending: false });
    expect(parseSort('-created_date')).toEqual({ column: 'created_date', ascending: false });
  });

  it('devolve null quando nao ha ordenacao', () => {
    expect(parseSort(undefined)).toBeNull();
    expect(parseSort('')).toBeNull();
  });
});

describe('normalizeRecord', () => {
  it('converte string vazia em null nos campos de referencia', () => {
    expect(normalizeRecord({ unidade_id: '' })).toEqual({ unidade_id: null });
    expect(normalizeRecord({ employee_id: '' })).toEqual({ employee_id: null });
    expect(normalizeRecord({ picked_up_at: '' })).toEqual({ picked_up_at: null });
    expect(normalizeRecord({ date: '' })).toEqual({ date: null });
  });

  it('preserva string vazia em campo de texto comum', () => {
    // 'department' vazio e um valor legitimo e nao pode virar null.
    expect(normalizeRecord({ department: '' })).toEqual({ department: '' });
    expect(normalizeRecord({ name: '' })).toEqual({ name: '' });
  });

  it('nao altera valores preenchidos', () => {
    const registro = {
      name: 'Joao',
      unidade_id: '11111111-1111-1111-1111-111111111111',
      active: true,
      preco: 0,
    };
    expect(normalizeRecord(registro)).toEqual(registro);
  });

  it('preserva false e zero (nao confunde com vazio)', () => {
    expect(normalizeRecord({ active: false, taxa: 0 })).toEqual({ active: false, taxa: 0 });
  });
});
