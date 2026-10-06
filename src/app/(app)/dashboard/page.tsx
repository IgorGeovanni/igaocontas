"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  ListChecks,
  Landmark,
  BadgeDollarSign,
  Info,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/finance/Money";
import { MonthSwitcher } from "@/components/finance/MonthSwitcher";
import { EvolucaoChart } from "@/components/dashboard/EvolucaoChart";
import { CategoriaChart } from "@/components/dashboard/CategoriaChart";
import { ContasAcabandoCard } from "@/components/dashboard/ContasAcabandoCard";
import { ProximosCompromissosCard } from "@/components/dashboard/ProximosCompromissosCard";
import { carregarDashboard, type DashboardData } from "@/lib/finance/dashboardData";
import { mesAtualISO, formatarDataCurta } from "@/lib/finance/dates";
import { variacaoPercentual, valorEfetivo } from "@/lib/finance/money";

export default function DashboardPage() {
  const [mes, setMes] = useState(mesAtualISO());
  const [dados, setDados] = useState<DashboardData | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    carregarDashboard(mes).then((d) => {
      if (ativo) {
        setDados(d);
        setCarregando(false);
      }
    });
    return () => {
      ativo = false;
    };
  }, [mes]);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Sua situação financeira em um olhar." />

      <div className="mb-6">
        <MonthSwitcher mes={mes} onChange={setMes} />
      </div>

      {carregando || !dados ? (
        <p className="text-sm text-ink-muted">Carregando...</p>
      ) : (
        <div className="space-y-6">
          {/* Saldo em destaque */}
          <Card className="relative min-w-0 overflow-hidden bg-gradient-to-br from-brand-pink to-brand-pinkDark">
            <p className="text-sm text-white/80">Saldo do período</p>
            <Money
              centavos={dados.saldo}
              className="block truncate font-tabular text-3xl font-bold text-white sm:text-4xl"
            />
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-white/90">
              <span className="whitespace-nowrap">
                Entradas: <Money centavos={dados.totalEntradas} className="font-tabular font-semibold" />
              </span>
              <span className="whitespace-nowrap">
                Saídas: <Money centavos={dados.totalSaidas} className="font-tabular font-semibold" />
              </span>
            </div>
          </Card>

          {/* Saldo para comparar com o banco — regime de caixa, desde sempre */}
          <Card className="min-w-0 border-brand-gold/30 bg-brand-gold/5">
            <div className="flex items-start gap-3">
              <BadgeDollarSign size={22} className="mt-0.5 shrink-0 text-brand-gold" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink-muted">Saldo para comparar com seu banco</p>
                <Money
                  centavos={dados.saldoBancario}
                  className="block truncate font-tabular text-2xl font-bold"
                  colorir
                />
                <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-muted">
                  <Info size={13} className="mt-0.5 shrink-0" />
                  Tudo que já entrou, menos tudo que você já pagou de fato (não importa o mês da
                  conta), menos o que está guardado/investido.
                </p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                  <span>
                    Entradas: <Money centavos={dados.totalEntradasGeral} className="font-medium text-money-in" />
                  </span>
                  <span>
                    Pago: <Money centavos={dados.totalPagoGeral} className="font-medium text-money-out" />
                  </span>
                  {dados.totalGuardadoInvestido > 0 && (
                    <span>
                      Guardado/investido:{" "}
                      <Money centavos={dados.totalGuardadoInvestido} className="font-medium text-brand-gold" />
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Fluxo de caixa do mês: pelo mês em que o dinheiro realmente entrou/saiu */}
          <Card className="min-w-0">
            <p className="mb-2 text-sm font-medium">Fluxo de caixa deste mês</p>
            <p className="mb-3 text-xs text-ink-muted">
              Se você pagou agora uma conta de outro mês, ela entra aqui — pelo mês em que foi
              paga, não pelo mês da conta.
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs text-ink-muted">Recebido</p>
                <Money
                  centavos={dados.caixaEntradasMes}
                  className="block truncate font-tabular text-lg font-semibold text-money-in"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs text-ink-muted">Pago</p>
                <Money
                  centavos={dados.caixaSaidasMes}
                  className="block truncate font-tabular text-lg font-semibold text-money-out"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs text-ink-muted">Saldo de caixa</p>
                <Money
                  centavos={dados.caixaSaldoMes}
                  className="block truncate font-tabular text-lg font-semibold"
                  colorir
                />
              </div>
            </div>
          </Card>

          {/* Quanto você deve no total, somando todos os meses */}
          {dados.qtdContasPendentesGeral > 0 && (
            <Card className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-money-out/30 bg-money-out/5">
              <div className="flex min-w-0 items-center gap-3">
                <Landmark size={22} className="shrink-0 text-money-out" />
                <div className="min-w-0">
                  <p className="text-sm text-ink-muted">
                    Você deve no total (todos os meses, {dados.qtdContasPendentesGeral}{" "}
                    {dados.qtdContasPendentesGeral === 1 ? "conta" : "contas"})
                  </p>
                  <Money
                    centavos={dados.totalDevidoGeral}
                    className="block truncate font-tabular text-2xl font-bold text-money-out"
                  />
                </div>
              </div>
              <Link
                href="/contas-do-mes?pendencias=1"
                className="shrink-0 whitespace-nowrap rounded-pill bg-money-out px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Ver todas as pendências
              </Link>
            </Card>
          )}

          {/* Estatísticas principais */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Entradas"
              centavos={dados.totalEntradas}
              icon={TrendingUp}
              tom="in"
              variacao={variacaoPercentual(dados.totalEntradas, dados.totalEntradasAnterior)}
            />
            <StatCard
              label="Saídas"
              centavos={dados.totalSaidas}
              icon={TrendingDown}
              tom="out"
              variacao={variacaoPercentual(dados.totalSaidas, dados.totalSaidasAnterior)}
            />
            <StatCard
              label="Saldo"
              centavos={dados.saldo}
              icon={Wallet}
              tom="auto"
              variacao={variacaoPercentual(dados.saldo, dados.saldoAnterior)}
            />
            <StatCard
              label="Falta pagar"
              centavos={dados.totalPendente}
              icon={AlertTriangle}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card className="min-w-0">
              <p className="truncate text-sm text-ink-muted">Contas pagas</p>
              <Money
                centavos={dados.totalPago}
                className="block truncate font-tabular text-xl font-semibold text-money-in"
              />
            </Card>
            <Card className="min-w-0">
              <p className="truncate text-sm text-ink-muted">Parcelas pendentes (mês)</p>
              <p className="truncate font-tabular text-xl font-semibold">{dados.qtdParcelasPendentes}</p>
            </Card>
            <Card className="min-w-0">
              <p className="truncate text-sm text-ink-muted">Contas atrasadas</p>
              <p className="truncate font-tabular text-xl font-semibold text-money-out">
                {dados.contasAtrasadas.length}
              </p>
            </Card>
            <Card className="min-w-0">
              <p className="truncate text-sm text-ink-muted">Juros pagos (mês)</p>
              <Money
                centavos={dados.totalJurosPago}
                className="block truncate font-tabular text-xl font-semibold text-brand-gold"
              />
              {dados.totalJurosPendente > 0 && (
                <p className="mt-0.5 truncate text-xs text-ink-muted">
                  + <Money centavos={dados.totalJurosPendente} className="text-xs" /> ainda por pagar
                </p>
              )}
            </Card>
          </div>

          {/* Próximas contas / atrasadas */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListChecks size={18} className="text-brand-pink" />
                  <h3 className="font-display text-base font-semibold">Próximas a vencer</h3>
                </div>
                <Link href="/contas-do-mes" className="text-xs text-ink-muted hover:text-brand-pink">
                  Ver todas
                </Link>
              </div>
              {dados.proximasContas.length === 0 ? (
                <p className="text-sm text-ink-muted">Nenhuma conta pendente por aqui. 🎉</p>
              ) : (
                <ul className="space-y-2.5">
                  {dados.proximasContas.map((c) => (
                    <li key={c.id} className="flex items-center justify-between text-sm">
                      <span>Vence {formatarDataCurta(c.vencimento_atual)}</span>
                      <Money centavos={valorEfetivo(c)} className="font-tabular font-medium" />
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle size={18} className="text-money-out" />
                <h3 className="font-display text-base font-semibold">Atrasadas</h3>
              </div>
              {dados.contasAtrasadas.length === 0 ? (
                <p className="text-sm text-ink-muted">Nada atrasado. Tudo em dia!</p>
              ) : (
                <ul className="space-y-2.5">
                  {dados.contasAtrasadas.slice(0, 5).map((c) => (
                    <li key={c.id} className="flex items-center justify-between text-sm">
                      <span className="text-money-out">
                        Venceu {formatarDataCurta(c.vencimento_atual)}
                      </span>
                      <Money centavos={valorEfetivo(c)} className="font-tabular font-medium" />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <ContasAcabandoCard contas={dados.contasAcabando} />

          <div className="grid gap-4 md:grid-cols-2">
            <EvolucaoChart dados={dados.evolucao} />
            <CategoriaChart dados={dados.despesasPorCategoria} />
          </div>

          <ProximosCompromissosCard />
        </div>
      )}
    </div>
  );
}
