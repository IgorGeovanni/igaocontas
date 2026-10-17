// O Supabase devolve no máximo 1000 linhas por consulta. Para listas que
// podem passar disso (todas as contas, relatórios de vários meses...), busca
// página por página até acabar. Se QUALQUER página falhar, dá erro — nunca
// devolve uma lista pela metade (que mostraria totais errados sem aviso).
const TAMANHO_PAGINA = 1000;
const MAX_PAGINAS = 50; // até 50 mil linhas

interface ResultadoPagina<T> {
  data: T[] | null;
  error: { message: string; code?: string } | null;
}

/**
 * `montar(de, ate)` deve devolver a consulta já com filtros e ORDEM definidos
 * (a ordem precisa ser estável, ex.: terminar com .order("id")), aplicando .range(de, ate).
 */
export async function buscarTodos<T>(
  montar: (de: number, ate: number) => PromiseLike<ResultadoPagina<T>>
): Promise<T[]> {
  const todos: T[] = [];
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const de = pagina * TAMANHO_PAGINA;
    const { data, error } = await montar(de, de + TAMANHO_PAGINA - 1);
    if (error) throw error;
    const lista = data ?? [];
    todos.push(...lista);
    if (lista.length < TAMANHO_PAGINA) return todos;
  }
  return todos;
}

/** Divide uma lista em pedaços (para filtros .in() com muitos ids, que estouram o tamanho da URL). */
export function emPedacos<T>(lista: T[], tamanho = 150): T[][] {
  const pedacos: T[][] = [];
  for (let i = 0; i < lista.length; i += tamanho) pedacos.push(lista.slice(i, i + tamanho));
  return pedacos;
}
