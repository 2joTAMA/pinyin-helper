/* ===== Service Worker：電波がない場所でもアプリを起動できるよう、アプリのファイルを端末に保存しておく =====
   - index.html と style.css（アプリ本体）は「ネット優先」：最新版を取りに行き、圏外や応答が遅いとき（3秒）だけ保存版を使う。
     修正をpushしたら、次に電波のある場所で開いたときにすぐ反映される（HTMLとCSSの版が食い違わない）。
   - ライブラリ・辞書・画像は「保存版優先」：保存版ですぐ表示し、裏で更新を確認して次回から新しい方を使う。
   - 保存したい・消したいファイルが増減したときは、PRECACHE_URLS と CACHE_NAME の番号を更新する。
   ※ 保存した文章・単語帳などのデータ（localStorage）はここでは一切扱わない。 */
const CACHE_NAME = 'pinyin-helper-v2';
const PRECACHE_URLS = [
  './',
  'index.html',
  'style.css',
  'manifest.webmanifest',
  'vendor/pinyin-pro.min.js',
  'data/kanji-map.js',
  'data/char-freq.js',
  'data/custom-words.js',
  'images/apple-touch-icon.png',
  'images/surume.png',
];
const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// 古い番号のキャッシュを消す
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function putInCache(request, response) {
  if (!response || !response.ok) return;
  const copy = response.clone();
  caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
}

// ネット優先。失敗したかタイムアウトしたら保存版（どちらも無ければネットの結果を待つ）。
// ページ本体（navigate）で保存版が見つからないときは index.html の保存版を使う
function networkFirst(request) {
  const network = fetch(request).then((res) => { putInCache(request, res); return res; });
  const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT_MS));
  const fallback = () => caches.match(request, { ignoreSearch: true })
    .then((cached) => cached || (request.mode === 'navigate' ? caches.match('index.html') : undefined));
  return Promise.race([network, timeout.then(() => fallback())])
    .then((res) => res || network)
    .catch(() => fallback().then((cached) => cached || network));
}

// 保存版優先。裏でネットから取り直して保存版を更新しておく
function staleWhileRevalidate(request) {
  return caches.match(request).then((cached) => {
    const network = fetch(request)
      .then((res) => { putInCache(request, res); return res; })
      .catch(() => cached);
    return cached || network;
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const isAppShell = req.mode === 'navigate' || new URL(req.url).pathname.endsWith('/style.css');
  event.respondWith(isAppShell ? networkFirst(req) : staleWhileRevalidate(req));
});
