// src/pdf.js — monta um PDF a partir de páginas JPEG, sem WebView.
//
// O expo-print carrega o HTML inteiro num WebView (loadDataWithBaseURL);
// com um capítulo real (~10 MB+ de imagens em base64) o WebView falha em
// silêncio e imprime um documento vazio — o PDF sai com uma única página em
// branco. Aqui o PDF é escrito diretamente: JPEG é um formato nativo de PDF
// (filtro /DCTDecode), então cada página entra byte a byte como foi
// comprimida, sem re-renderização e sem limite de tamanho além da memória.

const B64 =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const B64_INVERSA = (() => {
  const t = new Int8Array(128).fill(-1);
  for (let i = 0; i < 64; i++) t[B64.charCodeAt(i)] = i;
  return t;
})();

// Decodifica base64 (ignora '=', quebras de linha e espaços).
export function base64ParaBytes(b64) {
  const n = b64.length;
  const bytes = new Uint8Array(Math.ceil((n * 3) / 4));
  let pos = 0;
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < n; i++) {
    const c = b64.charCodeAt(i);
    const v = c < 128 ? B64_INVERSA[c] : -1;
    if (v < 0) continue;
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[pos++] = (buffer >> bits) & 0xff;
    }
  }
  return pos === bytes.length ? bytes : bytes.subarray(0, pos);
}

function bytesParaBase64(bytes) {
  const n = bytes.length;
  const pedacos = [];
  let s = "";
  for (let i = 0; i < n; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < n ? bytes[i + 1] : 0;
    const b2 = i + 2 < n ? bytes[i + 2] : 0;
    s +=
      B64[b0 >> 2] +
      B64[((b0 & 3) << 4) | (b1 >> 4)] +
      (i + 1 < n ? B64[((b1 & 15) << 2) | (b2 >> 6)] : "=") +
      (i + 2 < n ? B64[b2 & 63] : "=");
    // Junta em pedaços para não concatenar uma string gigante byte a byte.
    if (s.length >= 0x8000) {
      pedacos.push(s);
      s = "";
    }
  }
  pedacos.push(s);
  return pedacos.join("");
}

// Lê largura/altura/nº de componentes do cabeçalho do JPEG (marcador SOF).
function infoJpeg(bytes) {
  let i = 2; // pula FF D8
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i++;
      continue;
    }
    const marcador = bytes[i + 1];
    if (marcador === 0xff) {
      i++; // byte de preenchimento
      continue;
    }
    // SOF0–SOF15, exceto DHT (C4), JPG (C8) e DAC (CC).
    if (
      marcador >= 0xc0 &&
      marcador <= 0xcf &&
      marcador !== 0xc4 &&
      marcador !== 0xc8 &&
      marcador !== 0xcc
    ) {
      return {
        height: (bytes[i + 5] << 8) | bytes[i + 6],
        width: (bytes[i + 7] << 8) | bytes[i + 8],
        componentes: bytes[i + 9],
      };
    }
    i += 2 + ((bytes[i + 2] << 8) | bytes[i + 3]);
  }
  return null;
}

// Gera um PDF com uma página por JPEG, na dimensão da própria imagem.
// paginas: [{ bytes: Uint8Array, width?, height? }] — dimensões ausentes são
// lidas do cabeçalho do JPEG. Retorna o PDF inteiro em base64, pronto para
// FileSystem.writeAsStringAsync(..., { encoding: "base64" }).
export function gerarPdfDeJpegs(paginas) {
  const partes = [];
  const offsets = [];
  let offset = 0;

  const escreve = (parte) => {
    let bytes = parte;
    if (typeof parte === "string") {
      bytes = new Uint8Array(parte.length);
      for (let i = 0; i < parte.length; i++) bytes[i] = parte.charCodeAt(i);
    }
    partes.push(bytes);
    offset += bytes.length;
  };
  const abreObjeto = (num) => {
    offsets[num] = offset;
    escreve(`${num} 0 obj\n`);
  };

  // A linha binária no cabeçalho marca o arquivo como não-ASCII (convenção).
  escreve("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");

  // Objetos: 1 = Catalog, 2 = Pages e, por página, Page + Contents + Image.
  const objPagina = (i) => 3 + i * 3;
  const total = 3 + paginas.length * 3; // inclui o objeto 0 (livre) do xref

  abreObjeto(1);
  escreve("<</Type /Catalog /Pages 2 0 R>>\nendobj\n");

  abreObjeto(2);
  const kids = paginas.map((_, i) => `${objPagina(i)} 0 R`).join(" ");
  escreve(
    `<</Type /Pages /Count ${paginas.length} /Kids [${kids}]>>\nendobj\n`
  );

  for (let i = 0; i < paginas.length; i++) {
    const { bytes } = paginas[i];
    const info = infoJpeg(bytes);
    const w = paginas[i].width || info?.width;
    const h = paginas[i].height || info?.height;
    if (!w || !h) {
      throw new Error(`Página ${i + 1} não é um JPEG válido.`);
    }
    const cor = info?.componentes === 1 ? "/DeviceGray" : "/DeviceRGB";
    const [pag, cont, img] = [objPagina(i), objPagina(i) + 1, objPagina(i) + 2];

    // 1 pixel = 1 pt no MediaBox; leitores escalam ao tamanho da tela.
    abreObjeto(pag);
    escreve(
      `<</Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] ` +
        `/Resources <</XObject <</Im0 ${img} 0 R>>>> /Contents ${cont} 0 R>>\nendobj\n`
    );

    const conteudo = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
    abreObjeto(cont);
    escreve(
      `<</Length ${conteudo.length}>>\nstream\n${conteudo}\nendstream\nendobj\n`
    );

    abreObjeto(img);
    escreve(
      `<</Type /XObject /Subtype /Image /Width ${w} /Height ${h} ` +
        `/ColorSpace ${cor} /BitsPerComponent 8 /Filter /DCTDecode ` +
        `/Length ${bytes.length}>>\nstream\n`
    );
    escreve(bytes);
    escreve("\nendstream\nendobj\n");
  }

  // Tabela xref: entradas de exatamente 20 bytes.
  const inicioXref = offset;
  let xref = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let num = 1; num < total; num++) {
    xref += String(offsets[num]).padStart(10, "0") + " 00000 n \n";
  }
  escreve(xref);
  escreve(
    `trailer\n<</Size ${total} /Root 1 0 R>>\nstartxref\n${inicioXref}\n%%EOF\n`
  );

  const saida = new Uint8Array(offset);
  let pos = 0;
  for (const p of partes) {
    saida.set(p, pos);
    pos += p.length;
  }
  return bytesParaBase64(saida);
}
