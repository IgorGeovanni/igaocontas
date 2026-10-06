import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { LOGIN_COOKIE, SESSION_MAX_MS } from "@/lib/session";

const PUBLIC_PATHS = ["/login", "/recuperar-senha", "/redefinir-senha"];
// Nessas rotas o usuário pode ter uma sessão temporária (link de recuperação
// de senha), então elas não passam pela checagem dos 30 minutos.
const RECOVERY_PATHS = ["/recuperar-senha", "/redefinir-senha"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));
  const isRecovery = RECOVERY_PATHS.some((p) => path.startsWith(p));

  // redireciona levando junto os cookies que o Supabase atualizou/limpou
  function redirecionar(destino: string, limparCookieDeLogin = false) {
    const res = NextResponse.redirect(new URL(destino, request.url));
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    if (limparCookieDeLogin) {
      res.cookies.set(LOGIN_COOKIE, "", { maxAge: 0, path: "/" });
    }
    return res;
  }

  // Sessão com mais de 30 minutos (ou sem marcação de login): encerra.
  if (user && !isRecovery) {
    const inicio = Number(request.cookies.get(LOGIN_COOKIE)?.value);
    const sessaoValida = Number.isFinite(inicio) && Date.now() - inicio < SESSION_MAX_MS;

    if (!sessaoValida) {
      await supabase.auth.signOut({ scope: "local" });
      if (isPublic) return response; // /login: segue para a tela de login
      return redirecionar("/login?motivo=expirada", true);
    }
  }

  if (!user && !isPublic) {
    return redirecionar("/login");
  }

  if (user && path === "/login") {
    return redirecionar("/dashboard");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png).*)"],
};
