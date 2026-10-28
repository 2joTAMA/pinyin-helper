/* ===== 入力ページ：文章とピンインの表示、元に戻す、保存・タイトル、ファイルを開く／新規 ===== */

// ---------- 入力ページの状態 ----------
let currentFileId = null;
let undoStack = [];      // 直近5件までの編集前スナップショット
let lastCommittedValue = '';
let typingTimer = null;
let burstStartValue = '';

// ================= surume（背景キャラ） =================
let hasText = false;
function updateSurume(nextHasText) {
  if (nextHasText === hasText) return;
  hasText = nextHasText;
  if (!surume) return;
  if (hasText) {
    surume.classList.remove('leaving', 'visible');
    void surume.offsetWidth;
    surume.classList.add('enter');
  } else {
    surume.classList.remove('enter', 'visible');
    void surume.offsetWidth;
    surume.classList.add('leaving');
  }
}
if (surume) {
  surume.addEventListener('animationend', (e) => {
    if (e.animationName === 'peekIn') {
      surume.classList.remove('enter');
      surume.classList.add('visible');
    } else if (e.animationName === 'peekOut') {
      surume.classList.remove('leaving');
    }
  });
}

// ================= undo (元に戻す) =================
function pushUndo(val) {
  clearTimeout(typingTimer);
  typingTimer = null;
  if (undoStack[undoStack.length - 1] === val) return;
  undoStack.push(val);
  if (undoStack.length > 5) undoStack.shift();
  undoBtn.disabled = undoStack.length === 0;
}

function commitInputValue(newValue, opts) {
  const skipUndo = opts && opts.skipUndo;
  if (!skipUndo && input.value !== newValue) {
    pushUndo(input.value);
  }
  input.value = newValue;
  lastCommittedValue = newValue;
  autoGrow();
}

// 入力中に押してもキーボードが閉じないよう、押した瞬間のフォーカス移動を止める
undoBtn.addEventListener('pointerdown', (e) => e.preventDefault());
undoBtn.addEventListener('click', () => {
  if (!undoStack.length) return;
  clearTimeout(typingTimer);
  typingTimer = null;
  const prev = undoStack.pop();
  input.value = prev;
  lastCommittedValue = prev;
  undoBtn.disabled = undoStack.length === 0;
  autoGrow();
  renderInputPage();
});

// ================= 入力ページ（文章とピンイン） =================
// 表示エリアで今一番上に見えている行（何番目の行か、その行の上端が表示エリアの上端からどれだけずれているか）
// 基準にするのは、上部（すりガラスのヘッダー）の下に上端まで見えている最初の行（書体が変わって行の高さが変わっても、
// 見えている行がずれないように。行が長くてそういう行が無いときは、ヘッダーの下にかかっている行）
function captureResultsAnchor() {
  const top = inputPageTop.getBoundingClientRect().bottom;
  const blocks = results.children;
  let partial = null;
  for (let i = 0; i < blocks.length; i++) {
    const r = blocks[i].getBoundingClientRect();
    if (r.bottom <= top) continue;
    if (r.top >= top - 1) return { index: i, offset: r.top - top, top };
    if (!partial) partial = { index: i, offset: r.top - top, top };
  }
  return partial;
}
// captureResultsAnchorで覚えた行が、描き直したあとも同じ位置に来るようにスクロールを合わせる
function restoreResultsAnchor(anchor) {
  const block = anchor && results.children[anchor.index];
  if (!block) return;
  results.scrollTop += block.getBoundingClientRect().top - anchor.top - anchor.offset;
}

