/* ===== Helpers ===== */
const val = (el, dec = 1) => (+el.value).toFixed(dec);

/* ===== Avatar names (CamelCase, bez _) ===== */
const AVATAR_NAMES = [
    "BlueCookie",
    "ElectricMarshmallow",
    "PixelPigeon",
    "CosmicMelon",
    "SleepyCactus",
    "NeonAnchovy",
    "GhostToast",
    "TinyAsteroid",
    "LavaLatte",
    "MintyMoose",
    "PaperTiger",
    "DiscoDumpling",
    "SunnyPickle",
    "StormyMuffin",
    "HologramHedgehog",
    "CoffeeKraken",
    "GlitchKitten",
    "BubbleBaguette",
    "LaserLobster",
    "StaticPanda",
    "TurboTomato",
    "MidnightMarzipan",
    "PepperPenguin",
    "RetroRadish",
    "SpaceWaffle",
    "NoisyNachos",
    "VelvetVolcano",
    "CryptoCrumpet",
    "FuzzyFlamingo",
    "PocketDragon",
    "LofiLentil",
    "SushiSphinx",
    "CloudyCroissant",
    "CheekyChurro",
    "GalacticGrapefruit",
    "BananaBandit",
    "PlasmaPierogi",
    "MintKoala",
    "CinnamonComet",
    "SnugSnail",
    "AquaIguana",
    "PixelPierrot",
    "PandaPastel",
    "JellyJackalope",
    "CosmoCracker",
    "TofuTiger",
    "CocoaCyclops",
    "MysticMarshmallow",
    "OrbitOtter"
];

let currentAvatarName = "BlueCookie";

/* ===== Globals / avatar params ===== */

let CELL = 40;
const GRID_COLOR = ["#efe6d2"];
const GRID_WEIGHT = 5;

let shapeScale = 0.8;
let SHAPE_SIDES = 4;          // 0 = circle, 2 = line, 3..n polygon
let SHAPES_PER_CELL = 1;      // len pre HLAVU
let offsetIntensity = 0.6;    // disturbance level (head)
let hueShift = 0;             // 0..360

// background farba – ovládaná sliderom "background color"
let bgHue = 35;                               // len číslo (0..360)
let bgCss = "hsl(35, 60%, 92%)";              // CSS string, použijeme v p5 background()

let globalRotation = 0;       // radians
let biasDiag = 0;             // diagonal bias (-1..1)
let scaleX = 1, scaleY = 1;

// framerate riadi „skákavé“ mihotanie
let currentFps = 0;

// background bodky
const BG_ALPHA = 20;
const BG_DOT_FACTOR = 0.04;

const LEVELS = [
    { kind: "raw" },
    { kind: "merge22" },
    { kind: "merge33pattern" },
    { kind: "fourRects" },
    { kind: "fullBody" }
];
let levelIndex = 0;

let origin;
let cells = [];
let hairCells = [];

let minC, maxC, minR, maxR;

// globálny scale pre celý avatar – o ~10% menší než pôvodných 0.8
const AVATAR_SCALE = 0.72;

/* ===== hair / eyes / nose layers ===== */
const layers = {
    hair : { size: 1.0, edges: 4, rotate: 0, hue: 190, enabled:true, jitter:0.5, gridShape:1, shapesPerCell:1 },
    eyes : { size: 1.0, edges: 1, pupil: 1, rotate: 0, hue: 0,  enabled:true, jitter:0, spacing:1.0, eyeY:0.5 },
    nose : { size: 1.0, edges: 1, rotate: 0, hue: 20, enabled:true, jitter:0, noseY:0.6 },
};
let activeLayer = 'hair';

// globálny canvas ref pre PNG
let cnv;

/* ====== Name helpers ====== */

function setAvatarName(name){
    currentAvatarName = name || "BlueCookie";
    const span = document.getElementById('avatarName');
    if (span){
        span.textContent = currentAvatarName;
    }
}

function getRandomAvatarName(){
    if (!AVATAR_NAMES || AVATAR_NAMES.length === 0) return currentAvatarName || "BlueCookie";
    let candidate = AVATAR_NAMES[Math.floor(Math.random() * AVATAR_NAMES.length)];
    if (AVATAR_NAMES.length > 1){
        let tries = 0;
        while (candidate === currentAvatarName && tries < 10){
            candidate = AVATAR_NAMES[Math.floor(Math.random() * AVATAR_NAMES.length)];
            tries++;
        }
    }
    return candidate;
}

// button "change name" → náhodné meno
function changeAvatarName(){
    const newName = getRandomAvatarName();
    setAvatarName(newName);
}

// button "custom name" → editovateľné meno
function startEditingAvatarName(){
    const span = document.getElementById('avatarName');
    if (!span) return;

    const current = span.textContent.trim() || currentAvatarName || "BlueCookie";

    const input = document.createElement('input');
    input.type = 'text';
    input.value = current;
    input.className = 'name-input';

    span.replaceWith(input);
    input.focus();
    input.select();

    const commit = () => {
        let v = input.value.trim();
        if (!v) v = currentAvatarName || "BlueCookie";

        // nastav meno (aktualizuje currentAvatarName aj span, ak by už existoval)
        setAvatarName(v);

        // vytvoríme nový <span id="avatarName">
        const newSpan = document.createElement('span');
        newSpan.id = 'avatarName';
        newSpan.className = 'name-value';
        newSpan.textContent = currentAvatarName;

        input.replaceWith(newSpan);
        // keď chceš aj klik na meno ako edit:
        // newSpan.addEventListener('click', startEditingAvatarName);
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter'){
            e.preventDefault();
            input.blur();
        } else if (e.key === 'Escape'){
            input.value = current;
            input.blur();
        }
    });
}

/* ================== p5: setup / draw ================== */

