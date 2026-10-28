/* ===== 保存一覧ページ：バックアップ、フォルダとファイルの一覧、スワイプ・並び替え、フォルダ移動・フォルダ名 ===== */
// ---------- バックアップの書き出し／読み込み ----------
// ホーム画面アプリはブラウザ側の事情でデータ領域が消えることがあるため、
// 手元にJSONファイルとして退避・復元できるようにする。
function exportBackup() {
  const payload = {
    app: 'pinyin-helper',
    version: 2,
    exportedAt: Date.now(),
    savedFiles: savedFiles,
    folders: folders,
    words: savedWords,
    personWords: Array.from(personWords),
    allKanji: allKanji,
  };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const pad = (n) => String(n).padStart(2, '0');
  const d = new Date();
  const stamp = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes());

  const a = document.createElement('a');
  a.href = url;
  a.download = 'pinyin-helper-backup-' + stamp + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// 既存データは残したまま、まだ無いファイル・フォルダ・単語・人名登録・全漢字だけを追加する（上書きしない）。
// version 1 のバックアップには personWords / allKanji が無いので、その場合は単語に含まれる漢字だけ全漢字に足す。
// 戻り値は種類ごとの追加件数
function mergeImportedBackup(data) {
  const importedFolders = Array.isArray(data.folders) ? data.folders : [];
  const importedFiles = Array.isArray(data.savedFiles) ? data.savedFiles : [];
  const importedWords = Array.isArray(data.words) ? data.words : [];
  const importedPersonWords = Array.isArray(data.personWords) ? data.personWords : [];
  const importedAllKanji = Array.isArray(data.allKanji) ? data.allKanji : [];
  const counts = { files: 0, words: 0, personWords: 0, kanji: 0 };

  const existingFolderIds = new Set(folders.map((f) => f.id));
  importedFolders.forEach((f) => {
    if (f && f.id && !existingFolderIds.has(f.id)) {
      folders.push(f);
      existingFolderIds.add(f.id);
    }
  });

  const existingFileIds = new Set(savedFiles.map((f) => f.id));
  importedFiles.forEach((f) => {
    if (f && f.id && !existingFileIds.has(f.id)) {
      migrateFileTitle(f);
      savedFiles.push(f);
      existingFileIds.add(f.id);
      counts.files += 1;
    }
  });

  const existingWords = new Set(savedWords);
  importedWords.forEach((w) => {
    if (typeof w === 'string' && w && !existingWords.has(w)) {
      savedWords.push(w);
      existingWords.add(w);
      counts.words += 1;
    }
  });

  // 人名登録は単語帳に存在する単語の分だけ取り込む
  importedPersonWords.forEach((w) => {
    if (typeof w === 'string' && existingWords.has(w) && !personWords.has(w)) {
      personWords.add(w);
      counts.personWords += 1;
    }
  });

  // 全漢字はバックアップ内の登録順を保ったまま末尾に足し、続けて単語に含まれる漢字も足す
  // （アプリ内で単語を登録したときと同じく、単語の漢字は全漢字にも入っている状態にそろえる）
  const kanjiBefore = allKanji.length;
  addAllKanji(importedAllKanji.filter((ch) => typeof ch === 'string').join(''));
  addAllKanji(importedWords.filter((w) => typeof w === 'string').join(''));
  counts.kanji = allKanji.length - kanjiBefore;

  persistFolders();
  persistSavedFiles();
  persistWords();
  persistPersonWords();
  return counts;
}

