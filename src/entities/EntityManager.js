import { SpatialGrid } from '../engine/systems/SpatialGrid.js';
import { ObjectPool } from '../engine/systems/ObjectPool.js';
import { World } from '../engine/ecs/World.js';
import * as ECSSystems from '../engine/ecs/systems/CoreSystems.js';
import * as ProjectileSystem from '../engine/ecs/systems/ProjectileSystem.js';

/**
 * EntityManager - ECS와 Object Pooling을 결합한 하이브리드 관리자
 */
export class EntityManager {
    constructor(engine) {
        this.engine = engine;

        // 1. ECS World (고성능 데이터 관리)
        this.ecsWorld = new World(20000); 

        // 2. 기존 레지스트리 및 공간 분할
        this.registry = new Map();
        this.spatialGrid = new SpatialGrid(100);

        this.entities = {
            units: [],
            enemies: [],
            neutral: [],
            projectiles: [], // ECS 미적용 레거시 호환용
            cargoPlanes: []
        };

        this.allEntities = [];
        this.pools = new Map();
    }

    /**
     * ECS 전용 투사체 생성 (초고속)
     */
    spawnProjectileECS(x, y, target, damage, options = {}) {
        const idx = this.ecsWorld.createEntity();
        if (idx === -1) return;

        this.ecsWorld.typeId[idx] = 1; // 1: Projectile
        this.ecsWorld.x[idx] = x;
        this.ecsWorld.y[idx] = y;
        this.ecsWorld.startX[idx] = x;
        this.ecsWorld.startY[idx] = y;
        this.ecsWorld.targetX[idx] = target.x;
        this.ecsWorld.targetY[idx] = target.y;
        this.ecsWorld.speed[idx] = options.speed || 8;
        this.ecsWorld.damage[idx] = damage;
        this.ecsWorld.explosionRadius[idx] = options.explosionRadius || 0;
        this.ecsWorld.ownerId[idx] = options.ownerId || 0;
        this.ecsWorld.isIndirect[idx] = options.isIndirect ? 1 : 0;
        
        // weaponType 매핑 (0: bullet, 1: sniper, 2: shell, 3: missile, 4: fire)
        const weaponMap = { 'bullet': 0, 'sniper': 1, 'shell': 2, 'missile': 3, 'fire': 4 };
        this.ecsWorld.weaponType[idx] = weaponMap[options.weaponType] || 0;

        // [추가] 투사체는 체력 시스템의 영향을 받지 않도록 충분한 HP 설정 또는 초기화
        this.ecsWorld.hp[idx] = 1; 
        this.ecsWorld.maxHp[idx] = 1;
        
        return idx;
    }

    /**
     * 모든 엔티티 업데이트 (ECS + 레거시 하이브리드)
     */
    update(deltaTime) {
        // 1. 고성능 ECS 시스템 일괄 처리
        ECSSystems.updateMovement(this.ecsWorld, deltaTime);
        ProjectileSystem.updateProjectiles(this.ecsWorld, deltaTime, this.engine);
        ECSSystems.updateHealth(this.ecsWorld, (idx) => this.handleECSDestruction(idx));

        // 2. 기존 객체 기반 업데이트 및 SpatialGrid 동기화
        for (let i = this.allEntities.length - 1; i >= 0; i--) {
            const entity = this.allEntities[i];
            if (!entity || !entity.active || entity.isBoarded) continue;
            
            // ECS에 데이터가 있는 경우 동기화
            if (entity.ecsIndex !== undefined) {
                entity.x = this.ecsWorld.x[entity.ecsIndex];
                entity.y = this.ecsWorld.y[entity.ecsIndex];
            }
            
            if (entity.update) entity.update(deltaTime, this.engine);
            this.spatialGrid.update(entity);
        }

        // 주기적 cleanup (1초마다)
        if (!this._cleanupTimer) this._cleanupTimer = 0;
        this._cleanupTimer += deltaTime;
        if (this._cleanupTimer >= 1000) {
            this.cleanup();
            this._cleanupTimer = 0;
        }
    }

    handleECSDestruction(idx) {
        // ECS 엔티티 파괴 시 필요한 로직
    }

    /**
     * 엔티티 타입 등록 및 풀 초기화
     */
    register(type, EntityClass, listName = 'units', initialPoolSize = 0) {
        this.registry.set(type, { EntityClass, listName });
        
        // 해당 타입을 위한 전용 풀 생성
        const pool = new ObjectPool(() => new EntityClass(0, 0, this.engine), initialPoolSize);
        this.pools.set(type, pool);
    }

