// Edge Function: criacao de contas pelo administrador.
//
// Criar um usuario no Supabase Auth exige a serviceRole key, que da acesso
// irrestrito ao projeto e por isso NUNCA pode ser embarcada no front-end.
// A funcao roda no servidor: valida que quem chamou e admin/dono usando o
// token do proprio chamador e so entao usa a chave privilegiada.
//
// Deploy:  supabase functions deploy admin-create-user
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY
//          ja sao injetados automaticamente pelo Supabase.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Metodo nao permitido' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) return json({ error: 'Nao autenticado' }, 401);

  // 1. Quem esta chamando?
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user: callerUser } } = await caller.auth.getUser();
  if (!callerUser) return json({ error: 'Nao autenticado' }, 401);

  const { data: callerProfile } = await caller
    .from('profiles')
    .select('role')
    .eq('id', callerUser.id)
    .single();

  if (!callerProfile || !['admin', 'dono'].includes(callerProfile.role)) {
    return json({ error: 'Apenas administradores podem criar usuarios' }, 403);
  }

  // 2. Payload
  let body: {
    username?: string;
    password?: string;
    full_name?: string;
    role?: string;
    unidade_id?: string | null;
    email_domain?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'JSON invalido' }, 400);
  }

  const username = (body.username ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  const role = body.role ?? 'user';
  const domain = body.email_domain || 'mysztec.local';

  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    return json({ error: 'Usuario deve ter 3-32 caracteres (letras, numeros, . _ -)' }, 400);
  }
  if (password.length < 8) {
    return json({ error: 'A senha precisa ter ao menos 8 caracteres' }, 400);
  }
  if (!['dono', 'admin', 'user'].includes(role)) {
    return json({ error: 'Papel invalido' }, 400);
  }
  // Somente o dono pode criar outro dono.
  if (role === 'dono' && callerProfile.role !== 'dono') {
    return json({ error: 'Apenas o dono pode criar outro dono' }, 403);
  }

  // 3. Cria a conta com a chave privilegiada
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = `${username}@${domain}`;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // dominio sintetico: nao ha caixa de entrada para confirmar
  });

  if (createError) {
    const conflict = /already|exists|registered/i.test(createError.message);
    return json({ error: conflict ? 'Esse usuario ja existe' : createError.message }, conflict ? 409 : 400);
  }

  // 4. Perfil da aplicacao
  const { error: profileError } = await admin.from('profiles').insert({
    id: created.user.id,
    username,
    email,
    full_name: body.full_name ?? null,
    role,
    unidade_id: body.unidade_id || null,
  });

  if (profileError) {
    // Sem perfil o usuario ficaria preso em "nao cadastrado": desfaz.
    await admin.auth.admin.deleteUser(created.user.id);
    return json({ error: `Falha ao criar o perfil: ${profileError.message}` }, 400);
  }

  return json({ id: created.user.id, username, email, role }, 201);
});
