/**
 * SpatialGrid - 공간 분할 자료구조
 * 맵을 그리드로 나누어 엔티티를 효율적으로 검색
 * 충돌 검사 및 범위 검색 성능을 O(n²)에서 O(k)로 개선 (k << n)
 */
export class SpatialGrid {
    constructor(cellSize = 100) {
        this.cellSize = cellSize;
        this.grid = new Map(); // key: "x,y", value: Set<Entity>
    }

    /**
     * 월드 좌표를 그리드 좌표로 변환
     */
    _getCell(x, y) {
        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        return `${cellX},${cellY}`;
    }

    /**
     * 엔티티를 그리드에 추가
     */
    add(entity) {
        if (!entity || entity.x === undefined || entity.y === undefined) return;

        const cellKey = this._getCell(entity.x, entity.y);
        if (!this.grid.has(cellKey)) {
            this.grid.set(cellKey, new Set());
        }
        this.grid.get(cellKey).add(entity);

        // 엔티티가 속한 셀 저장 (나중에 제거 시 사용)
        entity._spatialCell = cellKey;
    }

    /**
     * 엔티티를 그리드에서 제거
     */
    remove(entity) {
        if (!entity || !entity._spatialCell) return;

        const cell = this.grid.get(entity._spatialCell);
        if (cell) {
            cell.delete(entity);
            if (cell.size === 0) {
                this.grid.delete(entity._spatialCell);
            }
        }
        entity._spatialCell = null;
    }

    /**
     * 엔티티 위치 업데이트
     * 셀이 바뀌었으면 재등록
     */
    update(entity) {
        if (!entity || entity.x === undefined || entity.y === undefined) return;

        const newCellKey = this._getCell(entity.x, entity.y);

        // 셀이 바뀌지 않았으면 아무것도 안 함
        if (entity._spatialCell === newCellKey) return;

        // 기존 셀에서 제거하고 새 셀에 추가
        this.remove(entity);
        this.add(entity);
    }

    /**
     * 특정 위치 주변의 엔티티 검색
     * @param {number} x - 중심 X 좌표
     * @param {number} y - 중심 Y 좌표
     * @param {number} radius - 검색 반경
     * @param {function} filter - 필터 함수 (옵션)
     * @returns {Array} 반경 내의 엔티티 배열
     */
    getNearby(x, y, radius, filter = null) {
        const results = [];
        const radiusSq = radius * radius;

        // 검색 범위에 포함되는 셀들 계산
        const minCellX = Math.floor((x - radius) / this.cellSize);
        const maxCellX = Math.floor((x + radius) / this.cellSize);
        const minCellY = Math.floor((y - radius) / this.cellSize);
        const maxCellY = Math.floor((y + radius) / this.cellSize);

        // 해당 셀들을 순회하며 엔티티 수집
        for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
            for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
                const cellKey = `${cellX},${cellY}`;
                const cell = this.grid.get(cellKey);

                if (!cell) continue;

                for (const entity of cell) {
                    if (!entity.active) continue;

                    // 실제 거리 확인 (원형 범위)
                    const dx = entity.x - x;
                    const dy = entity.y - y;
                    if (dx * dx + dy * dy <= radiusSq) {
                        if (!filter || filter(entity)) {
                            results.push(entity);
                        }
                    }
                }
            }
        }

        return results;
    }

    /**
     * 직사각형 영역 내의 엔티티 검색
     * @param {number} left - 좌측 경계
     * @param {number} top - 상단 경계
     * @param {number} right - 우측 경계
     * @param {number} bottom - 하단 경계
     * @param {function} filter - 필터 함수 (옵션)
     * @returns {Array} 영역 내의 엔티티 배열
     */
    getInRect(left, top, right, bottom, filter = null) {
        const results = [];

        const minCellX = Math.floor(left / this.cellSize);
        const maxCellX = Math.floor(right / this.cellSize);
        const minCellY = Math.floor(top / this.cellSize);
        const maxCellY = Math.floor(bottom / this.cellSize);

        for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
            for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
                const cellKey = `${cellX},${cellY}`;
                const cell = this.grid.get(cellKey);

                if (!cell) continue;

                for (const entity of cell) {
                    if (!entity.active) continue;

                    if (entity.x >= left && entity.x <= right &&
                        entity.y >= top && entity.y <= bottom) {
                        if (!filter || filter(entity)) {
                            results.push(entity);
                        }
                    }
                }
            }
        }

        return results;
    }

    /**
     * 모든 엔티티 반환
     */
    getAll() {
        const results = [];
        for (const cell of this.grid.values()) {
            for (const entity of cell) {
                if (entity.active) {
                    results.push(entity);
                }
            }
        }
        return results;
    }

    /**
     * 그리드 초기화
     */
    clear() {
        this.grid.clear();
    }

    /**
     * 디버그: 그리드 상태 출력
     */
    debug() {
        console.log(`SpatialGrid: ${this.grid.size} cells, cellSize: ${this.cellSize}`);
        let totalEntities = 0;
        for (const cell of this.grid.values()) {
            totalEntities += cell.size;
        }
        console.log(`Total entities: ${totalEntities}`);
    }
}
