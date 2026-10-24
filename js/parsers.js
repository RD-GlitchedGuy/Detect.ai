// Sky Detect – Datei-Parser: macht aus jedem Dokument reinen Text
(() => {
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  let pdfReady = null;

  const loadPdfJs = () => pdfReady ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = PDFJS + 'pdf.min.js';
    s.onload = () => { pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; res(); };
    s.onerror = () => rej(new Error('PDF-Bibliothek konnte nicht geladen werden (offline?)'));
    document.head.appendChild(s);
  });

  // ---- ZIP (für DOCX/ODT/PPTX) ohne Bibliothek
  async function unzip(buf, want) {
    const dv = new DataView(buf), u8 = new Uint8Array(buf);
    let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--)
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('Datei ist beschädigt oder kein Office-Dokument');
    let p = dv.getUint32(eocd + 16, true);
    const count = dv.getUint16(eocd + 10, true), files = {};
    const dec = new TextDecoder();
    for (let k = 0; k < count; k++) {
      const method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true);
      const nLen = dv.getUint16(p + 28, true), xLen = dv.getUint16(p + 30, true), cLen = dv.getUint16(p + 32, true);
      const off = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nLen));
      p += 46 + nLen + xLen + cLen;
      if (!want(name)) continue;
      const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
      const raw = u8.subarray(start, start + size);
      if (method === 0) files[name] = dec.decode(raw);
      else if (method === 8) {
        const ds = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        files[name] = await new Response(ds).text();
      }
    }
    return files;
  }

  const ent = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#(x?)([0-9a-f]+);/gi, (_, x, n) => String.fromCodePoint(parseInt(n, x ? 16 : 10)))
    .replace(/&amp;/g, '&');
  const stripXml = s => ent(s.replace(/<[^>]+>/g, ''));

  function fromDocx(x) {
    return stripXml(x.replace(/<w:tab\/>/g, '\t').replace(/<w:br[^>]*\/>/g, '\n').replace(/<\/w:p>/g, '\n\n'));
  }
  function fromOdt(x) {
    return stripXml(x.replace(/<text:tab\/>/g, '\t').replace(/<text:line-break\/>/g, '\n')
      .replace(/<text:s[^>]*\/>/g, ' ').replace(/<\/text:(p|h)>/g, '\n\n'));
  }
  function fromPptx(files) {
    return Object.keys(files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/)))
      .map(n => stripXml(files[n].replace(/<\/a:p>/g, '\n'))).join('\n\n');
  }

  function fromRtf(s) {
    return s.replace(/\\'([0-9a-f]{2})/gi, (_, h) => new TextDecoder('windows-1252').decode(new Uint8Array([parseInt(h, 16)])))
      .replace(/\\u(-?\d+)\??/g, (_, n) => String.fromCharCode((+n + 65536) % 65536))
      .replace(/\{\\\*[^{}]*\}/g, '').replace(/\{\\(fonttbl|colortbl|stylesheet|info)[\s\S]*?\}\s*\}/g, '')
      .replace(/\\par[d]?\b ?/g, '\n\n').replace(/\\line\b ?/g, '\n').replace(/\\tab\b ?/g, '\t')
      .replace(/\\[a-z]+-?\d* ?/gi, '').replace(/[{}]/g, '').replace(/\\\\/g, '\\');
  }

  function fromHtml(s) {
    const doc = new DOMParser().parseFromString(s, 'text/html');
    doc.querySelectorAll('script,style,noscript,nav,header,footer').forEach(e => e.remove());
    doc.querySelectorAll('p,div,li,h1,h2,h3,h4,h5,h6,tr,blockquote,section,article').forEach(e => e.append('\n\n'));
    doc.querySelectorAll('br').forEach(e => e.replaceWith('\n'));
    return doc.body ? doc.body.textContent : '';
  }

  async function fromPdf(buf) {
    await loadPdfJs();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const pages = [];
    for (let i = 1; i <= Math.min(pdf.numPages, 400); i++) {
      const tc = await (await pdf.getPage(i)).getTextContent();
      let t = '';
      for (const it of tc.items) t += it.str + (it.hasEOL ? '\n' : '');
      pages.push(t);
    }
    if (!pages.join('').trim()) throw new Error('PDF enthält keinen Text (eingescannt?)');
    return pages.join('\n\n');
  }

  // Harte Zeilenumbrüche (PDF, Mails) zu Fließtext zusammenführen
  function reflow(t) {
    t = t.replace(/\r\n?/g, '\n').replace(/ /g, ' ').replace(/­/g, '');
    t = t.replace(/(\p{Ll})-\n(\p{Ll})/gu, '$1$2');               // Silbentrennung
    const lines = t.split('\n'), out = [];
    for (let i = 0; i < lines.length; i++) {
      const cur = lines[i], next = lines[i + 1];
      out.push(cur);
      if (next === undefined) break;
      const join = cur.trim().length > 45 && /[\p{L},;\-–]$/u.test(cur.trim()) &&
        next.trim() && !/^\s*([-*•#>]|\d+[.)]\s)/u.test(next);
      out.push(join ? ' ' : '\n');
    }
    return out.join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  async function fileToText(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    let text;
    if (ext === 'pdf') text = await fromPdf(await file.arrayBuffer());
    else if (ext === 'docx') text = fromDocx((await unzip(await file.arrayBuffer(), n => n === 'word/document.xml'))['word/document.xml'] || '');
    else if (ext === 'odt') text = fromOdt((await unzip(await file.arrayBuffer(), n => n === 'content.xml'))['content.xml'] || '');
    else if (ext === 'pptx') text = fromPptx(await unzip(await file.arrayBuffer(), n => n.startsWith('ppt/slides/slide')));
    else if (ext === 'rtf') text = fromRtf(await file.text());
    else if (ext === 'html' || ext === 'htm') text = fromHtml(await file.text());
    else if (['txt', 'md', 'csv', 'json', 'tex', ''].includes(ext) || file.type.startsWith('text/')) text = await file.text();
    else if (ext === 'doc') throw new Error('Altes .doc-Format – bitte als .docx oder PDF speichern');
    else throw new Error('Format nicht unterstützt');
    text = reflow(text);
    if (text.split(/\s+/).length < 5) throw new Error('Kein lesbarer Text gefunden');
    return text;
  }

  window.SkyParsers = { fileToText, reflow };
})();
