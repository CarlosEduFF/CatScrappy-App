package expo.modules.safcopy

import android.net.Uri
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileInputStream

// Copia um arquivo local (file://) para um destino SAF (content://) em
// streaming, no lado nativo. Existe porque o expo-file-system 19 não tem
// nenhum método com memória constante que aceite content:// como destino:
// copyAsync/File.copy/FileHandle rejeitam, e read/writeAsStringAsync
// carregam o arquivo inteiro em base64 (OutOfMemoryError em vídeos).
class SafCopyModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SafCopy")

    // AsyncFunction roda fora da main thread, então a cópia não trava a UI.
    AsyncFunction("copyToSaf") { fromFileUri: String, toContentUri: String ->
      val context = appContext.reactContext
        ?: throw CodedException("ERR_NO_CONTEXT", "React context indisponível", null)

      val fromPath = Uri.parse(fromFileUri).path
        ?: throw CodedException("ERR_BAD_SOURCE", "URI de origem inválida: $fromFileUri", null)

      val output = context.contentResolver.openOutputStream(Uri.parse(toContentUri))
        ?: throw CodedException("ERR_BAD_DEST", "Não foi possível abrir o destino: $toContentUri", null)

      FileInputStream(File(fromPath)).use { input ->
        output.use { out -> input.copyTo(out) }
      }
    }
  }
}
