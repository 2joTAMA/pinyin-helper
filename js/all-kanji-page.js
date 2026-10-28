/* ===== 全漢字ページ：漢字カード、漢字の削除（長押し）、漢字をタップしたときの単語シート ===== */
// ================= 全漢字ページの漢字の削除（長押し） =================
// ふだんは漢字を増やすだけなので、削除は目立たない長押しに置く。
// その漢字を使った単語が単語帳に1つでもあるときは削除できない（何も起きない）。先に単語を消してから漢字を消す
const KANJI_HOLD_MS = 550;
function attachKanjiLongPress(card, ch) {
  let timer = null;
  let startX = 0, startY = 0;
  const cancel = () => { clearTimeout(timer); timer = null; };
  card.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary) return;
    delete card.dataset.longPressed;
    startX = e.clientX; startY = e.clientY;
    cancel();
    timer = setTimeout(() => {
      timer = null;
      // 指を離したときのclickで単語シートが開かないようにする
      card.dataset.longPressed = '1';
      if (wordsContaining(ch).length) return;
      confirmDelete('「' + ch + '」を全漢字から削除しますか？').then((ok) => { if (ok) deleteAllKanji(ch); });
    }, KANJI_HOLD_MS);
  });
  card.addEventListener('pointermove', (e) => {
    if (timer && Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) > 10) cancel();
  });
  card.addEventListener('pointerup', cancel);
  card.addEventListener('pointercancel', cancel);
  card.addEventListener('contextmenu', (e) => e.preventDefault());
}
function deleteAllKanji(ch) {
  const idx = allKanji.indexOf(ch);
  if (idx < 0) return;
  allKanji.splice(idx, 1);
  persistAllKanji();
  refreshAllKanjiIfOpen();
}

// ================= 全漢字ページの漢字カード =================
// 全漢字ページでは声調カーブは使わない。ほかのページで声調カーブをONにしていても、ここでは
// 普通の表示にする（ONの状態は覚えたままなので、ほかのページに戻ればまたカーブで表示される）。
// 漢字だけを大きく表示。声調数字は123トグルON時のみ右肩に小さく（絶対配置なのでレイアウトは動かない）。
// 単語帳にその漢字を含む単語が1つもないときはタップしても何も起きないので、少し薄い色で示す。
// opts.base/opts.tone（全漢字ページ用）：多音字をどの読みとして表示しているか。
// 指定時は声調表示をその読みの声調にし、タップで出す単語もその読みのものだけに絞る。
// opts.alwaysShowTone：123ボタンがOFFでも声調数字を表示する（全漢字ページの各声調の先頭用）。
function makeCard(ch, opts) {
  const base = (opts && opts.base) || '';
  const toneDigit = opts && opts.tone != null ? opts.tone : getToneDigit(ch);
  const hasWord = wordsForChar(ch, base).length > 0;
  const card = document.createElement('div');
  card.className = 'kcard';
  card.dataset.char = ch;
  if (base) card.dataset.base = base;
  // このカードが表している声調（単語シートで、違う声調で読まれている音節に下線を引くのに使う）。
  // data-toneは声調カーブの記号用のCSSが使っているので別の名前にする
  card.dataset.readingTone = normalizeToneDigit(toneDigit || '');

  const hz = document.createElement('span');
  hz.className = 'khz' + (hasWord ? '' : ' noWord');
  renderDisplayText(hz, ch);
  card.appendChild(hz);

  const tone = document.createElement('span');
  tone.className = 'ktone';
  const showTone = (state.toneType === 'num' && !state.pinyinOff) || (opts && opts.alwaysShowTone);
  tone.textContent = showTone ? toneDigit : '';
  card.appendChild(tone);

  attachKanjiLongPress(card, ch);
  card.addEventListener('click', () => {
    if (!hasWord || card.dataset.longPressed) return;
    openWordSheetFor(ch, card, base);
  });

  return card;
}

