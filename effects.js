/**
 * Sudoku - Moteur d'effets visuels & Micro-interactions ("Game Juice")
 * Inclut : onde de choc (ripple), éclats de particules (sparkles/géométrie),
 * points flottants avec badge de combo, compteur animé et confettis 3D.
 * Tout est automatiquement désactivé si SudokuFX.enabled === false.
 */
const SudokuFX = {
    enabled: true,
    _canvas: null,
    _ctx: null,
    _particles: [],
    _rings: [],
    _rafId: null,

    /** Initialise à la volée le canvas d'effets plein écran (retiré dès qu'il est vide). */
    _ensureCanvas() {
        if (!this._canvas) {
            this._canvas = document.createElement('canvas');
            this._canvas.className = 'confetti-canvas';
            document.body.appendChild(this._canvas);
            this._ctx = this._canvas.getContext('2d');
        }
        const dpr = window.devicePixelRatio || 1;
        const w = window.innerWidth;
        const h = window.innerHeight;
        if (this._canvas.width !== w * dpr || this._canvas.height !== h * dpr) {
            this._canvas.width = w * dpr;
            this._canvas.height = h * dpr;
            this._canvas.style.width = `${w}px`;
            this._canvas.style.height = `${h}px`;
        }
        return { ctx: this._ctx, dpr, w, h };
    },

    _scheduleLoop() {
        if (this._rafId) return;
        const tick = () => {
            if (!this.enabled || (this._particles.length === 0 && this._rings.length === 0)) {
                this._rafId = null;
                if (this._canvas) {
                    this._canvas.remove();
                    this._canvas = null;
                    this._ctx = null;
                }
                return;
            }
            const { ctx, dpr, w, h } = this._ensureCanvas();
            ctx.save();
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, w, h);

            // 1. Ondes de choc circulaires (Ripples)
            for (let i = this._rings.length - 1; i >= 0; i--) {
                const r = this._rings[i];
                r.progress += r.speed;
                if (r.progress >= 1) {
                    this._rings.splice(i, 1);
                    continue;
                }
                const ease = 1 - Math.pow(1 - r.progress, 3);
                const radius = r.minR + (r.maxR - r.minR) * ease;
                const alpha = (1 - r.progress) * r.alpha;

                ctx.save();
                ctx.beginPath();
                ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
                ctx.strokeStyle = r.color;
                ctx.globalAlpha = Math.max(0, alpha);
                ctx.lineWidth = Math.max(1, r.lineWidth * (1 - r.progress * 0.65));
                ctx.stroke();
                ctx.restore();
            }

            // 2. Particules (étoiles, losanges, cercles, confettis 3D)
            for (let i = this._particles.length - 1; i >= 0; i--) {
                const p = this._particles[i];
                p.vy += p.gravity;
                p.vx *= p.drag;
                p.vy *= p.drag;
                p.x += p.vx;
                p.y += p.vy;
                p.rot += p.vr;
                p.tilt += p.vt;
                p.life -= p.decay;

                if (p.life <= 0 || p.y > h + 60) {
                    this._particles.splice(i, 1);
                    continue;
                }

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
                ctx.fillStyle = p.color;

                const s = p.size * (p.shrink ? Math.max(0.2, p.life) : 1);
                if (p.shape === 'circle') {
                    ctx.beginPath();
                    ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
                    ctx.fill();
                } else if (p.shape === 'diamond') {
                    ctx.beginPath();
                    ctx.moveTo(0, -s * 0.65);
                    ctx.lineTo(s * 0.65, 0);
                    ctx.lineTo(0, s * 0.65);
                    ctx.lineTo(-s * 0.65, 0);
                    ctx.closePath();
                    ctx.fill();
                } else if (p.shape === 'star') {
                    this._drawStar(ctx, 0, 0, 4, s * 0.75, s * 0.28);
                } else {
                    // Ruban 3D avec bascule (confetti)
                    const scaleY = Math.cos(p.tilt);
                    ctx.scale(1, scaleY);
                    ctx.fillRect(-s / 2, -s / 3, s, s * 0.66);
                }
                ctx.restore();
            }

            ctx.restore();
            this._rafId = requestAnimationFrame(tick);
        };
        this._rafId = requestAnimationFrame(tick);
    },

    _drawStar(ctx, cx, cy, spikes, outerR, innerR) {
        let rot = (Math.PI / 2) * 3;
        const step = Math.PI / spikes;
        ctx.beginPath();
        ctx.moveTo(cx, cy - outerR);
        for (let i = 0; i < spikes; i++) {
            ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
            rot += step;
            ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
            rot += step;
        }
        ctx.closePath();
        ctx.fill();
    },

    /**
     * Onde de choc circulaire (Ripple) centrée sur un élément du DOM.
     */
    ripple(anchorEl, { color = '#3b82f6', maxRadius = 46, lineWidth = 3, speed = 0.045 } = {}) {
        if (!this.enabled || !anchorEl) return;
        const rect = anchorEl.getBoundingClientRect();
        this._rings.push({
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            minR: Math.min(rect.width, rect.height) * 0.2,
            maxR: maxRadius,
            lineWidth,
            color,
            alpha: 0.65,
            progress: 0,
            speed
        });
        this._scheduleLoop();
    },

    /**
     * Éclat de particules autour d'une cellule ou d'un bouton.
     */
    burst(anchorEl, {
        count = 14,
        colors = ['#0072e3', '#38bdf8', '#f59e0b', '#22c55e', '#a855f7'],
        speed = 4.2,
        size = 6
    } = {}) {
        if (!this.enabled || !anchorEl) return;
        const rect = anchorEl.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const shapes = ['circle', 'diamond', 'star'];

        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
            const v = speed * (0.55 + Math.random() * 0.75);
            this._particles.push({
                x: cx,
                y: cy,
                vx: Math.cos(angle) * v,
                vy: Math.sin(angle) * v - 0.8,
                gravity: 0.12,
                drag: 0.96,
                size: size * (0.75 + Math.random() * 0.5),
                rot: Math.random() * Math.PI * 2,
                vr: (Math.random() - 0.5) * 0.18,
                tilt: 0,
                vt: 0,
                life: 1,
                decay: 0.024 + Math.random() * 0.015,
                shrink: true,
                color: colors[i % colors.length],
                shape: shapes[i % shapes.length]
            });
        }
        this._scheduleLoop();
    },

    /**
     * Affiche un texte flottant (ex. « +120 » et badge « 🔥 ×3 ») au-dessus d'une cellule.
     */
    floatText(container, anchorEl, text, extraClass = '', subBadge = '') {
        if (!this.enabled || !container || !anchorEl) return;
        const cRect = container.getBoundingClientRect();
        const aRect = anchorEl.getBoundingClientRect();
        const el = document.createElement('div');
        el.className = `float-score ${extraClass}`.trim();

        const mainSpan = document.createElement('span');
        mainSpan.textContent = text;
        el.appendChild(mainSpan);

        if (subBadge) {
            const badge = document.createElement('span');
            badge.className = 'float-combo-pill';
            badge.textContent = subBadge;
            el.appendChild(badge);
        }

        el.style.left = `${aRect.left - cRect.left + aRect.width / 2}px`;
        el.style.top = `${aRect.top - cRect.top + aRect.height * 0.15}px`;
        container.appendChild(el);
        el.addEventListener('animationend', () => el.remove());
        setTimeout(() => el.remove(), 1400);
    },

    /** Fait défiler un nombre de 0 à `target` (utilisé pour le score de victoire). */
    countUp(el, target, duration = 900, format = (v) => String(v)) {
        if (!el) return;
        if (!this.enabled) {
            el.textContent = format(target);
            return;
        }
        const start = performance.now();
        const step = (now) => {
            const p = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = format(Math.round(target * eased));
            if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    },

    /** Pluie de confettis 3D sur tout l'écran lors de la victoire. */
    confetti() {
        if (!this.enabled) return;
        const w = window.innerWidth;
        const h = window.innerHeight;
        const colors = ['#0072e3', '#f59e0b', '#22c55e', '#ef4444', '#a855f7', '#06b6d4', '#facc15'];
        const shapes = ['ribbon', 'ribbon', 'circle', 'star', 'diamond'];

        const spawn = (x, y, vx, vy) => {
            this._particles.push({
                x,
                y,
                vx,
                vy,
                gravity: 0.20,
                drag: 0.991,
                size: 7 + Math.random() * 6,
                rot: Math.random() * Math.PI * 2,
                vr: (Math.random() - 0.5) * 0.18,
                tilt: Math.random() * Math.PI * 2,
                vt: 0.08 + Math.random() * 0.14,
                life: 1.35 + Math.random() * 0.45,
                decay: 0.0065 + Math.random() * 0.004,
                shrink: false,
                color: colors[Math.floor(Math.random() * colors.length)],
                shape: shapes[Math.floor(Math.random() * shapes.length)]
            });
        };

        // Deux canons latéraux + pluie dorée du haut
        for (let i = 0; i < 65; i++) {
            spawn(0, h * 0.72, 4 + Math.random() * 8, -(10 + Math.random() * 9));
            spawn(w, h * 0.72, -(4 + Math.random() * 8), -(10 + Math.random() * 9));
        }
        for (let i = 0; i < 45; i++) {
            spawn(Math.random() * w, -20 - Math.random() * h * 0.25, (Math.random() - 0.5) * 2.5, 1.5 + Math.random() * 2.5);
        }

        this._scheduleLoop();
    }
};
