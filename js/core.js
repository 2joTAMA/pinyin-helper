/* ===== 共通部品：画面の要素・表示設定・ピンイン変換・保存データ・どのページでも使う部品 ===== */
// ---------- element refs ----------
const input = document.getElementById('zhInput');
const results = document.getElementById('results');
const inputPageTop = document.querySelector('#inputScreen > .pageTop');
const clearBtn = document.getElementById('clearBtn');
const undoBtn = document.getElementById('undoBtn');
const surume = document.getElementById('surume');

const saveBtn = document.getElementById('saveBtn');
const fileTitle = document.getElementById('fileTitle');
const renameBtn = document.getElementById('renameBtn');

const focusToggle = document.getElementById('focusToggle');

const wordSheet = document.getElementById('wordSheet');
const wordSheetList = document.getElementById('wordSheetList');

const saveModal = document.getElementById('saveModal');
const modalHeading = document.getElementById('modalHeading');
const modalTitleInput = document.getElementById('modalTitleInput');
const modalClearBtn = document.getElementById('modalClearBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalSaveBtn = document.getElementById('modalSaveBtn');

const listScreen = document.getElementById('listScreen');
const newBtn = document.getElementById('newBtn');
const listRows = document.getElementById('listRows');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFileInput = document.getElementById('importFileInput');

const tabBar = document.getElementById('tabBar');
const tabIndicator = document.getElementById('tabIndicator');
const tabItems = Array.from(document.querySelectorAll('.tabItem'));

const wordbookScreen = document.getElementById('wordbookScreen');
const wordbookDisplayToggles = wordbookScreen.querySelector('.displayToggles');
const wordSelectToggleBtn = document.getElementById('wordSelectToggleBtn');
const wordAddClearBtn = document.getElementById('wordAddClearBtn');
const allKanjiAddClearBtn = document.getElementById('allKanjiAddClearBtn');
const wordMarkPersonBtn = document.getElementById('wordMarkPersonBtn');
const wordUnmarkPersonBtn = document.getElementById('wordUnmarkPersonBtn');
const wordDeleteBtn = document.getElementById('wordDeleteBtn');
const wordSelectCount = document.getElementById('wordSelectCount');
const wordAddInput = document.getElementById('wordAddInput');
const wordGrid = document.getElementById('wordGrid');
const wordbookIndex = document.getElementById('wordbookIndex');
const wordScrollTopBtn = document.getElementById('wordScrollTopBtn');
const wordSortBtns = Array.from(document.querySelectorAll('.wordSortBtn'));
const wordSortThumb = document.querySelector('#wordSortBar .segThumb');

const allKanjiScreen = document.getElementById('allKanjiScreen');
const allKanjiAddInput = document.getElementById('allKanjiAddInput');
const allKanjiGrid = document.getElementById('allKanjiGrid');
const allKanjiIndex = document.getElementById('allKanjiIndex');

const folderPicker = document.getElementById('folderPicker');
const folderPickerList = document.getElementById('folderPickerList');
const folderPickerCancel = document.getElementById('folderPickerCancel');

const nameModal = document.getElementById('nameModal');
const nameModalHeading = document.getElementById('nameModalHeading');
const nameModalInput = document.getElementById('nameModalInput');
const nameModalCancel = document.getElementById('nameModalCancel');
const nameModalOk = document.getElementById('nameModalOk');

// ================= pinyin-proの準備・簡体字への正規化・日本の字体での表示 =================
const pp = window.pinyinPro;
if (pp && pp.customPinyin) {
  try { pp.customPinyin(CUSTOM_WORDS); } catch (e) { /* noop */ }
}

const HANZI_RE = /[一-鿿㐀-䶿]/;

// 日本語漢字(新字体など)を中国語簡体字の対応字に正規化する
function normalizeToSimplified(text) {
  let out = '';
  for (const ch of text) {
    const mapped = KANJI_MAP[ch];
    out += (mapped && mapped !== ch) ? mapped : ch;
  }
  return out;
}

// 中国語簡体字→日本の字体（表示専用）。KANJI_MAPの逆引きで作る。
// 1つの簡体字に複数の日本字体が対応するケースは、KANJI_MAP内で先に見つかった方を採用する
// （同じ字の新字体／旧字体のペアでは大抵 新字体の方が先に見つかる）。
const JA_KANJI_MAP = (() => {
  const rev = {};
  for (const ja in KANJI_MAP) {
    const cn = KANJI_MAP[ja];
    if (cn === ja) continue;
    if (!(cn in rev)) rev[cn] = ja;
  }
  return rev;
})();
function toJapaneseKanji(text) {
  let out = '';
  for (const raw of text) {
    // 「晴」(U+FA12)のような互換漢字は見た目が旧字体でも中身は同じ字なので、先に通常の字(U+6674など)へ正規化する
    const ch = raw.normalize('NFC');
    if (JA_KANJI_PREFERRED[ch]) out += JA_KANJI_PREFERRED[ch];
    else if (JA_KANJI_NO_CONVERT.has(ch)) out += ch;
    else out += JA_KANJI_MAP[ch] || ch;
  }
  return out;
}
// elの中身をtextで置き換える。日本漢字表示ONのときは、実際に字形が変わった文字だけ
// <span class="jaChanged">で包んで色を付ける（変わらない文字は普通のテキストのまま）。
function renderDisplayText(el, text) {
  el.textContent = '';
  // 書体が見つからず代わりの書体で表示されるときも、字形（着の縦棒など）が中国式／日本式になるように言語を指定する
  el.lang = state.jaKanjiOn ? 'ja' : 'zh-CN';
  if (!state.jaKanjiOn) {
    el.textContent = text;
    return;
  }
  for (const ch of text) {
    const converted = toJapaneseKanji(ch);
    if (converted !== ch) {
      const span = document.createElement('span');
      span.className = 'jaChanged';
      span.textContent = converted;
      el.appendChild(span);
    } else {
      el.appendChild(document.createTextNode(ch));
    }
  }
}

// ---------- app state ----------
const state = {
  tab: 'input',          // 表示中のページ：'list' | 'input' | 'wordbook' | 'allKanji'
  toneType: 'symbol',    // 'symbol' | 'num' (どちらか一方のみ表示。併記はしない。'num'に切り替えるボタンは今は出していない)
  contourOn: false,      // true のときはアルファベットを隠し、声調を高低カーブのSVG記号で表示する
  pinyinOff: false,      // true のときはピンインも声調カーブも一切表示しない（contourOnとは同時にtrueにならない）
  focusMode: false,
  jaKanjiOn: false,      // true のときは漢字の表示だけ日本の字体に変換する（内部データ・ピンイン計算には影響しない）
};

// ================= 変換結果のキャッシュ =================
// pinyin-proの変換は1回なら速いが、単語帳の描画・並び替えでは同じ単語を何千回も変換することになるので、
// 結果を覚えておく（読みは単語と表記の種類だけで決まり、途中で変わらない）。
// 入力欄の文章も通るので、件数が増えすぎたら丸ごと捨てて作り直す。
// 返す配列・オブジェクトは共有されるので、呼び出し側で書き換えないこと。
const CACHE_LIMIT = 20000;
function memo(map, key, compute) {
  if (map.has(key)) return map.get(key);
  const value = compute();
  if (map.size >= CACHE_LIMIT) map.clear();
  map.set(key, value);
  return value;
}
const segmentCache = new Map();
// textを単語区切りつきで変換した結果（pp.segmentのAllArray形式）。失敗したら[]
function segmentCached(text, toneType) {
  return memo(segmentCache, toneType + '\u0000' + text, () => {
    if (!pp || !pp.segment) return [];
    try {
      return pp.segment(text, { format: pp.OutputFormat.AllArray, toneType: toneType });
    } catch (e) { return []; }
  });
}

// ================= pinyin table order (ju/qu/xu のような並び用) =================
const INITIAL_LIST = ['zh','ch','sh','b','p','m','f','d','t','n','l','g','k','h','j','q','x','r','z','c','s','y','w'];
const INITIAL_ORDER = ['b','p','m','f','d','t','n','l','g','k','h','j','q','x','zh','ch','sh','r','z','c','s','y','w',''];
const FINAL_ORDER = [
  'a','o','e','ai','ei','ao','ou','an','en','ang','eng','ong','er',
  'i','ia','ie','iao','iu','ian','in','iang','ing','iong',
  'u','ua','uo','uai','ui','uan','un','uang','ueng',
  'v','ve','van','vn'
];

function splitPinyinBase(base) {
  for (const ini of INITIAL_LIST) {
    if (base.indexOf(ini) === 0 && base.length > ini.length) {
      let final = base.slice(ini.length).replace(/^ü/, 'v');
      if ((ini === 'j' || ini === 'q' || ini === 'x') && final.charAt(0) === 'u') {
        final = 'v' + final.slice(1);
      }
      return { initial: ini, final: final };
    }
  }
  return { initial: '', final: base.replace(/^ü/, 'v') };
}

function pinyinGroupRank(base) {
  const parts = splitPinyinBase(base || '');
  let ir = INITIAL_ORDER.indexOf(parts.initial);
  if (ir < 0) ir = INITIAL_ORDER.length;
  let fr = FINAL_ORDER.indexOf(parts.final);
  if (fr < 0) fr = FINAL_ORDER.length;
  return [ir, fr];
}

function compareGroupKeys(a, b) {
  const ra = pinyinGroupRank(a);
  const rb = pinyinGroupRank(b);
  if (ra[0] !== rb[0]) return ra[0] - rb[0];
  if (ra[1] !== rb[1]) return ra[1] - rb[1];
  return a < b ? -1 : a > b ? 1 : 0;
}

// ================= pinyin lookup helpers =================
const basePinyinCache = new Map();
function getBasePinyin(ch) {
  return memo(basePinyinCache, ch, () => {
    if (!pp || !pp.pinyin) return '';
    try { return pp.pinyin(ch, { toneType: 'none', multiple: false }) || ''; } catch (e) { return ''; }
  });
}
// 声調の数字1文字だけ取り出す（全漢字ページの漢字カードの声調表示に使う）
const toneDigitCache = new Map();
function getToneDigit(ch) {
  return memo(toneDigitCache, ch, () => {
    if (!pp || !pp.pinyin) return '';
    try {
      const withNum = pp.pinyin(ch, { toneType: 'num', multiple: false }) || '';
      // pinyin-proは軽声を末尾「0」で表す（「5」ではない）ので両方拾う
      const m = withNum.match(/([0-5])$/);
      return m ? m[1] : '';
    } catch (e) { return ''; }
  });
}
// 単語の中で各漢字が実際にどう読まれているか（声調なしの音と声調番号）。単語ごとに結果をキャッシュする
const wordReadingCache = new Map();
function getWordCharReadings(word) {
  return memo(wordReadingCache, word, () =>
    segmentCached(word, 'num').reduce((acc, g) => acc.concat(g), []).map(({ origin, result }) => {
      const m = /^(.*?)([0-5])?$/.exec(result || '');
      return { ch: origin, base: m[1], tone: normalizeToneDigit(m[2] || '') };
    }));
}
// 漢字の読みを「声調なしの音 → 代表の声調」のMapで返す（全漢字ページ用）。
// 標準の読み（pinyin-proの多音字リストの先頭。1文字単独での変換だと「了」がliǎoになるため使わない）は
// 常に入れ、それ以外の読みは単語帳にその読みで
// 使われている単語があるときだけ入れる（あまり使わない読みまで並ぶとノイズになるため）。
// 声調は辞書のその音の最初の軽声以外の声調を代表にし（好 hǎo/hào → 3声）、軽声でしか読まない音だけ'0'。
// 辞書に無い読み（カスタム読み等）は単語の中で実際に読まれている声調を使う。
function getCharReadings(ch) {
  const dictTones = new Map();
  let standardBase = '';
  if (pp && pp.pinyin) {
    try {
      pp.pinyin(ch, { toneType: 'num', multiple: true, type: 'array' }).forEach((r) => {
        const m = /^(.*?)([0-5])?$/.exec(r || '');
        const base = m[1];
        const tone = normalizeToneDigit(m[2] || '');
        if (!base) return;
        if (!standardBase) standardBase = base;
        if (!dictTones.has(base) || (dictTones.get(base) === '0' && tone !== '0')) dictTones.set(base, tone);
      });
    } catch (e) { /* noop */ }
  }
  const readings = new Map();
  const add = (base, tone) => {
    if (!base || readings.has(base)) return;
    readings.set(base, dictTones.has(base) ? dictTones.get(base) : tone);
  };
  if (standardBase) add(standardBase, '');
  else add(getBasePinyin(ch), normalizeToneDigit(getToneDigit(ch)));
  wordsContaining(ch).forEach((w) => {
    getWordCharReadings(w).forEach((r) => { if (r.ch === ch) add(r.base, r.tone); });
  });
  return readings;
}
// 出現頻度の順位（小さいほどよく使う）。頻度表に無い漢字は表の後ろ扱い
let charFreqRankMap = null;
function charFreqRank(ch) {
  if (!charFreqRankMap) {
    charFreqRankMap = new Map();
    Array.from(typeof CHAR_FREQ_ORDER === 'string' ? CHAR_FREQ_ORDER : '').forEach((c, i) => charFreqRankMap.set(c, i));
  }
  return charFreqRankMap.has(ch) ? charFreqRankMap.get(ch) : charFreqRankMap.size;
}
// 漢字 → その漢字を含む登録単語の一覧（単語帳と同じ並び）の索引。
// 全漢字ページでは漢字1字ごとに引くので、毎回全単語を調べずに済むよう一度だけ作る。
// 単語帳が変わったら（persistWords）捨てて、次に使うときに作り直す。
let wordsByCharIndex = null;
function wordsContaining(ch) {
  if (!wordsByCharIndex) {
    wordsByCharIndex = new Map();
    savedWords.forEach((w) => {
      new Set(w).forEach((c) => {
        if (!wordsByCharIndex.has(c)) wordsByCharIndex.set(c, []);
        wordsByCharIndex.get(c).push(w);
      });
    });
  }
  return wordsByCharIndex.get(ch) || [];
}
// その漢字を含む単語のうち、base指定時はその漢字がbaseの音で読まれている単語だけを返す
function wordsForChar(ch, base) {
  const list = wordsContaining(ch);
  if (!base) return list;
  return list.filter((w) => getWordCharReadings(w).some((r) => r.ch === ch && r.base === base));
}
// 声調カーブの記号を出す：data-toneに声調番号を入れると、CSS（[data-tone]）がその形を描く。
// 声調が分からないとき（''）は何も描かない
function setToneContour(el, digit) {
  if (digit) el.dataset.tone = digit;
}
// datasetの名前（groupKey）をHTMLの属性名（data-group-key）にする
function dataAttrName(key) {
  return 'data-' + key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 単語区切りを考慮してピンインを組み立てる（単語内はくっつけ、単語間はスペース）
function lineToPinyin(normalizedLine) {
  if (!pp || !pp.segment) return '';
  return segmentCached(normalizedLine, state.toneType)
    .map((group) => group.map((g) => g.result).join(''))
    .join(' ');
}

// 漢字1文字ずつの下にその声調カーブSVGを揃えて配置する行を作る（アルファベット非表示のとき共通で使う）
function appendContourCols(row, text) {
  const groups = segmentCached(text, 'num');
  const chars = groups.length
    ? groups.reduce((acc, g) => acc.concat(g), [])
    : Array.from(text).map((c) => ({ origin: c, result: c }));

  chars.forEach(({ origin, result }) => {
    const col = document.createElement('span');
    col.className = 'cCol';

    const charEl = document.createElement('span');
    charEl.className = 'cChar';
    renderDisplayText(charEl, origin);
    col.appendChild(charEl);

    const toneEl = document.createElement('span');
    toneEl.className = 'cTone';
    const m = /([0-5])$/.exec(result || '');
    if (m) setToneContour(toneEl, m[1]);
    col.appendChild(toneEl);

    row.appendChild(col);
  });
}

// 入力ページ用：行全体を漢字＋声調カーブの行にする
function buildContourBlock(normalizedLine) {
  const block = document.createElement('div');
  block.className = 'lineBlock contourBlock';

  const row = document.createElement('div');
  row.className = 'contourRow';
  appendContourCols(row, normalizedLine);

  block.appendChild(row);
  return block;
}

// 単語帳用：チップの中に収まる小さめの漢字＋声調カーブの行を作る
function buildWordContourRow(word) {
  const row = document.createElement('div');
  row.className = 'contourRow wordChipContourRow';
  appendContourCols(row, word);
  return row;
}

// ================= 右端の目次で「今見ている場所」の文字に色を付ける（全漢字・単語帳で共用） =================
// 各グループの上端の位置は描画後に一度だけ測って覚えておき、スクロールのたびにはその数値と比べるだけにする
// （スクロール中にレイアウトを測り直さないので軽い）。描き直し・上部の高さの変化・画面サイズの変化で測り直す。
// opts: screen（ページ）, grid（スクロールする一覧）, index（目次）, groupSelector（グループの要素）,
//       key（グループと目次の項目を対応づけるdata属性。dataset上の名前）
function createIndexHighlighter(opts) {
  let tops = null;      // [{ key, top }]（上から順。一覧の中での位置）
  let currentKey;       // 今色を付けている項目
  let ticking = false;
  function measure() {
    const gridTop = opts.grid.getBoundingClientRect().top - opts.grid.scrollTop;
    tops = Array.prototype.map.call(opts.grid.querySelectorAll(opts.groupSelector), (g) => ({
      key: g.dataset[opts.key],
      top: g.getBoundingClientRect().top - gridTop,
    }));
  }
  function update() {
    ticking = false;
    if (opts.screen.hidden || opts.index.hidden) return;
    if (!tops) measure();
    if (!tops.length) return;
    // 上部（すりガラスのヘッダー）のすぐ下の線より上から始まっている、一番下のグループ＝今見ているグループ
    const line = opts.grid.scrollTop + (parseFloat(getComputedStyle(opts.grid).scrollPaddingTop) || 0) + 8;
    let lo = 0, hi = tops.length - 1, found = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (tops[mid].top <= line) { found = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    const key = tops[found].key;
    if (key === currentKey) return;
    currentKey = key;
    Array.prototype.forEach.call(opts.index.children, (item) => {
      item.classList.toggle('current', item.dataset[opts.key] === key);
    });
  }
  opts.grid.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }, { passive: true });
  window.addEventListener('resize', () => { tops = null; });
  return {
    // 一覧を描き直したときや、位置が変わったときに呼ぶ
    refresh() {
      tops = null;
      currentKey = undefined;
      requestAnimationFrame(update);
    },
  };
}
// scrollerの中のelが、上部（すりガラスのヘッダー）のすぐ下に来るようにscrollerだけをスクロールする。
// scrollIntoViewはページ全体（html）まで動かしてしまい、画面ごと上にずれることがあるので使わない
function scrollChildToTop(scroller, el) {
  const topH = parseFloat(getComputedStyle(scroller).scrollPaddingTop) || 0;
  scroller.scrollTop += el.getBoundingClientRect().top - scroller.getBoundingClientRect().top - topH;
}

// 右端の目次をタップ／なぞって、その項目のグループの先頭へジャンプする（全漢字・単語帳で共用）。
// opts: index（目次）, itemSelector（目次の項目）, grid（スクロールする一覧）, groupSelector（グループの要素）,
//       key（グループと目次の項目を対応づけるdata属性。dataset上の名前）
function attachSideIndexJump(opts) {
  function jump(item) {
    const sel = opts.groupSelector + '[' + dataAttrName(opts.key) + '="' + CSS.escape(item.dataset[opts.key]) + '"]';
    const target = opts.grid.querySelector(sel);
    if (target) scrollChildToTop(opts.grid, target);
  }
  function itemAt(x, y) {
    const el = document.elementFromPoint(x, y);
    return el ? el.closest(opts.itemSelector) : null;
  }
  // なぞっている間は、指の下の項目を強調する
  let activeEl = null;
  function setActive(item) {
    if (activeEl && activeEl !== item) activeEl.classList.remove('active');
    activeEl = item || null;
    if (activeEl) activeEl.classList.add('active');
  }
  opts.index.addEventListener('click', (e) => {
    const item = e.target.closest(opts.itemSelector);
    if (item) jump(item);
  });
  opts.index.addEventListener('touchstart', (e) => {
    const item = itemAt(e.touches[0].clientX, e.touches[0].clientY);
    if (item) { jump(item); setActive(item); }
  }, { passive: true });
  opts.index.addEventListener('touchmove', (e) => {
    const item = itemAt(e.touches[0].clientX, e.touches[0].clientY);
    if (item && item !== activeEl) { jump(item); setActive(item); }
    e.preventDefault();
  }, { passive: false });
  opts.index.addEventListener('touchend', () => setActive(null));
  opts.index.addEventListener('touchcancel', () => setActive(null));
}

// ================= 描き直しても見ていた場所を保つ（単語帳・全漢字で共用） =================
// 一覧（grid）で、上部（すりガラスのヘッダー）のすぐ下に最初に見えている項目と、その上端の位置を覚える。
// selectorOf(el)は、描き直したあとに同じ項目を探すためのセレクタを返す
// 基準にするのは、上部の下に上端まで見えている最初の項目（書体が変わって項目の高さが変わっても、見えている所がずれないように）
function captureGridAnchor(grid, itemSelector, selectorOf) {
  const line = grid.getBoundingClientRect().top + (parseFloat(getComputedStyle(grid).scrollPaddingTop) || 0);
  const items = grid.querySelectorAll(itemSelector);
  let partial = null;
  for (let i = 0; i < items.length; i++) {
    const r = items[i].getBoundingClientRect();
    if (r.bottom <= line) continue;
    if (r.top >= line - 1) return { selector: selectorOf(items[i]), offset: r.top - line, line };
    if (!partial) partial = { selector: selectorOf(items[i]), offset: r.top - line, line };
  }
  return partial;
}
// captureGridAnchorで覚えた項目が、描き直したあとも同じ位置に来るようにgridだけをスクロールする。
// 声調カーブ表示の単語帳は画面外のカードの高さを見積もりで並べていて（content-visibility）、画面近くのカードが
// 実際の高さになると少しずれるので、続く2フレームでもう一度合わせ直す
function restoreGridAnchor(grid, anchor) {
  const el = anchor && grid.querySelector(anchor.selector);
  if (!el) return;
  const align = () => { grid.scrollTop += el.getBoundingClientRect().top - anchor.line - anchor.offset; };
  align();
  requestAnimationFrame(() => { align(); requestAnimationFrame(align); });
}

// ================= 保存（localStorage） =================
// 保存データはすべて配列のJSONで持つ。読めない・壊れているときは空の配列として扱う
function loadArray(key) {
  try {
    const arr = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}
function saveArray(key, arr) {
  try { localStorage.setItem(key, JSON.stringify(arr)); } catch (e) { /* noop */ }
}

const STORAGE_KEY = 'pinyinHelperSavedFiles_v1';
function persistSavedFiles() { saveArray(STORAGE_KEY, savedFiles); }
let savedFiles = loadArray(STORAGE_KEY);

// タイトルは手動入力の1種類だけ（空欄で保存したときだけ冒頭の文字から自動でつける）。
// 「自動タイトル＋手動サブタイトル」だった時期の保存データは、サブタイトルが入力されていれば
// それをタイトルにし、空ならその時点の自動タイトルをそのまま残して、subtitleの項目を消す。
// subtitleが無いデータ（それ以前の、タイトルが手入力だった時期のものも含む）はtitleをそのまま使う。
function migrateFileTitle(f) {
  let changed = false;
  if ('subtitle' in f) {
    const sub = typeof f.subtitle === 'string' ? f.subtitle.trim() : '';
    if (sub) f.title = sub;
    delete f.subtitle;
    changed = true;
  }
  if (!f.title || !String(f.title).trim()) {
    f.title = defaultTitleFromText(f.text || '');
    changed = true;
  }
  return changed;
}
(function migrateTitlesToSingleTitle() {
  let changed = false;
  savedFiles.forEach((f) => { if (migrateFileTitle(f)) changed = true; });
  if (changed) persistSavedFiles();
})();

// ---------- フォルダ（1階層） ----------
const FOLDER_KEY = 'pinyinHelperFolders_v1';
function persistFolders() { saveArray(FOLDER_KEY, folders); }
let folders = loadArray(FOLDER_KEY);

// ---------- 単語帳（全漢字ページで漢字をタップしたときに関連語を出すための登録単語） ----------
const WORDS_KEY = 'pinyinHelperWords_v1';
function persistWords() {
  wordsByCharIndex = null;
  saveArray(WORDS_KEY, savedWords);
}
let savedWords = loadArray(WORDS_KEY); // 新しく登録した単語が先頭

// 簡体字化して先頭4文字（漢字のみ）に丸め、既に登録済みなら何もしない（重複自動排除）
// ここに含まれる漢字は、全漢字ページ未登録のものだけ自動で登録する（通知なし）
function addWord(raw) {
  const simplified = normalizeToSimplified(raw || '');
  const chars = Array.from(simplified).filter((ch) => HANZI_RE.test(ch)).slice(0, 4);
  const word = chars.join('');
  if (!word || savedWords.indexOf(word) >= 0) return false;
  savedWords.unshift(word);
  persistWords();
  addAllKanji(word);
  return true;
}
function deleteWords(words) {
  const del = new Set(words);
  savedWords = savedWords.filter((w) => !del.has(w));
  persistWords();
  let personChanged = false;
  del.forEach((w) => { if (personWords.delete(w)) personChanged = true; });
  if (personChanged) persistPersonWords();
}

// ---------- 人名登録（単語帳の単語のうち、人名として登録したものの集合） ----------
const PERSON_WORDS_KEY = 'pinyinHelperPersonWords_v1';
function persistPersonWords() { saveArray(PERSON_WORDS_KEY, Array.from(personWords)); }
let personWords = new Set(loadArray(PERSON_WORDS_KEY));
// isPerson=trueで人名登録、falseで解除。1件でも変化があればtrueを返す
function setWordsPersonStatus(words, isPerson) {
  let changed = false;
  words.forEach((w) => {
    if (isPerson) { if (!personWords.has(w)) { personWords.add(w); changed = true; } }
    else if (personWords.delete(w)) { changed = true; }
  });
  if (changed) persistPersonWords();
  return changed;
}

// ---------- 全漢字（単語帳とは別に、登録した漢字を常にピンインごとにグループ表示するページ） ----------
const ALL_KANJI_KEY = 'pinyinHelperAllKanji_v1';
function persistAllKanji() { saveArray(ALL_KANJI_KEY, allKanji); }
let allKanji = loadArray(ALL_KANJI_KEY); // 登録順（古い順）

// 入力された文字列から漢字だけを取り出し、まだ登録していないものだけ末尾に追加する（重複は自動で無視）
function addAllKanji(raw) {
  const simplified = normalizeToSimplified(raw || '');
  const seen = new Set(allKanji);
  let added = false;
  for (const ch of simplified) {
    if (!HANZI_RE.test(ch) || seen.has(ch)) continue;
    seen.add(ch);
    allKanji.push(ch);
    added = true;
  }
  if (added) persistAllKanji();
  return added;
}

// ---------- アイコン ----------
const FOLDER_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"></path></svg>';
const FOLDER_PLUS_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"></path><line x1="12" y1="10" x2="12" y2="16"></line><line x1="9" y1="13" x2="15" y2="13"></line></svg>';
const CHEVRON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"></polyline></svg>';
const TRASH_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>';
const MOVE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"></path><polyline points="9 13 12 10 15 13"></polyline><line x1="12" y1="10" x2="12" y2="17"></line></svg>';
const PENCIL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>';
const CHECK_SVG = '<svg class="pickCheck" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
const COPY_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="1.5"></rect><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"></path></svg>';
// 人名バッジ用の塗りつぶしバストアップアイコン（単語帳の背景透かし・全漢字ページの人名マーク共用）
const PERSON_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path></svg>';

// ================= ページをまたいで使う部品 =================
// 保存時にタイトルが空欄だったときに使う自動タイトル：先頭の文字を適度な文字数だけ抽出
function defaultTitleFromText(text) {
  const flat = text.replace(/\s+/g, '').trim();
  if (!flat) return '無題';
  return flat.length > 14 ? flat.slice(0, 14) + '…' : flat;
}

// ダイアログの入力欄の右端の「クリア」ボタン（文字があるときだけ出す）。保存・フォルダ名のダイアログで共用。
// 戻り値は、プログラムから入力欄の値を変えたあとに表示を合わせるための関数
function attachModalClearBtn(field, btn) {
  const update = () => btn.classList.toggle('show', field.value.length > 0);
  field.addEventListener('input', update);
  btn.addEventListener('click', () => {
    field.value = '';
    update();
    field.focus();
  });
  return update;
}
// 行を左にスワイプしたときに出る丸いボタン（移動・複製・削除など）
function makeRowActionBtn(cls, svg, label, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'rowActionBtn ' + cls;
  btn.innerHTML = svg;
  btn.setAttribute('aria-label', label);
  btn.title = label;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return btn;
}

// 追加欄でEnterを押したら、入力をonEnter(value)に渡して欄を空にする（IME変換確定のEnterと誤爆しないようcompositionを見る）
function onAddFieldEnter(field, onEnter) {
  let composing = false;
  field.addEventListener('compositionstart', () => { composing = true; });
  field.addEventListener('compositionend', () => { composing = false; });
  field.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || composing || e.isComposing) return;
    e.preventDefault();
    const value = field.value;
    field.value = '';
    onEnter(value);
  });
}
