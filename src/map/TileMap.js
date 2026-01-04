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
                    terrain: 'dirt',
                    occupied: false,
                    buildable: true,
                    visible: false, 
                    inSight: false,
                    cachedColor: null // 렌더링 최적화를 위한 색상 캐시
                };
            }
        }

        // 중앙 총사령부 (9x6) 타일 설정
        for (let dy = -3; dy <= 2; dy++) {
            for (let dx = -4; dx <= 4; dx++) {
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
        // 1. 잔디 초원 및 흙 지형 생성 (큼지막한 덩어리)
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

        // 2. 모든 타일의 색상을 미리 계산 (최적화)
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const tile = this.grid[y][x];
                // 유기적 패턴을 위한 노이즈 연산
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

    drawGrid(camera) {
        if (!camera) return;

        // 현재 시야에 보이는 타일 범위 계산 (Culling)
        const startX = Math.max(0, Math.floor(-camera.x / (this.tileSize * camera.zoom)));
        const startY = Math.max(0, Math.floor(-camera.y / (this.tileSize * camera.zoom)));
        const endX = Math.min(this.cols, Math.ceil((this.canvas.width - camera.x) / (this.tileSize * camera.zoom)));
        const endY = Math.min(this.rows, Math.ceil((this.canvas.height - camera.y) / (this.tileSize * camera.zoom)));

        // 1. 전체 영역을 기본 지형 색상으로 먼저 채움 (틈새 방지용 베이스)
        this.ctx.fillStyle = '#3d5a2d';
        this.ctx.fillRect(startX * this.tileSize, startY * this.tileSize, (endX - startX) * this.tileSize, (endY - startY) * this.tileSize);

        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const tile = this.grid[y][x];
                if (tile.visible) {
                    const px = x * this.tileSize;
                    const py = y * this.tileSize;

                    // 미리 캐싱된 색상 사용 (연산량 0)
                    this.ctx.fillStyle = tile.cachedColor;
                    this.ctx.fillRect(px, py, this.tileSize + 1.0, this.tileSize + 1.0);

                    // 베이스 타일 석조 바닥 효과 (불투명)
                    if (tile.type === 'base') {
                        this.ctx.fillStyle = '#7f8c8d'; // 불투명한 석재 회색
                        this.ctx.fillRect(px, py, this.tileSize + 1.0, this.tileSize + 1.0);
                    }
                }
            }
        }
    }

    drawFog(camera) {
        if (!camera) return;

        const startX = Math.max(0, Math.floor(-camera.x / (this.tileSize * camera.zoom)));
        const startY = Math.max(0, Math.floor(-camera.y / (this.tileSize * camera.zoom)));
        const endX = Math.min(this.cols, Math.ceil((this.canvas.width - camera.x) / (this.tileSize * camera.zoom)));
        const endY = Math.min(this.rows, Math.ceil((this.canvas.height - camera.y) / (this.tileSize * camera.zoom)));

        // 1. 시야 밖(반투명 안개) 그리기
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        this.ctx.beginPath();
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                // 탐사되었지만 현재 시야에 없는 타일들만 경로에 추가
                if (this.grid[y][x].visible && !this.grid[y][x].inSight) {
                    this.ctx.rect(x * this.tileSize, y * this.tileSize, this.tileSize + 0.5, this.tileSize + 0.5);
                }
            }
        }
        this.ctx.fill(); // 한 번에 채우기 (겹침으로 인한 격자 방지)
        this.ctx.restore();

        // 2. 미탐사 지역(완전 검정 안개) 그리기
        this.ctx.save();
        this.ctx.fillStyle = '#050505';
        this.ctx.beginPath();
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                if (!this.grid[y][x].visible) {
                    this.ctx.rect(x * this.tileSize, y * this.tileSize, this.tileSize + 0.5, this.tileSize + 0.5);
                }
            }
        }
        this.ctx.fill();
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
}