// Controle do tempo máximo de sessão: o usuário é deslogado 30 minutos
// depois do login, independente de atividade.
//
// No login gravamos um cookie com o horário de início. Ele expira sozinho
// (Max-Age) e é conferido em dois lugares:
//   - middleware.ts (servidor): bloqueia qualquer rota privada após o prazo
//   - SessionTimeout.tsx (navegador): desloga na hora, com a aba aberta

export const SESSION_MAX_MS = 30 * 60 * 1000;
export const LOGIN_COOKIE = "igao_login_at";

export function marcarInicioDaSessao() {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LOGIN_COOKIE}=${Date.now()}; Max-Age=${
    SESSION_MAX_MS / 1000
  }; Path=/; SameSite=Lax${secure}`;
}

export function limparInicioDaSessao() {
  document.cookie = `${LOGIN_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}

export function lerInicioDaSessao(): number | null {
  const par = document.cookie.split("; ").find((c) => c.startsWith(`${LOGIN_COOKIE}=`));
  if (!par) return null;
  const valor = Number(par.split("=")[1]);
  return Number.isFinite(valor) ? valor : null;
}
