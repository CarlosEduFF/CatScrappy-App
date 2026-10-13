// src/mangalivre.js — MangaLivre (mangalivre.to) consumido diretamente no app.
//
// O site oferece acervo completo de mangás em PT-BR (incluindo One Piece do cap 1 ao atual).
// As imagens dos capítulos são arquivos WebP estáticos servidos sem bloqueios ou tokens.

const BASE_URL = "https://mangalivre.to";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

// Busca: pesquisa por AJAX no WordPress/Madara com enriquecimento de capa e sinopse
export async function buscarManga(nome) {
  if (!nome || !nome.trim()) return [];

  // 1. Tenta a API AJAX rápida
  try {
    const params = new URLSearchParams({
      action: "wp-manga-search-manga",
      title: nome.trim(),
    });

    const resp = await fetch(`${BASE_URL}/wp-admin/admin-ajax.php`, {
      method: "POST",
      headers: {
        ...HEADERS,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
      signal: AbortSignal.timeout(10000),
    });

    if (resp.ok) {
      const json = await resp.json();
      if (json?.success && Array.isArray(json?.data) && json.data.length > 0) {
        // Enriquecemos os primeiros 8 mangás em paralelo com capa e sinopse
        return await Promise.all(
          json.data.slice(0, 8).map(async (item) => {
            const id = item.url.replace(/\/$/, "");
            let imagem = "";
            let sinopse = "";

            try {
              const rItem = await fetch(item.url, {
                headers: HEADERS,
                signal: AbortSignal.timeout(5000),
              });
              if (rItem.ok) {
                const html = await rItem.text();
                imagem =
                  html.match(/<meta property="og:image" content="([^"]+)"/i)?.[1] ||
                  "";
                sinopse =
                  html.match(/<meta property="og:description" content="([^"]+)"/i)?.[1] ||
                  "";
              }
            } catch {
              /* se falhar o enriquecimento, prossegue */
            }

            return {
              id,
              titulo: item.title,
              imagem,
              sinopse,
            };
          })
        );
      }
    }
  } catch (e) {
    console.warn("MangaLivre busca AJAX falhou:", e.message);
  }

  // 2. Fallback caso a busca AJAX não retorne dados
  const res = await fetch(
    `${BASE_URL}/?s=${encodeURIComponent(nome.trim())}&post_type=wp-manga`,
    {
      headers: HEADERS,
      signal: AbortSignal.timeout(10000),
    }
  );
  if (!res.ok) throw new Error(`MangaLivre retornou erro ${res.status}`);
  const html = await res.text();

  const regex = /<a[^>]+href="(https:\/\/mangalivre\.to\/manga\/[^"]+)"[^>]*title="([^"]*)"[^>]*>/gi;
  const encontrados = [];
  const vistos = new Set();
  let m;
  while ((m = regex.exec(html)) !== null) {
    const url = m[1].replace(/\/$/, "");
    if (!vistos.has(url)) {
      vistos.add(url);
      encontrados.push({
        id: url,
        titulo: m[2] || "Mangá",
        imagem: "",
        sinopse: "",
      });
    }
  }
  return encontrados;
}

// Lista todos os capítulos de um mangá
export async function listarCapitulos(mangaId) {
  const url = String(mangaId || "").startsWith("http")
    ? (mangaId.endsWith("/") ? mangaId : `${mangaId}/`)
    : `${BASE_URL}/manga/${mangaId}/`;

  const resp = await fetch(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`Erro ${resp.status} ao carregar capítulos`);
  const html = await resp.text();

  // Links de capítulos da obra
  const regex = /<a[^>]+href="(https:\/\/mangalivre\.to\/manga\/[^"/]+\/capitulo-[^"/]+\/?)"[^>]*>\s*([^<]+)\s*<\/a>/gi;
  const mapa = new Map();
  let m;
  while ((m = regex.exec(html)) !== null) {
    const capUrl = m[1];
    const textoBruto = m[2].trim();
    if (!mapa.has(capUrl)) {
      const numMatch = capUrl.match(/capitulo-([\d._]+)/i) || textoBruto.match(/[\d._]+/);
      const numero = numMatch ? numMatch[1].replace(/_/g, ".") : "";

      let titulo = textoBruto;
      if (
        !titulo ||
        /ler\s+(primeiro|último|ultimo)\s+capítulo/i.test(titulo) ||
        new RegExp(`^cap[ií]tulo\\s+${numero}$`, "i").test(titulo)
      ) {
        titulo = "";
      }

      mapa.set(capUrl, {
        id: capUrl,
        numero,
        titulo,
      });
    }
  }

  const caps = Array.from(mapa.values());

  // Ordena decrescente pelo número do capítulo
  caps.sort((a, b) => {
    const nA = parseFloat(a.numero) || 0;
    const nB = parseFloat(b.numero) || 0;
    return nB - nA;
  });

  return caps;
}

// Obtém as URLs diretas das imagens do capítulo
export async function obterPaginas(capituloId) {
  const url = String(capituloId || "").startsWith("http")
    ? capituloId
    : `${BASE_URL}/${capituloId.replace(/^\//, "")}`;

  const resp = await fetch(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`Erro ${resp.status} ao carregar páginas`);
  const html = await resp.text();

  // Tags <img> das páginas do capítulo
  const imgRegex = /<img[^>]+id="image-\d+"[^>]+src=["']\s*([^"'\s]+)\s*["']/gi;
  let paginas = [...html.matchAll(imgRegex)].map((match) => match[1].trim());

  if (paginas.length === 0) {
    const fallbackRegex = /<img[^>]+class="[^"]*wp-manga-chapter-img[^"]*"[^>]+src=["']\s*([^"'\s]+)\s*["']/gi;
    paginas = [...html.matchAll(fallbackRegex)].map((match) => match[1].trim());
  }

  if (paginas.length === 0) {
    const dataRegex = /https:\/\/mangalivre\.to\/wp-content\/uploads\/WP-manga\/data\/[^\s"']+/gi;
    paginas = Array.from(new Set(html.match(dataRegex) || []));
  }

  if (paginas.length === 0) {
    throw new Error("Não foi possível carregar as imagens deste capítulo.");
  }

  return paginas;
}

// URL web para fallback em WebView ou navegador
export function obterUrlWeb(capituloId) {
  return String(capituloId || "").startsWith("http")
    ? capituloId
    : `${BASE_URL}/${capituloId.replace(/^\//, "")}`;
}
