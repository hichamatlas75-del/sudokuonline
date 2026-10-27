/**
 * Sudoku - Service Worker
 * Stratégie : « app shell » mis en cache à l'installation (cache-first) pour un
 * fonctionnement 100 % hors ligne, polices Google en stale-while-revalidate.
 *
 * ⚠️ À CHAQUE DÉPLOIEMENT qui modifie un fichier du jeu : incrémenter VERSION.
 *    Le navigateur détecte alors un nouveau sw.js, télécharge la nouvelle version
 *    en arrière-plan et pwa.js propose « Mettre à jour » à l'utilisateur.
 *
 * v1.0.1 (correctif) : Cloudflare Pages redirige /index.html vers /. Une réponse
 * « redirigée » ne peut pas être servie à une navigation par un service worker
 * (Chrome affiche alors ERR_FAILED). On ne met donc en cache que « ./ » et on
 * nettoie toute réponse redirigée avant de la stocker.
 */
const VERSION = 'v1.2.1';
const SHELL_CACHE = `sudoku-shell-${VERSION}`;
const FONT_CACHE = 'sudoku-fonts-v1';

// Ne PAS ajouter 'index.html' ici : '/' est la même page, sans redirection.
const SHELL = [
    './',
    'styles.css',
    'sudoku-engine.js',
    'sound.js',
    'effects.js',
    'app.js',
    'pwa.js',
    'manifest.webmanifest',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/icon-maskable-512.png',
    'icons/apple-touch-icon.png',
    'icons/favicon-32.png'
];

/** Retire le drapeau « redirected » (interdit pour répondre à une navigation). */
async function clean(res) {
    if (!res.redirected) return res;
    const body = await res.blob();
    return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(SHELL_CACHE).then((cache) =>
            Promise.all(SHELL.map(async (url) => {
                // cache: 'reload' contourne le cache HTTP pour ne pas figer d'anciennes copies
                const res = await fetch(new Request(url, { cache: 'reload' }));
                if (!res.ok) throw new Error(`Précache impossible : ${url} (${res.status})`);
                await cache.put(url, await clean(res));
            }))
        ).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys
                    .filter((k) => k.startsWith('sudoku-shell-') && k !== SHELL_CACHE)
                    .map((k) => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);

    // Polices Google : stale-while-revalidate
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
        event.respondWith(staleWhileRevalidate(req, FONT_CACHE));
        return;
    }

    if (url.origin !== self.location.origin) return;

    // Navigation : page du cache (cohérente avec les scripts du même cache), sinon réseau
    if (req.mode === 'navigate') {
        event.respondWith((async () => {
            const cached = await caches.match('./', { ignoreSearch: true });
            if (cached) return cached;
            return fetch(req);
        })());
        return;
    }

    // Autres ressources du jeu : cache-first, repli réseau
    event.respondWith(
        caches.match(req, { ignoreSearch: true }).then((cached) => cached || fetch(req))
    );
});

function staleWhileRevalidate(req, cacheName) {
    return caches.open(cacheName).then((cache) =>
        cache.match(req).then((cached) => {
            const network = fetch(req)
                .then((res) => {
                    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
                    return res;
                })
                .catch(() => cached);
            return cached || network;
        })
    );
}
