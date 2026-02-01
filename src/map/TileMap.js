export class TileMap {
    constructor(engine, canvas, tileSize = 48) {
        this.engine = engine;
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.tileSize = tileSize;
        this.cols = 64;
        this.rows = 64;

        this.chunkSize = 20;
        this.chunksX = Math.ceil(this.cols / this.chunkSize);
        this.chunksY = Math.ceil(this.rows / this.chunkSize);
        this.chunks = [];

        this.grid = [];
        this.layers = { floor: [], wall: [], unit: [] };
        
        this.initGrid();
        this.initChunks();
        this.initFogCanvas();
        this.initWallRegistry();
    }

    initFogCanvas() {
        if (!this.fogCanvas) this.fogCanvas = document.createElement('canvas');
        this.fogCanvas.width = this.cols;
        this.fogCanvas.height = this.rows;
        this.fogCtx = this.fogCanvas.getContext('2d');
        this.fogCtx.fillStyle = '#050505';
        this.fogCtx.fillRect(0, 0, this.cols, this.rows);
        this.fogImageData = this.fogCtx.createImageData(this.cols, this.rows);
        this.fogBuffer = new Uint32Array(this.fogImageData.data.buffer);
        this.fogBuffer.fill(0xFF050505);
    }

    initGrid() {
        this.grid = [];
        this.layers = { floor: [], wall: [], unit: [] };
        for (let y = 0; y < this.rows; y++) {
            this.grid[y] = [];
            this.layers.floor[y] = [];
            this.layers.wall[y] = [];
            this.layers.unit[y] = [];
            for (let x = 0; x < this.cols; x++) {
                this.grid[y][x] = {
                    terrain: 'dirt',
                    floorRotation: 0,
                    wallRotation: 0,
                    occupied: false,
                    buildable: true,
                    passable: true,
                    visible: false,
                    inSight: false,
                    hp: 0,
                    maxHp: 0
                };
                this.layers.floor[y][x] = { id: 'dirt', r: 0 };
                this.layers.wall[y][x] = null;
                this.layers.unit[y][x] = null;
            }
        }
    }

    initWallRegistry() {
        this.wallRegistry = {
            'tree': {
                maxHp: 50,
                render: (ctx, ts, lpx, lpy) => {
                    ctx.fillStyle = '#3d2b1f'; ctx.fillRect(lpx+ts*0.4, lpy+ts*0.6, ts*0.2, ts*0.3);
                    ctx.fillStyle = '#2d4d1e'; ctx.beginPath(); ctx.arc(0, lpy+ts*0.4, ts*0.35, 0, Math.PI*2); ctx.fill();
                    ctx.fillStyle = '#3a5a2a'; ctx.beginPath(); ctx.arc(lpx+ts*0.4, lpy+ts*0.35, ts*0.15, 0, Math.PI*2); ctx.fill();
                }
            },
            'stone-wall': {
                maxHp: 250,
                render: (ctx, ts, lpx, lpy) => {
                    ctx.fillStyle = '#2a2a2a'; ctx.fillRect(lpx, lpy, ts, ts);
                    const ds = (x, y, w, h, c) => { 
                        ctx.fillStyle = c; ctx.fillRect(lpx+x, lpy+y, w-1, h-1);
                        ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.strokeRect(lpx+x+1, lpy+y+1, w-3, h-3);
                    };
                    ds(0, 0, ts*0.65, ts*0.45, '#4a4a48'); ds(ts*0.65, 0, ts*0.35, ts*0.45, '#525250');
                    ds(0, ts*0.45, ts*0.35, ts*0.55, '#454543'); ds(ts*0.35, ts*0.45, ts*0.65, ts*0.55, '#4e4e4c');
                }
            },
            'rock': {
                maxHp: 500,
                render: (ctx, ts, lpx, lpy) => {
                    ctx.fillStyle = '#777'; ctx.beginPath();
                    ctx.moveTo(lpx+ts*0.2, lpy+ts*0.8); ctx.lineTo(lpx+ts*0.1, lpy+ts*0.4);
                    ctx.lineTo(lpx+ts*0.4, lpy+ts*0.1); ctx.lineTo(lpx+ts*0.8, lpy+ts*0.2);
                    ctx.lineTo(lpx+ts*0.9, lpy+ts*0.7); ctx.closePath(); ctx.fill();
                }
            },
            'fence': {
                maxHp: 30,
                render: (ctx, ts, lpx, lpy) => {
                    ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 4; ctx.beginPath();
                    ctx.moveTo(lpx, lpy+ts*0.3); ctx.lineTo(lpx+ts, lpy+ts*0.3);
                    ctx.moveTo(lpx, lpy+ts*0.7); ctx.lineTo(lpx+ts, lpy+ts*0.7); ctx.stroke();
                    ctx.lineWidth = 2; ctx.beginPath();
                    for(let i=1; i<=3; i++) { ctx.moveTo(lpx+ts*i/4, lpy+ts*0.1); ctx.lineTo(lpx+ts*i/4, lpy+ts*0.9); }
                    ctx.stroke();
                }
            },
            'concrete-wall': {
                maxHp: 400,
                render: (ctx, ts, lpx, lpy) => {
                    ctx.fillStyle = '#666'; ctx.fillRect(lpx, lpy, ts, ts);
                    ctx.strokeStyle = '#444'; ctx.lineWidth = 2; ctx.strokeRect(lpx+2, lpy+2, ts-4, ts-4);
                    ctx.fillStyle = '#333';
                    [0.25, 0.75].forEach(ax => [0.25, 0.75].forEach(ay => {
                        ctx.beginPath(); ctx.arc(lpx+ts*ax, lpy+ts*ay, 2, 0, Math.PI*2); ctx.fill();
                    }));
                }
            },
            'sandbag': {
                maxHp: 100,
                render: (ctx, ts, lpx, lpy) => {
                    ctx.fillStyle = '#c2b280'; const bw = ts*0.45, bh = ts*0.25;
                    [[0.02, 0.6], [0.52, 0.6], [0.27, 0.3]].forEach(p => {
                        ctx.fillRect(lpx+ts*p[0], lpy+ts*p[1], bw, bh);
                        ctx.strokeStyle = '#a6956d'; ctx.strokeRect(lpx+ts*p[0], lpy+ts*p[1], bw, bh);
                    });
                }
            },
            'barricade': {
                maxHp: 150,
                render: (ctx, ts, lpx, lpy) => {
                    ctx.strokeStyle = '#333'; ctx.lineWidth = 5; ctx.beginPath();
                    ctx.moveTo(lpx+5, lpy+5); ctx.lineTo(lpx+ts-5, lpy+ts-5);
                    ctx.moveTo(lpx+ts-5, lpy+5); ctx.lineTo(lpx+5, lpy+ts-5); ctx.stroke();
                    ctx.strokeStyle = '#fbc02d'; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);
                }
            },
            'brick-wall': {
                maxHp: 200,
                render: (ctx, ts, lpx, lpy) => {
                    ctx.fillStyle = '#8d2d2d'; ctx.fillRect(lpx, lpy, ts, ts);
                    ctx.strokeStyle = '#5d1d1d'; for(let i=1; i<4; i++) {
                        ctx.beginPath(); ctx.moveTo(lpx, lpy+ts*i/4); ctx.lineTo(lpx+ts, lpy+ts*i/4); ctx.stroke();
                    }
                }
            },
            'street-lamp': {
                maxHp: 20,
                render: (ctx, ts, lpx, lpy) => {
                    ctx.fillStyle = '#333'; ctx.fillRect(lpx+ts*0.4, lpy+ts*0.1, ts*0.2, ts*0.8);
                    ctx.fillStyle = '#fbc02d'; ctx.beginPath(); ctx.arc(0, lpy+ts*0.2, ts*0.15, 0, Math.PI*2); ctx.fill();
                }
            },
            'hydrant': {
                maxHp: 50,
                render: (ctx, ts, lpx, lpy) => {
                    ctx.fillStyle = '#d32f2f'; ctx.beginPath(); ctx.arc(0, 0, ts*0.3, 0, Math.PI*2); ctx.fill();
                }
            },
            'trash-can': {
                maxHp: 20,
                render: (ctx, ts, lpx, lpy) => {
                    ctx.fillStyle = '#455a64'; ctx.fillRect(lpx+ts*0.25, lpy+ts*0.25, ts*0.5, ts*0.5);
                    ctx.fillStyle = '#37474f'; ctx.fillRect(lpx+ts*0.25, lpy+ts*0.25, ts*0.5, ts*0.15);
                }
            },
            'spawn-point': {
                maxHp: 999999,
                isInvulnerable: true,
                render: (ctx, ts, lpx, lpy) => {
                    const size = ts * 3; const hSize = size / 2;
                    ctx.fillStyle = '#444'; ctx.fillRect(-hSize, -hSize, size, size);
                    ctx.globalAlpha = 0.1; ctx.fillStyle = '#000';
                    for(let i=0; i<30; i++) ctx.fillRect(-hSize + Math.random()*size, -hSize + Math.random()*size, 2, 2);
                    ctx.globalAlpha = 1.0;
                    const stripeW = 10; ctx.save(); ctx.beginPath(); ctx.rect(-hSize, -hSize, size, size);
                    ctx.rect(-hSize + stripeW, -hSize + stripeW, size - stripeW*2, size - stripeW*2);
                    ctx.clip("evenodd"); ctx.fillStyle = '#fbc02d'; ctx.fillRect(-hSize, -hSize, size, size);
                    ctx.strokeStyle = '#222'; ctx.lineWidth = 5;
                    for(let i = -size; i < size; i += 15) { ctx.beginPath(); ctx.moveTo(i, -hSize); ctx.lineTo(i + size, hSize); ctx.stroke(); }
                    ctx.restore();
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'; ctx.lineWidth = 2; ctx.strokeRect(-hSize + 15, -hSize + 15, size - 30, size - 30);
                    const drawCrate = (x, y, s) => {
                        ctx.fillStyle = '#4b5320'; ctx.fillRect(x, y, s, s); ctx.strokeStyle = '#2a2f10'; ctx.strokeRect(x+1, y+1, s-2, s-2);
                        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x+s, y+s); ctx.moveTo(x+s, y); ctx.lineTo(x, y+s); ctx.stroke();
                    };
                    drawCrate(hSize - 35, hSize - 35, 20); drawCrate(hSize - 55, hSize - 30, 15);
                    ctx.fillStyle = '#7a2b2b'; ctx.beginPath(); ctx.arc(-hSize + 30, -hSize + 30, 8, 0, Math.PI*2); ctx.fill();
                    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -ts); ctx.lineTo(ts*0.4, -ts*0.6); ctx.lineTo(ts*0.15, -ts*0.6); ctx.lineTo(ts*0.15, -ts*0.2); ctx.lineTo(-ts*0.15, -ts*0.2); ctx.lineTo(-ts*0.15, -ts*0.6); ctx.lineTo(-ts*0.4, -ts*0.6); ctx.closePath(); ctx.fill();
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.fillText("UNIT DEPLOYMENT ZONE", 0, ts*0.5);
                }
            }
        };
    }

    getWallMaxHp(id) {
        return this.wallRegistry[id]?.maxHp || 100;
    }

    loadFromData(data) {
        this.cols = data.width || 64;
        this.rows = data.height || 64;
        this.tileSize = data.tileSize || 48;
        this.layers = { floor: [], wall: [], unit: [] };
        this.grid = [];

        for (let y = 0; y < this.rows; y++) {
            this.grid[y] = [];
            this.layers.floor[y] = [];
            this.layers.wall[y] = [];
            this.layers.unit[y] = [];

            for (let x = 0; x < this.cols; x++) {
                const cell = (data.grid[y] && data.grid[y][x]) ? data.grid[y][x] : null;
                
                const parse = (d) => {
                    if (!d) return { id: null, r: 0 };
                    if (typeof d === 'string') return { id: d, r: 0 };
                    if (Array.isArray(d)) return { id: d[0], r: d[1] || 0 };
                    return { id: d.id, r: d.r || 0 };
                };

                const f = cell ? parse(cell[0] || 'dirt') : { id: 'dirt', r: 0 };
                const w = cell ? parse(cell[1]) : { id: null, r: 0 };
                this.layers.floor[y][x] = f;
                this.layers.wall[y][x] = w;
                this.layers.unit[y][x] = cell ? cell[2] : null;
                
                // 스폰 지점 블록은 통과 가능하도록 예외 처리
                const isWallPassable = !w.id || w.id === 'spawn-point';
                const maxHp = w.id ? this.getWallMaxHp(w.id) : 0;

                this.grid[y][x] = {
                    terrain: f.id,
                    floorRotation: f.r,
                    wallRotation: w.r,
                    occupied: !!w.id && w.id !== 'spawn-point',
                    buildable: !w.id && f.id !== 'spawn-point',
                    passable: isWallPassable && f.id !== 'water',
                    visible: false,
                    inSight: false,
                    hp: maxHp,
                    maxHp: maxHp
                };
            }
        }
        this.chunksX = Math.ceil(this.cols / this.chunkSize);
        this.chunksY = Math.ceil(this.rows / this.chunkSize);
        this.initChunks();
        this.initFogCanvas();
    }

    damageTile(x, y, damage) {
        if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return;
        
        const tile = this.grid[y][x];
        const wall = this.layers.wall[y][x];
        
        if (!wall || !wall.id || wall.id === 'spawn-point') return;
        
        tile.hp -= damage;
        
        // 데미지 이펙트 (선택사항: 나중에 추가 가능)
        if (this.engine.addEffect) {
            this.engine.addEffect('hit', x * this.tileSize + this.tileSize / 2, y * this.tileSize + this.tileSize / 2, '#fff');
        }

        if (tile.hp <= 0) {
            this.destroyWall(x, y);
        }
    }

    destroyWall(x, y) {
        if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return;
        
        const tile = this.grid[y][x];
        const wallId = this.layers.wall[y][x]?.id;
        
        if (!wallId) return;

        // 데이터 제거
        this.layers.wall[y][x] = null;
        tile.hp = 0;
        tile.maxHp = 0;
        tile.occupied = false;
        tile.buildable = tile.terrain !== 'spawn-point';
        tile.passable = tile.terrain !== 'water';

        // [수정] 벽 파괴 시 즉시 모든 유동장 비용 맵 갱신
        if (this.engine.flowField) this.engine.flowField.updateAllCostMaps();
        if (this.engine.enemyFlowField) this.engine.enemyFlowField.updateAllCostMaps();

        if (this.engine.deploymentSystem) {
            this.engine.deploymentSystem.shouldRebakeFlowField = true;
        }
    }

    getTileColor(terrain) {
        switch(terrain) {
            case 'dirt': return '#3d352e';
            case 'grass': return '#344521';
            case 'sand': return '#a6956d';
            case 'water': return '#1a2a35';
            case 'fertile-soil': return '#2b241c';
            case 'asphalt': return '#282828';
            case 'concrete': return '#5a5a5a';
            case 'metal-plate': return '#3a3f44';
            case 'sidewalk': return '#555555';
            case 'tactile-paving': return '#a68010';
            case 'brick-floor': return '#5d4037';
            case 'curb-edge': return '#666666';
            case 'road-line-white':
            case 'road-line-yellow':
            case 'crosswalk':
            case 'curb-h':
            case 'curb-v': return '#282828';
            default: return '#1a1a1a';
        }
    }

    initChunks() {
        const cp = this.chunkSize * this.tileSize;
        this.chunks = [];
        for (let cy = 0; cy < this.chunksY; cy++) {
            this.chunks[cy] = [];
            for (let cx = 0; cx < this.chunksX; cx++) {
                const canvas = document.createElement('canvas');
                canvas.width = cp; canvas.height = cp;
                const ctx = canvas.getContext('2d');
                const startX = cx * this.chunkSize, startY = cy * this.chunkSize;

                for (let y = 0; y < this.chunkSize; y++) {
                    for (let x = 0; x < this.chunkSize; x++) {
                        const wx = startX + x, wy = startY + y;
                        if (wx >= this.cols || wy >= this.rows) continue;
                        const tile = this.grid[wy][wx];
                        if (tile.terrain !== 'none') {
                            this.drawTileTexture(ctx, x * this.tileSize, y * this.tileSize, tile.terrain, tile.floorRotation);
                        }
                    }
                }
                this.chunks[cy][cx] = { canvas, x: startX * this.tileSize, y: startY * this.tileSize };
            }
        }
    }

    drawTileTexture(ctx, px, py, terrain, rotation = 0) {
        const ts = this.tileSize;
        ctx.save();
        ctx.translate(px + ts/2, py + ts/2);
        ctx.rotate((rotation * 90) * Math.PI / 180);
        const lpx = -ts/2, lpy = -ts/2;

        ctx.fillStyle = this.getTileColor(terrain);
        ctx.fillRect(lpx, lpy, ts, ts);

        ctx.globalAlpha = 0.15;
        if (['asphalt', 'road-line-white', 'road-line-yellow', 'crosswalk', 'curb-h', 'curb-v'].includes(terrain)) {
            ctx.fillStyle = '#fff';
            for(let i=0; i<8; i++) ctx.fillRect(lpx + Math.abs(Math.sin(px+i))*ts, lpy + Math.abs(Math.cos(py+i))*ts, 1, 1);
            ctx.globalAlpha = 0.6;
            if (terrain === 'road-line-white') { ctx.fillStyle = '#b0b0b0'; ctx.fillRect(lpx + ts*0.46, lpy, ts*0.08, ts); }
            else if (terrain === 'road-line-yellow') { ctx.fillStyle = '#907020'; ctx.fillRect(lpx + ts*0.46, lpy, ts*0.08, ts); }
            else if (terrain === 'crosswalk') { ctx.fillStyle = '#b0b0b0'; for(let i=0; i<2; i++) ctx.fillRect(lpx, lpy + ts*(0.125 + i*0.5), ts, ts*0.25); }
            else if (terrain === 'curb-h') { ctx.fillStyle = '#555'; ctx.fillRect(lpx, lpy, ts, ts*0.4); ctx.fillStyle = '#777'; ctx.fillRect(lpx, lpy+ts*0.4, ts, ts*0.1); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(lpx, lpy+ts*0.5, ts, ts*0.05); }
            else if (terrain === 'curb-v') { ctx.fillStyle = '#555'; ctx.fillRect(lpx, lpy, ts*0.4, ts); ctx.fillStyle = '#777'; ctx.fillRect(lpx+ts*0.4, lpy, ts*0.1, ts); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(lpx+ts*0.5, lpy, ts*0.05, ts); }
        } else if (['sidewalk', 'concrete', 'tactile-paving', 'brick-floor', 'metal-plate'].includes(terrain)) {
            ctx.globalAlpha = 0.2;
            if (terrain === 'sidewalk') { ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.strokeRect(lpx+1, lpy+1, ts-2, ts-2); ctx.beginPath(); ctx.moveTo(lpx+ts/2, lpy); ctx.lineTo(lpx+ts/2, lpy+ts); ctx.moveTo(lpx, lpy+ts/2); ctx.lineTo(lpx+ts, lpy+ts/2); ctx.stroke(); }
            else if (terrain === 'tactile-paving') { ctx.fillStyle = 'rgba(0,0,0,0.3)'; for(let ix=1; ix<=3; ix++) for(let iy=1; iy<=3; iy++) { ctx.beginPath(); ctx.arc(lpx+ts*ix/4, lpy+ts*iy/4, 1.5, 0, Math.PI*2); ctx.fill(); } }
            else if (terrain === 'brick-floor') { ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.moveTo(lpx, lpy+ts/2); ctx.lineTo(lpx+ts, lpy+ts/2); ctx.stroke(); }
            else if (terrain === 'metal-plate') { ctx.strokeStyle = '#222'; ctx.strokeRect(lpx+4, lpy+4, ts-8, ts-8); ctx.fillStyle = '#111'; ctx.fillRect(lpx+6, lpy+6, 2, 2); ctx.fillRect(lpx+ts-8, lpy+6, 2, 2); ctx.fillRect(lpx+6, lpy+ts-8, 2, 2); ctx.fillRect(lpx+ts-8, lpy+ts-8, 2, 2); }
            else if (terrain === 'concrete') { ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.strokeRect(lpx, lpy, ts, ts); }
        } else {
            this.drawNaturalTexture(ctx, lpx, lpy, terrain, ts, px, py);
        }
        ctx.globalAlpha = 0.05; ctx.strokeStyle = '#000'; ctx.strokeRect(lpx, lpy, ts, ts);
        ctx.restore();
    }

    drawNaturalTexture(ctx, lpx, lpy, terrain, ts, px, py) {
        ctx.save(); ctx.globalAlpha = 0.15;
        const s = (x, y) => { const h = (x * 374761393 + y * 668265263) ^ 0x12345; return (Math.abs(Math.sin(h)) * 10000) % 1; };
        if (terrain === 'grass') { ctx.fillStyle = '#fff'; for(let i=0; i<3; i++) ctx.fillRect(lpx+5+s(px+i, py)*(ts-10), lpy+5+s(px, py+i)*(ts-10), 2, 4); }
        else if (terrain === 'dirt') { ctx.fillStyle = '#000'; for(let i=0; i<5; i++) ctx.fillRect(lpx+s(px+i, py)*ts, lpy+s(px, py+i)*ts, 1, 1); }
        else if (terrain === 'sand') { ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(lpx, lpy+ts/2); ctx.quadraticCurveTo(lpx+ts/4, lpy+ts/4, lpx+ts/2, lpy+ts/2); ctx.stroke(); }
        else if (terrain === 'water') { ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(lpx+ts*0.1, lpy+ts*0.1, ts*0.8, ts*0.1); ctx.fillRect(lpx+ts*0.2, lpy+ts*0.5, ts*0.6, ts*0.1); }
        else if (terrain === 'fertile-soil') { ctx.fillStyle = '#1a140d'; for(let i=1; i<4; i++) ctx.fillRect(lpx+2, lpy+(ts/4)*i, ts-4, 1); }
        ctx.restore();
    }

    drawGrid(camera) {
        if (!camera) return;
        const cp = this.chunkSize * this.tileSize;
        const vL = -camera.x / camera.zoom, vT = -camera.y / camera.zoom;
        const sCX = Math.max(0, Math.floor(vL / cp)), eCX = Math.min(this.chunksX-1, Math.floor((vL + this.canvas.width/camera.zoom) / cp));
        const sCY = Math.max(0, Math.floor(vT / cp)), eCY = Math.min(this.chunksY-1, Math.floor((vT + this.canvas.height/camera.zoom) / cp));
        for (let cy = sCY; cy <= eCY; cy++) for (let cx = sCX; cx <= eCX; cx++) {
            const chunk = this.chunks[cy][cx];
            if (chunk) this.ctx.drawImage(chunk.canvas, chunk.x, chunk.y);
        }
    }

    drawWalls(ctx) {
        if (!this.layers || !this.layers.wall) return;
        for (let y = 0; y < this.rows; y++) {
            if (!this.layers.wall[y]) continue; 
            for (let x = 0; x < this.cols; x++) {
                const w = this.layers.wall[y][x];
                if (w && w.id) {
                    if (!this.grid[y][x].visible && !(this.engine.debugSystem?.isFullVision)) continue;
                    
                    const px = x * this.tileSize;
                    const py = y * this.tileSize;
                    this.drawSingleWall(ctx, w.id, px, py, this.tileSize, w.r || 0);

                    // 체력 바 표시 (데미지를 입었을 때만)
                    const tile = this.grid[y][x];
                    if (tile.hp > 0 && tile.hp < tile.maxHp && w.id !== 'spawn-point') {
                        const barW = this.tileSize * 0.8;
                        const barH = 4;
                        const bx = px + (this.tileSize - barW) / 2;
                        const by = py + 2;

                        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                        ctx.fillRect(bx, by, barW, barH);
                        
                        const hpRate = tile.hp / tile.maxHp;
                        ctx.fillStyle = hpRate > 0.5 ? '#4caf50' : (hpRate > 0.2 ? '#ffeb3b' : '#f44336');
                        ctx.fillRect(bx, by, barW * hpRate, barH);
                    }
                }
            }
        }
    }

    drawSingleWall(ctx, id, px, py, ts, r = 0) {
        const config = this.wallRegistry[id];
        if (!config) return;

        ctx.save();
        ctx.translate(px + ts/2, py + ts/2);
        ctx.rotate((r * 90) * Math.PI / 180);
        config.render(ctx, ts, -ts/2, -ts/2);
        ctx.restore();
    }

    updateFogCanvas() {
        if (!this.fogCtx || !this.fogBuffer) return;
        const B = 0xFF050505, G = 0x99000000, C = 0x00000000;
        for (let y = 0; y < this.rows; y++) {
            const off = y * this.cols;
            for (let x = 0; x < this.cols; x++) {
                const t = this.grid[y][x];
                this.fogBuffer[off + x] = !t.visible ? B : (!t.inSight ? G : C);
            }
        }
        this.fogCtx.putImageData(this.fogImageData, 0, 0);
    }

    drawFog(camera) {
        if (!camera || !this.fogCanvas) return;
        this.ctx.save(); this.ctx.imageSmoothingEnabled = false;
        this.ctx.drawImage(this.fogCanvas, 0, 0, this.cols, this.rows, 0, 0, this.cols*this.tileSize, this.rows*this.tileSize);
        this.ctx.restore();
    }

    getTileAt(wX, wY) {
        const x = Math.floor(wX/this.tileSize), y = Math.floor(wY/this.tileSize);
        if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) return { x, y, tile: this.grid[y][x] };
        return null;
    }

    worldToGrid(wX, wY) { return { x: Math.floor(wX/this.tileSize), y: Math.floor(wY/this.tileSize) }; }
    gridToWorld(gX, gY) { return { x: gX*this.tileSize + this.tileSize/2, y: gY*this.tileSize + this.tileSize/2 }; }
    
    /**
     * 특정 타일을 갱신하고 해당 청크를 다시 그립니다. (에디터용)
     */
    updateTile(x, y, terrain, rotation = 0) {
        if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return;
        
        // 데이터 갱신
        this.layers.floor[y][x] = { id: terrain, r: rotation };
        this.grid[y][x].terrain = terrain;
        this.grid[y][x].floorRotation = rotation;
        this.grid[y][x].buildable = (this.layers.wall[y][x] === null && terrain !== 'spawn-point');
        
        // 해당 타일이 속한 청크 갱신
        const cx = Math.floor(x / this.chunkSize);
        const cy = Math.floor(y / this.chunkSize);
        const chunk = this.chunks[cy][cx];
        
        if (chunk) {
            const ctx = chunk.canvas.getContext('2d');
            const lx = (x % this.chunkSize) * this.tileSize;
            const ly = (y % this.chunkSize) * this.tileSize;
            
            // 기존 타일 영역 지우기
            ctx.clearRect(lx, ly, this.tileSize, this.tileSize);
            // 새로 그리기
            this.drawTileTexture(ctx, lx, ly, terrain, rotation);
        }
    }

    /**
     * 특정 격자 위치에서 특정 크기(sizeClass)의 유닛이 통과 가능한지 확인
     * @param {number} gX 격자 X
     * @param {number} gY 격자 Y
     * @param {number} sizeClass 유닛의 타일 크기 (1, 2, 3 등)
     */
    isPassableArea(gX, gY, sizeClass = 1) {
        // 맵 범위를 벗어나면 통과 불가능
        if (gX < 0 || gY < 0 || gX + sizeClass > this.cols || gY + sizeClass > this.rows) {
            return false;
        }

        if (sizeClass <= 1) {
            return this.grid[gY][gX].passable;
        }

        // 영역 내 모든 타일이 통과 가능한지 체크
        for (let dy = 0; dy < sizeClass; dy++) {
            for (let row = this.grid[gY + dy], dx = 0; dx < sizeClass; dx++) {
                if (!row[gX + dx].passable) return false;
            }
        }
        return true;
    }

    isVisible(wX, wY) { const g = this.worldToGrid(wX, wY); return this.grid[g.y]?.[g.x]?.visible || false; }
    isInSight(wX, wY) { const g = this.worldToGrid(wX, wY); return this.grid[g.y]?.[g.x]?.inSight || false; }
}