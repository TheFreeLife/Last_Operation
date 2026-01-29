/**
 * PathfindingWorker - 무거운 경로 탐색 연산을 담당하는 백그라운드 스레드
 */
self.onmessage = function(e) {
    const { type, data } = e.data;

    if (type === 'GENERATE_FLOW_FIELD') {
        const { cols, rows, targetX, targetY, costMap, integrationMap, flowFieldX, flowFieldY } = data;
        const size = cols * rows;

        // 1. Dijkstra 연산
        integrationMap.fill(65535);
        const targetIdx = targetY * cols + targetX;
        if (targetIdx >= 0 && targetIdx < size) {
            integrationMap[targetIdx] = 0;
        }

        const queue = [targetIdx];
        let head = 0;
        const neighbors = [
            { dx: 0, dy: -1, cost: 1 }, { dx: 0, dy: 1, cost: 1 },
            { dx: -1, dy: 0, cost: 1 }, { dx: 1, dy: 0, cost: 1 },
            { dx: -1, dy: -1, cost: 1.414 }, { dx: 1, dy: -1, cost: 1.414 },
            { dx: -1, dy: 1, cost: 1.414 }, { dx: 1, dy: 1, cost: 1.414 }
        ];

        while (head < queue.length) {
            const currIdx = queue[head++];
            const cx = currIdx % cols;
            const cy = Math.floor(currIdx / cols);
            const currDist = integrationMap[currIdx];

            for (const n of neighbors) {
                const nx = cx + n.dx;
                const ny = cy + n.dy;

                if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;

                // [추가] 대각선 통과 유효성 체크
                if (n.dx !== 0 && n.dy !== 0) {
                    const corner1 = costMap[cy * cols + nx];
                    const corner2 = costMap[ny * cols + cx];
                    if (corner1 === 255 || corner2 === 255) continue;
                }

                const nIdx = ny * cols + nx;
                const cost = costMap[nIdx];
                if (cost === 255) continue;

                const newDist = currDist + n.cost + (cost - 1);
                if (newDist < integrationMap[nIdx]) {
                    integrationMap[nIdx] = newDist;
                    queue.push(nIdx);
                }
            }
        }

        // 2. Flow Map 생성
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const idx = y * cols + x;
                if (costMap[idx] === 255) continue;

                let minNeighborDist = integrationMap[idx];
                let bestX = 0;
                let bestY = 0;

                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;

                        const nDist = integrationMap[ny * cols + nx];
                        if (nDist < minNeighborDist) {
                            minNeighborDist = nDist;
                            bestX = dx;
                            bestY = dy;
                        }
                    }
                }
                flowFieldX[idx] = bestX;
                flowFieldY[idx] = bestY;
            }
        }

        // 3. 결과 전송 (Transferable Objects 리스트 포함)
        self.postMessage({
            type: 'FLOW_FIELD_RESULT',
            data: { integrationMap, flowFieldX, flowFieldY }
        }, [integrationMap.buffer, flowFieldX.buffer, flowFieldY.buffer]);
    }
};
