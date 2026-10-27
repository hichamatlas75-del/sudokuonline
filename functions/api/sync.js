/**
 * Cloudflare Pages Function — /api/sync
 * Sauvegarde et synchronisation du profil et de la partie Sudoku via Cloudflare Workers KV.
 *
 * Liaison KV requise dans Cloudflare Pages :
 *   Settings -> Functions -> KV namespace bindings -> Variable name : SUDOKU_KV
 */

const CORS_HEADERS = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
};

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: CORS_HEADERS
    });
}

function normalizePseudo(pseudo) {
    return String(pseudo || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9_-]/g, '');
}

function isValidPin(pin) {
    return /^[0-9]{4}$/.test(String(pin || '').trim());
}

async function hashPin(pseudoSlug, pin) {
    const encoder = new TextEncoder();
    const raw = `sudoku-kv-v1:${pseudoSlug}:${String(pin).trim()}`;
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(raw));
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

export async function onRequestPost(context) {
    const { request, env } = context;

    if (!env || !env.SUDOKU_KV) {
        return jsonResponse({
            ok: false,
            code: 'KV_NOT_BOUND',
            error: 'Le namespace Cloudflare KV "SUDOKU_KV" n\'est pas encore lié au projet Cloudflare Pages.'
        }, 503);
    }

    let body;
    try {
        body = await request.json();
    } catch (_) {
        return jsonResponse({ ok: false, error: 'Corps JSON invalide.' }, 400);
    }

    const action = body.action || 'save'; // 'save' | 'load'
    const pseudoSlug = normalizePseudo(body.pseudo);
    const pin = String(body.pin || '').trim();

    if (!pseudoSlug || pseudoSlug.length < 2) {
        return jsonResponse({
            ok: false,
            error: 'Veuillez saisir un pseudo d\'au moins 2 caractères.'
        }, 400);
    }

    if (!isValidPin(pin)) {
        return jsonResponse({
            ok: false,
            error: 'Le code PIN doit comporter exactement 4 chiffres (ex: 1234).'
        }, 400);
    }

    const kvKey = `player:${pseudoSlug}`;
    const pinHash = await hashPin(pseudoSlug, pin);

    try {
        const existingRaw = await env.SUDOKU_KV.get(kvKey);
        const existing = existingRaw ? JSON.parse(existingRaw) : null;

        // Si le profil existe déjà, vérifier que le code PIN correspond
        if (existing && existing.pinHash && existing.pinHash !== pinHash) {
            return jsonResponse({
                ok: false,
                code: 'WRONG_PIN',
                error: 'Code PIN incorrect pour ce pseudo.'
            }, 403);
        }

        if (action === 'load') {
            if (!existing || !existing.bundle) {
                return jsonResponse({
                    ok: false,
                    code: 'NOT_FOUND',
                    error: 'Aucune sauvegarde trouvée pour ce pseudo.'
                }, 404);
            }
            return jsonResponse({
                ok: true,
                updatedAt: existing.updatedAt,
                bundle: existing.bundle
            });
        }

        // Action 'save'
        if (!body.bundle || typeof body.bundle !== 'object') {
            return jsonResponse({ ok: false, error: 'Données de sauvegarde manquantes.' }, 400);
        }

        const updatedAt = new Date().toISOString();
        const record = {
            pseudoSlug,
            pinHash,
            updatedAt,
            bundle: body.bundle
        };

        await env.SUDOKU_KV.put(kvKey, JSON.stringify(record));

        return jsonResponse({
            ok: true,
            updatedAt
        });
    } catch (err) {
        return jsonResponse({
            ok: false,
            error: 'Erreur interne lors de l\'accès à Cloudflare KV.'
        }, 500);
    }
}
