// src/animesdigital.js — scraper do animesdigital.org rodando NO CELULAR.
//
// O site fica atrás do Cloudflare, que devolve 403 para IPs de datacenter
// (o Render, onde a API vive) mas aceita IPs residenciais/móveis. Então o
// app escrapeia a busca, os episódios e o stream direto no celular — como o
// Mugiwaras e o SushiAnimes.
//
// Fluxo: busca em /?s=<termo> (cards .itemA) → página do anime lista os
// episódios paginados (/anime/b/<slug>/page/N/, 50 por página, do mais novo
// ao mais antigo) → a página /video/a/<id>/ traz um iframe do api.anivideo.net
// com a URL do .m3u8 (HLS) embutida. Os segmentos vêm com extensão .webp mas
// são MPEG-TS de verdade, então tocam e baixam como qualquer HLS.

const BASE = "https://animesdigital.org";
const UA =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/126.0 Mobile Safari/537.36";

// Quantas páginas de episódios buscar no máximo (50 por página). One Piece
// tem ~24; um teto evita um laço infinito se a paginação vier quebrada.
const MAX_PAGINAS = 60;

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
  if (!resp.ok) throw new Error(`AnimesDigital: erro ${resp.status}`);
  return resp.text();
}

// Busca: cada resultado é um <div class="itemA"> com o link do anime, a capa
// e o título em .title_anime. A busca pode repetir o mesmo anime, então
// deduplicamos por link.
export async function buscarAnime(nome) {
  const html = await texto(`${BASE}/?s=${encodeURIComponent(nome)}`);

  const resultados = [];
  const vistos = new Set();
  const re =
    /<a href="(https:\/\/animesdigital\.org\/anime\/a\/[^"]+)"[^>]*>[\s\S]*?<img src="([^"]+)"[\s\S]*?<span class="title_anime">([^<]+)<\/span>/g;
  let m;
  while ((m = re.exec(html))) {
    const link = m[1];
    if (vistos.has(link)) continue;
    vistos.add(link);
    const bruto = decodeHtml(m[3]).trim();
    // O site marca o áudio no próprio título ("... Dublado").
    const dublado = /dublado/i.test(bruto);
    const audio = dublado ? "Dublado" : "";
    const titulo = bruto.replace(/\s*\(?Dublado\)?\s*$/i, "").trim();
    resultados.push({
      titulo,
      url_detalhes: link,
      audio,
      imagem: m[2],
      ano: "",
      sinopse: "",
    });
  }
  return resultados;
}

// Extrai os episódios de uma página (HTML), como { url_pagina, numero }.
function episodiosDaPagina(html) {
  const eps = [];
  const re =
    /<a href="(https:\/\/animesdigital\.org\/video\/[^"]+)"[\s\S]*?<div class="title_anime">([^<]+)<\/div>/g;
  let m;
  while ((m = re.exec(html))) {
    const rotulo = decodeHtml(m[2]).trim();
    const num = rotulo.match(/(\d+(?:\.\d+)?)\s*$/);
    eps.push({
      titulo: rotulo || "Episódio",
      url_pagina: m[1],
      numero: num ? num[1] : "",
    });
  }
  return eps;
}

// Episódios: a página do anime já traz a primeira página da lista e o slug
// base da paginação (/anime/b/<slug>/). Segue as páginas seguintes até uma
// vir vazia (ou repetir a última já vista) e junta tudo.
export async function listarEpisodios(urlAnime) {
  const html = await texto(urlAnime);

  const todos = [];
  const vistos = new Set();
  const adicionar = (lista) => {
    for (const ep of lista) {
      if (vistos.has(ep.url_pagina)) continue;
      vistos.add(ep.url_pagina);
      todos.push(ep);
    }
  };

  adicionar(episodiosDaPagina(html));

  const slugM = html.match(/\/anime\/b\/([a-z0-9-]+)\//i);
  if (slugM) {
    const slug = slugM[1];
    // Descobre a última página pelos links de paginação (pega o maior N).
    const nums = [...html.matchAll(/\/anime\/b\/[a-z0-9-]+\/page\/(\d+)\//g)]
      .map((x) => parseInt(x[1], 10))
      .filter((n) => n > 0);
    const ultima = Math.min(nums.length ? Math.max(...nums) : 1, MAX_PAGINAS);

    for (let p = 2; p <= ultima; p++) {
      let htmlPag;
      try {
        htmlPag = await texto(`${BASE}/anime/b/${slug}/page/${p}/`);
      } catch {
        break; // uma página que falha não deve derrubar a lista inteira
      }
      const antes = todos.length;
      adicionar(episodiosDaPagina(htmlPag));
      if (todos.length === antes) break; // página sem novidade: acabou
    }
  }

  if (todos.length === 0) {
    // Filmes / OVAs sem lista: a própria página é o "episódio".
    todos.push({ titulo: "Filme completo", url_pagina: urlAnime, numero: "1" });
  }

  // Ordena crescente. Cuidado: parseFloat("00") é 0 (falsy), então NÃO se pode
  // usar `|| Infinity` para o fallback — isso jogaria o episódio 0 (prólogos
  // como o de One Piece) para o fim. Só um número inválido (NaN) vai ao fim.
  const ordem = (n) => {
    const v = parseFloat(n);
    return Number.isNaN(v) ? Infinity : v;
  };
  todos.sort((a, b) => ordem(a.numero) - ordem(b.numero));
  return todos;
}

// Vídeo: a página /video/a/<id>/ traz um iframe do api.anivideo.net com a URL
// do .m3u8 no parâmetro ?d=. Retorna o mesmo formato do /extrair-video da API:
// { url_video, url_player, is_hls }. O HLS toca direto (CDN aberto, sem proxy).
export async function extrairVideo(urlEpisodio) {
  const html = await texto(urlEpisodio);

  // A URL do stream aparece como .../videohls.php?d=<m3u8> ou solta no HTML.
  const m =
    html.match(/videohls\.php\?d=(https?:\/\/[^\s"'&<>]+\.m3u8[^\s"'&<>]*)/i) ||
    html.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
  if (!m) {
    throw new Error("Nenhum vídeo disponível para este episódio.");
  }
  const urlVideo = decodeHtml(m[1]);
  return { url_video: urlVideo, url_player: urlVideo, is_hls: true };
}
