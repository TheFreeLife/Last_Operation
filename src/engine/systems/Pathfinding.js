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

    findPath(startWorldX, startWorldY, endWorldX, endWorldY, canBypassObstacles = false) {
        const start = this.engine.tileMap.worldToGrid(startWorldX, startWorldY);
        const end = this.engine.tileMap.worldToGrid(endWorldX, endWorldY);

        if (!this.isValid(end.x, end.y)) return null;

        let finalEnd = { ...end };
        // 도착지가 막혀있으면 주변 탐색 (RTS 필수)
        if (!canBypassObstacles && this.isOccupied(finalEnd.x, finalEnd.y)) {
            finalEnd = this.findNearestWalkable(finalEnd.x, finalEnd.y);
            if (!finalEnd) return null;
        }

        // 최소 힙 사용으로 대규모 맵에서의 성능 최적화 O(log N)
        const openSet = new MinHeap();
        // 빠른 조회를 위해 방문 여부와 비용을 Map으로 관리 (메모리 vs 속도 트레이드오프)
        // 맵이 매우 크다면 1차원 배열이나 Int32Array 등을 고려할 수 있음
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
        
        // 검색 키 생성 함수 (비트 연산으로 최적화 가능하지만 가독성/확장성 위해 문자열 유지)
        // 맵이 65536x65536 이하라면 `(y << 16) | x` 정수 키가 훨씬 빠름.
        // 여기선 안전하게 문자열 사용.
        const gridKey = (x, y) => `${x},${y}`;
        
        // G 비용 관리 (이미 더 짧은 경로로 방문했는지 체크용)
        const gScores = new Map();
        gScores.set(gridKey(start.x, start.y), 0);

        // 성능 안전장치 (너무 깊은 탐색 방지)
        let iterations = 0;
        const maxIterations = 5000; // 맵 크기에 따라 조절 필요

        while (openSet.size() > 0) {
            iterations++;
            if (iterations > maxIterations) return null; // 너무 먼 경로는 포기 (렉 방지)

            const current = openSet.pop();

            if (current.x === finalEnd.x && current.y === finalEnd.y) {
                return this.reconstructPath(current);
            }

            const currentKey = gridKey(current.x, current.y);
            // 힙에는 중복 노드가 들어갈 수 있으므로, 꺼낼 때 이미 더 좋은 경로로 처리되었는지 확인
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
                
                // 닫힌 목록에 있으면 스킵 (이미 최적 경로 찾음)
                if (closedSet.has(gridKey(nx, ny))) continue;

                // 장애물 체크
                if (!canBypassObstacles && this.isOccupied(nx, ny)) continue;

                // 대각선 이동 시 코너 끼임 방지 (Corner Cutting 방지)
                // 대각선으로 이동하려는 방향의 인접한 두 타일 중 하나만 막혀있어도 대각선 이동 금지
                if (neighbor.x !== 0 && neighbor.y !== 0) {
                    if (this.isOccupied(current.x + neighbor.x, current.y) || 
                        this.isOccupied(current.x, current.y + neighbor.y)) {
                        continue;
                    }
                }

                const tentativeG = current.g + neighbor.cost;
                const neighborKey = gridKey(nx, ny);
                
                // 기존에 발견된 경로보다 더 나쁘면 스킵
                if (gScores.has(neighborKey) && tentativeG >= gScores.get(neighborKey)) continue;

                // 더 좋은 경로 발견
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
        // Octile Distance (대각선 이동 허용 시 가장 정확한 휴리스틱)
        const D = 1;
        const D2 = 1.414;
        const dx = Math.abs(x1 - x2);
        const dy = Math.abs(y1 - y2);
        return D * (dx + dy) + (D2 - 2 * D) * Math.min(dx, dy);
    }

    isValid(x, y) {
        return x >= 0 && x < this.engine.tileMap.cols && y >= 0 && y < this.engine.tileMap.rows;
    }

    isOccupied(x, y) {
        if (!this.isValid(x, y)) return true;
        const tile = this.engine.tileMap.grid[y][x];
        
        // 1. 타일 자체가 파괴 불가능한 장애물(자원 등)인 경우
        if (tile.type === 'resource') return true;
        if (!tile.buildable && tile.type !== 'base') return true;

        // 2. 실시간 건물(Entity) 점유 체크
        // 타일 데이터의 occupied에만 의존하지 않고, 실제 배치된 건물들의 영역을 직접 확인
        const worldPos = this.engine.tileMap.gridToWorld(x, y);
        const allBuildings = this.engine.getAllBuildings();
        
        const blockingEntity = allBuildings.find(ent => {
            // 통과 가능한 객체(전선 등)이거나 활성화되지 않은 경우 제외
            if (!ent || !ent.active || ent.passable) return false;
            
            // 엔티티의 실시간 경계(Bounds) 가져오기
            const bounds = ent.getSelectionBounds();
            
            // 타일의 중심점이 엔티티 영역 안에 있는지 확인 (마진 1px 추가하여 타이트하게 체크)
            const margin = 1;
            return worldPos.x >= bounds.left + margin && worldPos.x <= bounds.right - margin &&
                   worldPos.y >= bounds.top + margin && worldPos.y <= bounds.bottom - margin;
        });

        if (blockingEntity) return true;
        
        return false;
    }

    findNearestWalkable(tx, ty) {
        // 나선형 탐색으로 가장 가까운 빈 타일 찾기
        for (let radius = 1; radius <= 5; radius++) {
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
                    const nx = tx + dx;
                    const ny = ty + dy;
                    if (this.isValid(nx, ny) && !this.isOccupied(nx, ny)) {
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