function setup(){
    const holder = document.getElementById('p5-holder');
    cnv = createCanvas(holder.clientWidth, holder.clientHeight);
    cnv.parent('p5-holder');

    // HSB + alfa
    colorMode(HSB, 360, 100, 100, 100);

    buildLevel(levelIndex);
    buildLayerUI();

    // random, download, reset
    const btnRandom = document.getElementById('btn-random');
    if (btnRandom) btnRandom.onclick = randomizeAll;

    const btnDownload = document.getElementById('btn-download');
    if (btnDownload) btnDownload.onclick = downloadPng;

    const btnReset = document.getElementById('btn-reset');
    if (btnReset) btnReset.onclick = resetAll;

    // meno v piluli
    const nameSpan = document.getElementById('avatarName');
    if (nameSpan){
        const initial = nameSpan.textContent.trim();
        if (initial){
            currentAvatarName = initial;
        } else {
            setAvatarName(currentAvatarName);
        }
        // ak chceš edit aj klikom na meno, odkomentuj:
        // nameSpan.addEventListener('click', startEditingAvatarName);
    }

    // button "change name" – náhodné meno
    const btnChangeName = document.getElementById('btn-change-name');
    if (btnChangeName){
        btnChangeName.onclick = changeAvatarName;
    }

    // button "custom name" – manuálne prepisovanie
    const btnCustomName = document.getElementById('btn-custom-name');
    if (btnCustomName){
        btnCustomName.onclick = startEditingAvatarName;
    }

    // inicializácia background hue zo slidera
    const bgSlider = document.getElementById('inBgHue');
    if (bgSlider){
        setBgHue(+bgSlider.value || 35);
    } else {
        setBgHue(35);
    }

    noLoop();
}

function windowResized(){
    const holder = document.getElementById('p5-holder');
    resizeCanvas(holder.clientWidth, holder.clientHeight);
    positionGrid();
    buildHairGrid();
    redraw();
}

function draw(){
    // POZADIE CANVASU – rovnaké ako CSS background stránky
    background(bgCss);

    // jitter pri animácii
    if (currentFps > 0){
        if (offsetIntensity > 0){
            for (const cell of cells){
                for (const s of cell.shapes){
                    s.u = random(-1, 1);
                    s.v = random(-1, 1);
                }
            }
        }
        const hairJ = layers.hair?.jitter || 0;
        if (hairJ > 0){
            for (const cell of hairCells){
                if (!cell.shapes) continue;
                for (const s of cell.shapes){
                    s.u = random(-1, 1);
                    s.v = random(-1, 1);
                }
            }
        }
    }

    // globálny scale avatara okolo stredu canvasu
    push();
    translate(width / 2, height / 2);
    scale(AVATAR_SCALE);
    translate(-width / 2, -height / 2);

    drawBackgroundGridBehindAvatar();

    // grid rectangles (hlava) – transparentné
    noFill();
    stroke(0, 0, 100, 0);
    strokeWeight(GRID_WEIGHT);
    for (const cell of cells){
        const {x,y} = cellPos(cell.r, cell.c);
        rect(x, y, cell.w*CELL, cell.h*CELL);
    }

    // main shapes (hlava)
    noStroke();
    fill(hueShift % 360, 60, 90);
    for (const cell of cells){
        const {x,y} = cellPos(cell.r, cell.c);
        const cx = x + (cell.w*CELL)/2;
        const cy = y + (cell.h*CELL)/2;
        const size = Math.min(cell.w, cell.h) * CELL * shapeScale;
        const border = 2, maxOffset = (Math.min(cell.w, cell.h)*CELL/2) - border;

        for (const s of cell.shapes){
            const ox = (s.u || 0) * maxOffset * offsetIntensity;
            const oy = (s.v || 0) * maxOffset * offsetIntensity;

            push();
            translate(cx + ox, cy + oy);
            scale(scaleX, scaleY);
            rotate(s.rot || 0);
            shearX(biasDiag * 0.7);   // diagonálna deformácia
            shapeBySides(SHAPE_SIDES, size);
            pop();
        }
    }

    // layers
    drawHair();
    drawEyes();
    drawNose();

    pop(); // koniec globálneho scale
}

/* ===== dotted background grid – clipped to avatar square ===== */
function drawBackgroundGridBehindAvatar(){
    const pad = 18;

    // bounds = head + hair
    let miC = minC, maC = maxC, miR = minR, maR = maxR;
    for (const cell of hairCells){
        miC = Math.min(miC, cell.c);
        maC = Math.max(maC, cell.c + (cell.w || 1) - 1);
        miR = Math.min(miR, cell.r);
        maR = Math.max(maR, cell.r + (cell.h || 1) - 1);
    }

    const left  = origin.x + (miC * CELL) - pad;
    const top   = origin.y + (miR * CELL) - pad;
    const right = origin.x + ((maC+1) * CELL) + pad;
    const bottom= origin.y + ((maR+1) * CELL) + pad;

    const w = right-left, h = bottom-top;
    const size = Math.min(w,h);
    const cx = (left+right)/2, cy=(top+bottom)/2;
    const L = cx - size/2, T = cy - size/2;

    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.rect(L, T, size, size);
    drawingContext.clip();

    const cols=20, rows=20;
    const dx=size/cols, dy=size/rows;
    const dot=Math.max(1, Math.min(dx,dy) * BG_DOT_FACTOR);
    noStroke();
    // jemné bodky – trochu tmavšie, ale ten istý hue
    fill(bgHue, 20, 80, BG_ALPHA);
    for(let j=0;j<=rows;j++){
        const y=T+j*dy;
        for(let i=0;i<=cols;i++){
            const x=L+i*dx;
            ellipse(x,y,dot,dot);
        }
    }

    drawingContext.restore();
}

/* ================== Geometry & grid building ================== */

function buildBaseSilhouette(){
    const base = new Map();
    const put=(r,c,t)=>base.set(`${r},${c}`,{r,c,type:t});

    for (let r=0;r<=4;r++)
        for (let c=0;c<=7;c++) put(r,c,'body');

    for (let rr=5; rr<=7; rr++)
        for (let c=-1;c<=8;c++) put(rr,c,(c===-1||c===8)?'ear':'body');

    for (let r=8;r<=9;r++)
        for (let c=0;c<=7;c++) put(r,c,'body');

    for (let r=10;r<=12;r++)
        for (let c=2;c<=4;c++) put(r,c,'neck');

    return base;
}

function boundsFromCells(rects){
    let miC=+Infinity, maC=-Infinity, miR=+Infinity, maR=-Infinity;
    for (const rc of rects){
        miC=Math.min(miC,rc.c);
        maC=Math.max(maC,rc.c+(rc.w||1)-1);
        miR=Math.min(miR,rc.r);
        maR=Math.max(maR,rc.r+(rc.h||1)-1);
    }
    return {miC,maC,miR,maR};
}

function positionGrid(){
    const gridW=(maxC-minC+1)*CELL;
    const gridH=(maxR-minR+1)*CELL;

    // posun avataru trochu nižšie
    const extraTopSpace = CELL * 0.5;

    origin=createVector(
        (width-gridW)/2 - (minC*CELL),
        (height-gridH)/2 - (minR*CELL) + extraTopSpace
    );
}

function cellPos(r,c){
    return {x: origin.x + c*CELL, y: origin.y + r*CELL};
}

