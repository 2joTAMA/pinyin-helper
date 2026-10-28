/* ===== アプリ全体：表示切り替えボタン、タブの切り替え、画面の高さ合わせ、起動 =====
   js/ のファイルは index.html に書いた順に読み込まれ、すべて同じ場所（グローバル）で変数・関数を共有する。
   読み込み時にすぐ実行するコードは、それより前に読み込んだファイルの関数しか使えないので、起動処理はこのファイルの最後に置く */
// ================= 表示切り替え（声調カーブ／ピンインなし／日本字体） =================
// 単語帳を開いている間に声調表示の設定を切り替えたら、単語帳側も即座に反映する
// 描き直しても見ていた場所が動かないよう、ヘッダーのすぐ下に見えていたカードを覚えておき、描き直し後に同じ位置へ戻す
// anchorは、表示を変える前にcaptureWordbookAnchorで測っておいたもの（省略時はここで測る）
function refreshWordbookIfOpen(anchor) {
  if (wordbookScreen.hidden) return;
  if (anchor === undefined) anchor = captureWordbookAnchor();
  renderWordGrid();
  restoreGridAnchor(wordGrid, anchor);
}
function captureWordbookAnchor() {
  if (wordbookScreen.hidden) return null;
  return captureGridAnchor(wordGrid, '.wordChip', (el) => '.wordChip[data-word="' + CSS.escape(el.dataset.word) + '"]');
}
// 全漢字ページを開いている間も同様に即座に反映する（同じ漢字が複数の読みのグループに出るので、読みまで一致するカードを探す）
function refreshAllKanjiIfOpen(anchor) {
  if (allKanjiScreen.hidden) return;
  if (anchor === undefined) anchor = captureAllKanjiAnchor();
  renderAllKanjiGrid();
  restoreGridAnchor(allKanjiGrid, anchor);
}
function captureAllKanjiAnchor() {
  if (allKanjiScreen.hidden) return null;
  return captureGridAnchor(allKanjiGrid, '.kcard', (el) =>
    '.kcard[data-char="' + CSS.escape(el.dataset.char) + '"][data-base="' + CSS.escape(el.dataset.base || '') + '"]');
}
// ヘッダー右の表示切り替えボタン。入力・単語帳・全漢字の各ヘッダーの .displayToggles に同じものを並べる。
// 'num'（声調を数字で表示）は今はボタンを出していない（hidden: true）。戻すときは hidden を外すだけでよい
// ボタンはこの配列の順に左から並ぶ（日本漢字 → 声調 → 非表示）
const DISPLAY_TOGGLES = [
  {
    key: 'ja', label: '日本漢字', title: '漢字を日本の字体で表示（内部のデータは変わりません）',
    isOn: () => state.jaKanjiOn,
    apply: () => { state.jaKanjiOn = !state.jaKanjiOn; },
  },
  {
    key: 'num', hidden: true, label: '123', title: '声調を数字で表示',
    isOn: () => state.toneType === 'num' && !state.pinyinOff,
    apply: () => {
      if (state.contourOn || state.pinyinOff) {
        // 記号モード／ピンインなしモード中に押した場合は、そのモードを抜けて数字モードへ切り替える
        state.contourOn = false;
        state.pinyinOff = false;
        state.toneType = 'num';
      } else {
        state.toneType = state.toneType === 'symbol' ? 'num' : 'symbol';
      }
    },
  },
  {
    key: 'contour', label: '声調', title: '声調を高低カーブの記号で表示（アルファベット非表示）',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17 L9 7 L15 7 L20 17"></path></svg>',
    isOn: () => state.contourOn,
    apply: () => {
      state.pinyinOff = false;
      state.contourOn = !state.contourOn;
    },
  },
  {
    key: 'off', label: '非表示', title: 'ピンインを表示しない',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><line x1="5.6" y1="5.6" x2="18.4" y2="18.4"></line></svg>',
    isOn: () => state.pinyinOff,
    apply: () => {
      state.pinyinOff = !state.pinyinOff;
      if (state.pinyinOff) state.contourOn = false;
    },
  },
];
// 全漢字ページでは声調カーブは使わないので、並び順をほかのページとそろえたまま押せない（薄い）状態にする
const DISABLED_TOGGLES = { allKanjiScreen: ['contour'] };
document.querySelectorAll('.displayToggles').forEach((box) => {
  const screen = box.closest('.pageScreen');
  const disabledKeys = (screen && DISABLED_TOGGLES[screen.id]) || [];
  DISPLAY_TOGGLES.forEach((t) => {
    if (t.hidden) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dispToggle';
    btn.dataset.toggle = t.key;
    btn.title = t.title;
    btn.setAttribute('aria-label', t.title);
    // アイコン（あれば）＋文字
    btn.innerHTML = (t.icon || '') + '<span>' + escapeHtml(t.label) + '</span>';
    btn.addEventListener('click', () => applyDisplaySettingChange(t.apply));
    if (disabledKeys.includes(t.key)) btn.disabled = true;
    box.appendChild(btn);
  });
});
// 表示切り替えボタンの点灯状態を今のstateに合わせる（全ヘッダーのボタンをまとめて更新する）
function updateDisplayTogglesUI() {
  document.body.classList.toggle('jaKanjiOn', state.jaKanjiOn);
  document.querySelectorAll('.dispToggle').forEach((btn) => {
    const t = DISPLAY_TOGGLES.find((x) => x.key === btn.dataset.toggle);
    const on = t.isOn();
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}
// 表示設定を変えたあと、開いている画面・単語シートをすべて描き直す
function applyDisplaySettingChange(fn) {
  const reopenChar = wordSheet.classList.contains('open') ? activeWordChar : null;
  const reopenBase = activeWordBase;
  // 見ている位置は、表示を変える前に測る（日本漢字は書体が変わって行の高さが変わるので、変えた後では遅い）
  const inputAnchor = captureResultsAnchor();
  const wordbookAnchor = captureWordbookAnchor();
  const allKanjiAnchor = captureAllKanjiAnchor();
  fn();
  updateDisplayTogglesUI();
  renderInputPage(!!reopenChar, inputAnchor);
  refreshWordbookIfOpen(wordbookAnchor);
  refreshAllKanjiIfOpen(allKanjiAnchor);
  reopenWordSheetIfNeeded(reopenChar, reopenBase);
}

// ================= ページ切り替え（フッターのタブバー） =================
// 入力ページが土台で、保存一覧・単語帳・全漢字はその上に全画面で重ねる。表示するページだけhiddenを外す。
// opts.skipFocus=trueのときは追加欄にフォーカスしない（起動直後にキーボードが勝手に出ないようにする）
function showTab(tab, opts) {
  opts = opts || {};
  // 表示中のタブをもう一度押したときは、そのページの一番上までスクロールするだけ
  if (tab === state.tab && !opts.force) {
    const scroller = { list: listRows, input: results, wordbook: wordGrid, allKanji: allKanjiGrid }[tab];
    if (scroller) scroller.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  // ほかのタブへ移るときは、保存済みのファイルに未保存の変更があれば上書き保存する
  autoSaveBeforeLeaving();
  closeWordSheet();
  exitWordSelectMode();

  if (tab === 'list') renderListRows();
  if (tab === 'wordbook') { wordAddInput.value = ''; renderWordGrid(); }
  if (tab === 'allKanji') { allKanjiAddInput.value = ''; renderAllKanjiGrid(); }
  // 何も入力されていない状態で入力ページに移ったときは、すぐ書けるよう入力欄を開く
  if (tab === 'input' && !input.value.trim()) setFocusMode(false);

  listScreen.hidden = tab !== 'list';
  wordbookScreen.hidden = tab !== 'wordbook';
  allKanjiScreen.hidden = tab !== 'allKanji';
  state.tab = tab;
  updateTabBarUI();

  if (!opts.skipFocus) {
    if (tab === 'wordbook') setTimeout(() => wordAddInput.focus(), 0);
    if (tab === 'allKanji') setTimeout(() => allKanjiAddInput.focus(), 0);
  }
}

// 選択中のタブに色を付け、背景（#tabIndicator）をそのタブの位置へすべらせる
function updateTabBarUI() {
  const idx = tabItems.findIndex((b) => b.dataset.tab === state.tab);
  tabItems.forEach((b) => {
    const on = b.dataset.tab === state.tab;
    b.classList.toggle('active', on);
    if (on) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  tabIndicator.style.transform = 'translateX(' + (Math.max(0, idx) * 100) + '%)';
}
tabItems.forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

// ================= 単語帳・全漢字の追加欄の「すべて消す」ボタン =================
// 入力バーの右に出る「すべて消す」ボタン。普通にクリックで処理すると、押した瞬間に入力欄から
// フォーカスが外れてボタン自体が引っ込んでしまうので、押し始め（pointerdown）で処理してフォーカスを保つ
[[wordAddClearBtn, wordAddInput], [allKanjiAddClearBtn, allKanjiAddInput]].forEach(([btn, field]) => {
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    field.value = '';
    field.focus();
  });
});

// ================= Escキー（ダイアログを閉じる・選択モードを抜ける） =================
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!nameModal.hidden) { finishName(null); return; }
  if (!folderPicker.hidden) { closeFolderPicker(); return; }
  if (!saveModal.hidden) { closeSaveModal(); return; }
  if (state.tab === 'wordbook' && wordSelectMode) { exitWordSelectMode(); renderWordGrid(); }
});

