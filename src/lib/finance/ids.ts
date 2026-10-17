// Código único gerado no celular para cada cadastro. Se a internet cair e a
// pessoa tocar em "Salvar" de novo, o banco reconhece o mesmo código e não
// cria nada repetido.
export function novoId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Erro de "já existe" (o mesmo cadastro chegou ao banco numa tentativa anterior). */
export function ehDuplicado(erro: { code?: string } | null | undefined): boolean {
  return erro?.code === "23505";
}
