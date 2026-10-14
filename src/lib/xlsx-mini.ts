/**
 * Penulis .xlsx sederhana (tanpa pustaka tambahan selain jszip yang sudah ada).
 * Mendukung beberapa sheet, teks, angka (format 0.000), baris judul tebal & dibekukan, lebar kolom.
 */
import JSZip from "jszip";

export type Sel = string | number | null | undefined;
export interface Sheet {
  nama: string;
  baris: Sel[][];
  lebar?: number[];
  /** jumlah baris judul di atas (tebal + dibekukan) */
  judul?: number;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    // karakter kontrol tidak sah di XML
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

function kolom(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function namaSheet(n: string, dipakai: Set<string>): string {
  let s = n.replace(/[[\]:*?/\\]/g, " ").slice(0, 31).trim() || "Sheet";
  let k = 2;
  while (dipakai.has(s.toLowerCase())) s = `${s.slice(0, 28)} ${k++}`;
  dipakai.add(s.toLowerCase());
  return s;
}

function xmlSheet(sh: Sheet): string {
  const judul = sh.judul ?? 1;
  const rows = sh.baris.map((r, ri) => {
    const cells = r.map((v, ci) => {
      if (v == null || v === "" || (typeof v === "number" && !isFinite(v))) return "";
      const ref = `${kolom(ci)}${ri + 1}`;
      if (typeof v === "number") return `<c r="${ref}"${ri < judul ? ' s="1"' : ' s="2"'}><v>${v}</v></c>`;
      return `<c r="${ref}" t="inlineStr"${ri < judul ? ' s="1"' : ""}><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`;
    }).join("");
    return `<row r="${ri + 1}">${cells}</row>`;
  }).join("");
  const cols = sh.lebar?.length
    ? `<cols>${sh.lebar.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`
    : "";
  const beku = judul > 0
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${judul}" topLeftCell="A${judul + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${beku}${cols}<sheetData>${rows}</sheetData></worksheet>`;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="0.000"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

export async function buatXlsx(sheets: Sheet[]): Promise<Buffer> {
  const zip = new JSZip();
  const dipakai = new Set<string>();
  const nama = sheets.map((s) => namaSheet(s.nama, dipakai));
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("\n")}
</Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
  zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${nama.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>
</workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("\n")}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
  zip.file("xl/styles.xml", STYLES);
  sheets.forEach((s, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, xmlSheet(s)));
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
