import type { SupabaseClient } from "@supabase/supabase-js";
import { mensagemDeErro } from "@/lib/rede/redeResiliente";

/**
 * Tag "Importante": fica na CONTA (expense_sources), não na parcela.
 * Por isso, marcar uma conta recorrente vale para todos os meses (os que já
 * existem e os que ainda serão criados), e marcar uma compra parcelada vale
 * para todas as parcelas dela.
 */

/** Coloca as contas importantes primeiro. Dentro de cada bloco, a ordem original é mantida. */
export function importantesPrimeiro<T>(lista: T[], ehImportante: (item: T) => boolean): T[] {
  // Array.prototype.sort é estável: quem empata continua na ordem em que veio
  return [...lista].sort((a, b) => Number(ehImportante(b)) - Number(ehImportante(a)));
}

/** Grava a tag na conta. Devolve null se deu certo, ou a mensagem de erro. */
export async function definirImportante(
  supabase: SupabaseClient,
  sourceIds: string[],
  valor: boolean
): Promise<string | null> {
  if (sourceIds.length === 0) return null;
  const { error } = await supabase.from("expense_sources").update({ importante: valor }).in("id", sourceIds);
  return error ? mensagemDeErro(error) : null;
}