function randShape(){
    return {rot: globalRotation, u: random(-1,1), v: random(-1,1)};
}

function mergeBodyBlocks(baseMap,w,h){
    const body=new Map();
    for(const cell of baseMap.values())
        if(cell.type==='body') body.set(`${cell.r},${cell.c}`,cell);

    const used=new Set(), rects=[];
    const b=boundsFromCells(Array.from(body.values()).map(o=>({r:o.r,c:o.c,w:1,h:1})));

    for(let r=b.miR;r<=b.maR-(h-1);r++){
        for(let c=b.miC;c<=b.maC-(w-1);c++){
            let full=true; const use=[];
            for(let dr=0;dr<h&&full;dr++){
                for(let dc=0;dc<w&&full;dc++){
                    const k=`${r+dr},${c+dc}`;
                    if(!body.has(k)||used.has(k)) full=false;
                    else use.push(k);
                }
            }
            if(full){
                use.forEach(k=>used.add(k));
                rects.push({r,c,w,h,type:'body'});
            }
        }
    }
    for(const [k,bn] of body.entries())
        if(!used.has(k)) rects.push({r:bn.r,c:bn.c,w:1,h:1,type:'body'});

    return rects;
}

function buildLevel(idx){
    levelIndex=idx;
    const base=buildBaseSilhouette();

    if (LEVELS[idx].kind==='raw'){
        cells=Array.from(base.values()).map(b=>({r:b.r,c:b.c,w:1,h:1,type:b.type}));
    } else if (LEVELS[idx].kind==='merge22'){
        const bodyRects=mergeBodyBlocks(base,2,2);
        const ears=[
            {r:5,c:-1,w:1,h:3,type:'ear'},
            {r:5,c:8,w:1,h:3,type:'ear'}
        ];
        const neck=[
            {r:10,c:2,w:3,h:1,type:'neck'},
            {r:11,c:2,w:3,h:1,type:'neck'},
            {r:12,c:2,w:3,h:1,type:'neck'}
        ];
        cells=[...bodyRects,...ears,...neck];
    } else if (LEVELS[idx].kind==='merge33pattern'){
        const rects=[];
        const groups=[{c:0,w:3},{c:3,w:2},{c:5,w:3}];
        const bands=[{r:0,h:3},{r:3,h:3},{r:6,h:4}];
        for(const b of bands)
            for(const g of groups)
                rects.push({r:b.r,c:g.c,w:g.w,h:b.h,type:'body'});
        const ears=[
            {r:5,c:-1,w:1,h:3,type:'ear'},
            {r:5,c:8,w:1,h:3,type:'ear'}
        ];
        const neck=[{r:10,c:2,w:3,h:3,type:'neck'}];
        cells=[...rects,...ears,...neck];
    } else if (LEVELS[idx].kind==='fourRects'){
        const bodyRects=[
            {r:0,c:0,w:4,h:5,type:'body'},
            {r:0,c:4,w:4,h:5,type:'body'},
            {r:5,c:0,w:4,h:5,type:'body'},
            {r:5,c:4,w:4,h:5,type:'body'}
        ];
        const neck=[{r:10,c:2,w:3,h:3,type:'neck'}];
        cells=[...bodyRects,...neck];
    } else { // fullBody
        cells=[{r:0,c:0,w:8,h:10,type:'body'},
            {r:10,c:2,w:3,h:3,type:'neck'}];
    }

    const b=boundsFromCells(cells);
    minC=b.miC; maxC=b.maC; minR=b.miR; maxR=b.maR;

    for(const cell of cells){
        cell.shapes=[];
        for(let i=0;i<SHAPES_PER_CELL;i++) cell.shapes.push(randShape());
    }

    positionGrid();
    buildHairGrid();
    redraw();
}

/* ========== Hair silhouette grid – účesy 1..6 ========== */

