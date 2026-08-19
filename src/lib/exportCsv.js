/**
 * Gera e faz download de um arquivo CSV.
 * @param {string[][]} rows - Array de linhas (primeira linha = cabeçalho)
 * @param {string} filename
 */
export function downloadCsv(rows, filename) {
  const BOM = '\uFEFF'; // UTF-8 BOM para Excel reconhecer acentos
  const csv = BOM + rows
    .map(row =>
      row.map(cell => {
        const val = cell === null || cell === undefined ? '' : String(cell);
        // Escapa aspas e envolve em aspas se necessário
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(',')
    )
    .join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Gera CSV de folha de pagamento para RH.
 * Inclui coluna "Desconto Indisciplina/Taxa" apenas se houver taxas.
 */
export function exportPayrollCsv(rows, filename) {
  const hasFees = rows.some(r => r.taxa > 0);

  const header = [
    'Funcionário',
    'Departamento',
    'Mês/Período',
    'Total Marmitas',
    'Retiradas',
    'Não Retiradas',
    'Valor Marmitas (R$)',
    ...(hasFees ? ['Desconto Indisciplina/Taxa (R$)', 'Total a Descontar (R$)'] : []),
  ];

  const dataRows = rows.map(r => [
    r.name,
    r.department || '',
    r.period,
    r.total,
    r.pickedUp,
    r.notPickedUp,
    r.valorMarmitas.toFixed(2),
    ...(hasFees ? [r.taxa.toFixed(2), (r.valorMarmitas + r.taxa).toFixed(2)] : []),
  ]);

  downloadCsv([header, ...dataRows], filename);
}