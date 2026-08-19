/**
 * O sistema autentica por nome de usuario, mas o Supabase Auth exige e-mail.
 * A ponte e um dominio sintetico: nenhum e-mail e enviado e a caixa nao existe.
 * Funcao pura, sem dependencia do client — por isso e testavel sem credenciais.
 */
export const usernameToEmail = (username, domain = 'mysztec.local') =>
  username.includes('@') ? username.trim() : `${username.trim().toLowerCase()}@${domain}`;

/** Regra de formato aplicada tambem na Edge Function que cria a conta. */
export const isValidUsername = (username) =>
  /^[a-z0-9._-]{3,32}$/.test(String(username).trim().toLowerCase());
