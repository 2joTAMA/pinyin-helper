/* ===== 単語帳ページ：並び替え、選択モード（人名登録・削除）、単語カード ===== */
// ================= 単語帳の並び替え（登録順／ピンイン順／声調順） =================
// ピンイン順：単語を音節ごとにINITIAL_ORDER/FINAL_ORDERの表（あいうえお順相当）で比較する
const pinyinRanksCache = new Map();
function pinyinRanksForWord(word) {
  return memo(pinyinRanksCache, word, () => Array.from(word).map((ch) => pinyinGroupRank(getBasePinyin(ch))));
}
function comparePinyinWords(a, b) {
  const ra = pinyinRanksForWord(a);
  const rb = pinyinRanksForWord(b);
  const len = Math.min(ra.length, rb.length);
  for (let i = 0; i < len; i++) {
    if (ra[i][0] !== rb[i][0]) return ra[i][0] - rb[i][0];
    if (ra[i][1] !== rb[i][1]) return ra[i][1] - rb[i][1];
  }
  if (ra.length !== rb.length) return ra.length - rb.length;
  return a < b ? -1 : a > b ? 1 : 0;
}
// 声調順：漢字1文字だけを切り出して調べると「一」「不」のような変調や、重ね言葉の軽声が
// 元の（変化前の）声調のまま拾われてしまう。単語全体をピンイン変換してから声調を拾うことで、
// その単語として実際に読まれる声調（変調・軽声を含む）で比較する。
function getWordToneDigits(word) {
  if (!pp || !pp.segment) return Array.from(word).map(() => '');
  const groups = segmentCached(word, 'num');
  const chars = groups.length
    ? groups.reduce((acc, g) => acc.concat(g), [])
    : Array.from(word).map((c) => ({ result: c }));
  return chars.map(({ result }) => {
    const m = /([0-5])$/.exec(result || '');
    return m ? m[1] : '';
  });
}
// 声調順：1文字目・2文字目の声調の組み合わせ（例：1声+2声）でグループ化して並べる。
// 3文字以上の単語も先頭2文字の声調だけで判定する。同じ組み合わせの中はピンイン順。
// pinyin-proは軽声を末尾「0」（まれに「5」）で表すので、どちらも同じ「0」として扱う。
const TONE_GROUP_ORDER = ['1', '2', '3', '4', '0'];
const TONE_GROUP_NAME = { '1': '1声', '2': '2声', '3': '3声', '4': '4声', '0': '軽声' };
function normalizeToneDigit(d) {
  return d === '5' ? '0' : d;
}
function toneGroupRank(digit) {
  const idx = TONE_GROUP_ORDER.indexOf(digit);
  return idx >= 0 ? idx : TONE_GROUP_ORDER.length;
}
// 1文字だけの単語は2文字目の声調が存在しないので''のまま返す（呼び出し側で個別に扱う）
const wordToneGroupCache = new Map();
function wordToneGroupDigits(word) {
  return memo(wordToneGroupCache, word, () => {
    const digits = getWordToneDigits(word).map(normalizeToneDigit);
    return [digits[0] || '', digits[1] || ''];
  });
}
function compareToneWords(a, b) {
  const [a1, a2] = wordToneGroupDigits(a);
  const [b1, b2] = wordToneGroupDigits(b);
  const r1 = toneGroupRank(a1) - toneGroupRank(b1);
  if (r1 !== 0) return r1;
  const r2 = toneGroupRank(a2) - toneGroupRank(b2);
  if (r2 !== 0) return r2;
  return comparePinyinWords(a, b);
}
// アプリを開いたときは常に登録順から始める（前回の並び順は引き継がない）
let wordSortMode = 'registered';
// 並び替えのセグメントコントロール：選んだボタンの文字色を変え、つまみをその位置へすべらせる
function updateWordSortBtnsUI() {
  wordSortBtns.forEach((btn) => btn.classList.toggle('active', btn.dataset.sort === wordSortMode));
  const idx = wordSortBtns.findIndex((btn) => btn.dataset.sort === wordSortMode);
  wordSortThumb.style.transform = 'translateX(' + (Math.max(0, idx) * 100) + '%)';
}
updateWordSortBtnsUI();
function getSortedWords() {
  const list = savedWords.slice();
  if (wordSortMode === 'pinyin') list.sort(comparePinyinWords);
  else if (wordSortMode === 'tone') list.sort(compareToneWords);
  return list;
}

// ================= 単語帳 =================
let wordSelectMode = false;
const selectedWords = new Set();

