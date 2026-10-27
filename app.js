/**
 * Sudoku.com Clone - Contrôleur d'application principal (UI, État, Chronomètre, Sauvegarde & Stats)
 */

class SudokuApp {
    static STORAGE_KEY_GAME = 'sudoku_com_saved_game_v1';
    static STORAGE_KEY_SETTINGS = 'sudoku_com_settings_v1';
    static STORAGE_KEY_STATS = 'sudoku_com_stats_v1';
    static STORAGE_KEY_PROFILE = 'sudoku_com_profile_v1';
    static CLOUD_API_URL = 'https://bytebin.lucko.me';

    // Nom d'animation CSS -> classe à retirer quand elle se termine
    static ANIM_CLASS_MAP = {
        cellPop: 'anim-pop',
        cellShake: 'anim-shake',
        cellEnter: 'anim-enter',
        completionWave: 'cell-wave',
        pulseHint: 'cell-hint-flash'
    };

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

        // Suivi des lignes/colonnes/blocs déjà complétés pour éviter de rejouer l'animation ou les points bonus
        this.completedUnits = new Set();

        this.timerInterval = null;

        this.initDOMReferences();
        this.audio = new SudokuAudio();
        this.applyFeedbackSettings();
        this.applyTheme(this.settings.theme);
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
        this.checkUrlCloudImport();
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

