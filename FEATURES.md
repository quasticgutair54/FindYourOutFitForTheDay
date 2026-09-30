# Add-on features

Ten features layered on top of the original site. Each one lives in its own
file and only *wraps* the original game functions, so `index.html` itself
barely changed (it just loads the new scripts at the bottom). If any add-on
fails to load, the original game still works.

| # | Feature | Files |
|---|---------|-------|
| 1 | **Lie detector**: quiz answers secretly map to personalities; a hold-to-scan polygraph on the result page says whether you picked the right path | `quiz-judge.js`, `quiz-common.js/.css` |
| 2 | **Narrator 2.0**: the prompt MP3s now play, plus SYSTEM, a heckler that roasts how you actually play | `narrator.js` |
| 3 | **Shirt bounty board**: each shirt's QR carries an ID; strangers who scan it race the owner | `shirt-board.js`, `shirt-board-worker.js`, `shirt-codes.html` |
| 4 | **Fitting-room scanner**: scanning any real NotTheBest shirt unlocks secret Level 9 (THE CLOSET) and the Tailor-Made ship | `fitting-room.js` |
| 5 | **Two Sides split screen**: answer for the side you show and the side you hide | `twosides.js` |
| 6 | **The dossier**: the site remembers visitors and holds grudges | `dossier.js` |
| 7 | **The vault**: flawless RANDOMODIUM opens a combination vault and a golden ticket | `vault.js` |
| 8 | **Fake crash**: battery / cracked screen / offline prank before the final level | `fake-crash.js` |
| 9 | **Duel mode**: two phones, peer-to-peer, attacks fly between them | `duel.js` |
| 10 | **Scratch card**: scratch off the outfit reveal, numbered certificate, shareable image | `scratch-card.js` |

Third-party libraries are bundled in `vendor/` (no CDN needed):
qrcode-generator (MIT), jsQR (Apache-2.0), PeerJS (MIT).

## Settings to fill in

1. **Online leaderboards (feature 3).** Until this is set, shirt scores only
   live on the phone that played. Deploy `shirt-board-worker.js` as a free
   Cloudflare Worker (steps are at the top of that file), then paste its URL
   into `SHIRT_BOARD_API` at the top of `shirt-board.js`.
2. **Vault prize (feature 7).** At the top of `vault.js`, set
   `VAULT_REWARD.code` (a real single-use or limited discount code from your
   store) and `label`. Leave it empty to show "screenshot this and show us".
3. **Two voice clips (feature 2).** `prompt13.mp3` and `prompt31.mp3` look
   like the wrong recordings (by length), so they're muted in `VOICE_SKIP` at
   the top of `narrator.js`. Check them in `prompt-review.html`.

## Printing shirt QR codes

Open `shirt-codes.html`, set the site address, pick how many, then print or
download the ID list. Each code looks like `index.html?shirt=7K3QX`.

## Notes

- The camera (feature 4) only works on https.
- Scores, the dossier and the vault all run on the player's phone, so a
  determined cheater can fake them. Keep prizes small or single-use.
- Everything the dossier remembers stays in the player's browser storage;
  nothing is sent anywhere. "Shred my file" wipes it.
