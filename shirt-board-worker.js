// ===== Shirt Bounty Board - online leaderboard (Cloudflare Worker) =====
// Free to run. About 10 minutes to set up, once:
//
//  1. Make a free account at https://dash.cloudflare.com
//  2. Workers & Pages -> Create -> Create Worker -> name it "ntb-shirts" -> Deploy
//  3. Edit code -> replace everything with this file -> Deploy
//  4. Storage & Databases -> KV -> Create a namespace called "SHIRTS"
//  5. Back in the worker: Settings -> Bindings -> Add -> KV namespace,
//     variable name SHIRTS, pick the namespace -> Deploy
//  6. Copy the worker's URL (like https://ntb-shirts.yourname.workers.dev)
//     and paste it into SHIRT_BOARD_API at the top of shirt-board.js
//
// Endpoints:
//   GET  /shirt/:id          -> { id, owner: {name,best,time,assisted}|null, board: [...], plays }
//   POST /shirt/:id/claim    { name }                         -> { token }
//   POST /shirt/:id/score    { name, best, time, assisted, token? } -> same as GET

const ALLOWED_ORIGINS = ['*']; // tighten to ['https://notthebest.in'] once it works

function cors(req) {
  const origin = req.headers.get('Origin') || '*';
  const allow = ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

const json = (req, body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', ...cors(req) }
});

const cleanName = s => String(s || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
const better = (a, b) => (a.best - b.best) || ((b.assisted ? 1 : 0) - (a.assisted ? 1 : 0)) || ((b.time || 1e9) - (a.time || 1e9));

function publicView(s) {
  return {
    id: s.id,
    owner: s.owner ? { name: s.owner.name, best: s.owner.best, time: s.owner.time, assisted: !!s.owner.assisted } : null,
    board: s.board.slice(0, 20),
    plays: s.plays || 0
  };
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });
    const url = new URL(req.url);
    const m = url.pathname.match(/^\/shirt\/([A-Z0-9]{4,10})(?:\/(claim|score))?$/i);
    if (!m) return json(req, { error: 'not found' }, 404);
    const id = m[1].toUpperCase();
    const action = m[2];
    const key = 'shirt:' + id;
    const s = (await env.SHIRTS.get(key, 'json')) || { id, owner: null, board: [], plays: 0 };

    if (req.method === 'GET' && !action) return json(req, publicView(s));
    if (req.method !== 'POST') return json(req, { error: 'method' }, 405);

    let body;
    try { body = await req.json(); } catch (e) { return json(req, { error: 'bad json' }, 400); }

    if (action === 'claim') {
      if (s.owner) return json(req, { error: 'already claimed' }, 409);
      const name = cleanName(body.name);
      if (!name) return json(req, { error: 'name required' }, 400);
      const token = crypto.randomUUID();
      s.owner = { name, best: 0, time: 0, assisted: false, token };
      await env.SHIRTS.put(key, JSON.stringify(s));
      return json(req, { token });
    }

    if (action === 'score') {
      const entry = {
        name: cleanName(body.name),
        best: Math.max(1, Math.min(9, parseInt(body.best, 10) || 0)),
        time: Math.max(0, Math.min(36000, parseInt(body.time, 10) || 0)),
        assisted: !!body.assisted
      };
      if (!entry.name) return json(req, { error: 'name required' }, 400);
      if (s.owner && body.token && body.token === s.owner.token) {
        if (better(entry, s.owner) > 0) Object.assign(s.owner, { best: entry.best, time: entry.time, assisted: entry.assisted });
      } else {
        s.plays = (s.plays || 0) + 1; // only challengers count, not the owner
        const mine = s.board.find(r => r.name.toLowerCase() === entry.name.toLowerCase());
        if (!mine) s.board.push({ ...entry, at: Date.now() });
        else if (better(entry, mine) > 0) Object.assign(mine, entry, { at: Date.now() });
        s.board.sort((a, b) => better(b, a));
        s.board = s.board.slice(0, 50);
      }
      await env.SHIRTS.put(key, JSON.stringify(s));
      return json(req, publicView(s));
    }
    return json(req, { error: 'not found' }, 404);
  }
};
