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

## Level upgrades (`levels-plus.js`)

Every level now marches like real Space Invaders (side to side, dropping a row at
each edge, speeding up as invaders die), with a score + saved high score and
themed bunkers that crumble where they're hit.

| Level | What's new |
|-------|-----------|
| 1 Notthebest OG | Classic 4-note heartbeat march, N·T·B·✦ bunkers, coat-hanger mystery ship (can drop a shirt = +1 life) |
| 2 Initial D | Formation drifts into turns with smoke + screech, headlights flash before a car fires, skid burn marks on bunkers |
| 3 Lorem Ipsum | Rows spell LOREM/IPSUM/DOLOR (word + sentence bonuses), "loading" skeleton panels you can't hit, typewriter carriage march |
| 4 Your Toast | Toast rises and pops out of the toasters, burnt toast patches your bunkers, butter meter |
| 5 Grapefruit x Lime | Grapefruits split into halves, juice puddles slow your ship, lemons settle as extra cover |
| 6 Cake Was A Lie | Candle countdown to a synced volley, cake collapses a layer, the last cupcake flees across the top |
| 7 Berserk | Two-hit armour (helmets fly off), red rage wave warning, sword barriers during rage, grab shields for invisibility |
| 8 RANDOMODIUM | All original chaos, plus rotating GLITCH events: mirror decoys, level glitch, HUD invaders, reverse invasion, colour lock |

Also: the game area scales to the screen, SYSTEM talks from its own slot above
the game, and the recorded voiceover on floating prompts is off
(`NARRATOR_CLIPS_ON` in `narrator.js` brings it back).

Fixed along the way: the last kill of each level now scores, and a level's
special bullets (e.g. Level 6's frosting laser) come back after a chocolate.

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
3. **Recorded voiceover (feature 2).** Currently switched off. If you turn it
   back on, note that `prompt13.mp3` and `prompt31.mp3` look like the wrong
   recordings (by length) and are muted in `VOICE_SKIP` in `narrator.js`.

## Printing shirt QR codes

Open `shirt-codes.html`, set the site address, pick how many, then print or
download the ID list. Each code looks like `index.html?shirt=7K3QX`.

## Notes

- The camera (feature 4) only works on https.
- Scores, the dossier and the vault all run on the player's phone, so a
  determined cheater can fake them. Keep prizes small or single-use.
- Everything the dossier remembers stays in the player's browser storage;
  nothing is sent anywhere. "Shred my file" wipes it.