// scrollAnchor（captureResultsAnchorの結果）を渡したときは、見ていた位置をそのまま保つ（表示切り替えボタン用）。
// 省略したときは入力中の最新の行が見えるよう一番下までスクロールする
function renderSentence(scrollAnchor) {
  const keepScroll = scrollAnchor !== undefined;
  const raw = input.value;
  const trimmed = raw ? raw.trim() : '';

  if (trimmed === '') {
    results.innerHTML = '<div class="emptyState"></div>';
    return;
  }

  const lines = raw.split('\n');
  const frag = document.createDocumentFragment();
  let hasBlock = false;
  let blankBefore = false; // 直前に表示した行との間に空行があったか

  lines.forEach((line) => {
    if (line.trim() === '') { blankBefore = true; return; }

    const normalized = normalizeToSimplified(line);
    let block;
    if (state.contourOn && !state.pinyinOff) {
      block = buildContourBlock(normalized);
    } else {
      block = document.createElement('div');
      block.className = 'lineBlock';
      const zhDiv = document.createElement('div');
      zhDiv.className = 'zhLine';
      renderDisplayText(zhDiv, normalized);
      block.appendChild(zhDiv);
      if (!state.pinyinOff) {
        const pyDiv = document.createElement('div');
        pyDiv.className = 'pyLine';
        pyDiv.textContent = lineToPinyin(normalized);
        block.appendChild(pyDiv);
      }
    }
    if (hasBlock && blankBefore) block.classList.add('afterBlank');
    frag.appendChild(block);
    hasBlock = true;
    blankBefore = false;
  });

  results.innerHTML = '';
  results.appendChild(frag);
  if (keepScroll) restoreResultsAnchor(scrollAnchor);
  else results.scrollTop = results.scrollHeight;
}

// ================= 入力欄を畳む =================
// 入力欄を畳む(true)／開く(false)
function setFocusMode(on) {
  state.focusMode = on;
  document.body.classList.toggle('focusMode', on);
  focusToggle.classList.toggle('active', on);
  focusToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
  focusToggle.title = on ? '入力欄を表示' : '入力欄を畳んで広く表示';
}
focusToggle.addEventListener('click', () => setFocusMode(!state.focusMode));

// ================= 入力ページの描画 =================
// keepWordSheet=trueのときは単語シートを閉じない（表示切り替えボタン用。呼び出し側でシートの中身を後から作り直す）
// scrollAnchorを渡したとき（captureResultsAnchorの結果。nullも可）は、表示エリアのスクロール位置を変えない（表示切り替えボタン用）。
// 省略したときは入力中の最新の行が見えるよう一番下までスクロールする
function renderInputPage(keepWordSheet, scrollAnchor) {
  if (!keepWordSheet) closeWordSheet();
  const trimmed = input.value ? input.value.trim() : '';
  updateSurume(trimmed !== '');
  updateSaveBtnDirtyState();
  renderSentence(scrollAnchor);
}

function autoGrow() {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, window.innerHeight * 0.22) + 'px';
}

input.addEventListener('input', () => {
  if (!typingTimer) burstStartValue = lastCommittedValue;
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    typingTimer = null;
    if (input.value !== burstStartValue) {
      pushUndo(burstStartValue);
      lastCommittedValue = input.value;
    }
  }, 800);
  autoGrow();
  renderInputPage();
});

// 押した瞬間に入力欄からフォーカスが外れるとボタン自体が引っ込むので、押し始めで処理してフォーカスを保つ
clearBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  commitInputValue('');
  input.focus();
  renderInputPage();
});

// ================= 保存・タイトル =================
// 開いているファイルのタイトルを入力ページの2段目に表示（まだタイトルのない新規ファイルは「無題」）
function setTitleDisplay(title) {
  fileTitle.textContent = title || '無題';
  fileTitle.classList.toggle('untitled', !title);
}

function flashSaved() {
  saveBtn.classList.add('justSaved');
  setTimeout(() => saveBtn.classList.remove('justSaved'), 700);
}

// 現在の内容が、最後に保存した状態から変わっているか（未保存の変更があるか）
function isDirty() {
  if (currentFileId) {
    const f = savedFiles.find((x) => x.id === currentFileId);
    if (!f) return false;
    return f.text !== input.value;
  }
  return input.value.trim() !== '';
}
function updateSaveBtnDirtyState() {
  saveBtn.classList.toggle('dirty', isDirty());
}

let modalContext = null; // { mode: 'new' } | { mode: 'rename', fileId }

const updateModalClearBtn = attachModalClearBtn(modalTitleInput, modalClearBtn);
function openSaveModal(ctx) {
  modalContext = ctx;
  modalHeading.textContent = ctx.mode === 'rename' ? 'タイトルを編集' : '保存';
  if (ctx.mode === 'rename') {
    const f = savedFiles.find((x) => x.id === ctx.fileId);
    modalTitleInput.value = f ? (f.title || '') : '';
  } else {
    modalTitleInput.value = '';
  }
  modalTitleInput.placeholder = '例）挨拶フレーズまとめ';
  updateModalClearBtn();
  saveModal.hidden = false;
  setTimeout(() => modalTitleInput.focus(), 0);
}
function closeSaveModal() {
  saveModal.hidden = true;
  modalContext = null;
}

