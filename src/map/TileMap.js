export class TileMap {
    constructor(canvas, tileSize = 40) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.tileSize = tileSize;
        this.cols = 240;
        this.rows = 240;

        // [청크 설정] 20x20 타일 단위로 분할
        this.chunkSize = 20;
        this.chunksX = Math.ceil(this.cols / this.chunkSize);
        this.chunksY = Math.ceil(this.rows / this.chunkSize);
        this.chunks = [];

        // 중앙 좌표 계산
        this.centerX = Math.floor(this.cols / 2);
        this.centerY = Math.floor(this.rows / 2);

        this.grid = [];
        this.initGrid();
        this.generateTerrain();
        this.initChunks();      // 청크 시스템 초기화 (기존 offscreenCanvas 대체)
        this.initFogCanvas();
    }

    initFogCanvas() {
        this.fogCanvas = document.createElement('canvas');
        this.fogCanvas.width = this.cols;
        this.fogCanvas.height = this.rows;
        this.fogCtx = this.fogCanvas.getContext('2d');

        this.fogCtx.fillStyle = '#050505';
        this.fogCtx.fillRect(0, 0, this.cols, this.rows);

        // [최적화] ImageData 버퍼 미리 생성
        this.fogImageData = this.fogCtx.createImageData(this.cols, this.rows);
        this.fogBuffer = new Uint32Array(this.fogImageData.data.buffer);
    }

    initGrid() {
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
                    cachedColor: null
                };
            }
        }
    }

    generateTerrain() {
        const numGrassPatches = 40;
        const minRadius = 8;
        const maxRadius = 20;

        for (let i = 0; i < numGrassPatches; i++) {
            const cx = Math.floor(Math.random() * this.cols);
            const cy = Math.floor(Math.random() * this.rows);
            const radius = minRadius + Math.random() * (maxRadius - minRadius);
            const r = Math.ceil(radius);

            for (let y = -r; y <= r; y++) {
                for (let x = -r; x <= r; x++) {
                    const dist = Math.hypot(x, y);
                    const noise = (Math.random() - 0.5) * 4;
                    if (dist + noise <= radius) {
                        const nx = cx + x;
                        const ny = cy + y;
                        if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows) {
                            if (this.grid[ny][nx].type === 'empty') {
                                this.grid[ny][nx].terrain = 'fertile-soil';
                            }
                        }
                    }
                }
            }
        }

        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const tile = this.grid[y][x];
                const n1 = Math.sin(x * 0.12) * Math.cos(y * 0.15) * 4;
                const n2 = Math.sin(x * 0.5 + y * 0.3) * 2;
                const n3 = ((x * 93 + y * 71) % 5) - 2;
                const brightness = Math.round(n1 + n2 + n3);

                const baseR = tile.terrain === 'fertile-soil' ? 74 : 61;
                const baseG = tile.terrain === 'fertile-soil' ? 55 : 90;
                const baseB = tile.terrain === 'fertile-soil' ? 40 : 45;

                tile.cachedColor = `rgb(${baseR + brightness}, ${baseG + brightness}, ${baseB + brightness})`;
            }
        }
    }

    initChunks() {
        const chunkPixelSize = this.chunkSize * this.tileSize;

        for (let cy = 0; cy < this.chunksY; cy++) {
            this.chunks[cy] = [];
            for (let cx = 0; cx < this.chunksX; cx++) {
                const canvas = document.createElement('canvas');
                canvas.width = chunkPixelSize;
                canvas.height = chunkPixelSize;
                const ctx = canvas.getContext('2d');

                // 해당 청크 범위의 타일들 그리기
                const startX = cx * this.chunkSize;
                const startY = cy * this.chunkSize;

                for (let y = 0; y < this.chunkSize; y++) {
                    for (let x = 0; x < this.chunkSize; x++) {
                        const worldX = startX + x;
                        const worldY = startY + y;
                        if (worldX >= this.cols || worldY >= this.rows) continue;

                        const tile = this.grid[worldY][worldX];
                        ctx.fillStyle = tile.cachedColor;
                        ctx.fillRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
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

        // 뷰포트 컬링을 위한 가시 청크 범위 계산
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
                this.ctx.drawImage(chunk.canvas, chunk.x, chunk.y);
            }
        }
    }

    updateFogCanvas() {
        if (!this.fogCtx || !this.fogBuffer) return;

        // [최적화] Uint32Array를 사용하여 픽셀 데이터를 한 번에 조작 (RGBA 채널 개별 접근보다 빠름)
        // Little Endian 환경: ABGR 순서 (0xAABBGGRR)
        const BLACK = 0xFF050505; // 미탐사: #050505 (완전 불투명)
        const GREY = 0x99000000;  // 탐사: #000000 (60% 불투명)
        const CLEAR = 0x00000000; // 시야: 투명

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

        this.ctx.drawImage(
            this.fogCanvas,
            0, 0, this.cols, this.rows,
            0, 0, worldWidth, worldHeight
        );

        this.ctx.restore();
    }

    draw() {
        this.drawGrid();
        this.drawFog();
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
