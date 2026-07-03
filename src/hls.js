// src/hls.js — leitura de playlists HLS (.m3u8) para download de episódios.
//
// Um HLS é uma playlist de segmentos curtos de vídeo. Segmentos MPEG-TS
// podem ser concatenados diretamente num único arquivo .ts reproduzível
// (VLC e a maioria dos players Android tocam). Para fMP4 (#EXT-X-MAP),
// concatenar init + segmentos produz um .mp4 fragmentado igualmente válido.

// Resolve uma URL relativa contra a URL da playlist. Hermes não implementa
// new URL(rel, base), então resolvemos manualmente.
export function resolverUrl(base, rel) {
  if (/^https?:\/\//i.test(rel)) return rel;
  if (rel.startsWith("//")) return base.split("//")[0] + rel;
  const semQuery = base.split("?")[0];
  if (rel.startsWith("/")) {
    const origem = semQuery.match(/^https?:\/\/[^/]+/);
    if (!origem) throw new Error("URL base inválida: " + base);
    return origem[0] + rel;
  }
  return semQuery.slice(0, semQuery.lastIndexOf("/") + 1) + rel;
}

// Interpreta o texto de um .m3u8. Retorna:
//   { tipo: "master", variantes: [{ url, banda }] }  ou
//   { tipo: "media", segmentos: [url], init: url|null }
// Lança erro para recursos que não suportamos (AES, byte-range).
export function lerPlaylist(texto) {
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!linhas.length || !linhas[0].startsWith("#EXTM3U")) {
    throw new Error("Resposta não é uma playlist HLS válida.");
  }

  const variantes = [];
  const segmentos = [];
  let init = null;
  let bandaPendente = 0;

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];

    if (linha.startsWith("#EXT-X-KEY")) {
      const metodo = /METHOD=([^,]+)/.exec(linha)?.[1];
      if (metodo && metodo !== "NONE") {
        throw new Error(
          "Stream criptografado (" + metodo + ") — download não suportado."
        );
      }
    } else if (linha.startsWith("#EXT-X-BYTERANGE")) {
      throw new Error("Stream com byte-range — download não suportado.");
    } else if (linha.startsWith("#EXT-X-MAP")) {
      init = /URI="([^"]+)"/.exec(linha)?.[1] ?? null;
    } else if (linha.startsWith("#EXT-X-STREAM-INF")) {
      bandaPendente = Number(/BANDWIDTH=(\d+)/.exec(linha)?.[1] ?? 0);
    } else if (!linha.startsWith("#")) {
      if (bandaPendente > 0 || variantes.length) {
        variantes.push({ url: linha, banda: bandaPendente });
        bandaPendente = 0;
      } else {
        segmentos.push(linha);
      }
    }
  }

  if (variantes.length) return { tipo: "master", variantes };
  return { tipo: "media", segmentos, init };
}

// Busca a playlist e, se for master, desce até a variante de maior banda.
// Retorna { urlBase, segmentos, init }.
export async function obterSegmentos(urlM3u8) {
  let url = urlM3u8;
  let playlist = lerPlaylist(await (await fetch(url)).text());

  if (playlist.tipo === "master") {
    const melhor = [...playlist.variantes].sort((a, b) => b.banda - a.banda)[0];
    url = resolverUrl(url, melhor.url);
    playlist = lerPlaylist(await (await fetch(url)).text());
    if (playlist.tipo === "master") {
      throw new Error("Playlist HLS aninhada demais.");
    }
  }

  if (!playlist.segmentos.length) {
    throw new Error("Playlist HLS sem segmentos.");
  }
  return { urlBase: url, segmentos: playlist.segmentos, init: playlist.init };
}
