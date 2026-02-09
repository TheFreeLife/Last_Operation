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

        // [이동] 무기 타입 역매핑 (속도 변조 및 충돌 로직에서 사용됨)
        const weaponTypes = ['bullet', 'sniper', 'shell', 'missile', 'fire', 'cluster'];
        const currentWeaponType = weaponTypes[world.weaponType[i]] || 'bullet';

        // [추가] 집속탄 속도 변조 (부드러운 고고도 비행 연출)
        let currentSpeed = speed[i];
        if (currentWeaponType === 'cluster') {
            // 전체 비행 동안 일정한 속도(40%)를 유지하여 묵직함을 표현하고 하강 시 속도 저하를 없앰
            currentSpeed *= 0.4; 
        }

        x[i] += Math.cos(angle[i]) * currentSpeed * dt;
        y[i] += Math.sin(angle[i]) * currentSpeed * dt;

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
        const totalDist = Math.hypot(world.targetX[i] - world.startX[i], world.targetY[i] - world.startY[i]);
        const curDist = Math.hypot(x[i] - world.startX[i], y[i] - world.startY[i]);
        
        // [수정] 고정 25px 대신 속도 기반 유동적 임계값 사용 (훨씬 정밀함)
        let reachedTarget = (curDist >= totalDist - speed[i] * 1.2) || (distToTarget < 5); 

        // [추가] 집속탄 공중 분열 (상공 고고도 기폭)
        if (currentWeaponType === 'cluster') {
            // 전체 거리의 85% 지점에 도달하면 공중에서 분열 시작 (목표에 더 근접했을 때)
            if (totalDist > 150 && (curDist / totalDist) >= 0.85) {
                reachedTarget = true;
            }
        }

        // [추가] 안전장치: 비행 거리 초과 시 강제 제거 (최대 3000px)
        const startDist = Math.hypot(x[i] - world.startX[i], y[i] - world.startY[i]);
        const tooFar = startDist > 3000;

        if (collided || reachedTarget || tooFar) {
            // [추가] 충돌/분열 시점의 시각적 고도 계산
            let currentHeight = 0;
            const tDist = Math.hypot(world.targetX[i] - world.startX[i], world.targetY[i] - world.startY[i]);
            const cDist = Math.hypot(x[i] - world.startX[i], y[i] - world.startY[i]);

            if (world.isIndirect[i] === 1) {
                const progress = Math.min(1, cDist / tDist);
                const maxHeight = world.peakHeight[i] > 0 ? world.peakHeight[i] : tDist * 0.45;
                currentHeight = (1 - progress) * world.startHeight[i] + Math.sin(progress * Math.PI) * maxHeight;
            }

            // [핵심 수정] 공중 분열(reachedTarget) 시 현재 위치(x, y)를 임팩트 지점으로 사용
            const impactX = (collided || (currentWeaponType === 'cluster' && reachedTarget)) ? x[i] : targetX[i];
            const impactY = (collided || (currentWeaponType === 'cluster' && reachedTarget)) ? y[i] : targetY[i];

            CombatLogic.handleImpact(engine, impactX, impactY, {
                radius: explosionRadius[i],
                damage: damage[i],
                weaponType: currentWeaponType,
                isIndirect: world.isIndirect[i] === 1,
                _motherHeight: currentHeight, 
                ownerId: world.ownerId[i],
                effectType: (collided && explosionRadius[i] === 0) ? 'hit' : (explosionRadius[i] > 0 ? 'explosion' : 'hit')
            });
            world.destroyEntity(i);
        }
    }
}
