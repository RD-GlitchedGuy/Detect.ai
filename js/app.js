// Sky Detect – Bewertung & Oberfläche
(() => {
  const $ = id => document.getElementById(id);
  const clamp = x => Math.max(0, Math.min(1, x));
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cvOf = a => { if (a.length < 2) return 0; const m = a.reduce((x, y) => x + y, 0) / a.length; return m ? Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length) / m : 0; };

  // ---------- C++/WASM-Engine ----------
  let W = null;
  const enc = new TextEncoder(), dec = new TextDecoder();
  (async () => {
    try {
      const bin = Uint8Array.from(atob(window.SKY_WASM), c => c.charCodeAt(0));
      W = (await WebAssembly.instantiate(bin)).instance.exports;
      $('engine').className = 'engine on';
      $('engine').lastElementChild.textContent = 'C++ Engine online';
    } catch (e) {
      $('engine').className = 'engine off';
      $('engine').lastElementChild.textContent = 'Engine-Fehler';
      console.error(e);
    }
  })();

  const KEYS = ['words', 'sents', 'sMean', 'sSd', 'cv', 'wMean', 'wSd', 'mattr', 'tri', 'paras', 'paraCv', 'em', 'en', 'semi',
    'colon', 'excl', 'quest', 'comma', 'paren', 'ell', 'dbl', 'lowStart', 'curly', 'straight', 'bullets', 'allSents', 'multi'];
  function core(text, withSents) {
    let bytes = enc.encode(text);
    if (bytes.length > W.buf_cap()) bytes = bytes.subarray(0, W.buf_cap());
    new Uint8Array(W.memory.buffer, W.buf_ptr(), bytes.length).set(bytes);
    const o = new Float32Array(W.memory.buffer, W.analyze(bytes.length), KEYS.length);
    const s = {}; KEYS.forEach((k, i) => s[k] = o[i]);
    if (!withSents) return { s };
    const n = W.sent_count(), m = W.memory.buffer;
    const st = new Uint32Array(m, W.sent_start(), n), en = new Uint32Array(m, W.sent_end(), n);
    const sw = new Uint32Array(m, W.sent_words(), n), sc = new Float32Array(m, W.sent_score(), n);
    const sents = []; let prev = 0;
    for (let i = 0; i < n; i++) {
      sents.push({ gap: dec.decode(bytes.subarray(prev, st[i])), text: dec.decode(bytes.subarray(st[i], en[i])), words: sw[i], score: sc[i] });
      prev = en[i];
    }
    return { s, sents, tail: dec.decode(bytes.subarray(prev)) };
  }

  // ---------- Lexikon: Gewicht 1 = starkes KI-Signal, 0.35 = schwaches ----------
  const STRONG = {
    de: ['zusammenfassend lässt sich sagen', 'zusammenfassend lässt sich festhalten', 'abschließend lässt sich sagen', 'es lässt sich festhalten',
      'es ist wichtig zu beachten', 'es ist wichtig zu betonen', 'es ist erwähnenswert', 'es sei darauf hingewiesen', 'spielt eine entscheidende rolle',
      'spielt eine zentrale rolle', 'spielt eine wichtige rolle', 'eine entscheidende rolle', 'von entscheidender bedeutung', 'von zentraler bedeutung',
      'in der heutigen zeit', 'in der heutigen schnelllebigen', 'in einer zunehmend', 'in einer sich ständig wandelnden', 'vielschichtig', 'facettenreich',
      'eintauchen', 'tauchen wir ein', 'ein weiterer wichtiger aspekt', 'ein zentraler aspekt', 'insgesamt zeigt sich', 'dies verdeutlicht',
      'dies unterstreicht', 'unterstreicht die bedeutung', 'wertvolle einblicke', 'einen wichtigen beitrag', 'auf einen blick', 'im überblick',
      'kurz gesagt', 'mit anderen worten', 'nächste schritte', 'die wichtigsten punkte', 'die wichtigsten erkenntnisse', 'zentrale erkenntnisse',
      'kernaussagen', 'handlungsempfehlungen', 'dreh- und angelpunkt', 'im spannungsfeld', 'rückt in den fokus', 'steht im fokus', 'stellschrauben',
      'chancen und risiken', 'chancen und herausforderungen', 'trägt maßgeblich', 'ein ganzheitlicher ansatz', 'best practices', 'der schlüssel liegt'],
    en: ['delve', 'delves', 'delving', 'tapestry', 'it is important to note', "it's important to note", 'it is worth noting', "it's worth noting",
      'in conclusion', 'plays a crucial role', 'plays a pivotal role', 'plays a vital role', 'a testament to', 'navigate the complexities',
      "in today's fast-paced", "in today's digital", 'in the realm of', 'ever-evolving', 'multifaceted', 'underscores', 'seamlessly', 'holistic',
      'intricacies', 'embark', 'showcasing', 'paramount', 'meticulous', 'meticulously', 'a myriad of', 'sheds light', 'valuable insights',
      'key takeaways', 'game-changer', 'unlock the potential', 'harness the power', 'serves as a', 'stands as a', "here's the thing",
      "here's why", "here's what", 'the bottom line', 'next steps', 'at a glance', 'a nuanced', 'rich tapestry', 'it’s not just'],
    es: ['en conclusión', 'es importante destacar', 'es importante señalar', 'cabe destacar', 'cabe señalar', 'vale la pena mencionar',
      'juega un papel crucial', 'juega un papel fundamental', 'desempeña un papel fundamental', 'desempeña un papel crucial', 'un papel clave',
      'en el mundo actual', 'en un mundo cada vez más', 'multifacético', 'multifacética', 'sin lugar a dudas', 'adentrarnos', 'un testimonio de',
      'valiosas perspectivas', 'en pocas palabras', 'dicho de otro modo', 'próximos pasos', 'puntos clave', 'de manera integral']
  };
  const WEAK = {
    de: ['darüber hinaus', 'gezielt', 'gezielte', 'konkret', 'fundiert', 'fundierte', 'nachvollziehbar', 'praxisnah', 'praxisnahe', 'strukturiert',
      'zielgerichtet', 'mehrwert', 'synergien', 'rahmenbedingungen', 'maßgeblich', 'ganzheitlich', 'ganzheitliche', 'nachhaltig', 'essenziell',
      'nahtlos', 'unterstreicht', 'beleuchtet', 'umfassend', 'umfassende', 'vielfältige', 'zahlreiche', 'herausforderungen', 'potenziale',
      'erkenntnisse', 'fazit', 'ausblick', 'zusammengefasst', 'im mittelpunkt', 'trägt dazu bei', 'ermöglicht es', 'gleichermaßen', 'zentrale',
      'entscheidende', 'wesentliche', 'transparent', 'effizient', 'robust', 'resilienz', 'skalierbar', 'wichtig:', 'hinweis:', 'tipp:'],
    en: ['comprehensive', 'robust', 'crucial', 'essential', 'ensure', 'ensuring', 'enhance', 'enhancing', 'streamline', 'insights', 'framework',
      'landscape', 'navigate', 'navigating', 'empower', 'elevate', 'journey', 'genuinely', 'straightforward', 'overview', 'foster', 'fostering',
      'leverage', 'leveraging', 'pivotal', 'nuanced', 'intricate', 'vibrant', 'seamless', 'realm', 'resonate', 'moreover', 'furthermore', 'additionally'],
    es: ['fundamental', 'clave', 'integral', 'sinergias', 'enfoque', 'potenciar', 'optimizar', 'garantizar', 'desafíos', 'retos', 'perspectiva',
      'fomentar', 'aprovechar', 'panorama', 'profundizar', 'además', 'asimismo', 'crucial', 'significativa', 'holístico']
  };
  const TRANS = {
    de: ['darüber hinaus', 'zudem', 'außerdem', 'des weiteren', 'ferner', 'insgesamt', 'zusammenfassend', 'abschließend', 'letztlich',
      'letztendlich', 'gleichzeitig', 'folglich', 'somit', 'nichtsdestotrotz', 'kurz gesagt', 'konkret', 'wichtig ist'],
    en: ['furthermore', 'moreover', 'additionally', 'in addition', 'overall', 'ultimately', 'consequently', 'in conclusion', 'importantly',
      'notably', 'similarly', 'conversely', 'in short', 'put simply', 'crucially'],
    es: ['además', 'asimismo', 'por otro lado', 'en conclusión', 'en resumen', 'por lo tanto', 'por último', 'de igual manera', 'en definitiva']
  };
  // Satzbau-Muster, die Sprachmodelle lieben
  const PATTERNS = {
    de: [/\bnicht (nur |bloß |einfach )?[^.!?\n]{1,70}?,\s*sondern\b/giu, /\bes geht (nicht|weniger) (nur |darum |um )/giu,
      /\b(das|der|die) (ergebnis|grund|folge|problem|ziel|fazit|kernproblem|entscheidende|wichtigste|gute|frage)( ist)?:/giu,
      /\b(ob|egal ob) [^.!?\n]{1,50} oder [^.!?\n]{1,50}[:—–]/giu, /\bkurz:\s/giu, /[→✓✔✅]/gu],
    en: [/\bnot (just|only|merely) [^.!?\n]{1,70}?[,;—–]\s*(but|it'?s|it is)\b/giu, /\bit'?s not (about )?[^.!?\n]{1,40}[,;—–]\s*(it'?s|but)\b/giu,
      /\b(the|this) (result|key|catch|reason|goal|problem|takeaway)( is)?:/giu, /\bwhether you'?re\b/giu, /\bthink of it as\b/giu, /[→✓✔✅]/gu],
    es: [/\bno (solo|sólo|se trata de) [^.!?\n]{1,70}?,?\s*sino\b/giu, /\b(el|la) (resultado|clave|razón|objetivo|problema)( es)?:/giu, /[→✓✔✅]/gu]
  };
  const STOP = {
    de: /\b(der|die|das|und|ist|nicht|ein|eine|mit|auch|sich|dass|wird|werden)\b/gi,
    en: /\b(the|and|is|of|to|that|it|with|are|this|for|was|be)\b/gi,
    es: /\b(el|la|los|las|que|y|es|del|por|una|con|para|se)\b/gi
  };
  const escRe = p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['’]");
  const LEX = {};
  for (const l in STRONG) {
    const map = new Map();
    WEAK[l].forEach(p => map.set(p, .35)); STRONG[l].forEach(p => map.set(p, 1));
    const list = [...map.keys()].sort((a, b) => b.length - a.length).map(escRe);
    LEX[l] = { map, re: new RegExp('(?<![\\p{L}\\p{N}])(' + list.join('|') + ')(?![\\p{L}\\p{N}])', 'giu'),
      trans: new RegExp('^[\\s"„“*•\\-–]*(' + TRANS[l].map(escRe).join('|') + ')(?![\\p{L}])', 'iu') };
  }
  const lang = t => { let best = 'en', bv = -1; for (const l in STOP) { const v = (t.slice(0, 20000).match(STOP[l]) || []).length; if (v > bv) { bv = v; best = l; } } return best; };

  // ---------- Aufbau des Dokuments ----------
  const BUL = /^(?:[•●▪◦○■□➢➤►▶✓✔✅☐→·\uf0b7\uf0a7]\s*|[-–—*+]\s+|\d{1,2}[.)]\s+|[a-z][.)]\s+)/u;
  function structure(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const r = { lines: lines.length, head: 0, bullet: 0, label: 0, prose: 0, bLens: [], proseParts: [], bold: (text.match(/\*\*[^*\n]+\*\*/g) || []).length };
    for (const l of lines) {
      const plain = l.replace(/\*\*/g, ''), words = plain.split(/\s+/).length;
      if (/^#{1,6}\s/.test(l)) { r.head++; continue; }
      if (BUL.test(plain)) {
        const body = plain.replace(BUL, ''), bw = body.split(/\s+/).length;
        if (/^\d/.test(plain) && bw <= 8 && !/[.!?:;,]$/.test(plain)) { r.head++; continue; }   // "2. Methodik"
        r.bullet++; r.bLens.push(bw);
        if (/^[^:]{2,45}:\s+\S/.test(body) && body.split(':')[0].split(/\s+/).length <= 5) r.label++;
        continue;
      }
      if (words <= 10 && !/[.!?:;,…)"“”]$/.test(plain) && /^[\p{Lu}\d]/u.test(plain)) { r.head++; continue; }
      if (/^[^:]{2,45}:\s+\S/.test(plain) && plain.split(':')[0].split(/\s+/).length <= 5) r.label++;
      r.prose++; r.proseParts.push(l);
    }
    return r;
  }

  // ---------- Gesamtbewertung ----------
  function analyze(text) {
    const t0 = performance.now();
    const full = core(text, true);
    const st = structure(text);
    const proseText = st.proseParts.join('\n\n');
    const prose = proseText.split(/\s+/).length >= 60 ? core(proseText).s : full.s;
    const s = full.s, L = lang(text), lx = LEX[L];
    const words = Math.max(s.words, 1), per1k = x => x / words * 1000;

    // Phrasen + Muster pro Satz
    const found = {}; let strong = 0, weak = 0, trans = 0, pat = 0;
    for (const se of full.sents) {
      se.why = [];
      let sw = 0, ww = 0;
      se.html = esc(se.text).replace(lx.re, m => {
        const k = m.toLowerCase().replace(/’/g, "'"), w = lx.map.get(k) || .35;
        found[k] = (found[k] || 0) + 1;
        if (w === 1) { strong++; sw++; return '<mark>' + m + '</mark>'; }
        weak++; ww++; return '<mark class="w">' + m + '</mark>';
      });
      if (sw) se.why.push(sw + '× typische KI-Formulierung');
      else if (ww) se.why.push(ww + '× KI-nahes Wort');
      se.trans = se.words >= 3 && lx.trans.test(se.text);
      if (se.trans) { trans++; se.why.push('beginnt mit Übergangswort'); }
      se.pat = PATTERNS[L].reduce((a, r) => a + (se.text.match(r) || []).length, 0);
      if (se.pat) { pat += se.pat; se.why.push('typisches Satzbau-Muster'); }
      se.dash = /—| – /.test(se.text);
      if (se.dash) se.why.push('Gedankenstrich');
      se.sw = sw; se.ww = ww;
    }
    const triads = (text.match(/[\p{L}-]{3,}, [\p{L}-]{3,},? (und|and|y|sowie|oder|or) [\p{L}-]{3,}/giu) || []).length;
    const dashes = s.em + (text.match(/ – /g) || []).length;
    const vocab = per1k(strong + weak * .35);
    const content = Math.max(st.bullet + st.prose, 1);
    const headPer1k = per1k(st.head), bulletShare = st.bullet / content, labelShare = st.label / content;
    const hasStruct = st.lines >= 6;
    const paraLens = st.proseParts.map(p => p.split(/\s+/).length).filter(n => n >= 8);
    const noise = per1k(s.dbl + s.lowStart * 2 + s.multi * 2) + (/(\b\p{L}+\b) \1\b/iu.test(text) ? 1 : 0);
    const realSents = Math.max(prose.sents, 1);

    const sig = [];
    const add = (o) => sig.push(o);
    add({ key: 'rhythm', n: 'Satzrhythmus', w: .17, s: prose.sents >= 5 ? clamp((0.62 - prose.cv) / 0.32) : .45,
      tech: `Variationskoeffizient ${prose.cv.toFixed(2)} · Ø ${prose.sMean.toFixed(1)} Wörter/Satz`,
      ai: `Die Sätze sind auffällig gleich lang (meist um die ${Math.round(prose.sMean)} Wörter). Menschen schreiben unregelmäßiger.`,
      mid: 'Die Satzlängen schwanken mäßig – weder klar menschlich noch klar KI.',
      hu: 'Kurze und lange Sätze wechseln sich stark ab – typisch für Menschen.' });
    add({ key: 'vocab', n: 'Wortwahl', w: .18, s: clamp(vocab / 9),
      tech: `${strong} starke + ${weak} schwache Treffer · ${vocab.toFixed(1)} Punkte / 1000 Wörter`,
      ai: `${strong + weak} Formulierungen, die Sprachmodelle besonders gern benutzen (z. B. „${Object.keys(found)[0] || '–'}“).`,
      mid: `Einige KI-nahe Wörter (${strong + weak}), aber nicht auffällig gehäuft.`,
      hu: 'Kaum typische KI-Formulierungen.' });
    add({ key: 'pattern', n: 'Satzbau-Muster', w: .10, s: clamp(per1k(pat + triads * .25) / 5),
      tech: `${pat} Muster + ${triads} Dreier-Aufzählungen`,
      ai: `${pat} typische KI-Satzmuster wie „nicht X, sondern Y“, „Das Ergebnis: …“ oder Pfeile/Häkchen, dazu viele Dreier-Aufzählungen.`,
      mid: 'Vereinzelt KI-typische Satzmuster.', hu: 'Keine auffälligen KI-Satzmuster.' });
    add({ key: 'trans', n: 'Satzanfänge', w: .08, s: clamp(trans / realSents / 0.15),
      tech: `${trans} von ${full.s.sents} Sätzen beginnen mit Übergangswort`,
      ai: `Viele Sätze starten mit Bindewörtern wie „Darüber hinaus“, „Zudem“, „Insgesamt“ (${trans}×).`,
      mid: `Einige Sätze beginnen mit Übergangswörtern (${trans}×).`, hu: 'Satzanfänge wirken natürlich und abwechslungsreich.' });
    add({ key: 'struct', n: 'Aufbau', w: .16, s: hasStruct ? clamp(0.45 * clamp((headPer1k - 6) / 18) + 0.4 * clamp((bulletShare - 0.08) / 0.35) + 0.3 * clamp(labelShare / 0.15) + clamp(st.bold / 10) * .3) : .3,
      tech: `${st.head} Überschriften (${headPer1k.toFixed(1)}/1000 W.) · ${Math.round(bulletShare * 100)} % Listen · ${st.label} „Stichwort: Erklärung“-Zeilen`,
      ai: `Sehr viel Struktur: ${st.head} Überschriften, ${st.bullet} Listenpunkte, ${st.label} Zeilen im Stil „Stichwort: Erklärung“ – typisch für KI-Dokumente.`,
      mid: 'Etwas mehr Gliederung als in normalem Fließtext.',
      hu: hasStruct ? 'Überwiegend Fließtext mit wenigen Überschriften – wie bei typischen menschlichen Texten.' : 'Reiner Fließtext, keine Gliederung erkennbar.' });
    const uni = [];
    if (st.bLens.length >= 4) uni.push(clamp((0.6 - cvOf(st.bLens)) / 0.4));
    if (paraLens.length >= 4) uni.push(clamp((0.55 - cvOf(paraLens)) / 0.35));
    add({ key: 'uniform', n: 'Gleichförmigkeit', w: .08, s: uni.length ? uni.reduce((a, b) => a + b) / uni.length : .4,
      tech: `Listenpunkte CV ${cvOf(st.bLens).toFixed(2)} · Absätze CV ${cvOf(paraLens).toFixed(2)}`,
      ai: 'Absätze und Listenpunkte sind fast gleich lang – wirkt „aus einem Guss“ generiert.',
      mid: 'Absätze und Listen sind teils gleichförmig.', hu: 'Absätze sind unterschiedlich lang, wie beim natürlichen Schreiben.' });
    add({ key: 'dash', n: 'Gedankenstriche', w: .08, s: clamp((per1k(dashes) - 1.5) / 7),
      tech: `${dashes} Gedankenstriche (${per1k(dashes).toFixed(1)} / 1000 W.)`,
      ai: `Sehr viele Gedankenstriche (${dashes}×) – ein Markenzeichen von ChatGPT und Claude.`,
      mid: `Einige Gedankenstriche (${dashes}×).`, hu: 'Kaum Gedankenstriche.' });
    add({ key: 'clean', n: 'Fehlerfreiheit', w: .08, s: clamp(1 - noise / 5),
      tech: `${noise.toFixed(1)} Tipp-/Flüchtigkeitsspuren / 1000 W.`,
      ai: 'Keinerlei Tippfehler-Spuren, doppelte Leerzeichen oder Flüchtigkeiten – sehr glatt.',
      mid: 'Wenige Flüchtigkeitsspuren.', hu: 'Typisch menschliche Flüchtigkeiten (doppelte Leerzeichen, „!!“, kleine Satzanfänge).' });
    add({ key: 'lex', n: 'Wortschatz', w: .07, s: prose.words >= 100 ? clamp(1 - Math.abs(prose.mattr - 0.74) / 0.12) : .45,
      tech: `MATTR ${prose.mattr.toFixed(2)} · ${(s.tri * 100).toFixed(1)} % wiederholte 3-Wort-Folgen`,
      ai: 'Die Wortvielfalt liegt genau im „mittleren“ Bereich, in dem Sprachmodelle fast immer landen.',
      mid: 'Wortvielfalt im normalen Bereich.', hu: 'Ungewöhnliche Wortvielfalt – eher menschlich.' });

    const raw = sig.reduce((a, x) => a + x.w * x.s, 0);
    let score = 100 / (1 + Math.exp(-(raw - 0.36) * 10));
    const conf = s.words < 80 ? 0 : s.words < 250 ? 1 : s.words < 700 ? 2 : 3;
    if (conf === 0) score = 50 + (score - 50) * 0.4;
    score = Math.round(score);

    for (const se of full.sents) {
      if (se.score < 0) { se.cls = -1; continue; }
      if (se.score > 0.65) se.why.push('gleichmäßiger Satzrhythmus');
      const v = clamp(0.45 * se.score + Math.min(1, se.sw * 0.6 + se.ww * 0.2) * 0.35 + (se.trans ? .15 : 0) + (se.pat ? .2 : 0) + (se.dash ? .1 : 0) - .05);
      se.cls = v < 0.35 ? 0 : v < 0.6 ? 1 : 2;
    }
    return { s, st, sents: full.sents, tail: full.tail, sig, score, conf, lang: L, found, ms: performance.now() - t0 };
  }

  // ---------- UI ----------
  const items = [];
  let active = null;
  const col = v => v < 35 ? 'var(--ok)' : v < 65 ? 'var(--mid)' : 'var(--bad)';
  const VERD = [['Wahrscheinlich von einem Menschen', 'Der Text zeigt die Unregelmäßigkeiten, die für menschliches Schreiben typisch sind.'],
    ['Unklar – teils KI-typisch', 'Es gibt KI-typische Muster, aber keine eindeutige Tendenz. Möglich ist auch ein von Menschen überarbeiteter KI-Text oder umgekehrt.'],
    ['Wahrscheinlich KI-generiert', 'Sehr viele Muster, die für ChatGPT, Claude & Co. typisch sind. Trotzdem nur ein starkes Indiz, kein Beweis.']];
  const CONF = ['sehr gering (zu kurz)', 'gering', 'mittel', 'hoch'];

  function addItem(name, ext) {
    const it = { id: Math.random().toString(36).slice(2), name, ext, state: 'busy' };
    items.unshift(it); renderQueue(); return it;
  }
  function renderQueue() {
    const q = $('queue');
    if (!items.length) { q.innerHTML = '<li class="empty">Noch nichts geprüft.</li>'; return; }
    q.innerHTML = items.map(it => `<li class="qi ${it === active ? 'active' : ''} ${it.state === 'err' ? 'err' : ''}" data-id="${it.id}">
      <span class="ext">${esc(it.ext)}</span><span class="nm" title="${esc(it.name)}">${esc(it.name)}</span>
      ${it.state === 'busy' ? '<span class="spin"></span>' : it.state === 'err' ? '<span class="pct">Fehler</span>'
        : `<span class="pct" style="color:${col(it.res.score)}">${it.res.score}%</span>`}</li>`).join('');
  }
  $('queue').addEventListener('click', e => {
    const li = e.target.closest('.qi'); if (!li) return;
    const it = items.find(x => x.id === li.dataset.id);
    if (it?.state === 'done') show(it); else if (it?.state === 'err') alert(it.name + ':\n' + it.err);
  });

  async function waitEngine() { for (let i = 0; !W && i < 100; i++) await new Promise(r => setTimeout(r, 50)); if (!W) throw new Error('Engine nicht verfügbar'); }
  async function processFile(file) {
    const it = addItem(file.name, file.name.includes('.') ? file.name.split('.').pop() : 'txt');
    try { await waitEngine(); it.doc = /\.(pdf|docx|odt|pptx|rtf)$/i.test(file.name); run(it, await SkyParsers.fileToText(file)); }
    catch (e) { it.state = 'err'; it.err = e.message; renderQueue(); }
  }
  function run(it, text) { it.res = analyze(text); it.state = 'done'; show(it); }

  function show(it) {
    active = it; renderQueue();
    const r = it.res, rep = $('report');
    $('welcome').classList.add('hidden'); rep.classList.remove('hidden');
    rep.classList.remove('scanning'); void rep.offsetWidth; rep.classList.add('scanning');

    const v = r.score < 35 ? 0 : r.score < 65 ? 1 : 2;
    $('fileName').textContent = it.name;
    $('verdict').className = 'v' + v; $('verdict').textContent = VERD[v][0];
    $('verdictText').textContent = VERD[v][1];
    $('bigNum').style.color = col(r.score);
    $('confChip').textContent = 'Aussagekraft: ' + CONF[r.conf];
    $('langChip').textContent = { de: 'Deutsch', en: 'Englisch', es: 'Spanisch' }[r.lang];
    $('timeChip').textContent = 'Scan: ' + r.ms.toFixed(0) + ' ms';
    countUp($('score'), r.score);
    $('marker').style.left = '0%'; void $('marker').offsetWidth; $('marker').style.left = r.score + '%';

    // Warum?
    const ranked = [...r.sig].sort((a, b) => b.w * Math.abs(b.s - .45) - a.w * Math.abs(a.s - .45));
    $('reasons').innerHTML = ranked.map(x => {
      const t = x.s >= .6 ? 2 : x.s <= .3 ? 0 : 1;
      return `<li class="r${t}"><span class="dot"></span><div><b>${x.n}</b><p>${esc([x.hu, x.mid, x.ai][t])}</p></div>
        <span class="pill">${['spricht für Mensch', 'neutral', 'spricht für KI'][t]}</span></li>`;
    }).join('');

    const st = r.st;
    $('stats').innerHTML = [[Math.round(r.s.words).toLocaleString('de'), 'Wörter'], [r.s.sents, 'Sätze'], [st.head, 'Überschriften'],
      [st.bullet, 'Listenpunkte'], [Object.values(r.found).reduce((a, b) => a + b, 0), 'KI-Wörter'], [r.sents.filter(x => x.cls === 2).length, 'rote Sätze']]
      .map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join('');

    const tot = Math.max(st.head + st.bullet + st.prose, 1), pc = n => (n / tot * 100).toFixed(1) + '%';
    $('structure').innerHTML = `<div class="stack"><i class="p" style="width:${pc(st.prose)}"></i><i class="b" style="width:${pc(st.bullet)}"></i><i class="h" style="width:${pc(st.head)}"></i></div>
      <ul class="stack-lbl"><li class="p">Fließtext <b>${st.prose}</b></li><li class="b">Listenpunkte <b>${st.bullet}</b></li><li class="h">Überschriften <b>${st.head}</b></li><li class="l">„Stichwort: Erklärung“ <b>${st.label}</b></li></ul>
      <p class="hint">KI-Dokumente bestehen oft zu großen Teilen aus Überschriften und Stichpunkt-Listen. Menschliche Texte (z. B. Hausarbeiten) sind meist überwiegend Fließtext.</p>`;

    const f = Object.entries(r.found).sort((a, b) => (r.found && LEX[r.lang].map.get(b[0]) || 0) - (LEX[r.lang].map.get(a[0]) || 0) || b[1] - a[1]).slice(0, 30);
    $('phrases').innerHTML = f.length ? f.map(([p, n]) => `<span class="ph ${LEX[r.lang].map.get(p) === 1 ? '' : 'w'}">${esc(p)}<b>×${n}</b></span>`).join('')
      : '<span class="none">Keine typischen KI-Formulierungen gefunden.</span>';

    const MAX = 1500;
    let h = r.sents.slice(0, MAX).map(se => esc(se.gap) + (se.cls < 0 ? se.html
      : `<s class="h${se.cls}" title="${esc(se.why.length ? se.why.join(' · ') : 'unauffällig')}">${se.html}</s>`)).join('');
    h += r.sents.length > MAX ? `<span class="more">… ${r.sents.length - MAX} weitere Sätze ausgeblendet</span>` : esc(r.tail);
    $('highlight').innerHTML = h;

    $('tech').innerHTML = r.sig.map(x => `<div class="trow"><span>${x.n}</span><em>${esc(x.tech)}</em><b>${Math.round(x.s * 100)}</b><small>× ${x.w}</small></div>`).join('');
    if (innerWidth < 900) rep.scrollIntoView({ behavior: 'smooth' });
  }

  function countUp(el, to) {
    const t0 = performance.now();
    const step = t => { const p = Math.min(1, (t - t0) / 1100), e = 1 - Math.pow(1 - p, 3); el.textContent = Math.round(to * e); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step); setTimeout(() => el.textContent = to, 1300);
  }

  // Drag & Drop
  const drop = $('drop');
  ['dragenter', 'dragover'].forEach(ev => addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => addEventListener(ev, e => { e.preventDefault(); if (ev === 'drop' || !e.relatedTarget) drop.classList.remove('over'); }));
  addEventListener('drop', e => [...e.dataTransfer.files].forEach(processFile));
  $('file').addEventListener('change', e => { [...e.target.files].forEach(processFile); e.target.value = ''; });

  // Text einfügen
  $('pasteBtn').onclick = () => { $('modal').classList.remove('hidden'); $('pasteArea').focus(); };
  $('cancelPaste').onclick = () => $('modal').classList.add('hidden');
  $('runPaste').onclick = async () => {
    const t = $('pasteArea').value.trim();
    if (t.split(/\s+/).length < 5) return alert('Bitte mindestens ein paar Sätze einfügen.');
    $('modal').classList.add('hidden');
    const it = addItem('Eingefügter Text ' + new Date().toLocaleTimeString('de').slice(0, 5), 'text');
    try { await waitEngine(); run(it, SkyParsers.reflow(t)); } catch (e) { it.state = 'err'; it.err = e.message; renderQueue(); }
    $('pasteArea').value = '';
  };
  $('clearBtn').onclick = () => { items.length = 0; active = null; renderQueue(); $('report').classList.add('hidden'); $('welcome').classList.remove('hidden'); };

  // Bericht exportieren
  $('exportBtn').onclick = () => {
    if (!active) return;
    const r = active.res, v = r.score < 35 ? 0 : r.score < 65 ? 1 : 2;
    const txt = ['Sky Detect – Bericht', `Datei: ${active.name}`, `Datum: ${new Date().toLocaleString('de')}`, '',
      `Ergebnis: ${r.score} % – ${VERD[v][0]}`, `Aussagekraft: ${CONF[r.conf]}`, '', 'Warum:',
      ...r.sig.map(x => `  - ${x.n} (${x.s >= .6 ? 'spricht für KI' : x.s <= .3 ? 'spricht für Mensch' : 'neutral'}): ${x.s >= .6 ? x.ai : x.s <= .3 ? x.hu : x.mid}`), '',
      'Auffällige Formulierungen: ' + (Object.entries(r.found).map(([p, n]) => `${p} (${n})`).join(', ') || 'keine'), '',
      'Besonders KI-typische Sätze:', ...r.sents.filter(s => s.cls === 2).slice(0, 60).map(s => '  » ' + s.text.replace(/\s+/g, ' ')), '',
      'Hinweis: Heuristische Stilanalyse – ein Indiz, kein Beweis.'].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
    a.download = active.name.replace(/\.[^.]+$/, '') + '_sky-detect.txt';
    a.click(); URL.revokeObjectURL(a.href);
  };
})();
