// src/sushianimes.js — scraper do sushianimes.com.br rodando NO CELULAR.
//
// O site fica atrás do Cloudflare, que devolve 403 para IPs de datacenter
// (o Render, onde a API vive) mas aceita IPs residenciais/móveis. Então o
// app escrapeia a busca, os episódios e o stream direto no celular. O vídeo
// é HLS (.m3u8) e toca direto no player, sem precisar do /proxy.

const BASE = "https://sushianimes.com.br";
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
  if (!resp.ok) throw new Error(`SushiAnimes: erro ${resp.status}`);
  return resp.text();
}

// Busca: cards .list-media (link + capa) seguidos de .list-title (título com
// o áudio entre parênteses). A busca repete o mesmo anime em blocos, então
// deduplicamos por link.
export async function buscarAnime(nome) {
  const html = await texto(`${BASE}/search/${encodeURIComponent(nome)}`);

  const resultados = [];
  const vistos = new Set();
  const re =
    /<a href="([^"]+)" class="list-media">[\s\S]*?data-src="([^"]+)"[\s\S]*?<a href="[^"]+" class="list-title">([^<]+)<\/a>/g;
  let m;
  while ((m = re.exec(html))) {
    const link = m[1];
    if (vistos.has(link)) continue;
    vistos.add(link);
    const bruto = decodeHtml(m[3]).trim();
    const audioM = bruto.match(/\((Dublado|Legendado)\)/);
    const audio = audioM ? audioM[1] : "";
    const titulo = bruto.replace(/\s*\((?:Dublado|Legendado)\)/, "").trim();
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

// Episódios: links .../-season-<n>-episode na página do anime, com o número
// no aria-label ("Assistir episódio N ...").
export async function listarEpisodios(urlAnime) {
  const html = await texto(urlAnime);

  const episodios = [];
  const baseEsc = BASE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `<a href="(${baseEsc}/anime/[^"]*-season-\\d+-episode)"[^>]*aria-label="Assistir epis[^"]*?(\\d+)[^"]*"`,
    "g"
  );
  let m;
  while ((m = re.exec(html))) {
    episodios.push({
      titulo: `Episódio ${m[2]}`,
      url_pagina: m[1],
      numero: m[2],
    });
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

// Pega a URL do stream (HLS/mp4) no HTML do jwplayer. Para no primeiro
// caractere que não pode fazer parte da URL, senão captura o JS que vem
// logo depois (ex.: '";var ...').
function extrairStream(corpo) {
  const m =
    corpo.match(/https?:\/\/[^\s"'<>\\);]+\.m3u8[^\s"'<>\\);]*/) ||
    corpo.match(/https?:\/\/[^\s"'<>\\);]+\.mp4[^\s"'<>\\);]*/);
  return m ? m[0] : null;
}

// Vídeo: cada botão de player traz um data-embed=<id>; um POST em /ajax/embed
// devolve o HTML do jwplayer, de onde sai o stream HLS. Retorna o mesmo
// formato do /extrair-video da API: { url_video, url_player, is_hls }.
export async function extrairVideo(urlEpisodio) {
  const html = await texto(urlEpisodio);

  const ids = [...html.matchAll(/data-embed="(\d+)"/g)].map((x) => x[1]);
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) {
    throw new Error("Nenhum vídeo disponível para este episódio.");
  }

  for (const embedId of unicos) {
    let corpo = null;
    for (let i = 0; i < 3; i++) {
      try {
        const resp = await fetch(`${BASE}/ajax/embed`, {
          method: "POST",
          headers: {
            "User-Agent": UA,
            "X-Requested-With": "XMLHttpRequest",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            Referer: urlEpisodio,
          },
          body: `id=${encodeURIComponent(embedId)}`,
        });
        if (resp.ok) {
          corpo = await resp.text();
          break;
        }
      } catch {
        // tenta de novo
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!corpo) continue;

    const urlVideo = extrairStream(corpo);
    if (urlVideo) {
      const isHls = urlVideo.split("?")[0].endsWith(".m3u8");
      // HLS toca direto; mp4 (raro aqui) também vem de CDN aberto.
      return { url_video: urlVideo, url_player: urlVideo, is_hls: isHls };
    }
  }

  throw new Error("Nenhum vídeo disponível para este episódio.");
}
