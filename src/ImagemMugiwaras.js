// src/ImagemMugiwaras.js — <Image> que sabe carregar as capas do Mugiwaras.
//
// O CDN do Mugiwaras barra o cliente HTTP do React Native, então essas URLs
// precisam ser baixadas pelo WebView e viram data URI (ver CloudflareModal.js).
// Para qualquer outra URL o componente é um <Image> comum.

import { useEffect, useState } from "react";
import { Image } from "react-native";
import { imagemViaWebView } from "./CloudflareModal";

// Quantas imagens ficam em memória. Um data URI de página de mangá tem
// centenas de KB e um capítulo passa de 40 páginas: sem teto, rolar alguns
// capítulos seguidos derruba o app por falta de memória.
const MAX_CACHE = 24;

// Evita rebaixar a mesma imagem a cada render/scroll da lista. É um LRU
// simples: o Map mantém a ordem de inserção, então o primeiro item é o mais
// antigo e reinserir no acesso promove o item a mais recente.
const cache = new Map();

function doCache(uri) {
  if (!cache.has(uri)) return null;
  const dado = cache.get(uri);
  cache.delete(uri);
  cache.set(uri, dado);
  return dado;
}

function guardar(uri, dado) {
  cache.set(uri, dado);
  while (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
}

// Quem decide é o site da vez, não o host da URL: o CDN do Mugiwaras já mudou
// de nome uma vez, e um host fixo faz as imagens sumirem em silêncio quando
// ele mudar de novo. As outras fontes (MangaDex, Fliptru, Manga Plus) não são
// bloqueadas e precisam continuar indo direto pelo <Image>.
//
// Só URLs http(s) passam pela ponte; data:/file: (páginas já baixadas) o
// <Image> resolve sozinho.
function precisaDaPonte(uri, site) {
  if (site !== "mugiwaras" || !uri) return false;
  if (Array.isArray(uri)) return uri.length > 0;
  return /^https?:\/\//i.test(uri);
}

// Devolve a URL pronta para o <Image>: a original quando o RN dá conta dela,
// ou o data URI baixado pelo WebView quando é do CDN bloqueado. Vazio enquanto
// o download não termina.
export function useImagemMugiwaras(uri, site) {
  const pelaPonte = precisaDaPonte(uri, site);
  const cacheKey = Array.isArray(uri) ? uri.join("|") : String(uri || "");

  const [pronta, setPronta] = useState(() =>
    pelaPonte ? doCache(cacheKey) || "" : (typeof uri === "string" ? uri : "") || ""
  );
  // Quem chama precisa distinguir "ainda baixando" de "não vai carregar":
  // sem isso o leitor mostra um spinner eterno numa página que já falhou.
  const [erro, setErro] = useState(null);

  useEffect(() => {
    setErro(null);
    if (!pelaPonte) {
      setPronta(typeof uri === "string" ? uri : "");
      return;
    }
    const emCache = doCache(cacheKey);
    if (emCache) {
      setPronta(emCache);
      return;
    }

    let ativo = true;
    setPronta("");
    imagemViaWebView(uri)
      .then((d) => {
        guardar(cacheKey, d);
        if (ativo) setPronta(d);
      })
      .catch((e) => {
        if (ativo) setErro(e.message || "falha ao carregar");
      });
    return () => {
      ativo = false;
    };
  }, [uri, pelaPonte, cacheKey]);

  return { pronta, erro };
}


export default function ImagemMugiwaras({ uri, site, ...props }) {
  const { pronta } = useImagemMugiwaras(uri, site);
  if (!pronta) return null;
  return <Image source={{ uri: pronta }} {...props} />;
}
