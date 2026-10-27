/**
 * Sudoku - Moteur sonore synthétisé (Web Audio API)
 * Aucun fichier audio : tous les sons sont générés par oscillateurs et bruit filtré.
 * Le contexte audio est créé au premier geste de l'utilisateur (exigence des navigateurs).
 */
class SudokuAudio {
    // Gamme pentatonique : chaque chiffre 1..9 a sa propre note (toujours harmonieux)
    static SCALE = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99];

    constructor() {
        this.ctx = null;
        this.master = null;
        this.enabled = true;
        this.volume = 0.6;
        this._noiseBuffer = null;
    }

    setEnabled(value) {
        this.enabled = !!value;
    }

    setVolume(value) {
        this.volume = Math.min(1, Math.max(0, Number(value) || 0));
        if (this.master) this.master.gain.value = this.volume * this.volume;
    }

    /** À appeler depuis un geste utilisateur (clic, touche, toucher). */
    unlock() {
        try {
            if (!this.ctx) {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (!AC) return;
                this.ctx = new AC();
                this.master = this.ctx.createGain();
                this.master.gain.value = this.volume * this.volume;
                const comp = this.ctx.createDynamicsCompressor();
                this.master.connect(comp);
                comp.connect(this.ctx.destination);
            }
            if (this.ctx.state === 'suspended') this.ctx.resume();
        } catch (_) { /* audio indisponible : le jeu reste jouable en silence */ }
    }

    _ready() {
        if (!this.enabled || !this.ctx) return false;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return true;
    }

    /* ---------- Briques de base ---------- */

    _tone({ freq, type = 'sine', delay = 0, dur = 0.15, gain = 0.2, slideTo = null, attack = 0.004 }) {
        const t = this.ctx.currentTime + delay;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(gain, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(g);
        g.connect(this.master);
        osc.start(t);
        osc.stop(t + dur + 0.03);
    }

    _noise({ delay = 0, dur = 0.15, gain = 0.1, from = 1500, to = 500, q = 1 }) {
        if (!this._noiseBuffer) {
            const len = this.ctx.sampleRate;
            this._noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
            const data = this._noiseBuffer.getChannelData(0);
            for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        }
        const t = this.ctx.currentTime + delay;
        const src = this.ctx.createBufferSource();
        src.buffer = this._noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.value = q;
        filter.frequency.setValueAtTime(from, t);
        filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(gain, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(filter);
        filter.connect(g);
        g.connect(this.master);
        src.start(t);
        src.stop(t + dur + 0.03);
    }

    /* ---------- Sons du jeu ---------- */

    /** Clic d'interface (boutons, onglets, thèmes). */
    playClick() {
        if (!this._ready()) return;
        this._tone({ freq: 680, dur: 0.04, gain: 0.06 });
    }

    /** Sélection d'une case. */
    playSelect() {
        if (!this._ready()) return;
        this._tone({ freq: 480, type: 'triangle', dur: 0.035, gain: 0.05 });
    }

    /** Chiffre correct : une note par chiffre + petit « toc » de pion en bois. */
    playPlace(num) {
        if (!this._ready()) return;
        const f = SudokuAudio.SCALE[(num - 1) % 9];
        this._tone({ freq: f, type: 'triangle', dur: 0.24, gain: 0.2 });
        this._tone({ freq: f * 2, dur: 0.15, gain: 0.05 });
        this._noise({ dur: 0.03, gain: 0.05, from: 3000, to: 1500 });
    }

    /** Note au crayon ajoutée (aiguë) ou retirée (plus grave). */
    playNote(added = true) {
        if (!this._ready()) return;
        this._tone({ freq: added ? 1000 : 700, dur: 0.04, gain: 0.05 });
    }

    /** Gomme : petit frottement. */
    playErase() {
        if (!this._ready()) return;
        this._noise({ dur: 0.12, gain: 0.07, from: 3000, to: 400 });
        this._tone({ freq: 300, slideTo: 150, type: 'triangle', dur: 0.1, gain: 0.06 });
    }

    /** Annuler : deux glissandos descendants. */
    playUndo() {
        if (!this._ready()) return;
        this._tone({ freq: 520, slideTo: 330, type: 'triangle', dur: 0.12, gain: 0.1 });
        this._tone({ freq: 440, slideTo: 260, type: 'triangle', dur: 0.12, gain: 0.08, delay: 0.08 });
    }

    /** Erreur : buzz grave désaccordé. */
    playError() {
        if (!this._ready()) return;
        this._tone({ freq: 160, slideTo: 80, type: 'sawtooth', dur: 0.3, gain: 0.07 });
        this._tone({ freq: 168, slideTo: 84, type: 'sawtooth', dur: 0.3, gain: 0.06 });
    }

    /** Interrupteur ON (montant) / OFF (descendant) : notes, fast mode, son. */
    playToggle(on = true) {
        if (!this._ready()) return;
        this._tone({
            freq: on ? 520 : 780,
            slideTo: on ? 780 : 480,
            type: 'triangle', dur: 0.09, gain: 0.1
        });
    }

    /** Notes auto : petite pluie de ticks montants. */
    playAutoNotes() {
        if (!this._ready()) return;
        for (let i = 0; i < 6; i++) {
            this._tone({ freq: 700 + i * 80, dur: 0.05, gain: 0.05, delay: i * 0.03 });
        }
    }

    /** Indice : arpège scintillant. */
    playHint() {
        if (!this._ready()) return;
        [659.25, 783.99, 987.77, 1318.5].forEach((f, i) => {
            this._tone({ freq: f, dur: 0.3, gain: 0.13, delay: i * 0.07 });
            this._tone({ freq: f * 2, dur: 0.2, gain: 0.03, delay: i * 0.07 + 0.02 });
        });
    }

    /** Ligne / colonne / bloc terminé : arpège joyeux (plus long si plusieurs unités). */
    playUnitComplete(count = 1, extraDelay = 0) {
        if (!this._ready()) return;
        const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
        const n = Math.min(notes.length, 3 + count);
        for (let i = 0; i < n; i++) {
            const d = 0.12 + extraDelay + i * 0.07;
            this._tone({ freq: notes[i], type: 'triangle', dur: 0.3, gain: 0.16, delay: d });
            this._tone({ freq: notes[i] * 2, dur: 0.18, gain: 0.04, delay: d });
        }
    }

    /** Les 9 exemplaires d'un chiffre sont placés : petit carillon. */
    playDigitDone() {
        if (!this._ready()) return;
        this._tone({ freq: 784, dur: 0.3, gain: 0.12, delay: 0.1 });
        this._tone({ freq: 1174.7, dur: 0.3, gain: 0.12, delay: 0.18 });
    }

    /** Pause (descendant) / reprise (montant). */
    playPause(paused) {
        if (!this._ready()) return;
        this._tone({
            freq: paused ? 520 : 330,
            slideTo: paused ? 330 : 520,
            type: 'triangle', dur: 0.18, gain: 0.1
        });
    }

    /** Nouvelle partie : souffle montant + trois notes douces. */
    playNewGame() {
        if (!this._ready()) return;
        this._noise({ dur: 0.35, gain: 0.07, from: 400, to: 3000, q: 0.8 });
        [392, 523.25, 659.25].forEach((f, i) => {
            this._tone({ freq: f, type: 'triangle', dur: 0.2, gain: 0.08, delay: 0.1 + i * 0.07 });
        });
    }

    /** Seconde chance : trois notes montantes rassurantes. */
    playSecondChance() {
        if (!this._ready()) return;
        [329.63, 440, 587.33].forEach((f, i) => {
            this._tone({ freq: f, type: 'triangle', dur: 0.25, gain: 0.13, delay: i * 0.1 });
        });
    }

    /** Partie terminée : quatre notes descendantes. */
    playGameOver(delay = 0.35) {
        if (!this._ready()) return;
        [392, 349.23, 311.13, 261.63].forEach((f, i) => {
            this._tone({ freq: f, type: 'triangle', dur: 0.35, gain: 0.16, delay: delay + i * 0.18 });
        });
    }

    /** Victoire : fanfare, accord final et étincelles. */
    playVictory() {
        if (!this._ready()) return;
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
            this._tone({ freq: f, type: 'triangle', dur: 0.3, gain: 0.18, delay: i * 0.12 });
        });
        [523.25, 783.99, 1046.5, 1318.5].forEach((f) => {
            this._tone({ freq: f, type: 'triangle', dur: 1.1, gain: 0.12, delay: 0.6 });
        });
        [1568, 1760, 2093, 2349].forEach((f, i) => {
            this._tone({ freq: f, dur: 0.25, gain: 0.05, delay: 0.75 + i * 0.09 });
        });
    }
}
