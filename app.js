/**
 * Sudoku.com Clone - Contrôleur d'application principal (UI, État, Chronomètre, Sauvegarde & Stats)
 */

class SudokuApp {
    static STORAGE_KEY_GAME = 'sudoku_com_saved_game_v1';
    static STORAGE_KEY_SETTINGS = 'sudoku_com_settings_v1';
    static STORAGE_KEY_STATS = 'sudoku_com_stats_v1';

    constructor() {
        this.settings = this.loadSettings();
        this.stats = this.loadStats();

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
        this.hintsRemaining = 3;
        this.elapsedSeconds = 0;
        this.isPaused = false;
        this.isGameOver = false;
        this.isWon = false;

        // Suivi des lignes/colonnes/blocs déjà complétés pour éviter de rejouer l'animation ou les points bonus
        this.completedUnits = new Set();

        this.timerInterval = null;

        this.initDOMReferences();
        this.applyTheme(this.settings.theme);
        this.syncSettingsUI();
        this.createBoardDOM();
        this.bindEvents();

        // Restaurer la partie sauvegardée ou en démarrer une nouvelle
        if (!this.restoreSavedGame()) {
            this.startNewGame('easy');
        }
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

        // Écouteurs des paramètres
        const bindSetting = (id, key) => {
            const el = document.getElementById(id);
            el.addEventListener('change', () => {
                this.settings[key] = el.checked;
                this.saveSettings();
                this.render();
            });
        };
        bindSetting('set-mistake-limit', 'mistakeLimit');
        bindSetting('set-auto-check', 'autoCheckErrors');
        bindSetting('set-highlight-duplicates', 'highlightDuplicates');
        bindSetting('set-highlight-identical', 'highlightIdentical');
        bindSetting('set-auto-remove-notes', 'autoRemoveNotes');
        bindSetting('set-hide-used-numbers', 'hideUsedNumbers');

        // Raccourcis clavier complets
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
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
        this.hintsRemaining = 3;
        this.elapsedSeconds = 0;
        this.isPaused = false;
        this.isGameOver = false;
        this.isWon = false;
        this.lockedDigit = null;
        this.completedUnits = new Set();
        this. updateCompletedUnitsSnapshot(false);

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
    }

    /**
     * Gestion du clic sur une cellule
     */
    onCellClick(row, col) {
        if (this.isPaused || this.isGameOver || this.isWon) return;

        this.selectedCell = { row, col };

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
            } else {
                this.lockedDigit = num;
                // Si la case actuellement sélectionnée est modifiable et vide, la remplir aussi
                const { row, col } = this.selectedCell;
                if (this.initialBoard[row][col] === 0 && this.board[row][col] === 0) {
                    this.placeNumberInCell(row, col, num);
                    return;
                }
            }
            this.render();
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
            this.render();
            this.saveGameState();
            return;
        }

        // Mode saisie normale : si le même chiffre est déjà présent, on l'efface
        if (this.board[row][col] === num) {
            this.board[row][col] = 0;
            this.render();
            this.saveGameState();
            return;
        }

        this.board[row][col] = num;
        this.notes[row][col] = [];

        const isCorrect = (num === this.solution[row][col]);

        if (isCorrect) {
            // Gain de points façon Sudoku.com (base * multiplicateur * facteur vitesse)
            const speedBonus = Math.max(10, 60 - Math.floor(this.elapsedSeconds / 15));
            this.score += speedBonus * this.multiplier;

            // Suppression automatique des notes dans la même ligne, colonne et bloc 3x3
            if (this.settings.autoRemoveNotes) {
                this.removePeerNotes(row, col, num);
            }

            // Vérifier les nouvelles unités (ligne, colonne, bloc) complétées
            this.updateCompletedUnitsSnapshot(true);

            // Si tous les exemplaires de ce chiffre sont placés et qu'il était verrouillé en mode rapide
            if (this.getRemainingCount(num) === 0 && this.lockedDigit === num) {
                this.lockedDigit = null;
            }
        } else {
            // Erreur détectée
            if (this.settings.autoCheckErrors || this.hasConflict(row, col, num)) {
                this.mistakes += 1;
                if (this.settings.mistakeLimit && this.mistakes >= this.maxMistakes) {
                    this.isGameOver = true;
                    this.stopTimer();
                    this.render();
                    this.saveGameState();
                    this.openModal('modal-game-over');
                    return;
                }
            }
        }

        this.render();
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
            score: this.score
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
        if (this.history.length === 0) return;

        const prev = this.history.pop();
        this.board = prev.board;
        this.notes = prev.notes;
        this.score = prev.score;

        this.render();
        this.saveGameState();
    }

    /**
     * Bascule le mode Notes (Crayon)
     */
    toggleNotesMode() {
        if (this.isPaused || this.isGameOver || this.isWon) return;
        this.isNotesMode = !this.isNotesMode;
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
        this.render();
        this.saveGameState();
    }

    /**
     * Donne un indice intelligent (avec explication logique)
     */
    useSmartHint() {
        if (this.isPaused || this.isGameOver || this.isWon) return;

        const { row, col } = this.selectedCell;
        const hint = SudokuEngine.getSmartHint(this.board, this.solution, row, col);
        if (!hint) return;

        this.pushHistory();

        if (this.hintsRemaining > 0) {
            this.hintsRemaining -= 1;
        }

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

        this.updateCompletedUnitsSnapshot(true);
        this.render();

        // Effet visuel sur la case révélée
        const targetEl = this.cellElements[hint.row][hint.col];
        targetEl.classList.remove('cell-hint-flash');
        void targetEl.offsetWidth;
        targetEl.classList.add('cell-hint-flash');

        this.saveGameState();
        this.checkVictory();
    }

    /**
     * Vérifie si une ligne, colonne ou bloc 3x3 vient d'être complété pour jouer l'animation d'onde
     */
    updateCompletedUnitsSnapshot(animateNew = true) {
        const currentComplete = new Set();
        const newlyCompletedCells = [];

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

        setTimeout(() => {
            this.openModal('modal-victory');
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

        this.hintsBadge.textContent = this.hintsRemaining > 0 ? `${this.hintsRemaining}` : '+';

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
                cellEl.className = 'sudoku-cell';
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
            hintsRemaining: this.hintsRemaining,
            elapsedSeconds: this.elapsedSeconds
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
            this.hintsRemaining = data.hintsRemaining ?? 3;
            this.elapsedSeconds = data.elapsedSeconds || 0;

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
            hideUsedNumbers: true
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
}

document.addEventListener('DOMContentLoaded', () => {
    window.sudokuApp = new SudokuApp();
});
