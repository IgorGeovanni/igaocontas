import Image from "next/image";
import { formatarMoeda, valorEfetivo } from "@/lib/finance/money";
import { formatarData, rotuloMes } from "@/lib/finance/dates";
import type { ReportData } from "@/lib/finance/reportData";

interface Props {
  dados: ReportData;
  mesInicio: string;
  mesFim: string;
  categoriaNome: (id: string | null) => string;
  busca?: string;
}

export function PrintableReport({ dados, mesInicio, mesFim, categoriaNome, busca = "" }: Props) {
  const periodoLabel =
    mesInicio === mesFim ? rotuloMes(mesInicio) : `${rotuloMes(mesInicio)} — ${rotuloMes(mesFim)}`;

  const termo = busca.trim().toLowerCase();
  const entradasFiltradas = termo
    ? dados.entradas.filter((e) => e.descricao.toLowerCase().includes(termo))
    : dados.entradas;
  const despesasFiltradas = termo
    ? dados.despesas.filter((d) => d.expense_sources.descricao.toLowerCase().includes(termo))
    : dados.despesas;
  const totalEntradasFiltrado = entradasFiltradas.reduce((acc, e) => acc + e.valor_centavos, 0);
  const totalDespesasFiltrado = despesasFiltradas.reduce((acc, d) => acc + valorEfetivo(d), 0);

  return (
    <div className="print-area rounded-card border border-base-border bg-base-surface p-6 md:p-8">
      <div className="mb-6 flex items-center justify-between border-b border-base-border pb-4">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="IGÃO CONTAS" width={48} height={48} />
          <div>
            <p className="font-display text-lg font-bold">IGÃO CONTAS</p>
            <p className="text-xs text-ink-muted">Relatório financeiro</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold">{periodoLabel}</p>
          <p className="text-xs text-ink-muted">
            Gerado em {new Date().toLocaleString("pt-BR")}
          </p>
        </div>
      </div>

      {/* Resumo — sempre reflete o período inteiro, não a busca */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <ResumoItem label="Total de entradas" valor={dados.totalEntradas} cor="text-money-in" />
        <ResumoItem label="Total de despesas" valor={dados.totalDespesas} cor="text-money-out" />
        <ResumoItem label="Saldo do período" valor={dados.saldoPeriodo} />
        <ResumoItem label="Saldo anterior" valor={dados.saldoAnterior} />
        <ResumoItem label="Saldo acumulado" valor={dados.saldoAcumulado} destaque />
      </div>

      {termo && (
        <p className="no-print mb-4 text-xs text-ink-muted">
          Filtrando Entradas e Despesas por &quot;{busca.trim()}&quot; — o resumo acima continua
          mostrando o período inteiro.
        </p>
      )}

      {/* Entradas */}
      <Secao titulo="Entradas">
        {entradasFiltradas.length === 0 ? (
          <p className="text-sm text-ink-muted">
            {termo ? "Nenhuma entrada encontrada para essa busca." : "Nenhuma entrada no período."}
          </p>
        ) : (
          <Tabela
            linhas={entradasFiltradas.map((e) => [
              formatarData(e.data),
              e.descricao,
              categoriaNome(e.categoria_id),
              formatarMoeda(e.valor_centavos),
            ])}
            cabecalho={["Data", "Descrição", "Categoria", "Valor"]}
            total={formatarMoeda(totalEntradasFiltrado)}
          />
        )}
      </Secao>

      {/* Despesas */}
      <Secao titulo="Despesas">
        {despesasFiltradas.length === 0 ? (
          <p className="text-sm text-ink-muted">
            {termo ? "Nenhuma despesa encontrada para essa busca." : "Nenhuma despesa no período."}
          </p>
        ) : (
          <Tabela
            linhas={despesasFiltradas.map((d) => [
              formatarData(d.vencimento_atual),
              d.expense_sources.descricao +
                (d.total_parcelas && d.total_parcelas > 1 ? ` (${d.numero_parcela}/${d.total_parcelas})` : "") +
                (d.juros_centavos > 0 ? " + juros" : ""),
              categoriaNome(d.expense_sources.categoria_id),
              d.status === "pago" ? "Pago" : "Pendente",
              formatarMoeda(valorEfetivo(d)),
            ])}
            cabecalho={["Vencimento", "Descrição", "Categoria", "Status", "Valor"]}
            total={formatarMoeda(totalDespesasFiltrado)}
          />
        )}
      </Secao>

      {/* Por categoria */}
      <Secao titulo="Resumo por categoria">
        {dados.categorias.length === 0 ? (
          <p className="text-sm text-ink-muted">Sem despesas categorizadas.</p>
        ) : (
          <ul className="space-y-1.5">
            {dados.categorias.map((c) => (
              <li key={c.categoria} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.cor }} />
                  {c.categoria}
                </span>
                <span className="font-tabular font-medium">{formatarMoeda(c.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      {/* Comparação */}
      <Secao titulo="Comparação com o período anterior">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <ComparacaoItem
            label="Entradas"
            atual={dados.totalEntradas}
            anterior={dados.comparacao.totalEntradasAnterior}
          />
          <ComparacaoItem
            label="Despesas"
            atual={dados.totalDespesas}
            anterior={dados.comparacao.totalDespesasAnterior}
          />
          <ComparacaoItem
            label="Saldo"
            atual={dados.saldoPeriodo}
            anterior={dados.comparacao.saldoPeriodoAnterior}
          />
        </div>
      </Secao>
    </div>
  );
}

function ResumoItem({
  label,
  valor,
  cor,
  destaque,
}: {
  label: string;
  valor: number;
  cor?: string;
  destaque?: boolean;
}) {
  return (
    <div className={`rounded-xl border border-base-border p-3 ${destaque ? "bg-base-surface2" : ""}`}>
      <p className="text-xs text-ink-muted">{label}</p>
      <p className={`font-tabular text-lg font-semibold ${cor ?? ""}`}>{formatarMoeda(valor)}</p>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-ink-muted">
        {titulo}
      </h3>
      {children}
    </div>
  );
}

function Tabela({
  cabecalho,
  linhas,
  total,
}: {
  cabecalho: string[];
  linhas: string[][];
  total: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="border-b border-base-border text-left text-xs text-ink-muted">
            {cabecalho.map((c) => (
              <th key={c} className="pb-2 font-normal">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha, idx) => (
            <tr key={idx} className="border-b border-base-border/50">
              {linha.map((valor, i) => (
                <td
                  key={i}
                  className={`py-2 ${i === linha.length - 1 ? "text-right font-tabular font-medium" : ""}`}
                >
                  {valor}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td colSpan={cabecalho.length - 1} className="pt-2 text-right text-xs font-semibold text-ink-muted">
              TOTAL
            </td>
            <td className="pt-2 text-right font-tabular font-semibold">{total}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ComparacaoItem({ label, atual, anterior }: { label: string; atual: number; anterior: number }) {
  return (
    <div className="rounded-xl border border-base-border p-3">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="font-tabular font-semibold">{formatarMoeda(atual)}</p>
      <p className="text-xs text-ink-faint">Antes: {formatarMoeda(anterior)}</p>
    </div>
  );
}
