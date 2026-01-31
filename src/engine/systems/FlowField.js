/**
 * FlowField - 수백 명의 유닛을 위한 최적화된 경로 탐색 시스템 (Web Worker 버전)
 * Size-Classing 지원: 유닛 체급별로 별도의 통과 가능 영역을 계산하여 정밀한 길찾기 제공
 */
export class FlowField {
    constructor(engine) {
        this.engine = engine;
        this.cols = 0;
        this.rows = 0;
        
        // sizeClass별 지형 비용 맵 (고정 데이터)
        this.costMaps = {};
        
        // 목적지별 유동장 데이터 (gx_gy_sc 키 사용)
        // fields[key] = { integrationMap, flowFieldX, flowFieldY, isCalculating }
        this.fields = new Map();
        
        // 최대 캐시 개수 제한 (메모리 관리)
        this.maxCachedFields = 100;

        this.worker = new Worker(new URL('./PathfindingWorker.js', import.meta.url));
        this.initWorker();
    }

    initWorker() {
        this.worker.onmessage = (e) => {
            const { type, data } = e.data;
            if (type === 'FLOW_FIELD_RESULT') {
                const { targetX, targetY, sizeClass } = data;
                const key = `${targetX}_${targetY}_${sizeClass}`;
                const field = this.fields.get(key);
                
                if (field) {
                    field.integrationMap = data.integrationMap;
                    field.flowFieldX = data.flowFieldX;
                    field.flowFieldY = data.flowFieldY;
                    field.isCalculating = false;
                    field.lastUsed = Date.now();
                }
            }
        };
    }

    init(cols, rows) {
        this.cols = cols;
        this.rows = rows;
        this.costMaps = {};
        this.fields.clear();
        
        // 표준 체급 1, 2, 3 지형 데이터 미리 준비
        [1, 2, 3].forEach(sc => this.ensureCostMap(sc));
    }

    ensureCostMap(sizeClass) {
        if (this.costMaps[sizeClass]) return;
        this.costMaps[sizeClass] = new Uint8Array(this.cols * this.rows);
        this.updateCostMap(sizeClass);
    }

    updateCostMap(sizeClass) {
        const costMap = this.costMaps[sizeClass];
        if (!costMap) return;

        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const idx = y * this.cols + x;
                costMap[idx] = this.engine.tileMap.isPassableArea(x, y, sizeClass) ? 1 : 255;
            }
        }
    }

    updateAllCostMaps() {
        [1, 2, 3].forEach(sc => this.updateCostMap(sc));
        // 지형이 변하면 기존 모든 유동장은 무효화됨
        this.fields.clear();
    }

    /**
     * 월드 좌표(목적지)를 입력받아 해당 체급의 플로우 필드 생성 및 키 반환
     */
    generate(worldX, worldY, sizeClass = 1) {
        this.ensureCostMap(sizeClass);
        
        const ts = this.engine.tileMap.tileSize;
        let gx = Math.floor(worldX / ts - (sizeClass - 1) / 2);
        let gy = Math.floor(worldY / ts - (sizeClass - 1) / 2);

        gx = Math.max(0, Math.min(this.cols - sizeClass, gx));
        gy = Math.max(0, Math.min(this.rows - sizeClass, gy));

        if (this.costMaps[sizeClass][gy * this.cols + gx] === 255) {
            const nearest = this.findNearestWalkable(gx, gy, sizeClass);
            if (nearest) {
                gx = nearest.x;
                gy = nearest.y;
            } else {
                return null;
            }
        }

        const key = `${gx}_${gy}_${sizeClass}`;
        if (this.fields.has(key)) {
            const field = this.fields.get(key);
            field.lastUsed = Date.now();
            return key;
        }

        // 캐시 용량 초과 시 가장 오래된 것 삭제
        if (this.fields.size >= this.maxCachedFields) {
            let oldestKey = null;
            let oldestTime = Infinity;
            for (const [k, v] of this.fields.entries()) {
                if (v.lastUsed < oldestTime && !v.isCalculating) {
                    oldestTime = v.lastUsed;
                    oldestKey = k;
                }
            }
            if (oldestKey) this.fields.delete(oldestKey);
        }

        const size = this.cols * this.rows;
        const newField = {
            integrationMap: new Float32Array(size),
            flowFieldX: new Int8Array(size),
            flowFieldY: new Int8Array(size),
            isCalculating: true,
            lastUsed: Date.now()
        };
        this.fields.set(key, newField);

        this.worker.postMessage({
            type: 'GENERATE_FLOW_FIELD',
            data: {
                cols: this.cols, rows: this.rows,
                targetX: gx, targetY: gy,
                sizeClass,
                costMap: this.costMaps[sizeClass],
                integrationMap: newField.integrationMap,
                flowFieldX: newField.flowFieldX,
                flowFieldY: newField.flowFieldY
            }
        }, [newField.integrationMap.buffer, newField.flowFieldX.buffer, newField.flowFieldY.buffer]);

        return key;
    }

    findNearestWalkable(tx, ty, sizeClass) {
        const costMap = this.costMaps[sizeClass];
        for (let r = 1; r <= 10; r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                    const nx = tx + dx, ny = ty + dy;
                    if (nx >= 0 && nx <= this.cols - sizeClass && ny >= 0 && ny <= this.rows - sizeClass) {
                        if (costMap[ny * this.cols + nx] !== 255) return { x: nx, y: ny };
                    }
                }
            }
        }
        return null;
    }

    getFlowVector(worldX, worldY, targetX, targetY, sizeClass = 1) {
        const ts = this.engine.tileMap.tileSize;
        
        // 목적지의 격자 좌표 계산 (생성 시와 동일한 로직)
        let tgx = Math.floor(targetX / ts - (sizeClass - 1) / 2);
        let tgy = Math.floor(targetY / ts - (sizeClass - 1) / 2);
        tgx = Math.max(0, Math.min(this.cols - sizeClass, tgx));
        tgy = Math.max(0, Math.min(this.rows - sizeClass, tgy));

        // 만약 목적지가 벽이라면 findNearestWalkable을 통해 보정된 좌표를 찾아야 함
        // 하지만 매번 계산하는 것은 비효율적이므로 key를 유닛이 들고 있게 하는 것이 좋음
        // 여기서는 일단 직접 키를 생성하여 찾음
        const key = `${tgx}_${tgy}_${sizeClass}`;
        let field = this.fields.get(key);

        // 만약 필드가 없으면 생성 요청 (보통 destination setter에서 이미 생성됨)
        if (!field) {
            this.generate(targetX, targetY, sizeClass);
            return { x: 0, y: 0 };
        }

        if (field.isCalculating || !field.flowFieldX || field.flowFieldX.byteLength === 0) {
            return { x: 0, y: 0 };
        }

        const gx = Math.floor(worldX / ts - (sizeClass - 1) / 2);
        const gy = Math.floor(worldY / ts - (sizeClass - 1) / 2);

        if (gx < 0 || gx >= this.cols || gy < 0 || gy >= this.rows) return { x: 0, y: 0 };

        // 목적지 도달 확인
        if (tgx === gx && tgy === gy) {
            return { x: 0, y: 0 };
        }

        field.lastUsed = Date.now();
        const idx = gy * this.cols + gx;
        return { x: field.flowFieldX[idx], y: field.flowFieldY[idx] };
    }
}