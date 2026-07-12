// src/fliptru.js — scraper do fliptru.com.br rodando NO CELULAR.
//
// O Fliptru é uma plataforma BRASILEIRA de quadrinhos/mangás independentes
// (autores publicam suas obras; algumas à venda por "coins"). Fica atrás do
// Cloudflare, que aceita requisições de navegador/celular — então o app
// escrapeia direto, como o Mugiwaras. As páginas de cada capítulo são .webp
// num CDN aberto (media.fliptru.com.br), e o download converte pra PDF como
// nos outros sites de mangá.
//
// Fluxo:
//   busca:      GET /search/?term=<t>  -> JSON [{label, url:/comic/<slug>/info}]
//   capítulos:  GET /comic/<slug>/chapters?order=asc&page=N (HTML, paginado)
//   páginas:    GET /comic/<slug>/<numero>  -> URLs .webp do capítulo no HTML
// O id do mangá é o slug; o id do capítulo é a URL de leitura.

const BASE = "https://fliptru.com.br";
const UA =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/126.0 Mobile Safari/537.36";

// Teto de páginas da lista de capítulos (obras têm poucos capítulos; um limite
// evita laço infinito se a paginação vier quebrada).
const MAX_PAGINAS_CAP = 40;

function decodeHtml(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function texto(url, opcoes = {}) {
  const resp = await fetch(url, {
    headers: { "User-Agent": UA },
    ...opcoes,
  });
  if (!resp.ok) throw new Error(`Fliptru: erro ${resp.status}`);
  return resp.text();
}

// Busca: /search/?term= devolve um JSON de sugestões cujo label é
// "Título - @autor" e a url é /comic/<slug>/info (ou links de categoria, que
// ignoramos). Deriva o slug e um título limpo (sem o "- @autor").
export async function buscarManga(nome) {
  const resp = await fetch(
    `${BASE}/search/?term=${encodeURIComponent(nome)}&page=1`,
    {
      headers: {
        "User-Agent": UA,
        "X-Requested-With": "XMLHttpRequest",
        Referer: `${BASE}/`,
      },
    }
  );
  if (!resp.ok) throw new Error(`Fliptru: erro ${resp.status}`);
  const itens = await resp.json();

  const resultados = [];
  const vistos = new Set();
  for (const item of Array.isArray(itens) ? itens : []) {
    const url = item?.url || "";
    const m = url.match(/^\/comic\/([^/?#]+)\/info/);
    if (!m) continue; // categorias/tags e outros links não são obras
    const slug = m[1];
    if (vistos.has(slug)) continue;
    vistos.add(slug);
    const rotulo = decodeHtml(String(item.label || ""));
    const titulo = rotulo.replace(/\s*-\s*@[^\s-].*$/, "").trim() || slug;
    resultados.push({
      id: slug,
      titulo,
      imagem: "", // a capa vem quando abrimos os capítulos (info page)
      sinopse: "",
    });
  }
  return resultados;
}

// Extrai (numero, url) dos capítulos de um bloco de HTML da lista.
function capitulosDoHtml(html, slug) {
  const eps = [];
  const re = new RegExp(
    `href="(/comic/${slug}/([^"?/]+)[^"]*)"[^>]*>\\s*([^<]*)`,
    "g"
  );
  let m;
  while ((m = re.exec(html))) {
    const numero = m[2];
    // A âncora do capítulo tem um rótulo tipo "001 - Capítulo 01".
    const rotulo = decodeHtml(m[3]).trim();
    eps.push({
      id: `${BASE}${m[1].replace(/&amp;/g, "&")}`,
      numero,
      titulo: rotulo && rotulo !== numero ? rotulo : "",
    });
  }
  return eps;
}

// Capítulos: a lista vem de /comic/<slug>/chapters (HTML), paginada. Segue as
// páginas até uma não trazer novidade. idioma é ignorado (o site é só pt-br).
export async function listarCapitulos(slug) {
  const todos = [];
  const vistos = new Set();

  for (let p = 1; p <= MAX_PAGINAS_CAP; p++) {
    let html;
    try {
      html = await texto(
        `${BASE}/comic/${slug}/chapters?order=asc&page=${p}`,
        { headers: { "User-Agent": UA, "X-Requested-With": "XMLHttpRequest" } }
      );
    } catch {
      break;
    }
    let novos = 0;
    for (const cap of capitulosDoHtml(html, slug)) {
      if (vistos.has(cap.id)) continue;
      vistos.add(cap.id);
      todos.push({ ...cap, paginas: 0, idioma: "pt-br" });
      novos++;
    }
    if (novos === 0) break; // página sem capítulo novo: acabou
  }

  // Ordena crescente por número (aceita "1", "001", "1.5"). NaN (nomes não
  // numéricos) vai para o fim.
  const ordem = (n) => {
    const v = parseFloat(n);
    return Number.isNaN(v) ? Infinity : v;
  };
  todos.sort((a, b) => ordem(a.numero) - ordem(b.numero));
  return todos;
}

// Páginas: a página de leitura /comic/<slug>/<numero> traz as URLs .webp das
// páginas do capítulo. capUrl é o id do capítulo (a URL de leitura).
//
// As páginas reais ficam em /media/comic/<slug>/<dir-do-capitulo>/<pagina> —
// TRÊS níveis, com o slug da obra. A página do leitor também traz thumbnails
// de OUTRAS obras recomendadas, em /media/comic/<outra-obra>/<capa> (dois
// níveis): filtramos pelo slug e por profundidade para pegar só as páginas.
export async function obterPaginas(capUrl) {
  const html = await texto(capUrl);

  const slugM = capUrl.match(/\/comic\/([^/?#]+)\//);
  const slug = slugM ? slugM[1] : "";

  const brutas = [
    ...html.matchAll(
      /https:\/\/media\.fliptru\.com\.br\/media\/comic\/([^\s"')]+?\.(?:webp|png|jpe?g))/gi
    ),
  ].map((m) => m[1]); // o caminho depois de /media/comic/

  const paginas = [];
  const vistos = new Set();
  for (const caminho of brutas) {
    const partes = caminho.split("/");
    // Página do capítulo: <slug>/<dir>/<arquivo> e pertence a esta obra.
    if (partes.length < 3 || partes[0] !== slug) continue;
    const url = `https://media.fliptru.com.br/media/comic/${caminho}`;
    if (vistos.has(url)) continue;
    vistos.add(url);
    paginas.push(url);
  }
  return paginas;
}
