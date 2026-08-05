# Rubix

A cyberpunk-themed 2D Rubik's Cube simulator built with HTML5 Canvas and vanilla JavaScript.

## Overview

Rubix is an arcade-style puzzle game featuring a 2D representation of a Rubik's Cube with three visible faces at a time. Choose between Casual mode (move counter only) or Challenge mode (high-score based on speed and efficiency).

## Features

- **Cyberpunk/Sci-fi aesthetic** using the Arne16 color palette
- **Two game modes**: Casual and Challenge
- **Responsive square canvas** that scales to any browser window
- **Dual control scheme**: On-screen buttons for mobile + keyboard shortcuts
- **Cube flipping**: Toggle between front/upper/right and left/back/down views
- **Move tracking and scoring system**

## Controls

### Keyboard

| Key | Action |
|-----|--------|
| `1` | Rotate left vertical section |
| `2` | Rotate center vertical section |
| `3` | Rotate right vertical section |
| `4` | Rotate top horizontal section |
| `5` | Rotate middle horizontal section |
| `6` | Rotate bottom horizontal section |
| `F` | Flip cube to show other 3 sides |
| `Enter` / `Space` | Confirm selection on menus |
| `1` / `2` | Select Casual or Challenge mode |

### Touch / Mouse

Tap or click any on-screen button to perform the corresponding action.

## Game Modes

### Casual Mode
Relax and solve the cube at your own pace. Only the move counter is displayed — no time pressure.

### Challenge Mode
Beat the clock and minimize your moves! Your score is calculated as:

```
Score = max(0, 100000 - (moves × 500) - (seconds × 100))
```

Fewer moves and less time = higher score. Your best score is saved in the browser.

## How to Play

1. Launch `index.html` in any modern browser
2. Press a key or tap the title screen to begin
3. Select **Casual** or **Challenge** mode
4. Rotate sections using the buttons or keyboard shortcuts
5. Use **Flip (F)** to view the back side of the cube
6. Solve all 6 faces to win!

## Technical Details

- **No external libraries** — pure HTML5, CSS, and JavaScript
- **Canvas-based rendering** for smooth visuals
- **Arne16 color palette** throughout

