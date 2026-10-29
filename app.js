/**
 * Sudoku.com Clone - Contrôleur d'application principal (UI, État, Chronomètre, Sauvegarde & Stats)
 */

class SudokuApp {
    static STORAGE_KEY_GAME = 'sudoku_com_saved_game_v1';
    static STORAGE_KEY_SETTINGS = 'sudoku_com_settings_v1';
    static STORAGE_KEY_STATS = 'sudoku_com_stats_v1';
    static STORAGE_KEY_PROFILE = 'sudoku_com_profile_v1';
    static CLOUD_KV_ENDPOINT = '/api/sync';

    // Nom d'animation CSS -> classe à retirer quand elle se termine
    static ANIM_CLASS_MAP = {
        cellPop: 'anim-pop',
        cellShake: 'anim-shake',
        cellEnter: 'anim-enter',
        completionWave: 'cell-wave',
        pulseHint: 'cell-hint-flash'
    };

    // Thèmes visuels et scores de récompense requis (🔒 verrouillés tant que le score n'est pas atteint)
    static THEMES_META = {
        light:   { label: '☀️ Clair',       reqScore: 0,     tag: 'Classique' },
        sepia:   { label: '📜 Sépia',       reqScore: 0,     tag: 'Lecture' },
        dark:    { label: '🌙 Sombre',      reqScore: 0,     tag: 'Nuit' },
        oled:    { label: '🌑 OLED Pur',    reqScore: 3000,  tag: 'AMOLED' },
        emerald: { label: '🌿 Forêt Zen',   reqScore: 8000,  tag: 'Matcha' },
        sakura:  { label: '🌸 Sakura',      reqScore: 15000, tag: 'Pastel' },
        ocean:   { label: '🌊 Abysses',     reqScore: 25000, tag: 'Océan' },
        cyber:   { label: '⚡ Cyberpunk',   reqScore: 40000, tag: 'Néon' },
        royal:   { label: '👑 Or & Onyx',   reqScore: 60000, tag: 'Prestige' }
    };

    // Packs sonores et scores de récompense requis
    static SOUND_PACKS_META = {
        marimba: { label: '🪵 Bois & Kalimba', reqScore: 0 },
        piano:   { label: '🎹 Piano Doux',     reqScore: 0 },
        crystal: { label: '🎐 Cristal Zen',    reqScore: 8000 },
        retro:   { label: '🕹️ Arcade 8-Bit',   reqScore: 25000 }
    };

    // Paliers de Niveau (XP) & Récompenses associées
    static RANKS = [
        { level: 1, minXp: 0,    nextXp: 100,  title: 'Apprenti Logique',   reward: 'Thèmes de base & OLED' },
        { level: 2, minXp: 100,  nextXp: 300,  title: 'Initié Sudoku',      reward: '🌿 Thème Forêt Zen • 🎐 Son Cristal • 🐼' },
        { level: 3, minXp: 300,  nextXp: 650,  title: 'Tacticien',          reward: '🌸 Thème Sakura • 🦄 Avatar Licorne' },
        { level: 4, minXp: 650,  nextXp: 1200, title: 'Expert Confirmé',    reward: '🌊 Thème Abysses • 🕹️ Son 8-Bit • 🧙‍♂️' },
        { level: 5, minXp: 1200, nextXp: 2000, title: 'Maître des Chiffres',reward: '⚡ Thème Cyberpunk • 🤖 Avatar Robot' },
        { level: 6, minXp: 2000, nextXp: 3000, title: 'Grand Maître Absolu',reward: '👑 Thème Prestige Or & Onyx • 💎' }
    ];

    // Catalogue des 12 Trophées / Succès
    static TROPHIES = [
        { id: 'first_win',    icon: '🌟', title: 'Première Étincelle', desc: 'Remporter votre 1re victoire',               xp: 50 },
        { id: 'flawless_win', icon: '🎯', title: 'Sans Faute',         desc: 'Gagner une partie avec 0 erreur',            xp: 75 },
        { id: 'speed_demon',  icon: '⚡', title: 'Éclair Logique',     desc: 'Gagner une grille en moins de 3 min',        xp: 100 },
        { id: 'no_assist',    icon: '🧠', title: 'Puriste',            desc: 'Gagner en Difficile+ sans indice ni notes auto', xp: 150 },
        { id: 'combo_15',     icon: '🔥', title: 'Combo Royal',        desc: 'Enchaîner ×15 chiffres justes d\'affilée',   xp: 100 },
        { id: 'streak_3',     icon: '📅', title: 'Fidèle au Poste',    desc: 'Série de 3 jours joués consécutifs',         xp: 120 },
        { id: 'streak_7',     icon: '🗓️', title: 'Semaine Parfaite',   desc: 'Série de 7 jours joués consécutifs',         xp: 250 },
        { id: 'wins_10',      icon: '🏅', title: 'Vétéran',            desc: 'Remporter 10 parties au total',              xp: 150 },
        { id: 'score_10k',    icon: '🏆', title: 'Centurion',          desc: 'Atteindre 10 000 pts sur une partie',        xp: 180 },
        { id: 'all_diffs',    icon: '🌈', title: 'Polyvalent',         desc: 'Gagner dans les 6 niveaux de difficulté',    xp: 300 },
        { id: 'extreme_win',  icon: '⚔️', title: 'Dompteur Extrême',   desc: 'Vaincre une grille de niveau Extrême',       xp: 250 },
        { id: 'wins_50',      icon: '👑', title: 'Légende Vivante',    desc: 'Remporter 50 parties au total',              xp: 500 }
    ];

    constructor() {
        this.settings = this.loadSettings();
        this.stats = this.loadStats();
        this.profile = this.loadProfile();
        this.requestPersistentStorage();

        // État de la partie en cours
        this.difficulty = 'easy';
        this.multiplier = 1;
        this.initialBoard = [];
        this.board = [];
        this.solution = [];
        this.notes = []; // Grille 9x9 de tableaux de chiffres [1..9]
        this.history = [];

        this.selectedCell = { row: 0, col: 0 };
        this.isNotesMode = false;
        this.isAutoNotesOn = false;
        this.isFastMode = false;
        this.lockedDigit = null;

        this.mistakes = 0;
        this.maxMistakes = 3;
        this.score = 0;
        this.streak = 0;
        this.hintsRemaining = 3;
        this.elapsedSeconds = 0;
        this.isPaused = false;
        this.isGameOver = false;
        this.isWon = false;

        // Suivi des lignes/colonnes/blocs et des cases déjà récompensés pour éviter le "score farming"
        this.completedUnits = new Set();
        this.scoredCells = new Set();
        this.maxStreakInGame = 0;
        this.usedHintInGame = false;
        this.usedAutoNotesInGame = false;
        this._toastQueue = [];
        this._toastActive = false;

        this.timerInterval = null;
        this.deviceId = Math.random().toString(36).slice(2, 10);
        this.stateRev = 0;
        this.liveSyncReady = false;
        this.isApplyingRemote = false;

        this.initDOMReferences();
        this.audio = new SudokuAudio();
        this.applyFeedbackSettings();
        this.syncUnlockablesUI();
        this.applyTheme(this.settings.theme, false);
        this.syncSettingsUI();
        this.createBoardDOM();
        this.bindEvents();

        // Restaurer la partie sauvegardée ou en démarrer une nouvelle
        if (!this.restoreSavedGame()) {
            this.startNewGame('easy');
        } else {
            this.playBoardIntro();
        }

        this.syncProfileUI();
        this.initWakeLock();
        this.initLiveSync();
    }

    initDOMReferences() {
        this.boardEl = document.getElementById('sudoku-board');
        this.mistakesDisplay = document.getElementById('mistakes-display');
        this.mistakesContainer = document.getElementById('mistakes-container');
        this.scoreDisplay = document.getElementById('score-display');
        this.timerDisplay = document.getElementById('timer-display');

        this.btnPause = document.getElementById('btn-pause');
        this.iconPause = document.getElementById('icon-pause');
        this.iconPlay = document.getElementById('icon-play');
        this.pauseOverlay = document.getElementById('pause-overlay');
        this.pauseStatsSummary = document.getElementById('pause-stats-summary');
        this.btnResumeOverlay = document.getElementById('btn-resume-overlay');

        this.btnUndo = document.getElementById('btn-undo');
        this.btnErase = document.getElementById('btn-erase');
        this.btnNotes = document.getElementById('btn-notes');
        this.notesBadge = document.getElementById('notes-badge');
        this.btnHint = document.getElementById('btn-hint');
        this.hintsBadge = document.getElementById('hints-badge');

        this.btnAutoNotes = document.getElementById('btn-auto-notes');
        this.autoNotesState = document.getElementById('auto-notes-state');
        this.btnFastMode = document.getElementById('btn-fast-mode');
        this.fastModeState = document.getElementById('fast-mode-state');

        this.hintBanner = document.getElementById('hint-banner');
        this.hintTechnique = document.getElementById('hint-technique');
        this.hintExplanation = document.getElementById('hint-explanation');
        this.btnCloseHint = document.getElementById('btn-close-hint');

        this.diffTabs = document.querySelectorAll('.diff-tab');
        this.numpadBtns = document.querySelectorAll('.numpad-btn');
        this.themeBtns = document.querySelectorAll('.theme-btn');

        this.boardWrapper = document.querySelector('.board-wrapper');
        this.btnSound = document.getElementById('btn-sound');
        this.iconSoundOn = document.getElementById('icon-sound-on');
        this.iconSoundOff = document.getElementById('icon-sound-off');
    }

