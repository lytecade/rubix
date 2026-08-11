# Rubix — Cyberpunk 2D Rubik's Cube Solver

> A retro-futuristic arcade puzzle game built with vanilla HTML5/JavaScript.

## Overview

**Rubix** is a 2D Rubik's cube solver game with a cyberpunk/sci-fi aesthetic. The game uses the Arne16 color palette and features a square canvas that auto-scales to fit any browser window.

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

## Color Palette (Arne16)

| Color | Hex |
|-------|-----|
| Black | `#000000` |
| Gray | `#9D9D9D` |
| White | `#FFFFFF` |
| Crimson | `#BE2633` |
| Pink | `#E06F8B` |
| Dark Brown | `#493C2B` |
| Brown | `#A46422` |
| Orange | `#EB8931` |
| Yellow | `#F7E26B` |
| Teal | `#2F484E` |
| Dark Green | `#44891A` |
| Lime | `#A3CE27` |
| Navy | `#1B2632` |
| Dark Blue | `#005784` |
| Cyan | `#31A2F2` |
| Light Cyan | `#B2DCEF` |

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

## Files

```
├── index.html    # Game container and canvas
├── game.js       # All game logic and rendering
└── README.md     # This file
```

## Browser Support

Modern browsers with Canvas 2D support: Chrome, Firefox, Safari, Edge, and mobile browsers.

## License

Free to use and modify. No external dependencies.
