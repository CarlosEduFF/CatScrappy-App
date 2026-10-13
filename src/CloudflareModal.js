// src/CloudflareModal.js — ponte de requisições para o Mugiwaras.
//
// O Cloudflare do site bloqueia o cliente HTTP do React Native (okhttp) pela
// impressão digital da conexão: com User-Agent de navegador devolve o desafio
// "Just a moment...", e sem ele devolve "you have been blocked". Nenhum ajuste
// de header resolve, e não há cf_clearance para herdar (o cookie fica vazio).
// Isso vale tanto para a API quanto para o CDN das imagens.
//
// O WebView, porém, passa direto — é um Chrome de verdade. Então ele é quem
// faz as requisições: um WebView invisível fica parado na origem da API e
// executa fetch() lá dentro, devolvendo o resultado para o RN.

import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";

// A API segue em .com mesmo o site tendo migrado para .org: app.*.org não
// existe (o fetch nem conecta).
const ORIGEM = "https://app.mugiwarasoficial.com";
// Página leve da própria origem: o fetch() de dentro precisa ser same-origin.
const PAGINA = `${ORIGEM}/v1/www/search?q=a&limit=1`;

// Um pedido sem resposta trava quem espera para sempre: o WebView pode
// recarregar (o Cloudflare revalida de tempos em tempos) e levar junto os
// fetch() em voo, que nunca chamam o postMessage. As imagens são grandes e
// saem do celular, então o limite é folgado.
const TIMEOUT_MS = 60000;

let pedir = null;
let proximoId = 0;
const pendentes = new Map();

// Encerra um pedido (resposta, erro ou timeout) em um lugar só, para o
// temporizador nunca sobreviver ao pedido que ele vigia.
function encerrar(id, erro, valor) {
  const pend = pendentes.get(id);
  if (!pend) return;
  pendentes.delete(id);
  clearTimeout(pend.timer);
  if (erro) pend.reject(erro);
  else pend.resolve(valor);
}

// Quando o WebView recarrega, os fetch() em voo morrem com ele e a resposta
// nunca chega. Em vez de falhar quem espera, os pedidos voltam para a fila e
// são reenviados quando a página liberar de novo — uma revalidação do
// Cloudflare no meio da leitura vira uma pausa, não um capítulo quebrado.
// O timeout de cada pedido segue correndo, então isso não repete para sempre.
function reenfileirarPendentes(enfileirar) {
  for (const [id, pend] of pendentes) {
    enfileirar([id, pend.tipo, pend.alvo]);
  }
}

function novoPedido(tipo, alvo) {
  return new Promise((resolve, reject) => {
    if (!pedir) return reject(new Error("Mugiwaras: ponte indisponível"));
    const id = `r${(proximoId += 1)}`;
    const timer = setTimeout(
      () => encerrar(id, new Error("Mugiwaras: tempo esgotado")),
      TIMEOUT_MS
    );
    // O alvo fica guardado para o pedido poder ser reenviado se o WebView
    // recarregar antes da resposta chegar.
    pendentes.set(id, { resolve, reject, tipo, alvo, timer });
    pedir(id, tipo, alvo);
  });
}

// Busca um caminho da API pelo WebView. Resolve com o JSON já parseado.
export function buscarViaWebView(caminho) {
  return novoPedido("json", caminho);
}

// Baixa uma imagem pelo WebView e devolve um data URI, já que o <Image> do RN
// usa a mesma pilha HTTP bloqueada e não consegue baixar a URL direto.
export function imagemViaWebView(url) {
  return novoPedido("img", url);
}

const JS_ANTI_ADBLOCK = `
(function () {
  window.canRunAds = true;
  window.adBlockerDetected = false;
  window.google_ad_status = 1;
  window.adsbygoogle = window.adsbygoogle || [];
  window.adsbygoogle.loaded = true;

  function neutralizar() {
    var el = document.querySelectorAll("div, section, dialog, [class*='modal'], [id*='modal']");
    el.forEach(function (node) {
      var t = (node.innerText || "").toLowerCase();
      if ((t.indexOf("bloqueador") !== -1 || t.indexOf("adblock") !== -1 || t.indexOf("premium") !== -1) && t.length < 400) {
        if (!node.querySelector("img[src*='snipercache']")) {
          node.style.display = "none";
          node.style.visibility = "hidden";
        }
      }
    });
    if (document.body) {
      document.body.style.overflow = "auto";
      document.body.style.pointerEvents = "auto";
    }
  }
  neutralizar();
  setInterval(neutralizar, 400);
})();
true;
`;


