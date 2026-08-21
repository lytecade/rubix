# RUBIX

**Rubix** is an arcade-style Rubik's cube solver game with a cyberpunk / sci-fi theme.
Built with pure HTML5 Canvas + vanilla JavaScript — no external libraries, no assets.
The entire game is rendered in the **Arne16** 16-color palette.

## Run it

Open `index.html` directly in any modern browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

Works on desktop and mobile.

## How to play

1. Tap / click anywhere, or press any key, on the title screen to start.
2. The cube is shuffled. Rotate the slices using the buttons:
   - **Top buttons (L / M / R)** — rotate the left, middle, or right **vertical** slice clockwise.
   - **Right buttons (U / M / D)** — rotate the top, middle, or bottom **horizontal** slice clockwise.
   - (No counter-clockwise moves — three clockwise turns equal one counter-clockwise turn.)
3. Inspect the cube with the sliders:
   - **Left slider** — vertical view rotation, full 360°.
   - **Bottom slider** — horizontal view rotation, full 360°.
4. Bottom buttons:
   - **RESET VIEW** — snap the view back to the front face (0°, 0°).
   - **SHUFFLE** — new scramble; timer and move counter reset to zero.
   - **QUIT** — abandon the run (no score) and return to the menu.
5. The timer starts on your first move. Solve all six faces to finish —
   you'll see your moves, your time, and any new records (records persist in `localStorage`).

## Controls

| Action | Mouse / touch | Keyboard |
|---|---|---|
| Start / play again | Tap | Any key |
| Rotate a slice | Tap its button | Arrows to focus a button, **Enter / Space** to press |
| Rotate view | Tap or drag the sliders | Focus a slider (arrows), then **←/→** adjusts the bottom slider, **↑/↓** adjusts the left slider (15° steps) |
| Reset view / shuffle / quit | Tap the button | Focus with arrows, **Enter / Space** |

## Files

| File | Purpose |
|---|---|
| `index.html` | Page shell, centered square canvas, mobile viewport meta |
| `game.js` | Entire game: 3D math, cube logic, rendering, input, screens |
| `README.md` | This file |

## Tech notes

- **3D engine**: hand-rolled quaternion math, per-cubie transforms, perspective
  projection, backface culling and painter's-algorithm depth sorting on a 2D canvas.
- **Square canvas**: 800×800 logical units, scaled to `min(vw, vh)` with
  `devicePixelRatio` backing store for crisp, high-quality graphics.
- **Palette (Arne16)**: `#000000 #9D9D9D #FFFFFF #BE2633 #E06F8B #493C2B #A46422
  #EB8931 #F7E26B #2F484E #44891A #A3CE27 #1B2632 #005784 #31A2F2 #B2DCEF` —
  these 16 hex codes are the only colors used anywhere (shading picks the
  nearest palette entry so every rendered fill stays inside the palette).
