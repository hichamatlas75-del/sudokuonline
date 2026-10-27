/**
 * Cloudflare Pages Function — /api/sync
 * Synchronisation temps réel (Mobile <-> PC) par Pseudo + Code PIN via Cloudflare Workers KV.
 *
 * Liaison KV dans Cloudflare Pages :
 *   Settings -> Bindings -> KV namespace -> Variable name : SUDOKU_KV
 */

const CORS_HEADERS = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

// Cache mémoire d'instance Worker pour une latence < 20ms entre appareils sur le même PoP
const memoryStore = globalThis.__SUDOKU_LIVE_STORE || (globalThis.__SUDOKU_LIVE_STORE = new Map());

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

export async function onRequestOptions() {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
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

    const action = body.action || 'save'; // 'save' | 'load' | 'poll'
    const pseudoSlug = normalizePseudo(body.pseudo || 'hicham');
    const pin = String(body.pin || '1234').trim();

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
        // Lecture combinée : mémoire Worker + Cloudflare KV (on garde la révision la plus récente)
        const memRecord = memoryStore.get(kvKey) || null;
        const kvRaw = await env.SUDOKU_KV.get(kvKey);
        const kvRecord = kvRaw ? JSON.parse(kvRaw) : null;

        let existing = null;
        if (memRecord && kvRecord) {
            existing = (memRecord.rev || 0) >= (kvRecord.rev || 0) ? memRecord : kvRecord;
        } else {
            existing = memRecord || kvRecord;
        }

        if (existing) {
            memoryStore.set(kvKey, existing);
        }

        // Vérification du code PIN si le profil existe déjà
        if (existing && existing.pinHash && existing.pinHash !== pinHash) {
            return jsonResponse({
                ok: false,
                code: 'WRONG_PIN',
                error: 'Code PIN incorrect pour ce pseudo.'
            }, 403);
        }

        // Action 'poll' : ultra-légère pour le temps réel Mobile <-> PC
        if (action === 'poll') {
            if (!existing || !existing.bundle) {
                return jsonResponse({
                    ok: true,
                    changed: false,
                    empty: true,
                    rev: 0
                });
            }
            const sinceRev = Number(body.sinceRev) || 0;
            const remoteRev = Number(existing.rev) || 0;
            const sameDevice = body.deviceId && existing.deviceId === body.deviceId;

            if (remoteRev > sinceRev && !sameDevice) {
                return jsonResponse({
                    ok: true,
                    changed: true,
                    rev: remoteRev,
                    deviceId: existing.deviceId || '',
                    updatedAt: existing.updatedAt,
                    bundle: existing.bundle
                });
            }

            return jsonResponse({
                ok: true,
                changed: false,
                rev: remoteRev
            });
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
                rev: existing.rev || Date.now(),
                updatedAt: existing.updatedAt,
                bundle: existing.bundle
            });
        }

        // Action 'save' : enregistrement instantané d'un coup joué
        if (!body.bundle || typeof body.bundle !== 'object') {
            return jsonResponse({ ok: false, error: 'Données de sauvegarde manquantes.' }, 400);
        }

        const now = Date.now();
        const prevRev = existing && existing.rev ? Number(existing.rev) : 0;
        const incomingRev = Number(body.rev) || now;
        const rev = Math.max(now, prevRev + 1, incomingRev);
        const updatedAt = new Date(rev).toISOString();

        const record = {
            pseudoSlug,
            pinHash,
            rev,
            deviceId: body.deviceId || '',
            updatedAt,
            bundle: body.bundle
        };

        memoryStore.set(kvKey, record);
        await env.SUDOKU_KV.put(kvKey, JSON.stringify(record));

        return jsonResponse({
            ok: true,
            rev,
            updatedAt
        });
    } catch (err) {
        return jsonResponse({
            ok: false,
            error: 'Erreur interne lors de l\'accès à Cloudflare KV.'
        }, 500);
    }
}