        document.getElementById('btn-second-chance').addEventListener('click', () => {
            this.closeModal('modal-game-over');
            this.audio.playSecondChance();
            this.mistakes = Math.max(0, this.maxMistakes - 1);
            this.isGameOver = false;
            this.startTimer();
            this.render();
            this.saveGameState();
        });

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
                this.renderStatsModal(this.difficulty);
            }
        });

        document.getElementById('btn-settings').addEventListener('click', () => {
            this.openModal('modal-settings');
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

        // Écouteurs des paramètres
        const bindSetting = (id, key) => {
            const el = document.getElementById(id);
            el.addEventListener('change', () => {
                this.settings[key] = el.checked;
                this.saveSettings();
                this.applyFeedbackSettings();
                this.render();
            });
        };
        bindSetting('set-mistake-limit', 'mistakeLimit');
        bindSetting('set-auto-check', 'autoCheckErrors');
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
        this.lockedDigit = null;
        this.completedUnits = new Set();
        this.updateCompletedUnitsSnapshot(false);

        this.hintBanner.classList.add('hidden');

        // Enregistrer la partie commencée dans les statistiques
        this.stats[this.difficulty].played += 1;
        this.saveStats();

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
        this.completedUnits = new Set();
        this.updateCompletedUnitsSnapshot(false);
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
            this.streak += 1;
            // Gain de points façon Sudoku.com (base * multiplicateur * facteur vitesse + bonus de série)
            const speedBonus = Math.max(10, 60 - Math.floor(this.elapsedSeconds / 15));
            const streakBonus = this.streak >= 2 ? Math.min(5, this.streak - 1) * 15 : 0;
            this.score += (speedBonus + streakBonus) * this.multiplier;
            this.audio.playPlace(num, this.streak);
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
            // Erreur détectée
            if (this.settings.autoCheckErrors || this.hasConflict(row, col, num)) {
                this.mistakes += 1;
                errorCounted = true;
                this.audio.playError();
                this.haptic([30, 40, 30]);
                this.animateCell(row, col, 'shake');
                this.bump(this.mistakesContainer, 'pulse-error');
                this.bump(this.boardEl, 'board-error');
                if (this.settings.mistakeLimit && this.mistakes >= this.maxMistakes) {
                    this.isGameOver = true;
                    this.stopTimer();
                    this.audio.playGameOver();
                    this.haptic(200);
                    this.render();
                    this.saveGameState();
                    this.openModal('modal-game-over');
                    return;
                }
            } else {
                // Chiffre faux mais non signalé (vérification auto désactivée) : retour neutre
                this.audio.playPlace(num, 1);
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

        // Sur Sudoku.com, on ne gomme pas un chiffre déjà validé comme juste si autoCheckErrors est actif,
        // sauf si l'utilisateur souhaite tout de même vider ses notes. Permettons d'effacer tout chiffre posé par le joueur :
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
            score: this.score,
            streak: this.streak
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
        this.score = prev.score;
        this.streak = prev.streak ?? 0;

        this.updateCompletedUnitsSnapshot(false);
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
     * Remplit automatiquement toutes les notes candidates légales sur les cases vides
     */
    fillAutoNotes() {
        if (this.isPaused || this.isGameOver || this.isWon) return;
        this.pushHistory();

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

        this.selectedCell = { row: hint.row, col: hint.col };
        this.board[hint.row][hint.col] = hint.value;
        this.notes[hint.row][hint.col] = [];

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

        this.completedUnits = currentComplete;

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

        // Remplir la modale de victoire
        const diffLabel = SudokuEngine.DIFFICULTIES[this.difficulty].label;
        document.getElementById('vic-diff').textContent = diffLabel;
        document.getElementById('vic-score').textContent = this.score.toLocaleString('fr-FR');
        document.getElementById('vic-time').textContent = this.formatTime(this.elapsedSeconds);
        document.getElementById('vic-mistakes').textContent = `${this.mistakes}`;
        document.getElementById('victory-record-badge').textContent = isNewRecord
            ? '🎉 Nouveau record de temps pour ce niveau !'
            : 'Vous avez résolu la grille avec succès !';

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

        // Barre d'infos (Erreurs, Score, Temps)
        if (this.settings.mistakeLimit) {
            this.mistakesDisplay.textContent = `${this.mistakes}/${this.maxMistakes}`;
        } else {
            this.mistakesDisplay.textContent = `${this.mistakes}`;
        }
        this.scoreDisplay.textContent = this.score.toLocaleString('fr-FR');
        this.timerDisplay.textContent = this.formatTime(this.elapsedSeconds);

        // État des boutons Notes, Indice et Mode Rapide
        this.btnNotes.classList.toggle('active', this.isNotesMode);
        this.notesBadge.textContent = this.isNotesMode ? 'ON' : 'OFF';
        this.notesBadge.className = `status-badge ${this.isNotesMode ? 'on' : 'off'}`;

        this.hintsBadge.textContent = `${this.hintsRemaining}`;
        this.hintsBadge.className = `status-badge ${this.hintsRemaining > 0 ? 'count' : 'off'}`;
        this.btnHint.classList.toggle('disabled-action', this.hintsRemaining <= 0);

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
                document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach(m => m.classList.add('hidden'));
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
                    this.saveGameState();
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

    togglePause(forceState = null) {
        if (this.isGameOver || this.isWon) return;
        this.isPaused = forceState !== null ? forceState : !this.isPaused;
        this.audio.playPause(this.isPaused);

        this.pauseOverlay.classList.toggle('hidden', !this.isPaused);
        this.iconPause.classList.toggle('hidden', this.isPaused);
        this.iconPlay.classList.toggle('hidden', !this.isPaused);

        if (this.isPaused) {
            const diffLabel = SudokuEngine.DIFFICULTIES[this.difficulty].label;
            this.pauseStatsSummary.textContent = `Difficulté : ${diffLabel} • Temps : ${this.formatTime(this.elapsedSeconds)}`;
        }
    }

    formatTime(totalSec) {
        if (totalSec === null || totalSec === undefined) return '--:--';
        const mins = Math.floor(totalSec / 60);
        const secs = totalSec % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    /**
     * Thèmes & Modales
     */
    applyTheme(themeName) {
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
     * Persistance localStorage (Partie en cours, Paramètres, Statistiques)
     */
    saveGameState() {
        if (this.isWon || this.isGameOver) return;
        const payload = {
            difficulty: this.difficulty,
            multiplier: this.multiplier,
            initialBoard: this.initialBoard,
            board: this.board,
            solution: this.solution,
            notes: this.notes,
            history: this.history,
            mistakes: this.mistakes,
            score: this.score,
            streak: this.streak,
            hintsRemaining: this.hintsRemaining,
            elapsedSeconds: this.elapsedSeconds,
            selectedCell: this.selectedCell,
            isNotesMode: this.isNotesMode,
            isFastMode: this.isFastMode,
            lockedDigit: this.lockedDigit
        };
        try {
            localStorage.setItem(SudokuApp.STORAGE_KEY_GAME, JSON.stringify(payload));
        } catch (_) {}
    }

    restoreSavedGame() {
        try {
            const raw = localStorage.getItem(SudokuApp.STORAGE_KEY_GAME);
            if (!raw) return false;
            const data = JSON.parse(raw);
            if (!data || !data.board || !data.solution) return false;

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
            this.isFastMode = !!data.isFastMode;
            this.lockedDigit = data.lockedDigit ?? null;

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
            return { ...defaults, ...saved };
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

    loadProfile() {
        const defaults = {
            name: 'Joueur',
            avatar: '🧠',
            lastCloudCode: '',
            lastCloudSync: null
        };
        try {
            const saved = JSON.parse(localStorage.getItem(SudokuApp.STORAGE_KEY_PROFILE));
            return { ...defaults, ...saved };
        } catch (_) {
            return defaults;
        }
    }

    saveProfile() {
        try {
            localStorage.setItem(SudokuApp.STORAGE_KEY_PROFILE, JSON.stringify(this.profile));
        } catch (_) {}
    }

    getProfileRankInfo() {
        const diffs = Object.keys(this.stats || {});
        let totalWon = 0;
        let totalBestScore = 0;
        diffs.forEach(k => {
            const s = this.stats[k];
            if (s) {
                totalWon += s.won || 0;
                totalBestScore += s.bestScore || 0;
            }
        });

        const ranks = [
            { level: 1, minWins: 0,  nextWins: 2,  title: 'Apprenti Logique' },
            { level: 2, minWins: 2,  nextWins: 6,  title: 'Initié Sudoku' },
            { level: 3, minWins: 6,  nextWins: 15, title: 'Tacticien' },
            { level: 4, minWins: 15, nextWins: 30, title: 'Expert Confirmé' },
            { level: 5, minWins: 30, nextWins: 60, title: 'Maître des Chiffres' },
            { level: 6, minWins: 60, nextWins: 100, title: 'Grand Maître Absolu' }
        ];

        let current = ranks[0];
        for (const r of ranks) {
            if (totalWon >= r.minWins) current = r;
        }

        const span = Math.max(1, current.nextWins - current.minWins);
        const pct = current.level === 6
            ? 100
            : Math.min(100, Math.max(12, Math.round(((totalWon - current.minWins) / span) * 100)));

        return {
            level: current.level,
            title: current.title,
            totalWon,
            totalBestScore,
            progressPct: pct
        };
    }

    syncProfileUI() {
        const navAvatar = document.getElementById('nav-profile-avatar');
        const navName = document.getElementById('nav-profile-name');
        if (navAvatar) navAvatar.textContent = this.profile.avatar || '🧠';
        if (navName) navName.textContent = this.profile.name || 'Profil';
    }

    renderProfileModal() {
        this.syncProfileUI();
        const rank = this.getProfileRankInfo();

        const previewAvatar = document.getElementById('profile-avatar-preview');
        const levelBadge = document.getElementById('profile-level-badge');
        const rankTitle = document.getElementById('profile-rank-title');
        const xpFill = document.getElementById('profile-xp-fill');
        const xpSub = document.getElementById('profile-xp-sub');
        const nameInput = document.getElementById('profile-name-input');

        if (previewAvatar) previewAvatar.textContent = this.profile.avatar;
        if (levelBadge) levelBadge.textContent = `Niv. ${rank.level}`;
        if (rankTitle) rankTitle.textContent = rank.title;
        if (xpFill) xpFill.style.width = `${rank.progressPct}%`;
        if (xpSub) {
            xpSub.textContent = `${rank.totalWon} victoire${rank.totalWon > 1 ? 's' : ''} • ${rank.totalBestScore.toLocaleString('fr-FR')} pts records`;
        }
        if (nameInput && document.activeElement !== nameInput) {
            nameInput.value = this.profile.name;
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
        if (gameSummary) {
            gameSummary.textContent = `${diffLabel} • ${this.formatTime(this.elapsedSeconds)} • ${this.score.toLocaleString('fr-FR')} pts`;
        }
        if (gameProgress) {
            gameProgress.textContent = `Grille remplie à ${pctGrid}% (${filled}/81 cases) — sauvegarde auto active`;
        }

        // Dernier code Cloud
        const codeBox = document.getElementById('cloud-code-box');
        const codeDisplay = document.getElementById('cloud-code-display');
        const lastSyncEl = document.getElementById('cloud-last-sync');
        if (this.profile.lastCloudCode && codeBox && codeDisplay) {
            codeBox.classList.remove('hidden');
            codeDisplay.textContent = this.profile.lastCloudCode;
            if (lastSyncEl && this.profile.lastCloudSync) {
                const d = new Date(this.profile.lastCloudSync);
                lastSyncEl.textContent = `Dernière sauvegarde Cloud : ${d.toLocaleDateString('fr-FR')} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
            }
        }
    }

    bindProfileAndCloudEvents() {
        const nameInput = document.getElementById('profile-name-input');
        if (nameInput) {
            nameInput.addEventListener('input', () => {
                const val = nameInput.value.trim();
                this.profile.name = val || 'Joueur';
                this.saveProfile();
                this.syncProfileUI();
            });
        }

        document.querySelectorAll('.avatar-choice').forEach(btn => {
            btn.addEventListener('click', () => {
                this.profile.avatar = btn.dataset.avatar;
                this.saveProfile();
                this.audio.playClick();
                this.renderProfileModal();
            });
        });

        const btnPush = document.getElementById('btn-cloud-push');
        if (btnPush) {
            btnPush.addEventListener('click', () => this.pushToCloud());
        }

        const btnPull = document.getElementById('btn-cloud-pull');
        const codeInput = document.getElementById('cloud-code-input');
        if (btnPull && codeInput) {
            btnPull.addEventListener('click', () => this.pullFromCloud(codeInput.value));
            codeInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.pullFromCloud(codeInput.value);
                }
            });
        }

        const btnCopyCode = document.getElementById('btn-copy-cloud-code');
        if (btnCopyCode) {
            btnCopyCode.addEventListener('click', async () => {
                const code = this.profile.lastCloudCode;
                if (!code) return;
                try {
                    await navigator.clipboard.writeText(code);
                    this.showCloudStatus(`Code « ${code} » copié dans le presse-papiers !`, 'ok');
                } catch (_) {
                    this.showCloudStatus(`Votre code : ${code}`, 'ok');
                }
            });
        }

        const btnShareLink = document.getElementById('btn-share-cloud-link');
        if (btnShareLink) {
            btnShareLink.addEventListener('click', async () => {
                const code = this.profile.lastCloudCode;
                if (!code) return;
                const rawKey = code.replace(/^SUDO-/i, '');
                const shareUrl = `${window.location.origin}${window.location.pathname}?cloud=${encodeURIComponent(rawKey)}`;
                if (navigator.share) {
                    try {
                        await navigator.share({
                            title: 'Ma sauvegarde Sudoku',
                            text: `Code de sauvegarde Sudoku : ${code}`,
                            url: shareUrl
                        });
                        return;
                    } catch (_) {}
                }
                try {
                    await navigator.clipboard.writeText(shareUrl);
                    this.showCloudStatus('Lien de synchronisation copié dans le presse-papiers !', 'ok');
                } catch (_) {
                    this.showCloudStatus(shareUrl, 'ok');
                }
            });
        }

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

    buildFullBackupBundle() {
        this.saveGameState();
        let savedGame = null;
        try {
            savedGame = JSON.parse(localStorage.getItem(SudokuApp.STORAGE_KEY_GAME));
        } catch (_) {}

        return {
            app: 'sudoku-online-v1',
            updatedAt: new Date().toISOString(),
            profile: {
                name: this.profile.name,
                avatar: this.profile.avatar
            },
            stats: this.stats,
            settings: this.settings,
            currentGame: savedGame
        };
    }

    applyFullBackupBundle(bundle) {
        if (!bundle || typeof bundle !== 'object') {
            throw new Error('Format de sauvegarde invalide.');
        }

        if (bundle.profile) {
            this.profile.name = (bundle.profile.name || 'Joueur').slice(0, 18);
            this.profile.avatar = bundle.profile.avatar || '🧠';
            this.saveProfile();
        }

        if (bundle.stats && typeof bundle.stats === 'object') {
            this.stats = { ...this.loadStats(), ...bundle.stats };
            this.saveStats();
        }

        if (bundle.settings && typeof bundle.settings === 'object') {
            this.settings = { ...this.loadSettings(), ...bundle.settings };
            this.saveSettings();
            this.applyFeedbackSettings();
            this.applyTheme(this.settings.theme);
            this.syncSettingsUI();
        }

        if (bundle.currentGame && bundle.currentGame.board && bundle.currentGame.solution) {
            try {
                localStorage.setItem(SudokuApp.STORAGE_KEY_GAME, JSON.stringify(bundle.currentGame));
                this.restoreSavedGame();
            } catch (_) {}
        }

        this.renderProfileModal();
        this.render();
        this.audio.playSecondChance();
    }

    showCloudStatus(text, type = 'ok') {
        const el = document.getElementById('cloud-status-msg');
        if (!el) return;
        el.textContent = text;
        el.className = `cloud-status-msg ${type}`;
        el.classList.remove('hidden');
    }

    async pushToCloud() {
        const btnPush = document.getElementById('btn-cloud-push');
        if (btnPush) btnPush.disabled = true;
        this.showCloudStatus('Envoi de la sauvegarde vers le Cloud...', 'info');

        try {
            const payload = this.buildFullBackupBundle();
            const res = await fetch(`${SudokuApp.CLOUD_API_URL}/post`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (!data || !data.key) throw new Error('Clé Cloud manquante');

            const fullCode = `SUDO-${data.key}`;
            this.profile.lastCloudCode = fullCode;
            this.profile.lastCloudSync = new Date().toISOString();
            this.saveProfile();
            this.renderProfileModal();
            this.audio.playHint();

            try {
                await navigator.clipboard.writeText(fullCode);
                this.showCloudStatus(`✓ Sauvegardé ! Code « ${fullCode} » copié dans le presse-papiers.`, 'ok');
            } catch (_) {
                this.showCloudStatus(`✓ Sauvegardé ! Notez votre code : ${fullCode}`, 'ok');
            }
        } catch (_) {
            this.audio.playError();
            this.showCloudStatus('Connexion Cloud indisponible. Utilisez « Exporter .json » hors-ligne.', 'err');
        } finally {
            if (btnPush) btnPush.disabled = false;
        }
    }

    extractCloudKey(rawInput) {
        if (!rawInput) return '';
        const trimmed = rawInput.trim();
        // Si l'utilisateur colle une URL complète contenant ?cloud=XXXX
        try {
            if (trimmed.includes('cloud=')) {
                const u = new URL(trimmed, window.location.origin);
                const param = u.searchParams.get('cloud');
                if (param) return param.replace(/^SUDO-/i, '').trim();
            }
        } catch (_) {}
        return trimmed.replace(/^SUDO-/i, '').replace(/[^a-zA-Z0-9_-]/g, '');
    }

    async pullFromCloud(rawInput) {
        const key = this.extractCloudKey(rawInput);
        if (!key || key.length < 4) {
            this.audio.playBlocked();
            this.showCloudStatus('Veuillez entrer un code Cloud valide (ex: SUDO-SO0oUjih4l).', 'err');
            return;
        }

        const btnPull = document.getElementById('btn-cloud-pull');
        if (btnPull) btnPull.disabled = true;
        this.showCloudStatus('Récupération de la sauvegarde Cloud...', 'info');

        try {
            const res = await fetch(`${SudokuApp.CLOUD_API_URL}/${encodeURIComponent(key)}`);
            if (!res.ok) throw new Error('Code introuvable ou expiré');
            const bundle = await res.json();

            this.profile.lastCloudCode = `SUDO-${key}`;
            this.profile.lastCloudSync = bundle.updatedAt || new Date().toISOString();
            this.applyFullBackupBundle(bundle);
            this.showCloudStatus(`✓ Profil « ${this.profile.name} » et partie restaurés avec succès !`, 'ok');
        } catch (_) {
            this.audio.playError();
            this.showCloudStatus('Code Cloud introuvable ou connexion hors-ligne.', 'err');
        } finally {
            if (btnPull) btnPull.disabled = false;
        }
    }

    checkUrlCloudImport() {
        try {
            const url = new URL(window.location.href);
            const cloudParam = url.searchParams.get('cloud');
            if (!cloudParam) return;

            url.searchParams.delete('cloud');
            window.history.replaceState({}, document.title, url.pathname + url.search);

            this.openModal('modal-profile');
            this.pullFromCloud(cloudParam);
        } catch (_) {}
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
                this.applyFullBackupBundle(bundle);
                this.showCloudStatus(`✓ Fichier importé ! Profil « ${this.profile.name} » restauré.`, 'ok');
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