function buildHairGrid(){
    hairCells = [];

    const headTop = minR;
    const headBottom = maxR;
    const centerC = (minC + maxC) / 2;

    const cStart = minC - 1;
    const cEnd   = maxC + 1;
    const totalW = cEnd - cStart + 1;

    const shape = layers.hair && layers.hair.gridShape ? layers.hair.gridShape : 1;

    const pushRect = (r, c, w, h) => {
        if (w <= 0 || h <= 0) return;
        hairCells.push({ r, c, w, h });
    };

    if (shape === 1){
        /* 1: krátky účes – podľa ľavej siluety */
        const mid = Math.round(centerC);
        const rowBottom = headTop - 1;
        const rowTop    = headTop - 2;

        const wBottom = Math.min(totalW, 9);
        const wTop    = Math.max(3, wBottom - 1);

        const cBottom = mid - Math.floor(wBottom / 2);
        const cTop    = cBottom + 1;

        pushRect(rowTop, cTop, wTop, 1);
        pushRect(rowBottom, cBottom, wBottom, 1);

        const colC = cBottom + wBottom - 1;
        const tailTop = rowBottom + 1;
        const tailH   = 1;
        pushRect(tailTop, colC, 1, tailH);

    } else if (shape === 2){
        /* 2: afro účes – vyladený podľa požiadaviek */

        const mid = Math.round(centerC);
        const baseRow = headTop - 1;   // pás tesne nad hlavou

        // 1) spodný pás – súvislý nad hlavou
        pushRect(baseRow, cStart, totalW, 1);

        // 2) druhý pás – plný, bez medzery v strede
        const row1 = baseRow - 1;
        pushRect(row1, cStart + 1, totalW - 2, 1);

        // 3) STREDNÝ VÝBEŽOK – o 1 stĺpec širší doľava (4x2)
        const centerCol = mid - 1;
        pushRect(baseRow - 3, centerCol - 1, 4, 2);

        // 4) PRAVÝ VÝBEŽOK
        const rightBumpCol = centerCol + 5;

        // horný riadok: odstránený posledný štvorček → len 2 bunky
        pushRect(baseRow - 3, rightBumpCol, 2, 1);

        // druhý riadok: 3 bunky
        pushRect(baseRow - 2, rightBumpCol, 3, 1);

        // vyplnená medzera dole
        pushRect(baseRow - 1, rightBumpCol,     1, 1);
        pushRect(baseRow - 1, rightBumpCol + 1, 1, 1);
        pushRect(baseRow - 1, rightBumpCol + 2, 1, 1);

        // predĺžené o jeden riadok dole
        pushRect(baseRow + 1, rightBumpCol, 3, 1);

        // 5) ĽAVÝ VÝBEŽOK
        const leftBumpCol = centerCol - 6;

        // horný riadok výbežku – 3 bunky
        pushRect(baseRow - 2, leftBumpCol, 3, 1);
        // dolný riadok – bez prvého štvorčeka
        pushRect(baseRow - 1, leftBumpCol + 1, 2, 1);

        // odskoky: ľavý nižšie, pravý pôvodne
        pushRect(baseRow + 1, leftBumpCol, 1, 1);
        pushRect(baseRow, leftBumpCol + 2, 1, 1);

        // 6) bočné „nohy“
        const sideHeight = 5;
        pushRect(baseRow, cStart, 2, sideHeight);
        pushRect(baseRow, cEnd - 1, 2, sideHeight);

    } else if (shape === 3){
        /* 3: dlhý účes */

        const topRow    = headTop - 2;
        const secondRow = headTop - 1;

        pushRect(topRow, cStart + 1, totalW - 2, 1);
        pushRect(secondRow, cStart, totalW, 1);

        const maxRows = 16;
        let longBottom = headBottom + 6;
        const desiredBottom = headTop + maxRows - 1;
        longBottom = Math.min(longBottom, desiredBottom);

        pushRect(headTop, cStart, 3, longBottom - headTop + 1);
        pushRect(headTop, cEnd - 2, 3, longBottom - headTop + 1);

    } else if (shape === 4){
        /* 4: ofinka + boky (kratšie) */
        const mid = Math.round(centerC);
        const rowTop = headTop - 2;
        const rowMid = headTop - 1;

        const wTop = Math.max(3, Math.floor(totalW * 0.6));
        pushRect(rowTop, mid - Math.floor(wTop / 2), wTop, 1);

        const wMid = Math.min(totalW, wTop + 2);
        pushRect(rowMid, mid - Math.floor(wMid / 2), wMid, 1);

        pushRect(headTop, cStart, 2, 5);
        pushRect(headTop, cEnd - 1, 2, 5);

    } else if (shape === 5){
        /* 5: clown účes – posunutý o 2 riadky nižšie */
        const offset = 2;

        const bunR = headTop - 4 + offset;
        const bunW = Math.max(3, Math.floor((maxC - minC + 1) / 2));
        const bunC = Math.round(centerC - bunW / 2);
        pushRect(bunR, bunC, bunW, 2);

        pushRect(headTop - 1 + offset, minC - 1, 2, 2);
        pushRect(headTop - 1 + offset, maxC, 2, 2);

    } else if (shape === 6){
        /* 6: curly účes – vlny + ľavá strana posunutá doprava o 1
           + prvý štvorček v hornom riadku posunutý o 1 nižšie
        */

        const mid = Math.round(centerC);
        const topRow = headTop - 2;
        const rowMid = headTop - 1;

        const globalShift = -1;

        const wTop = Math.max(3, Math.floor(totalW * 0.6));
        const startTop = mid - Math.floor(wTop / 2) + globalShift;

        // horný riadok – bez prvého stĺpca
        pushRect(topRow, startTop + 1, wTop - 1, 1);
        // prvý stĺpec posunutý o 1 nižšie
        pushRect(topRow + 1, startTop, 1, 1);
        // druhý riadok
        pushRect(rowMid, startTop + 1, wTop, 1);

        const baseLeft  = cStart + globalShift;
        const baseRight = (cEnd - 1) + globalShift;

        const hairH = 10;

        for (let i = 0; i < hairH; i++){
            const shift = i % 2;  // každý druhý riadok o +1 doprava = curly efekt

            // ĽAVÁ STRANA – posunutá o 1 doprava navrch
            pushRect(headTop + i, baseLeft + shift + 1, 2, 1);

            // Pravá strana – pôvodná (iba curly shift)
            pushRect(headTop + i, baseRight + shift, 2, 1);
        }
    }

    // 1) rozbi veľké recty na 1x1 bunky
    const unit = [];
    for (const cell of hairCells){
        for (let rr = 0; rr < cell.h; rr++){
            for (let cc = 0; cc < cell.w; cc++){
                unit.push({
                    r: cell.r + rr,
                    c: cell.c + cc,
                    w: 1,
                    h: 1,
                    shapes: []
                });
            }
        }
    }
    hairCells = unit;

    // 2) vytvor tvary podľa hair.shapesPerCell
    rebuildHairShapes();
}

// znovu vytvorí shapes pre existujúcu vlasovú mriežku
function rebuildHairShapes(){
    if (!hairCells || hairCells.length === 0) return;
    const spc = layers.hair?.shapesPerCell || 1;
    for (const cell of hairCells){
        cell.shapes = [];
        for (let i = 0; i < spc; i++){
            cell.shapes.push({
                u: random(-1, 1),
                v: random(-1, 1),
                rot: 0
            });
        }
    }
}

/* ================== Primitive drawing ================== */

function shapeBySides(sides, size){
    if (sides===0){
        ellipse(0,0,size,size);
        return;
    }
    if (sides===2){
        const w = Math.max(2, Math.min(6, size*0.06));
        rectMode(CENTER);
        rect(0,0,w,size);
        return;
    }
    beginShape();
    const rot=-PI/2 + PI/sides;
    for(let i=0;i<sides;i++){
        const a=rot+(i*TWO_PI)/sides;
        vertex(Math.cos(a)*size*0.5, Math.sin(a)*size*0.5);
    }
    endShape(CLOSE);
}

/* ================== Layers rendering ================== */

function drawHair(){
    if (!layers.hair.enabled || hairCells.length === 0) return;
    const L = layers.hair;
    const border = 2;
    const hairJ = L.jitter || 0;

    noStroke();
    fill(L.hue, 90, 90);

    for (const cell of hairCells){
        const {x, y} = cellPos(cell.r, cell.c);
        const cx = x + CELL / 2;
        const cy = y + CELL / 2;

        const baseSize = CELL;
        const size = baseSize * shapeScale * (L.size || 1);
        const maxOffset = (CELL / 2) - border;

        if (!cell.shapes) continue;

        for (const s of cell.shapes){
            const ox = (s.u || 0) * maxOffset * hairJ;
            const oy = (s.v || 0) * maxOffset * hairJ;

            push();
            translate(cx + ox, cy + oy);
            rotate((L.rotate || 0) * PI / 180 + (s.rot || 0));
            shapeBySides(L.edges || SHAPE_SIDES, size);
            pop();
        }
    }
}

