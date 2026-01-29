/**
 * FlowField - 수백 명의 유닛을 위한 최적화된 경로 탐색 시스템 (Web Worker 버전)
 * Size-Classing 지원: 유닛 체급별로 별도의 통과 가능 영역을 계산하여 정밀한 길찾기 제공
 */
export class FlowField {
    constructor(engine) {
        this.engine = engine;
        this.cols = 0;
        this.rows = 0;
        
        // sizeClass별 데이터 (1: 소형, 2: 대형, 3: 초대형)
        this.fields = {};
        this.calculatingClasses = new Set();
        this.targetGrids = {}; 

        this.worker = new Worker(new URL('./PathfindingWorker.js', import.meta.url));
        this.initWorker();
    }

    initWorker() {
        this.worker.onmessage = (e) => {
            const { type, data } = e.data;
            if (type === 'FLOW_FIELD_RESULT') {
                const sc = data.sizeClass || 1;
                const field = this.fields[sc];
                if (field) {
                    field.integrationMap = data.integrationMap;
                    field.flowFieldX = data.flowFieldX;
                    field.flowFieldY = data.flowFieldY;
                }
                this.calculatingClasses.delete(sc);
            }
        };
    }

    init(cols, rows) {
        this.cols = cols;
        this.rows = rows;
        this.fields = {};
        this.calculatingClasses.clear();
        this.targetGrids = {};
        
        // 표준 체급 1, 2, 3 미리 준비
        [1, 2, 3].forEach(sc => this.ensureField(sc));
    }

    ensureField(sizeClass) {
        if (this.fields[sizeClass]) return;
        const size = this.cols * this.rows;
        this.fields[sizeClass] = {
            costMap: new Uint8Array(size),
            integrationMap: new Float32Array(size),
            flowFieldX: new Int8Array(size),
            flowFieldY: new Int8Array(size)
        };
        this.updateCostMap(sizeClass);
    }

    updateCostMap(sizeClass) {
        const field = this.fields[sizeClass];
        if (!field) return;

        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const idx = y * this.cols + x;
                // 해당 격자를 "좌상단"으로 했을 때 sizeClass만큼의 면적이 모두 통과 가능한지 체크
                // (Erosion: 대형 유닛일수록 벽 주변의 통과 가능 격자가 줄어듦)
                field.costMap[idx] = this.engine.tileMap.isPassableArea(x, y, sizeClass) ? 1 : 255;
            }
        }
    }

    updateAllCostMaps() {
        [1, 2, 3].forEach(sc => this.updateCostMap(sc));
    }

    /**
     * 월드 좌표(목적지)를 입력받아 해당 체급의 플로우 필드 생성
     */
    generate(worldX, worldY, sizeClass = 1) {
        this.ensureField(sizeClass);
        const field = this.fields[sizeClass];

        // 1. 월드 중심 좌표를 해당 체급의 "참조 격자(좌상단)" 좌표로 변환
        // 공식: floor(worldCenter / tileSize - (sizeClass - 1) / 2)
        const ts = this.engine.tileMap.tileSize;
        let gx = Math.floor(worldX / ts - (sizeClass - 1) / 2);
        let gy = Math.floor(worldY / ts - (sizeClass - 1) / 2);

        // 2. 맵 범위 제한
        gx = Math.max(0, Math.min(this.cols - sizeClass, gx));
        gy = Math.max(0, Math.min(this.rows - sizeClass, gy));

        // 3. 목적지가 통과 불가능한 곳이라면 가장 가까운 빈 곳 찾기
        if (field.costMap[gy * this.cols + gx] === 255) {
            const nearest = this.findNearestWalkable(gx, gy, sizeClass);
            if (nearest) {
                gx = nearest.x;
                gy = nearest.y;
            } else {
                return; // 갈 수 있는 곳이 없음
            }
        }

        // 동일 목적지 연산 스킵
        if (this.calculatingClasses.has(sizeClass) || 
           (this.targetGrids[sizeClass] && this.targetGrids[sizeClass].x === gx && this.targetGrids[sizeClass].y === gy)) {
            return;
        }

        if (!field.integrationMap || field.integrationMap.byteLength === 0) return;

        this.targetGrids[sizeClass] = { x: gx, y: gy };
        this.calculatingClasses.add(sizeClass);

        this.worker.postMessage({
            type: 'GENERATE_FLOW_FIELD',
            data: {
                cols: this.cols, rows: this.rows,
                targetX: gx, targetY: gy,
                sizeClass,
                costMap: field.costMap,
                integrationMap: field.integrationMap,
                flowFieldX: field.flowFieldX,
                flowFieldY: field.flowFieldY
            }
        }, [field.integrationMap.buffer, field.flowFieldX.buffer, field.flowFieldY.buffer]);
    }

    findNearestWalkable(tx, ty, sizeClass) {
        const field = this.fields[sizeClass];
        for (let r = 1; r <= 10; r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                    const nx = tx + dx, ny = ty + dy;
                    if (nx >= 0 && nx <= this.cols - sizeClass && ny >= 0 && ny <= this.rows - sizeClass) {
                        if (field.costMap[ny * this.cols + nx] !== 255) return { x: nx, y: ny };
                    }
                }
            }
        }
        return null;
    }

    getFlowVector(worldX, worldY, sizeClass = 1) {
        const field = this.fields[sizeClass];
        if (!field || !field.flowFieldX || field.flowFieldX.byteLength === 0) return { x: 0, y: 0 };
        
        const ts = this.engine.tileMap.tileSize;
        const gx = Math.floor(worldX / ts - (sizeClass - 1) / 2);
        const gy = Math.floor(worldY / ts - (sizeClass - 1) / 2);

        if (gx < 0 || gx >= this.cols || gy < 0 || gy >= this.rows) return { x: 0, y: 0 };

        // 목적지에 도달했는지 확인 (targetGrids와 비교)
        const target = this.targetGrids[sizeClass];
        if (target && target.x === gx && target.y === gy) {
            return { x: 0, y: 0 };
        }

        const idx = gy * this.cols + gx;
        return { x: field.flowFieldX[idx], y: field.flowFieldY[idx] };
    }
}