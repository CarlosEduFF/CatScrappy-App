// src/mugiwaras.js — scraper do mugiwarasoficial.com rodando NO CELULAR.
//
// O site fica atrás do Cloudflare, que devolve 403 para IPs de datacenter
// (o Render, onde a API vive) mas aceita IPs residenciais/móveis. Então o
// app escrapeia o site diretamente. Tema WordPress Madara: busca via ?s=,
// capítulos via POST .../ajax/chapters/, e as páginas ficam num CDN aberto
// (cdn.mugiverso.com) em page_001.webp, page_002.webp, ... — a página do
// capítulo só expõe a primeira, e o total é descoberto com HEADs (busca
// binária, ~10 requisições).

const BASE = "https://mugiwarasoficial.com";
const UA =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/126.0 Mobile Safari/537.36";

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
  if (!resp.ok) throw new Error(`Mugiwaras: erro ${resp.status}`);
  return resp.text();
}

async function existe(url) {
  try {
    const resp = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": UA },
    });
    return resp.ok;
  } catch {
    return false;
  }
}

// Busca: mesmos campos que a API devolve ({ id, titulo, imagem, sinopse }).
// O id é a própria URL do mangá.
export async function buscarManga(nome) {
  const html = await texto(
    `${BASE}/?s=${encodeURIComponent(nome)}&post_type=wp-manga`
  );
  const resultados = [];
  for (const bloco of html.split("c-tabs-item__content").slice(1)) {
    const t = bloco.match(
      /<div class="post-title">\s*<h3[^>]*>\s*<a href="([^"]+)">([^<]+)<\/a>/
    );
    if (!t) continue;
    const img = bloco.match(/<img[^>]+(?:data-src|src)="([^"]+)"/);
    resultados.push({
      id: t[1],
      titulo: decodeHtml(t[2].trim()),
      imagem: img ? img[1] : "",
      sinopse: "", // o Madara não traz sinopse na busca
    });
  }
  return resultados;
}

// Capítulos (o site é só pt-br). O id de cada capítulo é a URL dele.
export async function listarCapitulos(mangaUrl) {
  const corpo = await texto(mangaUrl.replace(/\/+$/, "") + "/ajax/chapters/", {
    method: "POST",
  });
  const caps = [];
  const re = /<li class="wp-manga-chapter[^"]*">\s*<a href="([^"]+)">\s*([^<]+)/g;
  let m;
  while ((m = re.exec(corpo))) {
    const rotulo = decodeHtml(m[2].trim());
    const num =
      rotulo.match(/(\d+(?:\.\d+)?)/) || m[1].match(/(\d+(?:-\d+)?)\/?$/);
    caps.push({
      id: m[1],
      numero: num ? num[1] : "?",
      titulo: "",
      paginas: 0, // o Madara não expõe a contagem na lista
      idioma: "pt-br",
    });
  }
  // O ajax devolve do mais novo para o mais antigo; ordena crescente.
  caps.sort(
    (a, b) =>
      (parseFloat(a.numero) || Infinity) - (parseFloat(b.numero) || Infinity)
  );
  return caps;
}

// Páginas de um capítulo: descobre a base no CDN e a última página por HEADs.
// O nome do arquivo varia com a idade do capítulo: os novos usam
// page_001.webp e os antigos 001.webp — o prefixo, o zero-padding e a
// extensão são deduzidos do exemplo encontrado no HTML.
export async function obterPaginas(capUrl) {
  const html = await texto(capUrl);

  const m = html.match(
    /https:\/\/cdn\.mugiverso\.com\/mugiwarasoficial\/(manga_[a-z0-9]+)\/([a-f0-9]+)\/((?:page_)?)(\d+)\.(webp|jpe?g|png)/i
  );
  if (!m) {
    // Fallback: capítulos podem ter as <img> direto no HTML.
    return [...html.matchAll(
      /<img[^>]+class="wp-manga-chapter-img[^"]*"[^>]*(?:data-src|src)="\s*([^"]+?)\s*"/g
    )].map((x) => x[1]);
  }

  const base = `https://cdn.mugiverso.com/mugiwarasoficial/${m[1]}/${m[2]}`;
  const prefixo = m[3];
  const digitos = m[4].length;
  const ext = m[5];
  const pagina = (n) =>
    `${base}/${prefixo}${String(n).padStart(digitos, "0")}.${ext}`;

  let lo = 1;
  let hi = 32;
  while ((await existe(pagina(hi))) && hi < 1024) {
    lo = hi;
    hi *= 2;
  }
  while (lo + 1 < hi) {
    const meio = Math.floor((lo + hi) / 2);
    if (await existe(pagina(meio))) lo = meio;
    else hi = meio;
  }

  return Array.from({ length: lo }, (_, i) => pagina(i + 1));
}
