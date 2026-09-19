// src/CloudflareModal.js — abre a verificação do Cloudflare num WebView para a
// pessoa resolver. No Android o fetch() do RN compartilha o CookieManager com
// o WebView, então depois de resolvido o cf_clearance já vai nas chamadas da
// fonte, desde que o User-Agent seja o mesmo (o cookie é atrelado a UA + IP).

import { useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { WebView } from "react-native-webview";

let abrir = null;

// Resolve quando a página deixa de ser o challenge (ou a pessoa fecha).
export function resolverChallenge(url, userAgent) {
  return new Promise((resolve) => {
    if (!abrir) return resolve(false);
    abrir({ url, userAgent, resolve });
  });
}

// Reporta para o RN se o body ainda é a página de challenge do Cloudflare
// ("Just a moment...") ou já é o conteúdo real (o JSON da API, no nosso caso).
// Roda a cada segundo porque o Cloudflare troca o conteúdo via JS, sem
// disparar onNavigationStateChange de novo.
const JS_CHECAR = `
(function () {
  function checar() {
    var titulo = document.title || "";
    var ehChallenge = /just a moment|um momento|verificando|checking/i.test(titulo)
      || !!document.getElementById("challenge-error-text")
      || !!document.querySelector('form#challenge-form, iframe[src*="challenges.cloudflare.com"]');
    if (!ehChallenge) {
      window.ReactNativeWebView.postMessage("ok");
    }
  }
  checar();
  setInterval(checar, 1000);
})();
true;
`;

export default function CloudflareModal() {
  const [pedido, setPedido] = useState(null);
  const resolvido = useRef(false);
  abrir = setPedido;

  const fechar = (ok) => {
    pedido?.resolve(ok);
    setPedido(null);
  };

  const abrirPedido = (novo) => {
    resolvido.current = false;
    setPedido(novo);
  };
  abrir = abrirPedido;

  return (
    <Modal visible={!!pedido} animationType="slide" onRequestClose={() => fechar(false)}>
      <View style={{ flex: 1, backgroundColor: "#111" }}>
        <View style={{ flexDirection: "row", alignItems: "center", padding: 12, paddingTop: 40 }}>
          <Text style={{ color: "#fff", flex: 1 }}>
            O site pede uma verificação. Conclua abaixo.
          </Text>
          <Pressable onPress={() => fechar(false)} hitSlop={12}>
            <Text style={{ color: "#fff", fontSize: 18 }}>✕</Text>
          </Pressable>
        </View>
        {pedido && (
          <WebView
            source={{ uri: pedido.url }}
            userAgent={pedido.userAgent}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            injectedJavaScript={JS_CHECAR}
            onMessage={() => {
              if (resolvido.current) return;
              resolvido.current = true;
              fechar(true);
            }}
          />
        )}
      </View>
    </Modal>
  );
}
