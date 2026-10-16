import { strToU8, zipSync } from "fflate";

/**
 * Builds a minimal but structurally valid PDF with real, extractable text.
 * Used to test the PDF parser against real pdf.js output.
 */
export function createPdf(pages: string[][], options: { imageOnLastPage?: boolean } = {}): Uint8Array {
  const fontObjectNumber = 3;
  const pageObjectNumbers = pages.map((_, index) => 4 + index * 2);
  const contentObjectNumbers = pages.map((_, index) => 5 + index * 2);
  let nextObjectNumber = 4 + pages.length * 2;

  const imageObjects: Array<{ number: number; pageIndex: number }> = [];
  if (options.imageOnLastPage) {
    imageObjects.push({ number: nextObjectNumber, pageIndex: pages.length - 1 });
    nextObjectNumber += 1;
  }

  const objects: string[] = new Array(nextObjectNumber).fill("");

  objects[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objects[2] = `<< /Type /Pages /Kids [${pageObjectNumbers
    .map((number) => `${number} 0 R`)
    .join(" ")}] /Count ${pages.length} >>`;
  objects[fontObjectNumber] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;

  const escape = (text: string) => text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  pages.forEach((lines, index) => {
    const hasImage = imageObjects.some((image) => image.pageIndex === index);
    const image = imageObjects.find((entry) => entry.pageIndex === index);

    const resources = hasImage && image
      ? `<< /Font << /F1 ${fontObjectNumber} 0 R >> /XObject << /Im0 ${image.number} 0 R >> >>`
      : `<< /Font << /F1 ${fontObjectNumber} 0 R >> >>`;

    objects[pageObjectNumbers[index]!] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
      `/Resources ${resources} ` +
      `/Contents ${contentObjectNumbers[index]} 0 R >>`;

    const textOps = lines
      .map((line) => `(${escape(line)}) Tj\nT*`)
      .join("\n");

    const content = hasImage
      ? `BT /F1 11 Tf 72 720 Td 14 TL\n${textOps}\nET\nq 120 0 0 120 100 400 cm /Im0 Do Q`
      : `BT /F1 11 Tf 72 720 Td 14 TL\n${textOps}\nET`;

    objects[contentObjectNumbers[index]!] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });

  for (const image of imageObjects) {
    const pixels = new Uint8Array([0xff, 0x00, 0x00]);
    objects[image.number] =
      `<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB ` +
      `/BitsPerComponent 8 /Length ${pixels.length} >>\nstream\n`;
  }

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = new Array(nextObjectNumber).fill(0);
  for (let number = 1; number < nextObjectNumber; number += 1) {
    offsets[number] = pdf.length;
    pdf += `${number} 0 obj\n${objects[number]}\nendobj\n`;
  }

  const startxref = pdf.length;
  pdf += `xref\n0 ${nextObjectNumber}\n`;
  pdf += "0000000000 65535 f \n";
  for (let number = 1; number < nextObjectNumber; number += 1) {
    pdf += `${String(offsets[number]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${nextObjectNumber} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;

  // Image streams are binary; rebuild with raw bytes to keep Length accurate.
  return encodePdfWithBinaryImage(pdf, imageObjects);
}

/** Replaces the placeholder image stream with raw binary bytes. */
function encodePdfWithBinaryImage(pdf: string, imageObjects: Array<{ number: number }>): Uint8Array {
  if (imageObjects.length === 0) {
    return new TextEncoder().encode(pdf);
  }
  const pixels = new Uint8Array([0xff, 0x00, 0x00]);
  const image = imageObjects[0]!;
  const placeholder = `${image.number} 0 obj\n<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${pixels.length} >>\nstream\n`;

  const parts: Uint8Array[] = [];
  let cursor = 0;
  while (cursor < pdf.length) {
    const found = pdf.indexOf(placeholder, cursor);
    if (found === -1) {
      parts.push(new TextEncoder().encode(pdf.slice(cursor)));
      break;
    }
    parts.push(new TextEncoder().encode(pdf.slice(cursor, found + placeholder.length)));
    parts.push(pixels);
    parts.push(new TextEncoder().encode("\nendstream\n"));
    cursor = found + placeholder.length;
    // Skip the remainder of the original object (it had no binary body).
    const endObj = pdf.indexOf("endobj", cursor);
    cursor = endObj + "endobj".length + 1;
  }
  return concatBytes(parts);
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/**
 * Wraps fixture bytes in a File, copying into an ArrayBuffer-backed view so
 * the same helper works in Node and in browsers.
 */
export function toFile(bytes: Uint8Array, name: string, type?: string): File {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return new File([copy], name, type ? { type } : {});
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const HEADER_PART = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:p><w:r><w:t>Confidential draft</w:t></w:r></w:p>
</w:hdr>`;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export interface DocxBlock {
  text: string;
  heading?: boolean;
}

/**
 * Builds a synthetic DOCX package with real (if minimal) OOXML structure so
 * the DOCX parser and structure inspector can be tested end to end.
 */
export function createDocx(options: {
  blocks?: DocxBlock[];
  tables?: string[][];
  columns?: boolean;
  header?: boolean;
  hyperlinks?: string[];
} = {}): Uint8Array {
  const blocks = options.blocks ?? [{ text: "Jane Doe" }, { text: "jane.doe@example.com" }];

  const bodyParts: string[] = [];

  for (const block of blocks) {
    const style = block.heading ? '<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>' : "";
    bodyParts.push(
      `<w:p>${style}<w:r><w:t xml:space="preserve">${escapeXml(block.text)}</w:t></w:r></w:p>`,
    );
  }

  for (const table of options.tables ?? []) {
    const rows = table
      .map(
        (cell) =>
          `<w:tr><w:tc><w:p><w:r><w:t>${escapeXml(cell)}</w:t></w:r></w:p></w:tc></w:tr>`,
      )
      .join("");
    bodyParts.push(`<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr>${rows}</w:tbl>`);
  }

  for (const link of options.hyperlinks ?? []) {
    bodyParts.push(
      `<w:p><w:hyperlink r:id="rIdLink1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:r><w:t>${escapeXml(link)}</w:t></w:r></w:hyperlink></w:p>`,
    );
  }

  const columnSpec = options.columns ? '<w:cols w:space="708" w:num="2"/>' : '<w:cols w:space="708"/>';
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
${bodyParts.join("\n")}
<w:sectPr>${columnSpec}</w:sectPr>
</w:body>
</w:document>`;

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(CONTENT_TYPES),
    "_rels/.rels": strToU8(ROOT_RELS),
    "word/document.xml": strToU8(documentXml),
  };

  if (options.header) {
    files["word/header1.xml"] = strToU8(HEADER_PART);
    files["word/_rels/document.xml.rels"] = strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rIdHdr1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
</Relationships>`,
    );
  }

  return zipSync(files, { level: 0 });
}
