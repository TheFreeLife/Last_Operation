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
        // [곡사/직사 구분] 곡사 탄환(isIndirect === 1)은 비행 중 충돌을 무시함
        let collided = false;
        if (world.isIndirect[i] === 0) {
            // --- 2-A. 지형 충돌 체크 (벽, 건물 등) ---
            const tileMap = engine.tileMap;
            if (tileMap) {
                const gridPos = tileMap.worldToGrid(x[i], y[i]);
                const tile = tileMap.grid[gridPos.y]?.[gridPos.x];
                
                // 통과 불가능한 타일(벽 등)에 부딪힌 경우
                if (tile && !tile.passable) {
                    if (explosionRadius[i] > 0) {
                        handleExplosion(world, i, engine);
                    } else {
                        // 타일에 직접 데미지
                        tileMap.damageTile(gridPos.x, gridPos.y, damage[i]);
                        if (engine.addEffect) {
                            engine.addEffect('hit', x[i], y[i], '#ccc');
                        }
                    }
                    collided = true;
                }
            }

            // --- 2-B. 유닛 충돌 체크 (이미 벽에 부딪히지 않은 경우만) ---
            if (!collided) {
                const nearby = entityManager.getNearby(x[i], y[i], 30);

                for (const target of nearby) {
                    if (!target.active || target.hp === undefined) continue;
                    
                    // 소유권 확인: ID가 같거나(자기 자신/팀) 아군 관계인 경우 확실히 통과
                    const projOwnerId = world.ownerId[i];
                    const targetOwnerId = target.ownerId;
                    
                    if (projOwnerId === targetOwnerId) continue; 

                    const relation = engine.getRelation(projOwnerId, targetOwnerId);
                    if (relation === 'self' || relation === 'ally') continue;

                    // 투사체(도메인이 projectile인 것)는 무시
                    if (target.domain === 'projectile') continue;

                    const tx = target.x - x[i];
                    const ty = target.y - y[i];
                    const dist = Math.sqrt(tx * tx + ty * ty);

                    if (dist < (target.size || 20) / 2) {
                        // 충돌 발생! (직사 탄환)
                        if (explosionRadius[i] > 0) {
                            handleExplosion(world, i, engine);
                        } else {
                            target.takeDamage(damage[i]);
                        }
                        collided = true;
                        break;
                    }
                }
            }
        }

        // 3. 목표 도달 또는 충돌 시 제거
        const reachedTarget = distToTarget < 15; // 곡사는 오차 범위를 약간 더 줌 (10 -> 15)
        
        if (collided || reachedTarget) {
            // 목표에 도달했을 때 (곡사 탄환 포함) 폭발 처리
            if (reachedTarget && explosionRadius[i] > 0 && !collided) {
                handleExplosion(world, i, engine);
            }
            
            // 일반 탄환이 목표에 도달하면 히트 이펙트 및 타일 데미지 처리
            if (reachedTarget && explosionRadius[i] <= 0 && !collided) {
                if (engine.addEffect) {
                    engine.addEffect('hit', targetX[i], targetY[i], '#ffff00');
                }

                // [추가] 목표 지점이 타일 블록인 경우 직접 데미지 전달
                const tileMap = engine.tileMap;
                if (tileMap) {
                    const gridPos = tileMap.worldToGrid(targetX[i], targetY[i]);
                    const wall = tileMap.layers.wall[gridPos.y]?.[gridPos.x];
                    if (wall && wall.id && wall.id !== 'spawn-point') {
                        tileMap.damageTile(gridPos.x, gridPos.y, damage[i]);
                    }
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
    const tileMap = engine.tileMap;

    // 1. 주변 유닛 범위 피해
    const targets = engine.entityManager.getNearby(ex, ey, radius);
    for (const target of targets) {
        if (!target.active || target.hp === undefined) continue;
        if (target.domain === 'projectile') continue;

        const dist = Math.hypot(target.x - ex, target.y - ey);
        if (dist <= radius) {
            target.takeDamage(dmg);
        }
    }

    // 2. 주변 타일(벽) 범위 피해
    if (tileMap) {
        const gridRadius = Math.ceil(radius / tileMap.tileSize);
        const center = tileMap.worldToGrid(ex, ey);
        
        for (let dy = -gridRadius; dy <= gridRadius; dy++) {
            for (let dx = -gridRadius; dx <= gridRadius; dx++) {
                const gx = center.x + dx;
                const gy = center.y + dy;
                
                if (gx < 0 || gx >= tileMap.cols || gy < 0 || gy >= tileMap.rows) continue;
                
                const wall = tileMap.layers.wall[gy][gx];
                if (wall && wall.id) {
                    const worldPos = tileMap.gridToWorld(gx, gy);
                    const dist = Math.hypot(worldPos.x - ex, worldPos.y - ey);
                    
                    if (dist <= radius + tileMap.tileSize / 2) {
                        tileMap.damageTile(gx, gy, dmg);
                    }
                }
            }
        }
    }

    if (engine.addEffect) {
        engine.addEffect('explosion', ex, ey);
    }
}