exportBtn.addEventListener('click', exportBackup);
importBtn.addEventListener('click', () => importFileInput.click());
importFileInput.addEventListener('change', () => {
  const file = importFileInput.files && importFileInput.files[0];
  importFileInput.value = '';
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try {
      data = JSON.parse(String(reader.result));
    } catch (e) {
      alert('ファイルの読み込みに失敗しました（JSON形式が正しくないようです）');
      return;
    }
    if (!data || (data.app !== 'pinyin-helper' &&
        !['savedFiles', 'folders', 'words', 'personWords', 'allKanji'].some((k) => Array.isArray(data[k])))) {
      alert('このファイルはバックアップ形式ではないようです');
      return;
    }
    const c = mergeImportedBackup(data);
    renderListRows();
    refreshWordbookIfOpen();
    refreshAllKanjiIfOpen();
    const parts = [];
    if (c.files) parts.push('ファイル' + c.files + '件');
    if (c.words) parts.push('単語' + c.words + '件');
    if (c.personWords) parts.push('人名登録' + c.personWords + '件');
    if (c.kanji) parts.push('漢字' + c.kanji + '字');
    alert(parts.length
      ? parts.join('、') + 'を読み込みました（既存のデータはそのまま残っています）'
      : '新しく追加されたデータはありませんでした（すでに読み込み済みの可能性があります）');
  };
  reader.readAsText(file);
});

// 保存一覧の表示状態：フォルダはアコーディオンなので展開中のIDをSetで持つ
const expandedFolders = new Set();

function fileCountInFolder(id) {
  return savedFiles.filter((f) => (f.folderId || null) === id).length;
}
function addFolder(name) {
  const folder = {
    id: 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: name,
    createdAt: Date.now(),
  };
  folders.push(folder);
  persistFolders();
  return folder;
}

// ---------- フォルダ名ダイアログの「クリア」ボタン ----------
const updateNameModalClearBtn = attachModalClearBtn(nameModalInput, document.getElementById('nameModalClearBtn'));

// ================= 保存一覧ページ =================

function emptyRow(msg) {
  const empty = document.createElement('div');
  empty.className = 'listEmpty';
  empty.textContent = msg;
  return empty;
}

// iOSの「設定」アプリのように、角丸のカード（セクション）の中に行を並べる。
// 上のカード：フォルダ（展開中はその下に中のファイル）＋末尾に「フォルダを追加…」、下のカード：フォルダに入っていないファイル
function renderListRows() {
  listRows.innerHTML = '';

  const folderSection = document.createElement('div');
  folderSection.className = 'listSection';
  folders.forEach((folder) => {
    folderSection.appendChild(makeFolderRow(folder));
    if (!expandedFolders.has(folder.id)) return;
    const body = document.createElement('div');
    body.className = 'folderBody';
    const inFolder = savedFiles.filter((f) => (f.folderId || null) === folder.id);
    if (!inFolder.length) {
      body.appendChild(emptyRow('このフォルダは空です'));
    } else {
      inFolder.forEach((file) => body.appendChild(makeListRow(file)));
    }
    folderSection.appendChild(body);
  });
  // iOSの設定アプリの「〜を追加…」行と同じく、追加の操作はカードの最後の行に置く
  const newFolderBtn = document.createElement('button');
  newFolderBtn.type = 'button';
  newFolderBtn.className = 'newFolderRow';
  newFolderBtn.innerHTML = FOLDER_PLUS_SVG + '<span>フォルダを追加…</span>';
  newFolderBtn.addEventListener('click', createFolderFlow);
  folderSection.appendChild(newFolderBtn);
  listRows.appendChild(folderSection);

  const rootFiles = savedFiles
    .filter((f) => !f.folderId || !folders.some((d) => d.id === f.folderId));
  if (!folders.length && !rootFiles.length) {
    listRows.appendChild(emptyRow('保存された内容はまだありません'));
    return;
  }
  if (!rootFiles.length) return;
  const fileSection = document.createElement('div');
  fileSection.className = 'listSection';
  rootFiles.forEach((file) => fileSection.appendChild(makeListRow(file)));
  listRows.appendChild(fileSection);
}

// 保存済みファイルを複製する。複製は元ファイルのすぐ後ろに挿入し、一覧で区別できるようタイトルに「のコピー」を付ける
function duplicateFile(file) {
  const copy = Object.assign({}, file, {
    id: 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    title: (file.title || '無題') + 'のコピー',
    updatedAt: Date.now(),
  });
  const idx = savedFiles.findIndex((f) => f.id === file.id);
  savedFiles.splice(idx + 1, 0, copy);
  persistSavedFiles();
  renderListRows();
}