/* ---- EYES ---- */
function drawEyes(){
    if(!layers.eyes.enabled) return;
    const L = layers.eyes;
    const s = 36 * L.size;
    const variant = L.edges || 1;
    const pupil = L.pupil || 1;
    const j = L.jitter || 0;

    const baseDx = 55;
    const spacing = L.spacing || 1.0;
    const dx = baseDx * spacing;

    // výška hlavy v pixeloch podľa mriežky
    const headTopY = origin.y + minR * CELL;
    const headBottomY = origin.y + (maxR + 1) * CELL;

    // povolené pásmo pre oči v rámci hlavy
    const eyeRangeTop = headTopY + 2 * CELL;
    const eyeRangeBottom = headBottomY - 4 * CELL;

    const t = (L.eyeY != null ? L.eyeY : 0.5);  // 0..1
    const eyeY = lerp(eyeRangeTop, eyeRangeBottom, constrain(t, 0, 1));

    push();
    translate(width/2, eyeY);
    rotate((L.rotate || 0) * PI/180);

    let ox = random(-15, 15) * j;
    let oy = random(-10, 10) * j;
    drawEyeShape(variant, pupil, -dx + ox, -6 + oy, s, L.hue);

    ox = random(-15, 15) * j;
    oy = random(-10, 10) * j;
    drawEyeShape(variant, pupil,  dx + ox, -6 + oy, s, L.hue);

    pop();
}

function drawEyeShape(variant, pupil, x, y, s, hue){
    push();
    translate(x, y);
    noStroke();
    rectMode(CENTER);
    ellipseMode(CENTER);

    const white = () => fill(0,0,100);

    if (variant === 1){
        white(); rect(0,0,s,s);
    } else if (variant === 2){
        white();
        push(); rotate(PI/4); rect(0,0,s*0.9,s*0.9); pop();
    } else if (variant === 3){
        white(); ellipse(0,0,s,s);
    } else if (variant === 4){
        white(); rect(0,0,s*0.8,s*1.4,s*0.4);
    } else if (variant === 5){
        white(); rect(0,0,s*1.4,s*0.8,s*0.4);
    } else {
        white(); rect(0,0,s*1.4,s*0.55,s*0.2);
    }

    drawPupilShape(pupil, s*0.45, hue);

    pop();
}

function drawPupilShape(type, r, hue){
    noStroke();
    const h = (hue || 0);
    fill(h, 90, 50);
    if(type === 1){
        ellipse(0,0,r,r);
    } else if(type === 2){
        rect(0,0,r,r);
    } else if(type === 3){
        push(); rotate(PI/4); rect(0,0,r,r); pop();
    } else if(type === 4){
        rect(0,0,r*0.5,r*1.2,r*0.5);
    } else if(type === 5){
        ellipse(0,0,r*0.8,r*0.4);
    }
}

/* ---- NOSE ---- */
function drawNose(){
    if(!layers.nose.enabled) return;
    const L = layers.nose;
    const variant = L.edges || 1;
    const base = 56 * L.size;
    const j = L.jitter || 0;

    let ox = random(-12,12) * j;
    let oy = random(-10,10) * j;

    // výška hlavy v pixeloch
    const headTopY = origin.y + minR * CELL;
    const headBottomY = origin.y + (maxR + 1) * CELL;

    // povolené pásmo pre nos v rámci hlavy
    const noseRangeTop = headTopY + 3 * CELL;
    const noseRangeBottom = headBottomY - 5 * CELL;

    const t = (L.noseY != null ? L.noseY : 0.6); // 0..1
    const noseY = lerp(noseRangeTop, noseRangeBottom, constrain(t, 0, 1));

    push();
    translate(width/2 + ox, noseY + oy);
    rotate((L.rotate || 0) * PI/180);
    noStroke();
    fill(L.hue,90,80);
    rectMode(CENTER);
    ellipseMode(CENTER);

    if (variant === 1){
        rect(0,0, base*0.6, base*1.6, base*0.5);
    } else if (variant === 2){
        rect(0,0, base*0.6, base*1.6, 4);
    } else if (variant === 3){
        rect(0,0, base, base);
    } else if (variant === 4){
        ellipse(0,0, base, base);
    } else {
        push();
        rotate(PI/4);
        rect(0,0, base*0.9, base*0.9);
        pop();
    }

    pop();
}

/* ================== UI actions ================== */

function setCell(n){
    CELL=n;
    positionGrid();
    buildHairGrid();
    redraw();
}

// grid shape: 1..5 -> LEVELS[0..4] pre HLAVU
function setGridShape(v){
    const idx = constrain(v-1, 0, LEVELS.length-1);
    buildLevel(idx);
}

function setFps(n){
    currentFps = n;

    const oFps = document.getElementById('oFps');
    if (oFps) oFps.textContent = n;

    const slider = document.getElementById('inFps');
    if (slider && +slider.value !== n) slider.value = n;

    if(n <= 0){
        noLoop();
        redraw();
    } else {
        frameRate(n);
        loop();
    }
}

// rotation in degrees
function setRotation(deg){
    const oRot = document.getElementById('oRot');
    if (oRot) oRot.textContent = deg;
    globalRotation = deg*PI/180;
    for(const c of cells) for(const s of c.shapes) s.rot=globalRotation;
    redraw();
}

/* ===== shape edges mapping (HEAD) ===== */
function mapSliderToSides(v){
    const n = Number(v);
    if (n >= 10) return 0; // circle
    return n;
}

function updateEdgesOutput(slider){
    const mapped = mapSliderToSides(slider.value);
    const out = document.getElementById('oSides');
    if (!out) return;
    out.textContent = mapped === 0 ? '0' : mapped;
}

function setSidesMapped(sliderVal){
    SHAPE_SIDES = mapSliderToSides(sliderVal);
    redraw();
}

function setScale(v){
    shapeScale=v;
    const oScale = document.getElementById('oScale');
    if (oScale) oScale.textContent = v.toFixed(2);
    redraw();
}

// shapes per cell 1..5 – len pre HLAVU
function setShapesPerCell(n){
    SHAPES_PER_CELL = n;

    for (const cell of cells){
        cell.shapes = [];
        for (let i = 0; i < SHAPES_PER_CELL; i++){
            cell.shapes.push(randShape());
        }
    }

    const out = document.getElementById('oShapesPerCell');
    if (out) out.textContent = n;

    redraw();
}

// shapes per cell pre HAIR
function setHairShapesPerCell(n){
    if (!layers.hair) return;
    layers.hair.shapesPerCell = n;
    rebuildHairShapes();
    redraw();
}

function setOffset(v){
    offsetIntensity=v;
    const oJ = document.getElementById('oHeadJitter');
    if (oJ) oJ.textContent = v.toFixed(2);
    redraw();
}

function setHue(v){
    hueShift=v;
    const oHue = document.getElementById('oHue');
    if (oHue) oHue.textContent = v;
    redraw();
}

