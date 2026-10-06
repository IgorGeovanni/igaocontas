// Todo valor monetário circula como INTEIRO EM CENTAVOS.
// Nunca fazemos matemática de dinheiro em ponto flutuante.

export function centavosParaReais(centavos: number): number {
  return centavos / 100;
}

export function reaisParaCentavos(reais: number): number {
  return Math.round(reais * 100);
}

const formatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatarMoeda(centavos: number): string {
  return formatter.format(centavosParaReais(centavos));
}

/** Converte um texto digitado tipo "1.999,99" ou "1999,99" para centavos. */
export function textoParaCentavos(texto: string): number {
  const limpo = texto
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(,|$))/g, "") // remove separador de milhar
    .replace(",", ".");
  const valor = parseFloat(limpo);
  return Number.isFinite(valor) ? Math.round(valor * 100) : 0;
}

export function formatarPercentual(valor: number): string {
  const sinal = valor > 0 ? "+" : "";
  return `${sinal}${valor.toFixed(0)}%`;
}

/** Variação percentual entre dois valores em centavos. Retorna null se não fizer sentido calcular. */
export function variacaoPercentual(atual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

/**
 * Valor efetivo de uma conta/parcela: principal + juros avulso (quando houver).
 * Usar esta função em qualquer soma/total, para os juros sempre entrarem na conta.
 */
export function valorEfetivo(item: { valor_centavos: number; juros_centavos?: number | null }): number {
  return item.valor_centavos + (item.juros_centavos ?? 0);
}
