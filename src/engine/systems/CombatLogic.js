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
        fire:    { infantry: 1.5, light: 1.0,  heavy: 0.6  }
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
                engine.addEffect(effectType, x, y, hitCeilingColor);
            }
            return true; // 천장에 막힘
        }

        // 3. 지면 타격 시 처리
        if (radius > 0) {
            // 3-A. 주변 유닛 범위 피해
            const targets = engine.entityManager.getNearby(x, y, radius);
            for (const target of targets) {
                if (!target.active || target.hp === undefined || target.domain === 'projectile' || target.domain === 'air') continue;
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
            engine.addEffect(effectType, x, y);
        }

        return false; // 지면에 명중
    }
};
