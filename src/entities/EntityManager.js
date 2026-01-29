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
        this.ecsWorld.targetX[idx] = target.x;
        this.ecsWorld.targetY[idx] = target.y;
        this.ecsWorld.speed[idx] = options.speed || 8;
        this.ecsWorld.damage[idx] = damage;
        this.ecsWorld.explosionRadius[idx] = options.explosionRadius || 0;
        this.ecsWorld.ownerId[idx] = options.ownerId || 0;
        
        return idx;
    }

    /**
     * ECS 시스템 실행
     */
    update(deltaTime) {
        // 1. 고성능 ECS 시스템 일괄 처리
        ECSSystems.updateMovement(this.ecsWorld, deltaTime);
        ProjectileSystem.updateProjectiles(this.ecsWorld, deltaTime, this.engine);
        ECSSystems.updateHealth(this.ecsWorld, (idx) => this.handleECSDestruction(idx));

        // 2. 기존 객체 기반 업데이트
        const lists = Object.values(this.entities);
        for (const list of lists) {
            if (Array.isArray(list)) {
                for (let i = list.length - 1; i >= 0; i--) {
                    const entity = list[i];
                    if (!entity || !entity.active) continue;
                    
                    // ECS에 데이터가 있는 경우 동기화
                    if (entity.ecsIndex !== undefined) {
                        entity.x = this.ecsWorld.x[entity.ecsIndex];
                        entity.y = this.ecsWorld.y[entity.ecsIndex];
                    }
                    
                    if (entity.update) entity.update(deltaTime, this.engine);
                    this.spatialGrid.update(entity);
                }
            }
        }

        // 주기적 cleanup
        if (!this._cleanupTimer) this._cleanupTimer = 0;
        this._cleanupTimer += deltaTime;
        if (this._cleanupTimer >= 1000) {
            this.cleanup();
            this._cleanupTimer = 0;
        }
    }

    handleECSDestruction(idx) {
        // ECS 엔티티 파괴 시 필요한 로직 (예: 폭발 효과)
        // 기존 객체 래퍼가 있다면 해당 객체도 비활성화
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
            // init() 메서드를 통해 새로운 상태로 초기화
            // options가 있을 경우를 대비해 x, y 등 기본값은 options 전후로 처리 가능
            entity.init(x, y, this.engine);
        } else {
            const { EntityClass } = registration;
            entity = new EntityClass(x, y, this.engine);
        }

        // 추가 옵션 적용 (속도, 팀 ID 등)
        Object.assign(entity, options);

        const { listName } = registration;
        const targetList = listOverride || listName;
        
        // 리스트에 추가 (중복 방지)
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

        // 즉시 리스트에서 제거하는 대신 cleanup에서 처리하거나 
        // 빈번한 객체(투사체 등)의 경우 즉시 풀로 보낼 수 있도록 설계 가능
    }

    /**
     * 비활성 엔티티 정리 및 풀 반환 (GC 최적화 버전)
     * filter() 대신 역순 순회 및 splice를 사용하거나, 새 배열 할당을 최소화합니다.
     */
    cleanup() {
        // 전체 엔티티 리스트 정리
        for (let i = this.allEntities.length - 1; i >= 0; i--) {
            const entity = this.allEntities[i];
            if (!entity.active) {
                // 풀에 반환
                const pool = this.pools.get(entity.type || entity.constructor.name.toLowerCase());
                if (pool) {
                    pool.release(entity);
                }

                // 배열에서 제거
                this.allEntities.splice(i, 1);
            }
        }

        // 타입별 리스트 정리
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
     * @param {number} x - 중심 X 좌표
     * @param {number} y - 중심 Y 좌표
     * @param {number} radius - 검색 반경
     * @param {function} filter - 필터 함수 (옵션)
     */
    getNearby(x, y, radius, filter = null) {
        return this.spatialGrid.getNearby(x, y, radius, filter);
    }

    /**
     * 직사각형 영역 내의 엔티티 검색 (주로 화면 컬링용)
     */
    getInRect(left, top, right, bottom, filter = null) {
        return this.spatialGrid.getInRect(left, top, right, bottom, filter);
    }

    /**
     * 모든 엔티티 업데이트
     * @param {number} deltaTime - 프레임 시간
     */
    update(deltaTime) {
        // [수정] GameEngine이 직접 관리하는 entities 리스트들을 순회하여 SpatialGrid 갱신
        const lists = Object.values(this.entities);
        for (const list of lists) {
            if (Array.isArray(list)) {
                for (const entity of list) {
                    if (!entity || !entity.active || entity.isBoarded) continue;
                    this.spatialGrid.update(entity);
                }
            }
        }

        // 일정 주기마다 정리 (매 프레임은 과도할 수 있음)
        if (!this._cleanupTimer) this._cleanupTimer = 0;
        this._cleanupTimer += deltaTime;
        if (this._cleanupTimer >= 1000) { // 1초마다
            this.cleanup();
            this._cleanupTimer = 0;
        }
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
            const config = info.EntityClass.editorConfig;
            if (!config) continue;

            if (config.variants) {
                // 여러 변종이 있는 경우 (예: 탄약 상자 종류별)
                config.variants.forEach(variant => {
                    items.push({
                        id: type, // 베이스 타입 유지
                        name: variant.name,
                        icon: variant.icon,
                        category: config.category || 'unit',
                        ownerId: (config.ownerId !== undefined) ? config.ownerId : (config.category === 'unit' ? 2 : 1),
                        options: variant.options // 생성 시 전달할 옵션 (ammoType 등)
                    });
                });
            } else {
                // 단일 항목인 경우
                items.push({
                    id: type,
                    name: config.name || type,
                    icon: config.icon || '❓',
                    category: config.category || 'unit',
                    ownerId: (config.ownerId !== undefined) ? config.ownerId : (config.category === 'unit' ? 2 : 0)
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
