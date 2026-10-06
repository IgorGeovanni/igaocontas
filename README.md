# IGÃO CONTAS

Controle financeiro pessoal — simples, rápido e fácil de usar no celular.

Stack: **Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase (Postgres + Auth + RLS) + Netlify.**

---

## 1. Estrutura do projeto

```
igao-contas/
├── supabase/migrations/     ← SQL: schema, RLS, funções de negócio, categorias padrão
├── src/
│   ├── app/                 ← rotas (App Router)
│   │   ├── login, recuperar-senha, redefinir-senha   (públicas)
│   │   └── (app)/            dashboard, entradas, saidas, contas-do-mes,
│   │                         relatorios, agenda, configuracoes, mais  (autenticadas)
│   ├── components/          ← UI, componentes financeiros, layout, agenda, dashboard
│   ├── lib/
│   │   ├── supabase/        ← clientes browser/server
│   │   ├── finance/         ← dinheiro (centavos), datas/competência, dados agregados
│   │   └── hooks/           ← useUser, useCategories
│   └── types/database.ts    ← tipos espelhando o schema
├── middleware.ts             ← protege rotas e mantém sessão do Supabase
└── netlify.toml
```

---

## 2. Criar o projeto no Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, rode os arquivos de `supabase/migrations/` **nesta ordem**:
   1. `0001_schema.sql`
   2. `0002_rls.sql`
   3. `0003_functions.sql`
   4. `0004_seed_categories.sql`
   5. `0005_juros.sql` — adiciona o campo de juros avulso (seguro rodar mesmo com dados já cadastrados)
   6. `0006_pagamento_parcial.sql` — habilita pagamento parcial (também seguro rodar com dados já cadastrados)
   7. `0007_juros_no_pagamento.sql` — permite adicionar juros direto na hora de marcar como pago
   8. `0008_guardado_investido.sql` — tabela de dinheiro guardado/investido (tela "Guardado")
   9. `0009_grupos.sql` — grupos de contas (ex: SAAEB, CPFL, nome de uma pessoa)
3. Em **Project Settings → API**, copie a **URL** e a **anon public key**.
4. Em **Authentication → URL Configuration**, adicione a URL do seu site (local e depois a do Netlify) em *Site URL* e *Redirect URLs* (necessário para o link de redefinição de senha funcionar).
5. **Criar seu usuário:** o app não tem tela de autocadastro (por segurança, só quem tem acesso ao painel do Supabase cria contas novas). Para criar a sua:
   - Vá em **Authentication → Users → Add user → Create new user**
   - Preencha e-mail e senha
   - Marque **Auto Confirm User** para não precisar confirmar por e-mail
   - Repita esse processo sempre que quiser dar acesso a mais alguém

⚠️ **Nunca** copie a **service_role key** para o frontend ou para variáveis `NEXT_PUBLIC_*`.

---

## 3. Rodar localmente

```bash
cp .env.example .env.local
# edite .env.local com a URL e a anon key do seu projeto Supabase

npm install
npm run dev
```

Abra `http://localhost:3000` — você será redirecionado para `/login`.

---

## 4. Deploy no Netlify

1. Suba este projeto para um repositório Git (GitHub/GitLab).
2. No Netlify: **Add new site → Import an existing project**.
3. O `netlify.toml` já define o build (`npm run build`) e o plugin oficial do Next.js.
4. Em **Site settings → Environment variables**, adicione:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Faça o deploy e depois volte ao Supabase para adicionar a URL final do Netlify nas *Redirect URLs* de Auth.

---

## 5. Como a lógica financeira funciona (importante para manutenção)

- **Tudo em centavos.** Nenhum valor monetário é somado em ponto flutuante — veja `src/lib/finance/money.ts`.
- **`expense_sources`** guarda a *origem* de uma despesa (avulsa / parcelada / recorrente).
  **`expense_installments`** guarda cada *ocorrência concreta* que aparece em algum mês — é o que a tela "Contas do Mês" lista.
- **Compra parcelada:** todas as parcelas são geradas de uma vez na criação (`create_installment_purchase`), cada uma já no seu mês correto. A última parcela absorve o arredondamento para a soma bater exatamente com o valor total.
- **Recorrência:** só a fonte e a 1ª ocorrência são criadas de início. As ocorrências dos meses seguintes são geradas sob demanda (`generate_recurring_installments`, idempotente) sempre que o usuário abre o Dashboard ou Contas do Mês.
- **Adiar uma parcela ("Não pago"):** `defer_installment` nunca apaga nem renumera nada. Ele move `mes_referencia`/`vencimento_atual` para o mês seguinte e grava o evento em `installment_deferrals`, preservando para sempre `mes_referencia_original` e `vencimento_original`.
- **Status "atrasado"** nunca é gravado no banco — é sempre calculado (`pendente` + vencimento no passado) para nunca ficar desatualizado.
- **Auditoria:** gatilhos (`audit_trigger`) registram automaticamente criação/edição/exclusão de entradas, contas e categorias, e edições de parcelas (pago, não pago, adiada) em `audit_log`.
- **RLS:** toda tabela tem `user_id` e só é visível/editável pelo próprio dono — reforçado no banco, não só no frontend.

---

## 6. Roteiro de testes (faça antes de considerar pronto)

