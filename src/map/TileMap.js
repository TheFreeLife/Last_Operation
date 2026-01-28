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
        this.fogCanvas = document.createElement('canvas');
        this.fogCanvas.width = this.cols;
        this.fogCanvas.height = this.rows;
        this.fogCtx = this.fogCanvas.getContext('2d');

        this.fogCtx.fillStyle = '#050505';
        this.fogCtx.fillRect(0, 0, this.cols, this.rows);

        this.fogImageData = this.fogCtx.createImageData(this.cols, this.rows);
        this.fogBuffer = new Uint32Array(this.fogImageData.data.buffer);
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
        if (!terrain) return '#000000'; // 바닥이 없는 경우 검은색
        switch(terrain) {
            case 'dirt': return '#3d2e1e';
            case 'grass': return '#2d4d1e';
            case 'sand': return '#c2b280';
            case 'water': return '#1e3d5a';
            default: return '#000000';
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
                        if (tile.terrain !== 'none' && tile.cachedColor !== '#000000') {
                            ctx.fillStyle = tile.cachedColor;
                            ctx.fillRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
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
        
        // 아이콘 매핑 테이블 (데이터 간소화를 위해 내부에서 관리)
        const WALL_ICONS = {
            'stone-wall': '🧱',
            'tree': '🌳',
            'rock': '🪨',
            'fence': '🚧'
        };

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `${this.tileSize * 0.7}px Arial`;

        for (let y = 0; y < this.rows; y++) {
            if (!this.layers.wall[y]) continue;
            for (let x = 0; x < this.cols; x++) {
                const wallData = this.layers.wall[y][x];
                if (wallData) {
                    if (!this.grid[y][x].visible && !(this.engine && this.engine.debugSystem && this.engine.debugSystem.isFullVision)) continue;
                    
                    const wx = x * this.tileSize;
                    const wy = y * this.tileSize;
                    
                    ctx.fillStyle = '#555';
                    ctx.fillRect(wx + 2, wy + 2, this.tileSize - 4, this.tileSize - 4);
                    
                    const icon = typeof wallData === 'string' ? WALL_ICONS[wallData] : wallData.icon;
                    if (icon) {
                        ctx.fillText(icon, wx + this.tileSize / 2, wy + this.tileSize / 2);
                    }
                }
            }
        }
        ctx.restore();
    }

    updateFogCanvas() {
        if (!this.fogCtx || !this.fogBuffer) return;
        const BLACK = 0xFF050505; 
        const GREY = 0x99000000;  
        const CLEAR = 0x00000000; 

        for (let y = 0; y < this.rows; y++) {
            const rowOffset = y * this.cols;
            for (let x = 0; x < this.cols; x++) {
                const tile = this.grid[y][x];
                if (!tile.visible) {
                    this.fogBuffer[rowOffset + x] = BLACK;
                } else if (!tile.inSight) {
                    this.fogBuffer[rowOffset + x] = GREY;
                } else {
                    this.fogBuffer[rowOffset + x] = CLEAR;
                }
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
        const x = Math.floor(worldX / this.tileSize);
        const y = Math.floor(worldY / this.tileSize);
        if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
            return { x, y, tile: this.grid[y][x] };
        }
        return null;
    }

    worldToGrid(worldX, worldY) {
        return {
            x: Math.floor(worldX / this.tileSize),
            y: Math.floor(worldY / this.tileSize)
        };
    }

    gridToWorld(gridX, gridY) {
        return {
            x: gridX * this.tileSize + this.tileSize / 2,
            y: gridY * this.tileSize + this.tileSize / 2
        };
    }

    isVisible(worldX, worldY) {
        const x = Math.floor(worldX / this.tileSize);
        const y = Math.floor(worldY / this.tileSize);
        return (this.grid[y] && this.grid[y][x]) ? this.grid[y][x].visible : false;
    }

    isInSight(worldX, worldY) {
        const x = Math.floor(worldX / this.tileSize);
        const y = Math.floor(worldY / this.tileSize);
        return (this.grid[y] && this.grid[y][x]) ? this.grid[y][x].inSight : false;
    }
}