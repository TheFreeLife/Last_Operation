import { SpatialGrid } from '../engine/systems/SpatialGrid.js';

/**
 * EntityManager - 엔티티 생성 및 관리 중앙화
 * 
 * 역할:
 * 1. 팩토리 패턴으로 엔티티 생성
 * 2. 타입별 레지스트리 관리
 * 3. 공간 분할(SpatialGrid)을 통한 효율적인 검색
 * 4. 엔티티 풀링 (추후 확장)
 */
export class EntityManager {
    constructor(engine) {
        this.engine = engine;

        // 엔티티 타입별 클래스 레지스트리
        this.registry = new Map();

        // 공간 분할 그리드
        this.spatialGrid = new SpatialGrid(100); // 100px 셀 크기

        // 타입별 엔티티 저장소 (기존 호환성 유지)
        this.entities = {
            units: [],
            enemies: [],
            neutral: [],
            projectiles: [],
            cargoPlanes: [],
            resources: []
        };

        // 모든 활성 엔티티 (빠른 전체 순회용)
        this.allEntities = [];

        // 엔티티 풀 (타입별)
        this.pools = new Map();
    }

    /**
     * 엔티티 타입 등록
     * @param {string} type - 엔티티 타입 (예: 'tank', 'rifleman')
     * @param {Class} EntityClass - 엔티티 클래스
     * @param {string} listName - 저장할 리스트 이름 (예: 'units')
     */
    register(type, EntityClass, listName = 'units') {
        this.registry.set(type, { EntityClass, listName });
    }

    /**
     * 엔티티 생성 (팩토리 메서드 - 오브젝트 풀링 적용)
     * @param {string} type - 엔티티 타입
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     * @param {object} options - 추가 옵션
     * @returns {Entity} 생성된 엔티티
     */
    create(type, x, y, options = {}) {
        const registration = this.registry.get(type);
        if (!registration) {
            console.error(`[EntityManager] Unknown entity type: ${type}`);
            return null;
        }

        const { EntityClass, listName } = registration;
        let entity = null;

        // 1. 오브젝트 풀 확인 (투사체 등 빈번한 생성 객체 우선 적용)
        const pool = this.pools.get(type);
        if (pool && pool.length > 0) {
            entity = pool.pop();
            entity.x = x;
            entity.y = y;
            entity.active = true;
            if (entity.init) entity.init(x, y, this.engine); // 재사용 초기화 메서드 호출
        } else {
            // 2. 풀에 없으면 새로 생성
            entity = new EntityClass(x, y, this.engine);
        }

        // 추가 옵션 적용
        Object.assign(entity, options);

        // 타입별 리스트에 추가
        const list = this.entities[listName];
        if (Array.isArray(list)) {
            if (!list.includes(entity)) list.push(entity);
        }

        // 전체 엔티티 리스트에 추가
        if (!this.allEntities.includes(entity)) {
            this.allEntities.push(entity);
        }

        // 공간 그리드에 등록
        this.spatialGrid.add(entity);

        return entity;
    }

    /**
     * 엔티티 제거 (오브젝트 풀로 반환)
     * @param {Entity} entity - 제거할 엔티티
     */
    remove(entity) {
        if (!entity || !entity.active) return;

        entity.active = false;

        // 공간 그리드에서 제거
        this.spatialGrid.remove(entity);

        // 오브젝트 풀에 반환 (투사체 타입 위주)
        if (entity.type === 'projectile' || entity.type === 'bullet' || entity.type === 'shell') {
            if (!this.pools.has(entity.type)) {
                this.pools.set(entity.type, []);
            }
            const pool = this.pools.get(entity.type);
            if (pool.length < 500) { // 풀 크기 제한
                pool.push(entity);
            }
        }

        // 전체 리스트에서 제거는 cleanup에서 일괄 처리
    }

    /**
     * 비활성 엔티티 정리 (매 프레임 또는 주기적으로 호출)
     */
    cleanup() {
        // 각 리스트에서 비활성 엔티티 제거
        for (const key in this.entities) {
            const list = this.entities[key];
            if (Array.isArray(list)) {
                this.entities[key] = list.filter(e => e.active);
            }
        }

        // 전체 리스트 정리
        this.allEntities = this.allEntities.filter(e => e.active);
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
            if (Array.isArray(this.entities[key])) {
                this.entities[key] = [];
            } else {
                this.entities[key] = null;
            }
        }
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
