// modules/saf-copy — cópia nativa de file:// para content:// (SAF).
import { requireNativeModule } from "expo-modules-core";

const SafCopy = requireNativeModule("SafCopy");

// Copia um arquivo local para um arquivo SAF já criado (streaming nativo,
// sem carregar o conteúdo na memória JS). Com append=true, anexa ao final
// do destino em vez de sobrescrever. Retorna uma Promise.
export function copyToSaf(fromFileUri, toContentUri, append = false) {
  return SafCopy.copyToSaf(fromFileUri, toContentUri, append);
}
