// modules/saf-copy — cópia nativa de file:// para content:// (SAF).
import { requireNativeModule } from "expo-modules-core";

const SafCopy = requireNativeModule("SafCopy");

// Copia um arquivo local para um arquivo SAF já criado (streaming nativo,
// sem carregar o conteúdo na memória JS). Retorna uma Promise.
export function copyToSaf(fromFileUri, toContentUri) {
  return SafCopy.copyToSaf(fromFileUri, toContentUri);
}
