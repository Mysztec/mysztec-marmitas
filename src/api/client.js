/**
 * Camada de dados do sistema.
 *
 * Reproduz a interface que o SDK do Base44 expunha (`entities.X.list/filter/...`
 * e `auth.me/logout`) sobre o Supabase. Manter a mesma assinatura foi uma decisao
 * deliberada: permitiu trocar a plataforma inteira sem reescrever as 21 telas e
 * hooks que consomem os dados.
 *
 * Convencoes herdadas que foram preservadas de proposito:
 *  - toda linha tem `id`, `created_date` e `updated_date`
 *  - ordenacao e uma string: 'campo' (asc) ou '-campo' (desc)
 */
import { supabase, AUTH_EMAIL_DOMAIN } from './supabase';
import { usernameToEmail } from '@/lib/username';
import { normalizeRecord, parseSort } from './query-helpers';

/** Nome logico da entidade -> tabela no Postgres. */
const TABLES = {
  Employee: 'employees',
  MealReservation: 'meal_reservations',
  Company: 'companies',
  Unidade: 'unidades',
  AppSettings: 'app_settings',
  GlobalSettings: 'global_settings',
  User: 'profiles',
};

const unwrap = ({ data, error }) => {
  if (error) throw Object.assign(new Error(error.message), { code: error.code, status: error.status });
  return data;
};

const applySort = (query, sort) => {
  const parsed = parseSort(sort);
  return parsed ? query.order(parsed.column, { ascending: parsed.ascending }) : query;
};

const applyWhere = (query, where = {}) => {
  for (const [column, value] of Object.entries(where)) {
    if (value === undefined) continue;
    if (value === null) query = query.is(column, null);
    else if (Array.isArray(value)) query = query.in(column, value);
    else query = query.eq(column, value);
  }
  return query;
};

function entity(name) {
  const table = TABLES[name];
  if (!table) throw new Error(`Entidade desconhecida: ${name}`);

  const select = (where, sort, limit) => {
    let q = applySort(applyWhere(supabase.from(table).select('*'), where), sort);
    if (limit) q = q.limit(limit);
    return q;
  };

  return {
    /** list(sort?, limit?) */
    async list(sort, limit) {
      return unwrap(await select({}, sort, limit)) ?? [];
    },

    /** filter(where, sort?, limit?) — igualdade simples, ou array para IN */
    async filter(where, sort, limit) {
      return unwrap(await select(where, sort, limit)) ?? [];
    },

    async get(id) {
      return unwrap(await supabase.from(table).select('*').eq('id', id).single());
    },

    async create(data) {
      return unwrap(await supabase.from(table).insert(normalizeRecord(data)).select().single());
    },

    async bulkCreate(records) {
      if (!records?.length) return [];
      return unwrap(await supabase.from(table).insert(records.map(normalizeRecord)).select()) ?? [];
    },

    async update(id, data) {
      return unwrap(
        await supabase
          .from(table)
          .update({ ...normalizeRecord(data), updated_date: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single()
      );
    },

    async delete(id) {
      unwrap(await supabase.from(table).delete().eq('id', id));
      return { id };
    },

    /**
     * Notifica a cada INSERT/UPDATE/DELETE na tabela.
     * Retorna a funcao de cancelamento.
     */
    subscribe(callback) {
      const channel = supabase
        .channel(`realtime:${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) =>
          callback(payload)
        )
        .subscribe();
      return () => supabase.removeChannel(channel);
    },
  };
}

const entities = new Proxy(
  {},
  {
    get: (cache, name) => (cache[name] ||= entity(name)),
  }
);

const auth = {
  /** Usuario logado com o perfil (role, unidade_id) ja mesclado. */
  async me() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw Object.assign(new Error('Nao autenticado'), { status: 401 });

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Usuario existe no Auth mas nao tem perfil: tratado como nao cadastrado.
    if (error) throw Object.assign(new Error('Usuario sem perfil'), { status: 403, code: 'user_not_registered' });

    return { ...profile, email: user.email };
  },

  async signIn(username, password) {
    return unwrap(
      await supabase.auth.signInWithPassword({
        email: usernameToEmail(username, AUTH_EMAIL_DOMAIN),
        password,
      })
    );
  },

  /**
   * Cria uma conta. Delegado a uma Edge Function porque a criacao de usuarios
   * exige a service role key, que nao pode existir no front-end.
   */
  async createUser({ username, password, full_name, role, unidade_id }) {
    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: { username, password, full_name, role, unidade_id, email_domain: AUTH_EMAIL_DOMAIN },
    });
    if (error) {
      // A mensagem util do servidor vem no corpo da resposta, nao em error.message.
      const detail = await error.context?.json?.().catch(() => null);
      throw new Error(detail?.error || error.message);
    }
    return data;
  },

  async logout() {
    await supabase.auth.signOut();
  },

  onChange(callback) {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
    return () => data.subscription.unsubscribe();
  },
};

/**
 * Chama uma funcao do banco.
 *
 * Reserva e retirada passam por aqui em vez de escrever direto na tabela: a
 * conferencia do PIN, a janela de horario e a unidade sao decididas no
 * servidor, onde o cliente nao alcanca.
 */
const rpc = async (fn, args = {}) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return data;
};

export const db = { entities, auth, rpc };
export default db;
