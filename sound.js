/**
 * Sudoku - Moteur sonore tactile & ASMR (Web Audio API)
 * Synthèse procédurale inspirée des jeux de réflexion modernes (Marimba chaud, Kalimba cristallin,
 * percussions organiques douces et accords harmoniques évolutifs selon le combo).
 * Aucun fichier audio externe requis.
 */
class SudokuAudio {
    // Gamme pentatonique majeure en Do (C4 -> G5) : toujours consonante et apaisante
    static SCALE = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99];

    constructor() {
        this.ctx = null;
        this.master = null;
        this.enabled = true;
        this.volume = 0.6;
        this.soundPack = 'marimba'; // 'marimba' | 'piano' | 'crystal' | 'retro'
        this._noiseBuffer = null;
    }

    setEnabled(value) {
        this.enabled = !!value;
    }

    setSoundPack(pack) {
        if (['marimba', 'piano', 'crystal', 'retro'].includes(pack)) {
            this.soundPack = pack;
        }
    }

    setVolume(value) {
        this.volume = Math.min(1, Math.max(0, Number(value) || 0));
        if (this.master && this.ctx) {
            this.master.gain.setTargetAtTime(this.volume * this.volume, this.ctx.currentTime, 0.015);
        }
    }

    /** Initialise ou réveille le contexte audio lors d'un geste utilisateur. */
    unlock() {
        try {
            if (!this.ctx) {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (!AC) return;
                this.ctx = new AC();
                this.master = this.ctx.createGain();
                this.master.gain.value = this.volume * this.volume;

                // Compresseur doux pour éviter toute saturation sur les accords riches
                const comp = this.ctx.createDynamicsCompressor();
                comp.threshold.value = -14;
                comp.knee.value = 18;
                comp.ratio.value = 4;
                comp.attack.value = 0.003;
                comp.release.value = 0.18;

                this.master.connect(comp);
                comp.connect(this.ctx.destination);
            }
            if (this.ctx.state === 'suspended') {
                this.ctx.resume().catch(() => {});
            }
        } catch (_) { /* Audio indisponible : le jeu fonctionne en silence */ }
    }

    _ready() {
        if (!this.enabled) return false;
        if (!this.ctx) this.unlock();
        if (!this.ctx) return false;
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
        return true;
    }

    /* ---------- Synthétiseurs de base (Oscillateur filtré, Marimba, Kalimba, Bruit) ---------- */

    /**
     * Oscillateur enveloppé avec filtre passe-bas optionnel pour un timbre doux et chaleureux
     */
    _tone({
        freq,
        type = 'sine',
        delay = 0,
        dur = 0.18,
        gain = 0.2,
        slideTo = null,
        attack = 0.004,
        cutoff = null,
        detune = 0
    }) {
        const t = this.ctx.currentTime + delay;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(Math.max(20, freq), t);
        if (detune) osc.detune.setValueAtTime(detune, t);
        if (slideTo) {
            osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
        }

        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(Math.max(0.0002, gain), t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        if (cutoff) {
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(cutoff, t);
            filter.frequency.exponentialRampToValueAtTime(Math.max(80, cutoff * 0.35), t + dur);
            osc.connect(filter);
            filter.connect(g);
        } else {
            osc.connect(g);
        }

        g.connect(this.master);
        osc.start(t);
        osc.stop(t + dur + 0.03);
    }

    /**
     * Frappe principale selon le pack sonore actif (Marimba, Piano Lo-Fi, Cristal Zen, ou Rétro 8-bit)
     */
    _marimba(freq, { delay = 0, dur = 0.28, gain = 0.22 } = {}) {
        if (this.soundPack === 'piano') {
            this._tone({ freq, type: 'triangle', delay, dur: dur * 1.45, gain: gain * 0.9, attack: 0.008, cutoff: freq * 2.6 });
            this._tone({ freq: freq * 2, type: 'sine', delay, dur: dur * 0.85, gain: gain * 0.25, attack: 0.005 });
            return;
        }
        if (this.soundPack === 'crystal') {
            this._tone({ freq: freq * 1.5, type: 'sine', delay, dur: dur * 1.6, gain: gain * 0.72, attack: 0.004 });
            this._tone({ freq: freq * 3, type: 'sine', delay: delay + 0.012, dur: dur * 1.1, gain: gain * 0.26, attack: 0.003, detune: 6 });
            return;
        }
        if (this.soundPack === 'retro') {
            this._tone({ freq, type: 'square', delay, dur: dur * 0.68, gain: gain * 0.42, attack: 0.002, cutoff: 2400 });
            this._tone({ freq: freq * 2, type: 'triangle', delay: delay + 0.025, dur: dur * 0.45, gain: gain * 0.28, attack: 0.002 });
            return;
        }

        // Pack par défaut : Fondamentale boisée Marimba
        this._tone({
            freq,
            type: 'sine',
            delay,
            dur,
            gain,
            attack: 0.003
        });
        // Harmonique de résonance du bois (2 octaves au-dessus, déclin très court)
        this._tone({
            freq: freq * 4,
            type: 'sine',
            delay,
            dur: Math.min(0.055, dur * 0.3),
            gain: gain * 0.22,
            attack: 0.002
        });
        // Léger impact de maillet feutré
        this._noise({
            delay,
            dur: 0.018,
            gain: gain * 0.16,
            from: 1800,
            to: 650,
            q: 2.2
        });
    }

    /**
     * Note de Kalimba / Célesta cristalline (attaque métallique douce + halo harmonique)
     */
    _kalimba(freq, { delay = 0, dur = 0.42, gain = 0.16 } = {}) {
        this._tone({
            freq,
            type: 'triangle',
            delay,
            dur,
            gain,
            attack: 0.003,
            cutoff: freq * 3.5
        });
        // Partiel cristallin à la 3e harmonique (octave + quinte)
        this._tone({
            freq: freq * 3,
            type: 'sine',
            delay,
            dur: dur * 0.38,
            gain: gain * 0.18,
            attack: 0.002
        });
    }

    /**
     * Bruit blanc filtré (passe-bande balayé) pour les textures tactiles (gomme, papier, souffle)
     */
    _noise({ delay = 0, dur = 0.12, gain = 0.08, from = 1600, to = 500, q = 1.4 }) {
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
        filter.frequency.setValueAtTime(Math.max(40, from), t);
        filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur);

        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(Math.max(0.0002, gain), t + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        src.connect(filter);
        filter.connect(g);
        g.connect(this.master);
        src.start(t);
        src.stop(t + dur + 0.03);
    }

    /* ---------- Micro-interactions & Sons du jeu ---------- */

    /** Clic d'interface subtil et feutré (boutons, onglets, thèmes). */
    playClick() {
        if (!this._ready()) return;
        this._tone({ freq: 580, slideTo: 720, type: 'sine', dur: 0.032, gain: 0.055, attack: 0.002 });
    }

    /** Sélection d'une cellule : micro-tap organique en bois doux. */
    playSelect() {
        if (!this._ready()) return;
        this._tone({ freq: 390, slideTo: 470, type: 'sine', dur: 0.028, gain: 0.045, attack: 0.002 });
        this._noise({ dur: 0.012, gain: 0.025, from: 2200, to: 1100, q: 3 });
    }

    /**
     * Pose d'un chiffre valide : Marimba boisé + brillance Kalimba qui s'enrichit avec le combo (streak).
     */
    playPlace(num, streak = 1) {
        if (!this._ready()) return;
        const baseFreq = SudokuAudio.SCALE[(num - 1) % 9];
        // Léger enrichissement harmonique quand le joueur enchaîne les bonnes réponses
        const comboBoost = Math.min(6, Math.max(0, streak - 1));

        this._marimba(baseFreq, { dur: 0.28, gain: 0.22 });

        if (comboBoost >= 1) {
            // Ajoute une note de kalimba à la quinte ou à l'octave selon la série en cours
            const shimmerMult = comboBoost >= 3 ? 2 : 1.5;
            this._kalimba(baseFreq * shimmerMult, {
                delay: 0.045,
                dur: 0.26 + comboBoost * 0.02,
                gain: 0.05 + comboBoost * 0.012
            });
        }
    }

    /** Note au crayon : petit clic cristallin (aigu à l'ajout, doux au retrait). */
    playNote(added = true) {
        if (!this._ready()) return;
        if (added) {
            this._kalimba(1046.5, { dur: 0.075, gain: 0.065 });
        } else {
            this._tone({ freq: 698.46, slideTo: 523.25, type: 'sine', dur: 0.065, gain: 0.055 });
        }
    }

    /** Gomme : frottement doux sur papier + relâchement grave. */
    playErase() {
        if (!this._ready()) return;
        this._noise({ dur: 0.095, gain: 0.065, from: 2600, to: 520, q: 1.2 });
        this._tone({ freq: 340, slideTo: 185, type: 'sine', dur: 0.09, gain: 0.07 });
    }

    /** Annuler (Undo) : double goutte d'eau inversée très douce. */
    playUndo() {
        if (!this._ready()) return;
        this._marimba(523.25, { delay: 0, dur: 0.13, gain: 0.11 });
        this._marimba(392.00, { delay: 0.065, dur: 0.16, gain: 0.11 });
    }

    /** Action indisponible (ex: 0 indice restant) : double toc boisé sourd. */
    playBlocked() {
        if (!this._ready()) return;
        this._tone({ freq: 195, slideTo: 150, type: 'triangle', dur: 0.065, gain: 0.11, cutoff: 420 });
        this._tone({ freq: 175, slideTo: 135, type: 'triangle', delay: 0.075, dur: 0.075, gain: 0.09, cutoff: 380 });
    }

    /** Erreur : pulsation grave feutrée (intervalle de seconde mineure filtré, non agressif). */
    playError() {
        if (!this._ready()) return;
        this._tone({ freq: 164.81, slideTo: 110, type: 'triangle', dur: 0.26, gain: 0.16, cutoff: 480 });
        this._tone({ freq: 174.61, slideTo: 116.5, type: 'sawtooth', dur: 0.24, gain: 0.055, cutoff: 360 });
        this._noise({ dur: 0.04, gain: 0.05, from: 600, to: 180, q: 1.5 });
    }

    /** Interrupteur ON / OFF (Notes, Mode Rapide, Son) : petit pop kalimba bicolore. */
    playToggle(on = true) {
        if (!this._ready()) return;
        const f1 = on ? 523.25 : 659.25;
        const f2 = on ? 659.25 : 493.88;
        this._tone({ freq: f1, type: 'sine', dur: 0.07, gain: 0.08 });
        this._tone({ freq: f2, type: 'sine', delay: 0.045, dur: 0.09, gain: 0.09 });
    }

    /** Notes auto : cascade harpe/kalimba pentatonique rapide. */
    playAutoNotes() {
        if (!this._ready()) return;
        const harp = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
        harp.forEach((f, i) => {
            this._kalimba(f, { delay: i * 0.028, dur: 0.18, gain: 0.065 });
        });
    }

    /** Indice intelligent : arpège céleste Maj9 scintillant. */
    playHint() {
        if (!this._ready()) return;
        const chord = [523.25, 659.25, 783.99, 987.77, 1174.66]; // C5 E5 G5 B5 D6
        chord.forEach((f, i) => {
            this._kalimba(f, { delay: i * 0.055, dur: 0.36, gain: 0.13 });
        });
    }

    /**
     * Ligne / colonne / bloc 3x3 complété : arpège ascendant lumineux
     * (plus riche si 2 ou 3 unités sont complétées d'un seul coup !).
     */
    playUnitComplete(count = 1, extraDelay = 0) {
        if (!this._ready()) return;
        const notes = [523.25, 659.25, 783.99, 1046.50, 1174.66, 1318.51, 1567.98];
        const total = Math.min(notes.length, 3 + count * 2);
        for (let i = 0; i < total; i++) {
            const d = 0.08 + extraDelay + i * 0.055;
            this._marimba(notes[i], { delay: d, dur: 0.34, gain: 0.15 });
            if (i >= total - 2) {
                this._kalimba(notes[i], { delay: d + 0.01, dur: 0.45, gain: 0.09 });
            }
        }
    }

    /** Les 9 exemplaires d'un chiffre sont posés : carillon cristallin à deux voix. */
    playDigitDone() {
        if (!this._ready()) return;
        this._kalimba(783.99, { delay: 0.08, dur: 0.35, gain: 0.13 });
        this._kalimba(1046.50, { delay: 0.15, dur: 0.42, gain: 0.14 });
        this._kalimba(1567.98, { delay: 0.22, dur: 0.50, gain: 0.11 });
    }

    /** Pause (descendant apaisant) / Reprise (montant). */
    playPause(paused) {
        if (!this._ready()) return;
        const seq = paused ? [523.25, 392.00] : [392.00, 523.25];
        seq.forEach((f, i) => {
            this._marimba(f, { delay: i * 0.065, dur: 0.18, gain: 0.1 });
        });
    }

    /** Nouvelle partie : souffle aérien + accord d'ouverture en bois chaud. */
    playNewGame() {
        if (!this._ready()) return;
        this._noise({ dur: 0.22, gain: 0.045, from: 500, to: 2200, q: 1.0 });
        [392.00, 440.00, 523.25, 659.25].forEach((f, i) => {
            this._marimba(f, { delay: 0.05 + i * 0.055, dur: 0.26, gain: 0.11 });
        });
    }

    /** Seconde chance : montée harmonique encourageante. */
    playSecondChance() {
        if (!this._ready()) return;
        [349.23, 440.00, 523.25, 698.46].forEach((f, i) => {
            this._kalimba(f, { delay: i * 0.075, dur: 0.32, gain: 0.14 });
        });
    }

    /** Partie terminée : descente douce et mélancolique au marimba. */
    playGameOver(delay = 0.25) {
        if (!this._ready()) return;
        [440.00, 392.00, 349.23, 293.66].forEach((f, i) => {
            this._marimba(f, { delay: delay + i * 0.16, dur: 0.38, gain: 0.15 });
        });
    }

    /** Victoire : fanfare polyphonique chaleureuse (Marimba + Kalimba + Accord Maj9). */
    playVictory() {
        if (!this._ready()) return;
        // Arpège d'ouverture
        const run = [523.25, 659.25, 783.99, 1046.50, 1174.66, 1318.51];
        run.forEach((f, i) => {
            this._marimba(f, { delay: i * 0.085, dur: 0.36, gain: 0.17 });
        });

        // Grand accord lumineux final (C Major 9)
        const finalChord = [261.63, 523.25, 659.25, 783.99, 987.77, 1567.98];
        finalChord.forEach((f, i) => {
            this._kalimba(f, { delay: 0.56 + i * 0.02, dur: 1.25, gain: 0.11 });
        });
    }

    /** Déblocage d'un trophée ou passage de niveau : jingle cristallin doré. */
    playAchievement() {
        if (!this._ready()) return;
        const notes = [587.33, 783.99, 987.77, 1174.66, 1567.98]; // D5 G5 B5 D6 G6
        notes.forEach((f, i) => {
            this._kalimba(f, { delay: i * 0.065, dur: 0.48, gain: 0.14 });
        });
    }
}