function updateWordSelectUI() {
  wordSelectToggleBtn.classList.toggle('active', wordSelectMode);
  wordSelectToggleBtn.setAttribute('aria-pressed', wordSelectMode ? 'true' : 'false');
  wordSelectToggleBtn.textContent = wordSelectMode ? '完了' : '選択';
  wordMarkPersonBtn.hidden = !wordSelectMode;
  wordMarkPersonBtn.disabled = selectedWords.size === 0;
  wordUnmarkPersonBtn.hidden = !wordSelectMode;
  wordUnmarkPersonBtn.disabled = selectedWords.size === 0;
  wordDeleteBtn.hidden = !wordSelectMode;
  wordDeleteBtn.disabled = selectedWords.size === 0;
  wordSelectCount.textContent = wordSelectMode && selectedWords.size ? selectedWords.size + '件選択中' : '';
  // 選択中は表示切り替えを隠し、同じ場所に人名登録・解除・削除のボタンを出す
  wordbookDisplayToggles.hidden = wordSelectMode;
}

function exitWordSelectMode() {
  wordSelectMode = false;
  selectedWords.clear();
  updateWordSelectUI();
}

// 現在の並び替えモードに応じたグループ情報（見出し・右端インデックス用）を返す。
// 登録順のときはグループ化しない（null）。
function wordGroupInfo(word) {
  if (wordSortMode === 'pinyin') {
    const firstChar = Array.from(word)[0] || '';
    const initial = splitPinyinBase(getBasePinyin(firstChar) || '').initial;
    const text = initial || ALL_KANJI_INDEX_NO_INITIAL_LABEL;
    return { key: initial, indexText: text, headerText: text };
  }
  if (wordSortMode === 'tone') {
    const [t1, t2] = wordToneGroupDigits(word);
    const key = t1 + '_' + t2;
    const indexText = t2 ? t1 + t2 : t1;
    const headerText = t2
      ? (TONE_GROUP_NAME[t1] || '?') + '-' + (TONE_GROUP_NAME[t2] || '?')
      : (TONE_GROUP_NAME[t1] || '?');
    return { key, indexText, headerText };
  }
  return null;
}

function buildWordGrid() {
  wordGrid.innerHTML = '';
  wordGrid.classList.toggle('contourMode', state.contourOn);
  wordbookIndex.innerHTML = '';
  const grouped = wordSortMode !== 'registered';
  wordbookIndex.hidden = !grouped;
  // 登録順のときは目次が無いので、代わりに「一番上に戻る」ボタンを出す
  wordScrollTopBtn.hidden = grouped || !savedWords.length;
  if (!savedWords.length) {
    wordGrid.innerHTML = '<div class="listEmpty">まだ単語が登録されていません</div>';
    return;
  }
  const indexFrag = document.createDocumentFragment();
  let lastGroupKey = null;
  // カードを入れる先。ピンイン順／声調順のときはグループ（見出し＋カードの並び）ごとに分ける。
  // グループごとにまとめておくと、見出しがそのグループの間だけ上に固定され、次のグループの見出しに押し上げられる
  let chipParent = wordGrid;
  getSortedWords().forEach((word) => {
    if (grouped) {
      const info = wordGroupInfo(word);
      if (info && info.key !== lastGroupKey) {
        lastGroupKey = info.key;
        const section = document.createElement('section');
        section.className = 'wordGroup';
        section.dataset.groupKey = info.key;
        const label = document.createElement('div');
        label.className = 'wordGroupLabel';
        label.textContent = info.headerText;
        section.appendChild(label);
        chipParent = document.createElement('div');
        chipParent.className = 'wordGroupGrid';
        section.appendChild(chipParent);
        wordGrid.appendChild(section);

        const item = document.createElement('div');
        item.className = 'wordbookIndexItem';
        item.dataset.groupKey = info.key;
        item.textContent = info.indexText;
        indexFrag.appendChild(item);
      }
    }

    const isPerson = personWords.has(word);
    const chip = document.createElement('div');
    chip.className = 'wordChip' + (isPerson ? ' person' : '') + (selectedWords.has(word) ? ' selected' : '');
    chip.dataset.word = word;

    if (isPerson) {
      const badge = document.createElement('div');
      badge.className = 'wordChipPersonIcon';
      badge.innerHTML = PERSON_SVG;
      chip.appendChild(badge);
    }

    if (state.contourOn) {
      chip.appendChild(buildWordContourRow(word));
    } else {
      const hz = document.createElement('div');
      hz.className = 'wordChipHz';
      renderDisplayText(hz, word);
      chip.appendChild(hz);

      const py = document.createElement('div');
      py.className = 'wordChipPy';
      // ピンインなしモードでも枠（高さ24px固定）は残して、カードの高さ・漢字の位置を変えない
      py.textContent = state.pinyinOff ? '' : lineToPinyin(word);
      chip.appendChild(py);
    }

    chip.addEventListener('click', () => {
      if (!wordSelectMode) return;
      if (selectedWords.has(word)) selectedWords.delete(word);
      else selectedWords.add(word);
      chip.classList.toggle('selected');
      updateWordSelectUI();
    });

    chipParent.appendChild(chip);
  });
  wordbookIndex.appendChild(indexFrag);
  wordbookIndexHighlighter.refresh();

  fitAllWordChipPy();
}
// 単語・人名登録・表示設定・並び順・選択モードが前回と同じなら、タブを開いても描き直さない
const wordGridRenderer = createRenderSkipper(buildWordGrid,
  () => [dataVersion, displayKey(), wordSortMode, wordSelectMode].join('|'));
