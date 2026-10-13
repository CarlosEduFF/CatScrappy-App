// src/iptv.js — canais de TV abertos da lista pública do iptv-org.
//
// A playlist é um M3U único com ~11 mil canais do mundo todo; aqui só
// interessam os brasileiros, identificados pelo sufixo ".br" do tvg-id
// (ex.: tvg-id="Globo.br@SD"). Os streams são HLS, que o player já toca.
//
// A lista é comunitária: canais saem do ar sem aviso, então quem consome
// precisa lidar com stream que não abre.

const PLAYLIST = "https://iptv-org.github.io/iptv/index.m3u";

// A lista muda pouco e tem 2,5 MB; baixar uma vez por sessão basta.
let cache = null;

function atributo(linha, nome) {
  const m = linha.match(new RegExp(`${nome}="([^"]*)"`));
  return m ? m[1] : "";
}

// O group-title pode vir composto ("Education;Outdoor") ou como "Undefined";
// fica só a primeira categoria, para não gerar dezenas de grupos de um canal.
function categoriaDe(linha) {
  const bruta = (atributo(linha, "group-title").split(";")[0] || "").trim();
  return !bruta || bruta === "Undefined" ? "Outros" : bruta;
}

// Cada canal são duas linhas: a #EXTINF com os metadados e, logo abaixo, a
// URL (pulando diretivas como #EXTVLCOPT).
function parsear(texto) {
  const linhas = texto.split("\n");
  const canais = [];

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    if (!linha.startsWith("#EXTINF")) continue;

    // O tvg-id traz origem e feed: "Globo.br@SD" é um canal brasileiro, e
    // "PlutoTVAnimeAcao.us@BR" é o feed em português de um canal de fora.
    // Os dois interessam — só o primeiro padrão deixaria de fora os canais
    // dublados (anime, desenhos, séries).
    const tvgId = atributo(linha, "tvg-id");
    if (!/\.br@/i.test(tvgId) && !/@BR$/i.test(tvgId)) continue;

    let url = "";
    for (let j = i + 1; j < linhas.length; j++) {
      const seguinte = linhas[j].trim();
      if (!seguinte) continue;
      if (seguinte.startsWith("#EXTINF")) break;
      if (seguinte.startsWith("#")) continue;
      url = seguinte;
      break;
    }
    if (!url) continue;

    canais.push({
      id: url,
      titulo: (linha.split(",").pop() || "").trim(),
      imagem: atributo(linha, "tvg-logo"),
      categoria: categoriaDe(linha),
      // Alguns canais só respondem com um User-Agent de navegador; a linha
      // #EXTVLCOPT logo abaixo repete o mesmo valor.
      userAgent: atributo(linha, "http-user-agent"),
    });
  }
  return canais;
}

async function todos() {
  if (cache) return cache;
  const resp = await fetch(PLAYLIST);
  if (!resp.ok) throw new Error(`IPTV: erro ${resp.status}`);
  cache = parsear(await resp.text());
  return cache;
}

// Canais agrupados por categoria, em ordem alfabética.
export async function listarCategorias() {
  const canais = await todos();
  const porCategoria = new Map();
  for (const canal of canais) {
    if (!porCategoria.has(canal.categoria)) porCategoria.set(canal.categoria, []);
    porCategoria.get(canal.categoria).push(canal);
  }
  return [...porCategoria.entries()]
    .map(([nome, lista]) => ({ nome, canais: lista }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

export async function buscarCanais(termo) {
  const canais = await todos();
  const alvo = termo.trim().toLowerCase();
  if (!alvo) return canais;
  return canais.filter((c) => c.titulo.toLowerCase().includes(alvo));
}

// O id já é a própria URL do stream: canal de TV não tem episódio.
export function extrairVideo(id) {
  return { url_video: id, url_player: id, is_hls: true };
}
