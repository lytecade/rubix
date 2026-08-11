# Rubix — Cyberpunk 2D Rubik's Cube Solver

A retro-futuristic arcade puzzle game built with vanilla HTML5/JavaScript. **Rubix** is a 2D Rubik's cube solver game where the player can track the moves and time in-game and have it saved to local storage. 

## Features

- **2D cube view** — Displays three faces of the cube at a time in a cross layout
- **Full rotation controls** — Clockwise and counter-clockwise rotations for all 6 faces
- **View switching** — Rotate the camera to see different angles of the cube
- **Cyberpunk theme** — Neon glow effects, dark backgrounds, sci-fi typography
- **Dual input support**
  - **Mouse/Touch** — Click or tap buttons directly
  - **Keyboard** — Arrow keys to navigate controls, Enter/Space to activate
- **Move & time tracking** — Tracks both move count and elapsed time
- **Record keeping** — Saves best times and fewest moves in localStorage
- **Responsive design** — Square canvas scales to maximum browser fit

## Controls

### Keyboard

| Key | Action |
|-----|--------|
| `Arrow Up` / `Arrow Down` | Navigate between controls vertically |
| `Arrow Left` / `Arrow Right` | Navigate between controls horizontally |
| `Enter` / `Space` | Activate selected button |
| Any key | Start game from title screen |

### Mouse / Touch

- **Click/Tap** any button to activate it
- Buttons are arranged in rows for easy access

### Game Buttons

- **U / U'** — Rotate Up face clockwise / counter-clockwise
- **D / D'** — Rotate Down face clockwise / counter-clockwise
- **F / F'** — Rotate Front face clockwise / counter-clockwise
- **B / B'** — Rotate Back face clockwise / counter-clockwise
- **L / L'** — Rotate Left face clockwise / counter-clockwise
- **R / R'** — Rotate Right face clockwise / counter-clockwise
- **◀ View ▶** — Cycle through different camera angles

## Game Flow

1. **Title Screen** — Press any key or click/tap to begin
2. **Gameplay** — Solve the scrambled cube using rotation controls
3. **Victory Screen** — See your move count, time, and any records broken
4. **Play Again** — Return to gameplay with a fresh scramble

## Face Color Mapping

| Face | Color |
|------|-------|
| Up | White |
| Down | Yellow |
| Front | Crimson |
| Back | Orange |
| Left | Cyan |
| Right | Lime |

