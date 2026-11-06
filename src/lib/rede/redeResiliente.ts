/*
 * CAMADA DE REDE RESILIENTE (vale para TODAS as telas, antigas e novas, sem
 * mudar nenhuma delas). Fica entre o app e o Supabase e cuida de:
 *
 * 1. TEMPO LIMITE: nenhuma requisição fica "pendurada" para sempre
 *    (20 s).
 * 2. ESPERAR A INTERNET VOLTAR: se o aparelho está sem sinal na hora de
 *    salvar/consultar, espera até 30 s pela conexão antes de desistir
 *    (celular com sinal fraco ou oscilando).
 * 3. REPETIR COM SEGURANÇA:
 *    - Consultas (leituras) são repetidas até 2 vezes.
 *    - Edições e exclusões (PATCH/DELETE) também: repetir não muda o resultado.
 *    - Funções do banco feitas para não duplicar (criar conta, adiar,
 *      marcar pago...) também.
 *    - Outras CRIAÇÕES (POST) NUNCA são repetidas depois de enviadas, para
 *      não duplicar um lançamento. Só são enviadas quando há conexão.
 * 4. CACHE DE LEITURA EM MEMÓRIA: se uma consulta falhar por falta de
 *    internet, o sistema mostra os últimos dados já carregados daquela
 *    mesma consulta (em vez de uma tela de erro) e avisa que podem estar
 *    desatualizados. O cache fica só na memória do navegador (some ao fechar
 *    a aba ou sair do sistema) — nenhum dado financeiro fica gravado no aparelho.
 * 5. NÃO PERDER O QUE ESTÁ SENDO SALVO: enquanto houver uma gravação em
 *    andamento, o navegador pergunta antes de fechar/recarregar a página.
 *
 * Este arquivo não depende do React nem do Supabase (é testável isoladamente).
 */

export const TIMEOUT_PADRAO_MS = 20_000;
export const TIMEOUT_UPLOAD_MS = 90_000;
export const ESPERA_CONEXAO_MS = 30_000;
const TENTATIVAS = 3;
const STATUS_TEMPORARIOS = new Set([502, 503, 504]);
const MAX_ITENS_CACHE = 80;
const MAX_BYTES_ITEM_CACHE = 1_500_000;

/** Funções do banco (RPC) que só LEEM dados: podem ser repetidas e guardadas em cache. */
const RPC_SOMENTE_LEITURA = new Set([
  'resumo_saldos',
  'contas_acabando',
  'pago_pendente_resumo',
  'ping',
]);

/**
 * Funções que GRAVAM, mas foram feitas para poder ser repetidas sem duplicar
 * nada (repetir dá o mesmo resultado). Se a internet cair no meio, o app
 * tenta de novo sozinho.
 */
const RPC_IDEMPOTENTES = new Set([
  'generate_recurring_installments', // trava no banco: não duplica recorrência
  'criar_conta', // código único por cadastro
  'defer_installment', // informa o mês esperado: não adia 2x
  'mark_installment_paid',
  'unmark_installment_paid',
  'set_recurring_active',
]);

type Tipo = 'leitura' | 'idempotente' | 'criacao' | 'autenticacao';

export function classificar(metodo: string, url: string): Tipo {
  if (url.includes('/auth/v1/')) return 'autenticacao';
  if (metodo === 'GET' || metodo === 'HEAD') return 'leitura';
  const rpc = url.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/i);
  if (rpc) {
    if (RPC_SOMENTE_LEITURA.has(rpc[1])) return 'leitura';
    if (RPC_IDEMPOTENTES.has(rpc[1])) return 'idempotente';
    return 'criacao';
  }
  if ((metodo === 'PATCH' || metodo === 'DELETE' || metodo === 'PUT') && url.includes('/rest/v1/')) return 'idempotente';
  return 'criacao';
}

