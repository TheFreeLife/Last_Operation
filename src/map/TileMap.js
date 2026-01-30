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
                    inSight: false
                };
                this.layers.floor[y][x] = { id: 'dirt', r: 0 };
                this.layers.wall[y][x] = null;
                this.layers.unit[y][x] = null;
            }
        }
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
                const cell = data.grid[y][x];
                const parse = (d) => {
                    if (!d) return { id: null, r: 0 };
                    if (typeof d === 'string') return { id: d, r: 0 };
                    if (Array.isArray(d)) return { id: d[0], r: d[1] || 0 };
                    return { id: d.id, r: d.r || 0 };
                };

                const f = parse(cell[0] || 'dirt');
                const w = parse(cell[1]);
                this.layers.floor[y][x] = f;
                this.layers.wall[y][x] = w;
                this.layers.unit[y][x] = cell[2];
                
                // 스폰 지점 블록은 통과 가능하도록 예외 처리
                const isWallPassable = !w.id || w.id === 'spawn-point';

                this.grid[y][x] = {
                    terrain: f.id,
                    floorRotation: f.r,
                    wallRotation: w.r,
                    occupied: !!w.id && w.id !== 'spawn-point',
                    buildable: !w.id && f.id !== 'spawn-point',
                    passable: isWallPassable && f.id !== 'water',
                    visible: false,
                    inSight: false
                };
            }
        }
        this.chunksX = Math.ceil(this.cols / this.chunkSize);
        this.chunksY = Math.ceil(this.rows / this.chunkSize);
        this.initChunks();
        this.initFogCanvas();
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
            if (!this.layers.wall[y]) continue; // 행 데이터 부재 시 스킵
            for (let x = 0; x < this.cols; x++) {
                const w = this.layers.wall[y][x];
                if (w && w.id) {
                    if (!this.grid[y][x].visible && !(this.engine.debugSystem?.isFullVision)) continue;
                    this.drawSingleWall(ctx, w.id, x*this.tileSize, y*this.tileSize, this.tileSize, w.r || 0);
                }
            }
        }
    }

    drawSingleWall(ctx, id, px, py, ts, r = 0) {
        ctx.save();
        ctx.translate(px + ts/2, py + ts/2);
        ctx.rotate((r * 90) * Math.PI / 180);
        const lpx = -ts/2, lpy = -ts/2;
        if (id === 'tree') { ctx.fillStyle = '#3d2b1f'; ctx.fillRect(lpx+ts*0.4, lpy+ts*0.6, ts*0.2, ts*0.3); ctx.fillStyle = '#2d4d1e'; ctx.beginPath(); ctx.arc(0, lpy+ts*0.4, ts*0.35, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#3a5a2a'; ctx.beginPath(); ctx.arc(lpx+ts*0.4, lpy+ts*0.35, ts*0.15, 0, Math.PI*2); ctx.fill(); }
        else if (id === 'stone-wall') {
            ctx.fillStyle = '#2a2a2a'; ctx.fillRect(lpx, lpy, ts, ts);
            const ds = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(lpx+x, lpy+y, w-1, h-1); ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.strokeRect(lpx+x+1, lpy+y+1, w-3, h-3); ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.moveTo(lpx+x, lpy+y+h-1); ctx.lineTo(lpx+x+w-1, lpy+y+h-1); ctx.lineTo(lpx+x+w-1, lpy+y); ctx.stroke(); };
            ds(0, 0, ts*0.65, ts*0.45, '#4a4a48'); ds(ts*0.65, 0, ts*0.35, ts*0.45, '#525250'); ds(0, ts*0.45, ts*0.35, ts*0.55, '#454543'); ds(ts*0.35, ts*0.45, ts*0.65, ts*0.55, '#4e4e4c');
        }
        else if (id === 'rock') { ctx.fillStyle = '#777'; ctx.beginPath(); ctx.moveTo(lpx+ts*0.2, lpy+ts*0.8); ctx.lineTo(lpx+ts*0.1, lpy+ts*0.4); ctx.lineTo(lpx+ts*0.4, lpy+ts*0.1); ctx.lineTo(lpx+ts*0.8, lpy+ts*0.2); ctx.lineTo(lpx+ts*0.9, lpy+ts*0.7); ctx.closePath(); ctx.fill(); }
        else if (id === 'fence') { ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(lpx, lpy+ts*0.3); ctx.lineTo(lpx+ts, lpy+ts*0.3); ctx.moveTo(lpx, lpy+ts*0.7); ctx.lineTo(lpx+ts, lpy+ts*0.7); ctx.stroke(); ctx.lineWidth = 2; ctx.beginPath(); for(let i=1; i<=3; i++) { ctx.moveTo(lpx+ts*i/4, lpy+ts*0.1); ctx.lineTo(lpx+ts*i/4, lpy+ts*0.9); } ctx.stroke(); }
        else if (id === 'concrete-wall') { ctx.fillStyle = '#666'; ctx.fillRect(lpx, lpy, ts, ts); ctx.strokeStyle = '#444'; ctx.lineWidth = 2; ctx.strokeRect(lpx+2, lpy+2, ts-4, ts-4); ctx.beginPath(); ctx.moveTo(0, lpy+2); ctx.lineTo(0, lpy+ts-2); ctx.stroke(); ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(lpx+ts*0.25, lpy+ts*0.25, 2, 0, Math.PI*2); ctx.arc(lpx+ts*0.75, lpy+ts*0.25, 2, 0, Math.PI*2); ctx.arc(lpx+ts*0.25, lpy+ts*0.75, 2, 0, Math.PI*2); ctx.arc(lpx+ts*0.75, lpy+ts*0.75, 2, 0, Math.PI*2); ctx.fill(); }
        else if (id === 'sandbag') { ctx.fillStyle = '#c2b280'; const bw = ts*0.45, bh = ts*0.25; ctx.fillRect(lpx+ts*0.02, lpy+ts*0.6, bw, bh); ctx.fillRect(lpx+ts*0.52, lpy+ts*0.6, bw, bh); ctx.fillRect(lpx+ts*0.27, lpy+ts*0.3, bw, bh); ctx.strokeStyle = '#a6956d'; ctx.lineWidth = 1; ctx.strokeRect(lpx+ts*0.02, lpy+ts*0.6, bw, bh); ctx.strokeRect(lpx+ts*0.52, lpy+ts*0.6, bw, bh); ctx.strokeRect(lpx+ts*0.27, lpy+ts*0.3, bw, bh); }
        else if (id === 'barricade') { ctx.strokeStyle = '#333'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(lpx+5, lpy+5); ctx.lineTo(lpx+ts-5, lpy+ts-5); ctx.moveTo(lpx+ts-5, lpy+5); ctx.lineTo(lpx+5, lpy+ts-5); ctx.stroke(); ctx.strokeStyle = '#fbc02d'; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]); }
        else if (id === 'brick-wall') { ctx.fillStyle = '#8d2d2d'; ctx.fillRect(lpx, lpy, ts, ts); ctx.strokeStyle = '#5d1d1d'; ctx.lineWidth = 1; for(let i=1; i<4; i++) { ctx.beginPath(); ctx.moveTo(lpx, lpy+ts*i/4); ctx.lineTo(lpx+ts, lpy+ts*i/4); ctx.stroke(); } }
        else if (id === 'street-lamp') { ctx.fillStyle = '#333'; ctx.fillRect(lpx+ts*0.4, lpy+ts*0.1, ts*0.2, ts*0.8); ctx.fillStyle = '#fbc02d'; ctx.beginPath(); ctx.arc(0, lpy+ts*0.2, ts*0.15, 0, Math.PI*2); ctx.fill(); }
        else if (id === 'hydrant') { ctx.fillStyle = '#d32f2f'; ctx.beginPath(); ctx.arc(0, 0, ts*0.3, 0, Math.PI*2); ctx.fill(); }
        else if (id === 'trash-can') { ctx.fillStyle = '#455a64'; ctx.fillRect(lpx+ts*0.25, lpy+ts*0.25, ts*0.5, ts*0.5); ctx.fillStyle = '#37474f'; ctx.fillRect(lpx+ts*0.25, lpy+ts*0.25, ts*0.5, ts*0.15); }
        else if (id === 'spawn-point') {
            // 하단 베이스 블록
            ctx.fillStyle = '#222';
            ctx.fillRect(lpx+2, lpy+2, ts-4, ts-4);
            
            // 상단 빛나는 패널 (약간 작게)
            ctx.fillStyle = '#111';
            ctx.fillRect(lpx+6, lpy+6, ts-12, ts-12);
            
            // 글로우 테두리
            ctx.strokeStyle = '#00d2ff';
            ctx.lineWidth = 2;
            ctx.strokeRect(lpx+8, lpy+8, ts-16, ts-16);
            
            // 에너지 코어 (중앙)
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, ts*0.3);
            grad.addColorStop(0, '#00d2ff');
            grad.addColorStop(0.5, 'rgba(0, 100, 255, 0.4)');
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, ts*0.3, 0, Math.PI*2);
            ctx.fill();

            // 방향 표시 (세련된 V자형 화살표)
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-ts*0.15, -ts*0.2);
            ctx.lineTo(0, -ts*0.35);
            ctx.lineTo(ts*0.15, -ts*0.2);
            ctx.stroke();
            
            // 사이드 장식 (블록 느낌)
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = '#00d2ff';
            ctx.fillRect(lpx+4, lpy+4, 4, 4);
            ctx.fillRect(lpx+ts-8, lpy+4, 4, 4);
            ctx.fillRect(lpx+4, lpy+ts-8, 4, 4);
            ctx.fillRect(lpx+ts-8, lpy+ts-8, 4, 4);
            ctx.globalAlpha = 1.0;
        }
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