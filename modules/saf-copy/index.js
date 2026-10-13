// modules/saf-copy — cópia nativa de file:// para content:// (SAF).
import { requireOptionalNativeModule } from "expo-modules-core";
import * as FileSystem from "expo-file-system/legacy";

const SafCopy = requireOptionalNativeModule("SafCopy");

export const isSafCopyAvailable = !!SafCopy;

// Copia um arquivo local para um arquivo SAF já criado (streaming nativo,
// sem carregar o conteúdo na memória JS). Com append=true, anexa ao final
// do destino em vez de sobrescrever.
// No Expo Go (onde SafCopy não está compilado), usa fallback via FileSystem/SAF
// para arquivos que cabem em memória (como PDFs de mangá).
export async function copyToSaf(fromFileUri, toContentUri, append = false) {
  if (SafCopy) {
    return SafCopy.copyToSaf(fromFileUri, toContentUri, append);
  }

  const SAF = FileSystem.StorageAccessFramework;
  if (SAF && !append) {
    const base64 = await FileSystem.readAsStringAsync(fromFileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return SAF.writeAsStringAsync(toContentUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }

  throw new Error(
    "O módulo nativo de download (SafCopy) requer a build do APK nativo e não está disponível no Expo Go."
  );
}

