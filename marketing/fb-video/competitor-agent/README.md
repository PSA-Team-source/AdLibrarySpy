# Competitor ads agent (16:9, 17s)

The same format as a TrendTrack-based "competitor ads agent" X video, remade for AdLibrarySpy using only real product data (comfrt.com captures from 2026-09-27; sources in ../homepage.json).
AdLibrarySpy does not generate creatives or publish to Meta, so step 02/03 are "find what sells" and "track every move", not recreate + push to Meta.

Re-render: put the captures in `img/` (lib_0..15, products, brandtracker, liveads from `../home/.work/cap`), then `FFMPEG=<ffmpeg-static> node render.mjs` (or `node render.mjs 5.7 12` for stills).