// ---------- ファイル行・フォルダ行 ----------
function makeListRow(file) {
  const wrap = document.createElement('div');
  wrap.className = 'listRowWrap';

  const actions = document.createElement('div');
  actions.className = 'listRowActions';

  actions.appendChild(makeRowActionBtn('actMove', MOVE_SVG, '移動', () => openFolderPicker(file)));
  actions.appendChild(makeRowActionBtn('actDuplicate', COPY_SVG, '複製', () => duplicateFile(file)));
  actions.appendChild(makeRowActionBtn('actDelete', TRASH_SVG, '削除', () => {
    if (!window.confirm('「' + file.title + '」を削除しますか？')) return;
    savedFiles = savedFiles.filter((f) => f.id !== file.id);
    persistSavedFiles();
    detachDeletedCurrentFile();
    renderListRows();
  }));

  const row = document.createElement('div');
  row.className = 'listRow' + (file.id === currentFileId ? ' current' : '');
  row.dataset.fileId = file.id;

  const titleWrap = document.createElement('span');
  titleWrap.className = 'listTitleWrap';

  const title = document.createElement('span');
  title.className = 'listTitle';
  title.textContent = file.title;
  titleWrap.appendChild(title);

  const meta = document.createElement('span');
  meta.className = 'listMeta';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'listEditBtn';
  editBtn.innerHTML = PENCIL_SVG;
  editBtn.setAttribute('aria-label', 'タイトルを編集');
  editBtn.title = 'タイトルを編集';
  // editBtnはrow内部の子要素なので、rowのタップ判定（ファイルを開く）に巻き込まれないようpointerdown段階で止める
  editBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openSaveModal({ mode: 'rename', fileId: file.id });
  });
  meta.appendChild(editBtn);
  const chev = document.createElement('span');
  chev.className = 'rowChevron';
  chev.innerHTML = CHEVRON_SVG;
  meta.appendChild(chev);

  row.appendChild(titleWrap);
  row.appendChild(meta);

  wrap.appendChild(actions);
  wrap.appendChild(row);
  attachRowGestures(wrap, row, () => { loadFile(file); showTab('input'); }, true);
  return wrap;
}

function makeFolderRow(folder) {
  const wrap = document.createElement('div');
  wrap.className = 'listRowWrap';

  const actions = document.createElement('div');
  actions.className = 'listRowActions';

  actions.appendChild(makeRowActionBtn('actMove', PENCIL_SVG, '名前を変更', () => renameFolderFlow(folder)));
  actions.appendChild(makeRowActionBtn('actDelete', TRASH_SVG, '削除', () => {
    const n = fileCountInFolder(folder.id);
    const msg = n
      ? 'フォルダ「' + folder.name + '」を削除します。\n中の' + n + '件も一緒に削除されます。'
      : 'フォルダ「' + folder.name + '」を削除しますか？';
    if (!window.confirm(msg)) return;
    savedFiles = savedFiles.filter((f) => f.folderId !== folder.id);
    folders = folders.filter((x) => x.id !== folder.id);
    expandedFolders.delete(folder.id);
    persistFolders();
    persistSavedFiles();
    detachDeletedCurrentFile();
    renderListRows();
  }));

  if (expandedFolders.has(folder.id)) wrap.classList.add('expanded');

  const row = document.createElement('div');
  row.className = 'listRow folderRow';
  row.dataset.folderId = folder.id;

  const name = document.createElement('span');
  name.className = 'listTitle';
  name.innerHTML = FOLDER_SVG + '<span>' + escapeHtml(folder.name) + '</span>';

  const meta = document.createElement('span');
  meta.className = 'listMeta';
  const count = document.createElement('span');
  count.className = 'folderCount';
  count.textContent = String(fileCountInFolder(folder.id));
  const chev = document.createElement('span');
  chev.className = 'folderChevron';
  chev.innerHTML = CHEVRON_SVG;
  meta.appendChild(count);
  meta.appendChild(chev);

  row.appendChild(name);
  row.appendChild(meta);

  wrap.appendChild(actions);
  wrap.appendChild(row);
  attachRowGestures(wrap, row, () => {
    if (expandedFolders.has(folder.id)) expandedFolders.delete(folder.id);
    else expandedFolders.add(folder.id);
    renderListRows();
  }, true, {
    attr: 'folderId',
    commit: commitFolderOrderFromDom,
    // 展開中に並び替えを始めたら、中身(.folderBody)を置き去りにしないよう先に畳む
    onDragStart: () => {
      if (!expandedFolders.has(folder.id)) return;
      expandedFolders.delete(folder.id);
      wrap.classList.remove('expanded');
      const body = wrap.nextSibling;
      if (body && body.classList && body.classList.contains('folderBody')) body.remove();
    },
  });
  return wrap;
}

