const test = require('node:test');
const assert = require('node:assert');
const SudokuEngine = require('../sudoku-engine.js');

function isCompleteValid(board) {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const v = board[r][c];
            if (!(v >= 1 && v <= 9)) return false;
            if (!SudokuEngine.isValidPlacement(board, r, c, v)) return false;
        }
    }
    return true;
}

test('fillBoard génère une grille complète valide', () => {
    const b = SudokuEngine.createEmptyBoard();
    assert.ok(SudokuEngine.fillBoard(b));
    assert.ok(isCompleteValid(b));
});

for (const key of Object.keys(SudokuEngine.DIFFICULTIES)) {
    test(`generatePuzzle(${key}) : solution unique et cohérente`, () => {
        const { puzzle, solution } = SudokuEngine.generatePuzzle(key);
        assert.ok(isCompleteValid(solution));
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (puzzle[r][c] !== 0) assert.strictEqual(puzzle[r][c], solution[r][c]);
            }
        }
        assert.strictEqual(SudokuEngine.countSolutions(SudokuEngine.cloneBoard(puzzle), 2), 1);
    });
}

test('getSmartHint renvoie la valeur de la solution', () => {
    const { puzzle, solution } = SudokuEngine.generatePuzzle('easy');
    const hint = SudokuEngine.getSmartHint(puzzle, solution, 0, 0);
    assert.ok(hint);
    assert.strictEqual(hint.value, solution[hint.row][hint.col]);
    assert.strictEqual(puzzle[hint.row][hint.col], 0);
});

test('getSmartHint corrige une erreur existante', () => {
    const { puzzle, solution } = SudokuEngine.generatePuzzle('easy');
    let target = null;
    for (let r = 0; r < 9 && !target; r++) {
        for (let c = 0; c < 9; c++) if (puzzle[r][c] === 0) { target = [r, c]; break; }
    }
    puzzle[target[0]][target[1]] = (solution[target[0]][target[1]] % 9) + 1;
    const hint = SudokuEngine.getSmartHint(puzzle, solution);
    assert.strictEqual(hint.technique, "Correction d'erreur");
    assert.deepStrictEqual([hint.row, hint.col], target);
});
