export class TileMap {
    constructor(engine, canvas, tileSize = 48) {
        this.engine = engine;
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.tileSize = tileSize;
        this.cols = 64;
        this.rows = 64;

        // [청크 설정] 20x20 타일 단위로 분할
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
        if (!this.fogCanvas) {
            this.fogCanvas = document.createElement('canvas');
        }
        
        this.fogCanvas.width = this.cols;
        this.fogCanvas.height = this.rows;
        this.fogCtx = this.fogCanvas.getContext('2d');

        // 안개 초기 상태: 완전한 불투명 검은색 (미탐사)
        this.fogCtx.fillStyle = '#050505';
        this.fogCtx.fillRect(0, 0, this.cols, this.rows);

        this.fogImageData = this.fogCtx.createImageData(this.cols, this.rows);
        this.fogBuffer = new Uint32Array(this.fogImageData.data.buffer);
        
        // 버퍼 초기화 (모든 픽셀을 BLACK으로)
        const BLACK = 0xFF050505;
        this.fogBuffer.fill(BLACK);
    }

    initGrid() {
        this.grid = [];
        for (let y = 0; y < this.rows; y++) {
            this.grid[y] = [];
            for (let x = 0; x < this.cols; x++) {
                this.grid[y][x] = {
                    type: 'empty',
                    terrain: 'dirt',
                    occupied: false,
                    buildable: true,
                    visible: false,
                    inSight: false,
                    cachedColor: '#3d2e1e'
                };
            }
        }
    }

    loadFromData(data) {
        this.cols = data.width || 64;
        this.rows = data.height || 64;
        this.tileSize = data.tileSize || 48;
        
        // 통합 그리드 데이터를 내부 레이어로 분리
        this.layers = { floor: [], wall: [], unit: [] };
        this.grid = [];

        for (let y = 0; y < this.rows; y++) {
            this.grid[y] = [];
            this.layers.floor[y] = [];
            this.layers.wall[y] = [];
            this.layers.unit[y] = [];

            for (let x = 0; x < this.cols; x++) {
                const cell = data.grid[y][x]; // [floor, wall, unit]
                // 바닥이 없으면 'dirt'로 자동 보정
                const floorId = cell[0] || 'dirt'; 
                const wallId = cell[1];
                const unitData = cell[2];

                this.layers.floor[y][x] = floorId;
                this.layers.wall[y][x] = wallId;
                this.layers.unit[y][x] = unitData;
                
                this.grid[y][x] = {
                    type: 'empty',
                    terrain: floorId,
                    occupied: wallId ? true : false,
                    buildable: wallId ? false : true,
                    visible: false,
                    inSight: false,
                    cachedColor: this.getTileColor(floorId)
                };
            }
        }

        this.chunksX = Math.ceil(this.cols / this.chunkSize);
        this.chunksY = Math.ceil(this.rows / this.chunkSize);
        this.initChunks();
        this.initFogCanvas();
    }