// ------------------------------------------------------------------ eventos
type Ouvinte = (info: { quando: number }) => void;
const ouvintesCache = new Set<Ouvinte>();
/** Avisa a interface quando dados do cache foram usados (para mostrar a faixa "dados de HH:MM"). */
export function aoUsarCache(fn: Ouvinte): () => void {
  ouvintesCache.add(fn);
  return () => ouvintesCache.delete(fn);
}

// ------------------------------------------------------------------ cache
interface ItemCache {
  status: number;
  headers: [string, string][];
  corpo: string;
  quando: number;
}
const cache = new Map<string, ItemCache>();

export function limparCacheLeituras() {
  cache.clear();
}

function chaveCache(metodo: string, url: string, init?: RequestInit): string {
  const corpo = typeof init?.body === 'string' ? init.body : '';
  // Inclui o "Range"/"Prefer" (paginação e contagem) para não misturar páginas diferentes.
  const h = new Headers(init?.headers);
  return `${metodo} ${url} ${corpo} ${h.get('range') ?? ''} ${h.get('prefer') ?? ''}`;
}

async function guardarNoCache(chave: string, resposta: Response) {
  try {
    const corpo = await resposta.clone().text();
    if (corpo.length > MAX_BYTES_ITEM_CACHE) return;
    cache.delete(chave); // reinsere no fim (o mais antigo sai primeiro)
    cache.set(chave, { status: resposta.status, headers: Array.from(resposta.headers.entries()), corpo, quando: Date.now() });
    while (cache.size > MAX_ITENS_CACHE) cache.delete(cache.keys().next().value as string);
  } catch {
    // não conseguir guardar no cache nunca atrapalha a resposta
  }
}

function respostaDoCache(chave: string): Response | null {
  const item = cache.get(chave);
  if (!item) return null;
  ouvintesCache.forEach((fn) => fn({ quando: item.quando }));
  const headers = new Headers(item.headers);
  headers.set('x-igao-cache', String(item.quando));
  return new Response(item.corpo, { status: item.status, headers });
}

// ------------------------------------------------------------------ gravações em andamento
let gravacoesPendentes = 0;
export function haGravacaoPendente(): boolean {
  return gravacoesPendentes > 0;
}

