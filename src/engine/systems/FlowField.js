/**
 * FlowField - 수백 명의 유닛을 위한 최적화된 경로 탐색 시스템
 * Dijkstra 알고리즘을 사용하여 목적지로부터의 거리 지도를 일괄 계산합니다.
 */
export class FlowField {
    constructor(engine) {
        this.engine = engine;
        this.cols = 0;
        this.rows = 0;
        
        // 맵 데이터 (TypedArray를 사용하여 성능 극대화)
        this.costMap = null;        // 이동 비용 (0-255)
        this.integrationMap = null; // 목적지로부터의 누적 거리
        this.flowFieldX = null;     // X 방향 벡터 (-1, 0, 1)
        this.flowFieldY = null;     // Y 방향 벡터 (-1, 0, 1)
        
        this.targetGrid = { x: -1, y: -1 };
    }

    /**
     * 타일맵 크기에 맞춰 내부 배열 초기화
     */
    init(cols, rows) {
        this.cols = cols;
        this.rows = rows;
        const size = cols * rows;
        
        this.costMap = new Uint8Array(size);
        this.integrationMap = new Float32Array(size);
        this.flowFieldX = new Int8Array(size);
        this.flowFieldY = new Int8Array(size);
        
        this.updateCostMap();
    }

    /**
     * 타일맵의 장애물 상태를 반영하여 CostMap 업데이트
     */
    updateCostMap() {
        const grid = this.engine.tileMap.grid;
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const idx = y * this.cols + x;
                // buildable이 false면 장애물로 간주 (최고 비용)
                this.costMap[idx] = grid[y][x].buildable ? 1 : 255;
            }
        }
    }

    /**
     * Dijkstra 알고리즘을 사용한 Integration Map 생성
     * @param {number} targetX 목적지 그리드 X
     * @param {number} targetY 목적지 그리드 Y
     */
    generate(targetX, targetY) {
        if (this.targetGrid.x === targetX && this.targetGrid.y === targetY) return;
        this.targetGrid = { x: targetX, y: targetY };

        const size = this.cols * this.rows;
        this.integrationMap.fill(65535); // Max value
        
        const targetIdx = targetY * this.cols + targetX;
        this.integrationMap[targetIdx] = 0;

        // Dijkstra 전용 큐 (단순 BFS 큐 사용으로 성능 최적화)
        const queue = [targetIdx];
        let head = 0;

        const neighbors = [
            { dx: 0, dy: -1, cost: 1 }, { dx: 0, dy: 1, cost: 1 },
            { dx: -1, dy: 0, cost: 1 }, { dx: 1, dy: 0, cost: 1 },
            { dx: -1, dy: -1, cost: 1.414 }, { dx: 1, dy: -1, cost: 1.414 },
            { dx: -1, dy: 1, cost: 1.414 }, { dx: 1, dy: 1, cost: 1.414 }
        ];

        // Dijkstra/BFS 루프
        while (head < queue.length) {
            const currIdx = queue[head++];
            const cx = currIdx % this.cols;
            const cy = Math.floor(currIdx / this.cols);
            const currDist = this.integrationMap[currIdx];

            for (const n of neighbors) {
                const nx = cx + n.dx;
                const ny = cy + n.dy;

                if (nx < 0 || nx >= this.cols || ny < 0 || ny >= this.rows) continue;

                const nIdx = ny * this.cols + nx;
                const cost = this.costMap[nIdx];
                if (cost === 255) continue; // 장애물

                const newDist = currDist + n.cost + (cost - 1);
                if (newDist < this.integrationMap[nIdx]) {
                    this.integrationMap[nIdx] = newDist;
                    queue.push(nIdx);
                }
            }
        }

        this.generateFlowMap();
    }

    /**
     * Integration Map을 바탕으로 각 타일의 최적 이동 방향(Vector) 계산
     */
    generateFlowMap() {
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const idx = y * this.cols + x;
                if (this.costMap[idx] === 255) continue;

                let minNeighborDist = this.integrationMap[idx];
                let bestX = 0;
                let bestY = 0;

                // 8방향 이웃 검사
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;

                        const nx = x + dx;
                        const ny = y + dy;

                        if (nx < 0 || nx >= this.cols || ny < 0 || ny >= this.rows) continue;

                        const nDist = this.integrationMap[ny * this.cols + nx];
                        if (nDist < minNeighborDist) {
                            minNeighborDist = nDist;
                            bestX = dx;
                            bestY = dy;
                        }
                    }
                }

                this.flowFieldX[idx] = bestX;
                this.flowFieldY[idx] = bestY;
            }
        }
    }

    /**
     * 월드 좌표에서 이동 방향 벡터를 가져옵니다.
     */
    getFlowVector(worldX, worldY) {
        const grid = this.engine.tileMap.worldToGrid(worldX, worldY);
        if (grid.x < 0 || grid.x >= this.cols || grid.y < 0 || grid.y >= this.rows) {
            return { x: 0, y: 0 };
        }
        const idx = grid.y * this.cols + grid.x;
        return { x: this.flowFieldX[idx], y: this.flowFieldY[idx] };
    }
}
