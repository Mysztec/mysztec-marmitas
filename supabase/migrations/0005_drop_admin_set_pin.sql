-- ============================================================================
-- 0005 - Remove o caminho em que o administrador escolhe a senha
--
-- Com o funcionario definindo o proprio PIN no primeiro uso e a redefinicao
-- feita por reset_employee_pin (que apaga, nao escolhe), set_employee_pin
-- deixou de ter uso -- e era o unico caminho pelo qual alguem do RH poderia
-- conhecer a senha de outra pessoa. Sai da API.
--
-- Emergencia continua possivel pelo SQL Editor, com acesso direto ao banco.
-- Esse e o lugar certo para uma excecao: exige credencial de administrador do
-- projeto e fica registrado, em vez de ser um botao na tela.
-- ============================================================================

drop function if exists public.set_employee_pin(uuid, text);