// background slider – ovplyvní HSL CSS farbu aj farbu canvasu
function setBgHue(v){
    bgHue = v;

    const o = document.getElementById('oBgHue');
    if (o) o.textContent = v;

    // spoločný CSS string – použijeme pre body aj canvas
    bgCss = `hsl(${v}, 60%, 92%)`;

    // zmeniť hlavné CSS pozadie stránky
    const root = document.documentElement;
    if (root){
        root.style.setProperty('--bg', bgCss);
    }

    redraw();
}

function setDiagonalShear(v){
    biasDiag = v;
    const oBias = document.getElementById('oBias');
    if (oBias) oBias.textContent = v.toFixed(2);
    redraw();
}

function setScaleX(v){
    scaleX=v;
    const oSX = document.getElementById('oSX');
    if (oSX) oSX.textContent = v.toFixed(2);
    redraw();
}

function setScaleY(v){
    scaleY=v;
    const oSY = document.getElementById('oSY');
    if (oSY) oSY.textContent = v.toFixed(2);
    redraw();
}

function centerOffsets(){
    offsetIntensity=0;
    for(const c of cells) for(const s of c.shapes){
        s.u=0; s.v=0;
    }
    for(const c of hairCells) for(const s of c.shapes||[]){
        s.u=0; s.v=0;
    }
    const out = document.getElementById('oHeadJitter');
    const slider = document.getElementById('inHeadJitter');
    if(out) out.textContent='0.00';
    if(slider) slider.value=0;
    redraw();
}

function setHairGridShape(v){
    if (!layers.hair) return;
    layers.hair.gridShape = v;
    buildHairGrid();
    redraw();
}

/* ========== RESET – neutrálne hodnoty ========== */

function resetAll(){
    const gridSlider = document.getElementById('inGridShape');
    if (gridSlider){
        gridSlider.value = 1;
        setGridShape(1);
    }

    const fpsSlider = document.getElementById('inFps');
    if (fpsSlider){
        fpsSlider.value = 0;
        setFps(0);
    }

    const jitterSlider = document.getElementById('inHeadJitter');
    if (jitterSlider){
        jitterSlider.value = 0;
        setOffset(0);
    }

    const edgesSlider = document.getElementById('inSides');
    if(edgesSlider){
        edgesSlider.value = 2;
        setSidesMapped(2);
        updateEdgesOutput(edgesSlider);
    }

    const scaleSlider = document.getElementById('inScale');
    if (scaleSlider){
        scaleSlider.value = 0.2;
        setScale(0.2);
    }

    const shapesSlider = document.getElementById('inShapesPerCell');
    if (shapesSlider){
        shapesSlider.value = 1;
        setShapesPerCell(1);
    }

    const rotSlider = document.getElementById('inRot');
    if(rotSlider){
        rotSlider.value = 0;
        setRotation(0);
    }

    const biasSlider = document.getElementById('inBias');
    if(biasSlider){
        biasSlider.value = 0;
        setDiagonalShear(0);
    }

    const inSX = document.getElementById('inSX');
    if(inSX){
        inSX.value = 1;
        setScaleX(1);
    }

    const inSY = document.getElementById('inSY');
    if(inSY){
        inSY.value = 1;
        setScaleY(1);
    }

    const inHue = document.getElementById('inHue');
    if(inHue){
        inHue.value = 0;
        setHue(0);
    }

    const inBgHue = document.getElementById('inBgHue');
    if (inBgHue){
        inBgHue.value = 35;
        setBgHue(35);
    }

    levelIndex = 0;
    buildLevel(levelIndex);

    layers.hair = {
        size: 1.0,
        edges: 4,
        rotate: 0,
        hue: 190,
        enabled: true,
        jitter: 0.5,
        gridShape: 1,
        shapesPerCell: 1
    };

    layers.eyes = {
        size: 1.0,
        edges: 1,
        pupil: 1,
        rotate: 0,
        hue: 0,
        enabled: true,
        jitter: 0,
        spacing: 1.0,
        eyeY: 0.5
    };

    layers.nose = {
        size: 1.0,
        edges: 1,
        rotate: 0,
        hue: 20,
        enabled: true,
        jitter: 0,
        noseY: 0.6
    };

    buildHairGrid();
    buildLayerUI();
    redraw();
}

/* ========== RANDOMIZE ALL ========== */

function randomizeAll(){
    const gridSlider = document.getElementById('inGridShape');
    if (gridSlider){
        const gridVal = int(random(1, 6)); // 1..5 pre head
        gridSlider.value = gridVal;
        setGridShape(gridVal);
    }

    const fpsSlider = document.getElementById('inFps');
    if (fpsSlider){
        const fpsVal = int(random(0, 31));
        fpsSlider.value = fpsVal;
        setFps(fpsVal);
    }

    const jitterSlider = document.getElementById('inHeadJitter');
    if (jitterSlider){
        offsetIntensity = random(0, 1);
        jitterSlider.value = offsetIntensity;
        setOffset(offsetIntensity);
    }

    const edgesSlider = document.getElementById('inSides');
    if(edgesSlider){
        const randEdgeVal = int(random(2, 12));
        edgesSlider.value = randEdgeVal;
        setSidesMapped(randEdgeVal);
        updateEdgesOutput(edgesSlider);
    }

    const scaleSlider = document.getElementById('inScale');
    if (scaleSlider){
        const sVal = random(0.2, 2);
        scaleSlider.value = sVal;
        setScale(sVal);
    }

    const shapesSlider = document.getElementById('inShapesPerCell');
    if (shapesSlider){
        const n = int(random(1, 6));
        shapesSlider.value = n;
        setShapesPerCell(n);
    }

    const rotSlider = document.getElementById('inRot');
    if(rotSlider){
        const rotDeg = int(random(-180, 181));
        rotSlider.value = rotDeg;
        setRotation(rotDeg);
    }

    const biasSlider = document.getElementById('inBias');
    if(biasSlider){
        const biasVal = random(-1,1);
        biasSlider.value = biasVal;
        setDiagonalShear(biasVal);
    }

    const inSX = document.getElementById('inSX');
    if(inSX){
        const v = random(0.5,1.8);
        inSX.value = v;
        setScaleX(v);
    }

    const inSY = document.getElementById('inSY');
    if(inSY){
        const v = random(0.5,1.8);
        inSY.value = v;
        setScaleY(v);
    }

    const inHue = document.getElementById('inHue');
    if(inHue){
        const h = int(random(0,360));
        inHue.value = h;
        setHue(h);
    }

    const inBgHue = document.getElementById('inBgHue');
    if (inBgHue){
        const bh = int(random(0,360));
        inBgHue.value = bh;
        setBgHue(bh);
    }

    for(const c of cells) for(const s of c.shapes){
        s.u = random(-1,1);
        s.v = random(-1,1);
    }

    // random pre hair
    layers.hair.size   = random(0.8,1.4);
    layers.hair.edges  = int(random(3,9));
    layers.hair.rotate = int(random(-30,30));
    layers.hair.hue    = int(random(0,360));
    layers.hair.jitter = random(0,1);
    layers.hair.enabled= true;
    layers.hair.gridShape = int(random(1,7));     // 1..6
    layers.hair.shapesPerCell = int(random(1,6));

    buildHairGrid(); // vygeneruje shapes podľa shapesPerCell

    layers.eyes.size   = random(0.8,1.2);
    layers.eyes.edges  = int(random(1,7));
    layers.eyes.pupil  = int(random(1,6));
    layers.eyes.rotate = int(random(-20,20));
    layers.eyes.hue    = int(random(0,360));
    layers.eyes.jitter = random(0,1);
    layers.eyes.enabled= true;
    layers.eyes.spacing = random(0.6,1.8);
    layers.eyes.eyeY   = random(0,1);

    layers.nose.size   = random(0.8,1.3);
    layers.nose.edges  = int(random(1,6));
    layers.nose.rotate = int(random(-20,20));
    layers.nose.hue    = int(random(0,360));
    layers.nose.jitter = random(0,1);
    layers.nose.enabled= true;
    layers.nose.noseY  = random(0,1);

    buildLayerUI();
    redraw();
}

