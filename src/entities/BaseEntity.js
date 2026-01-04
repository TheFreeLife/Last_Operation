export class Entity {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.active = true;
        this.width = 40;  // Default 1x1
        this.height = 40; // Default 1x1
        this.size = 40;   // Default for circles
        this.domain = 'ground'; // 'ground', 'air', 'sea' (기본값 지상)
        this.attackTargets = ['ground', 'sea']; // 공격 가능 대상 (기본값 지상/해상)
        this.popCost = 0; // 인구수 비용 (유닛용)
        this.popProvide = 0; // 인구수 제공 (건물용)
        this.passable = false; // 통과 가능 여부 (기본값: 불가능)
        this.isBoarded = false; // 수송기 탑승 여부

        // 소유권 속성 추가
        this.ownerId = 1; // 기본적으로 플레이어 1 (사용자) 소유

        // 건설 관련 속성
        this.isUnderConstruction = false;
        this.buildProgress = 0; // 0 to 1
        this.totalBuildTime = 0;
        this.targetResource = null; // 건설 중인 자원 객체 보관용

        // 피격 효과 관련
        this.hitTimer = 0;
    }

    // 피격 처리 공통 메서드
    takeDamage(amount) {
        if (this.hp === undefined || !this.active) return;
        this.hp -= amount;
        this.hitTimer = 150; // 150ms 동안 피격 상태 유지 (깜빡임 효과용)

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

    drawConstruction(ctx) {
        if (!this.isUnderConstruction) return;

        const w = this.width || this.size || 40;
        const h = this.height || this.size || 40;

        // 1. 건설 부지 가이드 (점선)
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(this.x - w / 2, this.y - h / 2, w, h);

        // 2. 진행 바
        const barW = w * 0.8;
        const barH = 6;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(this.x - barW / 2, this.y + h / 2 + 5, barW, barH);
        ctx.fillStyle = '#f1c40f'; // 건설은 노란색
        ctx.fillRect(this.x - barW / 2, this.y + h / 2 + 5, barW * this.buildProgress, barH);
        ctx.restore();
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
