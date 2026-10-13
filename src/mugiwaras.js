// src/mugiwaras.js — mugiwarasoficial.org consumido NO CELULAR.
//
// O site fica atrás do Cloudflare, que devolve 403 para IPs de datacenter
// (o Render, onde a API vive) mas aceita IPs residenciais/móveis — por isso
// o app fala com o site direto, sem passar pela API do CatScrappy. O Cloudflare
// também barra o cliente HTTP do RN, então as chamadas saem de um WebView
// (ver src/CloudflareModal.js).
//
// O site foi reescrito em Next.js e não é mais WordPress/Madara: em vez de
// raspar HTML, hoje se consome a API JSON pública em app.mugiwarasoficial.com
// (namespace /v1/www, que não pede autenticação — só as rotas de conta
// logada, como /v1/www/library, devolvem 401).
//
// O id de um mangá é o slug; o de um capítulo é "slug/numero", para que
// obterPaginas() monte a URL sozinho.

import { buscarViaWebView, rasparPaginasViaWebView } from "./CloudflareModal";
import { base64ParaBytes } from "./pdf";


// O fetch() do RN é barrado pelo Cloudflare (ver CloudflareModal.js), então as
// chamadas saem do WebView, que é same-origin com a API — daí o caminho ser
// relativo em vez da URL completa.
const CAMINHO_API = "/v1/www";

// A API devolve capítulos do mais novo para o mais antigo, paginados; 200 por
// página é o suficiente para trazer obras longas em poucas idas.
const CAPS_POR_PAGINA = 200;

function json(caminho) {
  return buscarViaWebView(`${CAMINHO_API}${caminho}`);
}

// Ids: aceita tanto o slug/"slug/numero" quanto uma URL do site, para não
// quebrar favoritos e histórico salvos no formato antigo.
function partesDoId(id) {
  let caminho = String(id || "").trim();
  if (/^https?:\/\//.test(caminho)) {
    try {
      caminho = new URL(caminho).pathname;
    } catch {
      /* segue com a string crua */
    }
  }
  const partes = caminho.replace(/^\/+|\/+$/g, "").split("/");
  // Descarta um prefixo "manga" vindo de URLs; sobra <slug>/<numero>.
  return partes[0] === "manga" ? partes.slice(1) : partes;
}

// Busca: mesmos campos que a API do CatScrappy devolve
// ({ id, titulo, imagem, sinopse }). O id é o slug do mangá.
export async function buscarManga(nome) {
  // Sem ?limit a API devolve só 8 resultados.
  const corpo = await json(`/search?q=${encodeURIComponent(nome)}&limit=40`);
  return (corpo.data || [])
    .filter((obra) => obra.slug)
    .map((obra) => ({
      id: obra.slug,
      titulo: obra.title || "",
      imagem: obra.coverUrl || "",
      sinopse: "", // a busca não traz sinopse; ela vem em /works/{slug}
    }));
}

// Capítulos (o site é só pt-br). O id de cada capítulo é "slug/numero".
export async function listarCapitulos(mangaId) {
  const slug = partesDoId(mangaId)[0];
  const caps = [];

  let pagina = 1;
  let totalPaginas = 1;
  while (pagina <= totalPaginas) {
    const corpo = await json(
      `/works/${encodeURIComponent(slug)}/chapters` +
        `?page=${pagina}&limit=${CAPS_POR_PAGINA}`
    );
    for (const cap of corpo.data || []) {
      if (cap.number == null) continue;
      // A API manda 1190 ou 1190.5; String() já descarta o ".0" de inteiros.
      const numero = String(cap.number);
      caps.push({
        id: `${slug}/${numero}`,
        numero,
        titulo: cap.title || "",
        paginas: 0, // a lista não traz a contagem de páginas
        idioma: "pt-br",
      });
    }
    totalPaginas = corpo.meta?.totalPages || 1;
    pagina += 1;
  }

  // A API devolve do mais novo para o mais antigo; ordena crescente.
  caps.sort(
    (a, b) =>
      (parseFloat(a.numero) || Infinity) - (parseFloat(b.numero) || Infinity)
  );
  return caps;
}

export function obterUrlWeb(capituloId) {
  const [slug, numero] = partesDoId(capituloId);
  if (!slug) return "https://mugiwarasoficial.org";
  if (!numero) return `https://mugiwarasoficial.org/obra/${slug}`;
  return `https://mugiwarasoficial.org/obra/${slug}/capitulo/${numero}`;
}

function tentarDecodificarBase64Url(str) {
  if (typeof str !== "string") return str;
  const s = str.trim();
  if (/^https?:\/\//i.test(s)) return s;
  try {
    let b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const bytes = base64ParaBytes(b64);
    if (bytes && bytes.length > 0) {
      let dec = "";
      for (let i = 0; i < bytes.length; i++) {
        dec += String.fromCharCode(bytes[i]);
      }
      if (dec && (/^https?:\/\//i.test(dec) || dec.includes("/") || dec.includes("."))) {
        return dec;
      }
    }
  } catch (e) {}
  return s;
}


// Páginas de um capítulo.
//
// O site Mugiwaras protege as imagens do leitor na API (retornando tokens de acesso),
// exigindo a exibição via navegador ou leitor integrado.
export async function obterPaginas(capituloId) {
  const [slug, numero] = partesDoId(capituloId);
  if (!slug || !numero) {
    throw new Error(
      `Mugiwaras: id de capítulo inválido: ${capituloId} (esperado 'slug/numero')`
    );
  }

  let paginas = [];
  try {
    const corpo = await json(
      `/works/${encodeURIComponent(slug)}/chapters/` +
        `${encodeURIComponent(numero)}/pages`
    );
    paginas = corpo.data?.pages || [];
  } catch (e) {
    throw new Error(`Mugiwaras: falha ao consultar capítulo (${e.message})`);
  }

  // Filtra apenas URLs diretas e válidas de imagens (http/https)
  const urls = paginas
    .map((p) => (typeof p === "object" && p ? p.imageUrl : null))
    .filter((u) => u && /^https?:\/\//i.test(u));

  if (!urls.length) {
    throw new Error(
      "O Mugiwaras exige visualização diretamente no site oficial para este capítulo."
    );
  }
  return urls;
}





