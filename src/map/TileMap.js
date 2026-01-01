export class TileMap {
    constructor(canvas, tileSize = 40) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.tileSize = tileSize;
        this.cols = 240; 
        this.rows = 240;

        // 중앙 좌표 계산
        this.centerX = Math.floor(this.cols / 2);
        this.centerY = Math.floor(this.rows / 2);

        this.grid = [];
        this.initGrid();
        this.generateTerrain(); // 지형 생성 추가
    }

    initGrid() {
        for (let y = 0; y < this.rows; y++) {
            this.grid[y] = [];
            for (let x = 0; x < this.cols; x++) {
                this.grid[y][x] = {
                    type: 'empty',
                    terrain: 'dirt', // 기본 지형
                    occupied: false,
                    buildable: true,
                    visible: false, 
                    inSight: false
                };
            }
        }
        
        // 중앙 총사령부 (5x5) 타일 설정
        for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                const nx = this.centerX + dx;
                const ny = this.centerY + dy;
                if (ny >= 0 && ny < this.rows && nx >= 0 && nx < this.cols) {
                    this.grid[ny][nx].type = 'base';
                    this.grid[ny][nx].occupied = true;
                    this.grid[ny][nx].buildable = false;
                    this.grid[ny][nx].visible = true;
                    this.grid[ny][nx].inSight = true;
                }
            }
        }
    }

    generateTerrain() {
        // 잔디 초원 생성 (큼지막한 덩어리)
        const numGrassPatches = 40; // 덩어리 개수
        const minRadius = 8;
        const maxRadius = 20;

        for (let i = 0; i < numGrassPatches; i++) {
            const cx = Math.floor(Math.random() * this.cols);
            const cy = Math.floor(Math.random() * this.rows);
            const radius = minRadius + Math.random() * (maxRadius - minRadius);
            const r = Math.ceil(radius);

            // 불규칙한 원형 덩어리 생성
            for (let y = -r; y <= r; y++) {
                for (let x = -r; x <= r; x++) {
                    const dist = Math.hypot(x, y);
                    // 노이즈를 추가하여 가장자리를 자연스럽게
                    const noise = (Math.random() - 0.5) * 4; 
                    if (dist + noise <= radius) {
                        const nx = cx + x;
                        const ny = cy + y;
                        if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows) {
                            // 이미 다른 중요한 것(베이스 등)이 없다면 비옥한 토지로 설정
                            if (this.grid[ny][nx].type === 'empty') {
                                this.grid[ny][nx].terrain = 'fertile-soil';
                            }
                        }
                    }
                }
            }
        }
    }

    drawGrid() {
        this.ctx.lineWidth = 1;
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const tile = this.grid[y][x];
                // 시야에 보이거나 탐험된 지역만 그림
                if (tile.visible) {
                    const px = x * this.tileSize;
                    const py = y * this.tileSize;

                    // 1. 지형 렌더링
                    if (tile.terrain === 'fertile-soil') {
                        this.ctx.fillStyle = '#5d4037'; // 비옥한 흙색 (Dark Brown)
                        this.ctx.fillRect(px, py, this.tileSize, this.tileSize);
                        this.ctx.strokeStyle = '#4e342e'; // 경계
                    } else {
                        // 기본 흙바닥 (Dirt)
                        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
                    }
                    this.ctx.strokeRect(px, py, this.tileSize, this.tileSize);

                    // 2. 특수 타일 오버레이
                    if (tile.type === 'base') {
                        this.ctx.fillStyle = 'rgba(0, 210, 255, 0.2)';
                        this.ctx.fillRect(px, py, this.tileSize, this.tileSize);
                    } else if (tile.type === 'resource') {
                        // 자원 타일 표시 (선택적)
                        // this.ctx.fillStyle = 'rgba(255, 215, 0, 0.1)';
                        // this.ctx.fillRect(px, py, this.tileSize, this.tileSize);
                    }
                }
            }
        }
    }

    drawFog() {
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const tile = this.grid[y][x];
                const px = x * this.tileSize;
                const py = y * this.tileSize;

                if (!tile.visible) {
                    // 1. 미개척 지역 (완전 어둠)
                    this.ctx.fillStyle = '#050505';
                    this.ctx.fillRect(px, py, this.tileSize, this.tileSize);
                } else if (!tile.inSight) {
                    // 2. 개척되었으나 시야 밖 (연한 안개)
                    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                    this.ctx.fillRect(px, py, this.tileSize, this.tileSize);
                }
            }
        }
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
}