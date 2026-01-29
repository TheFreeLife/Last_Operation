/**
 * FlowField - 수백 명의 유닛을 위한 최적화된 경로 탐색 시스템 (Web Worker 버전)
 */
export class FlowField {
    constructor(engine) {
        this.engine = engine;
        this.cols = 0;
        this.rows = 0;
        
        this.costMap = null;
        this.integrationMap = null;
        this.flowFieldX = null;
        this.flowFieldY = null;
        
        this.isCalculating = false;
        this.targetGrid = { x: -1, y: -1 };

        // Web Worker 초기화
        this.worker = new Worker(new URL('./PathfindingWorker.js', import.meta.url));
        this.initWorker();
    }

    initWorker() {
        this.worker.onmessage = (e) => {
            const { type, data } = e.data;
            if (type === 'FLOW_FIELD_RESULT') {
                // 워커로부터 전송받은 버퍼를 다시 멤버 변수로 할당 (복사 없이 소유권 이전)
                this.integrationMap = data.integrationMap;
                this.flowFieldX = data.flowFieldX;
                this.flowFieldY = data.flowFieldY;
                this.isCalculating = false;
            }
        };
    }

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

    updateCostMap() {
        const grid = this.engine.tileMap.grid;
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const idx = y * this.cols + x;
                this.costMap[idx] = grid[y][x].buildable ? 1 : 255;
            }
        }
    }

    generate(targetX, targetY) {
        // 이미 연산 중이거나 동일한 목적지면 스킵
        if (this.isCalculating || (this.targetGrid.x === targetX && this.targetGrid.y === targetY)) return;
        
        // TypedArray의 buffer가 유효한지 체크 (Transfer 중에는 byteLength가 0이 됨)
        if (!this.integrationMap || this.integrationMap.byteLength === 0) return;

        this.targetGrid = { x: targetX, y: targetY };
        this.isCalculating = true;

        const data = {
            cols: this.cols,
            rows: this.rows,
            targetX, targetY,
            costMap: this.costMap, // costMap은 전송하지 않고 복사함 (읽기 전용)
            integrationMap: this.integrationMap,
            flowFieldX: this.flowFieldX,
            flowFieldY: this.flowFieldY
        };

        // Transferable Objects 리스트: integrationMap, flowFieldX, flowFieldY의 buffer 소유권을 워커로 넘김
        this.worker.postMessage({
            type: 'GENERATE_FLOW_FIELD',
            data
        }, [this.integrationMap.buffer, this.flowFieldX.buffer, this.flowFieldY.buffer]);
    }

    getFlowVector(worldX, worldY) {
        // 연산 중에는 이전 데이터를 참조할 수 없으므로 안전 처리
        if (!this.flowFieldX || this.flowFieldX.byteLength === 0) {
            return { x: 0, y: 0 };
        }
        
        const grid = this.engine.tileMap.worldToGrid(worldX, worldY);
        if (grid.x < 0 || grid.x >= this.cols || grid.y < 0 || grid.y >= this.rows) {
            return { x: 0, y: 0 };
        }
        const idx = grid.y * this.cols + grid.x;
        return { x: this.flowFieldX[idx], y: this.flowFieldY[idx] };
    }
}
