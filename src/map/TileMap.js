export class TileMap {
    constructor(canvas, tileSize = 40) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.tileSize = tileSize;
        this.cols = 240; // 3배 확장
        this.rows = 240;

        // 중앙 좌표 계산
        this.centerX = Math.floor(this.cols / 2);
        this.centerY = Math.floor(this.rows / 2);

        this.grid = [];
        this.initGrid();
    }

    initGrid() {
        for (let y = 0; y < this.rows; y++) {
            this.grid[y] = [];
            for (let x = 0; x < this.cols; x++) {
                this.grid[y][x] = {
                    type: 'empty',
                    occupied: false,
                    buildable: true,
                    visible: false, // 개척 여부 (Explored)
                    inSight: false  // 현재 시야 확보 여부 (In Sight)
                };
            }
        }
        
        // 중앙 총사령부 (3x3) 타일 설정
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
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

    drawGrid() {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        this.ctx.lineWidth = 1;
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const tile = this.grid[y][x];
                if (tile.visible) {
                    const px = x * this.tileSize;
                    const py = y * this.tileSize;
                    this.ctx.strokeRect(px, py, this.tileSize, this.tileSize);
                    if (tile.type === 'base') {
                        this.ctx.fillStyle = 'rgba(0, 210, 255, 0.2)';
                        this.ctx.fillRect(px, py, this.tileSize, this.tileSize);
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
        // This method is kept for backward compatibility if needed, 
        // but we will use drawGrid and drawFog separately.
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