function jsPedido(id, tipo, alvo) {
  const idJson = JSON.stringify(id);


  if (tipo === "img") {
    const urls = Array.isArray(alvo) ? alvo : [alvo];
    return `
(function () {
  var lista = ${JSON.stringify(urls)};
  function testar(idx) {
    if (idx >= lista.length) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ id: ${idJson}, erro: "falha ao carregar imagem em todos os candidatos" }));
      return;
    }
    var url = lista[idx];
    fetch(url, { mode: "cors", credentials: "omit" })
      .then(function (r) {
        if (!r.ok) throw new Error("status " + r.status);
        var tipoResp = r.headers.get("content-type") || "";
        if (tipoResp && tipoResp.indexOf("image/") !== 0) {
          throw new Error("resposta não é imagem (" + tipoResp + ")");
        }
        return r.blob();
      })
      .then(function (b) {
        return new Promise(function (ok, falha) {
          var fr = new FileReader();
          fr.onloadend = function () { ok(fr.result); };
          fr.onerror = function () { falha(new Error("leitura falhou")); };
          fr.readAsDataURL(b);
        });
      })
      .then(function (dataUri) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ id: ${idJson}, corpo: dataUri }));
      })
      .catch(function () {
        var img = new Image();
        img.onload = function () {
          try {
            var canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth || 800;
            canvas.height = img.naturalHeight || 1200;
            var ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            var dataUri = canvas.toDataURL("image/jpeg", 0.85);
            window.ReactNativeWebView.postMessage(JSON.stringify({ id: ${idJson}, corpo: dataUri }));
          } catch (e) {
            testar(idx + 1);
          }
        };
        img.onerror = function () {
          testar(idx + 1);
        };
        img.src = url;
      });

  }
  testar(0);
})();
true;
`;
  }


  return `
(function () {
  fetch(${JSON.stringify(alvo)}, { headers: { Accept: "application/json" } })
    .then(function (r) {
      return r.text().then(function (t) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          id: ${idJson}, status: r.status, corpo: t
        }));
      });
    })
    .catch(function (e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ id: ${idJson}, erro: String(e) }));
    });
})();
true;
`;
}

// Avisa o RN quando a página já é a resposta real da API, e não o desafio do
// Cloudflare — só a partir daí os fetch() de dentro passam.
const JS_PRONTO = `
(function () {
  function checar() {
    var ehDesafio = /just a moment/i.test(document.title || "")
      || !!document.getElementById("challenge-error-text");
    if (!ehDesafio && document.readyState === "complete") {
      window.ReactNativeWebView.postMessage(JSON.stringify({ id: "pronto" }));
      return;
    }
    setTimeout(checar, 500);
  }
  checar();
})();
true;
`;

export default function CloudflareModal() {
  const webRef = useRef(null);
  const [pronto, setPronto] = useState(false);
  // Pedidos que chegaram antes da página estar liberada.
  const fila = useRef([]);

  const enviar = useCallback((id, tipo, alvo) => {
    webRef.current?.injectJavaScript(jsPedido(id, tipo, alvo));
  }, []);

  useEffect(() => {
    pedir = (id, tipo, alvo) => {
      if (pronto) enviar(id, tipo, alvo);
      else fila.current.push([id, tipo, alvo]);
    };
    return () => {
      pedir = null;
    };
  }, [pronto, enviar]);

  useEffect(() => {
    if (!pronto) return;
    // Um pedido pode ter sido reenfileirado depois de já ter respondido (a
    // resposta cruzou com o reload): só reenvia o que ainda está pendente.
    const jaEnviados = new Set();
    for (const [id, tipo, alvo] of fila.current.splice(0)) {
      if (jaEnviados.has(id) || !pendentes.has(id)) continue;
      jaEnviados.add(id);
      enviar(id, tipo, alvo);
    }
  }, [pronto, enviar]);

  // O WebView recarregou: a página volta a não estar liberada e os pedidos em
  // voo (perdidos com ela) entram na fila para sair de novo quando liberar.
  const aoRecarregar = useCallback(() => {
    setPronto(false);
    reenfileirarPendentes((item) => fila.current.push(item));
  }, []);

  return (
    // Fora da tela: a ponte não tem interface, só executa as requisições.
    <View
      style={{ position: "absolute", width: 0, height: 0, opacity: 0 }}
      pointerEvents="none"
    >
      <WebView
        ref={webRef}
        source={{ uri: PAGINA }}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        javaScriptEnabled
        domStorageEnabled
        injectedJavaScript={JS_PRONTO}
        // Uma navegação nova (o Cloudflare revalidando, por exemplo) descarta
        // os fetch() em voo e reinjeta o JS_PRONTO: os pedidos perdidos voltam
        // para a fila e saem de novo quando a página liberar.
        onLoadStart={aoRecarregar}
        onError={aoRecarregar}
        onMessage={(e) => {
          let msg;
          try {
            msg = JSON.parse(e.nativeEvent.data);
          } catch {
            return;
          }
          if (msg.id === "pronto") return setPronto(true);

          const pend = pendentes.get(msg.id);
          if (!pend) return;

          if (msg.erro) {
            return encerrar(msg.id, new Error(`Mugiwaras: ${msg.erro}`));
          }
          if (pend.tipo === "img") return encerrar(msg.id, null, msg.corpo);
          if (msg.status !== 200) {
            return encerrar(msg.id, new Error(`Mugiwaras: erro ${msg.status}`));
          }
          try {
            encerrar(msg.id, null, JSON.parse(msg.corpo));
          } catch {
            encerrar(msg.id, new Error("Mugiwaras: resposta inválida"));
          }
        }}
      />
    </View>
  );
}
