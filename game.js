(function () {
    "use strict";

    // ---- Arne16 palette -------------------------------------------------
    const PAL = {
        black:      "#000000",
        gray:       "#9D9D9D",
        white:      "#FFFFFF",
        red:        "#BE2633",
        pink:       "#E06F8B",
        brown:      "#493C2B",
        oBrown:     "#A46422",
        orange:     "#EB8931",
        yellow:     "#F7E26B",
        dGrayGreen: "#2F484E",
        green:      "#44891A",
        lime:       "#A3CE27",
        navy:       "#1B2632",
        blue:       "#005784",
        lightBlue:  "#31A2F2",
        cyan:       "#B2DCFF"
    };

    // Cube face colours (standard mapping)
    const FACE_COL = {
        U: PAL.white,   // Up      → white
        F: PAL.red,     // Front   → red
        R: PAL.blue,    // Right   → blue
        L: PAL.orange,  // Left    → orange
        B: PAL.green,   // Back    → green
        D: PAL.yellow   // Down    → yellow
    };

    // ---- Canvas setup ---------------------------------------------------
    const canvas = document.getElementById("gameCanvas");
    const ctx    = canvas.getContext("2d");

    let W = 0, H = 0;
    let scale = 1;
    const LOGICAL = 1000;

    function resize() {
        const s = Math.min(window.innerWidth, window.innerHeight);
        const dpr = window.devicePixelRatio || 1;
        W = s; H = s;
        canvas.width  = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width  = W + "px";
        canvas.style.height = H + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        scale = W / LOGICAL;
    }
    window.addEventListener("resize", resize);
    resize();

    // ---- Game state -----------------------------------------------------
    const ST = { TITLE: 0, MODE: 1, GAME: 2, OVER: 3 };
    let state = ST.TITLE;
    let mode = "casual";
    let moves = 0;
    let startTime = 0;
    let elapsed = 0;
    let highScore = parseInt(localStorage.getItem("rubix_hs") || "0", 10);
    let flipped = false;
    let cube = {};

    // ---- Cube data ------------------------------------------------------
    function solvedCube() {
        const c = {};
        for (const f of ["U","F","R","L","B","D"]) c[f] = Array(9).fill(FACE_COL[f]);
        return c;
    }

    function shuffleCube(c, n) {
        for (let i = 0; i < n; i++) rotateSec(c, Math.floor(Math.random() * 6) + 1);
    }

    // ---- Section rotation -----------------------------------------------
    // Each section = 9 cells (3 per face), shifted by 3 on rotation.
    //
    // Default view (U/F/R):
    //   Vert 1 = col0 of U,F,R  |  Vert 2 = col1  |  Vert 3 = col2
    //   Horiz 4 = row0 of U,F,R |  Horiz 5 = row1 |  Horiz 6 = row2
    //
    // Flipped view (B/L/D):
    //   Vert 1 = col0 of B,L,D  |  ... same pattern
    //   Horiz 4 = row0 of B,L,D |  ...

    const V_DEF  = ["U","F","R"];
    const V_FLIP = ["B","L","D"];

    function rotateSec(c, btn) {
        const vert = btn <= 3;
        const idx  = vert ? btn - 1 : btn - 4; // 0,1,2
        const faces = flipped ? V_FLIP : V_DEF;

        if (vert) {
            // Column idx: positions idx, idx+3, idx+6 within each face
            const v = [
                c[faces[0]][idx], c[faces[0]][idx+3], c[faces[0]][idx+6],
                c[faces[1]][idx], c[faces[1]][idx+3], c[faces[1]][idx+6],
                c[faces[2]][idx], c[faces[2]][idx+3], c[faces[2]][idx+6]
            ];
            const r = [v[3],v[4],v[5],v[6],v[7],v[8],v[0],v[1],v[2]];
            let i = 0;
            for (const f of faces) {
                c[f][idx]     = r[i++];
                c[f][idx+3]   = r[i++];
                c[f][idx+6]   = r[i++];
            }
        } else {
            // Row idx: positions idx*3, idx*3+1, idx*3+2 within each face
            const b = idx * 3;
            const v = [
                c[faces[0]][b], c[faces[0]][b+1], c[faces[0]][b+2],
                c[faces[1]][b], c[faces[1]][b+1], c[faces[1]][b+2],
                c[faces[2]][b], c[faces[2]][b+1], c[faces[2]][b+2]
            ];
            const r = [v[3],v[4],v[5],v[6],v[7],v[8],v[0],v[1],v[2]];
            let i = 0;
            for (const f of faces) {
                c[f][b]   = r[i++];
                c[f][b+1] = r[i++];
                c[f][b+2] = r[i++];
            }
        }
    }

    function isSolved(c) {
        for (const f in c) {
            const a = c[f][0];
            for (let i = 1; i < 9; i++) if (c[f][i] !== a) return false;
        }
        return true;
    }

    // ---- Drawing helpers ------------------------------------------------
    function txt(s, x, y, sz, col, al, bold) {
        ctx.fillStyle = col;
        ctx.font = (bold ? "bold " : "") + (sz * scale) + "px 'Courier New', monospace";
        ctx.textAlign = al || "center";
        ctx.textBaseline = "middle";
        ctx.fillText(s, x * scale, y * scale);
    }

    function txtGlow(s, x, y, sz, col, glow, al, bold) {
        ctx.font = (bold ? "bold " : "") + (sz * scale) + "px 'Courier New', monospace";
        ctx.textAlign = al || "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = glow;
        ctx.shadowBlur = 8 * scale;
        ctx.strokeStyle = glow;
        ctx.lineWidth = 2 * scale;
        ctx.strokeText(s, x * scale, y * scale);
        ctx.fillStyle = col;
        ctx.fillText(s, x * scale, y * scale);
        ctx.shadowBlur = 0;
    }

    function fill(x, y, w, h, col) {
        if (col) { ctx.fillStyle = col; ctx.fillRect(x * scale, y * scale, w * scale, h * scale); }
    }

    function stroke(x, y, w, h, col, lw) {
        ctx.strokeStyle = col;
        ctx.lineWidth = (lw || 2) * scale;
        ctx.strokeRect(x * scale, y * scale, w * scale, h * scale);
    }

    function glowStroke(x, y, w, h, col, blur) {
        ctx.shadowColor = col;
        ctx.shadowBlur = (blur || 10) * scale;
        ctx.strokeStyle = col;
        ctx.lineWidth = 2 * scale;
        ctx.strokeRect(x * scale, y * scale, w * scale, h * scale);
        ctx.shadowBlur = 0;
    }

    function bgGrid(alpha) {
        ctx.strokeStyle = "rgba(49,162,242," + alpha + ")";
        ctx.lineWidth = 1 * scale;
        for (let x = 0; x < LOGICAL; x += 40) {
            ctx.beginPath(); ctx.moveTo(x * scale, 0); ctx.lineTo(x * scale, LOGICAL * scale); ctx.stroke();
        }
        for (let y = 0; y < LOGICAL; y += 40) {
            ctx.beginPath(); ctx.moveTo(0, y * scale); ctx.lineTo(LOGICAL * scale, y * scale); ctx.stroke();
        }
    }

    function scanlines() {
        ctx.fillStyle = "rgba(0,0,0,0.03)";
        for (let y = 0; y < LOGICAL; y += 4) {
            ctx.fillRect(0, y * scale, W, 2 * scale);
        }
    }

    // ---- Button definitions (logical coords) ----------------------------
    // Buttons above cube — vertical sections
    const BTN_V = [
        { x: 280, y: 70, w: 100, h: 40, label: "V1", key: "1" },
        { x: 400, y: 70, w: 100, h: 40, label: "V2", key: "2" },
        { x: 520, y: 70, w: 100, h: 40, label: "V3", key: "3" }
    ];
    // Buttons right of cube — horizontal sections
    const BTN_H = [
        { x: 810, y: 230, w: 120, h: 40, label: "H4", key: "4" },
        { x: 810, y: 350, w: 120, h: 40, label: "H5", key: "5" },
        { x: 810, y: 470, w: 120, h: 40, label: "H6", key: "6" }
    ];
    // Flip button below cube
    const BTN_F = { x: 320, y: 640, w: 360, h: 50, label: "FLIP (F)", key: "f" };

    function allBtns() { return [...BTN_V, ...BTN_H, BTN_F]; }

    function hitBtn(px, py) {
        for (const b of allBtns()) {
            if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return b;
        }
        return null;
    }

    // ---- Face drawing ---------------------------------------------------
    const FSZ = 150;  // face size
    const CGAP = 3;   // cell gap
    const FGAP = 16;  // face gap

    // Face positions for each view
    function fpos(view, face) {
        const cx = 440, cy = 400;
        if (view === 0) { // default: U top, F center, R right
            switch (face) {
                case "U": return { x: cx - FSZ / 2, y: cy - FSZ - FGAP };
                case "F": return { x: cx - FSZ / 2, y: cy };
                case "R": return { x: cx + FGAP, y: cy };
            }
        } else { // flipped: B top, L left, D right
            switch (face) {
                case "B": return { x: cx - FSZ / 2, y: cy - FSZ - FGAP };
                case "L": return { x: cx - FSZ - FGAP, y: cy };
                case "D": return { x: cx + FGAP, y: cy };
            }
        }
    }

    function drawFace(name, cols, x, y) {
        const cs = (FSZ - CGAP * 2) / 3;
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                const ci = r * 3 + c;
                const px = x + CGAP + c * (cs + CGAP);
                const py = y + CGAP + r * (cs + CGAP);
                const col = cols[ci];

                ctx.fillStyle = col;
                ctx.fillRect(px * scale, py * scale, cs * scale, cs * scale);

                ctx.strokeStyle = "rgba(0,0,0,0.35)";
                ctx.lineWidth = 1 * scale;
                ctx.strokeRect(px * scale, py * scale, cs * scale, cs * scale);

                // inner highlight
                ctx.fillStyle = "rgba(255,255,255,0.1)";
                ctx.fillRect((px + 2) * scale, (py + 2) * scale, (cs - 4) * scale, (cs - 4) * scale);
            }
        }

        // Face border with glow
        ctx.shadowColor = PAL.lightBlue;
        ctx.shadowBlur = 6 * scale;
        ctx.strokeStyle = PAL.lightBlue;
        ctx.lineWidth = 2 * scale;
        ctx.strokeRect(x * scale, y * scale, FSZ * scale, FSZ * scale);
        ctx.shadowBlur = 0;

        // Face label
        txt(name, x + FSZ / 2, y - 10, 12, PAL.gray, "center");
    }

    function drawCube() {
        const v = flipped ? 1 : 0;
        const names = flipped ? ["B","L","D"] : ["U","F","R"];
        for (const n of names) {
            const p = fpos(v, n);
            drawFace(n, cube[n], p.x, p.y);
        }
    }

    // ---- Button rendering -----------------------------------------------
    let btnFlash = {};  // key → time remaining

    function drawBtn(b) {
        const flash = btnFlash[b.key] || 0;
        const glowCol = flash > 0 ? PAL.cyan : PAL.lightBlue;
        const bgAlpha = flash > 0 ? 0.35 : 0.2;
        const bgCol = flash > 0 ? "rgba(49,162,242," + bgAlpha + ")" : "rgba(27,38,50," + bgAlpha + ")";

        fill(b.x, b.y, b.w, b.h, bgCol);
        stroke(b.x, b.y, b.w, b.h, glowCol, 2);

        // inner glow
        ctx.shadowColor = glowCol;
        ctx.shadowBlur = flash > 0 ? 14 * scale : 6 * scale;
        ctx.strokeStyle = glowCol;
        ctx.lineWidth = 1 * scale;
        ctx.strokeRect((b.x + 2) * scale, (b.y + 2) * scale, (b.w - 4) * scale, (b.h - 4) * scale);
        ctx.shadowBlur = 0;

        txt(b.label, b.x + b.w / 2, b.y + b.h / 2, 15, PAL.white, "center", true);
    }

    // ---- Screens --------------------------------------------------------
    let pulse = 0;
    let finalScore = 0;
    let isNewHigh = false;

    // --- Title screen ---
    function drawTitle(dt) {
        pulse += dt;
        fill(0, 0, LOGICAL, LOGICAL, PAL.black);
        bgGrid(0.06);

        // Animated particles
        const t = pulse;
        ctx.fillStyle = "rgba(49,162,242,0.15)";
        for (let i = 0; i < 20; i++) {
            const px = ((i * 137 + t * 30) % LOGICAL);
            const py = ((i * 211 + t * 15) % LOGICAL);
            const sz = (2 + Math.sin(t * 2 + i) * 1.5) * scale;
            ctx.fillRect(px * scale, py * scale, sz, sz);
        }

        // Title with glow
        const g = 0.6 + 0.4 * Math.sin(pulse * 2.5);
        ctx.shadowColor = PAL.cyan;
        ctx.shadowBlur = (18 + 12 * g) * scale;
        txt("R U B I X", LOGICAL / 2, LOGICAL / 2 - 100, 70, PAL.cyan, "center", true);
        ctx.shadowBlur = 0;

        txt("2D CUBE SIMULATOR", LOGICAL / 2, LOGICAL / 2 - 40, 18, PAL.lightBlue, "center");

        // Decorative line
        fill(LOGICAL / 2 - 180, LOGICAL / 2 - 18, 360, 2, PAL.lightBlue);

        // Start prompt
        const a = 0.4 + 0.6 * Math.sin(pulse * 3.5);
        ctx.globalAlpha = a;
        txt("[ PRESS ANY KEY / TAP TO START ]", LOGICAL / 2, LOGICAL / 2 + 140, 16, PAL.white, "center", true);
        ctx.globalAlpha = 1;

        scanlines();
        glowStroke(1, 1, LOGICAL - 2, LOGICAL - 2, PAL.navy, 4);
    }

    // --- Mode select ---
    const MB_CASUAL = { x: 150, y: 380, w: 280, h: 70, label: "CASUAL (1)" };
    const MB_CHALL  = { x: 570, y: 380, w: 280, h: 70, label: "CHALLENGE (2)" };

    function drawMode(dt) {
        pulse += dt;
        fill(0, 0, LOGICAL, LOGICAL, PAL.black);
        bgGrid(0.04);

        txtGlow("SELECT MODE", LOGICAL / 2, 110, 42, PAL.cyan, PAL.cyan, "center", true);
        fill(LOGICAL / 2 - 130, 148, 260, 2, PAL.lightBlue);

        // Descriptions
        txt("CASUAL", LOGICAL / 2, 200, 24, PAL.orange, "center", true);
        txt("No timer · Move counter only", LOGICAL / 2, 235, 14, PAL.gray, "center");

        txt("CHALLENGE", LOGICAL / 2, 280, 24, PAL.red, "center", true);
        txt("Beat the high score!", LOGICAL / 2, 315, 14, PAL.gray, "center");
        if (highScore > 0) txt("Best: " + highScore, LOGICAL / 2, 340, 13, PAL.lime, "center");

        // Buttons
        // Casual
        fill(MB_CASUAL.x, MB_CASUAL.y, MB_CASUAL.w, MB_CASUAL.h, "rgba(235,137,49,0.12)");
        ctx.shadowColor = PAL.orange; ctx.shadowBlur = 8 * scale;
        stroke(MB_CASUAL.x, MB_CASUAL.y, MB_CASUAL.w, MB_CASUAL.h, PAL.orange, 2);
        ctx.shadowBlur = 0;
        txt(MB_CASUAL.label, MB_CASUAL.x + MB_CASUAL.w / 2, MB_CASUAL.y + MB_CASUAL.h / 2, 18, PAL.white, "center", true);

        // Challenge
        fill(MB_CHALL.x, MB_CHALL.y, MB_CHALL.w, MB_CHALL.h, "rgba(190,38,51,0.12)");
        ctx.shadowColor = PAL.red; ctx.shadowBlur = 8 * scale;
        stroke(MB_CHALL.x, MB_CHALL.y, MB_CHALL.w, MB_CHALL.h, PAL.red, 2);
        ctx.shadowBlur = 0;
        txt(MB_CHALL.label, MB_CHALL.x + MB_CHALL.w / 2, MB_CHALL.y + MB_CHALL.h / 2, 18, PAL.white, "center", true);

        const a = 0.4 + 0.6 * Math.sin(pulse * 3.5);
        ctx.globalAlpha = a;
        txt("[ TAP A BUTTON / PRESS 1 OR 2 ]", LOGICAL / 2, 530, 14, PAL.white, "center");
        ctx.globalAlpha = 1;

        scanlines();
        glowStroke(1, 1, LOGICAL - 2, LOGICAL - 2, PAL.navy, 4);
    }

    // --- Game screen ---
    function drawGame() {
        fill(0, 0, LOGICAL, LOGICAL, PAL.black);
        bgGrid(0.03);

        // Header bar
        fill(0, 0, LOGICAL, 52, "rgba(27,38,50,0.95)");
        stroke(0, 52, LOGICAL, 0, PAL.lightBlue, 1);

        txtGlow("R U B I X", 55, 26, 20, PAL.cyan, PAL.cyan, "left", true);
        txt(mode.toUpperCase(), 220, 26, 13, PAL.pink, "left");

        if (mode === "challenge") {
            const m = Math.floor(elapsed / 60).toString().padStart(2, "0");
            const s = Math.floor(elapsed % 60).toString().padStart(2, "0");
            txt("TIME: " + m + ":" + s, 400, 26, 14, PAL.yellow, "left");
            txt("BEST: " + highScore, 600, 26, 13, PAL.lime, "left");
        }

        txt("MOVES: " + moves, 920, 26, 14, PAL.white, "right");

        // Section labels
        txt("▲ VERTICAL SECTIONS ▲", 460, 58, 10, PAL.gray, "center");
        txt("► HORIZONTAL", 870, 212, 9, PAL.gray, "center");
        txt("  SECTIONS ►", 870, 225, 9, PAL.gray, "center");

        // Cube
        drawCube();

        // View indicator
        txt(flipped ? "◄ VIEW: L / B / D ►" : "◄ VIEW: U / F / R ►", 470, 610, 12, PAL.gray, "center");

        // Buttons
        for (const b of BTN_V) drawBtn(b);
        for (const b of BTN_H) drawBtn(b);
        drawBtn(BTN_F);

        scanlines();
        glowStroke(1, 1, LOGICAL - 2, LOGICAL - 2, PAL.navy, 4);
    }

    // --- Game over ---
    function drawOver(dt) {
        pulse += dt;
        fill(0, 0, LOGICAL, LOGICAL, PAL.black);
        bgGrid(0.05);

        const g = 0.6 + 0.4 * Math.sin(pulse * 2);
        ctx.shadowColor = PAL.lime;
        ctx.shadowBlur = (14 + 10 * g) * scale;
        txt("CUBE SOLVED!", LOGICAL / 2, 100, 46, PAL.lime, "center", true);
        ctx.shadowBlur = 0;

        fill(LOGICAL / 2 - 140, 148, 280, 2, PAL.lime);

        txt("MOVES: " + moves, LOGICAL / 2, 220, 24, PAL.white, "center", true);

        if (mode === "challenge") {
            const mm = Math.floor(elapsed / 60).toString().padStart(2, "0");
            const ss = Math.floor(elapsed % 60).toString().padStart(2, "0");
            txt("TIME: " + mm + ":" + ss, LOGICAL / 2, 280, 22, PAL.yellow, "center", true);
            txtGlow("SCORE: " + finalScore, LOGICAL / 2, 360, 36, PAL.cyan, PAL.cyan, "center", true);

            if (isNewHigh) {
                const a = 0.5 + 0.5 * Math.sin(pulse * 5);
                ctx.globalAlpha = a;
                ctx.shadowColor = PAL.yellow; ctx.shadowBlur = 12 * scale;
                txt("★ NEW HIGH SCORE! ★", LOGICAL / 2, 420, 20, PAL.yellow, "center", true);
                ctx.shadowBlur = 0;
                ctx.globalAlpha = 1;
            }
        } else {
            txt(mode.toUpperCase() + " MODE", LOGICAL / 2, 280, 16, PAL.pink, "center");
        }

        // Play Again
        const ba = { x: 200, y: 490, w: 250, h: 56, label: "PLAY AGAIN (1)" };
        fill(ba.x, ba.y, ba.w, ba.h, "rgba(68,137,26,0.15)");
        ctx.shadowColor = PAL.green; ctx.shadowBlur = 8 * scale;
        stroke(ba.x, ba.y, ba.w, ba.h, PAL.green, 2);
        ctx.shadowBlur = 0;
        txt("PLAY AGAIN (1)", ba.x + ba.w / 2, ba.y + ba.h / 2, 16, PAL.white, "center", true);

        // Title Screen
        const bt = { x: 550, y: 490, w: 250, h: 56, label: "TITLE SCREEN (2)" };
        fill(bt.x, bt.y, bt.w, bt.h, "rgba(157,157,157,0.1)");
        ctx.shadowColor = PAL.gray; ctx.shadowBlur = 8 * scale;
        stroke(bt.x, bt.y, bt.w, bt.h, PAL.gray, 2);
        ctx.shadowBlur = 0;
        txt("TITLE SCREEN (2)", bt.x + bt.w / 2, bt.y + bt.h / 2, 16, PAL.white, "center", true);

        scanlines();
        glowStroke(1, 1, LOGICAL - 2, LOGICAL - 2, PAL.navy, 4);
    }

    // ---- Input ----------------------------------------------------------
    function triggerBtn(btn) {
        if (!btn) return false;
        if (btn.key >= "1" && btn.key <= "6" && state === ST.GAME) {
            rotateSec(cube, parseInt(btn.key));
            moves++;
            btnFlash[btn.key] = 0.2;
            if (isSolved(cube)) endGame();
            return true;
        }
        if (btn.key === "f" && state === ST.GAME) {
            flipped = !flipped;
            btnFlash["f"] = 0.2;
            return true;
        }
        return false;
    }

    // Keyboard handler
    function onKeyDown(e) {
        const k = e.key;

        if (state === ST.TITLE) {
            state = ST.MODE;
            pulse = 0;
            e.preventDefault();
            return;
        }

        if (state === ST.MODE) {
            if (k === "1") { mode = "casual"; startGame(); e.preventDefault(); return; }
            if (k === "2") { mode = "challenge"; startGame(); e.preventDefault(); return; }
            return;
        }

        if (state === ST.OVER) {
            if (k === "1") { startGame(); e.preventDefault(); return; }
            if (k === "2") { state = ST.TITLE; pulse = 0; e.preventDefault(); return; }
            return;
        }

        if (state === ST.GAME) {
            if (k >= "1" && k <= "6") {
                e.preventDefault();
                rotateSec(cube, parseInt(k));
                moves++;
                btnFlash[k] = 0.2;
                if (isSolved(cube)) endGame();
            } else if (k === "f" || k === "F") {
                e.preventDefault();
                flipped = !flipped;
                btnFlash["f"] = 0.2;
            }
        }
    }
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("keydown", onKeyDown);

    // Pointer (mouse + touch)
    function ptrPos(cx, cy) {
        const r = canvas.getBoundingClientRect();
        return { x: (cx - r.left) / scale, y: (cy - r.top) / scale };
    }

    function ptrDown(pos) {
        if (state === ST.TITLE) { state = ST.MODE; pulse = 0; return; }
        if (state === ST.MODE) {
            const m = hitModeBtn(pos.x, pos.y);
            if (m === "casual") { mode = "casual"; startGame(); }
            if (m === "chall")  { mode = "challenge"; startGame(); }
            return;
        }
        if (state === ST.OVER) {
            // Play Again: x 200-450, y 490-546
            if (pos.x >= 200 && pos.x <= 450 && pos.y >= 490 && pos.y <= 546) { startGame(); return; }
            // Title: x 550-800, y 490-546
            if (pos.x >= 550 && pos.x <= 800 && pos.y >= 490 && pos.y <= 546) { state = ST.TITLE; pulse = 0; return; }
            return;
        }
        if (state === ST.GAME) {
            const b = hitBtn(pos.x, pos.y);
            if (b) triggerBtn(b);
        }
    }

    canvas.addEventListener("mousedown", function (e) { ptrDown(ptrPos(e.clientX, e.clientY)); });
    canvas.addEventListener("touchstart", function (e) {
        e.preventDefault();
        const t = e.touches[0];
        ptrDown(ptrPos(t.clientX, t.clientY));
    }, { passive: false });

    function hitModeBtn(x, y) {
        if (x >= MB_CASUAL.x && x <= MB_CASUAL.x + MB_CASUAL.w &&
            y >= MB_CASUAL.y && y <= MB_CASUAL.y + MB_CASUAL.h) return "casual";
        if (x >= MB_CHALL.x && x <= MB_CHALL.x + MB_CHALL.w &&
            y >= MB_CHALL.y && y <= MB_CHALL.y + MB_CHALL.h) return "chall";
        return null;
    }

    // ---- Game flow ------------------------------------------------------
    function startGame() {
        cube = solvedCube();
        shuffleCube(cube, 25);
        while (isSolved(cube)) shuffleCube(cube, 3);
        moves = 0;
        flipped = false;
        startTime = performance.now();
        elapsed = 0;
        btnFlash = {};
        state = ST.GAME;
    }

    function endGame() {
        elapsed = (performance.now() - startTime) / 1000;
        if (mode === "challenge") {
            finalScore = Math.max(0, 100000 - moves * 500 - Math.floor(elapsed) * 100);
            isNewHigh = finalScore > highScore;
            if (isNewHigh) {
                highScore = finalScore;
                localStorage.setItem("rubix_hs", highScore.toString());
            }
        }
        pulse = 0;
        state = ST.OVER;
    }

    // ---- Main loop ------------------------------------------------------
    let prevTime = performance.now();

    function loop(now) {
        const dt = Math.min((now - prevTime) / 1000, 0.1);
        prevTime = now;

        // Decay button flash
        for (const k in btnFlash) {
            btnFlash[k] = Math.max(0, btnFlash[k] - dt);
        }

        // Timer
        if (state === ST.GAME) elapsed = (now - startTime) / 1000;

        ctx.clearRect(0, 0, W, H);

        switch (state) {
            case ST.TITLE: drawTitle(dt); break;
            case ST.MODE:  drawMode(dt);  break;
            case ST.GAME:  drawGame();    break;
            case ST.OVER:  drawOver(dt);  break;
        }

        requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);

})();
