/**
 * Sudoku - Effets visuels (points flottants, compteur animé, confettis)
 * Tout est désactivé quand SudokuFX.enabled === false (réglage « Animations »).
 */
const SudokuFX = {
    enabled: true,

    /** Affiche un texte (ex. « +120 ») qui monte et s'efface au-dessus d'une cellule. */
    floatText(container, anchorEl, text, extraClass = '') {
        if (!this.enabled || !container || !anchorEl) return;
        const cRect = container.getBoundingClientRect();
        const aRect = anchorEl.getBoundingClientRect();
        const el = document.createElement('span');
        el.className = `float-score ${extraClass}`.trim();
        el.textContent = text;
        el.style.left = `${aRect.left - cRect.left + aRect.width / 2}px`;
        el.style.top = `${aRect.top - cRect.top + aRect.height * 0.15}px`;
        container.appendChild(el);
        el.addEventListener('animationend', () => el.remove());
        setTimeout(() => el.remove(), 1500);
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

    /** Pluie de confettis sur tout l'écran (canvas temporaire, retiré automatiquement). */
    confetti(duration = 3200) {
        if (!this.enabled) return;
        const canvas = document.createElement('canvas');
        canvas.className = 'confetti-canvas';
        const dpr = window.devicePixelRatio || 1;
        const w = window.innerWidth;
        const h = window.innerHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        document.body.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        const colors = ['#0072e3', '#f59e0b', '#22c55e', '#ef4444', '#a855f7', '#06b6d4', '#facc15'];
        const particles = [];
        const spawn = (x, y, vx, vy) => particles.push({
            x, y, vx, vy,
            size: 6 + Math.random() * 6,
            rot: Math.random() * Math.PI * 2,
            vr: (Math.random() - 0.5) * 0.4,
            color: colors[Math.floor(Math.random() * colors.length)],
            shape: Math.random() < 0.4 ? 'circle' : 'rect'
        });

        // Deux canons latéraux + pluie légère du haut
        for (let i = 0; i < 70; i++) {
            spawn(0, h * 0.75, 4 + Math.random() * 7, -(9 + Math.random() * 9));
            spawn(w, h * 0.75, -(4 + Math.random() * 7), -(9 + Math.random() * 9));
        }
        for (let i = 0; i < 50; i++) {
            spawn(Math.random() * w, -20 - Math.random() * h * 0.3, (Math.random() - 0.5) * 2, 1 + Math.random() * 2);
        }

        const t0 = performance.now();
        const frame = (now) => {
            const elapsed = now - t0;
            ctx.clearRect(0, 0, w, h);
            const fade = elapsed > duration ? Math.max(0, 1 - (elapsed - duration) / 800) : 1;
            ctx.globalAlpha = fade;
            for (const p of particles) {
                p.vy += 0.22;
                p.vx *= 0.992;
                p.x += p.vx;
                p.y += p.vy;
                p.rot += p.vr;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.fillStyle = p.color;
                if (p.shape === 'circle') {
                    ctx.beginPath();
                    ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
                }
                ctx.restore();
            }
            if (fade > 0) {
                requestAnimationFrame(frame);
            } else {
                canvas.remove();
            }
        };
        requestAnimationFrame(frame);
    }
};
