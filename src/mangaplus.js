// src/mangaplus.js — scraper do Manga Plus (Shueisha) rodando NO CELULAR.
//
// A API oficial (jumpg-webapi.tokyo-cdn.com) bane IPs de datacenter — e até
// residenciais — rápido demais para viver no Render. Então a LISTAGEM (busca,
// capítulos, páginas) é feita aqui, do IP do celular. O truque de acesso: usar
// o User-Agent do app oficial ("okhttp/4.9.0") e ?format=json — aí a API
// responde JSON limpo (com UA de browser ela devolve "Account Banned").
//
// As páginas vêm CIFRADAS (XOR de chave repetida; a chave hex vem na resposta).
// O fluxo de download/leitura do app só sabe consumir URLs de imagem diretas,
// então obterPaginas devolve URLs que apontam para a API (/manga/mangaplus-img),
// que baixa a imagem cifrada, aplica o XOR e serve o JPEG pronto.
//
// Aviso de conteúdo: o Manga Plus só libera de graça ~3 primeiros e ~3 últimos
// capítulos de cada obra; o miolo fica indisponível (chapterId ausente/pago).

import Constants from "expo-constants";

const API = "https://jumpg-webapi.tokyo-cdn.com/api";
const UA = "okhttp/4.9.0";

// Base da API CatScrappy (para o proxy que decifra as imagens). Mesma
// resolução usada em src/api.js.
const BASE_URL =
  Constants.expoConfig?.extra?.apiBaseUrl || "https://catscrappy.onrender.com";

// Parâmetros que o cliente oficial envia — a API os exige para responder.
const COMUNS = { format: "json", os: "android", app_ver: "40", lang: "eng" };

async function getJSON(path, params) {
  const qs = new URLSearchParams({ ...COMUNS, ...params }).toString();
  const resp = await fetch(`${API}/${path}?${qs}`, {
    headers: { "User-Agent": UA },
  });
  if (!resp.ok) throw new Error(`Manga Plus: erro ${resp.status}`);
  const dados = await resp.json();
  if (dados.error) {
    const p = dados.error.englishPopup || {};
    throw new Error(p.subject ? `Manga Plus: ${p.subject}` : "Manga Plus indisponível.");
  }
  return dados.success;
}

// Busca: a API não tem endpoint de busca por termo aberto; o cliente baixa a
// lista completa de títulos (titleListV2) e filtra localmente pelo nome.
// Cacheia a lista por sessão para não rebaixar tudo a cada tecla.
let _catalogo = null;

async function catalogoCompleto() {
  if (_catalogo) return _catalogo;
  const s = await getJSON("title_listV2", {});
  // Estrutura: allTitlesViewV2.AllTitlesGroup[].titles[] = { titleId, name, ... }
  const grupos = s?.allTitlesViewV2?.AllTitlesGroup || [];
  const titulos = [];
  for (const g of grupos) {
    for (const t of g.titles || []) titulos.push(t);
  }
  _catalogo = titulos;
  return titulos;
}

function paraManga(t) {
  return {
    id: String(t.titleId),
    titulo: t.name || "Sem título",
    imagem: t.portraitImageUrl || t.landscapeImageUrl || "",
    sinopse: t.author || "",
  };
}

export async function buscarManga(nome) {
  const alvo = (nome || "").trim().toLowerCase();
  const titulos = await catalogoCompleto();
  const achados = alvo
    ? titulos.filter((t) => (t.name || "").toLowerCase().includes(alvo))
    : titulos;
  // Dedup por titleId (o mesmo título aparece em vários grupos).
  const vistos = new Set();
  const out = [];
  for (const t of achados) {
    if (vistos.has(t.titleId)) continue;
    vistos.add(t.titleId);
    out.push(paraManga(t));
    if (out.length >= 40) break;
  }
  return out;
}

// Capítulos de um título. O id do mangá é o titleId. Capítulos sem chapterId
// (miolo pago/indisponível) ficam de fora — só entram os legíveis de graça.
export async function listarCapitulos(mangaId) {
  const s = await getJSON("title_detailV3", { title_id: mangaId });
  const tv = s?.titleDetailView || {};
  const grupos = tv.chapterListGroup || [];

  const caps = [];
  for (const g of grupos) {
    const listas = [
      ...(g.firstChapterList || []),
      ...(g.midChapterList || []),
      ...(g.lastChapterList || []),
    ];
    for (const c of listas) {
      if (c.chapterId == null) continue; // capítulo indisponível/pago
      // name costuma ser "#123"; subTitle é o título do capítulo.
      const num = (c.name || "").replace(/^#/, "") || String(c.chapterId);
      caps.push({
        id: String(c.chapterId),
        numero: num,
        titulo: c.subTitle || "",
        paginas: 0, // só sabido ao abrir o manga_viewer
        idioma: "en",
      });
    }
  }

  caps.sort(
    (a, b) =>
      (parseFloat(a.numero) || Infinity) - (parseFloat(b.numero) || Infinity)
  );
  return caps;
}

// Páginas de um capítulo. Cada página vem { imageUrl, encryptionKey }: a
// imagem é cifrada com XOR. Montamos URLs que passam pelo proxy da API, que
// decifra e serve o JPEG — assim o download/leitor trata como URL direta.
export async function obterPaginas(capId) {
  const s = await getJSON("manga_viewer", {
    chapter_id: capId,
    split: "yes",
    img_quality: "high",
  });
  const pages = s?.mangaViewer?.pages || [];
  const urls = [];
  for (const p of pages) {
    const mp = p.mangaPage;
    if (!mp || !mp.imageUrl) continue; // páginas de aviso/banner não têm imagem
    const qs = new URLSearchParams({
      url: mp.imageUrl,
      key: mp.encryptionKey || "",
    }).toString();
    urls.push(`${BASE_URL}/manga/mangaplus-img?${qs}`);
  }
  return urls;
}