// 行のジェスチャ：タップで開く／左スワイプでアクション表示／長押しで並び替え
// ファイル行・フォルダ行の両方で使う共通実装。opts.attrで対象行の判別用データ属性
// （'fileId'→data-file-id、'folderId'→data-folder-id）を切り替え、その種類の行同士でだけ
// 並び替えが完結するようにする（opts省略時はファイル行向けの既定値で動く）。
function attachRowGestures(wrap, row, onOpen, enableReorder, opts) {
  // 左スワイプで開く幅＝右に並ぶ丸ボタンの列の幅（ボタンの数で変わるので実寸を使う）
  const actionsEl = wrap.querySelector('.listRowActions');
  let ACTION_W = 0;
  const HOLD_MS = 380;
  const MOVE_CANCEL = 10;
  const itemAttr = (opts && opts.attr) || 'fileId';
  const itemSelector = '.listRow[' + dataAttrName(itemAttr) + ']';
  const commitOrder = (opts && opts.commit) || commitOrderFromDom;

  let startX = 0, startY = 0, grabX = 0, grabY = 0, lastY = 0;
  let pointerId = null;
  let holdTimer = null, armTimer = null;
  let mode = null; // null | 'swipe' | 'scroll' | 'drag'
  let currentX = 0;
  let placeholder = null;
  let offX = 0, offY = 0;
  let autoDir = 0, rafId = 0;
  let dragScope = null;

  function preventTouch(e) { e.preventDefault(); }
  function clearTimers() {
    clearTimeout(holdTimer); holdTimer = null;
    clearTimeout(armTimer); armTimer = null;
    wrap.classList.remove('armed');
  }

  row.addEventListener('pointerdown', (e) => {
    if (mode || pointerId !== null || !e.isPrimary) return;
    pointerId = e.pointerId;
    startX = grabX = e.clientX;
    startY = grabY = lastY = e.clientY;
    currentX = 0;
    mode = null;
    if (enableReorder) {
      armTimer = setTimeout(() => { if (mode === null) wrap.classList.add('armed'); }, Math.max(0, HOLD_MS - 130));
      holdTimer = setTimeout(startDrag, HOLD_MS);
    }
  });

  row.addEventListener('pointermove', (e) => {
    if (pointerId === null) return;
    grabX = e.clientX; grabY = lastY = e.clientY;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (mode === null) {
      if (Math.abs(dx) + Math.abs(dy) > MOVE_CANCEL) {
        clearTimers();
        mode = Math.abs(dx) > Math.abs(dy) ? 'swipe' : 'scroll';
        if (mode === 'swipe') {
          ACTION_W = actionsEl ? actionsEl.offsetWidth : 0;
          row.style.transition = 'none';
          try { row.setPointerCapture(pointerId); } catch (err) { /* noop */ }
        }
      }
    }

    if (mode === 'swipe') {
      currentX = Math.min(0, Math.max(-ACTION_W, dx));
      row.style.transform = 'translateX(' + currentX + 'px)';
    } else if (mode === 'drag') {
      e.preventDefault();
      wrap.style.left = (e.clientX - offX) + 'px';
      wrap.style.top = (e.clientY - offY) + 'px';
      updatePlaceholder(e.clientY);
      edgeAutoScroll(e.clientY);
    }
  });

  function endPointer(isUp) {
    if (pointerId === null) return;
    const pid = pointerId;
    const wasMode = mode;
    pointerId = null;
    clearTimers();

    if (wasMode === 'drag') { finishDrag(pid); mode = null; return; }
    try { row.releasePointerCapture(pid); } catch (err) { /* noop */ }

    if (wasMode === 'swipe') {
      row.style.transition = '';
      const open = currentX < -(ACTION_W / 3);
      row.style.transform = open ? 'translateX(-' + ACTION_W + 'px)' : '';
      row.classList.toggle('swiped', open);
      mode = null;
      return;
    }

    mode = null;
    if (wasMode === 'scroll' || !isUp) return;

    if (row.classList.contains('swiped')) {
      row.classList.remove('swiped');
      row.style.transform = '';
      return;
    }
    onOpen();
  }
  row.addEventListener('pointerup', () => endPointer(true));
  row.addEventListener('pointercancel', () => endPointer(false));
  row.addEventListener('contextmenu', (e) => { if (mode === 'drag' || wrap.classList.contains('armed')) e.preventDefault(); });

  function startDrag() {
    if (mode !== null || pointerId === null) return;
    mode = 'drag';
    wrap.classList.remove('armed');
    row.classList.remove('swiped');
    row.style.transition = '';
    row.style.transform = '';
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch (err) { /* noop */ } }
    // フォルダ行の場合、展開中の中身（.folderBody）を置き去りにしないよう
    // 並び替え開始時に呼び出し側で先に畳んでもらう
    if (opts && opts.onDragStart) opts.onDragStart();

    // 並び替えは今いる枠（ルート直下 or 展開中のフォルダの中）の中だけで完結させる
    dragScope = wrap.parentNode;

    const r = wrap.getBoundingClientRect();
    offX = grabX - r.left;
    offY = grabY - r.top;

    placeholder = document.createElement('div');
    placeholder.className = 'listRowPlaceholder';
    placeholder.style.height = r.height + 'px';
    wrap.parentNode.insertBefore(placeholder, wrap.nextSibling);

    wrap.style.width = r.width + 'px';
    wrap.style.left = r.left + 'px';
    wrap.style.top = r.top + 'px';
    wrap.classList.add('rowDragging');
    listRows.classList.add('isDragging');

    try { row.setPointerCapture(pointerId); } catch (err) { /* noop */ }
    document.addEventListener('touchmove', preventTouch, { passive: false });
  }

  function fileWraps() {
    return Array.prototype.filter.call(
      dragScope.querySelectorAll('.listRowWrap'),
      (w) => w !== wrap && w.querySelector(itemSelector)
    );
  }
  function updatePlaceholder(y) {
    if (!placeholder) return;
    const others = fileWraps();
    // 並び替える相手がいなければ、ドラッグ開始時に置いた元の位置のまま（末尾の「フォルダを追加…」行より下へ行かないように）
    if (!others.length) return;
    let target = null;
    for (let i = 0; i < others.length; i++) {
      const rr = others[i].getBoundingClientRect();
      if (y < rr.top + rr.height / 2) { target = others[i]; break; }
    }
    if (target) dragScope.insertBefore(placeholder, target);
    else dragScope.insertBefore(placeholder, others[others.length - 1].nextSibling);
  }
  function edgeAutoScroll(y) {
    // 一覧はヘッダーとタブバーの下まで広がっているので、実際に見えている範囲の上下端で判定する
    const topEdge = listScreen.querySelector('.pageTop').getBoundingClientRect().bottom;
    const bottomEdge = tabBar.getBoundingClientRect().top;
    autoDir = y < topEdge + 52 ? -1 : (y > bottomEdge - 52 ? 1 : 0);
    if (autoDir && !rafId) rafId = requestAnimationFrame(scrollTick);
  }
  function scrollTick() {
    rafId = 0;
    if (mode !== 'drag' || !autoDir) return;
    listRows.scrollTop += autoDir * 9;
    updatePlaceholder(lastY);
    rafId = requestAnimationFrame(scrollTick);
  }
  function finishDrag(pid) {
    document.removeEventListener('touchmove', preventTouch, { passive: false });
    autoDir = 0;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    if (placeholder && placeholder.parentNode) {
      dragScope.insertBefore(wrap, placeholder);
      placeholder.remove();
    }
    placeholder = null;
    wrap.classList.remove('rowDragging');
    wrap.style.width = wrap.style.left = wrap.style.top = '';
    listRows.classList.remove('isDragging');
    try { row.releasePointerCapture(pid); } catch (err) { /* noop */ }
    commitOrder(dragScope);
    dragScope = null;
  }
}

