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
            
            // 소유권 확인 (아군 사격 방지)
            const relation = engine.getRelation(world.ownerId[i], target.ownerId);
            if (relation === 'self' || relation === 'ally') continue;

            const tx = target.x - x[i];
            const ty = target.y - y[i];
            const dist = Math.sqrt(tx * tx + ty * ty);

            if (dist < (target.size || 20) / 2) {
                // 충돌 발생!
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
        if (collided || distToTarget < 10) {
            world.destroyEntity(i);
        }
    }
}

function handleExplosion(world, idx, engine) {
    const ex = world.x[idx];
    const ey = world.y[idx];
    const radius = world.explosionRadius[idx];
    const dmg = world.damage[idx];

    // 주변 범위 피해
    const targets = engine.entityManager.getNearby(ex, ey, radius);
    for (const target of targets) {
        if (!target.active || target.hp === undefined) continue;
        const dist = Math.hypot(target.x - ex, target.y - ey);
        if (dist <= radius) {
            target.takeDamage(dmg);
        }
    }

    if (engine.addEffect) {
        engine.addEffect('explosion', ex, ey);
    }
}
