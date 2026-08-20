// src/sessao.js — sessão do usuário (login opcional) + favoritos.
//
// Guarda os tokens e o usuário no AsyncStorage para persistir entre
// aberturas. Login é opcional: o app funciona sem conta; só os favoritos
// exigem estar logado. Os favoritos são carregados do servidor ao entrar e
// mantidos em memória para o botão de ⭐ responder na hora.
//
// Persistência: o access_token do Supabase expira em 1h, então guardá-lo
// sozinho fazia o usuário ser deslogado toda vez que voltasse ao app depois
// desse prazo. O refresh_token (que não expira) é salvo junto e trocado por
// um novo par na abertura e sempre que a API responder 401. Como ele é de
// uso único, cada renovação devolve o próximo — e os dois são regravados.

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  entrar as apiEntrar,
  criarConta as apiCriarConta,
  atualizarPerfil as apiAtualizarPerfil,
  enviarAvatar as apiEnviarAvatar,
  renovarSessao as apiRenovarSessao,
  listarFavoritos,
  adicionarFavorito,
  removerFavorito,
  siteConhecido,
} from "./api";

const CHAVE = "@catscrappy:sessao";
const SessaoContext = createContext(null);

// Identidade estável de um favorito (bate com a unique do banco).
function chaveFav(f) {
  return `${f.tipo}|${f.site}|${f.item_id}`;
}

