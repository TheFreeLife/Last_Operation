class MinHeap {
    constructor() {
        this.heap = [];
    }

    push(node) {
        this.heap.push(node);
        this.bubbleUp(this.heap.length - 1);
    }

    pop() {
        if (this.heap.length === 0) return null;
        const min = this.heap[0];
        const end = this.heap.pop();
        if (this.heap.length > 0) {
            this.heap[0] = end;
            this.sinkDown(0);
        }
        return min;
    }

    size() {
        return this.heap.length;
    }

    bubbleUp(n) {
        const element = this.heap[n];
        while (n > 0) {
            const parentIdx = Math.floor((n - 1) / 2);
            const parent = this.heap[parentIdx];
            if (element.f >= parent.f) break;
            this.heap[parentIdx] = element;
            this.heap[n] = parent;
            n = parentIdx;
        }
    }

    sinkDown(n) {
        const length = this.heap.length;
        const element = this.heap[n];
        while (true) {
            const leftChildIdx = 2 * n + 1;
            const rightChildIdx = 2 * n + 2;
            let leftChild, rightChild;
            let swap = null;

            if (leftChildIdx < length) {
                leftChild = this.heap[leftChildIdx];
                if (leftChild.f < element.f) {
                    swap = leftChildIdx;
                }
            }

            if (rightChildIdx < length) {
                rightChild = this.heap[rightChildIdx];
                if (
                    (swap === null && rightChild.f < element.f) ||
                    (swap !== null && rightChild.f < leftChild.f)
                ) {
                    swap = rightChildIdx;
                }
            }

            if (swap === null) break;
            this.heap[n] = this.heap[swap];
            this.heap[swap] = element;
            n = swap;
        }
    }
}

export class Pathfinding {
    constructor(engine) {
        this.engine = engine;
    }

    findPath(startWorldX, startWorldY, endWorldX, endWorldY, canBypassObstacles = false, unitSize = 40) {
        const start = this.engine.tileMap.worldToGrid(startWorldX, startWorldY);
        const end = this.engine.tileMap.worldToGrid(endWorldX, endWorldY);
        const tileSize = this.engine.tileMap.tileSize;
        
        // 유닛이 차지하는 타일 수 계산 (더 넉넉하게 올림 처리)
        // 기본 1x1, 폭격기(92px)의 경우 3x3 타일 공간을 확보하도록 변경
        let unitTileSize = Math.ceil(unitSize / tileSize);
        
        // 대형 유닛(1.5타일 초과)은 길찾기 시 1타일의 추가 여유 공간(Padding)을 두어 건물에 끼이지 않게 함
        if (unitTileSize > 1) {
            unitTileSize += 1;
        }

        if (!this.isValid(end.x, end.y)) return null;

        let finalEnd = { ...end };
        // 도착지가 막혀있으면 주변 탐색 (RTS 필수)
        if (!canBypassObstacles && this.isOccupied(finalEnd.x, finalEnd.y, unitTileSize)) {
            finalEnd = this.findNearestWalkable(finalEnd.x, finalEnd.y, unitTileSize);
            if (!finalEnd) return null;
        }

        // 최소 힙 사용으로 대규모 맵에서의 성능 최적화 O(log N)
        const openSet = new MinHeap();
        const closedSet = new Map(); 

        const startNode = {
            x: start.x,
            y: start.y,
            g: 0,
            h: this.heuristic(start.x, start.y, finalEnd.x, finalEnd.y),
            f: 0,
            parent: null
        };
        startNode.f = startNode.g + startNode.h;
        openSet.push(startNode);
        
        const gridKey = (x, y) => `${x},${y}`;
        const gScores = new Map();
        gScores.set(gridKey(start.x, start.y), 0);

        let iterations = 0;
        const maxIterations = 5000;

        while (openSet.size() > 0) {
            iterations++;
            if (iterations > maxIterations) return null;

            const current = openSet.pop();

            if (current.x === finalEnd.x && current.y === finalEnd.y) {
                return this.reconstructPath(current);
            }

            const currentKey = gridKey(current.x, current.y);
            if (closedSet.has(currentKey)) continue;
            closedSet.set(currentKey, true);

            const neighbors = [
                { x: 0, y: -1, cost: 1 }, { x: 0, y: 1, cost: 1 },
                { x: -1, y: 0, cost: 1 }, { x: 1, y: 0, cost: 1 },
                { x: -1, y: -1, cost: 1.414 }, { x: 1, y: -1, cost: 1.414 },
                { x: -1, y: 1, cost: 1.414 }, { x: 1, y: 1, cost: 1.414 }
            ];

            for (const neighbor of neighbors) {
                const nx = current.x + neighbor.x;
                const ny = current.y + neighbor.y;

                if (!this.isValid(nx, ny)) continue;
                if (closedSet.has(gridKey(nx, ny))) continue;

                // 장애물 체크 (유닛 크기 반영)
                if (!canBypassObstacles && this.isOccupied(nx, ny, unitTileSize)) continue;

                // 대각선 이동 시 코너 끼임 방지 (유닛 크기 고려하여 강화)
                if (neighbor.x !== 0 && neighbor.y !== 0) {
                    if (this.isOccupied(current.x + neighbor.x, current.y, unitTileSize) || 
                        this.isOccupied(current.x, current.y + neighbor.y, unitTileSize)) {
                        continue;
                    }
                }

                const tentativeG = current.g + neighbor.cost;
                const neighborKey = gridKey(nx, ny);
                
                if (gScores.has(neighborKey) && tentativeG >= gScores.get(neighborKey)) continue;

                gScores.set(neighborKey, tentativeG);
                
                const neighborNode = {
                    x: nx,
                    y: ny,
                    g: tentativeG,
                    h: this.heuristic(nx, ny, finalEnd.x, finalEnd.y),
                    f: 0,
                    parent: current
                };
                neighborNode.f = neighborNode.g + neighborNode.h;
                
                openSet.push(neighborNode);
            }
        }

        return null;
    }

