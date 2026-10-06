import {
  addMonths,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";

/** Sempre trabalhamos com o mês de referência como "YYYY-MM-01". */
export function mesReferencia(data: Date): string {
  return format(startOfMonth(data), "yyyy-MM-dd");
}

export function mesReferenciaDeString(dataISO: string): string {
  return mesReferencia(parseISO(dataISO));
}

export function mesAnterior(mesISO: string): string {
  return mesReferencia(subMonths(parseISO(mesISO), 1));
}

export function mesSeguinte(mesISO: string): string {
  return mesReferencia(addMonths(parseISO(mesISO), 1));
}

export function inicioEFimDoMes(mesISO: string): { inicio: string; fim: string } {
  const d = parseISO(mesISO);
  return {
    inicio: format(startOfMonth(d), "yyyy-MM-dd"),
    fim: format(endOfMonth(d), "yyyy-MM-dd"),
  };
}

export function rotuloMes(mesISO: string): string {
  const texto = format(parseISO(mesISO), "MMMM 'de' yyyy", { locale: ptBR });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function rotuloMesCurto(mesISO: string): string {
  const texto = format(parseISO(mesISO), "MMM/yy", { locale: ptBR });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function formatarData(dataISO: string): string {
  return format(parseISO(dataISO), "dd/MM/yyyy");
}

export function formatarDataCurta(dataISO: string): string {
  return format(parseISO(dataISO), "dd/MM");
}

export function hojeISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function mesAtualISO(): string {
  return mesReferencia(new Date());
}

export function estaAtrasada(vencimentoISO: string, status: string): boolean {
  return status === "pendente" && vencimentoISO < hojeISO();
}

/** Mês (YYYY-MM-01) em que o pagamento foi feito, pelo horário local. Null se não está pago. */
export function mesDoPagamento(pagoEm: string | null): string | null {
  return pagoEm ? mesReferencia(new Date(pagoEm)) : null;
}

/** Início do mês em ISO com fuso (meia-noite local), para filtrar colunas timestamptz. */
export function inicioDoMesTimestamp(mesISO: string): string {
  return new Date(`${mesISO}T00:00:00`).toISOString();
}

/** Data e hora local de um timestamp, ex.: 05/10/2026 às 14:32. */
export function formatarDataHora(timestampISO: string): string {
  return format(parseISO(timestampISO), "dd/MM/yyyy 'às' HH:mm");
}