/* ===== Right panel dynamic UI ===== */

function switchLayer(name){
    activeLayer=name;
    for(const id of ['Hair','Eyes','Nose']){
        const el=document.getElementById('tab'+id);
        if(el) el.classList.toggle('active', id.toLowerCase()===name);
    }
    buildLayerUI();
}

function buildLayerUI(){
    const wrap = document.getElementById('layerControls');
    if(!wrap) return;
    const L = layers[activeLayer];

    let minEdges, maxEdges, label;
    if (activeLayer === 'hair'){
        // hair teraz používa rovnakú logiku ako head
        minEdges = 2; maxEdges = 11;
        label = 'shape edges';
    } else if (activeLayer === 'eyes'){
        minEdges = 1; maxEdges = 6;
        label = 'shape of eyes';
    } else {
        minEdges = 1; maxEdges = 5;
        label = 'shape';
    }

    let html = '';

    /* ----- HAIR špecifické ovládanie ----- */
    if (activeLayer === 'hair'){
        const gs = (L && L.gridShape) ? L.gridShape : 1;
        html += `
        <div class="control">
          <div class="control__value"><output id="oLGridShape">${gs}</output></div>
          <div class="control__slider">
            <span class="control__icon">☰</span>
            <input
              type="range"
              min="1" max="6" step="1"
              value="${gs}"
              oninput="document.getElementById('oLGridShape').textContent=this.value; setHairGridShape(+this.value)"
            >
          </div>
          <div class="control__label">grid shape</div>
        </div>

        <div class="control">
          <div class="control__value"><output id="oLHairShapes">${L.shapesPerCell || 1}</output></div>
          <div class="control__slider">
            <span class="control__icon">✶</span>
            <input
              type="range"
              min="1" max="5" step="1"
              value="${L.shapesPerCell || 1}"
              oninput="document.getElementById('oLHairShapes').textContent=this.value; setHairShapesPerCell(+this.value)"
            >
          </div>
          <div class="control__label">shapes per cell</div>
        </div>`;

        // HAIR – shape edges s mapovaním 2..11 => 2..9 / circle
        const sliderVal = (L.edges === 0 ? 11 : (L.edges || 2)); // ak je circle, posunieme slider na 11
        const displayVal = (L.edges === 0 ? '0' : (L.edges || 2));

        html += `
        <div class="control">
          <div class="control__value"><output id="oLEdges">${displayVal}</output></div>
          <div class="control__slider">
            <span class="control__icon">⬠</span>
            <input
              type="range"
              min="${minEdges}" max="${maxEdges}" step="1"
              value="${sliderVal}"
              oninput="
                (function(sl){
                  const mapped = mapSliderToSides(sl.value);
                  document.getElementById('oLEdges').textContent = (mapped === 0 ? '0' : mapped);
                  setLayerEdgesMapped('hair', +sl.value);
                })(this)"
            >
          </div>
          <div class="control__label">${label}</div>
        </div>`;

    } else {
        /* ----- Ostatné vrstvy (eyes, nose) – pôvodné edges ----- */
        html += `
        <div class="control">
          <div class="control__value"><output id="oLEdges">${L.edges || 1}</output></div>
          <div class="control__slider">
            <span class="control__icon">⬠</span>
            <input
              type="range"
              min="${minEdges}" max="${maxEdges}" step="1"
              value="${L.edges || 1}"
              oninput="document.getElementById('oLEdges').textContent=this.value; setLayerEdges('${activeLayer}', +this.value)"
            >
          </div>
          <div class="control__label">${label}</div>
        </div>`;
    }

    /* ----- extra ovládania pre eyes ----- */
    if (activeLayer === 'eyes'){
        html += `
        <div class="control">
          <div class="control__value"><output id="oLPupil">${L.pupil || 1}</output></div>
          <div class="control__slider">
            <span class="control__icon">●</span>
            <input
              type="range"
              min="1" max="5" step="1"
              value="${L.pupil || 1}"
              oninput="document.getElementById('oLPupil').textContent=this.value; setLayerPupil('eyes', +this.value)"
            >
          </div>
          <div class="control__label">shape of pupil</div>
        </div>

        <div class="control">
          <div class="control__value"><output id="oLEyeSpacing">${(L.spacing || 1).toFixed(2)}</output></div>
          <div class="control__slider">
            <span class="control__icon">⇆</span>
            <input
              type="range"
              min="0.4" max="1.8" step="0.05"
              value="${L.spacing || 1}"
              oninput="document.getElementById('oLEyeSpacing').textContent=(+this.value).toFixed(2); setLayerEyeSpacing('eyes', +this.value)"
            >
          </div>
          <div class="control__label">distance</div>
        </div>

        <div class="control">
          <div class="control__value"><output id="oLEyeY">${(L.eyeY != null ? L.eyeY : 0.5).toFixed(2)}</output></div>
          <div class="control__slider">
            <span class="control__icon">⇅</span>
            <input
              type="range"
              min="0" max="1" step="0.01"
              value="${L.eyeY != null ? L.eyeY : 0.5}"
              oninput="document.getElementById('oLEyeY').textContent=(+this.value).toFixed(2); setLayerEyeY('eyes', +this.value)"
            >
          </div>
          <div class="control__label">vertical position</div>
        </div>`;
    }

    /* ----- size ----- */
    html += `
    <div class="control">
      <div class="control__value"><output id="oLSize">${(L.size || 1).toFixed(2)}</output></div>
      <div class="control__slider">
        <span class="control__icon">●</span>
        <input
          type="range"
          min="0.6" max="1.6" step="0.05"
          value="${L.size || 1}"
          oninput="document.getElementById('oLSize').textContent=(+this.value).toFixed(2); setLayerSize('${activeLayer}', +this.value)"
        >
      </div>
      <div class="control__label">size</div>
    </div>`;

    /* ----- ROTATE + vertical pos – len pre NOSE ----- */
    if (activeLayer === 'nose') {
        html += `
        <div class="control">
          <div class="control__value"><output id="oLRot">${L.rotate || 0}</output></div>
          <div class="control__slider">
            <span class="control__icon">↻</span>
            <input
              type="range"
              min="-45" max="45" step="1"
              value="${L.rotate || 0}"
              oninput="document.getElementById('oLRot').textContent=this.value; setLayerRot('nose', +this.value)"
            >
          </div>
          <div class="control__label">rotate</div>
        </div>

        <div class="control">
          <div class="control__value"><output id="oLNoseY">${(L.noseY != null ? L.noseY : 0.6).toFixed(2)}</output></div>
          <div class="control__slider">
            <span class="control__icon">⇅</span>
            <input
              type="range"
              min="0" max="1" step="0.01"
              value="${L.noseY != null ? L.noseY : 0.6}"
              oninput="document.getElementById('oLNoseY').textContent=(+this.value).toFixed(2); setLayerNoseY('nose', +this.value)"
            >
          </div>
          <div class="control__label">vertical position</div>
        </div>`;
    }

    /* ----- disturbance (hair/eyes/nose) ----- */
    if (activeLayer === 'eyes' || activeLayer === 'nose' || activeLayer === 'hair'){
        html += `
        <div class="control">
          <div class="control__value"><output id="oLJitter">${(L.jitter || 0).toFixed(2)}</output></div>
          <div class="control__slider">
            <span class="control__icon">✺</span>
            <input
              type="range"
              min="0" max="1" step="0.05"
              value="${L.jitter || 0}"
              oninput="document.getElementById('oLJitter').textContent=(+this.value).toFixed(2); setLayerJitter('${activeLayer}', +this.value)"
            >
          </div>
          <div class="control__label">disturbance</div>
        </div>`;
    }

    /* ----- color ----- */
    html += `
    <div class="control control--full">
      <div class="control__value"><output id="oLHue">${L.hue || 0}</output></div>
      <div class="control__slider">
        <span class="control__icon">↔</span>
        <input
          type="range"
          min="0" max="360" step="5"
          value="${L.hue || 0}"
          oninput="document.getElementById('oLHue').textContent=this.value; setLayerHue('${activeLayer}', +this.value)"
        >
      </div>
      <div class="control__label">color</div>
    </div>

    <div class="control control--full">
      <div class="control__slider control__slider--toggle">
        <button type="button"
          class="toggle-btn ${L.enabled ? 'toggle-btn--on' : 'toggle-btn--off'}"
          onclick="toggleLayerEnabled('${activeLayer}')">
          ${L.enabled ? 'on' : 'off'}
        </button>
      </div>
      <div class="control__label">enabled</div>
    </div>`;

    wrap.innerHTML = html;
}