// ================= 漢字タップ時の単語シート =================
// 登録済み単語にその漢字を含むものがあれば下からシートを出す。無ければ何もしない（現状維持）。
let activeWordCard = null;
let activeWordChar = null;
let activeWordBase = '';
function setActiveWordCard(card) {
  if (activeWordCard && activeWordCard !== card) activeWordCard.classList.remove('wordActive');
  activeWordCard = card || null;
  if (activeWordCard) activeWordCard.classList.add('wordActive');
}
// 単語のピンインをelに入れる（単語区切りごとにスペース。lineToPinyinと同じ並び）。
// mark = { ch, base, tone } のときは、その漢字がbaseの音で、しかもtoneとは違う声調で読まれている音節に下線を引く
function renderWordPinyin(el, word, mark) {
  const groups = segmentCached(word, state.toneType);
  const readings = getWordCharReadings(word); // 同じ単語を声調番号つきで区切った結果（1文字ずつ同じ順に並ぶ）
  const flatCount = groups.reduce((n, g) => n + g.length, 0);
  const canMark = mark && mark.tone && readings.length === flatCount;
  let i = 0;
  groups.forEach((group, gi) => {
    if (gi) el.appendChild(document.createTextNode(' '));
    group.forEach((g) => {
      const r = readings[i++];
      if (canMark && r.ch === mark.ch && r.base === mark.base && r.tone !== mark.tone) {
        const span = document.createElement('span');
        span.className = 'toneDiff';
        span.textContent = g.result;
        el.appendChild(span);
      } else {
        el.appendChild(document.createTextNode(g.result));
      }
    });
  });
}
// 現在の表示設定（声調123／ピンインなし／日本字体）に合わせて中身だけを作り直す。
// 全漢字ページのシートなので、カードと同じく声調カーブは使わない。
// tone：タップしたカードの声調。これと違う声調で読まれている音節に下線を引く
function renderWordSheetContent(ch, base, tone) {
  const matches = wordsForChar(ch, base);
  wordSheetList.innerHTML = '';
  matches.forEach((w) => {
    const item = document.createElement('div');
    item.className = 'wordSheetItem';
    const hz = document.createElement('div');
    hz.className = 'wordSheetHz';
    renderDisplayText(hz, w);
    const py = document.createElement('div');
    py.className = 'wordSheetPy';
    if (!state.pinyinOff) renderWordPinyin(py, w, { ch, base, tone });
    // 人名登録した単語の目印：ピンインの末尾に人アイコンを添える
    if (personWords.has(w)) {
      const icon = document.createElement('span');
      icon.className = 'wordSheetPersonIcon';
      icon.innerHTML = PERSON_SVG;
      py.appendChild(icon);
    }
    item.appendChild(hz);
    item.appendChild(py);
    // 左にスワイプすると削除ボタンが出る（保存一覧の行と同じ部品・同じ動き）
    const wrap = document.createElement('div');
    wrap.className = 'listRowWrap wordSheetRowWrap';
    const actions = document.createElement('div');
    actions.className = 'listRowActions';
    actions.appendChild(makeRowActionBtn('actDelete', TRASH_SVG, '単語帳から削除', () => deleteWordFromSheet(w)));
    wrap.appendChild(actions);
    wrap.appendChild(item);
    attachRowGestures(wrap, item, () => {}, false);
    wordSheetList.appendChild(wrap);
  });
  return matches.length;
}
function openWordSheetFor(ch, cardEl, base) {
  if (!renderWordSheetContent(ch, base, cardEl ? cardEl.dataset.readingTone : '')) return;
  if (ch !== activeWordChar || (base || '') !== activeWordBase) wordSheetList.scrollTop = 0;
  activeWordChar = ch;
  activeWordBase = base || '';
  const winH = window.innerHeight;
  let cap = winH * 0.45;
  if (cardEl) {
    const rect = cardEl.getBoundingClientRect();
    // タップした漢字が画面下半分にある場合は、シートに隠れないよう上から出す。
    // 上から出すときはヘッダー（表示切り替えボタン）を隠さないよう、その下端から出す
    const fromTop = rect.top > winH / 2;
    wordSheet.classList.toggle('fromTop', fromTop);
    if (fromTop) {
      const topEdge = allKanjiScreen.querySelector('.pageTop').getBoundingClientRect().bottom + 6;
      wordSheet.style.setProperty('--sheet-top', topEdge + 'px');
      cap = Math.min(cap, rect.top - topEdge - 10);
    } else {
      const sheetBottom = tabBar.getBoundingClientRect().top - 6;
      cap = Math.min(cap, sheetBottom - rect.bottom - 10);
    }
  }
  fitWordSheet(Math.max(cap, 120));
  wordSheet.classList.add('open');
  document.body.classList.add('wordSheetOpen');
  setActiveWordCard(cardEl);
}
// シートの高さを決める。単語が全部入らないときは、最後に見える単語がちょうど半分で切れる高さにして
// 「下にまだ続きがある」と分かるようにする（iOSの一覧でよく使われる見せ方）
function fitWordSheet(cap) {
  wordSheetList.style.maxHeight = '';
  wordSheet.style.maxHeight = cap + 'px';
  const avail = wordSheetList.clientHeight;
  if (wordSheetList.scrollHeight > avail + 1) {
    const items = wordSheetList.children;
    let h = 0;
    for (let i = 0; i < items.length; i++) {
      const half = items[i].offsetTop + items[i].offsetHeight / 2;
      if (half > avail) break;
      h = half;
    }
    if (h) wordSheetList.style.maxHeight = h + 'px';
  }
  updateWordSheetFades();
}
// 続きがある側の端だけを透けさせる（一番上・一番下までスクロールしたらその側は消える）
function updateWordSheetFades() {
  const el = wordSheetList;
  el.classList.toggle('moreAbove', el.scrollTop > 1);
  el.classList.toggle('moreBelow', el.scrollTop + el.clientHeight < el.scrollHeight - 1);
}
wordSheetList.addEventListener('scroll', updateWordSheetFades, { passive: true });
function closeWordSheet() {
  wordSheet.classList.remove('open');
  document.body.classList.remove('wordSheetOpen');
  setActiveWordCard(null);
  activeWordChar = null;
  activeWordBase = '';
}
// 単語シートで左スワイプして出した削除ボタンから、その単語を単語帳から削除する。
// 全漢字ページの見た目（単語の無い漢字は薄くなる・使われなくなった読みのグループは消える）を描き直し、
// まだその漢字の単語が残っていればシートを開いたまま中身を作り直す。最後の1つだったらシートを閉じる
function deleteWordFromSheet(word) {
  const ch = activeWordChar;
  const base = activeWordBase;
  const listScroll = wordSheetList.scrollTop;
  deleteWords([word]);
  refreshAllKanjiIfOpen();
  if (wordsForChar(ch, base).length) {
    reopenWordSheetIfNeeded(ch, base);
    wordSheetList.scrollTop = listScroll;
    updateWordSheetFades();
  } else {
    closeWordSheet();
  }
}
// 声調123／声調カーブ／日本字体の表示設定が変わったとき用。呼び出し側は
// renderInputPage(true)でシート自体を閉じずに描画し直しているので、ここでは
// 新しい表示設定のカードを探して中身だけを作り直す（'open'クラスは既に付いたままなので
// classList.addは何もしない＝閉じるアニメーションは一切発生しない）
function reopenWordSheetIfNeeded(ch, base) {
  if (!ch) return;
  // 全漢字ページでは同じ漢字が複数の読みのグループに出るので、読み(data-base)まで一致するカードを探す
  const sel = '.kcard[data-char="' + CSS.escape(ch) + '"]' + (base ? '[data-base="' + CSS.escape(base) + '"]' : '');
  const card = allKanjiGrid.querySelector(sel);
  openWordSheetFor(ch, card, base);
}
// カードでもシート自身でも表示切り替えボタンでもない場所をタップしたら閉じる
document.addEventListener('click', (e) => {
  if (!wordSheet.classList.contains('open')) return;
  if (e.target.closest('#wordSheet')) return;
  if (e.target.closest('.kcard')) return;
  if (e.target.closest('.displayToggles')) return;
  closeWordSheet();
});

