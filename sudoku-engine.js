/**
 * Sudoku.com Clone - Moteur Sudoku (Générateur, Solveur & Indices Intelligents)
 */

class SudokuEngine {
    static DIFFICULTIES = {
        easy:    { id: 'easy',    label: 'Facile',    cluesToRemove: 38, multiplier: 1 },
        medium:  { id: 'medium',  label: 'Moyen',     cluesToRemove: 45, multiplier: 2 },
        hard:    { id: 'hard',    label: 'Difficile', cluesToRemove: 50, multiplier: 3 },
        expert:  { id: 'expert',  label: 'Expert',    cluesToRemove: 53, multiplier: 4 },
        master:  { id: 'master',  label: 'Maître',    cluesToRemove: 56, multiplier: 5 },
        extreme: { id: 'extreme', label: 'Extrême',   cluesToRemove: 58, multiplier: 6 }
    };

    /**
     * Crée une grille 9x9 remplie de 0
     */
    static createEmptyBoard() {
        return Array.from({ length: 9 }, () => Array(9).fill(0));
    }

    /**
     * Copie profonde d'une grille 9x9
     */
    static cloneBoard(board) {
        return board.map(row => [...row]);
    }

    /**
     * Mélange un tableau selon l'algorithme de Fisher-Yates
     */
    static shuffle(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    /**
     * Vérifie si le placement de `num` en (row, col) respecte les règles du Sudoku
     */
    static isValidPlacement(board, row, col, num) {
        for (let i = 0; i < 9; i++) {
            if (i !== col && board[row][i] === num) return false;
            if (i !== row && board[i][col] === num) return false;
        }
        const boxStartRow = Math.floor(row / 3) * 3;
        const boxStartCol = Math.floor(col / 3) * 3;
        for (let r = boxStartRow; r < boxStartRow + 3; r++) {
            for (let c = boxStartCol; c < boxStartCol + 3; c++) {
                if ((r !== row || c !== col) && board[r][c] === num) return false;
            }
        }
        return true;
    }

    /**
     * Remplit récursivement une grille 9x9 complète valide
     */
    static fillBoard(board) {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (board[row][col] === 0) {
                    const candidates = this.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
                    for (const num of candidates) {
                        if (this.isValidPlacement(board, row, col, num)) {
                            board[row][col] = num;
                            if (this.fillBoard(board)) {
                                return true;
                            }
                            board[row][col] = 0;
                        }
                    }
                    return false;
                }
            }
        }
        return true;
    }

    /**
     * Trouve la case vide ayant le moins de candidats (heuristique MRV) pour accélérer le comptage de solutions
     */
    static findBestEmptyCell(board) {
        let bestRow = -1;
        let bestCol = -1;
        let bestCandidates = null;

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (board[r][c] === 0) {
                    const candidates = [];
                    for (let num = 1; num <= 9; num++) {
                        if (this.isValidPlacement(board, r, c, num)) {
                            candidates.push(num);
                        }
                    }
                    if (candidates.length === 0) {
                        return { row: r, col: c, candidates: [] };
                    }
                    if (bestCandidates === null || candidates.length < bestCandidates.length) {
                        bestRow = r;
                        bestCol = c;
                        bestCandidates = candidates;
                        if (candidates.length === 1) {
                            return { row: bestRow, col: bestCol, candidates: bestCandidates };
                        }
                    }
                }
            }
        }

        if (bestRow === -1) return null;
        return { row: bestRow, col: bestCol, candidates: bestCandidates };
    }

    /**
     * Compte le nombre de solutions d'une grille (s'arrête dès que limit est atteint, par défaut 2)
     */
    static countSolutions(board, limit = 2) {
        const next = this.findBestEmptyCell(board);
        if (!next) {
            return 1; // Grille complète = 1 solution trouvée
        }
        if (next.candidates.length === 0) {
            return 0; // Impasse
        }

        let count = 0;
        const { row, col, candidates } = next;
        for (const num of candidates) {
            board[row][col] = num;
            count += this.countSolutions(board, limit - count);
            board[row][col] = 0;
            if (count >= limit) break;
        }
        return count;
    }

    /**
     * Génère un nouveau puzzle Sudoku avec solution unique garantie
     */
    static generatePuzzle(difficultyKey = 'easy') {
        const diff = this.DIFFICULTIES[difficultyKey] || this.DIFFICULTIES.easy;
        const solution = this.createEmptyBoard();
        this.fillBoard(solution);

        const puzzle = this.cloneBoard(solution);

        // Liste de toutes les coordonnées mélangées
        const positions = [];
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                positions.push([r, c]);
            }
        }
        const shuffledPositions = this.shuffle(positions);

        let removed = 0;
        const targetRemove = diff.cluesToRemove;

        for (const [r, c] of shuffledPositions) {
            if (removed >= targetRemove) break;
            if (puzzle[r][c] === 0) continue;

            const backup = puzzle[r][c];
            puzzle[r][c] = 0;

            const testCopy = this.cloneBoard(puzzle);
            const solutionsCount = this.countSolutions(testCopy, 2);

            if (solutionsCount !== 1) {
                puzzle[r][c] = backup;
            } else {
                removed++;
            }
        }

        return {
            puzzle,
            solution,
            difficulty: diff.id,
            difficultyLabel: diff.label,
            multiplier: diff.multiplier
        };
    }

    /**
     * Retourne les candidats possibles pour une case (row, col) selon l'état actuel de la grille
     */
    static getCandidates(board, row, col) {
        if (board[row][col] !== 0) return [];
        const candidates = [];
        for (let num = 1; num <= 9; num++) {
            if (this.isValidPlacement(board, row, col, num)) {
                candidates.push(num);
            }
        }
        return candidates;
    }

    /**
     * Cherche un indice intelligent (Naked Single, Hidden Single, ou cellule sélectionnée)
     */
    static getSmartHint(board, solution, selectedRow = null, selectedCol = null) {
        // 1. Si l'utilisateur a mis une valeur erronée quelque part, proposer de la corriger
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (board[r][c] !== 0 && board[r][c] !== solution[r][c]) {
                    return {
                        row: r,
                        col: c,
                        value: solution[r][c],
                        technique: 'Correction d\'erreur',
                        explanation: `La case (L${r + 1}, C${c + 1}) contient une erreur. Le bon chiffre est ${solution[r][c]}.`
                    };
                }
            }
        }

        // 2. Chercher un "Singleton nu" (Naked Single) : une case qui n'a qu'un seul candidat légal
        // Prioriser la case sélectionnée si elle est vide et est un singleton nu
        const cellsOrder = [];
        if (selectedRow !== null && selectedCol !== null && board[selectedRow][selectedCol] === 0) {
            cellsOrder.push([selectedRow, selectedCol]);
        }
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (board[r][c] === 0 && (r !== selectedRow || c !== selectedCol)) {
                    cellsOrder.push([r, c]);
                }
            }
        }

        for (const [r, c] of cellsOrder) {
            const candidates = this.getCandidates(board, r, c);
            if (candidates.length === 1 && candidates[0] === solution[r][c]) {
                return {
                    row: r,
                    col: c,
                    value: solution[r][c],
                    technique: 'Singleton nu (Dernier candidat possible)',
                    explanation: `En observant la ligne ${r + 1}, la colonne ${c + 1} et son bloc 3×3, seul le chiffre ${solution[r][c]} peut aller en (L${r + 1}, C${c + 1}).`
                };
            }
        }

        // 3. Chercher un "Singleton caché" (Hidden Single) dans un bloc 3x3, une ligne ou une colonne
        for (const [r, c] of cellsOrder) {
            const targetVal = solution[r][c];
            // Vérifier le bloc 3x3
            const boxStartR = Math.floor(r / 3) * 3;
            const boxStartC = Math.floor(c / 3) * 3;
            let possibleInBox = 0;
            for (let br = boxStartR; br < boxStartR + 3; br++) {
                for (let bc = boxStartC; bc < boxStartC + 3; bc++) {
                    if (board[br][bc] === 0 && this.isValidPlacement(board, br, bc, targetVal)) {
                        possibleInBox++;
                    }
                }
            }
            if (possibleInBox === 1) {
                return {
                    row: r,
                    col: c,
                    value: targetVal,
                    technique: 'Singleton caché (Bloc 3×3)',
                    explanation: `Dans ce bloc 3×3, la case (L${r + 1}, C${c + 1}) est la seule position valide pouvant accueillir le chiffre ${targetVal}.`
                };
            }

            // Vérifier la ligne
            let possibleInRow = 0;
            for (let cc = 0; cc < 9; cc++) {
                if (board[r][cc] === 0 && this.isValidPlacement(board, r, cc, targetVal)) {
                    possibleInRow++;
                }
            }
            if (possibleInRow === 1) {
                return {
                    row: r,
                    col: c,
                    value: targetVal,
                    technique: 'Singleton caché (Ligne)',
                    explanation: `Sur la ligne ${r + 1}, seule la case (L${r + 1}, C${c + 1}) peut contenir le chiffre ${targetVal}.`
                };
            }

            // Vérifier la colonne
            let possibleInCol = 0;
            for (let rr = 0; rr < 9; rr++) {
                if (board[rr][c] === 0 && this.isValidPlacement(board, rr, c, targetVal)) {
                    possibleInCol++;
                }
            }
            if (possibleInCol === 1) {
                return {
                    row: r,
                    col: c,
                    value: targetVal,
                    technique: 'Singleton caché (Colonne)',
                    explanation: `Dans la colonne ${c + 1}, seule la case (L${r + 1}, C${c + 1}) peut contenir le chiffre ${targetVal}.`
                };
            }
        }

        // 4. Repli sur la case sélectionnée (si vide) ou la case vide ayant le moins de candidats (MRV)
        if (selectedRow !== null && selectedCol !== null && board[selectedRow][selectedCol] === 0) {
            return {
                row: selectedRow,
                col: selectedCol,
                value: solution[selectedRow][selectedCol],
                technique: 'Indice sur la case sélectionnée',
                explanation: `Le chiffre correct pour la case (L${selectedRow + 1}, C${selectedCol + 1}) est ${solution[selectedRow][selectedCol]}.`
            };
        }

        const bestEmpty = this.findBestEmptyCell(board);
        if (bestEmpty) {
            const { row: r, col: c, candidates } = bestEmpty;
            const candText = candidates && candidates.length > 0 ? ` (candidats : ${candidates.join(', ')})` : '';
            return {
                row: r,
                col: c,
                value: solution[r][c],
                technique: 'Déduction avancée',
                explanation: `La case (L${r + 1}, C${c + 1})${candText} a pour valeur ${solution[r][c]}.`
            };
        }

        return null;
    }
}

window.SudokuEngine = SudokuEngine;
