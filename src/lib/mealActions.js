import { db } from '@/api/client';

/**
 * Mensagens das recusas devolvidas por reserve_meal / pickup_meal.
 *
 * A decisao acontece no banco; aqui so traduzimos o codigo. Textos genericos
 * de proposito onde revelar o motivo ajudaria quem esta tentando adivinhar
 * um PIN.
 */
const ERROS = {
  nao_autenticado: 'Sessao expirada. Entre novamente.',
  sistema_bloqueado: 'Sistema bloqueado. Procure o administrador.',
  fora_da_janela: 'Fora do horario permitido.',
  funcionario_invalido: 'Funcionario inativo ou inexistente.',
  fora_da_unidade: 'Funcionario nao pertence a esta unidade.',
  bloqueado_por_tentativas: 'Muitas tentativas. Aguarde 15 minutos.',
  pin_incorreto: 'Senha incorreta.',
  ja_reservado: 'Este funcionario ja reservou hoje.',
  sem_reserva: 'Nenhuma reserva encontrada para hoje.',
  sem_permissao: 'Voce nao tem permissao para esta acao.',
  pin_invalido: 'O PIN precisa ter 4 digitos.',
};

export const mensagemDeErro = (codigo) =>
  ERROS[codigo] || 'Nao foi possivel concluir. Tente novamente.';

/** @returns {Promise<{ok: boolean, error?: string, reservation?: object}>} */
export async function reservarMarmita(employeeId, pin) {
  return db.rpc('reserve_meal', { p_employee: employeeId, p_pin: pin });
}

export async function retirarMarmita(employeeId, pin) {
  return db.rpc('pickup_meal', { p_employee: employeeId, p_pin: pin });
}

export async function definirPinDoFuncionario(employeeId, pin) {
  return db.rpc('set_employee_pin', { p_employee: employeeId, p_pin: pin });
}
