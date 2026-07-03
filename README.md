# CatScrappy Mobile

App Android (Expo / React Native) para buscar e assistir animes, consumindo
a [CatScrappy API](../api/README.md) hospedada no Render.

## Funcionalidades

- Busca em TopAnimes e AnimesDrive.
- Lista de episódios.
- **Assistir no player interno** (HLS e MP4 via proxy) com controles nativos,
  tela cheia e picture-in-picture.
- **Abrir no VLC** do celular (deep link).

## Como o vídeo chega ao app

O backend resolve o link e devolve `url_player`:

- **HLS (.m3u8)** — séries: toca direto, sem proxy.
- **MP4** — filmes: passa pelo endpoint `/proxy` do backend, porque o host
  recusa requisições com `Referer`. O proxy repassa os bytes com Range,
  então seek e streaming funcionam.

O app não precisa saber desses detalhes: usa `url_player` e pronto.

## Rodar em desenvolvimento

```bash
cd mobile
npm install
npx expo start
```

Escaneie o QR code com o app **Expo Go** (Android) ou rode `npm run android`.

A URL do backend fica em `app.json` → `extra.apiBaseUrl`
(padrão: `https://catscrappy.onrender.com`).

## Gerar o APK standalone

Usa [EAS Build](https://docs.expo.dev/build/introduction/) (nuvem da Expo):

```bash
npm install -g eas-cli
eas login
eas build:configure          # preenche o projectId em app.json
npm run build:apk            # eas build -p android --profile preview
```

Ao final, o EAS fornece um link para baixar o `.apk` e instalar no Android
(ative "instalar de fontes desconhecidas").

## Estrutura

```
mobile/
├── app/                 # telas (expo-router)
│   ├── _layout.js       # navegação stack
│   ├── index.js         # busca + resultados
│   ├── episodios.js     # lista de episódios
│   └── player.js        # player interno + botão VLC
├── src/
│   ├── api.js           # cliente do backend
│   └── theme.js         # cores
├── app.json             # config Expo (apiBaseUrl, package Android)
└── eas.json             # perfis de build
```
