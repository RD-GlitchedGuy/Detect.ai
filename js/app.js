// Sky Detect – Bewertung & Oberfläche
(() => {
  const $ = id => document.getElementById(id);
  const clamp = x => Math.max(0, Math.min(1, x));
  const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

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

  function core(text) {
    let bytes = enc.encode(text);
    const cap = W.buf_cap();
    if (bytes.length > cap) bytes = bytes.subarray(0, cap);
    new Uint8Array(W.memory.buffer, W.buf_ptr(), bytes.length).set(bytes);
    const o = Array.from(new Float32Array(W.memory.buffer, W.analyze(bytes.length), 27));
    const n = W.sent_count(), m = W.memory.buffer;
    const st = new Uint32Array(m, W.sent_start(), n), en = new Uint32Array(m, W.sent_end(), n);
    const sw = new Uint32Array(m, W.sent_words(), n), sc = new Float32Array(m, W.sent_score(), n);
    const sents = [];
    let prev = 0;
    for (let i = 0; i < n; i++) {
      sents.push({ gap: dec.decode(bytes.subarray(prev, st[i])), text: dec.decode(bytes.subarray(st[i], en[i])), words: sw[i], score: sc[i] });
      prev = en[i];
    }
    const tail = dec.decode(bytes.subarray(prev));
    const k = ['words', 'sents', 'sMean', 'sSd', 'cv', 'wMean', 'wSd', 'mattr', 'tri', 'paras', 'paraCv',
      'em', 'en', 'semi', 'colon', 'excl', 'quest', 'comma', 'paren', 'ell', 'dbl', 'lowStart', 'curly',
      'straight', 'bullets', 'allSents', 'multi'];
    const s = {}; k.forEach((key, i) => s[key] = o[i]);
    return { s, sents, tail };
  }

  // ---------- Phrasen-Lexikon (DE / EN / ES) ----------
  const PH = {
    de: ['zusammenfassend lässt sich sagen', 'zusammenfassend lässt sich festhalten', 'abschließend lässt sich sagen',
      'es ist wichtig zu beachten', 'es ist wichtig zu betonen', 'es ist erwähnenswert', 'es sei darauf hingewiesen',
      'spielt eine entscheidende rolle', 'spielt eine zentrale rolle', 'spielt eine wichtige rolle', 'eine entscheidende rolle',
      'von entscheidender bedeutung', 'von zentraler bedeutung', 'von großer bedeutung', 'in der heutigen zeit',
      'in der heutigen schnelllebigen', 'in einer zunehmend', 'in einer sich ständig wandelnden', 'vielschichtig',
      'facettenreich', 'ganzheitlich', 'nahtlos', 'unterstreicht', 'unterstreichen', 'eintauchen', 'tauchen wir ein',
      'ein weiterer wichtiger aspekt', 'ein zentraler aspekt', 'nicht zuletzt', 'darüber hinaus', 'insgesamt zeigt sich',
      'dies verdeutlicht', 'dies unterstreicht', 'dies zeigt deutlich', 'beleuchtet', 'im folgenden werden',
      'zahlreiche möglichkeiten', 'vielfältige möglichkeiten', 'eine wichtige grundlage', 'wertvolle einblicke',
      'maßgeblich', 'zeitgemäß', 'nachhaltig zu gestalten', 'im kontext von', 'einen wichtigen beitrag',
      'gleichermaßen', 'im hinblick auf', 'stellt sicher', 'es lässt sich festhalten'],
    en: ['delve', 'delves', 'delving', 'tapestry', 'it is important to note', "it's important to note", 'it is worth noting',
      "it's worth noting", 'in conclusion', 'in summary', 'plays a crucial role', 'plays a pivotal role', 'plays a vital role',
      'a testament to', 'navigate the complexities', 'navigating the complexities', "in today's fast-paced",
      "in today's digital", 'in the realm of', 'ever-evolving', 'ever-changing', 'multifaceted', 'pivotal', 'underscores',
      'underscore', 'seamless', 'seamlessly', 'leverage', 'leveraging', 'holistic', 'intricate', 'intricacies', 'nuanced',
      'foster', 'fostering', 'embark', 'showcasing', 'showcases', 'vibrant', 'landscape',
      'paramount', 'meticulous', 'meticulously', 'commendable', 'invaluable', 'unwavering', 'bustling', 'realm',
      'a myriad of', 'shed light', 'sheds light', 'valuable insights', 'key takeaways', 'game-changer',
      'unlock the potential', 'harness the power', 'at the end of the day', 'serves as a', 'stands as a', 'resonate'],
    es: ['en conclusión', 'en resumen', 'es importante destacar', 'es importante señalar', 'cabe destacar', 'cabe señalar',
      'vale la pena mencionar', 'juega un papel crucial', 'juega un papel fundamental', 'desempeña un papel fundamental',
      'desempeña un papel crucial', 'un papel clave', 'en el mundo actual', 'en la actualidad', 'en un mundo cada vez más',
      'multifacético', 'multifacética', 'holístico', 'holística', 'sin lugar a dudas', 'profundizar', 'adentrarnos', 'panorama', 'un testimonio de', 'fomentar', 'aprovechar', 'de manera significativa',
      'de manera integral', 'valiosas perspectivas', 'en definitiva', 'crucial']
  };
  const TRANS = {
    de: ['darüber hinaus', 'zudem', 'außerdem', 'des weiteren', 'ferner', 'insgesamt', 'zusammenfassend', 'abschließend',
      'letztlich', 'letztendlich', 'gleichzeitig', 'dennoch', 'folglich', 'somit', 'allerdings', 'nichtsdestotrotz', 'zunächst', 'schließlich'],
    en: ['furthermore', 'moreover', 'additionally', 'in addition', 'overall', 'ultimately', 'consequently', 'however',
      'in conclusion', 'importantly', 'notably', 'similarly', 'conversely', 'thus', 'therefore', 'finally', 'firstly', 'secondly'],
    es: ['además', 'asimismo', 'por otro lado', 'sin embargo', 'en conclusión', 'en resumen', 'por lo tanto', 'finalmente',
      'en primer lugar', 'por último', 'de igual manera', 'no obstante', 'en definitiva']
  };
  const STOP = {
    de: /\b(der|die|das|und|ist|nicht|ein|eine|mit|auch|sich|dass|wird|werden)\b/gi,
    en: /\b(the|and|is|of|to|that|it|with|are|this|for|was|be)\b/gi,
    es: /\b(el|la|los|las|que|y|es|del|por|una|con|para|se)\b/gi
  };
  const re = {};
  const mkRe = list => new RegExp('(?<![\\p{L}\\p{N}])(' + list.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['’]")).sort((a, b) => b.length - a.length).join('|') + ')(?![\\p{L}\\p{N}])', 'giu');
  for (const l in PH) { re[l] = mkRe(PH[l]); re['t' + l] = new RegExp('^\\W*(' + TRANS[l].join('|') + ')(?![\\p{L}])', 'iu'); }

  function lang(t) {
    const sample = t.slice(0, 20000); let best = 'en', bv = -1;
    for (const l in STOP) { const v = (sample.match(STOP[l]) || []).length; if (v > bv) { bv = v; best = l; } }
    return best;
  }

  // ---------- Gesamtbewertung ----------
  function analyze(text) {
    const t0 = performance.now();
    const { s, sents, tail } = core(text);
    const L = lang(text), per1k = x => x / Math.max(s.words, 1) * 1000;
    const found = {};
    let phraseHits = 0, transStarts = 0;
    for (const se of sents) {
      se.hits = 0;
      se.html = esc(se.text).replace(re[L], m => { phraseHits++; se.hits++; const k = m.toLowerCase(); found[k] = (found[k] || 0) + 1; return '<mark>' + m + '</mark>'; });
      se.trans = se.words >= 3 && re['t' + L].test(se.text);
      if (se.trans) transStarts++;
    }
    const bold = (text.match(/\*\*[^*\n]+\*\*/g) || []).length + (text.match(/^#{1,4} /gm) || []).length;
    const realSents = Math.max(s.sents, 1);
    const noise = per1k(s.dbl + s.lowStart * 2 + s.multi * 2) + (/(\b\w+\b) \1\b/i.test(text) ? 1 : 0);

    const sig = [
      { n: 'Satzrhythmus', v: 'CV ' + s.cv.toFixed(2), w: .24, s: s.sents >= 5 ? clamp((0.62 - s.cv) / 0.32) : .5,
        d: 'KI schreibt Sätze gleichmäßig lang, Menschen wechseln stärker ab (Burstiness).' },
      { n: 'KI-Phrasen', v: per1k(phraseHits).toFixed(1) + ' / 1000 W.', w: .24, s: clamp(per1k(phraseHits) / 7),
        d: 'Formeln wie „spielt eine entscheidende Rolle“, „delve“, „cabe destacar“.' },
      { n: 'Übergangswörter am Satzanfang', v: Math.round(transStarts / realSents * 100) + ' %', w: .12, s: clamp(transStarts / realSents / 0.18),
        d: '„Darüber hinaus“, „Moreover“, „Además“ am Satzanfang sind ein KI-Klassiker.' },
      { n: 'Absatz-Gleichförmigkeit', v: s.paras >= 4 ? 'CV ' + s.paraCv.toFixed(2) : 'zu wenig Absätze', w: .10,
        s: s.paras >= 4 ? clamp((0.55 - s.paraCv) / 0.35) : .4, d: 'Gleich lange Absätze wirken generiert.' },
      { n: 'Glätte (keine Tippfehler-Spuren)', v: noise.toFixed(1) + ' Spuren / 1000 W.', w: .08, s: clamp(1 - noise / 5),
        d: 'Doppelte Leerzeichen, kleine Satzanfänge, „!!“ – typisch menschlich.' },
      { n: 'Gedankenstriche (—)', v: per1k(s.em).toFixed(1) + ' / 1000 W.', w: .08, s: clamp(per1k(s.em) / 4),
        d: 'Lange Gedankenstriche sind ein auffälliges Merkmal moderner Chatbots.' },
      { n: 'Chat-Formatierung', v: (s.bullets + bold) + ' Elemente', w: .08, s: clamp((s.bullets + bold * 1.5) / Math.max(s.allSents, 1) * 2.5),
        d: 'Aufzählungen, **Fettdruck** und #-Überschriften aus Chat-Antworten.' },
      { n: 'Wortschatz (MATTR)', v: s.mattr.toFixed(2), w: .06, s: s.words >= 100 ? clamp(1 - Math.abs(s.mattr - 0.74) / 0.12) : .5,
        d: 'KI liegt oft in einem engen „mittleren“ Vielfalts-Korridor.' }
    ];
    const raw = sig.reduce((a, x) => a + x.w * x.s, 0);
    let score = 100 / (1 + Math.exp(-(raw - 0.42) * 9));
    const conf = s.words < 60 ? 0 : s.words < 200 ? 1 : s.words < 600 ? 2 : 3;
    if (conf === 0) score = 50 + (score - 50) * 0.4;                       // kurze Texte: Richtung "unklar"
    score = Math.round(score);

    for (const se of sents) {
      if (se.score < 0) { se.cls = -1; continue; }
      const v = clamp(0.62 * se.score + Math.min(1, se.hits * 0.5) * 0.4 + (se.trans ? 0.15 : 0) + (/—/.test(se.text) ? 0.1 : 0) - 0.1);
      se.cls = v < 0.4 ? 0 : v < 0.65 ? 1 : 2;
    }
    return { s, sents, tail, sig, score, conf, lang: L, found, ms: performance.now() - t0 };
  }

  // ---------- UI ----------
  const items = [];
  let active = null;

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
  const col = v => v < 30 ? 'var(--ok)' : v < 60 ? 'var(--mid)' : 'var(--bad)';

  $('queue').addEventListener('click', e => {
    const li = e.target.closest('.qi'); if (!li) return;
    const it = items.find(x => x.id === li.dataset.id);
    if (it?.state === 'done') show(it);
    else if (it?.state === 'err') alert(it.name + ':\n' + it.err);
  });

  async function waitEngine() { for (let i = 0; !W && i < 100; i++) await new Promise(r => setTimeout(r, 50)); if (!W) throw new Error('Engine nicht verfügbar'); }

  async function processFile(file) {
    const it = addItem(file.name, file.name.includes('.') ? file.name.split('.').pop() : 'txt');
    try {
      await waitEngine();
      const text = await SkyParsers.fileToText(file);
      run(it, text);
    } catch (e) { it.state = 'err'; it.err = e.message; renderQueue(); }
  }

  function run(it, text) {
    it.res = analyze(text); it.state = 'done';
    show(it);
  }

  function show(it) {
    active = it; renderQueue();
    const r = it.res, rep = $('report');
    $('welcome').classList.add('hidden'); rep.classList.remove('hidden');
    rep.classList.remove('scanning'); void rep.offsetWidth; rep.classList.add('scanning');

    $('fileName').textContent = it.name;
    const v = r.score < 30 ? 0 : r.score < 60 ? 1 : 2;
    $('verdict').className = 'v' + v;
    $('verdict').textContent = ['Wahrscheinlich menschlich', 'Gemischt / unklar', 'Wahrscheinlich KI-generiert'][v];
    $('verdictText').textContent = [
      'Der Text zeigt die Unregelmäßigkeiten, die für menschliches Schreiben typisch sind.',
      'Einige KI-typische Muster, aber keine klare Tendenz – möglich ist auch ein überarbeiteter Text.',
      'Viele Muster, die für Sprachmodelle typisch sind. Trotzdem nur ein Indiz, kein Beweis.'][v];
    $('confChip').textContent = 'Aussagekraft: ' + ['sehr gering', 'gering', 'mittel', 'hoch'][r.conf];
    $('langChip').textContent = 'Sprache: ' + { de: 'Deutsch', en: 'Englisch', es: 'Spanisch' }[r.lang];
    $('timeChip').textContent = 'C++-Scan: ' + r.ms.toFixed(0) + ' ms';

    const bar = $('gaugeBar'), C = 527.8;
    bar.style.transition = 'none'; bar.style.strokeDashoffset = C; void bar.getBoundingClientRect();
    bar.style.transition = ''; bar.style.strokeDashoffset = C * (1 - r.score / 100);
    countUp($('score'), r.score);

    const st = r.s;
    $('stats').innerHTML = [
      [Math.round(st.words).toLocaleString('de'), 'Wörter'], [st.sents, 'Sätze'], [st.sMean.toFixed(1), 'Ø Wörter/Satz'],
      [st.wMean.toFixed(1), 'Ø Zeichen/Wort'], [(st.tri * 100).toFixed(1) + '%', 'Wiederholte 3-Gramme'],
      [Math.max(1, Math.round(st.words / 230)) + ' min', 'Lesezeit']
    ].map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join('');

    $('signals').innerHTML = r.sig.map(x => `<div class="sig" title="${esc(x.d)}">
      <div class="sig-top"><span>${x.n}</span><em>${esc(x.v)}</em></div>
      <div class="sig-bar"><i data-w="${Math.round(x.s * 100)}" style="--bs:${x.s > 0 ? 100 / x.s : 100}%"></i></div>
      <small>${esc(x.d)}</small></div>`).join('');
    requestAnimationFrame(() => document.querySelectorAll('.sig-bar i').forEach(i => i.style.width = i.dataset.w + '%'));

    const f = Object.entries(r.found).sort((a, b) => b[1] - a[1]).slice(0, 30);
    $('phrases').innerHTML = f.length ? f.map(([p, n]) => `<span class="ph">${esc(p)}<b>×${n}</b></span>`).join('')
      : '<span class="none">Keine typischen KI-Phrasen gefunden.</span>';

    const MAX = 1500;
    let h = r.sents.slice(0, MAX).map(se => esc(se.gap) + (se.cls < 0 ? se.html
      : `<s class="h${se.cls}" title="Satz-Score: ${Math.round(se.score * 100)}">${se.html}</s>`)).join('');
    h += r.sents.length > MAX ? `<span class="more">… ${r.sents.length - MAX} weitere Sätze ausgeblendet</span>` : esc(r.tail);
    $('highlight').innerHTML = h;
    if (innerWidth < 900) rep.scrollIntoView({ behavior: 'smooth' });
  }

  function countUp(el, to) {
    const t0 = performance.now();
    const step = t => { const p = Math.min(1, (t - t0) / 1200), e = 1 - Math.pow(1 - p, 3); el.textContent = Math.round(to * e); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
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
    const r = active.res;
    const txt = [`Sky Detect – Bericht`, `Datei: ${active.name}`, `Datum: ${new Date().toLocaleString('de')}`, '',
      `KI-Wahrscheinlichkeit (Heuristik): ${r.score} %`, `Aussagekraft: ${['sehr gering', 'gering', 'mittel', 'hoch'][r.conf]}`, '',
      'Signale:', ...r.sig.map(x => `  - ${x.n}: ${x.v} → ${Math.round(x.s * 100)}/100`), '',
      'KI-Phrasen: ' + (Object.entries(r.found).map(([p, n]) => `${p} (${n})`).join(', ') || 'keine'), '',
      'Satz-Markierung (KI-typisch):', ...r.sents.filter(s => s.cls === 2).slice(0, 60).map(s => '  » ' + s.text.replace(/\s+/g, ' ')), '',
      'Hinweis: Heuristische Stilanalyse – ein Indiz, kein Beweis.'].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
    a.download = active.name.replace(/\.[^.]+$/, '') + '_sky-detect.txt';
    a.click(); URL.revokeObjectURL(a.href);
  };
})();