// DOM 上の行の並びを配列に反映した新しい配列を返す（表示中の行だけを、その枠内で入れ替える）。
// attrは行のdata属性のdataset上の名前（'fileId' | 'folderId'）
function reorderByDom(list, scope, attr) {
  const shownIds = Array.prototype.map.call(scope.querySelectorAll('.listRow[' + dataAttrName(attr) + ']'), (r) => r.dataset[attr]);
  const shown = new Set(shownIds);
  const byId = new Map(list.map((x) => [x.id, x]));
  const queue = shownIds.map((id) => byId.get(id)).filter(Boolean);
  let qi = 0;
  return list.map((x) => (shown.has(x.id) ? queue[qi++] : x));
}
function commitOrderFromDom(scope) {
  savedFiles = reorderByDom(savedFiles, scope, 'fileId');
  persistSavedFiles();
}
function commitFolderOrderFromDom(scope) {
  folders = reorderByDom(folders, scope, 'folderId');
  persistFolders();
}

// ---------- フォルダ移動ピッカー ----------
function openFolderPicker(file) {
  folderPickerList.innerHTML = '';

  const mkItem = (label, active, isAction, onClick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'folderPickItem' + (active ? ' active' : '') + (isAction ? ' action' : '');
    b.innerHTML = (isAction ? FOLDER_PLUS_SVG : FOLDER_SVG) +
      '<span>' + escapeHtml(label) + '</span>' + (active ? CHECK_SVG : '');
    b.addEventListener('click', onClick);
    folderPickerList.appendChild(b);
  };

  mkItem('フォルダなし', !file.folderId, false, () => moveFileToFolder(file, null));
  folders.forEach((f) => mkItem(f.name, file.folderId === f.id, false, () => moveFileToFolder(file, f.id)));
  mkItem('フォルダを追加…', false, true, async () => {
    const nm = await askName('フォルダを追加', '');
    if (!nm) return;
    moveFileToFolder(file, addFolder(nm).id);
  });

  folderPicker.hidden = false;
}
function closeFolderPicker() { folderPicker.hidden = true; }
function moveFileToFolder(file, folderId) {
  file.folderId = folderId;
  persistSavedFiles();
  closeFolderPicker();
  renderListRows();
}
folderPickerCancel.addEventListener('click', closeFolderPicker);
folderPicker.addEventListener('click', (e) => { if (e.target === folderPicker) closeFolderPicker(); });

// ---------- 名前入力モーダル（フォルダの作成・改名で共用） ----------
let nameResolve = null;
function askName(heading, initial) {
  return new Promise((resolve) => {
    nameResolve = resolve;
    nameModalHeading.textContent = heading;
    nameModalInput.value = initial || '';
    updateNameModalClearBtn();
    nameModal.hidden = false;
    setTimeout(() => { nameModalInput.focus(); nameModalInput.select(); }, 0);
  });
}
function finishName(val) {
  if (!nameResolve) return;
  const r = nameResolve;
  nameResolve = null;
  nameModal.hidden = true;
  r(val);
}
nameModalCancel.addEventListener('click', () => finishName(null));
nameModalOk.addEventListener('click', () => finishName(nameModalInput.value.trim() || null));
nameModalInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); nameModalOk.click(); }
});
nameModal.addEventListener('click', (e) => { if (e.target === nameModal) finishName(null); });

async function createFolderFlow() {
  const nm = await askName('フォルダを追加', '');
  if (!nm) return;
  addFolder(nm);
  renderListRows();
}
async function renameFolderFlow(folder) {
  const nm = await askName('フォルダ名を変更', folder.name);
  if (!nm) return;
  folder.name = nm;
  persistFolders();
  renderListRows();
}
