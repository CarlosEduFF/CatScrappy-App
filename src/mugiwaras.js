// src/mugiwaras.js — mugiwarasoficial.com consumido NO CELULAR.
//
// O site fica atrás do Cloudflare, que devolve 403 para IPs de datacenter
// (o Render, onde a API vive) mas aceita IPs residenciais/móveis — por isso
// o app fala com o site direto, sem passar pela API do CatScrappy.
//
// O site foi reescrito em Next.js e não é mais WordPress/Madara: em vez de
// raspar HTML, hoje se consome a API JSON pública em app.mugiwarasoficial.com
// (namespace /v1/www, que não pede autenticação — só as rotas de conta
// logada, como /v1/www/library, devolvem 401).
//
// O id de um mangá é o slug; o de um capítulo é "slug/numero", para que
// obterPaginas() monte a URL sozinho.

const BASE = "https://mugiwarasoficial.com";
const API = "https://app.mugiwarasoficial.com/v1/www";
const UA =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/126.0 Mobile Safari/537.36";

// A API devolve capítulos do mais novo para o mais antigo, paginados; 200 por
// página é o suficiente para trazer obras longas em poucas idas.
const CAPS_POR_PAGINA = 200;

async function json(caminho) {
  const resp = await fetch(`${API}${caminho}`, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      // A API é aberta, mas o Cloudflare na frente dela é mais tolerante
      // quando a requisição parece vir do próprio site.
      Origin: BASE,
      Referer: `${BASE}/`,
    },
  });
  if (!resp.ok) throw new Error(`Mugiwaras: erro ${resp.status}`);
  return resp.json();
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

// Páginas de um capítulo. As URLs vêm assinadas (?sig=&exp=) com validade de
// ~9h, então a leitura e o download precisam acontecer na mesma sessão — não
// dá para guardar o link e reusar depois.
export async function obterPaginas(capituloId) {
  const [slug, numero] = partesDoId(capituloId);
  if (!slug || !numero) {
    throw new Error(
      `Mugiwaras: id de capítulo inválido: ${capituloId} (esperado 'slug/numero')`
    );
  }
  const corpo = await json(
    `/works/${encodeURIComponent(slug)}/chapters/` +
      `${encodeURIComponent(numero)}/pages`
  );
  return (corpo.data?.pages || [])
    .map((p) => p.imageUrl)
    .filter(Boolean);
}