    /**
     * 엔티티 생성 (풀링 적용)
     */
    create(type, x, y, options = {}, listOverride = null) {
        const registration = this.registry.get(type);
        if (!registration) {
            console.error(`[EntityManager] Unknown entity type: ${type}`);
            return null;
        }

        const pool = this.pools.get(type);
        let entity = null;

        if (pool) {
            entity = pool.acquire();
            // [추가] 재사용 전 사망 관련 플래그 강제 초기화
            entity.active = true;
            entity.alive = true;
            if (entity.maxHp) entity.hp = entity.maxHp;
            
            // [수정] init 호출 전에 옵션을 먼저 할당하여 init 로직이 옵션을 반영할 수 있게 함
            Object.assign(entity, options);
            entity.init(x, y, this.engine);
        } else {
            const { EntityClass } = registration;
            entity = new EntityClass(x, y, this.engine);
            Object.assign(entity, options);
            // new 생성자의 경우 init이 이미 호출되었을 수 있으므로 필요시 재호출
            if (entity.init) entity.init(x, y, this.engine);
        }

        const { listName } = registration;
        const targetList = listOverride || listName;
        
        const list = this.entities[targetList];
        if (Array.isArray(list) && !list.includes(entity)) {
            list.push(entity);
        }

        if (!this.allEntities.includes(entity)) {
            this.allEntities.push(entity);
        }

        this.spatialGrid.add(entity);

        return entity;
    }

    /**
     * 엔티티 제거 및 풀 반환
     */
    remove(entity) {
        if (!entity || !entity.active) return;

        entity.active = false;
        this.spatialGrid.remove(entity);
    }

    /**
     * 비활성 엔티티 정리 및 풀 반환 (GC 최적화 버전)
     */
    cleanup() {
        for (let i = this.allEntities.length - 1; i >= 0; i--) {
            const entity = this.allEntities[i];
            if (!entity.active) {
                // [추가] 객체 풀 반환 전 강력한 상태 정리
                if (entity.cargo && entity.cargo.length > 0) {
                    // 수송기/트럭이 파괴될 때 안의 유닛들도 함께 파괴 처리 (또는 강제 하차)
                    entity.cargo.forEach(u => {
                        u.isBoarded = false;
                        if (u.hp > 0) u.hp = 0; // 함께 파괴
                        u.active = false;
                    });
                    entity.cargo = [];
                }

                // 특수 상태 정리 (사운드 중단 등)
                if (entity.siegeSoundInstance) {
                    entity.siegeSoundInstance.pause();
                    entity.siegeSoundInstance = null;
                }

                const pool = this.pools.get(entity.type || entity.constructor.name.toLowerCase());
                if (pool) {
                    pool.release(entity);
                }
                this.allEntities.splice(i, 1);
            }
        }

        for (const key in this.entities) {
            const list = this.entities[key];
            if (Array.isArray(list)) {
                for (let i = list.length - 1; i >= 0; i--) {
                    if (!list[i].active) {
                        list.splice(i, 1);
                    }
                }
            }
        }
    }

    /**
     * 특정 위치 주변의 엔티티 검색
     */
    getNearby(x, y, radius, filter = null) {
        return this.spatialGrid.getNearby(x, y, radius, filter);
    }

    /**
     * 직사각형 영역 내의 엔티티 검색
     */
    getInRect(left, top, right, bottom, filter = null) {
        return this.spatialGrid.getInRect(left, top, right, bottom, filter);
    }

    /**
     * 모든 엔티티 가져오기
     */
    getAll() {
        return this.allEntities.filter(e => e.active);
    }

    /**
     * 타입별 엔티티 가져오기
     * @param {string} type - 엔티티 타입
     */
    getByType(type) {
        return this.allEntities.filter(e => e.active && e.type === type);
    }

    /**
     * 초기화 (게임 재시작 시)
     */
    reset() {
        this.spatialGrid.clear();
        this.allEntities = [];

        for (const key in this.entities) {
            this.entities[key] = [];
        }
    }

    clear() {
        this.reset();
    }

    /**
     * 에디터에서 배치 가능한 모든 항목(유닛, 아이템 등) 리스트 반환
     */
    getPlaceableItems() {
        const items = [];
        for (const [type, info] of this.registry.entries()) {
            const EntityClass = info.EntityClass;
            const config = EntityClass.editorConfig || {}; // 설정이 없으면 빈 객체 사용

            if (config.variants) {
                // 여러 변종이 있는 경우 (예: 탄약 상자 종류별)
                config.variants.forEach(variant => {
                    items.push({
                        id: type,
                        name: variant.name || `${type} (${variant.options?.ammoType || '?'})`,
                        icon: variant.icon || '📦',
                        category: config.category || 'item',
                        ownerId: (variant.ownerId !== undefined) ? variant.ownerId : (config.ownerId !== undefined ? config.ownerId : 0),
                        options: variant.options
                    });
                });
            } else {
                // 단일 항목인 경우 (설정이 없어도 기본값으로 생성)
                items.push({
                    id: type,
                    name: config.name || type.charAt(0).toUpperCase() + type.slice(1), // 이름 없으면 타입명 사용
                    icon: config.icon || '❓', // 아이콘 없으면 물음표
                    category: config.category || (type.includes('ammo') ? 'item' : 'unit'),
                    ownerId: (config.ownerId !== undefined) ? config.ownerId : (type.includes('enemy') ? 2 : 1),
                    options: config.options || null
                });
            }
        }
        return items;
    }

    /**
     * 디버그 정보 출력
     */
    debug() {
        console.log(`[EntityManager] Total entities: ${this.allEntities.length}`);
        for (const key in this.entities) {
            const list = this.entities[key];
            if (Array.isArray(list)) {
                console.log(`  ${key}: ${list.length}`);
            }
        }
        this.spatialGrid.debug();
    }
}
