/**
 * ECS Core Systems - 최적화된 일괄 처리 함수들
 */

export function updateMovement(world, deltaTime) {
    const { active, x, y, vx, vy, speed, maxEntities } = world;
    // deltaTime 보정 (ms -> seconds or fixed steps)
    const dt = deltaTime / 16.67; 

    for (let i = 0; i < maxEntities; i++) {
        if (active[i] === 0) continue;
        
        // 데이터 중심 연산: CPU 캐시 활용 극대화
        x[i] += vx[i] * dt;
        y[i] += vy[i] * dt;
    }
}

export function updateHealth(world, onEntityDestroyed) {
    const { active, hp, typeId, maxEntities } = world;
    for (let i = 0; i < maxEntities; i++) {
        if (active[i] === 0) continue;
        
        // 투사체(typeId 1)는 체력 시스템에서 관리하지 않음
        if (typeId[i] === 1) continue;

        if (hp[i] <= 0) {
            if (onEntityDestroyed) onEntityDestroyed(i);
            active[i] = 0; // 즉시 비활성화
        }
    }
}
