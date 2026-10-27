/**
 * Cloudflare Pages Function — /api/sync
 * Synchronisation temps réel (Mobile <-> PC) par Pseudo + Code PIN.
 *
 * Architecture Zéro-Quota KV :
 *  - Les échanges temps réel (chaque chiffre posé + polling) passent par la RAM du Worker
 *    (`memoryStore`) ET par le Cache Edge Cloudflare (`caches.default`) partagé sur le PoP :
 *    => 0 lecture KV et 0 écriture KV pendant le jeu en direct !
 *  - Cloudflare KV (`env.SUDOKU_KV`) n'est sollicité qu'en sauvegarde de sécurité longue durée
 *    (au démarrage à froid si le cache Edge est vide, à la fermeture de l'app, ou toutes les 10 min).
 */

const CORS_HEADERS = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

// Intervalle minimum entre deux écritures de secours sur Cloudflare KV (10 minutes)
const KV_CHECKPOINT_INTERVAL_MS = 10 * 60 * 1000;

// Cache mémoire d'instance Worker (0 ms, 0 quota)
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

function buildEdgeCacheRequest(kvKey) {
    return new Request(`https://sudoku-live-edge.internal/${encodeURIComponent(kvKey)}`, {
        method: 'GET'
    });
}

async function readEdgeCache(kvKey) {
    try {
        if (typeof caches === 'undefined' || !caches.default) return null;
        const res = await caches.default.match(buildEdgeCacheRequest(kvKey));
        if (!res) return null;
        return await res.json();
    } catch (_) {
        return null;
    }
}

async function writeEdgeCache(kvKey, record) {
    try {
        if (typeof caches === 'undefined' || !caches.default) return;
        const res = new Response(JSON.stringify(record), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=86400'
            }
        });
        await caches.default.put(buildEdgeCacheRequest(kvKey), res);
    } catch (_) {}
}

/**
 * Récupère l'état du joueur depuis :
 * 1) La RAM Worker (`memoryStore`) — 0 opération KV
 * 2) Le Cache Edge Cloudflare (`caches.default`) — 0 opération KV
 * 3) Cloudflare KV (`env.SUDOKU_KV`) UNIQUEMENT si le cache temps réel est vide ET `allowKvRead === true`
 */
async function getPlayerRecord(kvKey, env, allowKvRead = false) {
    const memRecord = memoryStore.get(kvKey) || null;
    const edgeRecord = await readEdgeCache(kvKey);

    let latest = null;
    if (memRecord && edgeRecord) {
        latest = (memRecord.rev || 0) >= (edgeRecord.rev || 0) ? memRecord : edgeRecord;
    } else {
        latest = memRecord || edgeRecord;
    }

    if (latest) {
        memoryStore.set(kvKey, latest);
        return latest;
    }

    // Lecture KV uniquement au tout premier démarrage à froid quand ni la RAM ni l'Edge Cache n'ont le profil
    if (allowKvRead && env && env.SUDOKU_KV) {
        try {
            const kvRaw = await env.SUDOKU_KV.get(kvKey);
            if (kvRaw) {
                const kvRecord = JSON.parse(kvRaw);
                kvRecord.lastKvWriteAt = kvRecord.lastKvWriteAt || Date.now();
                memoryStore.set(kvKey, kvRecord);
                await writeEdgeCache(kvKey, kvRecord);
                return kvRecord;
            }
        } catch (_) {}
    }

    return null;
}

export async function onRequestOptions() {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
    const { request, env } = context;

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
        // Lecture KV de secours autorisée uniquement si RAM + Edge Cache sont vides (coldStart, load ou 1er save)
        const allowKvFallback = Boolean(body.coldStart) || action === 'load' || action === 'save';
        const existing = await getPlayerRecord(kvKey, env, allowKvFallback);

        // Vérification du code PIN si le profil existe déjà
        if (existing && existing.pinHash && existing.pinHash !== pinHash) {
            return jsonResponse({
                ok: false,
                code: 'WRONG_PIN',
                error: 'Code PIN incorrect pour ce pseudo.'
            }, 403);
        }

        // Action 'poll' : 100% RAM / Edge Cache (0 lecture KV !)
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

        // Action 'save' : écriture instantanée dans RAM + Edge Cache (0 écriture KV sauf checkpoint espacé)
        if (!body.bundle || typeof body.bundle !== 'object') {
            return jsonResponse({ ok: false, error: 'Données de sauvegarde manquantes.' }, 400);
        }

        const now = Date.now();
        const prevRev = existing && existing.rev ? Number(existing.rev) : 0;
        const incomingRev = Number(body.rev) || now;
        const rev = Math.max(now, prevRev + 1, incomingRev);
        const updatedAt = new Date(rev).toISOString();
        const lastKvWriteAt = (existing && existing.lastKvWriteAt) ? Number(existing.lastKvWriteAt) : 0;

        const shouldPersistToKv = Boolean(body.checkpoint) || (now - lastKvWriteAt >= KV_CHECKPOINT_INTERVAL_MS);

        const record = {
            pseudoSlug,
            pinHash,
            rev,
            deviceId: body.deviceId || '',
            updatedAt,
            lastKvWriteAt: shouldPersistToKv ? now : lastKvWriteAt,
            bundle: body.bundle
        };

        // 1. Temps réel gratuit et illimité (RAM + Edge Cache Cloudflare)
        memoryStore.set(kvKey, record);
        await writeEdgeCache(kvKey, record);

        // 2. Sauvegarde permanente sur KV uniquement lors d'un checkpoint ou toutes les 10 minutes
        if (shouldPersistToKv && env && env.SUDOKU_KV) {
            await env.SUDOKU_KV.put(kvKey, JSON.stringify(record));
        }

        return jsonResponse({
            ok: true,
            rev,
            updatedAt,
            kvPersisted: shouldPersistToKv
        });
    } catch (err) {
        return jsonResponse({
            ok: false,
            error: 'Erreur interne lors de la synchronisation.'
        }, 500);
    }
}