    heuristic(x1, y1, x2, y2) {
        const D = 1;
        const D2 = 1.414;
        const dx = Math.abs(x1 - x2);
        const dy = Math.abs(y1 - y2);
        return D * (dx + dy) + (D2 - 2 * D) * Math.min(dx, dy);
    }

    isValid(x, y) {
        return x >= 0 && x < this.engine.tileMap.cols && y >= 0 && y < this.engine.tileMap.rows;
    }

    /**
     * 특정 위치에 유닛이 위치할 수 있는지 확인
     * @param {number} x 그리드 X
     * @param {number} y 그리드 Y
     * @param {number} unitTileSize 유닛이 차지하는 타일 크기 (보통 1 또는 2)
     */
    isOccupied(x, y, unitTileSize = 1) {
        // 유닛 크기가 1보다 크면 중심점을 기준으로 주변 타일들을 모두 검사
        const halfSize = Math.floor(unitTileSize / 2);
        const startX = x - halfSize;
        const startY = y - halfSize;
        const endX = startX + unitTileSize - 1;
        const endY = startY + unitTileSize - 1;

        for (let checkY = startY; checkY <= endY; checkY++) {
            for (let checkX = startX; checkX <= endX; checkX++) {
                if (this._isSingleTileOccupied(checkX, checkY)) return true;
            }
        }
        return false;
    }

    // 기존의 단일 타일 체크 로직을 내부 메서드로 분리
    _isSingleTileOccupied(x, y) {
        if (!this.isValid(x, y)) return true;
        const tile = this.engine.tileMap.grid[y][x];
        
        if (tile.type === 'resource') return true;
        if (!tile.buildable && tile.type !== 'base') return true;

        const worldPos = this.engine.tileMap.gridToWorld(x, y);
        const allBuildings = this.engine.getAllBuildings();
        
        const blockingEntity = allBuildings.find(ent => {
            if (!ent || !ent.active || ent.passable) return false;
            const bounds = ent.getSelectionBounds();
            const margin = 1;
            return worldPos.x >= bounds.left + margin && worldPos.x <= bounds.right - margin &&
                   worldPos.y >= bounds.top + margin && worldPos.y <= bounds.bottom - margin;
        });

        return !!blockingEntity;
    }

    findNearestWalkable(tx, ty, unitTileSize = 1) {
        // 나선형 탐색으로 가장 가까운 빈 공간 찾기
        for (let radius = 1; radius <= 5; radius++) {
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
                    const nx = tx + dx;
                    const ny = ty + dy;
                    if (this.isValid(nx, ny) && !this.isOccupied(nx, ny, unitTileSize)) {
                        return { x: nx, y: ny };
                    }
                }
            }
        }
        return null;
    }

    reconstructPath(node) {
        const path = [];
        let curr = node;
        // 역추적 (도착지 -> 시작지)
        while (curr) {
            // 시작 노드(parent가 없는 노드)는 경로에서 제외
            if (curr.parent) {
                const worldPos = this.engine.tileMap.gridToWorld(curr.x, curr.y);
                path.push(worldPos);
            }
            curr = curr.parent;
        }
        return path.reverse(); // 순서 뒤집기 (시작 직후 -> ... -> 도착지)
    }
}