/*
 * 의존성 없는 최소 .docx 생성기
 * window.MiniDocx.build(blocks) → Blob
 * blocks: [{t:'title'|'h1'|'h2'|'p'|'bullet'|'quote'|'small'|'table'|'pagebreak', ...}]
 *   p/bullet/small/quote: runs: [{text, b, color, size}] 또는 text
 *   table: { rows: [[cell,...],...], widths: [비율...], header: true }
 */
(function () {
  "use strict";

  // ---------- zip (store, utf-8) ----------
  var CRC = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(files) {
    var enc = new TextEncoder(), parts = [], central = [], offset = 0;
    var now = new Date();
    var dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    var dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = enc.encode(f.data), crc = crc32(data);
      var lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      var ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
      ch.setUint16(30, 0, true); ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true); ch.setUint32(38, 0, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    });
    var cdSize = central.reduce(function (a, b) { return a + b.length; }, 0);
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]),
      { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  }

  // ---------- docx xml ----------
  var FONT = "맑은 고딕";
  function x(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  }
  function runs(r, base) {
    base = base || {};
    if (r == null) r = "";
    if (!Array.isArray(r)) r = [{ text: r }];
    return r.map(function (o) {
      if (typeof o === "string") o = { text: o };
      var pr = "";
      if (o.b || base.b) pr += "<w:b/>";
      if (o.i || base.i) pr += "<w:i/>";
      var color = o.color || base.color; if (color) pr += '<w:color w:val="' + color + '"/>';
      var size = o.size || base.size; if (size) pr += '<w:sz w:val="' + size + '"/><w:szCs w:val="' + size + '"/>';
      if (o.hl) pr += '<w:highlight w:val="yellow"/>';
      var lines = String(o.text == null ? "" : o.text).split("\n");
      var body = lines.map(function (ln, i) { return (i ? "<w:br/>" : "") + '<w:t xml:space="preserve">' + x(ln) + "</w:t>"; }).join("");
      return "<w:r>" + (pr ? "<w:rPr>" + pr + "</w:rPr>" : "") + body + "</w:r>";
    }).join("");
  }
  function para(style, content, ppr) {
    return "<w:p><w:pPr>" + (style ? '<w:pStyle w:val="' + style + '"/>' : "") + (ppr || "") + "</w:pPr>" + content + "</w:p>";
  }
  function cellXml(c, w, header) {
    if (c == null) c = "";
    var o = typeof c === "object" && !Array.isArray(c) ? c : { runs: c };
    var shade = header ? '<w:shd w:val="clear" w:color="auto" w:fill="EEF2FB"/>' : (o.fill ? '<w:shd w:val="clear" w:color="auto" w:fill="' + o.fill + '"/>' : "");
    var r = runs(o.runs, header ? { b: true } : (o.base || {}));
    return '<w:tc><w:tcPr><w:tcW w:w="' + w + '" w:type="dxa"/>' + shade + "</w:tcPr>" +
      '<w:p><w:pPr><w:pStyle w:val="TableText"/></w:pPr>' + r + "</w:p></w:tc>";
  }
  function table(b) {
    var total = 9638, ws = b.widths || b.rows[0].map(function () { return 1; });
    var sum = ws.reduce(function (a, c) { return a + c; }, 0);
    var dx = ws.map(function (v) { return Math.round(total * v / sum); });
    var bd = '<w:top w:val="single" w:sz="4" w:color="D0D5DD"/><w:left w:val="single" w:sz="4" w:color="D0D5DD"/><w:bottom w:val="single" w:sz="4" w:color="D0D5DD"/><w:right w:val="single" w:sz="4" w:color="D0D5DD"/><w:insideH w:val="single" w:sz="4" w:color="D0D5DD"/><w:insideV w:val="single" w:sz="4" w:color="D0D5DD"/>';
    var xml = '<w:tbl><w:tblPr><w:tblW w:w="' + total + '" w:type="dxa"/><w:tblBorders>' + bd + '</w:tblBorders><w:tblLayout w:type="fixed"/>' +
      '<w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>' +
      dx.map(function (w) { return '<w:gridCol w:w="' + w + '"/>'; }).join("") + "</w:tblGrid>";
    b.rows.forEach(function (row, ri) {
      var hdr = b.header && ri === 0;
      xml += "<w:tr>" + (hdr ? '<w:trPr><w:tblHeader/></w:trPr>' : '<w:trPr><w:cantSplit/></w:trPr>') +
        row.map(function (c, ci) { return cellXml(c, dx[ci], hdr); }).join("") + "</w:tr>";
    });
    return xml + "</w:tbl>" + para("", "", '<w:spacing w:after="0"/>');
  }
  function documentXml(blocks) {
    var body = blocks.map(function (b) {
      switch (b.t) {
        case "title": return para("Title", runs(b.text));
        case "h1": return para("Heading1", runs(b.text));
        case "h2": return para("Heading2", runs(b.text));
        case "bullet": return para("ListBullet", runs("• ", {}) + runs(b.runs || b.text), '<w:ind w:left="360" w:hanging="220"/>');
        case "quote": return para("Quote", runs(b.runs || b.text));
        case "small": return para("Small", runs(b.runs || b.text));
        case "table": return table(b);
        case "pagebreak": return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
        default: return para("", runs(b.runs || b.text));
      }
    }).join("");
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>' +
      body + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>';
  }
  function styleXml(id, name, rpr, ppr, extra) {
    return '<w:style w:type="paragraph" w:styleId="' + id + '"' + (id === "Normal" ? ' w:default="1"' : "") + '><w:name w:val="' + name + '"/>' +
      (id !== "Normal" ? '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/>' : "") + (extra || "") +
      "<w:pPr>" + (ppr || "") + "</w:pPr><w:rPr>" + (rpr || "") + "</w:rPr></w:style>";
  }
  var STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="' + FONT + '" w:hAnsi="' + FONT + '" w:eastAsia="' + FONT + '" w:cs="' + FONT + '"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="en-US" w:eastAsia="ko-KR"/></w:rPr></w:rPrDefault>' +
    '<w:pPrDefault><w:pPr><w:spacing w:after="100" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
    styleXml("Normal", "Normal", "", "") +
    styleXml("Title", "Title", '<w:b/><w:color w:val="1D2433"/><w:sz w:val="40"/><w:szCs w:val="40"/>', '<w:spacing w:after="120"/>') +
    styleXml("Heading1", "heading 1", '<w:b/><w:color w:val="1F4FD8"/><w:sz w:val="28"/><w:szCs w:val="28"/>', '<w:keepNext/><w:spacing w:before="320" w:after="120"/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="2" w:color="CDDAFE"/></w:pBdr><w:outlineLvl w:val="0"/>') +
    styleXml("Heading2", "heading 2", '<w:b/><w:color w:val="1D2433"/><w:sz w:val="23"/><w:szCs w:val="23"/>', '<w:keepNext/><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="1"/>') +
    styleXml("ListBullet", "List Bullet", "", '<w:spacing w:after="60"/>') +
    styleXml("Quote", "Quote", '<w:color w:val="1D2433"/>', '<w:ind w:left="240"/><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="1F4FD8"/></w:pBdr><w:spacing w:after="60"/>') +
    styleXml("Small", "Small", '<w:color w:val="667085"/><w:sz w:val="18"/><w:szCs w:val="18"/>', '<w:spacing w:after="60"/>') +
    styleXml("TableText", "Table Text", '<w:sz w:val="19"/><w:szCs w:val="19"/>', '<w:spacing w:after="0" w:line="276" w:lineRule="auto"/>') +
    "</w:styles>";

  function build(blocks) {
    return zip([
      { name: "[Content_Types].xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>' },
      { name: "_rels/.rels", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
      { name: "word/_rels/document.xml.rels", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: "word/styles.xml", data: STYLES },
      { name: "word/document.xml", data: documentXml(blocks) }
    ]);
  }

  window.MiniDocx = { build: build };
})();
