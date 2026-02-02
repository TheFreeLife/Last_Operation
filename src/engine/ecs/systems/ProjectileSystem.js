import { CombatLogic } from '../../systems/CombatLogic.js';

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

        // 2. 충돌 체크
        let collided = false;
        if (world.isIndirect[i] === 0) {
            // 직사 탄환 전용 충돌 검사
            const tileMap = engine.tileMap;
            const gridPos = tileMap.worldToGrid(x[i], y[i]);
            const tile = tileMap.grid[gridPos.y]?.[gridPos.x];
            
            if (tile && !tile.passable) {
                collided = true;
            } else {
                const nearby = entityManager.getNearby(x[i], y[i], 30);
                for (const target of nearby) {
                    if (!target.active || target.hp === undefined || target.domain === 'projectile') continue;
                    if (engine.getRelation(world.ownerId[i], target.ownerId) === 'self') continue;
                    
                    const dist = Math.sqrt((target.x - x[i])**2 + (target.y - y[i])**2);
                    if (dist < (target.size || 20) / 2) {
                        collided = true;
                        if (explosionRadius[i] === 0) target.takeDamage(damage[i]);
                        break;
                    }
                }
            }
        }

        // 3. 목표 도달 또는 충돌 시 제거
        const reachedTarget = distToTarget < 15;
        if (collided || reachedTarget) {
            CombatLogic.handleImpact(engine, collided ? x[i] : targetX[i], collided ? y[i] : targetY[i], {
                radius: explosionRadius[i],
                damage: damage[i],
                isIndirect: world.isIndirect[i] === 1,
                effectType: explosionRadius[i] > 0 ? 'explosion' : 'hit'
            });
            world.destroyEntity(i);
        }
    }
}
