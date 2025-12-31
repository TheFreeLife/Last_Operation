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
                    visible: false // 안개 유무
                };
            }
        }
        // 중앙 기지 타일 설정
        this.grid[this.centerY][this.centerX].type = 'base';
        this.grid[this.centerY][this.centerX].occupied = true;
        this.grid[this.centerY][this.centerX].buildable = false;
        this.grid[this.centerY][this.centerX].visible = true;
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
        this.ctx.fillStyle = '#050505';
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                if (!this.grid[y][x].visible) {
                    this.ctx.fillRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
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
