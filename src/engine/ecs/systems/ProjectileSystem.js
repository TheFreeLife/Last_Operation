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

        // weaponType 역매핑 (0: bullet, 1: sniper, 2: shell, 3: missile, 4: fire)
        const weaponTypes = ['bullet', 'sniper', 'shell', 'missile', 'fire'];
        const currentWeaponType = weaponTypes[world.weaponType[i]] || 'bullet';

        // 2. 충돌 체크
        let collided = false;
        if (world.isIndirect[i] === 0) {
            // 직사 탄환 전용 충돌 검사
            const tileMap = engine.tileMap;
            const gridPos = tileMap.worldToGrid(x[i], y[i]);
            const tile = tileMap.grid[gridPos.y]?.[gridPos.x];
            
            // [수정] 오직 투사체가 현재 위치한 타일의 충돌 박스(occupied)에만 부딪힘
            // 건물 상단부(이미지 영역)는 통과하도록 고층 구조물 판정 제거
            if (tile && tile.occupied) {
                collided = true;
            }

            if (!collided) {
                const nearby = entityManager.getNearby(x[i], y[i], 30);
                for (const target of nearby) {
                    if (!target.active || target.hp === undefined || target.domain === 'projectile') continue;
                    if (engine.getRelation(world.ownerId[i], target.ownerId) === 'self') continue;
                    
                    const dist = Math.sqrt((target.x - x[i])**2 + (target.y - y[i])**2);
                    if (dist < (target.size || 20) / 2) {
                        collided = true;
                        if (explosionRadius[i] === 0) target.takeDamage(damage[i], currentWeaponType);
                        break;
                    }
                }
            }
        }

        // 3. 목표 도달 또는 충돌 시 제거
        const reachedTarget = distToTarget < 25; // 판정 범위 약간 확대 (속도 대응)
        
        // [추가] 안전장치: 비행 거리 초과 시 강제 제거 (최대 3000px)
        const startDist = Math.hypot(x[i] - world.startX[i], y[i] - world.startY[i]);
        const tooFar = startDist > 3000;

        if (collided || reachedTarget || tooFar) {
            CombatLogic.handleImpact(engine, collided ? x[i] : targetX[i], collided ? y[i] : targetY[i], {
                radius: explosionRadius[i],
                damage: damage[i],
                weaponType: currentWeaponType,
                isIndirect: world.isIndirect[i] === 1,
                effectType: (collided && explosionRadius[i] === 0) ? 'hit' : (explosionRadius[i] > 0 ? 'explosion' : 'hit')
            });
            world.destroyEntity(i);
        }
    }
}
