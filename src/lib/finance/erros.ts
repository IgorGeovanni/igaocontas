// Traduz erros do Supabase em mensagens úteis para o usuário.
interface ErroSupabase {
  code?: string;
  message?: string;
}

export function mensagemErroGrupo(erro: ErroSupabase): string {
  if (erro.code === "23505") return "Já existe um grupo com esse nome.";
  if (
    erro.code === "42P01" ||
    erro.code === "PGRST205" ||
    /does not exist|schema cache/i.test(erro.message ?? "")
  ) {
    return "A tabela de grupos ainda não existe no Supabase. Rode a migration 0009_grupos_seguro.sql no SQL Editor.";
  }
  if (erro.code === "42501") {
    return "Sem permissão para criar grupos (política de segurança do Supabase).";
  }
  return `Não foi possível criar o grupo: ${erro.message ?? "erro desconhecido"}`;
}