export function SessaoProvider({ children }) {
  const [token, setToken] = useState(null);
  const [usuario, setUsuario] = useState(null);
  const [favoritos, setFavoritos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  // O refresh fica em ref, não em estado: ele é lido dentro de funções
  // assíncronas que não devem esperar um novo render para enxergar o valor
  // atualizado (e trocá-lo não precisa repintar nada).
  const refreshRef = useRef(null);
  // Evita renovações simultâneas: o refresh_token é de uso único, então duas
  // chamadas em paralelo invalidariam uma à outra e derrubariam a sessão.
  const renovacaoRef = useRef(null);

  // Restaura a sessão salva ao abrir o app.
  useEffect(() => {
    (async () => {
      try {
        const bruto = await AsyncStorage.getItem(CHAVE);
        if (bruto) {
          const { token: t, refresh: r, usuario: u } = JSON.parse(bruto);
          refreshRef.current = r || null;
          setToken(t);
          setUsuario(u);
          // O access_token guardado quase sempre já expirou (dura 1h), então
          // renova de saída. Sem await: o free tier do Render hiberna e a
          // primeira chamada pode levar ~30-50s (ou os 90s do timeout) —
          // esperar aqui seguraria o app na tela de carregando todo esse
          // tempo. O app abre logado com o que está salvo e o token novo
          // entra quando chegar; se a credencial tiver mesmo expirado,
          // renovar() desloga sozinho.
          if (r) renovar();
        }
      } catch (e) {
        // Sessão corrompida: ignora e segue deslogado.
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  // Descarta o que veio da conta mas não é abrível por este app: a conta é
  // compartilhada entre builds e a tabela é uma só, então podem existir
  // registros de fontes que aqui não existem. Filtrar na entrada (e não em
  // cada tela) garante que nenhum consumidor de `favoritos` os veja.
  const soConhecidos = (lista) =>
    (lista || []).filter((f) => siteConhecido(f.site));

  // Sempre que houver token, sincroniza os favoritos do servidor.
  const recarregarFavoritos = useCallback(async () => {
    if (!token) {
      setFavoritos([]);
      return;
    }
    try {
      setFavoritos(soConhecidos(await listarFavoritos(token)));
    } catch (e) {
      if (e.status !== 401) return;
      // Access token expirado: renova e tenta de novo antes de desistir.
      // Só desloga se o refresh também falhar (renovar() já cuida disso).
      const novo = await renovar();
      if (!novo) return;
      try {
        setFavoritos(soConhecidos(await listarFavoritos(novo)));
      } catch (e2) {
        // Falhou mesmo com token novo: mantém os favoritos que já estavam.
      }
    }
  }, [token]);

  useEffect(() => {
    recarregarFavoritos();
  }, [recarregarFavoritos]);

  async function persistir(t, u, r) {
    // Sem refresh novo (ex.: atualizar perfil), mantém o que já estava.
    const refresh = r || refreshRef.current || null;
    refreshRef.current = refresh;
    setToken(t);
    setUsuario(u);
    await AsyncStorage.setItem(
      CHAVE,
      JSON.stringify({ token: t, refresh, usuario: u })
    );
  }

  // Troca o refresh_token por um par novo. Devolve o access_token novo, ou
  // null se a sessão não puder mais ser renovada (aí já saiu).
  async function renovar() {
    const refresh = refreshRef.current;
    if (!refresh) return null;
    // Uma renovação por vez: as demais aguardam o mesmo resultado.
    if (renovacaoRef.current) return renovacaoRef.current;

    renovacaoRef.current = (async () => {
      try {
        const r = await apiRenovarSessao(refresh);
        if (!r?.access_token) throw new Error("sem token");
        await persistir(r.access_token, r.usuario || usuario, r.refresh_token);
        return r.access_token;
      } catch (e) {
        // Só encerra a sessão quando o servidor rejeita a credencial: a API
        // devolve 401 ("Sessão expirada") quando o Supabase recusa o refresh
        // por inválido/já usado, e 400 quando ele nem foi enviado.
        //
        // Todo o resto é transitório e NÃO pode deslogar: sem internet ou
        // Render hibernando o fetch nem chega a ter status; o timeout de 90s
        // vira um Error sem status; e uma falha do Supabase chega como 502
        // (ou 503, se as chaves não estiverem no ambiente). Como sair() apaga
        // o refresh_token do disco, tratar esses casos como fim de sessão
        // destruiria a credencial por um problema passageiro — o usuário
        // perderia o login só por abrir o app offline.
        if (e.status === 401 || e.status === 400) await sair();
        return null;
      } finally {
        renovacaoRef.current = null;
      }
    })();
    return renovacaoRef.current;
  }

  async function entrar(email, senha) {
    const r = await apiEntrar(email, senha);
    if (!r.access_token) throw new Error("Não foi possível entrar.");
    await persistir(r.access_token, r.usuario, r.refresh_token);
  }

  async function criarConta(email, senha, nome) {
    const r = await apiCriarConta(email, senha, nome);
    if (r.precisa_confirmar_email || !r.access_token) {
      // Confirmação de e-mail ligada no Supabase: não loga automaticamente.
      return { precisaConfirmar: true };
    }
    await persistir(r.access_token, r.usuario, r.refresh_token);
    return { precisaConfirmar: false };
  }

  async function sair() {
    refreshRef.current = null;
    setToken(null);
    setUsuario(null);
    setFavoritos([]);
    await AsyncStorage.removeItem(CHAVE);
  }

  // Atualiza o nome de exibição (persiste o usuário retornado).
  async function atualizarNome(nome) {
    if (!token) throw new Error("Entre na sua conta.");
    const u = await apiAtualizarPerfil(token, { nome });
    await persistir(token, u);
  }

  // Envia a foto e persiste o usuário com o novo avatar_url.
  async function atualizarAvatar(foto) {
    if (!token) throw new Error("Entre na sua conta.");
    const r = await apiEnviarAvatar(token, foto);
    if (r.usuario) await persistir(token, r.usuario);
    return r.avatar_url;
  }

  function ehFavorito(item) {
    const k = chaveFav(item);
    return favoritos.some((f) => chaveFav(f) === k);
  }

  // Alterna o favorito com atualização otimista (a UI responde na hora).
  async function alternarFavorito(item) {
    if (!token) throw new Error("Entre na sua conta para salvar favoritos.");
    const jaEra = ehFavorito(item);
    if (jaEra) {
      setFavoritos((atual) => atual.filter((f) => chaveFav(f) !== chaveFav(item)));
      try {
        await removerFavorito(token, item);
      } catch (e) {
        recarregarFavoritos(); // desfaz o otimismo em caso de erro
        throw e;
      }
    } else {
      setFavoritos((atual) => [item, ...atual]);
      try {
        await adicionarFavorito(token, item);
      } catch (e) {
        recarregarFavoritos();
        throw e;
      }
    }
  }

  const valor = {
    token,
    usuario,
    logado: !!token,
    carregando,
    favoritos,
    entrar,
    criarConta,
    sair,
    atualizarNome,
    atualizarAvatar,
    ehFavorito,
    alternarFavorito,
    recarregarFavoritos,
    // Exposto para quem chama a API direto (ex.: useHistorico) poder repetir
    // a requisição com um token novo em vez de tratar o 401 como deslogado.
    renovar,
  };

  return <SessaoContext.Provider value={valor}>{children}</SessaoContext.Provider>;
}

export function useSessao() {
  const ctx = useContext(SessaoContext);
  if (!ctx) throw new Error("useSessao precisa estar dentro de <SessaoProvider>.");
  return ctx;
}

// Nome de exibição: usa o nome do perfil, senão a parte do e-mail antes do @.
export function nomeExibicao(usuario) {
  const nome = usuario?.user_metadata?.nome;
  if (nome && nome.trim()) return nome.trim();
  const email = usuario?.email || "";
  return email.split("@")[0] || "Usuário";
}

// URL do avatar salvo (ou null se o usuário não escolheu foto).
export function avatarUrl(usuario) {
  return usuario?.user_metadata?.avatar_url || null;
}
