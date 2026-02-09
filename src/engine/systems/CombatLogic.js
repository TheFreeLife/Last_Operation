/**
 * CombatLogic - ECS와 클래스 기반 투사체 모두가 사용하는 공통 전투 로직
 */

export const CombatLogic = {
    // --- 상성 시스템 설정 ---
    Multipliers: {
        bullet:  { infantry: 1.0, light: 0.4,  heavy: 0.05 },
        sniper:  { infantry: 2.5, light: 0.3,  heavy: 0.01 },
        shell:   { infantry: 1.2, light: 1.0,  heavy: 0.8  },
        missile: { infantry: 0.5, light: 1.2,  heavy: 1.5  },
        fire:    { infantry: 1.5, light: 1.0,  heavy: 0.8  }
    },

    calculateDamage(attackerWeaponType, targetArmorType, baseDamage) {
        const weaponMap = this.Multipliers[attackerWeaponType || 'bullet'] || this.Multipliers.bullet;
        const multiplier = weaponMap[targetArmorType || 'infantry'] || 1.0;
        return baseDamage * multiplier;
    },

    /**
     * 투사체가 지면이나 천장에 충돌했을 때의 모든 처리를 담당합니다.
     * (천장 판정, 유닛 피해, 타일 파괴, 이펙트 생성 등)
     */
    handleImpact(engine, x, y, options = {}) {
        const { 
            radius = 0, 
            damage = 0, 
            weaponType = 'bullet',
            isIndirect = false, 
            effectType = 'explosion',
            hitCeilingColor = '#00bcd4'
        } = options;

        const tileMap = engine.tileMap;
        
        // --- [수정] 집속탄(Cluster Munition) 처리: 상공 분열 및 자탄 낙하 ---
        if (weaponType === 'cluster' && !options._isSubMunition) {
            // 1. 모체 포탄의 공중 파열 효과 (소리만 재생)
            engine.audioSystem.play('explosion', { volume: 0.15, pitch: 1.2 });

            // 2. 자탄 살포 (16~24개) - 실제 투사체로 생성하여 낙하 연출
            const subCount = 16 + Math.floor(Math.random() * 9);
            for (let i = 0; i < subCount; i++) {
                const scatterAngle = (Math.PI * 2 / subCount) * i + (Math.random() * 0.8 - 0.4);
                
                // [수정] 최소 거리를 확보하여 즉시 폭발 방지 및 중심부 밀도 유지
                const scatterDist = 30 + Math.random() * radius * 3.5; 
                
                // [핵심] 모든 자탄이 비슷한 시간(약 180~280프레임) 동안 체공하도록 속도 역산
                const targetFrames = 180 + Math.random() * 100;
                const calculatedSpeed = scatterDist / targetFrames;

                // 자탄이 떨어질 지점
                const dropX = x + Math.cos(scatterAngle) * scatterDist;
                const dropY = y + Math.sin(scatterAngle) * scatterDist;
                
                // 자탄 투사체 생성
                engine.entityManager.spawnProjectileECS(x, y, { x: dropX, y: dropY }, damage * 0.6, {
                    speed: Math.max(0.4, calculatedSpeed), // 최소 속도 보장
                    explosionRadius: radius * 0.5,
                    ownerId: options.ownerId,
                    isIndirect: true, 
                    startHeight: options._motherHeight || 0, 
                    peakHeight: 5 + Math.random() * 10, 
                    weaponType: 'shell', 
                    _isSubMunition: true
                });
            }
            return true; // 모체는 여기서 소멸 (지면 타격 안 함)
        }

        // 1. 천장 레이어 판정 (곡사 무기 전용)
        let hitCeiling = false;
        if (isIndirect && tileMap) {
            const gridPos = tileMap.worldToGrid(x, y);
            const cell = tileMap.grid[gridPos.y]?.[gridPos.x];
            if (cell && cell.ceilingHp > 0) {
                hitCeiling = true;
            }
        }

        // 2. 천장 타격 시 처리
        if (hitCeiling) {
            if (radius > 0) {
                tileMap.applyAreaDamageToCeiling(x, y, radius, damage);
            } else {
                const gridPos = tileMap.worldToGrid(x, y);
                tileMap.damageCeiling(gridPos.x, gridPos.y, damage);
            }

            if (engine.addEffect) {
                let finalEffectType = effectType;
                if (effectType === 'explosion') {
                    if (weaponType === 'shell') finalEffectType = 'impact_shell';
                    else if (weaponType === 'missile') finalEffectType = 'impact_missile';
                    else finalEffectType = 'impact_bullet';
                } else if (effectType === 'hit') {
                    finalEffectType = 'impact_bullet';
                }
                // 천장 타격 시 시각적 구분을 위해 hitCeilingColor 전달 가능 (현재 addEffect는 color를 파티클 색상으로 사용)
                engine.addEffect(finalEffectType, x, y, hitCeilingColor);
            }
            return true; // 천장에 막힘
        }

        // 3. 지면/공중 타격 처리
        if (radius > 0) {
            // 3-A. 주변 유닛 범위 피해
            const targets = engine.entityManager.getNearby(x, y, radius);
            const canHitAir = options.canHitAir || !isIndirect; // 명시적 대공 판정 혹은 직사 화기일 때

            for (const target of targets) {
                if (!target.active || target.hp === undefined || target.domain === 'projectile') continue;
                
                // 공중 유닛 타격 제한 체크
                if (target.domain === 'air' && !canHitAir) continue;

                const dist = Math.hypot(target.x - x, target.y - y);
                if (dist <= radius) {
                    // 미사일 등 일부 유닛은 거리에 따른 데미지 감쇄 적용
                    const falloff = options.useFalloff ? (1 - (dist / radius) * 0.5) : 1;
                    target.takeDamage(damage * falloff, weaponType);
                }
            }
            // 3-B. 주변 타일(벽) 범위 피해
            tileMap?.applyAreaDamage(x, y, radius, damage);
        } else {
            // 3-C. 단일 대상 처리 (유닛은 이미 ProjectileSystem에서 개별 처리하므로 여기서는 타일만)
            const gridPos = tileMap.worldToGrid(x, y);
            const wall = tileMap.layers.wall[gridPos.y]?.[gridPos.x];
            if (wall && wall.id && wall.id !== 'spawn-point') {
                tileMap.damageTile(gridPos.x, gridPos.y, damage);
            }
        }

        // 공통 폭발/명중 효과
        if (engine.addEffect) {
            let finalEffectType = effectType;
            if (effectType === 'explosion') {
                if (weaponType === 'shell') finalEffectType = 'impact_shell';
                else if (weaponType === 'missile') finalEffectType = 'impact_missile';
                else finalEffectType = 'impact_bullet';
            } else if (effectType === 'hit') {
                finalEffectType = 'impact_bullet';
            }
            engine.addEffect(finalEffectType, x, y);
        }

        return false; // 지면에 명중
    }
};
