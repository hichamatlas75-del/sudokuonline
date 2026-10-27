/**
 * Sudoku - PWA : enregistrement du Service Worker, bannière d'invitation à l'installation,
 * bouton « Installer » (barre de navigation + paramètres) et guide pas-à-pas intelligent
 * pour Android, iOS (Safari) et Desktop.
 */
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);

    const isStandalone = () =>
        (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
        (window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches) ||
        window.navigator.standalone === true;

    const BANNER_DISMISSED_KEY = 'sudoku_pwa_banner_dismissed_session_v2';

    const btnInstall = $('btn-install');
    const btnSettingsInstall = $('btn-settings-install');
    const settingsInstallCard = $('settings-install-card');
    const installBanner = $('pwa-install-banner');
    const btnBannerInstall = $('btn-banner-install');
    const btnBannerClose = $('btn-banner-close');
    const modalInstallPwa = $('modal-install-pwa');
    const installGuideSteps = $('install-guide-steps');

    const ua = window.navigator.userAgent || '';
    const isIOS = /iphone|ipad|ipod/i.test(ua) ||
        (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
    const isAndroid = /android/i.test(ua);

    /** Masque tous les éléments d'installation lorsque l'app est déjà installée. */
    function syncInstallVisibility() {
        const installed = isStandalone();
        if (btnInstall) btnInstall.classList.toggle('hidden', installed);
        if (settingsInstallCard) settingsInstallCard.classList.toggle('hidden', installed);
        if (installed && installBanner) installBanner.classList.add('hidden');
    }

    /** Construit les instructions visuelles selon l'appareil si le prompt natif n'est pas disponible. */
    function openInstallGuideModal() {
        if (!modalInstallPwa || !installGuideSteps) return;

        if (isIOS) {
            installGuideSteps.innerHTML = `
                <div class="install-step">
                    <span class="install-step-num">1</span>
                    <div>
                        <strong>Touchez le bouton Partager</strong>
                        <p>Dans la barre de Safari (en bas ou en haut), appuyez sur l'icône <strong>Partager ⬆️</strong>.</p>
                    </div>
                </div>
                <div class="install-step">
                    <span class="install-step-num">2</span>
                    <div>
                        <strong>Sur l'écran d'accueil</strong>
                        <p>Faites défiler le menu et appuyez sur <strong>« Sur l'écran d'accueil » (➕)</strong>, puis validez par <strong>Ajouter</strong>.</p>
                    </div>
                </div>
            `;
        } else if (isAndroid) {
            installGuideSteps.innerHTML = `
                <div class="install-step">
                    <span class="install-step-num">1</span>
                    <div>
                        <strong>Ouvrez le menu du navigateur (⋮)</strong>
                        <p>Appuyez sur les <strong>3 points ⋮</strong> en haut à droite de Chrome (ou le menu en bas sur Samsung Internet / Firefox).</p>
                    </div>
                </div>
                <div class="install-step">
                    <span class="install-step-num">2</span>
                    <div>
                        <strong>Installer l'application</strong>
                        <p>Sélectionnez <strong>« Installer l'application »</strong> ou <strong>« Ajouter à l'écran d'accueil »</strong> puis confirmez.</p>
                    </div>
                </div>
            `;
        } else {
            installGuideSteps.innerHTML = `
                <div class="install-step">
                    <span class="install-step-num">1</span>
                    <div>
                        <strong>Icône d'installation dans la barre d'adresse</strong>
                        <p>Cliquez sur l'icône <strong>Installer 📥</strong> située à droite de la barre d'adresse (Chrome, Edge, Brave).</p>
                    </div>
                </div>
                <div class="install-step">
                    <span class="install-step-num">2</span>
                    <div>
                        <strong>Ou via le menu du navigateur (⋮)</strong>
                        <p>Ouvrez le menu <strong>⋮ → Caster, enregistrer et partager → Installer la page en tant qu'application</strong>.</p>
                    </div>
                </div>
            `;
        }

        const settingsModal = $('modal-settings');
        if (settingsModal) settingsModal.classList.add('hidden');
        modalInstallPwa.classList.remove('hidden');
    }

    /** Déclenche le prompt d'installation natif ou ouvre le guide d'installation. */
    async function triggerInstall() {
        const promptEvent = window.__deferredPrompt;
        if (installBanner) installBanner.classList.add('hidden');

        if (promptEvent) {
            try {
                promptEvent.prompt();
                const choice = await promptEvent.userChoice;
                window.__deferredPrompt = null;
                if (choice && choice.outcome === 'accepted') {
                    syncInstallVisibility();
                }
            } catch (_) {
                openInstallGuideModal();
            }
        } else {
            openInstallGuideModal();
        }
    }

    // Écouteur supplémentaire au cas où beforeinstallprompt arrive plus tard
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        window.__deferredPrompt = e;
        syncInstallVisibility();
        showInstallBannerIfNeeded();
    });

    window.addEventListener('appinstalled', () => {
        window.__deferredPrompt = null;
        if (modalInstallPwa) modalInstallPwa.classList.add('hidden');
        syncInstallVisibility();
    });

    if (btnInstall) btnInstall.addEventListener('click', triggerInstall);
    if (btnSettingsInstall) btnSettingsInstall.addEventListener('click', triggerInstall);
    if (btnBannerInstall) btnBannerInstall.addEventListener('click', triggerInstall);

    if (btnBannerClose) {
        btnBannerClose.addEventListener('click', () => {
            if (installBanner) installBanner.classList.add('hidden');
            try { sessionStorage.setItem(BANNER_DISMISSED_KEY, '1'); } catch (_) {}
        });
    }

    function showInstallBannerIfNeeded() {
        if (!installBanner || isStandalone()) return;
        let dismissed = false;
        try { dismissed = sessionStorage.getItem(BANNER_DISMISSED_KEY) === '1'; } catch (_) {}
        if (!dismissed) {
            installBanner.classList.remove('hidden');
        }
    }

    // Afficher l'état initial et proposer la bannière après 1,4 s si l'app n'est pas installée
    syncInstallVisibility();
    if (!isStandalone()) {
        setTimeout(showInstallBannerIfNeeded, 1400);
    }

    /* ---------- Service Worker + Mise à jour ---------- */
    const canUseSW = 'serviceWorker' in navigator &&
        (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1');
    if (!canUseSW) return;

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

            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') reg.update().catch(() => {});
            });
        }).catch((err) => console.warn('Service worker non enregistré :', err));
    });
})();