    /**
     * Génère les 81 cellules dans le DOM une seule fois
     */
    createBoardDOM() {
        this.boardEl.innerHTML = '';
        this.cellElements = Array.from({ length: 9 }, () => Array(9).fill(null));

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const cell = document.createElement('div');
                cell.className = 'sudoku-cell';
                cell.dataset.row = r;
                cell.dataset.col = c;
                cell.setAttribute('role', 'gridcell');
                cell.setAttribute('aria-label', `Ligne ${r + 1}, Colonne ${c + 1}`);

                cell.addEventListener('click', () => this.onCellClick(r, c));
                cell.addEventListener('animationend', (e) => {
                    const cls = SudokuApp.ANIM_CLASS_MAP[e.animationName];
                    if (cls) cell.classList.remove(cls);
                });
                this.boardEl.appendChild(cell);
                this.cellElements[r][c] = cell;
            }
        }
    }

    bindEvents() {
        // Onglets de difficulté
        this.diffTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetDiff = tab.dataset.difficulty;
                if (targetDiff !== this.difficulty || this.isWon || this.isGameOver) {
                    this.startNewGame(targetDiff);
                }
            });
        });

        // Boutons d'action principaux
        document.getElementById('btn-new-game').addEventListener('click', () => {
            this.openModal('modal-new-game');
        });
        const btnNewGameMobile = document.getElementById('btn-new-game-mobile');
        if (btnNewGameMobile) {
            btnNewGameMobile.addEventListener('click', () => {
                this.openModal('modal-new-game');
            });
        }

        this.btnUndo.addEventListener('click', () => this.undo());
        this.btnErase.addEventListener('click', () => this.eraseSelectedCell());
        this.btnNotes.addEventListener('click', () => this.toggleNotesMode());
        this.btnHint.addEventListener('click', () => this.useSmartHint());

        // Outils rapides
        this.btnAutoNotes.addEventListener('click', () => this.fillAutoNotes());
        this.btnFastMode.addEventListener('click', () => this.toggleFastMode());

        // Pause / Reprise
        this.btnPause.addEventListener('click', () => this.togglePause());
        this.btnResumeOverlay.addEventListener('click', () => this.togglePause(false));

        // Fermeture bannière d'indice
        this.btnCloseHint.addEventListener('click', () => {
            this.hintBanner.classList.add('hidden');
        });

        // Pavé numérique 1 à 9
        this.numpadBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const num = parseInt(btn.dataset.num, 10);
                this.onNumberInput(num);
            });
        });

        // Sélecteur de thème
        this.themeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.applyTheme(btn.dataset.themeTarget);
            });
        });

        // Modales : Nouvelle partie, Stats, Paramètres
        document.querySelectorAll('.diff-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeModal('modal-new-game');
                this.startNewGame(btn.dataset.startDiff);
            });
        });

        document.getElementById('btn-restart-current').addEventListener('click', () => {
            this.closeModal('modal-new-game');
            this.restartCurrentGame();
        });

        const btnGameOverRestart = document.getElementById('btn-gameover-restart');
        if (btnGameOverRestart) {
            btnGameOverRestart.addEventListener('click', () => {
                this.closeModal('modal-game-over');
                this.restartCurrentGame();
            });
        }

        document.getElementById('btn-gameover-new').addEventListener('click', () => {
            this.closeModal('modal-game-over');
            this.openModal('modal-new-game');
        });

        document.getElementById('btn-victory-new').addEventListener('click', () => {
            this.closeModal('modal-victory');
            this.openModal('modal-new-game');
        });

        document.getElementById('btn-stats').addEventListener('click', () => {
            this.renderStatsModal(this.difficulty);
            this.openModal('modal-stats');
        });

        const btnProfile = document.getElementById('btn-profile');
        if (btnProfile) {
            btnProfile.addEventListener('click', () => {
                this.renderProfileModal();
                this.openModal('modal-profile');
            });
        }
        this.bindProfileAndCloudEvents();

        document.querySelectorAll('.stats-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.renderStatsModal(tab.dataset.statDiff);
            });
        });

        document.getElementById('btn-reset-stats').addEventListener('click', () => {
            if (confirm('Voulez-vous vraiment remettre toutes vos statistiques à zéro ?')) {
                localStorage.removeItem(SudokuApp.STORAGE_KEY_STATS);
                this.stats = this.loadStats();
                this.profile.statsResetAt = Date.now();
                this.saveProfile();
                this.stateRev = Date.now();
                this.pushLiveSyncNow();
                this.renderStatsModal(this.difficulty);
            }
        });

        document.getElementById('btn-settings').addEventListener('click', () => {
            this.syncUnlockablesUI();
            this.openModal('modal-settings');
        });

        document.querySelectorAll('.sound-pack-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.applySoundPack(btn.dataset.soundPack, true);
            });
        });

        document.querySelectorAll('[data-close-modal]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeModal(btn.dataset.closeModal);
            });
        });

        // Fermeture des modales en touchant l'arrière-plan sombre (pratique sur mobile)
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop && backdrop.id !== 'modal-game-over') {
                    backdrop.classList.add('hidden');
                }
            });
        });

        // Écouteurs des paramètres (mistakeLimit et autoCheckErrors sont toujours verrouillés à true)
        const bindSetting = (id, key) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('change', () => {
                this.settings[key] = el.checked;
                this.saveSettings();
                this.applyFeedbackSettings();
                this.render();
            });
        };
        bindSetting('set-highlight-duplicates', 'highlightDuplicates');
        bindSetting('set-highlight-identical', 'highlightIdentical');
        bindSetting('set-auto-remove-notes', 'autoRemoveNotes');
        bindSetting('set-hide-used-numbers', 'hideUsedNumbers');
        bindSetting('set-sound-enabled', 'soundEnabled');
        bindSetting('set-animations', 'animationsEnabled');
        bindSetting('set-haptics', 'hapticsEnabled');

        document.getElementById('set-sound-enabled').addEventListener('change', (e) => {
            if (e.target.checked) {
                this.audio.unlock();
                this.audio.playToggle(true);
            }
        });

        const volumeSlider = document.getElementById('set-sound-volume');
        const volumePct = document.getElementById('volume-pct');
        volumeSlider.addEventListener('input', () => {
            const val = parseInt(volumeSlider.value, 10);
            this.settings.soundVolume = val / 100;
            if (volumePct) volumePct.textContent = `${val}%`;
            this.saveSettings();
            this.applyFeedbackSettings();
        });
        volumeSlider.addEventListener('change', () => {
            this.audio.unlock();
            this.audio.playPlace(5); // aperçu du volume
        });

        // Raccourcis clavier complets
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));

        // Les navigateurs exigent un geste utilisateur avant de produire du son
        ['pointerdown', 'keydown', 'touchstart'].forEach(evt => {
            window.addEventListener(evt, () => this.audio.unlock(), { passive: true });
        });

        this.btnSound.addEventListener('click', () => this.toggleSound());

        // Mobile : mise en pause automatique quand l'app passe en arrière-plan
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && !this.isPaused && !this.isGameOver && !this.isWon) {
                this.togglePause(true);
            }
        });

        // Petit clic sonore sur les boutons d'interface (les actions de jeu ont leurs propres sons)
        const uiClickSelector = '.theme-btn, .nav-icon-btn:not(#btn-sound), .secondary-btn, .primary-btn, ' +
            '.stats-tab, .modal-close, .new-game-btn, .hint-close-btn, [data-close-modal]';
        document.addEventListener('click', (e) => {
            if (e.target.closest(uiClickSelector)) this.audio.playClick();
        });
    }

    /**
     * Démarre une nouvelle grille Sudoku
     */
    startNewGame(difficultyKey = 'easy') {
        const generated = SudokuEngine.generatePuzzle(difficultyKey);
        this.difficulty = generated.difficulty;
        this.multiplier = generated.multiplier;
        this.initialBoard = SudokuEngine.cloneBoard(generated.puzzle);
        this.board = SudokuEngine.cloneBoard(generated.puzzle);
        this.solution = SudokuEngine.cloneBoard(generated.solution);
        this.notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
        this.history = [];

        this.mistakes = 0;
        this.score = 0;
        this.streak = 0;
        this.hintsRemaining = 3;
        this.elapsedSeconds = 0;
        this.isPaused = false;
        this.isGameOver = false;
        this.isWon = false;
        this.isAutoNotesOn = false;
        this.lockedDigit = null;
        this.completedUnits = new Set();
        this.scoredCells = new Set();
        this.maxStreakInGame = 0;
        this.usedHintInGame = false;
        this.usedAutoNotesInGame = false;
        this.rebuildScoredCellsFromBoard();
        this.updateCompletedUnitsSnapshot(false);

        this.syncPauseUI();
        this.hintBanner.classList.add('hidden');

        // La partie n'est comptée dans les statistiques qu'à la première saisie (voir placeNumberInCell)
        this.playedCounted = false;

        // Sélectionner la première case vide par défaut
        outer: for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (this.board[r][c] === 0) {
                    this.selectedCell = { row: r, col: c };
                    break outer;
                }
            }
        }

        this.startTimer();
        this.render();
        this.saveGameState();
        this.audio.playNewGame();
        this.playBoardIntro();
    }

    /**
     * Recommence la même grille depuis le début
     */
    restartCurrentGame() {
        this.board = SudokuEngine.cloneBoard(this.initialBoard);
        this.notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
        this.history = [];
        this.mistakes = 0;
        this.score = 0;
        this.streak = 0;
        this.hintsRemaining = 3;
        this.elapsedSeconds = 0;
        this.isPaused = false;
        this.isGameOver = false;
        this.isWon = false;
        this.isAutoNotesOn = false;
        this.completedUnits = new Set();
        this.scoredCells = new Set();
        this.maxStreakInGame = 0;
        this.usedHintInGame = false;
        this.usedAutoNotesInGame = false;
        this.rebuildScoredCellsFromBoard();
        this.updateCompletedUnitsSnapshot(false);
        this.syncPauseUI();
        this.hintBanner.classList.add('hidden');

        this.startTimer();
        this.render();
        this.saveGameState();
        this.audio.playNewGame();
        this.playBoardIntro();
    }

    /**
     * Gestion du clic sur une cellule
     */
    onCellClick(row, col) {
        if (this.isPaused || this.isGameOver || this.isWon) return;

        this.selectedCell = { row, col };

        const fastPlacing = this.isFastMode && this.lockedDigit !== null && this.initialBoard[row][col] === 0;
        if (!fastPlacing) this.audio.playSelect();

        // Si le mode "Chiffre d'abord" (Saisie rapide) est actif et qu'un chiffre est verrouillé
        if (this.isFastMode && this.lockedDigit !== null) {
            if (this.initialBoard[row][col] === 0) {
                this.placeNumberInCell(row, col, this.lockedDigit);
                return;
            }
        }

        this.render();
    }

    /**
     * Gestion de l'entrée d'un chiffre (1..9) via pavé numérique ou clavier
     */
    onNumberInput(num) {
        if (this.isPaused || this.isGameOver || this.isWon) return;

        if (this.isFastMode) {
            if (this.lockedDigit === num) {
                this.lockedDigit = null;
                this.audio.playToggle(false);
            } else {
                this.lockedDigit = num;
                this.audio.playToggle(true);
            }
            this.render();
            this.saveGameState();
            return;
        }

        const { row, col } = this.selectedCell;
        this.placeNumberInCell(row, col, num);
    }

    /**
     * Place un chiffre ou une note dans la case (row, col)
     */
    placeNumberInCell(row, col, num) {
        // Impossible de modifier un chiffre initial donné
        if (this.initialBoard[row][col] !== 0) return;

        // Impossible de modifier une case déjà validée et correcte (lorsque la vérification auto est active)
        if (this.settings.autoCheckErrors && this.board[row][col] === this.solution[row][col]) {
            return;
        }

        this.pushHistory();

        if (!this.playedCounted && !this.isNotesMode) {
            this.playedCounted = true;
            if (!this.stats[this.difficulty]) {
                this.stats[this.difficulty] = { played: 0, won: 0, flawless: 0, bestTime: null, bestScore: 0 };
            }
            this.stats[this.difficulty].played += 1;
            this.saveStats();
        }

        if (this.isNotesMode) {
            // Si la case contient un chiffre (erroné ou non), on l'efface d'abord
            this.board[row][col] = 0;
            const cellNotes = this.notes[row][col];
            const idx = cellNotes.indexOf(num);
            if (idx === -1) {
                cellNotes.push(num);
                cellNotes.sort((a, b) => a - b);
            } else {
                cellNotes.splice(idx, 1);
            }
            this.audio.playNote(idx === -1);
            this.haptic(8);
            this.render();
            this.saveGameState();
            return;
        }

        // Mode saisie normale : si le même chiffre est déjà présent, on l'efface
        if (this.board[row][col] === num) {
            this.board[row][col] = 0;
            this.audio.playErase();
            this.render();
            this.saveGameState();
            return;
        }

        const scoreBefore = this.score;
        let unitsDone = 0;
        let errorCounted = false;

        this.board[row][col] = num;
        this.notes[row][col] = [];

        const isCorrect = (num === this.solution[row][col]);

        if (isCorrect) {
            const cellKey = `${row}-${col}`;
            const alreadyScored = this.scoredCells.has(cellKey);
            if (!alreadyScored) {
                this.scoredCells.add(cellKey);
                this.streak += 1;
                if (this.streak > (this.maxStreakInGame || 0)) {
                    this.maxStreakInGame = this.streak;
                }
                // Gain de points façon Sudoku.com (base * multiplicateur * facteur vitesse + bonus de série)
                const speedBonus = Math.max(10, 60 - Math.floor(this.elapsedSeconds / 15));
                const streakBonus = this.streak >= 2 ? Math.min(5, this.streak - 1) * 15 : 0;
                this.score += (speedBonus + streakBonus) * this.multiplier;
            }
            this.audio.playPlace(num, Math.max(1, this.streak));
            this.haptic(10);

            // Suppression automatique des notes dans la même ligne, colonne et bloc 3x3
            if (this.settings.autoRemoveNotes) {
                this.removePeerNotes(row, col, num);
            }

            // Vérifier les nouvelles unités (ligne, colonne, bloc) complétées
            unitsDone = this.updateCompletedUnitsSnapshot(true);
            if (unitsDone > 0) {
                this.audio.playUnitComplete(unitsDone);
                this.haptic([15, 30, 15, 30, 40]);
            }
            if (this.getRemainingCount(num) === 0) this.celebrateDigit(num);

            // Si tous les exemplaires de ce chiffre sont placés et qu'il était verrouillé en mode rapide
            if (this.getRemainingCount(num) === 0 && this.lockedDigit === num) {
                this.lockedDigit = null;
            }
        } else {
            this.streak = 0;
            // Règle stricte : toute saisie erronée compte immédiatement comme 1 faute (3 fautes = Game Over)
            this.mistakes += 1;
            errorCounted = true;
            this.audio.playError();
            this.haptic([30, 40, 30]);
            this.animateCell(row, col, 'shake');
            this.bump(this.mistakesContainer, 'pulse-error');
            this.bump(this.boardEl, 'board-error');
            if (this.mistakes >= this.maxMistakes) {
                this.isGameOver = true;
                this.stopTimer();
                this.audio.playGameOver();
                this.haptic(200);
                this.render();
                this.saveGameState();
                this.openModal('modal-game-over');
                return;
            }
        }

        this.render();

        // Retours visuels après le rendu (les classes anim-* survivent aux render())
        if (isCorrect) {
            const targetCellEl = this.cellElements[row][col];
            this.animateCell(row, col, 'pop');
            SudokuFX.ripple(targetCellEl, {
                color: unitsDone > 0 ? '#f59e0b' : '#3b82f6',
                maxRadius: unitsDone > 0 ? 58 : 42
            });
            if (unitsDone > 0 || this.streak >= 3) {
                SudokuFX.burst(targetCellEl, {
                    count: unitsDone > 0 ? 18 : 10,
                    speed: unitsDone > 0 ? 4.8 : 3.5
                });
            }
            const gained = this.score - scoreBefore;
            if (gained > 0) {
                let badgeText = '';
                if (unitsDone > 0 && this.streak >= 2) {
                    badgeText = `✨ Unité • 🔥×${this.streak}`;
                } else if (unitsDone > 0) {
                    badgeText = '✨ Unité !';
                } else if (this.streak >= 2) {
                    badgeText = `🔥 ×${this.streak}`;
                }
                SudokuFX.floatText(this.boardWrapper, targetCellEl, `+${gained}`, unitsDone > 0 ? 'bonus' : '', badgeText);
                this.bump(this.scoreDisplay, 'pulse-score');
            }
        } else if (!errorCounted) {
            this.animateCell(row, col, 'pop');
        }

        this.saveGameState();
        this.checkVictory();
    }

    /**
     * Supprime le chiffre `num` des notes de la même ligne, colonne et bloc 3x3
     */
    removePeerNotes(row, col, num) {
        for (let i = 0; i < 9; i++) {
            this.notes[row][i] = this.notes[row][i].filter(n => n !== num);
            this.notes[i][col] = this.notes[i][col].filter(n => n !== num);
        }
        const startR = Math.floor(row / 3) * 3;
        const startC = Math.floor(col / 3) * 3;
        for (let r = startR; r < startR + 3; r++) {
            for (let c = startC; c < startC + 3; c++) {
                this.notes[r][c] = this.notes[r][c].filter(n => n !== num);
            }
        }
    }

    /**
     * Efface le contenu ou les notes de la case sélectionnée
     */
    eraseSelectedCell() {
        if (this.isPaused || this.isGameOver || this.isWon) return;
        const { row, col } = this.selectedCell;
        if (this.initialBoard[row][col] !== 0) return;

        // Ne pas effacer un chiffre déjà validé comme juste lorsque la vérification auto est active
        if (this.settings.autoCheckErrors && this.board[row][col] === this.solution[row][col]) {
            return;
        }

        if (this.board[row][col] === 0 && this.notes[row][col].length === 0) return;

        this.pushHistory();
        this.board[row][col] = 0;
        this.notes[row][col] = [];
        this.audio.playErase();
        this.render();
        this.saveGameState();
    }

    /**
     * Sauvegarde un instantané dans l'historique pour le bouton Annuler (Undo)
     */
    pushHistory() {
        this.history.push({
            board: SudokuEngine.cloneBoard(this.board),
            notes: this.notes.map(row => row.map(cell => [...cell])),
            isAutoNotesOn: !!this.isAutoNotesOn,
            score: this.score,
            streak: this.streak,
            completedUnits: [...this.completedUnits],
            scoredCells: [...this.scoredCells]
        });
        if (this.history.length > 60) {
            this.history.shift();
        }
    }

    /**
     * Annule la dernière action
     */
    undo() {
        if (this.isPaused || this.isGameOver || this.isWon) return;
        if (this.history.length === 0) {
            this.audio.playBlocked();
            return;
        }

        const prev = this.history.pop();
        this.board = prev.board;
        this.notes = prev.notes;
        this.isAutoNotesOn = !!prev.isAutoNotesOn;
        this.score = prev.score;
        this.streak = prev.streak ?? 0;
        if (Array.isArray(prev.completedUnits)) {
            this.completedUnits = new Set(prev.completedUnits);
        }
        if (Array.isArray(prev.scoredCells)) {
            this.scoredCells = new Set(prev.scoredCells);
        }

        this.audio.playUndo();
        this.render();
        this.saveGameState();
    }

    /**
     * Bascule le mode Notes (Crayon)
     */
    toggleNotesMode() {
        if (this.isPaused || this.isGameOver || this.isWon) return;
        this.isNotesMode = !this.isNotesMode;
        this.audio.playToggle(this.isNotesMode);
        this.render();
    }

    /**
     * Bascule le mode Saisie Rapide (Chiffre d'abord)
     */
    toggleFastMode() {
        if (this.isPaused || this.isGameOver || this.isWon) return;
        this.isFastMode = !this.isFastMode;
        if (!this.isFastMode) {
            this.lockedDigit = null;
        }
        this.audio.playToggle(this.isFastMode);
        this.render();
    }

    /**
     * Bascule les Notes automatiques :
     * - 1er clic (ON) : affiche tous les candidats possibles dans les cases vides
     * - 2e clic (OFF) : cache / efface toutes les notes de la grille
     */
    fillAutoNotes() {
        if (this.isPaused || this.isGameOver || this.isWon) return;
        this.pushHistory();

        if (this.isAutoNotesOn) {
            this.isAutoNotesOn = false;
            for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    this.notes[r][c] = [];
                }
            }
            this.audio.playToggle(false);
        } else {
            this.isAutoNotesOn = true;
            this.usedAutoNotesInGame = true;
            for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    if (this.board[r][c] === 0) {
                        this.notes[r][c] = SudokuEngine.getCandidates(this.board, r, c);
                    } else {
                        this.notes[r][c] = [];
                    }
                }
            }
            this.audio.playAutoNotes();
        }

        this.render();
        this.saveGameState();
    }

    /**
     * Donne un indice intelligent (avec explication logique)
     */
    useSmartHint() {
        if (this.isPaused || this.isGameOver || this.isWon) return;

        if (this.hintsRemaining <= 0) {
            this.audio.playBlocked();
            this.haptic([20, 30, 20]);
            this.bump(this.btnHint, 'anim-shake');
            return;
        }

        const { row, col } = this.selectedCell;
        const hint = SudokuEngine.getSmartHint(this.board, this.solution, row, col);
        if (!hint) return;

        this.pushHistory();
        this.hintsRemaining -= 1;
        this.usedHintInGame = true;

        this.selectedCell = { row: hint.row, col: hint.col };
        this.board[hint.row][hint.col] = hint.value;
        this.notes[hint.row][hint.col] = [];
        this.scoredCells.add(`${hint.row}-${hint.col}`);

        if (this.settings.autoRemoveNotes) {
            this.removePeerNotes(hint.row, hint.col, hint.value);
        }

        // Afficher la bannière explicative
        this.hintTechnique.textContent = `💡 ${hint.technique}`;
        this.hintExplanation.textContent = hint.explanation;
        this.hintBanner.classList.remove('hidden');

        const unitsDone = this.updateCompletedUnitsSnapshot(true);
        this.audio.playHint();
        if (unitsDone > 0) this.audio.playUnitComplete(unitsDone, 0.45);
        if (this.getRemainingCount(hint.value) === 0) this.celebrateDigit(hint.value);
        this.bump(this.hintsBadge, 'pulse-score');
        this.render();

        // Effet visuel sur la case révélée
        const targetEl = this.cellElements[hint.row][hint.col];
        targetEl.classList.remove('cell-hint-flash');
        void targetEl.offsetWidth;
        targetEl.classList.add('cell-hint-flash');
        SudokuFX.ripple(targetEl, { color: '#10b981', maxRadius: 56 });
        SudokuFX.burst(targetEl, { count: 14, colors: ['#10b981', '#34d399', '#fbbf24'] });

        this.saveGameState();
        this.checkVictory();
    }

    /**
     * Vérifie si une ligne, colonne ou bloc 3x3 vient d'être complété pour jouer l'animation d'onde
     */
    updateCompletedUnitsSnapshot(animateNew = true) {
        const currentComplete = new Set();
        const newlyCompletedCells = [];
        let newUnits = 0;

        // Lignes
        for (let r = 0; r < 9; r++) {
            let ok = true;
            for (let c = 0; c < 9; c++) {
                if (this.board[r][c] !== this.solution[r][c]) {
                    ok = false;
                    break;
                }
            }
            if (ok) {
                const key = `row-${r}`;
                currentComplete.add(key);
                if (animateNew && !this.completedUnits.has(key)) {
                    this.score += 100 * this.multiplier;
                    newUnits++;
                    for (let c = 0; c < 9; c++) newlyCompletedCells.push([r, c, c * 35]);
                }
            }
        }

        // Colonnes
        for (let c = 0; c < 9; c++) {
            let ok = true;
            for (let r = 0; r < 9; r++) {
                if (this.board[r][c] !== this.solution[r][c]) {
                    ok = false;
                    break;
                }
            }
            if (ok) {
                const key = `col-${c}`;
                currentComplete.add(key);
                if (animateNew && !this.completedUnits.has(key)) {
                    this.score += 100 * this.multiplier;
                    newUnits++;
                    for (let r = 0; r < 9; r++) newlyCompletedCells.push([r, c, r * 35]);
                }
            }
        }

        // Blocs 3x3
        for (let br = 0; br < 3; br++) {
            for (let bc = 0; bc < 3; bc++) {
                let ok = true;
                for (let r = br * 3; r < br * 3 + 3; r++) {
                    for (let c = bc * 3; c < bc * 3 + 3; c++) {
                        if (this.board[r][c] !== this.solution[r][c]) {
                            ok = false;
                            break;
                        }
                    }
                }
                if (ok) {
                    const key = `box-${br}-${bc}`;
                    currentComplete.add(key);
                    if (animateNew && !this.completedUnits.has(key)) {
                        this.score += 100 * this.multiplier;
                    newUnits++;
                        let idx = 0;
                        for (let r = br * 3; r < br * 3 + 3; r++) {
                            for (let c = bc * 3; c < bc * 3 + 3; c++) {
                                newlyCompletedCells.push([r, c, idx * 35]);
                                idx++;
                            }
                        }
                    }
                }
            }
        }

        // Conserver toutes les unités déjà récompensées pour éviter le "score farming"
        currentComplete.forEach(key => this.completedUnits.add(key));

        if (animateNew && newlyCompletedCells.length > 0) {
            newlyCompletedCells.forEach(([r, c, delay]) => {
                setTimeout(() => {
                    const el = this.cellElements[r][c];
                    el.classList.remove('cell-wave');
                    void el.offsetWidth;
                    el.classList.add('cell-wave');
                }, delay);
            });
        }

        return newUnits;
    }

    /**
     * Vérifie si toute la grille est résolue correctement
     */
    checkVictory() {
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (this.board[r][c] === 0) return;
                if (this.settings.autoCheckErrors) {
                    if (this.board[r][c] !== this.solution[r][c]) return;
                } else {
                    if (this.hasConflict(r, c, this.board[r][c])) return;
                }
            }
        }

        this.isWon = true;
        this.stopTimer();
        localStorage.removeItem(SudokuApp.STORAGE_KEY_GAME);

        // Mise à jour des statistiques
        const diffStat = this.stats[this.difficulty];
        diffStat.won += 1;
        if (this.mistakes === 0) {
            diffStat.flawless += 1;
        }
        let isNewRecord = false;
        if (diffStat.bestTime === null || this.elapsedSeconds < diffStat.bestTime) {
            diffStat.bestTime = this.elapsedSeconds;
            isNewRecord = true;
        }
        if (this.score > diffStat.bestScore) {
            diffStat.bestScore = this.score;
        }
        this.saveStats();

        // --- Calcul Récompenses : Score cumulé, Série Quotidienne, XP, Trophées & Passage de Niveau ---
        const rankBefore = this.getProfileRankInfo();
        const rewardScoreBefore = this.getRewardScore();
        this.profile.rewardScore = rewardScoreBefore + Math.max(0, Number(this.score) || 0);
        const rewardScoreAfter = this.getRewardScore();
        this.updateDailyStreakOnWin();

        const newlyUnlockedScoreItems = [];
        Object.entries(SudokuApp.THEMES_META).forEach(([key, meta]) => {
            if (meta.reqScore > 0 && rewardScoreBefore < meta.reqScore && rewardScoreAfter >= meta.reqScore) {
                newlyUnlockedScoreItems.push({ icon: '🎨', title: `Thème débloqué : ${meta.label}`, desc: `Palier ${meta.reqScore.toLocaleString('fr-FR')} pts franchi !`, pill: `🎨 ${meta.label}` });
            }
        });
        Object.entries(SudokuApp.SOUND_PACKS_META).forEach(([key, meta]) => {
            if (meta.reqScore > 0 && rewardScoreBefore < meta.reqScore && rewardScoreAfter >= meta.reqScore) {
                newlyUnlockedScoreItems.push({ icon: '🔊', title: `Pack sonore débloqué : ${meta.label}`, desc: `Palier ${meta.reqScore.toLocaleString('fr-FR')} pts franchi !`, pill: `🔊 ${meta.label}` });
            }
        });

        const baseXpByDiff = { easy: 50, medium: 90, hard: 140, expert: 200, master: 280, extreme: 400 };
        let earnedXp = baseXpByDiff[this.difficulty] || 50;
        if (this.mistakes === 0) earnedXp = Math.round(earnedXp * 1.5);
        if (!this.usedHintInGame && !this.usedAutoNotesInGame) earnedXp = Math.round(earnedXp * 1.25);
        const streakCount = (this.profile.dailyStreak && this.profile.dailyStreak.count) || 1;
        if (streakCount >= 2) {
            earnedXp = Math.round(earnedXp * (1 + Math.min(0.5, (streakCount - 1) * 0.1)));
        }

        const newlyUnlockedTrophies = this.evaluateTrophiesOnWin();
        let trophyXp = 0;
        newlyUnlockedTrophies.forEach(t => { trophyXp += t.xp; });
        const totalGainedXp = earnedXp + trophyXp;

        this.profile.xp = (Number(this.profile.xp) || rankBefore.xp) + totalGainedXp;
        this.saveProfile();

        const rankAfter = this.getProfileRankInfo();
        const leveledUp = rankAfter.level > rankBefore.level;
        this.syncUnlockablesUI();
        this.syncProfileUI();

        if (this.liveSyncReady && !this.isApplyingRemote) {
            this.stateRev = Date.now();
            this.pushLiveSyncNow(true);
        }

        // Notifications de déblocage (Thèmes/Sons par score, Trophées & Passage de niveau)
        newlyUnlockedScoreItems.forEach(item => {
            this.enqueueRewardToast(item.icon, item.title, item.desc);
        });
        newlyUnlockedTrophies.forEach(t => {
            this.enqueueRewardToast(t.icon, `Trophée débloqué : ${t.title}`, `${t.desc} (+${t.xp} XP)`);
        });
        if (leveledUp) {
            this.enqueueRewardToast('🎉', `Niveau ${rankAfter.level} atteint : ${rankAfter.title} !`, `Débloqué : ${rankAfter.reward}`);
        }

        // Remplir la modale de victoire
        const diffLabel = SudokuEngine.DIFFICULTIES[this.difficulty].label;
        document.getElementById('vic-diff').textContent = diffLabel;
        document.getElementById('vic-score').textContent = this.score.toLocaleString('fr-FR');
        document.getElementById('vic-time').textContent = this.formatTime(this.elapsedSeconds);
        document.getElementById('vic-mistakes').textContent = `${this.mistakes}`;
        document.getElementById('victory-record-badge').textContent = isNewRecord
            ? '🎉 Nouveau record de temps pour ce niveau !'
            : 'Vous avez résolu la grille avec succès !';

        const vicRankLabel = document.getElementById('vic-rank-label');
        const vicXpGained = document.getElementById('vic-xp-gained');
        const vicXpFill = document.getElementById('vic-xp-fill');
        const vicUnlockedList = document.getElementById('vic-unlocked-list');
        if (vicRankLabel) vicRankLabel.textContent = `Niv. ${rankAfter.level} • ${rankAfter.title} (🔥 ${streakCount}j • 🏆 ${rewardScoreAfter.toLocaleString('fr-FR')} pts)`;
        if (vicXpGained) vicXpGained.textContent = `+${totalGainedXp} XP`;
        if (vicXpFill) vicXpFill.style.width = `${rankAfter.progressPct}%`;
        if (vicUnlockedList) {
            vicUnlockedList.innerHTML = '';
            newlyUnlockedScoreItems.forEach(item => {
                const pill = document.createElement('span');
                pill.className = 'victory-unlock-pill';
                pill.textContent = `🔓 ${item.pill} débloqué !`;
                vicUnlockedList.appendChild(pill);
            });
            if (leveledUp) {
                const pill = document.createElement('span');
                pill.className = 'victory-unlock-pill';
                pill.textContent = `⬆️ Niveau ${rankAfter.level} : ${rankAfter.reward}`;
                vicUnlockedList.appendChild(pill);
            }
            newlyUnlockedTrophies.forEach(t => {
                const pill = document.createElement('span');
                pill.className = 'victory-unlock-pill';
                pill.textContent = `${t.icon} ${t.title} (+${t.xp} XP)`;
                vicUnlockedList.appendChild(pill);
            });
        }

        this.audio.playVictory();
        this.haptic([60, 40, 60, 40, 120]);
        this.victoryWave();

        setTimeout(() => {
            this.openModal('modal-victory');
            SudokuFX.confetti();
            SudokuFX.countUp(
                document.getElementById('vic-score'),
                this.score,
                900,
                (v) => v.toLocaleString('fr-FR')
            );
        }, 450);
    }

    /**
     * Vérifie s'il existe un doublon direct dans la ligne, colonne ou bloc 3x3
     */
    hasConflict(row, col, val) {
        if (val === 0) return false;
        return !SudokuEngine.isValidPlacement(this.board, row, col, val);
    }

    /**
     * Compte combien d'exemplaires restants d'un chiffre (1..9) doivent encore être placés
     */
    getRemainingCount(num) {
        let placed = 0;
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const val = this.board[r][c];
                if (val === num) {
                    if (!this.settings.autoCheckErrors || val === this.solution[r][c]) {
                        placed++;
                    }
                }
            }
        }
        return Math.max(0, 9 - placed);
    }

    /**
     * Met à jour tout l'affichage de la grille et des contrôles
     */
    render() {
        // Onglet de difficulté actif
        this.diffTabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.difficulty === this.difficulty);
        });

        // Barre d'infos (Erreurs max 3, Score, Temps)
        this.mistakesDisplay.textContent = `${this.mistakes}/${this.maxMistakes}`;
        this.scoreDisplay.textContent = this.score.toLocaleString('fr-FR');
        this.timerDisplay.textContent = this.formatTime(this.elapsedSeconds);

        // État des boutons Notes, Indice et Mode Rapide
        this.btnNotes.classList.toggle('active', this.isNotesMode);
        this.notesBadge.textContent = this.isNotesMode ? 'ON' : 'OFF';
        this.notesBadge.className = `status-badge ${this.isNotesMode ? 'on' : 'off'}`;

        this.hintsBadge.textContent = `${this.hintsRemaining}`;
        this.hintsBadge.className = `status-badge ${this.hintsRemaining > 0 ? 'count' : 'off'}`;
        this.btnHint.classList.toggle('disabled-action', this.hintsRemaining <= 0);

        this.btnAutoNotes.classList.toggle('active', !!this.isAutoNotesOn);
        if (this.autoNotesState) {
            this.autoNotesState.textContent = this.isAutoNotesOn ? 'ON' : 'OFF';
        }

        this.btnFastMode.classList.toggle('active', this.isFastMode);
        this.fastModeState.textContent = this.isFastMode ? 'ON' : 'OFF';

        const selR = this.selectedCell.row;
        const selC = this.selectedCell.col;
        const selectedVal = this.board[selR][selC];
        const highlightNum = (this.isFastMode && this.lockedDigit !== null)
            ? this.lockedDigit
            : selectedVal;

        // Mise à jour des 81 cellules
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const cellEl = this.cellElements[r][c];
                const val = this.board[r][c];
                const isGiven = this.initialBoard[r][c] !== 0;

                // Réinitialiser les classes d'état
                const keptAnimClasses = Array.from(cellEl.classList).filter(cl =>
                    cl.startsWith('anim-') || cl === 'cell-wave' || cl === 'cell-hint-flash');
                cellEl.className = 'sudoku-cell';
                keptAnimClasses.forEach(cl => cellEl.classList.add(cl));
                cellEl.classList.add(isGiven ? 'is-given' : 'is-user');

                const isSelected = (r === selR && c === selC);
                const isSameBox = (Math.floor(r / 3) === Math.floor(selR / 3)) &&
                                  (Math.floor(c / 3) === Math.floor(selC / 3));
                const isRelated = (r === selR || c === selC || isSameBox);

                if (isSelected) {
                    cellEl.classList.add('cell-selected');
                } else if (isRelated) {
                    cellEl.classList.add('cell-related');
                }

                if (this.settings.highlightIdentical && highlightNum !== 0 && val === highlightNum && !isSelected) {
                    cellEl.classList.add('cell-same-number');
                }

                // Vérification des erreurs / conflits
                if (val !== 0) {
                    if (this.settings.autoCheckErrors && !isGiven && val !== this.solution[r][c]) {
                        cellEl.classList.add('cell-wrong');
                    } else if (this.settings.highlightDuplicates && this.hasConflict(r, c, val)) {
                        cellEl.classList.add('cell-conflict');
                    }
                }

                // Rendu du chiffre ou des notes
                if (val !== 0) {
                    cellEl.innerHTML = `<span class="cell-value">${val}</span>`;
                } else {
                    const cellNotes = this.notes[r][c];
                    if (cellNotes.length > 0) {
                        let notesHTML = '<div class="cell-notes-grid">';
                        for (let n = 1; n <= 9; n++) {
                            const hasNote = cellNotes.includes(n);
                            const isNoteHighlighted = hasNote && this.settings.highlightIdentical && highlightNum === n;
                            notesHTML += `<span class="note-item ${isNoteHighlighted ? 'note-highlight' : ''}">${hasNote ? n : ''}</span>`;
                        }
                        notesHTML += '</div>';
                        cellEl.innerHTML = notesHTML;
                    } else {
                        cellEl.innerHTML = '';
                    }
                }
            }
        }

        // Mise à jour du pavé numérique 1 à 9
        this.numpadBtns.forEach(btn => {
            const num = parseInt(btn.dataset.num, 10);
            const rem = this.getRemainingCount(num);
            const remEl = document.getElementById(`rem-${num}`);
            if (remEl) remEl.textContent = `${rem}`;

            btn.classList.toggle('locked-digit', this.isFastMode && this.lockedDigit === num);
            btn.classList.toggle('completed-digit', this.settings.hideUsedNumbers && rem === 0);
        });
    }

    /**
     * Gestion du clavier (Flèches, 1-9, Backspace/Delete, N, H, U/Ctrl+Z, P)
     */
    handleKeyDown(e) {
        // Ignorer si une modale est ouverte
        if (document.querySelector('.modal-backdrop:not(.hidden)')) {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach(m => {
                    if (m.id !== 'modal-game-over') {
                        m.classList.add('hidden');
                    }
                });
            }
            return;
        }

        if ((e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            this.toggleSound();
            return;
        }

        if (e.key === 'p' || e.key === 'P') {
            e.preventDefault();
            this.togglePause();
            return;
        }

        if (this.isPaused || this.isGameOver || this.isWon) return;

        const { row, col } = this.selectedCell;

        if (e.key >= '1' && e.key <= '9') {
            e.preventDefault();
            this.onNumberInput(parseInt(e.key, 10));
        } else if ((e.key === 'Enter' || e.key === ' ') && this.isFastMode && this.lockedDigit !== null) {
            e.preventDefault();
            this.placeNumberInCell(row, col, this.lockedDigit);
        } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
            e.preventDefault();
            this.eraseSelectedCell();
        } else if (e.key === 'n' || e.key === 'N') {
            e.preventDefault();
            this.toggleNotesMode();
        } else if (e.key === 'h' || e.key === 'H') {
            e.preventDefault();
            this.useSmartHint();
        } else if ((e.ctrlKey && e.key.toLowerCase() === 'z') || e.key === 'u' || e.key === 'U') {
            e.preventDefault();
            this.undo();
        } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
            e.preventDefault();
            this.selectedCell.row = (row + 8) % 9;
            this.render();
        } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
            e.preventDefault();
            this.selectedCell.row = (row + 1) % 9;
            this.render();
        } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
            e.preventDefault();
            this.selectedCell.col = (col + 8) % 9;
            this.render();
        } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
            e.preventDefault();
            this.selectedCell.col = (col + 1) % 9;
            this.render();
        }
    }

    /**
     * Son & animations : réglages, retours visuels et aides
     */
    applyFeedbackSettings() {
        this.audio.setEnabled(this.settings.soundEnabled);
        this.audio.setVolume(this.settings.soundVolume);
        this.audio.setSoundPack(this.settings.soundPack || 'marimba');
        SudokuFX.enabled = !!this.settings.animationsEnabled;
        document.documentElement.setAttribute('data-anim', this.settings.animationsEnabled ? 'on' : 'off');
        this.updateSoundButton();
    }

    updateSoundButton() {
        if (!this.btnSound) return;
        const on = !!this.settings.soundEnabled;
        this.iconSoundOn.classList.toggle('hidden', !on);
        this.iconSoundOff.classList.toggle('hidden', on);
        this.btnSound.setAttribute('aria-pressed', String(on));
    }

    toggleSound() {
        this.settings.soundEnabled = !this.settings.soundEnabled;
        this.saveSettings();
        this.applyFeedbackSettings();
        this.syncSettingsUI();
        if (this.settings.soundEnabled) {
            this.audio.unlock();
            this.audio.playToggle(true);
        }
    }

    /** Vibration courte (Android/Chrome) ; ignorée si non supportée ou désactivée. */
    haptic(pattern) {
        if (!this.settings.hapticsEnabled || !navigator.vibrate) return;
        try { navigator.vibrate(pattern); } catch (_) { /* ignoré */ }
    }

    /** Rejoue une animation CSS sur une cellule (pop, shake...). */
    animateCell(row, col, kind) {
        if (!SudokuFX.enabled) return;
        const el = this.cellElements[row][col];
        const cls = `anim-${kind}`;
        el.classList.remove(cls);
        void el.offsetWidth; // force le redémarrage de l'animation
        el.classList.add(cls);
    }

    /** Rejoue une animation de « bump » sur un élément quelconque. */
    bump(el, cls) {
        if (!SudokuFX.enabled || !el) return;
        el.classList.remove(cls);
        void el.offsetWidth;
        el.classList.add(cls);
        setTimeout(() => el.classList.remove(cls), 600);
    }

    /** Les 9 exemplaires d'un chiffre sont posés : carillon + éclat sur le pavé. */
    celebrateDigit(num) {
        this.audio.playDigitDone();
        const btn = Array.from(this.numpadBtns).find(b => parseInt(b.dataset.num, 10) === num);
        if (btn) {
            this.bump(btn, 'anim-digit-done');
            SudokuFX.burst(btn, {
                count: 16,
                colors: ['#22c55e', '#38bdf8', '#facc15', '#a855f7']
            });
        }
    }

    /** Apparition en diagonale de toute la grille (nouvelle partie / reprise). */
    playBoardIntro() {
        if (!SudokuFX.enabled) return;
        const cells = [];
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const el = this.cellElements[r][c];
                el.style.setProperty('--d', `${(r + c) * 26}ms`);
                el.classList.remove('anim-enter');
                cells.push(el);
            }
        }
        void this.boardEl.offsetWidth;
        cells.forEach(el => el.classList.add('anim-enter'));
    }

    /** Onde de victoire qui part de la case sélectionnée et balaie toute la grille. */
    victoryWave() {
        if (!SudokuFX.enabled) return;
        const { row, col } = this.selectedCell;
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const delay = (Math.abs(r - row) + Math.abs(c - col)) * 45;
                setTimeout(() => {
                    const el = this.cellElements[r][c];
                    el.classList.remove('cell-wave');
                    void el.offsetWidth;
                    el.classList.add('cell-wave');
                }, delay);
            }
        }
    }

    /**
     * Chronomètre & Pause
     */
    startTimer() {
        this.stopTimer();
        this.timerInterval = setInterval(() => {
            if (!this.isPaused && !this.isGameOver && !this.isWon) {
                this.elapsedSeconds += 1;
                this.timerDisplay.textContent = this.formatTime(this.elapsedSeconds);
                if (this.elapsedSeconds % 5 === 0) {
                    this.saveGameState(false);
                }
            }
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    syncPauseUI() {
        if (!this.pauseOverlay) return;
        this.pauseOverlay.classList.toggle('hidden', !this.isPaused);
        if (this.iconPause) this.iconPause.classList.toggle('hidden', this.isPaused);
        if (this.iconPlay) this.iconPlay.classList.toggle('hidden', !this.isPaused);

        if (this.isPaused && this.pauseStatsSummary) {
            const diffObj = SudokuEngine.DIFFICULTIES[this.difficulty] || SudokuEngine.DIFFICULTIES.easy;
            this.pauseStatsSummary.textContent = `Difficulté : ${diffObj.label} • Temps : ${this.formatTime(this.elapsedSeconds)}`;
        }
    }

    togglePause(forceState = null) {
        if (this.isGameOver || this.isWon) return;
        this.isPaused = forceState !== null ? forceState : !this.isPaused;
        this.audio.playPause(this.isPaused);
        this.syncPauseUI();
    }

    formatTime(totalSec) {
        if (totalSec === null || totalSec === undefined) return '--:--';
        const mins = Math.floor(totalSec / 60);
        const secs = totalSec % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    /**
     * Thèmes, Packs Sonores, Déblocables & Modales
     */
    getRewardScore() {
        return Math.max(0, Number(this.profile && this.profile.rewardScore) || 0);
    }

    applyTheme(themeName, userInitiated = true) {
        const meta = SudokuApp.THEMES_META[themeName] || SudokuApp.THEMES_META.light;
        const curScore = this.getRewardScore();
        const reqScore = meta.reqScore || 0;
        if (reqScore > curScore) {
            if (userInitiated) {
                this.audio.playBlocked();
                this.haptic([20, 30, 20]);
                const missing = (reqScore - curScore).toLocaleString('fr-FR');
                this.enqueueRewardToast(
                    '🔒',
                    `Thème ${meta.label} verrouillé`,
                    `Score requis : ${reqScore.toLocaleString('fr-FR')} pts (Il vous manque ${missing} pts)`,
                    false
                );
            } else {
                themeName = 'light';
            }
            if (userInitiated) return;
        }

        document.documentElement.setAttribute('data-theme', themeName);
        this.settings.theme = themeName;
        const themeMeta = document.querySelector('meta[name="theme-color"]');
        if (themeMeta) {
            const navColor = getComputedStyle(document.documentElement).getPropertyValue('--bg-navbar').trim();
            if (navColor) themeMeta.setAttribute('content', navColor);
        }
        this.themeBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.themeTarget === themeName);
        });
        this.saveSettings();
    }

    applySoundPack(packName, userInitiated = true) {
        const meta = SudokuApp.SOUND_PACKS_META[packName] || SudokuApp.SOUND_PACKS_META.marimba;
        const curScore = this.getRewardScore();
        const reqScore = meta.reqScore || 0;
        if (reqScore > curScore) {
            if (userInitiated) {
                this.audio.playBlocked();
                this.haptic([20, 30, 20]);
                const missing = (reqScore - curScore).toLocaleString('fr-FR');
                this.enqueueRewardToast(
                    '🔒',
                    `Pack ${meta.label} verrouillé`,
                    `Score requis : ${reqScore.toLocaleString('fr-FR')} pts (Il vous manque ${missing} pts)`,
                    false
                );
                return;
            }
            packName = 'marimba';
        }

        this.settings.soundPack = packName;
        this.audio.setSoundPack(packName);
        this.saveSettings();
        this.syncUnlockablesUI();
        if (userInitiated) {
            this.audio.unlock();
            this.audio.playPlace(5, 2);
        }
    }

    syncUnlockablesUI() {
        const curScore = this.getRewardScore();

        const scorePill = document.getElementById('settings-reward-score');
        if (scorePill) {
            scorePill.textContent = `🏆 ${curScore.toLocaleString('fr-FR')} pts`;
        }

        // Thèmes
        this.themeBtns.forEach(btn => {
            const key = btn.dataset.themeTarget;
            const meta = SudokuApp.THEMES_META[key];
            const reqScore = meta ? (meta.reqScore || 0) : 0;
            const locked = reqScore > curScore;
            btn.classList.toggle('theme-locked', Boolean(locked));
            const badge = btn.querySelector(`[data-theme-badge="${key}"]`);
            if (badge && meta) {
                if (locked) {
                    badge.textContent = `🔒 ${reqScore.toLocaleString('fr-FR')} pts`;
                } else {
                    badge.textContent = reqScore > 0 ? '🔓 Débloqué' : (meta.tag || '✓');
                }
            }
        });

        // Packs sonores
        const currentPack = this.settings.soundPack || 'marimba';
        document.querySelectorAll('.sound-pack-btn').forEach(btn => {
            const pack = btn.dataset.soundPack;
            const meta = SudokuApp.SOUND_PACKS_META[pack];
            const reqScore = meta ? (meta.reqScore || 0) : 0;
            const locked = reqScore > curScore;
            btn.classList.toggle('pack-locked', locked);
            btn.classList.toggle('active', pack === currentPack && !locked);
            const badge = btn.querySelector(`[data-pack-badge="${pack}"]`);
            if (badge) {
                if (locked) {
                    badge.textContent = `🔒 ${reqScore.toLocaleString('fr-FR')} pts`;
                } else {
                    badge.textContent = pack === currentPack ? '✓ Actif' : '🔓 Disponible';
                }
            }
        });

        // Avatars
        document.querySelectorAll('.avatar-choice').forEach(btn => {
            const reqScore = parseInt(btn.dataset.reqScore || '0', 10);
            const locked = reqScore > curScore;
            btn.classList.toggle('avatar-locked', locked);
            if (locked) {
                btn.title = `🔒 Verrouillé — ${reqScore.toLocaleString('fr-FR')} pts requis`;
            } else {
                btn.title = reqScore > 0 ? `🔓 Débloqué (${reqScore.toLocaleString('fr-FR')} pts)` : 'Disponible';
            }
        });
    }

    enqueueRewardToast(icon, title, desc, celebrate = true) {
        this._toastQueue = this._toastQueue || [];
        this._toastQueue.push({ icon, title, desc, celebrate });
        this._processNextRewardToast();
    }

    _processNextRewardToast() {
        if (this._toastActive || !this._toastQueue || this._toastQueue.length === 0) return;
        const next = this._toastQueue.shift();
        const toastEl = document.getElementById('reward-toast');
        const iconEl = document.getElementById('reward-toast-icon');
        const titleEl = document.getElementById('reward-toast-title');
        const descEl = document.getElementById('reward-toast-desc');
        if (!toastEl || !iconEl || !titleEl || !descEl) return;

        this._toastActive = true;
        iconEl.textContent = next.icon;
        titleEl.textContent = next.title;
        descEl.textContent = next.desc;
        toastEl.classList.remove('hidden');

        if (next.celebrate) {
            this.audio.playAchievement();
        }

        setTimeout(() => {
            toastEl.classList.add('hidden');
            this._toastActive = false;
            setTimeout(() => this._processNextRewardToast(), 250);
        }, 3400);
    }

    openModal(id) {
        document.getElementById(id).classList.remove('hidden');
    }

    closeModal(id) {
        document.getElementById(id).classList.add('hidden');
    }

    renderStatsModal(diffKey) {
        document.querySelectorAll('.stats-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.statDiff === diffKey);
        });
        const st = this.stats[diffKey] || { played: 0, won: 0, flawless: 0, bestTime: null, bestScore: 0 };
        const winRate = st.played > 0 ? Math.round((st.won / st.played) * 100) : 0;

        document.getElementById('st-played').textContent = `${st.played}`;
        document.getElementById('st-won').textContent = `${st.won}`;
        document.getElementById('st-winrate').textContent = `${winRate}%`;
        document.getElementById('st-flawless').textContent = `${st.flawless}`;
        document.getElementById('st-best-time').textContent = this.formatTime(st.bestTime);
        document.getElementById('st-best-score').textContent = st.bestScore.toLocaleString('fr-FR');
    }

    /**
     * Reconstruit l'ensemble des cases ayant déjà attribué leurs points
     */
    rebuildScoredCellsFromBoard(savedList = null) {
        this.scoredCells = new Set(Array.isArray(savedList) ? savedList : []);
        if (!Array.isArray(this.board) || !Array.isArray(this.solution)) return;
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (this.board[r] && this.solution[r] && this.board[r][c] !== 0 && this.board[r][c] === this.solution[r][c]) {
                    this.scoredCells.add(`${r}-${c}`);
                }
            }
        }
    }

    /**
     * Vérifie qu'une grille 9x9 ne contient que des entiers 0..9
     */
    isValidGrid(grid) {
        return Array.isArray(grid) && grid.length === 9 && grid.every(row =>
            Array.isArray(row) && row.length === 9 && row.every(v => Number.isInteger(v) && v >= 0 && v <= 9));
    }

    /**
     * Valide une partie sauvegardée/distante (formes et cohérence board/solution/initialBoard)
     */
    validateGame(g) {
        if (!g || typeof g !== 'object') return false;
        if (!this.isValidGrid(g.board) || !this.isValidGrid(g.solution) || !this.isValidGrid(g.initialBoard)) return false;
        if (g.solution.some(row => row.some(v => v === 0))) return false;
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (g.initialBoard[r][c] !== 0 && g.initialBoard[r][c] !== g.solution[r][c]) return false;
                if (g.initialBoard[r][c] !== 0 && g.board[r][c] !== g.initialBoard[r][c]) return false;
            }
        }
        if (g.notes !== undefined && !(Array.isArray(g.notes) && g.notes.length === 9 &&
            g.notes.every(row => Array.isArray(row) && row.length === 9 && row.every(Array.isArray)))) return false;
        return true;
    }

    /**
     * Fusionne deux jeux de statistiques sans perdre de progression
     */
    mergeStats(local, remote) {
        const out = {};
        const keys = new Set([...Object.keys(local || {}), ...Object.keys(remote || {})]);
        const num = v => (Number.isFinite(v) ? v : 0);
        keys.forEach(k => {
            const a = (local && local[k]) || {};
            const b = (remote && remote[k]) || {};
            const times = [a.bestTime, b.bestTime].filter(t => Number.isFinite(t));
            out[k] = {
                played: Math.max(num(a.played), num(b.played)),
                won: Math.max(num(a.won), num(b.won)),
                flawless: Math.max(num(a.flawless), num(b.flawless)),
                bestTime: times.length ? Math.min(...times) : null,
                bestScore: Math.max(num(a.bestScore), num(b.bestScore))
            };
        });
        return out;
    }

    /**
     * Persistance localStorage (Partie en cours, Paramètres, Statistiques)
     */
    saveGameState(pushRemote = true) {
        if (this.isWon) return;
        const payload = {
            difficulty: this.difficulty,
            multiplier: this.multiplier,
            initialBoard: this.initialBoard,
            board: this.board,
            solution: this.solution,
            notes: this.notes,
            history: this.history,
            mistakes: this.mistakes,
            isGameOver: !!this.isGameOver,
            score: this.score,
            streak: this.streak,
            hintsRemaining: this.hintsRemaining,
            elapsedSeconds: this.elapsedSeconds,
            selectedCell: this.selectedCell,
            isNotesMode: this.isNotesMode,
            isAutoNotesOn: this.isAutoNotesOn,
            isFastMode: this.isFastMode,
            lockedDigit: this.lockedDigit,
            playedCounted: this.playedCounted !== false,
            completedUnits: [...this.completedUnits],
            scoredCells: [...this.scoredCells]
        };
        try {
            localStorage.setItem(SudokuApp.STORAGE_KEY_GAME, JSON.stringify(payload));
        } catch (_) {}
        if (pushRemote && this.liveSyncReady && !this.isApplyingRemote) {
            this.stateRev = Date.now();
            this.pushLiveSyncNow();
        }
    }

    restoreSavedGame() {
        try {
            const raw = localStorage.getItem(SudokuApp.STORAGE_KEY_GAME);
            if (!raw) return false;
            const data = JSON.parse(raw);
            if (!data || !this.validateGame(data)) return false;

            this.difficulty = data.difficulty || 'easy';
            this.multiplier = data.multiplier || 1;
            this.initialBoard = data.initialBoard;
            this.board = data.board;
            this.solution = data.solution;
            this.notes = data.notes || Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
            this.history = data.history || [];
            this.mistakes = data.mistakes || 0;
            this.score = data.score || 0;
            this.streak = data.streak || 0;
            this.hintsRemaining = data.hintsRemaining ?? 3;
            this.elapsedSeconds = data.elapsedSeconds || 0;
            this.isNotesMode = !!data.isNotesMode;
            this.isAutoNotesOn = !!data.isAutoNotesOn;
            this.isFastMode = !!data.isFastMode;
            this.lockedDigit = data.lockedDigit ?? null;
            this.playedCounted = data.playedCounted !== false;
            this.completedUnits = new Set(Array.isArray(data.completedUnits) ? data.completedUnits : []);
            this.rebuildScoredCellsFromBoard(data.scoredCells);

            if (data.selectedCell && typeof data.selectedCell.row === 'number' && typeof data.selectedCell.col === 'number') {
                this.selectedCell = data.selectedCell;
            } else {
                outer: for (let r = 0; r < 9; r++) {
                    for (let c = 0; c < 9; c++) {
                        if (this.board[r][c] === 0) {
                            this.selectedCell = { row: r, col: c };
                            break outer;
                        }
                    }
                }
            }

            this.updateCompletedUnitsSnapshot(false);
            if (data.isGameOver || this.mistakes >= this.maxMistakes) {
                this.isGameOver = true;
                this.stopTimer();
                this.render();
                this.openModal('modal-game-over');
                return true;
            }
            this.startTimer();
            this.render();
            return true;
        } catch (_) {
            return false;
        }
    }

    loadSettings() {
        const defaults = {
            theme: 'light',
            soundPack: 'marimba',
            mistakeLimit: true,
            autoCheckErrors: true,
            highlightDuplicates: true,
            highlightIdentical: true,
            autoRemoveNotes: true,
            hideUsedNumbers: true,
            soundEnabled: true,
            soundVolume: 0.6,
            hapticsEnabled: true,
            // Respecte la préférence système « réduire les animations »
            animationsEnabled: !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
        };
        try {
            const saved = JSON.parse(localStorage.getItem(SudokuApp.STORAGE_KEY_SETTINGS));
            return { ...defaults, ...saved, mistakeLimit: true, autoCheckErrors: true };
        } catch (_) {
            return defaults;
        }
    }

    saveSettings() {
        try {
            localStorage.setItem(SudokuApp.STORAGE_KEY_SETTINGS, JSON.stringify(this.settings));
        } catch (_) {}
    }

    syncSettingsUI() {
        document.getElementById('set-mistake-limit').checked = this.settings.mistakeLimit;
        document.getElementById('set-auto-check').checked = this.settings.autoCheckErrors;
        document.getElementById('set-highlight-duplicates').checked = this.settings.highlightDuplicates;
        document.getElementById('set-highlight-identical').checked = this.settings.highlightIdentical;
        document.getElementById('set-auto-remove-notes').checked = this.settings.autoRemoveNotes;
        document.getElementById('set-hide-used-numbers').checked = this.settings.hideUsedNumbers;
        document.getElementById('set-sound-enabled').checked = this.settings.soundEnabled;
        const volPct = Math.round(this.settings.soundVolume * 100);
        document.getElementById('set-sound-volume').value = volPct;
        const volumePctEl = document.getElementById('volume-pct');
        if (volumePctEl) volumePctEl.textContent = `${volPct}%`;
        document.getElementById('set-animations').checked = this.settings.animationsEnabled;
        document.getElementById('set-haptics').checked = this.settings.hapticsEnabled;
    }

    loadStats() {
        const empty = () => ({ played: 0, won: 0, flawless: 0, bestTime: null, bestScore: 0 });
        const defaults = {
            easy: empty(),
            medium: empty(),
            hard: empty(),
            expert: empty(),
            master: empty(),
            extreme: empty()
        };
        try {
            const saved = JSON.parse(localStorage.getItem(SudokuApp.STORAGE_KEY_STATS));
            if (!saved) return defaults;
            return { ...defaults, ...saved };
        } catch (_) {
            return defaults;
        }
    }

    saveStats() {
        try {
            localStorage.setItem(SudokuApp.STORAGE_KEY_STATS, JSON.stringify(this.stats));
        } catch (_) {}
    }

    /**
     * Profil Joueur & Synchronisation Cloud légère par Code Unique
     */
    requestPersistentStorage() {
        try {
            if (navigator.storage && navigator.storage.persist) {
                navigator.storage.persist().catch(() => {});
            }
        } catch (_) {}
    }

    /**
     * Maintien de l'écran allumé sur Mobile (Screen Wake Lock API)
     * Empêche la mise en veille tant que l'application est ouverte et visible.
     */
    initWakeLock() {
        this.wakeLockSentinel = null;
        this.requestWakeLock();

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.requestWakeLock();
            }
        });

        window.addEventListener('focus', () => {
            this.requestWakeLock();
        });

        // Certains navigateurs mobiles exigent un premier geste tactile avant d'autoriser le Wake Lock
        const ensureOnInteraction = () => {
            if (!this.wakeLockSentinel || this.wakeLockSentinel.released) {
                this.requestWakeLock();
            }
        };
        document.addEventListener('pointerdown', ensureOnInteraction, { passive: true });
        document.addEventListener('touchstart', ensureOnInteraction, { passive: true });
    }

    async requestWakeLock() {
        try {
            if (!('wakeLock' in navigator) || document.hidden) return;
            if (this.wakeLockSentinel && !this.wakeLockSentinel.released) return;

            this.wakeLockSentinel = await navigator.wakeLock.request('screen');
            this.wakeLockSentinel.addEventListener('release', () => {
                this.wakeLockSentinel = null;
            });
        } catch (_) {}
    }

    loadProfile() {
        const defaults = {
            name: '',
            pin: '',
            avatar: '🧠',
            xp: 0,
            rewardScore: 0,
            trophies: [],
            dailyStreak: { count: 0, lastPlayedDate: null, bestStreak: 0 },
            autoCloudSync: true,
            lastCloudSync: null
        };
        try {
            const saved = JSON.parse(localStorage.getItem(SudokuApp.STORAGE_KEY_PROFILE)) || {};
            const merged = { ...defaults, ...saved };
            if (typeof merged.name !== 'string' || merged.name === 'Joueur') merged.name = '';
            if (!/^[0-9]{4}$/.test(merged.pin || '')) merged.pin = '';
            if (!Array.isArray(merged.trophies)) merged.trophies = [];
            if (typeof merged.rewardScore !== 'number' || merged.rewardScore < 0) merged.rewardScore = 0;
            if (!merged.dailyStreak || typeof merged.dailyStreak !== 'object') {
                merged.dailyStreak = { count: 0, lastPlayedDate: null, bestStreak: 0 };
            }
            merged.autoCloudSync = true;
            return merged;
        } catch (_) {
            return defaults;
        }
    }

    saveProfile() {
        try {
            localStorage.setItem(SudokuApp.STORAGE_KEY_PROFILE, JSON.stringify(this.profile));
        } catch (_) {}
    }

    /**
     * Met à jour la série de jours consécutifs (Daily Streak 🔥) lors d'une victoire
     */
    updateDailyStreakOnWin() {
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const ds = this.profile.dailyStreak || { count: 0, lastPlayedDate: null, bestStreak: 0 };

        if (ds.lastPlayedDate === todayStr) {
            return;
        }

        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

        if (ds.lastPlayedDate === yesterdayStr) {
            ds.count = (ds.count || 0) + 1;
        } else {
            ds.count = 1;
        }
        ds.lastPlayedDate = todayStr;
        if (ds.count > (ds.bestStreak || 0)) {
            ds.bestStreak = ds.count;
        }
        this.profile.dailyStreak = ds;
    }

    /**
     * Vérifie et débloque les nouveaux trophées gagnés à l'issue d'une victoire
     */
    evaluateTrophiesOnWin() {
        const unlocked = new Set(Array.isArray(this.profile.trophies) ? this.profile.trophies : []);
        const newlyUnlocked = [];

        let totalWon = 0;
        let allDiffsWon = true;
        Object.keys(SudokuEngine.DIFFICULTIES).forEach(k => {
            const w = (this.stats[k] && this.stats[k].won) || 0;
            totalWon += w;
            if (w < 1) allDiffsWon = false;
        });

        const streakDays = (this.profile.dailyStreak && this.profile.dailyStreak.count) || 0;
        const hardOrMore = ['hard', 'expert', 'master', 'extreme'].includes(this.difficulty);

        const checks = {
            first_win:    totalWon >= 1,
            flawless_win: this.mistakes === 0,
            speed_demon:  this.elapsedSeconds <= 180,
            no_assist:    hardOrMore && !this.usedHintInGame && !this.usedAutoNotesInGame,
            combo_15:     (this.maxStreakInGame || 0) >= 15 || (this.streak || 0) >= 15,
            streak_3:     streakDays >= 3,
            streak_7:     streakDays >= 7,
            wins_10:      totalWon >= 10,
            score_10k:    this.score >= 10000,
            all_diffs:    allDiffsWon,
            extreme_win:  this.difficulty === 'extreme',
            wins_50:      totalWon >= 50
        };

        SudokuApp.TROPHIES.forEach(t => {
            if (!unlocked.has(t.id) && checks[t.id]) {
                unlocked.add(t.id);
                newlyUnlocked.push(t);
            }
        });

        this.profile.trophies = [...unlocked];
        return newlyUnlocked;
    }

    getProfileRankInfo() {
        const diffs = Object.keys(this.stats || {});
        let totalWon = 0;
        let totalBestScore = 0;
        let minRetroXp = 0;
        const baseXpByDiff = { easy: 50, medium: 90, hard: 140, expert: 200, master: 280, extreme: 400 };

        diffs.forEach(k => {
            const s = this.stats[k];
            if (s) {
                const w = s.won || 0;
                totalWon += w;
                totalBestScore += s.bestScore || 0;
                minRetroXp += w * (baseXpByDiff[k] || 50);
            }
        });

        const xp = Math.max(Number(this.profile && this.profile.xp) || 0, minRetroXp);
        if (this.profile && xp > (Number(this.profile.xp) || 0)) {
            this.profile.xp = xp;
        }

        const ranks = SudokuApp.RANKS;
        let current = ranks[0];
        for (const r of ranks) {
            if (xp >= r.minXp) current = r;
        }

        const span = Math.max(1, current.nextXp - current.minXp);
        const pct = current.level === 6
            ? 100
            : Math.min(100, Math.max(10, Math.round(((xp - current.minXp) / span) * 100)));

        return {
            level: current.level,
            title: current.title,
            reward: current.reward,
            xp,
            nextXp: current.nextXp,
            totalWon,
            totalBestScore,
            progressPct: pct
        };
    }

    syncProfileUI() {
        const navAvatar = document.getElementById('nav-profile-avatar');
        const navName = document.getElementById('nav-profile-name');
        if (navAvatar) navAvatar.textContent = this.profile.avatar || '🧠';
        if (navName) navName.textContent = this.profile.name || 'hicham';
    }

    renderProfileModal() {
        this.syncProfileUI();
        this.syncUnlockablesUI();
        const rank = this.getProfileRankInfo();

        const previewAvatar = document.getElementById('profile-avatar-preview');
        const levelBadge = document.getElementById('profile-level-badge');
        const rankTitle = document.getElementById('profile-rank-title');
        const streakPill = document.getElementById('profile-streak-pill');
        const xpFill = document.getElementById('profile-xp-fill');
        const xpSub = document.getElementById('profile-xp-sub');
        const nameInput = document.getElementById('profile-name-input');
        const pinInput = document.getElementById('profile-pin-input');

        const streakCount = (this.profile.dailyStreak && this.profile.dailyStreak.count) || 0;

        if (previewAvatar) previewAvatar.textContent = this.profile.avatar;
        if (levelBadge) levelBadge.textContent = `Niv. ${rank.level}`;
        if (rankTitle) rankTitle.textContent = rank.title;
        if (streakPill) streakPill.textContent = `🔥 ${streakCount} j`;
        if (xpFill) xpFill.style.width = `${rank.progressPct}%`;
        if (xpSub) {
            const nextTxt = rank.level < 6 ? ` / ${rank.nextXp} XP` : ' (Niveau Max)';
            xpSub.textContent = `${rank.xp.toLocaleString('fr-FR')}${nextTxt} • ${rank.totalWon} victoire${rank.totalWon > 1 ? 's' : ''}`;
        }
        if (nameInput && document.activeElement !== nameInput) {
            nameInput.value = this.profile.name || '';
        }
        if (pinInput && document.activeElement !== pinInput) {
            pinInput.value = this.profile.pin || '';
        }

        // Rendu de la Galerie de Trophées
        const trophiesGrid = document.getElementById('profile-trophies-grid');
        const trophiesTitle = document.getElementById('trophies-section-title');
        const unlockedSet = new Set(Array.isArray(this.profile.trophies) ? this.profile.trophies : []);
        if (trophiesTitle) {
            trophiesTitle.textContent = `🏆 Trophées & Récompenses (${unlockedSet.size}/${SudokuApp.TROPHIES.length})`;
        }
        if (trophiesGrid) {
            trophiesGrid.innerHTML = SudokuApp.TROPHIES.map(t => {
                const isUnlocked = unlockedSet.has(t.id);
                return `
                    <div class="trophy-card ${isUnlocked ? 'unlocked' : 'locked'}">
                        <span class="trophy-emoji">${isUnlocked ? t.icon : '🔒'}</span>
                        <div class="trophy-info">
                            <strong>${t.title}</strong>
                            <small>${t.desc}</small>
                            <span class="trophy-xp-tag">${isUnlocked ? '✓ Débloqué' : `+${t.xp} XP`}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        document.querySelectorAll('.avatar-choice').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.avatar === this.profile.avatar);
        });

        // Résumé de la partie en cours
        let filled = 0;
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (this.board[r] && this.board[r][c] !== 0) filled++;
            }
        }
        const pctGrid = Math.round((filled / 81) * 100);
        const diffLabel = (SudokuEngine.DIFFICULTIES[this.difficulty] || SudokuEngine.DIFFICULTIES.easy).label;
        const gameSummary = document.getElementById('profile-game-summary');
        const gameProgress = document.getElementById('profile-game-progress');
        const syncBadge = document.getElementById('cloud-sync-badge');

        if (gameSummary) {
            gameSummary.textContent = `${diffLabel} • ${this.formatTime(this.elapsedSeconds)} • ${this.score.toLocaleString('fr-FR')} pts`;
        }
        if (gameProgress) {
            gameProgress.textContent = `Grille remplie à ${pctGrid}% (${filled}/81 cases)`;
        }
        if (syncBadge) {
            syncBadge.textContent = '🟢 Temps Réel';
        }

        const lastSyncEl = document.getElementById('cloud-last-sync');
        if (lastSyncEl) {
            if (this.profile.lastCloudSync) {
                const d = new Date(this.profile.lastCloudSync);
                lastSyncEl.textContent = `Synchro active (${this.profile.name}) • Dernier échange à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
            } else {
                lastSyncEl.textContent = `Canal temps réel actif : « ${this.profile.name} »`;
            }
        }
    }

    bindProfileAndCloudEvents() {
        const nameInput = document.getElementById('profile-name-input');
        const pinInput = document.getElementById('profile-pin-input');

        const onCredentialsEdited = () => {
            const valName = nameInput ? nameInput.value.trim() : this.profile.name;
            const valPin = pinInput ? pinInput.value.replace(/[^0-9]/g, '').slice(0, 4) : this.profile.pin;
            if (pinInput && pinInput.value !== valPin) pinInput.value = valPin;

            if (valName && valName.length >= 2) {
                this.profile.name = valName;
            }
            if (/^[0-9]{4}$/.test(valPin)) {
                this.profile.pin = valPin;
            }
            this.saveProfile();
            this.syncProfileUI();

            if (this.profile.name.length >= 2 && /^[0-9]{4}$/.test(this.profile.pin)) {
                if (this._credDebounce) clearTimeout(this._credDebounce);
                this._credDebounce = setTimeout(async () => {
                    this.stateRev = 0;
                    const loaded = await this.pollLiveSync(true);
                    if (!loaded) {
                        this.pushLiveSyncNow();
                    }
                    this.showCloudStatus(`🟢 Connecté en direct au canal « ${this.profile.name} » !`, 'ok');
                }, 400);
            }
        };

        if (nameInput) nameInput.addEventListener('input', onCredentialsEdited);
        if (pinInput) pinInput.addEventListener('input', onCredentialsEdited);

        document.querySelectorAll('.avatar-choice').forEach(btn => {
            btn.addEventListener('click', () => {
                const reqScore = parseInt(btn.dataset.reqScore || '0', 10);
                const curScore = this.getRewardScore();
                if (reqScore > curScore) {
                    this.audio.playBlocked();
                    this.haptic([20, 30, 20]);
                    const missing = (reqScore - curScore).toLocaleString('fr-FR');
                    this.enqueueRewardToast(
                        '🔒',
                        `Avatar ${btn.dataset.avatar} verrouillé`,
                        `Score requis : ${reqScore.toLocaleString('fr-FR')} pts (Il vous manque ${missing} pts)`,
                        false
                    );
                    return;
                }
                this.profile.avatar = btn.dataset.avatar;
                this.saveProfile();
                this.audio.playClick();
                this.renderProfileModal();
                this.stateRev = Date.now();
                this.pushLiveSyncNow();
            });
        });

        const btnExport = document.getElementById('btn-export-json');
        if (btnExport) {
            btnExport.addEventListener('click', () => this.exportBackupJSON());
        }

        const btnImport = document.getElementById('btn-import-json');
        const fileInput = document.getElementById('input-import-file');
        if (btnImport && fileInput) {
            btnImport.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files && e.target.files[0];
                if (file) this.importBackupJSON(file);
                fileInput.value = '';
            });
        }
    }

    /**
     * Synchronisation Temps Réel (Mobile <-> PC) Zéro-Quota KV :
     * - Les coups en direct et le polling passent par le Cache Edge Cloudflare (0 lecture/écriture KV).
     * - Polling adaptatif intelligent qui ralentit puis se met en pause quand l'écran est inactif.
     */
    async initLiveSync() {
        this.lastActivityAt = Date.now();
        this.dirtyForKvCheckpoint = false;

        // Canal instantané inter-onglets (même navigateur)
        try {
            if ('BroadcastChannel' in window) {
                this.liveChannel = new BroadcastChannel('sudoku_live_sync_v1');
                this.liveChannel.onmessage = (ev) => {
                    const msg = ev.data;
                    if (msg && msg.deviceId !== this.deviceId && msg.bundle && msg.rev > this.stateRev) {
                        this.lastActivityAt = Date.now();
                        this.applyRemoteLiveState(msg.bundle, msg.rev);
                    }
                };
            }
        } catch (_) {}

        const markActive = () => {
            const wasPausedByIdle = (Date.now() - this.lastActivityAt) >= 180000;
            this.lastActivityAt = Date.now();
            if (wasPausedByIdle && !document.hidden) {
                this.pollLiveSync(false);
            }
        };
        document.addEventListener('pointerdown', markActive, { passive: true });
        document.addEventListener('keydown', markActive, { passive: true });
        document.addEventListener('touchstart', markActive, { passive: true });

        // 1. Premier check au démarrage (seul appel autorisé à lire KV si le cache Edge est froid)
        const foundRemote = await this.pollLiveSync(true);
        this.liveSyncReady = true;
        if (!foundRemote) {
            this.stateRev = Date.now();
            this.pushLiveSyncNow(true);
        }

        // 2. Boucle de polling adaptative (1.4s actif -> 4.5s repos -> pause après 3 min sans toucher)
        const runAdaptiveLoop = async () => {
            if (!document.hidden && !this.isApplyingRemote) {
                const idleMs = Date.now() - this.lastActivityAt;
                if (idleMs < 180000) {
                    await this.pollLiveSync(false);
                }
            }
            const idleMs = Date.now() - this.lastActivityAt;
            const nextDelay = idleMs < 60000 ? 3000 : (idleMs < 180000 ? 6000 : 10000);
            this._livePollTimer = setTimeout(runAdaptiveLoop, nextDelay);
        };
        this._livePollTimer = setTimeout(runAdaptiveLoop, 3000);

        // Sauvegarde KV de sécurité uniquement quand on quitte l'application, et réveil au retour
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (this.dirtyForKvCheckpoint) {
                    this.pushLiveSyncNow(true);
                }
            } else {
                this.lastActivityAt = Date.now();
                this.pollLiveSync(false);
            }
        });
        window.addEventListener('pagehide', () => {
            if (this.dirtyForKvCheckpoint) {
                this.pushLiveSyncNow(true);
            }
        });
        window.addEventListener('focus', () => {
            this.lastActivityAt = Date.now();
            this.pollLiveSync(false);
        });
    }

    hasValidLiveCredentials() {
        const pseudo = (this.profile && this.profile.name) ? this.profile.name.trim() : '';
        const pin = (this.profile && this.profile.pin) ? this.profile.pin.trim() : '';
        return pseudo.length >= 2 && /^[0-9]{4}$/.test(pin);
    }

    pulseLiveDot(mode = 'ok') {
        const dot = document.getElementById('live-sync-dot');
        if (!dot) return;
        dot.classList.add('connected');
        if (mode === 'tx' || mode === 'rx') {
            dot.classList.remove('sync-flash');
            void dot.offsetWidth;
            dot.classList.add('sync-flash');
        }
    }

    async pushLiveSyncNow(checkpoint = false) {
        if (!this.hasValidLiveCredentials() || this.isApplyingRemote) return;
        const pseudo = this.profile.name.trim();
        const pin = this.profile.pin.trim();
        const rev = this.stateRev || Date.now();
        this.stateRev = rev;
        this.lastActivityAt = Date.now();
        this.dirtyForKvCheckpoint = !checkpoint;

        const bundle = this.buildFullBackupBundle();

        // Diffusion locale immédiate
        if (this.liveChannel) {
            try {
                this.liveChannel.postMessage({ deviceId: this.deviceId, rev, bundle });
            } catch (_) {}
        }

        this.pulseLiveDot('tx');

        try {
            const res = await fetch(SudokuApp.CLOUD_KV_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'save',
                    pseudo,
                    pin,
                    rev,
                    checkpoint: Boolean(checkpoint),
                    deviceId: this.deviceId,
                    bundle
                }),
                keepalive: true
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.ok) {
                if (data.rev && data.rev > this.stateRev) {
                    this.stateRev = data.rev;
                }
                if (data.kvPersisted) {
                    this.dirtyForKvCheckpoint = false;
                }
                this.profile.lastCloudSync = data.updatedAt || new Date().toISOString();
                this.saveProfile();
                this.pulseLiveDot('ok');
            }
        } catch (_) {}
    }

    async pollLiveSync(forceFull = false) {
        if (!this.hasValidLiveCredentials() || this._isPollingLive) return false;
        this._isPollingLive = true;

        const pseudo = this.profile.name.trim();
        const pin = this.profile.pin.trim();

        try {
            const res = await fetch(SudokuApp.CLOUD_KV_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'poll',
                    pseudo,
                    pin,
                    deviceId: this.deviceId,
                    coldStart: Boolean(forceFull),
                    sinceRev: forceFull ? 0 : (this.stateRev || 0)
                }),
                cache: 'no-store'
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) return false;

            this.pulseLiveDot('ok');

            if (data.changed && data.bundle) {
                if (!forceFull && data.deviceId && data.deviceId === this.deviceId) {
                    this.stateRev = Math.max(this.stateRev, Number(data.rev || 0));
                    return true;
                }
                this.lastActivityAt = Date.now();
                this.applyRemoteLiveState(data.bundle, data.rev);
                return true;
            }
            return !data.empty;
        } catch (_) {
            return false;
        } finally {
            this._isPollingLive = false;
        }
    }

    applyRemoteLiveState(bundle, remoteRev = 0) {
        if (!bundle || typeof bundle !== 'object') return;
        this.isApplyingRemote = true;
        try {
            this.stateRev = Math.max(this.stateRev, Number(remoteRev || Date.now()));
            this.profile.lastCloudSync = bundle.updatedAt || new Date().toISOString();

            if (bundle.profile) {
                if (bundle.profile.avatar) this.profile.avatar = bundle.profile.avatar;
                if (typeof bundle.profile.xp === 'number') {
                    this.profile.xp = Math.max(this.profile.xp || 0, bundle.profile.xp);
                }
                if (typeof bundle.profile.rewardScore === 'number') {
                    this.profile.rewardScore = Math.max(this.profile.rewardScore || 0, bundle.profile.rewardScore);
                }
                if (Array.isArray(bundle.profile.trophies)) {
                    this.profile.trophies = [...new Set([...(this.profile.trophies || []), ...bundle.profile.trophies])];
                }
                if (bundle.profile.dailyStreak && typeof bundle.profile.dailyStreak === 'object') {
                    const localDs = this.profile.dailyStreak || { count: 0, lastPlayedDate: null, bestStreak: 0 };
                    const remDs = bundle.profile.dailyStreak;
                    if (!localDs.lastPlayedDate || (remDs.lastPlayedDate && remDs.lastPlayedDate >= localDs.lastPlayedDate)) {
                        this.profile.dailyStreak = {
                            count: Math.max(localDs.count || 0, remDs.count || 0),
                            lastPlayedDate: remDs.lastPlayedDate || localDs.lastPlayedDate,
                            bestStreak: Math.max(localDs.bestStreak || 0, remDs.bestStreak || 0)
                        };
                    }
                }
            }
            this.saveProfile();
            this.syncProfileUI();
            this.syncUnlockablesUI();

            if (bundle.stats && typeof bundle.stats === 'object') {
                const remoteReset = Number(bundle.profile && bundle.profile.statsResetAt) || 0;
                const localReset = Number(this.profile.statsResetAt) || 0;
                if (remoteReset > localReset) {
                    // Remise à zéro effectuée ailleurs : on l'adopte telle quelle
                    this.profile.statsResetAt = remoteReset;
                    this.saveProfile();
                    localStorage.removeItem(SudokuApp.STORAGE_KEY_STATS);
                    this.stats = this.mergeStats(this.loadStats(), bundle.stats);
                } else if (remoteReset === localReset) {
                    this.stats = this.mergeStats(this.loadStats(), bundle.stats);
                }
                this.saveStats();
            }

            const g = this.validateGame(bundle.currentGame) ? bundle.currentGame : null;
            if (g) {
                // Identifier la case qui vient d'être modifiée sur l'autre appareil pour l'animer en direct
                let changedCell = null;
                const samePuzzle = Array.isArray(this.solution) &&
                    this.solution.length === 9 &&
                    JSON.stringify(this.solution) === JSON.stringify(g.solution);

                if (samePuzzle && Array.isArray(this.board) && this.board.length === 9) {
                    for (let r = 0; r < 9; r++) {
                        for (let c = 0; c < 9; c++) {
                            if (this.board[r][c] !== g.board[r][c]) {
                                changedCell = { row: r, col: c, val: g.board[r][c] };
                            }
                        }
                    }
                }

                this.difficulty = g.difficulty || 'easy';
                this.multiplier = g.multiplier || 1;
                this.initialBoard = g.initialBoard;
                this.board = g.board;
                this.solution = g.solution;
                this.notes = g.notes || Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
                this.history = g.history || [];
                this.mistakes = g.mistakes || 0;
                this.score = g.score || 0;
                this.streak = g.streak || 0;
                this.hintsRemaining = g.hintsRemaining ?? 3;
                this.isAutoNotesOn = !!g.isAutoNotesOn;
                this.playedCounted = g.playedCounted !== false;
                this.elapsedSeconds = samePuzzle
                    ? Math.max(this.elapsedSeconds || 0, g.elapsedSeconds || 0)
                    : (g.elapsedSeconds || 0);
                this.completedUnits = new Set(Array.isArray(g.completedUnits) ? g.completedUnits : []);
                this.rebuildScoredCellsFromBoard(g.scoredCells);

                if (g.isGameOver || this.mistakes >= this.maxMistakes) {
                    this.isGameOver = true;
                    this.isWon = false;
                    this.isPaused = false;
                    this.syncPauseUI();
                    this.stopTimer();
                    this.closeModal('modal-victory');
                    this.openModal('modal-game-over');
                } else if (!samePuzzle || this.isGameOver || this.isWon) {
                    this.isGameOver = false;
                    this.isWon = false;
                    this.isPaused = false;
                    this.syncPauseUI();
                    this.closeModal('modal-game-over');
                    this.closeModal('modal-victory');
                    this.startTimer();
                }

                if (changedCell) {
                    this.selectedCell = { row: changedCell.row, col: changedCell.col };
                } else if (g.selectedCell && typeof g.selectedCell.row === 'number') {
                    this.selectedCell = g.selectedCell;
                }

                try {
                    localStorage.setItem(SudokuApp.STORAGE_KEY_GAME, JSON.stringify(g));
                } catch (_) {}

                this.updateCompletedUnitsSnapshot(false);
                this.render();

                if (changedCell && this.cellElements && this.cellElements[changedCell.row]) {
                    const cellEl = this.cellElements[changedCell.row][changedCell.col];
                    if (changedCell.val !== 0) {
                        const isRemoteCorrect = changedCell.val === this.solution[changedCell.row][changedCell.col];
                        this.animateCell(changedCell.row, changedCell.col, 'pop');
                        SudokuFX.ripple(cellEl, {
                            color: isRemoteCorrect ? '#3b82f6' : '#ef4444',
                            maxRadius: 46
                        });
                        this.audio.playPlace(changedCell.val, this.streak || 1);
                    } else {
                        this.audio.playErase();
                    }
                }
            }

            this.pulseLiveDot('rx');
            const profileModal = document.getElementById('modal-profile');
            if (profileModal && !profileModal.classList.contains('hidden')) {
                this.renderProfileModal();
            }
        } finally {
            this.isApplyingRemote = false;
        }
    }

    buildFullBackupBundle() {
        let savedGame = null;
        try {
            savedGame = JSON.parse(localStorage.getItem(SudokuApp.STORAGE_KEY_GAME));
        } catch (_) {}

        // L'historique d'annulation est local à l'appareil : inutile (et lourd) à synchroniser
        if (savedGame && typeof savedGame === 'object') {
            savedGame = { ...savedGame, history: [] };
        }

        return {
            app: 'sudoku-online-v1',
            updatedAt: new Date().toISOString(),
            profile: {
                name: this.profile.name,
                avatar: this.profile.avatar,
                xp: this.profile.xp || 0,
                rewardScore: this.profile.rewardScore || 0,
                trophies: this.profile.trophies || [],
                dailyStreak: this.profile.dailyStreak || { count: 0, lastPlayedDate: null, bestStreak: 0 },
                statsResetAt: this.profile.statsResetAt || 0
            },
            stats: this.stats,
            settings: this.settings,
            currentGame: savedGame
        };
    }

    applyFullBackupBundle(bundle) {
        if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) {
            throw new Error('Format de sauvegarde invalide.');
        }
        if (bundle.currentGame != null && !this.validateGame(bundle.currentGame)) {
            throw new Error('Partie en cours invalide.');
        }
        if (!confirm('Importer ce fichier remplacera votre partie en cours. Continuer ?')) return false;
        this.applyRemoteLiveState(bundle, Date.now());
        this.stateRev = Date.now();
        this.pushLiveSyncNow();
        return true;
    }

    showCloudStatus(text, type = 'ok') {
        const el = document.getElementById('cloud-status-msg');
        if (!el) return;
        el.textContent = text;
        el.className = `cloud-status-msg ${type}`;
        el.classList.remove('hidden');
    }

    exportBackupJSON() {
        const bundle = this.buildFullBackupBundle();
        const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const safeName = (this.profile.name || 'joueur').toLowerCase().replace(/[^a-z0-9_-]/g, '');
        a.href = url;
        a.download = `sudoku-sauvegarde-${safeName || 'profil'}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.showCloudStatus('✓ Fichier de sauvegarde .json téléchargé.', 'ok');
    }

    importBackupJSON(file) {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const bundle = JSON.parse(String(reader.result));
                if (this.applyFullBackupBundle(bundle)) {
                    this.showCloudStatus(`✓ Fichier importé ! Profil « ${this.profile.name} » restauré.`, 'ok');
                }
            } catch (_) {
                this.audio.playError();
                this.showCloudStatus('Fichier .json invalide ou corrompu.', 'err');
            }
        };
        reader.readAsText(file);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.sudokuApp = new SudokuApp();
});