// 既存ファイルの内容を保存する
function saveExistingFile() {
  const idx = savedFiles.findIndex((f) => f.id === currentFileId);
  if (idx < 0) return;
  savedFiles[idx].text = input.value;
  savedFiles[idx].mode = 'sentence'; // 単漢字モードは廃止。以前のバージョン向けに項目だけ残す
  savedFiles[idx].updatedAt = Date.now();
  persistSavedFiles();
}

// 別のタブへ移る・新規作成する・アプリが裏に回るときに呼ぶ：一度でも保存済みのファイルに未保存の変更があれば上書き保存する。
// まだ一度も保存していない文章（ピンインの確認だけに使ったものなど）は保存しない。
function autoSaveBeforeLeaving() {
  if (!currentFileId || !isDirty()) return;
  saveExistingFile();
  updateSaveBtnDirtyState();
}
// iPhoneはアプリが裏に回ったあと、知らないうちに終了させることがあるので、裏に回った時点で保存しておく
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') autoSaveBeforeLeaving();
});

// 開いているファイル（またはそれが入ったフォルダ）を保存一覧で削除したときは、入力欄の文章は残したまま
// 「まだ保存していない新しい文章」の扱いに戻す（削除済みのファイルに保存しようとして何も保存されない、を防ぐ）
function detachDeletedCurrentFile() {
  if (!currentFileId || savedFiles.some((f) => f.id === currentFileId)) return;
  currentFileId = null;
  setTitleDisplay('');
  updateSaveBtnDirtyState();
}

saveBtn.addEventListener('click', () => {
  if (currentFileId) {
    saveExistingFile();
    flashSaved();
    updateSaveBtnDirtyState();
  } else {
    openSaveModal({ mode: 'new' });
  }
});

renameBtn.addEventListener('click', () => {
  if (!currentFileId) { openSaveModal({ mode: 'new' }); return; }
  openSaveModal({ mode: 'rename', fileId: currentFileId });
});

modalCancelBtn.addEventListener('click', closeSaveModal);
saveModal.addEventListener('click', (e) => { if (e.target === saveModal) closeSaveModal(); });
modalTitleInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); modalSaveBtn.click(); }
});

modalSaveBtn.addEventListener('click', () => {
  if (!modalContext) return;
  const typedTitle = modalTitleInput.value.trim();

  if (modalContext.mode === 'rename') {
    const idx = savedFiles.findIndex((f) => f.id === modalContext.fileId);
    let title = typedTitle;
    if (idx >= 0) {
      // 空欄にしたときは、そのファイルの中身から自動タイトルをつけ直す
      if (!title) title = defaultTitleFromText(savedFiles[idx].text || '');
      savedFiles[idx].title = title;
      persistSavedFiles();
    }
    if (modalContext.fileId === currentFileId) setTitleDisplay(title);
    if (!listScreen.hidden) renderListRows();
  } else {
    const title = typedTitle || defaultTitleFromText(input.value);
    const file = {
      id: 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      title: title,
      mode: 'sentence', // 単漢字モードは廃止。以前のバージョン向けに項目だけ残す
      text: input.value,
      folderId: null, // アコーディオン化により「今開いているフォルダ」という概念がないため常にルートへ保存
      updatedAt: Date.now(),
    };
    savedFiles.unshift(file); // 新規保存は一覧の先頭へ。以降は手動の並び順を保持
    persistSavedFiles();
    currentFileId = file.id;
    setTitleDisplay(title);
    updateSaveBtnDirtyState();
  }
  closeSaveModal();
});

// ================= ファイルを開く／新規作成 =================
function loadFile(file) {
  currentFileId = file.id;
  setTitleDisplay(file.title);
  // 保存済みのファイルは読むために開くことが多いので、入力欄は畳んで広く見せる
  setFocusMode(true);
  commitInputValue(file.text || '', { skipUndo: true });
  undoStack = [];
  undoBtn.disabled = true;
  renderInputPage();
  // 開いた直後は入力中の状態にせず、常に先頭が見える状態にする
  input.blur();
  results.scrollTop = 0;
}

function startNewFile() {
  currentFileId = null;
  setTitleDisplay('');
  setFocusMode(false);
  commitInputValue('', { skipUndo: true });
  undoStack = [];
  undoBtn.disabled = true;
  renderInputPage();
}

newBtn.addEventListener('click', () => {
  autoSaveBeforeLeaving();
  startNewFile();
});
