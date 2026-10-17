import type { SupabaseClient } from "@supabase/supabase-js";
import { mensagemErroGrupo } from "@/lib/finance/erros";

/**
 * Cria um grupo pelo nome — ou devolve o que já existe com esse nome.
 * (Com internet ruim, a 1ª tentativa pode ter criado o grupo sem a resposta
 * chegar; antes a 2ª tentativa travava em "Já existe um grupo com esse nome".)
 */
export async function obterOuCriarGrupo(
  supabase: SupabaseClient,
  nome: string
): Promise<{ id: string } | { erro: string }> {
  const limpo = nome.trim();
  const { data: sessao } = await supabase.auth.getSession();
  const userId = sessao.session?.user.id;
  if (!userId) return { erro: "Sua sessão expirou. Entre novamente." };

  const { data, error } = await supabase
    .from("expense_groups")
    .insert({ user_id: userId, nome: limpo })
    .select("id")
    .single();
  if (!error && data) return { id: data.id };

  if (error?.code === "23505") {
    const { data: existente } = await supabase
      .from("expense_groups")
      .select("id")
      .eq("nome", limpo)
      .maybeSingle();
    if (existente) return { id: existente.id };
  }
  return { erro: error ? mensagemErroGrupo(error) : "Não foi possível criar o grupo." };
}
