// src/animesonline.js — scraper do animesonline.cloud rodando NO CELULAR.
//
// O site oferece episódios com streams diretos de MP4 e HLS (em servidores
// como mangas.cloud e animeflix.blog). Rodar o scraper diretamente no celular
// elimina a dependência do backend no Render (que hiberna e bloqueia vídeos).

const BASE = "https://animesonline.cloud";
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
    headers: {
      "User-Agent": UA,
      Referer: `${BASE}/`,
    },
    ...opcoes,
  });
  if (!resp.ok) throw new Error(`AnimesOnline: erro ${resp.status}`);
  return resp.text();
}

// Busca: resultados vêm em tags <article> com link do anime, capa e título.
export async function buscarAnime(nome) {
  const html = await texto(`${BASE}/?s=${encodeURIComponent(nome)}`);
  const resultados = [];
  const vistos = new Set();

  const re =
    /<article[^>]*>[\s\S]*?<div class="image">[\s\S]*?<a href="([^"]+)">[\s\S]*?<img src="([^"]+)" alt="([^"]*)"[\s\S]*?<div class="title"><a href="[^"]*">([^<]+)<\/a>[\s\S]*?<\/article>/g;
  let m;
  while ((m = re.exec(html))) {
    const link = m[1];
    if (vistos.has(link)) continue;
    vistos.add(link);

    const bruto = decodeHtml(m[4]).trim();
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

// Lista os episódios de uma página de anime.
export async function listarEpisodios(urlAnime) {
  const html = await texto(urlAnime);
  const episodios = [];
  const vistos = new Set();

  // Padrão 1: cards modernos (.episode-card com data-episode-number e data-episode-title)
  const reCard =
    /<div class=['"]episode-card['"][^>]*data-episode-number=['"]([^'"]+)['"][^>]*data-episode-title=['"]([^'"]+)['"][\s\S]*?<a href=['"]([^'"]+)['"]/g;
  let m;
  while ((m = reCard.exec(html))) {
    const link = m[3];
    if (vistos.has(link)) continue;
    vistos.add(link);

    const num = m[1];
    episodios.push({
      numero: num,
      titulo: decodeHtml(m[2]).trim() || `Episódio ${num}`,
      url_pagina: link,
    });
  }

  // Padrão 2: layout clássico dooplay (.episodios li com .episodiotitle)
  if (episodios.length === 0) {
    const reDooplay =
      /<li[^>]*class=['"][^'"]*mark-\d+[^'"]*['"][^>]*>[\s\S]*?<div class=['"]numerando['"]>([^<]+)<\/div>[\s\S]*?<div class=['"]episodiotitle['"]>\s*<a href=['"]([^'"]+)['"]>([^<]+)<\/a>/g;
    while ((m = reDooplay.exec(html))) {
      const link = m[2];
      if (vistos.has(link)) continue;
      vistos.add(link);

      const numStr = m[1].replace(/.*-\s*/, "").trim();
      episodios.push({
        numero: numStr,
        titulo: decodeHtml(m[3]).trim() || `Episódio ${numStr}`,
        url_pagina: link,
      });
    }
  }

  // Padrão 3: links diretos contendo /episodio/
  if (episodios.length === 0) {
    const reLinks = /href=['"](https:\/\/animesonline\.cloud\/episodio\/[^'"]+)['"]/g;
    while ((m = reLinks.exec(html))) {
      const link = m[1];
      if (vistos.has(link)) continue;
      vistos.add(link);

      const numM = link.match(/episodio-(\d+(?:\.\d+)?)/);
      const numero = numM ? numM[1] : "";
      episodios.push({
        titulo: `Episódio ${numero}`,
        url_pagina: link,
        numero,
      });
    }
  }

  if (episodios.length === 0) {
    // Filmes / OVAs sem lista: a própria página é o "episódio".
    episodios.push({ titulo: "Filme completo", url_pagina: urlAnime, numero: "1" });
  }

  episodios.sort(
    (a, b) =>
      (parseFloat(a.numero) || Infinity) - (parseFloat(b.numero) || Infinity)
  );

  return episodios;
}

// Extrai a URL do vídeo (.mp4 ou .m3u8) da página do episódio.
export async function extrairVideo(urlEpisodio) {
  const html = await texto(urlEpisodio);

  // 1. URL de vídeo direta no HTML
  const streamM =
    html.match(/https?:\/\/[^\s"'<>\\]+\.m3u8[^\s"'<>\\]*/) ||
    html.match(/https?:\/\/[^\s"'<>\\]+\.mp4[^\s"'<>\\]*/);

  if (streamM) {
    const url = decodeHtml(streamM[0]);
    const is_hls = url.includes(".m3u8");
    return {
      url_video: url,
      url_player: url,
      is_hls,
      headers: { Referer: `${BASE}/` },
    };
  }

  throw new Error("Nenhum vídeo compatível encontrado para este episódio.");
}