function setLayerEdges(name,v){
    if(layers[name]) layers[name].edges=v;
    redraw();
}

// mapovanie aj pre hair slider
function setLayerEdgesMapped(name, sliderVal){
    if (!layers[name]) return;
    const mapped = mapSliderToSides(sliderVal); // 2..9, 10/11 => 0 (circle)
    layers[name].edges = mapped;
    redraw();
}

function setLayerSize(name,v){ if(layers[name]) layers[name].size=v; redraw(); }
function setLayerRot(name,v){ if(layers[name]) layers[name].rotate=v; redraw(); }
function setLayerHue(name,v){ if(layers[name]) layers[name].hue=v; redraw(); }
function setLayerEnabled(name){ if(layers[name]) layers[name].enabled=!layers[name].enabled; redraw(); }
function setLayerPupil(name,v){ if(layers[name]) layers[name].pupil=v; redraw(); }
function setLayerJitter(name,v){ if(layers[name]) layers[name].jitter=v; redraw(); }

function setLayerEyeSpacing(name, v){
    if(layers[name]) layers[name].spacing = v;
    redraw();
}

function setLayerEyeY(name,v){
    if(layers[name]) layers[name].eyeY = constrain(v,0,1);
    redraw();
}

function setLayerNoseY(name,v){
    if(layers[name]) layers[name].noseY = constrain(v,0,1);
    redraw();
}

function toggleLayerEnabled(name){
    setLayerEnabled(name);
    buildLayerUI();
}

/* ===== Download PNG ===== */

function getSafeFileNameFromName(name){
    if (!name) return "abstract_me";
    let cleaned = String(name).trim();
    cleaned = cleaned.replace(/\s+/g, "");
    cleaned = cleaned.replace(/[^\w\-]+/g, "");
    if (!cleaned) return "abstract_me";
    return "abstract_me_" + cleaned;
}

function downloadPng(){
    const fileName = getSafeFileNameFromName(currentAvatarName);
    saveCanvas(fileName, 'png');
}

/* expose for console/debug + inline handlers */
window.setGridShape = setGridShape;
window.setSidesMapped = setSidesMapped;
window.setDiagonalShear = setDiagonalShear;
window.centerOffsets = centerOffsets;
window.randomizeAll = randomizeAll;
window.switchLayer = switchLayer;
window.setShapesPerCell = setShapesPerCell;
window.setHairGridShape = setHairGridShape;
window.setHairShapesPerCell = setHairShapesPerCell;
window.setOffset = setOffset;
window.setScale = setScale;
window.setRotation = setRotation;
window.setScaleX = setScaleX;
window.setScaleY = setScaleY;
window.setHue = setHue;
window.setFps = setFps;
window.setBgHue = setBgHue;

// pre istotu sprístupníme aj tieto, ak by boli volané z HTML
window.changeAvatarName = changeAvatarName;
window.startEditingAvatarName = startEditingAvatarName;
