import { createBrowserClient } from "@supabase/ssr";
import {
  criarFetchResiliente,
  limparCacheLeituras,
  protegerSaidaDuranteGravacao,
} from "@/lib/rede/redeResiliente";

// Toda conversa do navegador com o Supabase passa pela camada de rede
// resiliente (tempo limite, espera a internet voltar, repete só o que é
// seguro repetir). O createBrowserClient reaproveita o mesmo cliente em
// todas as telas, então isso é configurado uma única vez.
const fetchResiliente = typeof window !== "undefined" ? criarFetchResiliente() : undefined;
let configurado = false;

export function createClient() {
  const cliente = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    fetchResiliente ? { global: { fetch: fetchResiliente } } : undefined
  );
  if (typeof window !== "undefined" && !configurado) {
    configurado = true;
    protegerSaidaDuranteGravacao();
    // Saiu da conta (botão Sair ou fim dos 30 min): apaga as cópias de
    // leitura guardadas na memória desta aba.
    cliente.auth.onAuthStateChange((evento) => {
      if (evento === "SIGNED_OUT") limparCacheLeituras();
    });
  }
  return cliente;
}
