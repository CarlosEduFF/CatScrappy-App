// src/topanimes.js — scraper do topanimes.net rodando NO CELULAR.
//
// O site utiliza players integrados via CDN (alibabacdn) com suporte a HLS (.m3u8)
// em múltiplas qualidades (1080p, 720p). Ao rodar localmente no celular, contorna
// o bloqueio que ocorria no backend.

const BASE = "https://topanimes.net";
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
  if (!resp.ok) throw new Error(`TopAnimes: erro ${resp.status}`);
  return resp.text();
}

// Busca por nome de anime.
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

// Lista os episódios do anime.
export async function listarEpisodios(urlAnime) {
  const html = await texto(urlAnime);
  const episodios = [];
  const vistos = new Set();

  // Padrão 1: links com title e href para /episodio/
  const reA =
    /<a[^>]+href=['"](https:\/\/topanimes\.net\/episodio\/[^'"]+)['"][^>]*title=['"]([^'"]+)['"]/g;
  let m;
  while ((m = reA.exec(html))) {
    const link = m[1];
    if (vistos.has(link)) continue;
    vistos.add(link);

    const titulo = decodeHtml(m[2]).trim();
    const numM =
      link.match(/episodio-(\d+(?:\.\d+)?)/) || titulo.match(/(\d+(?:\.\d+)?)/);
    const numero = numM ? numM[1] : "";

    episodios.push({
      titulo: titulo.replace(/\s*Online$/i, "").trim() || `Episódio ${numero}`,
      url_pagina: link,
      numero,
    });
  }

  // Padrão 2: <a title=... href=...
  if (episodios.length === 0) {
    const reB =
      /<a[^>]+title=['"]([^'"]+)['"][^>]*href=['"](https:\/\/topanimes\.net\/episodio\/[^'"]+)['"]/g;
    while ((m = reB.exec(html))) {
      const link = m[2];
      if (vistos.has(link)) continue;
      vistos.add(link);

      const titulo = decodeHtml(m[1]).trim();
      const numM =
        link.match(/episodio-(\d+(?:\.\d+)?)/) || titulo.match(/(\d+(?:\.\d+)?)/);
      const numero = numM ? numM[1] : "";

      episodios.push({
        titulo: titulo.replace(/\s*Online$/i, "").trim() || `Episódio ${numero}`,
        url_pagina: link,
        numero,
      });
    }
  }

  // Padrão 3: .episodiotitle
  if (episodios.length === 0) {
    const reEpTitle =
      /<div class=['"]episodiotitle['"]>\s*<a href=['"]([^'"]+)['"]>([^<]+)<\/a>/g;
    while ((m = reEpTitle.exec(html))) {
      const link = m[1];
      if (vistos.has(link)) continue;
      vistos.add(link);

      const rotulo = decodeHtml(m[2]).trim();
      const numM =
        link.match(/episodio-(\d+(?:\.\d+)?)/) || rotulo.match(/(\d+(?:\.\d+)?)/);
      const numero = numM ? numM[1] : "";

      episodios.push({
        numero,
        titulo: rotulo || `Episódio ${numero}`,
        url_pagina: link,
      });
    }
  }

  // Padrão 4: links genéricos para /episodio/
  if (episodios.length === 0) {
    const reLinks = /href=['"](https:\/\/topanimes\.net\/episodio\/[^'"]+)['"]/g;
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
    // Filmes / OVAs sem lista
    episodios.push({ titulo: "Filme completo", url_pagina: urlAnime, numero: "1" });
  }

  episodios.sort(
    (a, b) =>
      (parseFloat(a.numero) || Infinity) - (parseFloat(b.numero) || Infinity)
  );

  return episodios;
}

// Extrai o vídeo do episódio (HLS ou MP4).
export async function extrairVideo(urlEpisodio) {
  const html = await texto(urlEpisodio);

  // 1. Procurar iframes
  const iframes = [...html.matchAll(/<iframe[^>]*src=['"]([^'"]+)['"]/g)].map(
    (x) => x[1]
  );

  for (const iframeUrl of iframes) {
    // Caso A: alibabacdn (sk-api.alibabacdn.net / sk-ru.alibabacdn.net)
    if (iframeUrl.includes("alibabacdn.net")) {
      try {
        const u = new URL(iframeUrl);
        u.searchParams.set("mode", "to-salvando-seu-ip");
        const resp = await fetch(u.toString(), {
          headers: { "User-Agent": UA, Referer: iframeUrl },
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.status === "success" && data.midias && data.midias.length > 0) {
            // Prioriza qualidade mais alta: 1080p > 720p > HD > SD > LD > FD
            const ordem = ["1080", "720", "HD", "SD", "LD", "FD"];
            const midia =
              data.midias.find((m) =>
                ordem.some((q) => (m.qualidade || "").includes(q))
              ) || data.midias[0];

            return {
              url_video: midia.url,
              url_player: midia.url,
              is_hls: midia.url.includes(".m3u8"),
            };
          }
        }
      } catch (_) {}

      // Se contiver parâmetro id com URL de mídia
      try {
        const idParam = new URL(iframeUrl).searchParams.get("id");
        if (idParam && (idParam.includes(".m3u8") || idParam.includes(".mp4"))) {
          const streamUrl = idParam.startsWith("http")
            ? idParam
            : `https://topanimes.net/${idParam.replace(/^\/+/, "")}`;
          return {
            url_video: streamUrl,
            url_player: streamUrl,
            is_hls: streamUrl.includes(".m3u8"),
          };
        }
      } catch (_) {}
    }

    // Caso B: Stream embutido na URL do iframe
    const streamParamM = iframeUrl.match(
      /https?:\/\/[^\s"'<>\\]+\.(?:m3u8|mp4)[^\s"'<>\\]*/
    );
    if (streamParamM) {
      const u = decodeHtml(streamParamM[0]);
      return {
        url_video: u,
        url_player: u,
        is_hls: u.includes(".m3u8"),
      };
    }
  }

  // 2. Stream direto no HTML
  const diretoM =
    html.match(/https?:\/\/[^\s"'<>\\]+\.m3u8[^\s"'<>\\]*/) ||
    html.match(/https?:\/\/[^\s"'<>\\]+\.mp4[^\s"'<>\\]*/);

  if (diretoM) {
    const u = decodeHtml(diretoM[0]);
    return {
      url_video: u,
      url_player: u,
      is_hls: u.includes(".m3u8"),
    };
  }

  throw new Error("Nenhum vídeo disponível para este episódio.");
}