function renderWordGrid() { wordGridRenderer.render(); }
const wordbookIndexHighlighter = createIndexHighlighter({
  screen: wordbookScreen, grid: wordGrid, index: wordbookIndex, groupSelector: '.wordGroup', key: 'groupKey',
});

attachSideIndexJump({
  index: wordbookIndex, itemSelector: '.wordbookIndexItem', grid: wordGrid, groupSelector: '.wordGroup', key: 'groupKey',
});
wordScrollTopBtn.addEventListener('click', () => wordGrid.scrollTo({ top: 0, behavior: 'smooth' }));

// 声調123／記号表記を切り替えても行の高さが動かないよう、ピンインが1行に収まるまで
// 文字サイズを少しずつ縮める（最小サイズでも収まらなければCSSの省略記号に任せる）。
// 描画直後はまだ画面が非表示のことがあるので、確実に幅が測れるよう次フレームで実行する。
// カード1枚ずつ「縮める→測る」を繰り返すと、そのたびにブラウザが画面全体の配置を計算し直して
// 単語が多いと数秒かかるので、全カードをまとめて測る→まとめて縮める、を交互に行う。
// 最初の縮小幅は「収まる幅 ÷ 今の幅」の比で見積もる（字間の分だけ必ず大きめに出るので、
// そこから1pxずつ下げれば、1pxずつ縮めていたときと同じ大きさに落ち着く）。
const WORD_CHIP_PY_MAX_PX = 19;
const WORD_CHIP_PY_MIN_PX = 12;
function fitAllWordChipPy() {
  requestAnimationFrame(() => {
    const els = Array.from(wordGrid.querySelectorAll('.wordChipPy')).filter((el) => el.textContent);
    els.forEach((el) => { el.style.fontSize = ''; });
    // 測る（ここで1回だけ配置が計算される）
    let pending = els
      .map((el) => ({ el, maxWidth: el.clientWidth, width: el.scrollWidth, size: WORD_CHIP_PY_MAX_PX }))
      .filter((p) => p.maxWidth && p.width > p.maxWidth + 0.5);
    // 縮める
    pending.forEach((p) => {
      const estimate = Math.floor(WORD_CHIP_PY_MAX_PX * p.maxWidth / p.width);
      p.size = Math.max(WORD_CHIP_PY_MIN_PX, Math.min(WORD_CHIP_PY_MAX_PX - 1, estimate));
      p.el.style.fontSize = p.size + 'px';
    });
    // まだはみ出しているものだけ、1pxずつ下げて測り直す
    while (pending.length) {
      pending = pending.filter((p) => p.size > WORD_CHIP_PY_MIN_PX && p.el.scrollWidth > p.maxWidth + 0.5);
      pending.forEach((p) => {
        p.size -= 1;
        p.el.style.fontSize = p.size + 'px';
      });
    }
  });
}

// ---------- 単語の追加・選択モードのボタン ----------
// 単語帳：Enterを押すたびに1件ずつ登録する
onAddFieldEnter(wordAddInput, (value) => { addWord(value); renderWordGrid(); });
wordSelectToggleBtn.addEventListener('click', () => {
  wordSelectMode = !wordSelectMode;
  selectedWords.clear();
  updateWordSelectUI();
  renderWordGrid();
});

wordSortBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    if (btn.dataset.sort === wordSortMode) return;
    wordSortMode = btn.dataset.sort;
    updateWordSortBtnsUI();
    renderWordGrid();
  });
});

wordMarkPersonBtn.addEventListener('click', () => {
  if (!selectedWords.size) return;
  setWordsPersonStatus(selectedWords, true);
  exitWordSelectMode();
  renderWordGrid();
});

wordUnmarkPersonBtn.addEventListener('click', () => {
  if (!selectedWords.size) return;
  setWordsPersonStatus(selectedWords, false);
  exitWordSelectMode();
  renderWordGrid();
});

wordDeleteBtn.addEventListener('click', () => {
  if (!selectedWords.size) return;
  deleteWords(selectedWords);
  exitWordSelectMode();
  renderWordGrid();
});