1. Criar uma compra em 10x → confere se as 10 parcelas aparecem nos meses corretos.
2. Marcar uma parcela como paga → saldo e Dashboard atualizam.
3. Marcar uma parcela como "Não pago" → escolher "Adiar" → confere se ela some do mês atual e aparece no mês seguinte somada à parcela natural daquele mês.
4. Repetir escolhendo "Vou pagar duas parcelas juntas" → mesmo resultado, histórico registrado com o rótulo correto.
5. Cadastrar uma conta avulsa hoje com vencimento em um mês passado ou futuro → confere se ela aparece no mês certo em "Contas do Mês", não no mês atual.
6. Criar/desativar uma recorrência → confere que ocorrências param de ser geradas após desativar, mas as passadas continuam no histórico.
7. Comparar dois meses no Dashboard e no Relatório → os totais devem bater entre as duas telas.
8. Criar um segundo usuário → confirmar que ele não vê nenhum dado do primeiro.
9. Gerar um relatório (mês e período personalizado) e testar o botão "Gerar PDF" (usa a impressão do navegador).
10. Pagar hoje uma conta antiga de outro mês → conferir se ela aparece no "Fluxo de caixa deste mês" do mês atual, e se o "Saldo para comparar com o banco" foi reduzido corretamente.
11. Criar um grupo, associar a 2+ contas diferentes → conferir se o filtro por grupo e o resumo "Totais por grupo" em Saídas somam certo.
12. Registrar um valor em "Guardado/Investido" → conferir se o "Saldo para comparar com o banco" no Dashboard diminuiu exatamente esse valor.

---

## 7. Limitações conhecidas / próximos passos

- O ambiente onde este projeto foi gerado não tem acesso à internet, então **não foi possível rodar `npm install` / `npm run build` para validar a compilação**. Rode `npm run build` localmente antes do primeiro deploy e ajuste qualquer erro de tipagem que aparecer.
- "Gerar PDF" usa a caixa de impressão do navegador (Ctrl/Cmd+P → Salvar como PDF), como pedido no briefing — não depende de nenhuma biblioteca extra.
- A arquitetura (UUIDs, tabelas separadas por conceito, RLS) já deixa espaço para adicionar depois: cartões de crédito, metas, contas bancárias, importação de extrato e notificações, sem precisar refazer o banco.


## 8. Regime de caixa, saldo bancário, guardado/investido e grupos

- **Fluxo de caixa do mês (Dashboard):** o resto do app funciona por *competência* (uma conta de março fica em março mesmo se só for paga em setembro). Esse card é a exceção de propósito: soma entradas pela **data real** em que entraram e saídas pela **data em que foram de fato pagas** (`pago_em`). Então, se você paga em setembro uma conta que venceu em março, ela entra no "Pago" de setembro aqui — exatamente o comportamento pedido.
- **Saldo para comparar com o banco (Dashboard):** `total de todas as entradas` − `total de tudo que já foi realmente pago` − `total guardado/investido`. É acumulado desde o primeiro lançamento, não depende do mês selecionado. Serve para bater com o saldo real da sua conta corrente; se não bater, normalmente é sinal de um lançamento esquecido ou duplicado.
- **Guardado / Investido** (`savings_entries`, tela `/guardado`): registro à parte de entradas/saídas para dinheiro que você tirou do fluxo normal — com tipo (guardado ou investido), onde e observação. Entra no cálculo do saldo bancário acima.
- **Grupos de contas** (`expense_groups`, gerenciados em Configurações): rótulo livre pra juntar várias contas sob um mesmo nome — útil pra concessionárias (tudo da SAAEB, tudo da CPFL) ou pra saber quanto você deve pra uma pessoa específica. Ao cadastrar ou editar uma saída, dá pra escolher um grupo já existente ou criar um novo na hora. As telas de Saídas e Contas do Mês ganharam um filtro por grupo, e Saídas mostra um resumo "Totais por grupo".

## Sessão e keep-alive

- **Logout após 30 minutos:** o login grava o cookie `igao_login_at` (expira em 30 min). O `middleware.ts` bloqueia rotas privadas depois do prazo e o componente `SessionTimeout` desloga na hora com a aba aberta. O tempo está em `src/lib/session.ts` (`SESSION_MAX_MS`).
- **Ping no banco:** a cada login é feita uma consulta leve em `categories` (`src/app/login/page.tsx`), para o Supabase não pausar o projeto por inatividade.

## Contas e saldo

- **Mês do pagamento:** conta paga em outro mês mantém o vencimento original e conta como paga no mês do pagamento (Contas do Mês e Dashboard). Toda conta paga mostra "Paga em dd/mm/aaaa às hh:mm".
- **Grupo:** pode ser escolhido ou criado em Editar conta (vale para todas as parcelas da compra).
- **Cadastro já paga:** checkbox "Essa conta já está paga" com data do pagamento (parcelada/recorrente marca só a primeira).
- **Lançar diferença:** botão no card "Saldo para comparar com seu banco". Diferença positiva vira entrada "Ajuste de saldo"; negativa vira saída paga "Ajuste de saldo".
- **Agrupar em lote:** em Contas do Mês, botão "Agrupar contas" permite marcar várias contas e colocá-las (ou tirá-las) de um grupo de uma vez.