// ================= 画面の実高さをCSS変数へ反映 =================
// iOSのホーム画面追加（standalone）表示では100dvhが実際の画面高さより小さく
// 計算されるバグがあり、bodyの高さがOSの本当のビューポートより短くなる。
// bodyはtransformでposition:fixedな子要素（タブバーや各ページ）の基準に
// なっているので、window.innerHeight（無ければvisualViewport.height）を実測して
// --app-hに入れれば、タブバーの下に隙間ができる問題を解消できる。
function syncAppHeight() {
  const h = window.innerHeight || (window.visualViewport && window.visualViewport.height) || 0;
  if (h) document.documentElement.style.setProperty('--app-h', h + 'px');
}
window.addEventListener('resize', syncAppHeight);
window.addEventListener('orientationchange', syncAppHeight);
if (window.visualViewport) window.visualViewport.addEventListener('resize', syncAppHeight);

// ================= 各ページ上部（ヘッダーなど）の高さをCSS変数へ反映 =================
// 上部は内容の上に重ねて表示している（すりガラスで後ろが透ける）ので、その高さを実測して
// ページごとに --top-h に入れ、スクロール領域の上余白にする。入力欄の高さが変わったときも追従する
document.querySelectorAll('.pageTop').forEach((top) => {
  const host = top.parentElement;
  const update = () => {
    host.style.setProperty('--top-h', top.offsetHeight + 'px');
    // 全漢字・単語帳は目次の色付けのためにグループの位置を覚えているので、上部の高さが変わったら測り直す
    if (host === allKanjiScreen) allKanjiIndexHighlighter.refresh();
    if (host === wordbookScreen) wordbookIndexHighlighter.refresh();
  };
  if (window.ResizeObserver) new ResizeObserver(update).observe(top);
  update();
});

