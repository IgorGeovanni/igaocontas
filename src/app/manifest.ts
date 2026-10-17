import type { MetadataRoute } from "next";

// Faz o app poder ser instalado na tela inicial do celular com a logo como ícone.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "IGÃO CONTAS",
    short_name: "IGÃO CONTAS",
    description: "Controle financeiro pessoal — simples, rápido e direto ao ponto.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0B0B0E",
    theme_color: "#0B0B0E",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