// ------------------------------------------------------------------ utilidades
function esperar(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function estaOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/** Espera a internet voltar (até `limiteMs`). Retorna true se voltou. */
export function esperarConexao(limiteMs = ESPERA_CONEXAO_MS, sinal?: AbortSignal | null): Promise<boolean> {
  if (!estaOffline() || typeof window === 'undefined') return Promise.resolve(true);
  return new Promise((resolve) => {
    const fim = (ok: boolean) => {
      clearTimeout(timer);
      window.removeEventListener('online', aoVoltar);
      sinal?.removeEventListener('abort', aoCancelar);
      resolve(ok);
    };
    const aoVoltar = () => fim(true);
    const aoCancelar = () => fim(false);
    const timer = setTimeout(() => fim(!estaOffline()), limiteMs);
    window.addEventListener('online', aoVoltar);
    sinal?.addEventListener('abort', aoCancelar);
  });
}

class ErroDeRede extends TypeError {}

async function comTimeout(base: typeof fetch, input: RequestInfo | URL, init: RequestInit | undefined, ms: number) {
  const controller = new AbortController();
  const original = init?.signal;
  const aoCancelar = () => controller.abort();
  if (original) {
    if (original.aborted) controller.abort();
    else original.addEventListener('abort', aoCancelar, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await base(input, { ...init, signal: controller.signal });
  } catch (e) {
    if (controller.signal.aborted && !original?.aborted) {
      throw new ErroDeRede('timeout: a conexão demorou demais para responder');
    }
    throw e;
  } finally {
    clearTimeout(timer);
    original?.removeEventListener('abort', aoCancelar);
  }
}

// ------------------------------------------------------------------ fetch principal
export function criarFetchResiliente(base: typeof fetch = (...a) => fetch(...a)): typeof fetch {
  return async (input, init) => {
    const metodo = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const tipo = classificar(metodo, url);
    const ehUpload = url.includes('/storage/v1/object/') && !url.includes('/sign/') && metodo !== 'GET' && metodo !== 'HEAD';
    const timeout = ehUpload ? TIMEOUT_UPLOAD_MS : TIMEOUT_PADRAO_MS;
    const chave = tipo === 'leitura' ? chaveCache(metodo, url, init) : '';
    const gravacao = tipo === 'criacao' || tipo === 'idempotente';

    if (gravacao) gravacoesPendentes++;
    try {
      // Sem sinal agora? Espera a conexão voltar (até 30 s) antes de enviar.
      if (estaOffline()) {
        const voltou = await esperarConexao(ESPERA_CONEXAO_MS, init?.signal);
        if (!voltou) {
          const doCache = tipo === 'leitura' ? respostaDoCache(chave) : null;
          if (doCache) return doCache;
          throw new ErroDeRede('Failed to fetch: sem conexão com a internet');
        }
      }

      // Criações e login: uma única tentativa (repetir poderia duplicar).
      if (tipo === 'criacao' || tipo === 'autenticacao') {
        return await comTimeout(base, input, init, timeout);
      }

      let ultimoErro: unknown;
      for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
        try {
          const resposta = await comTimeout(base, input, init, timeout);
          const temporario = STATUS_TEMPORARIOS.has(resposta.status);
          if (!temporario) {
            if (tipo === 'leitura' && resposta.ok) await guardarNoCache(chave, resposta);
            return resposta;
          }
          if (tentativa === TENTATIVAS) {
            const doCache = tipo === 'leitura' ? respostaDoCache(chave) : null;
            return doCache ?? resposta;
          }
        } catch (e) {
          ultimoErro = e;
          if (init?.signal?.aborted) throw e; // cancelado de propósito pela tela
          if (tentativa === TENTATIVAS) break;
          if (estaOffline()) await esperarConexao(ESPERA_CONEXAO_MS, init?.signal);
        }
        await esperar(600 * tentativa);
      }

      // Falhou de vez: para leituras, usa os últimos dados guardados, se houver.
      const doCache = tipo === 'leitura' ? respostaDoCache(chave) : null;
      if (doCache) return doCache;
      throw ultimoErro;
    } finally {
      if (gravacao) gravacoesPendentes--;
    }
  };
}

/** Pergunta antes de fechar/recarregar a página se houver gravação em andamento. */
export function protegerSaidaDuranteGravacao() {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeunload', (evento) => {
    if (!haGravacaoPendente()) return;
    evento.preventDefault();
    // Necessário em alguns navegadores para exibir a confirmação.
    evento.returnValue = '';
  });
}

/** É erro de conexão (e não uma recusa do banco)? */
export function ehErroDeRede(erro: unknown): boolean {
  if (!erro) return false;
  const e = erro as { message?: string; code?: string };
  const msg = String(e.message ?? erro);
  if (/failed to fetch|networkerror|network request failed|load failed|timeout|sem conexão/i.test(msg)) return true;
  return !e.code && /^(TypeError|FetchError|AbortError)\b/.test(msg);
}

/** Mensagem para mostrar na tela a partir de um erro do Supabase ou de rede. */
export function mensagemDeErro(erro: unknown, padrao = 'Não foi possível concluir. Tente de novo.'): string {
  if (!erro) return padrao;
  if (ehErroDeRede(erro)) return 'Sem conexão com a internet (ou muito lenta). Confira o sinal e tente de novo.';
  const e = erro as { message?: string; code?: string };
  if (e.code === 'PGRST204' && /importante/i.test(e.message ?? '')) {
    return 'O banco ainda não foi atualizado: rode a migration 0011_conta_importante.sql no SQL Editor do Supabase.';
  }
  if (e.code === 'PGRST202' || /could not find the function/i.test(e.message ?? '')) {
    return 'O banco ainda não foi atualizado: rode a migration 0010_seguranca_desempenho.sql no SQL Editor do Supabase.';
  }
  return e.message || padrao;
}
