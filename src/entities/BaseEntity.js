export class Entity {
    constructor(x, y, engine) {
        this.init(x, y, engine);
    }

    /**
     * 객체 초기화 (생성 및 풀에서 재사용 시 호출)
     */
    init(x, y, engine) {
        this.x = x;
        this.y = y;
        this.engine = engine;
        this.active = true;
        this.width = 40;  // Default 1x1
        this.height = 40; // Default 1x1
        this.size = 40;   // Default for circles
        this.domain = 'ground'; // 'ground', 'air', 'sea' (기본값 지상)
        this.attackTargets = ['ground', 'sea']; // 공격 가능 대상 (기본값 지상/해상)
        this.passable = false; // 통과 가능 여부 (기본값: 불가능)
        this.isBoarded = false; // 수송기 탑승 여부

        // 소유권 속성 추가
        this.ownerId = 1; // 기본적으로 플레이어 1 (사용자) 소유

        // 피격 효과 관련
        this.hitTimer = 0;
    }

    /**
     * 오브젝트 풀로 반환되기 전 호출되는 정리 메서드
     */
    onRelease() {
        this.active = false;
        // 엔진 참조 해제 등으로 메모리 누수 방지 (선택적)
        // this.engine = null; 
    }

    // 피격 처리 공통 메서드
    takeDamage(amount) {
            if (this.hp === undefined || !this.active) return;
    
            // [추가] 디버그 시스템 무적 모드 체크
            if (this.engine && this.engine.debugSystem && this.engine.debugSystem.isGodMode) {
                if (this.ownerId === 1) return; // 아군 무적
            }
    
            this.hp -= amount;        this.hitTimer = 150; // 150ms 동안 피격 상태 유지 (깜빡임 효과용)

        if (this.hp <= 0) {
            this.active = false;
            if (this.alive !== undefined) this.alive = false;
        }
    }

    // 대상이 이 주체(Entity/Projectile)로부터 피해를 입을 수 있는지 확인
    canDamage(target, engine) {
        if (!target || !target.active || target.hp === undefined) return false;

        // 1. 도메인 확인 (공중/지상 등)
        if (!this.attackTargets.includes(target.domain)) return false;

        // 2. 관계 확인 (아군 사격 방지)
        if (engine && engine.getRelation) {
            const relation = engine.getRelation(this.ownerId, target.ownerId);
            // 강제 공격 대상(manualTarget)인 경우 관계에 상관없이 공격 허용
            if (this.manualTarget === target) return true;

            if (relation === 'self' || relation === 'ally') return false; // 자신 및 아군은 공격 불가
            if (relation === 'neutral') return false; // 중립은 명시적 명령 전까지 공격 불가
        }

        return true;
    }

    getSelectionBounds() {
        const w = this.width || this.size || 40;
        const h = this.height || this.size || 40;
        return {
            left: this.x - w / 2,
            right: this.x + w / 2,
            top: this.y - h / 2,
            bottom: this.y + h / 2
        };
    }

    // --- 자동 계산 로직 추가 ---
    // 유닛의 크기에 따른 물리 충돌 반경 (0.45는 대형 유닛 우회 마진 포함)
    get collisionRadius() {
        return (this.size || 40) * 0.45;
    }

    // 길찾기 엔진에 전달할 크기
    get pathfindingSize() {
        return this.size || 40;
    }
}
