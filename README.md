# RUBIX

**Rubix** is an arcade-style Rubik's cube solver game with a cyberpunk / sci-fi theme.
Built with pure HTML5 Canvas + vanilla JavaScript — no external libraries, no assets.

## How to play

1. Tap / click anywhere, or press any key, on the title screen to start.
2. The cube is shuffled. Both vertical and horizontal views start at an angular 35° view for clear 3D perspective. Rotate the slices using dynamic click-and-drag or the on-screen buttons:
   - **Click & drag on any cubie face**:
     - Drag vertically (up or down) to rotate the corresponding vertical slice in that direction.
     - Drag horizontally (left or right) to rotate the corresponding horizontal slice in that direction.
   - **Buttons** (or keyboard):
     - **Top buttons (L / M / R)** — rotate vertical slices.
     - **Right buttons (U / M / D)** — rotate horizontal slices.
3. Inspect the cube:
   - **Click & drag on empty background** — freely orbit camera yaw and pitch.
   - **Sliders** — vertical view rotation (left) and horizontal view rotation (bottom).
4. Bottom buttons:
   - **RESET VIEW** — snap the view back to the default angular view (35°, 35°).
   - **SHUFFLE** — new scramble; timer and move counter reset to zero.
   - **QUIT** — abandon the run (no score) and return to the menu.
5. The timer starts on your first move. Solve all six faces to finish —
   you'll see your moves, your time, and any new records (records persist in `localStorage`).

## Controls

| Action | Mouse / touch | Keyboard |
|---|---|---|
| Start / play again | Tap anywhere | Any key |
| Rotate a slice | Click/touch and drag any cubie on the cube in the direction of the turn (up/down/left/right) or tap a slice button | Arrows to focus a button, **Enter / Space** to press |
| Rotate view | Drag empty background or drag sliders | Focus a slider (arrows), then **←/→** adjusts bottom slider, **↑/↓** adjusts left slider (15° steps) |
| Reset view / shuffle / quit | Tap the button | Focus with arrows, **Enter / Space** |

