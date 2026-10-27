/**
 * Sudoku - PWA : enregistrement du service worker, mise à jour, bouton « Installer »
 * et astuce d'installation iOS (Safari n'a pas de bouton d'installation natif).
 */
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const isStandalone = () =>
        (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
        window.navigator.standalone === true;
    const IOS_HINT_KEY = 'sudoku_pwa_ios_hint_dismissed_v1';

    /* ---------- Installation (Android / Chrome / Edge / desktop) ---------- */
    let deferredPrompt = null;
    const btnInstall = $('btn-install');

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (btnInstall && !isStandalone()) btnInstall.classList.remove('hidden');
    });

    if (btnInstall) {
        btnInstall.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            try { await deferredPrompt.userChoice; } catch (_) { /* ignoré */ }
            deferredPrompt = null;
            btnInstall.classList.add('hidden');
        });
    }

    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        if (btnInstall) btnInstall.classList.add('hidden');
    });

    /* ---------- Astuce iOS ---------- */
    const ua = window.navigator.userAgent || '';
    const isIOS = /iphone|ipad|ipod/i.test(ua) ||
        (ua.includes('Macintosh') && navigator.maxTouchPoints > 1); // iPadOS
    const iosHint = $('ios-install-hint');
    if (iosHint && isIOS && !isStandalone()) {
        let dismissed = false;
        try { dismissed = localStorage.getItem(IOS_HINT_KEY) === '1'; } catch (_) { /* ignoré */ }
        if (!dismissed) {
            setTimeout(() => iosHint.classList.remove('hidden'), 2500);
        }
        const close = $('btn-ios-hint-close');
        if (close) {
            close.addEventListener('click', () => {
                iosHint.classList.add('hidden');
                try { localStorage.setItem(IOS_HINT_KEY, '1'); } catch (_) { /* ignoré */ }
            });
        }
    }

    /* ---------- Service worker + mise à jour ---------- */
    const canUseSW = 'serviceWorker' in navigator &&
        (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1');
    if (!canUseSW) return; // ex. ouverture directe en file:// : le jeu reste jouable, sans mode hors ligne

    const updateToast = $('update-toast');
    const btnUpdate = $('btn-update');
    let refreshing = false;

    const showUpdate = (worker) => {
        if (!updateToast) return;
        updateToast.classList.remove('hidden');
        if (btnUpdate) {
            btnUpdate.onclick = () => worker.postMessage({ type: 'SKIP_WAITING' });
        }
    };

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
    });

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then((reg) => {
            if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);

            reg.addEventListener('updatefound', () => {
                const worker = reg.installing;
                if (!worker) return;
                worker.addEventListener('statechange', () => {
                    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                        showUpdate(worker);
                    }
                });
            });

            // Vérifie les mises à jour quand l'app revient au premier plan
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') reg.update().catch(() => {});
            });
        }).catch((err) => console.warn('Service worker non enregistré :', err));
    });
})();
