/*
 * MANTER O SUPABASE ATIVO (função agendada da Netlify)
 *
 * O plano gratuito do Supabase pausa o projeto depois de 7 dias sem atividade.
 * Esta função roda SOZINHA uma vez por dia e chama a função "ping" do banco
 * (criada na migration supabase/migrations/0010_seguranca_desempenho.sql), que só
 * devolve o número 1: não lê nem grava nenhum dado do sistema.
 *
 * Usa as variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY já cadastradas
 * na Netlify. Resultado em Netlify → Logs → Functions → manter-supabase-ativo.
 */
const TENTATIVAS = 3;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function chamarPing(url, chave) {
  const resposta = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/rpc/ping`, {
    method: 'POST',
    headers: { apikey: chave, Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(15000),
  });
  const texto = await resposta.text();
  if (!resposta.ok) throw new Error(`Supabase respondeu ${resposta.status}: ${texto.slice(0, 200)}`);
  return resposta.status;
}

export default async function manterSupabaseAtivo() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !chave) {
    console.error('[manter-supabase-ativo] Variáveis NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY não encontradas na Netlify.');
    return new Response('Variáveis de ambiente ausentes', { status: 500 });
  }
  let ultimoErro;
  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    try {
      const status = await chamarPing(url, chave);
      console.log(`[manter-supabase-ativo] OK (HTTP ${status}) em ${new Date().toISOString()} - tentativa ${tentativa}`);
      return new Response('Supabase ativo', { status: 200 });
    } catch (erro) {
      ultimoErro = erro;
      console.warn(`[manter-supabase-ativo] Tentativa ${tentativa} falhou: ${erro?.message ?? erro}`);
      if (tentativa < TENTATIVAS) await esperar(3000 * tentativa);
    }
  }
  console.error(`[manter-supabase-ativo] FALHOU após ${TENTATIVAS} tentativas: ${ultimoErro?.message ?? ultimoErro}`);
  return new Response('Falha ao contatar o Supabase', { status: 502 });
}

// Todo dia às 09:00 UTC (06:00 de Brasília).
export const config = { schedule: '0 9 * * *' };