    getTileColor(terrain) {
        if (!terrain) return '#1a1a1a'; 
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
            case 'road-line-white': return '#282828';
            case 'road-line-yellow': return '#282828';
            case 'crosswalk': return '#282828';
            case 'curb-h': return '#282828';
            case 'curb-v': return '#282828';
            default: return '#1a1a1a';
        }
    }

    initChunks() {
        const chunkPixelSize = this.chunkSize * this.tileSize;
        this.chunks = [];

        for (let cy = 0; cy < this.chunksY; cy++) {
            this.chunks[cy] = [];
            for (let cx = 0; cx < this.chunksX; cx++) {
                const canvas = document.createElement('canvas');
                canvas.width = chunkPixelSize;
                canvas.height = chunkPixelSize;
                const ctx = canvas.getContext('2d');

                const startX = cx * this.chunkSize;
                const startY = cy * this.chunkSize;

                for (let y = 0; y < this.chunkSize; y++) {
                    for (let x = 0; x < this.chunkSize; x++) {
                        const worldX = startX + x;
                        const worldY = startY + y;
                        if (worldX >= this.cols || worldY >= this.rows) continue;

                        const tile = this.grid[worldY][worldX];
                        if (tile.terrain !== 'none') {
                            this.drawTileTexture(ctx, x * this.tileSize, y * this.tileSize, tile.terrain);
                        }
                    }
                }

                this.chunks[cy][cx] = {
                    canvas: canvas,
                    x: startX * this.tileSize,
                    y: startY * this.tileSize
                };
            }
        }
    }

    drawTileTexture(ctx, px, py, terrain) {
        const ts = this.tileSize;
        const color = this.getTileColor(terrain);
        
        ctx.fillStyle = color;
        ctx.fillRect(px, py, ts, ts);

        ctx.save();
        
        if (['asphalt', 'road-line-white', 'road-line-yellow', 'crosswalk', 'curb-h', 'curb-v'].includes(terrain)) {
            ctx.globalAlpha = 0.15;
            ctx.fillStyle = '#ffffff';
            for(let i=0; i<8; i++) {
                ctx.fillRect(px + Math.abs(Math.sin(px+i))*ts, py + Math.abs(Math.cos(py+i))*ts, 1, 1);
            }
            if ((px + py) % 11 === 0) {
                ctx.strokeStyle = 'rgba(0,0,0,0.4)';
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(px + ts*0.1, py + ts*0.1);
                ctx.lineTo(px + ts*0.3, py + ts*0.4);
                ctx.stroke();
            }
            ctx.globalAlpha = 0.6;
            if (terrain === 'road-line-white') {
                ctx.fillStyle = '#b0b0b0';
                ctx.fillRect(px + ts*0.46, py, ts*0.08, ts);
            } else if (terrain === 'road-line-yellow') {
                ctx.fillStyle = '#907020';
                ctx.fillRect(px + ts*0.46, py, ts*0.08, ts);
            } else if (terrain === 'crosswalk') {
                ctx.fillStyle = '#b0b0b0'; // 바랜 흰색
                // 2개의 굵은 선으로 변경하여 세로 연결 시 간격이 일정하도록 조정
                // 선 두께 0.25, 간격 0.25로 설정하면 (0.125 여백 + 0.25 선 + 0.25 간격 + 0.25 선 + 0.125 여백 = 1.0)
                const stripH = ts * 0.25;
                ctx.fillRect(px, py + ts * 0.125, ts, stripH);
                ctx.fillRect(px, py + ts * 0.625, ts, stripH);
            } else if (terrain === 'curb-h') {
                ctx.fillStyle = '#555555'; ctx.fillRect(px, py, ts, ts*0.4);
                ctx.fillStyle = '#777777'; ctx.fillRect(px, py + ts*0.4, ts, ts*0.1);
                ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(px, py + ts*0.5, ts, ts*0.05);
            } else if (terrain === 'curb-v') {
                ctx.fillStyle = '#555555'; ctx.fillRect(px, py, ts*0.4, ts);
                ctx.fillStyle = '#777777'; ctx.fillRect(px + ts*0.4, py, ts*0.1, ts);
                ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(px + ts*0.5, py, ts*0.05, ts);
            }
        } 
        else if (['sidewalk', 'concrete', 'tactile-paving', 'brick-floor', 'metal-plate'].includes(terrain)) {
            ctx.globalAlpha = 0.2;
            if (terrain === 'sidewalk') {
                ctx.strokeStyle = 'rgba(0,0,0,0.3)';
                ctx.strokeRect(px + 1, py + 1, ts - 2, ts - 2);
                ctx.beginPath();
                ctx.moveTo(px + ts/2, py); ctx.lineTo(px + ts/2, py + ts);
                ctx.moveTo(px, py + ts/2); ctx.lineTo(px + ts, py + ts/2);
                ctx.stroke();
            } else if (terrain === 'tactile-paving') {
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                for (let ix = 1; ix <= 3; ix++) {
                    for (let iy = 1; iy <= 3; iy++) {
                        ctx.beginPath();
                        ctx.arc(px + ts*ix/4, py + ts*iy/4, 1.5, 0, Math.PI*2);
                        ctx.fill();
                    }
                }
            } else if (terrain === 'brick-floor') {
                ctx.strokeStyle = 'rgba(0,0,0,0.4)';
                ctx.beginPath();
                ctx.moveTo(px, py + ts/2); ctx.lineTo(px + ts, py + ts/2);
                ctx.stroke();
            } else if (terrain === 'metal-plate') {
                ctx.strokeStyle = '#222222';
                ctx.strokeRect(px + 4, py + 4, ts - 8, ts - 8);
                ctx.fillStyle = '#111111';
                ctx.fillRect(px + 6, py + 6, 2, 2);
                ctx.fillRect(px + ts - 8, py + 6, 2, 2);
                ctx.fillRect(px + 6, py + ts - 8, 2, 2);
                ctx.fillRect(px + ts - 8, py + ts - 8, 2, 2);
            } else if (terrain === 'concrete') {
                ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                ctx.strokeRect(px, py, ts, ts);
            }
        }
        else {
            this.drawNaturalTexture(ctx, px, py, terrain, ts);
        }

        ctx.globalAlpha = 0.05;
        ctx.strokeStyle = '#000000';
        ctx.strokeRect(px, py, ts, ts);
        ctx.restore();
    }

    drawNaturalTexture(ctx, px, py, terrain, ts) {
        ctx.save();
        ctx.globalAlpha = 0.15;
        
        // 좌표 기반의 간단한 시드 생성 (타일 위치가 같으면 항상 같은 랜덤값 반환)
        const seed = (x, y) => {
            const h = (x * 374761393 + y * 668265263) ^ 0x12345;
            return (Math.abs(Math.sin(h)) * 10000) % 1;
        };

        if (terrain === 'grass') {
            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < 3; i++) {
                // Math.random() 대신 seed() 사용
                const rx = px + 5 + seed(px + i, py) * (ts - 10);
                const ry = py + 5 + seed(px, py + i) * (ts - 10);
                ctx.fillRect(rx, ry, 2, 4);
            }
        } else if (terrain === 'dirt') {
            ctx.fillStyle = '#000000';
            for (let i = 0; i < 5; i++) {
                const rx = px + seed(px + i, py) * ts;
                const ry = py + seed(px, py + i) * ts;
                ctx.fillRect(rx, ry, 1, 1);
            }
        } else if (terrain === 'sand') {
            ctx.strokeStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(px, py + ts/2);
            ctx.quadraticCurveTo(px + ts/4, py + ts/4, px + ts/2, py + ts/2);
            ctx.stroke();
        } else if (terrain === 'water') {
            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            ctx.fillRect(px + ts * 0.1, py + ts * 0.1, ts * 0.8, ts * 0.1);
            ctx.fillRect(px + ts * 0.2, py + ts * 0.5, ts * 0.6, ts * 0.1);
        } else if (terrain === 'fertile-soil') {
            ctx.fillStyle = '#1a140d';
            for (let i = 1; i < 4; i++) {
                ctx.fillRect(px + 2, py + (ts/4)*i, ts - 4, 1);
            }
        }
        ctx.restore();
    }

    drawGrid(camera) {
        if (!camera) return;
        const chunkPixelSize = this.chunkSize * this.tileSize;
        const viewportLeft = -camera.x / camera.zoom;
        const viewportTop = -camera.y / camera.zoom;
        const viewportRight = viewportLeft + this.canvas.width / camera.zoom;
        const viewportBottom = viewportTop + this.canvas.height / camera.zoom;

        const startCX = Math.max(0, Math.floor(viewportLeft / chunkPixelSize));
        const endCX = Math.min(this.chunksX - 1, Math.floor(viewportRight / chunkPixelSize));
        const startCY = Math.max(0, Math.floor(viewportTop / chunkPixelSize));
        const endCY = Math.min(this.chunksY - 1, Math.floor(viewportBottom / chunkPixelSize));

        for (let cy = startCY; cy <= endCY; cy++) {
            for (let cx = startCX; cx <= endCX; cx++) {
                const chunk = this.chunks[cy][cx];
                if (chunk) this.ctx.drawImage(chunk.canvas, chunk.x, chunk.y);
            }
        }
    }

    drawWalls(ctx) {
        if (!this.layers || !this.layers.wall) return;
        
        for (let y = 0; y < this.rows; y++) {
            if (!this.layers.wall[y]) continue;
            for (let x = 0; x < this.cols; x++) {
                const wallData = this.layers.wall[y][x];
                if (wallData) {
                    if (!this.grid[y][x].visible && !(this.engine && this.engine.debugSystem && this.engine.debugSystem.isFullVision)) continue;
                    
                    const wx = x * this.tileSize;
                    const wy = y * this.tileSize;
                    const wallId = typeof wallData === 'string' ? wallData : wallData.id;

                    this.drawSingleWall(ctx, wallId, wx, wy, this.tileSize);
                }
            }
        }
    }

    drawSingleWall(ctx, wallId, px, py, ts) {
        ctx.save();
        
        if (wallId === 'tree') {
            ctx.fillStyle = '#3d2b1f';
            ctx.fillRect(px + ts*0.4, py + ts*0.6, ts*0.2, ts*0.3);
            ctx.fillStyle = '#2d4d1e';
            ctx.beginPath();
            ctx.arc(px + ts/2, py + ts*0.4, ts*0.35, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#3a5a2a';
            ctx.beginPath();
            ctx.arc(px + ts*0.4, py + ts*0.35, ts*0.15, 0, Math.PI * 2);
            ctx.fill();
        } else if (wallId === 'stone-wall') {
            ctx.fillStyle = '#2a2a2a';
            ctx.fillRect(px, py, ts, ts);
            const drawStone = (x, y, w, h, baseColor) => {
                ctx.fillStyle = baseColor;
                ctx.fillRect(px + x, py + y, w - 1, h - 1);
                ctx.strokeStyle = 'rgba(255,255,255,0.08)';
                ctx.strokeRect(px + x + 1, py + y + 1, w - 3, h - 3);
                ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                ctx.beginPath();
                ctx.moveTo(px + x, py + y + h - 1);
                ctx.lineTo(px + x + w - 1, py + y + h - 1);
                ctx.lineTo(px + x + w - 1, py + y);
                ctx.stroke();
            };
            drawStone(0, 0, ts * 0.65, ts * 0.45, '#4a4a48');
            drawStone(ts * 0.65, 0, ts * 0.35, ts * 0.45, '#525250');
            drawStone(0, ts * 0.45, ts * 0.35, ts * 0.55, '#454543');
            drawStone(ts * 0.35, ts * 0.45, ts * 0.65, ts * 0.55, '#4e4e4c');
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            for(let i = 0; i < 12; i++) {
                const rx = Math.abs(Math.sin(px + i)) * ts;
                const ry = Math.abs(Math.cos(py + i)) * ts;
                ctx.fillRect(px + rx, py + ry, 1, 1);
            }
        } else if (wallId === 'rock') {
            ctx.fillStyle = '#777777';
            ctx.beginPath();
            ctx.moveTo(px + ts*0.2, py + ts*0.8);
            ctx.lineTo(px + ts*0.1, py + ts*0.4);
            ctx.lineTo(px + ts*0.4, py + ts*0.1);
            ctx.lineTo(px + ts*0.8, py + ts*0.2);
            ctx.lineTo(px + ts*0.9, py + ts*0.7);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#999999';
            ctx.beginPath();
            ctx.moveTo(px + ts*0.4, py + ts*0.1);
            ctx.lineTo(px + ts*0.6, py + ts*0.3);
            ctx.lineTo(px + ts*0.4, py + ts*0.4);
            ctx.fill();
        } else if (wallId === 'fence') {
            ctx.strokeStyle = '#6d4c41';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(px, py + ts*0.3); ctx.lineTo(px + ts, py + ts*0.3);
            ctx.moveTo(px, py + ts*0.7); ctx.lineTo(px + ts, py + ts*0.7);
            ctx.stroke();
            ctx.lineWidth = 2;
            ctx.beginPath();
            for(let i=1; i<=3; i++) {
                ctx.moveTo(px + ts*i/4, py + ts*0.1);
                ctx.lineTo(px + ts*i/4, py + ts*0.9);
            }
            ctx.stroke();
        } else if (wallId === 'concrete-wall') {
            ctx.fillStyle = '#666666';
            ctx.fillRect(px, py, ts, ts);
            ctx.strokeStyle = '#444444';
            ctx.lineWidth = 2;
            ctx.strokeRect(px + 2, py + 2, ts - 4, ts - 4);
            ctx.beginPath();
            ctx.moveTo(px + ts/2, py + 2); ctx.lineTo(px + ts/2, py + ts - 2);
            ctx.stroke();
            ctx.fillStyle = '#333333';
            ctx.beginPath();
            ctx.arc(px + ts*0.25, py + ts*0.25, 2, 0, Math.PI*2);
            ctx.arc(px + ts*0.75, py + ts*0.25, 2, 0, Math.PI*2);
            ctx.arc(px + ts*0.25, py + ts*0.75, 2, 0, Math.PI*2);
            ctx.arc(px + ts*0.75, py + ts*0.75, 2, 0, Math.PI*2);
            ctx.fill();
        } else if (wallId === 'sandbag') {
            ctx.fillStyle = '#c2b280';
            const bagW = ts * 0.45, bagH = ts * 0.25;
            ctx.fillRect(px + ts*0.02, py + ts*0.6, bagW, bagH);
            ctx.fillRect(px + ts*0.52, py + ts*0.6, bagW, bagH);
            ctx.fillRect(px + ts*0.27, py + ts*0.3, bagW, bagH);
            ctx.strokeStyle = '#a6956d';
            ctx.lineWidth = 1;
            ctx.strokeRect(px + ts*0.02, py + ts*0.6, bagW, bagH);
            ctx.strokeRect(px + ts*0.52, py + ts*0.6, bagW, bagH);
            ctx.strokeRect(px + ts*0.27, py + ts*0.3, bagW, bagH);
        } else if (wallId === 'barricade') {
            ctx.strokeStyle = '#333333';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(px + 5, py + 5); ctx.lineTo(px + ts - 5, py + ts - 5);
            ctx.moveTo(px + ts - 5, py + 5); ctx.lineTo(px + 5, py + ts - 5);
            ctx.stroke();
            ctx.strokeStyle = '#fbc02d';
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
        } else if (wallId === 'brick-wall') {
            ctx.fillStyle = '#8d2d2d';
            ctx.fillRect(px, py, ts, ts);
            ctx.strokeStyle = '#5d1d1d';
            ctx.lineWidth = 1;
            for(let i=1; i<4; i++) {
                ctx.beginPath();
                ctx.moveTo(px, py + ts*i/4); ctx.lineTo(px + ts, py + ts*i/4);
                ctx.stroke();
            }
        } else if (wallId === 'street-lamp') {
            ctx.fillStyle = '#333333';
            ctx.fillRect(px + ts*0.4, py + ts*0.1, ts*0.2, ts*0.8);
            ctx.fillStyle = '#fbc02d';
            ctx.beginPath();
            ctx.arc(px + ts/2, py + ts*0.2, ts*0.15, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = 'rgba(251, 192, 45, 0.2)';
            ctx.beginPath();
            ctx.arc(px + ts/2, py + ts*0.2, ts*0.4, 0, Math.PI*2);
            ctx.fill();
        } else if (wallId === 'hydrant') {
            ctx.fillStyle = '#d32f2f';
            ctx.beginPath();
            ctx.arc(px + ts/2, py + ts/2, ts*0.3, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = '#b71c1c';
            ctx.fillRect(px + ts*0.3, py + ts*0.4, ts*0.4, ts*0.2);
        } else if (wallId === 'trash-can') {
            ctx.fillStyle = '#455a64';
            ctx.fillRect(px + ts*0.25, py + ts*0.25, ts*0.5, ts*0.5);
            ctx.fillStyle = '#37474f';
            ctx.fillRect(px + ts*0.25, py + ts*0.25, ts*0.5, ts*0.15);
        }

        ctx.restore();
    }

    updateFogCanvas() {
        if (!this.fogCtx || !this.fogBuffer) return;
        const BLACK = 0xFF050505, GREY = 0x99000000, CLEAR = 0x00000000;
        for (let y = 0; y < this.rows; y++) {
            const rowOffset = y * this.cols;
            for (let x = 0; x < this.cols; x++) {
                const tile = this.grid[y][x];
                if (!tile.visible) this.fogBuffer[rowOffset + x] = BLACK;
                else if (!tile.inSight) this.fogBuffer[rowOffset + x] = GREY;
                else this.fogBuffer[rowOffset + x] = CLEAR;
            }
        }
        this.fogCtx.putImageData(this.fogImageData, 0, 0);
    }

    drawFog(camera) {
        if (!camera || !this.fogCanvas) return;
        this.ctx.save();
        this.ctx.imageSmoothingEnabled = false;
        const worldWidth = this.cols * this.tileSize;
        const worldHeight = this.rows * this.tileSize;
        this.ctx.drawImage(this.fogCanvas, 0, 0, this.cols, this.rows, 0, 0, worldWidth, worldHeight);
        this.ctx.restore();
    }

    getTileAt(worldX, worldY) {
        const x = Math.floor(worldX / this.tileSize), y = Math.floor(worldY / this.tileSize);
        if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) return { x, y, tile: this.grid[y][x] };
        return null;
    }

    worldToGrid(worldX, worldY) {
        return { x: Math.floor(worldX / this.tileSize), y: Math.floor(worldY / this.tileSize) };
    }

    gridToWorld(gridX, gridY) {
        return { x: gridX * this.tileSize + this.tileSize / 2, y: gridY * this.tileSize + this.tileSize / 2 };
    }

    isVisible(worldX, worldY) {
        const x = Math.floor(worldX / this.tileSize), y = Math.floor(worldY / this.tileSize);
        return (this.grid[y] && this.grid[y][x]) ? this.grid[y][x].visible : false;
    }

    isInSight(worldX, worldY) {
        const x = Math.floor(worldX / this.tileSize), y = Math.floor(worldY / this.tileSize);
        return (this.grid[y] && this.grid[y][x]) ? this.grid[y][x].inSight : false;
    }
}
