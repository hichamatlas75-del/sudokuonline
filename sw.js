/**
 * Sudoku - Service Worker
 * Stratégie : « app shell » mis en cache à l'installation (cache-first) pour un
 * fonctionnement 100 % hors ligne, polices Google en stale-while-revalidate.
 *
 * ⚠️ À CHAQUE DÉPLOIEMENT qui modifie un fichier du jeu : incrémenter VERSION.
 *    Le navigateur détecte alors un nouveau sw.js, télécharge la nouvelle version
 *    en arrière-plan et pwa.js propose « Mettre à jour » à l'utilisateur.
 */
const VERSION = 'v1.0.0';
const SHELL_CACHE = `sudoku-shell-${VERSION}`;
const FONT_CACHE = 'sudoku-fonts-v1';

const SHELL = [
    './',
    'index.html',
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

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(SHELL_CACHE).then((cache) =>
            // cache: 'reload' contourne le cache HTTP pour ne pas figer d'anciennes copies
            cache.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' })))
        )
        // Pas de skipWaiting() automatique : on attend le choix de l'utilisateur (message SKIP_WAITING)
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

    // Navigation : toujours servir l'index du cache (cohérent avec les scripts du même cache)
    if (req.mode === 'navigate') {
        event.respondWith(
            caches.match('index.html', { ignoreSearch: true })
                .then((cached) => cached || fetch(req))
        );
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
