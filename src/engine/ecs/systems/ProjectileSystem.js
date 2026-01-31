/**
 * ECS ProjectileSystem - 수천 개의 투사체 이동 및 충돌 일괄 처리
 */

export function updateProjectiles(world, deltaTime, engine) {
    const { 
        active, x, y, targetX, targetY, speed, angle, 
        damage, explosionRadius, maxEntities 
    } = world;
    const dt = deltaTime / 16.67;
    const entityManager = engine.entityManager;

    for (let i = 0; i < maxEntities; i++) {
        if (active[i] === 0 || world.typeId[i] !== 1) continue; // typeId 1 = Projectile

        // 1. 타겟 추적 및 이동
        const dx = targetX[i] - x[i];
        const dy = targetY[i] - y[i];
        const distToTarget = Math.sqrt(dx * dx + dy * dy);

        angle[i] = Math.atan2(dy, dx);
        x[i] += Math.cos(angle[i]) * speed[i] * dt;
        y[i] += Math.sin(angle[i]) * speed[i] * dt;

        // 2. 충돌 체크 (SpatialGrid 활용)
        // 투사체는 매우 작으므로 주변 엔티티만 확인
        const nearby = entityManager.getNearby(x[i], y[i], 30);
        let collided = false;

        for (const target of nearby) {
            if (!target.active || target.hp === undefined) continue;
            
            // [수정] 소유권 확인: ID가 같거나(자기 자신/팀) 아군 관계인 경우 확실히 통과
            const projOwnerId = world.ownerId[i];
            const targetOwnerId = target.ownerId;
            
            if (projOwnerId === targetOwnerId) continue; // 동일 소속(자기 자신 포함) 무조건 통과

            const relation = engine.getRelation(projOwnerId, targetOwnerId);
            if (relation === 'self' || relation === 'ally') continue;

            // 투사체(도메인이 projectile인 것)는 무시
            if (target.domain === 'projectile') continue;

            const tx = target.x - x[i];
            const ty = target.y - y[i];
            const dist = Math.sqrt(tx * tx + ty * ty);

            if (dist < (target.size || 20) / 2) {
                // 충돌 발생! (적군 또는 중립 대상)
                if (explosionRadius[i] > 0) {
                    handleExplosion(world, i, engine);
                } else {
                    target.takeDamage(damage[i]);
                }
                collided = true;
                break;
            }
        }

        // 3. 목표 도달 또는 충돌 시 제거
        const reachedTarget = distToTarget < 10;
        
        if (collided || reachedTarget) {
            // 목표에 도달했을 때도 폭발 반경이 있으면 폭발 처리
            if (reachedTarget && explosionRadius[i] > 0 && !collided) {
                handleExplosion(world, i, engine);
            }
            
            // 일반 탄환(폭발 X)이 목표에 도달하면 작은 히트 이펙트 정도는 보여줌
            if (reachedTarget && explosionRadius[i] <= 0 && !collided) {
                if (engine.addEffect) {
                    engine.addEffect('hit', targetX[i], targetY[i], '#ffff00');
                }
            }

            world.destroyEntity(i);
        }
    }
}

function handleExplosion(world, idx, engine) {
    const ex = world.x[idx];
    const ey = world.y[idx];
    const radius = world.explosionRadius[idx];
    const dmg = world.damage[idx];
    const ownerId = world.ownerId[idx];

    // 주변 범위 피해
    const targets = engine.entityManager.getNearby(ex, ey, radius);
    for (const target of targets) {
        if (!target.active || target.hp === undefined) continue;
        
        // [수정] 아군 사격(Friendly Fire) 허용
        // 이제 관계(relation)를 체크하지 않고, 폭발 범위 내의 모든 유닛에게 피해를 줍니다.
        // 단, 투사체 자체는 피해 대상에서 제외합니다.
        if (target.domain === 'projectile') continue;

        const dist = Math.hypot(target.x - ex, target.y - ey);
        if (dist <= radius) {
            target.takeDamage(dmg);
        }
    }

    if (engine.addEffect) {
        engine.addEffect('explosion', ex, ey);
    }
}
