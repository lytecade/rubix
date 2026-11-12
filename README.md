# RUBIX

**Rubix** is an arcade-style Rubik's cube solver game with a cyberpunk / sci-fi theme.
Built with pure HTML5 Canvas + vanilla JavaScript — no external libraries, no assets.

## How to play

1. Tap / click anywhere on the title screen to start.
2. The cube is shuffled. Both vertical and horizontal views start at an angular 35° view for clear 3D perspective. Rotate slices using touch or click-and-drag directly on the cube:
   - **Touch / click & drag on any cubie face**:
     - Drag in the direction you want that row or column to rotate (up, down, left, or right) to turn the corresponding slice.
3. Inspect the cube:
   - **Touch / click & drag on empty background** — freely orbit camera yaw and pitch.
   - **Sliders** — vertical view rotation (left) and horizontal view rotation (bottom).
4. Action buttons:
   - **RESET VIEW** — snap the view back to the default angular view (35°, 35°).
   - **SHUFFLE** — new scramble; timer and move counter reset to zero.
   - **QUIT** — abandon the run (no score) and return to the menu.
5. The timer starts on your first move. Solve all six faces to finish —
   you'll see your moves, your time, and any new records (records persist in `localStorage`).

## Controls

| Action | Touch / Mouse |
|---|---|
| Start / play again | Tap / click anywhere |
| Rotate a slice | Touch / click and drag any cubie face on the cube in the direction of the turn |
| Rotate view | Drag empty background or drag the vertical / horizontal view sliders |
| Reset view / shuffle / quit | Tap / click the button |

