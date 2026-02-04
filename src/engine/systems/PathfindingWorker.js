/**
 * PathfindingWorker - 무거운 플로우 필드 연산을 담당
 */
self.onmessage = function(e) {
    const { type, data } = e.data;

    if (type === 'GENERATE_FLOW_FIELD') {
        const { cols, rows, targetX, targetY, costMap, integrationMap, flowFieldX, flowFieldY, sizeClass, domain } = data;
        const size = cols * rows;

        // 1. Integration Map (Dijkstra)
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

                const nIdx = ny * cols + nx;
                const cost = costMap[nIdx];
                if (cost === 255) continue;

                // 대각선 이동 시 코너 끼임 방지
                if (n.dx !== 0 && n.dy !== 0) {
                    if (costMap[cy * cols + nx] === 255 || costMap[ny * cols + cx] === 255) continue;
                }

                const newDist = currDist + n.cost;
                if (newDist < integrationMap[nIdx]) {
                    integrationMap[nIdx] = newDist;
                    queue.push(nIdx);
                }
            }
        }

        // 2. Flow Map (Gradient)
        flowFieldX.fill(0);
        flowFieldY.fill(0);
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

                        // 대각선 이동 시 코너 끼임 방지 (Flow Map 생성 시에도 적용)
                        if (dx !== 0 && dy !== 0) {
                            if (costMap[y * cols + nx] === 255 || costMap[ny * cols + x] === 255) continue;
                        }

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

        self.postMessage({
            type: 'FLOW_FIELD_RESULT',
            data: { integrationMap, flowFieldX, flowFieldY, sizeClass, targetX, targetY, domain }
        }, [integrationMap.buffer, flowFieldX.buffer, flowFieldY.buffer]);
    }
};