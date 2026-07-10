// src/sessao.js — sessão do usuário (login opcional) + favoritos.
//
// Guarda o token e o usuário no AsyncStorage para persistir entre aberturas.
// Login é opcional: o app funciona sem conta; só os favoritos exigem estar
// logado. Os favoritos são carregados do servidor ao entrar e mantidos em
// memória para o botão de ⭐ responder na hora.

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  entrar as apiEntrar,
  criarConta as apiCriarConta,
  atualizarPerfil as apiAtualizarPerfil,
  enviarAvatar as apiEnviarAvatar,
  listarFavoritos,
  adicionarFavorito,
  removerFavorito,
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

  // Restaura a sessão salva ao abrir o app.
  useEffect(() => {
    (async () => {
      try {
        const bruto = await AsyncStorage.getItem(CHAVE);
        if (bruto) {
          const { token: t, usuario: u } = JSON.parse(bruto);
          setToken(t);
          setUsuario(u);
        }
      } catch (e) {
        // Sessão corrompida: ignora e segue deslogado.
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  // Sempre que houver token, sincroniza os favoritos do servidor.
  const recarregarFavoritos = useCallback(async () => {
    if (!token) {
      setFavoritos([]);
      return;
    }
    try {
      setFavoritos(await listarFavoritos(token));
    } catch (e) {
      // Token expirado: desloga silenciosamente.
      if (e.status === 401) await sair();
    }
  }, [token]);

  useEffect(() => {
    recarregarFavoritos();
  }, [recarregarFavoritos]);

  async function persistir(t, u) {
    setToken(t);
    setUsuario(u);
    await AsyncStorage.setItem(CHAVE, JSON.stringify({ token: t, usuario: u }));
  }

  async function entrar(email, senha) {
    const r = await apiEntrar(email, senha);
    if (!r.access_token) throw new Error("Não foi possível entrar.");
    await persistir(r.access_token, r.usuario);
  }

  async function criarConta(email, senha, nome) {
    const r = await apiCriarConta(email, senha, nome);
    if (r.precisa_confirmar_email || !r.access_token) {
      // Confirmação de e-mail ligada no Supabase: não loga automaticamente.
      return { precisaConfirmar: true };
    }
    await persistir(r.access_token, r.usuario);
    return { precisaConfirmar: false };
  }

  async function sair() {
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