// ================= 全漢字ページ =================
// 登録済みの漢字を常にピンインでグループ化して表示する。
// 子音インデックス（右端の目次）でジャンプする先の見出しがない“無子音”の音（ā/ān等）用のラベル
const ALL_KANJI_INDEX_NO_INITIAL_LABEL = '·';

function renderAllKanjiGrid() {
  allKanjiGrid.innerHTML = '';
  allKanjiIndex.innerHTML = '';
  if (!allKanji.length) {
    allKanjiGrid.innerHTML = '<div class="listEmpty">まだ漢字が登録されていません</div>';
    return;
  }

  // 多音字は標準の読みのグループに加え、単語帳で使われている読みのグループにも出す（例：长はchangとzhang）。
  // グループ内は声調順（1→2→3→4→軽声）、同じ声調の中は出現頻度順、頻度表に無いもの同士は登録順
  // （sortは安定なので登録順が保たれる）。
  const groups = new Map();
  allKanji.forEach((ch) => {
    const readings = getCharReadings(ch);
    if (!readings.size) readings.set(ch, '');
    readings.forEach((tone, key) => {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ ch, tone });
    });
  });
  groups.forEach((list) => list.sort((a, b) =>
    (toneGroupRank(a.tone) - toneGroupRank(b.tone)) || (charFreqRank(a.ch) - charFreqRank(b.ch))));

  const orderedKeys = Array.from(groups.keys()).sort(compareGroupKeys);
  const frag = document.createDocumentFragment();
  const indexFrag = document.createDocumentFragment();
  let lastInitial = null;
  orderedKeys.forEach((key) => {
    const initial = splitPinyinBase(key).initial;

    const wrap = document.createElement('div');
    wrap.className = 'kgroup';
    wrap.dataset.initial = initial;

    const label = document.createElement('div');
    label.className = 'kgroupLabel';
    label.innerHTML = '<span>' + escapeHtml(key) + '</span>';
    wrap.appendChild(label);

    const row = document.createElement('div');
    row.className = 'kgroupRow';
    // 同じ声調の並びの先頭の漢字だけは、123ボタンの状態に関係なく声調数字を常に出す
    let prevTone = null;
    groups.get(key).forEach(({ ch, tone }) => {
      row.appendChild(makeCard(ch, { base: key, tone, alwaysShowTone: tone !== prevTone }));
      prevTone = tone;
    });
    wrap.appendChild(row);

    frag.appendChild(wrap);

    // 同じ子音が続く間はインデックスに1つだけ出す（グループの先頭に飛べればよい）
    if (initial !== lastInitial) {
      lastInitial = initial;
      const item = document.createElement('div');
      item.className = 'allKanjiIndexItem';
      item.dataset.initial = initial;
      item.textContent = initial || ALL_KANJI_INDEX_NO_INITIAL_LABEL;
      indexFrag.appendChild(item);
    }
  });
  allKanjiGrid.appendChild(frag);
  allKanjiIndex.appendChild(indexFrag);
  allKanjiIndexHighlighter.refresh();
}

const allKanjiIndexHighlighter = createIndexHighlighter({
  screen: allKanjiScreen, grid: allKanjiGrid, index: allKanjiIndex, groupSelector: '.kgroup', key: 'initial',
});

attachSideIndexJump({
  index: allKanjiIndex, itemSelector: '.allKanjiIndexItem', grid: allKanjiGrid, groupSelector: '.kgroup', key: 'initial',
});

// ---------- 漢字の追加 ----------
// 全漢字：Enterを押すたびに、入力に含まれる漢字を全部登録する（重複は自動で無視）
onAddFieldEnter(allKanjiAddInput, (value) => { addAllKanji(value); renderAllKanjiGrid(); });