// iOSのSafariは、どこかにtouchstartの処理が無いとボタンを押している間の見た目（:active）を出さない
document.addEventListener('touchstart', () => {}, { passive: true });

// ================= タブバーが占める高さをCSS変数へ反映 =================
// env(safe-area-inset-bottom)を含む位置はブラウザ差が出やすいため、実際に描画された位置を測って
// 「画面下端からタブバー上端まで」の高さを var(--footer-total-h) に入れる（各ページの下余白に使う）。
function syncFooterOffsets() {
  const h = document.body.getBoundingClientRect().bottom - tabBar.getBoundingClientRect().top;
  document.documentElement.style.setProperty('--footer-total-h', Math.max(0, Math.round(h)) + 'px');
}
window.addEventListener('resize', syncFooterOffsets);
window.addEventListener('orientationchange', syncFooterOffsets);

// ================= 起動 =================
lastCommittedValue = input.value;
setTitleDisplay('');
setFocusMode(state.focusMode);
autoGrow();
updateDisplayTogglesUI();
renderInputPage();
// アプリを開いたときは単語帳ページから始める（起動時はタブの背景をすべらせずにその位置へ置く）
tabIndicator.style.transition = 'none';
showTab('wordbook', { skipFocus: true, force: true });
requestAnimationFrame(() => requestAnimationFrame(() => { tabIndicator.style.transition = ''; }));
syncAppHeight();
syncFooterOffsets();

// オフラインでも起動できるよう、アプリのファイルを端末に保存するService Worker（sw.js）を登録する
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => { /* noop */ });
}
