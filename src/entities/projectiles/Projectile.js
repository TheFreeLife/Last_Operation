import { Entity } from '../BaseEntity.js';

export class Projectile extends Entity {
    constructor(x, y, target, damage, color = '#ffff00', source) {
        super(x, y);
        this.target = target;
        this.damage = damage;
        this.color = color;
        this.source = source;
        this.speed = 8;
        this.size = 6;
        this.type = 'normal'; // 'shell', 'normal', etc.
        this.angle = 0;
        this.explosionRadius = 0; // 0이면 단일 타겟, >0 이면 범위 공격
        this.exploding = false; // 폭발 연출 중인지 여부
        this.explosionTimer = 0;
    }

    explode(engine) {
        if (this.explosionRadius > 0) {
            // 모든 잠재적 타겟 수집
            const targets = [
                engine.entities.base,
                ...engine.entities.enemies,
                ...engine.entities.units,
                ...engine.entities.neutral,
                ...engine.getAllBuildings()
            ];

            // 공격 주체의 공격 가능 대상 목록 가져오기
            const attackTargets = this.source?.attackTargets || ['ground', 'sea'];

            targets.forEach(target => {
                if (!target || target.hp === undefined || !target.active || target.hp <= 0) return;

                // 1. 도메인 체크
                const targetDomain = target.domain || 'ground';
                if (!attackTargets.includes(targetDomain)) return;

                // 2. 관계 체크 (적과 중립 모두 스플래시 데미지 입힘, 자신 및 아군 제외)
                const isManualTarget = (this.source && this.source.manualTarget === target);
                const relation = engine.getRelation(this.source.ownerId, target.ownerId);

                // 강제 공격 대상이면 관계 무시하고 데미지 적용
                if (!isManualTarget && (relation === 'self' || relation === 'ally')) return;

                const dist = Math.hypot(target.x - this.x, target.y - this.y);
                if (dist <= this.explosionRadius) {
                    target.takeDamage(this.damage);
                }
            });
            this.exploding = true;
            this.explosionTimer = 150; // 150ms 동안 폭발 연출
        } else {
            // 단일 타겟 처리 (이미 hit 체크에서 처리됨)
            this.active = false;
        }
    }

    update(deltaTime, engine) {
        if (this.exploding) {
            this.explosionTimer -= deltaTime;
            if (this.explosionTimer <= 0) this.active = false;
            return;
        }

        if (!this.active) return;

        // 타겟 유효성 체크 (active와 alive 모두 고려)
        const isTargetDead = (this.target.active === false) || (this.target.alive === false) || (this.target.hp <= 0);
        if (!this.target || isTargetDead) {
            this.active = false;
            return;
        }

        this.angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;

        if (!engine) return;

        // 충돌 체크 함수 (관계 시스템 적용)
        const checkCollision = (other) => {
            if (!other || other === this.source || other.passable) return false;

            // 대상이 이미 죽었는지 확인
            const isDead = (other.active === false) || (other.alive === false) || (other.hp <= 0);
            if (isDead) return false;

            // 소스 유닛과 대상의 관계 확인
            const relation = engine.getRelation(this.source.ownerId, other.ownerId);

            // 자신, 아군, 중립은 기본적으로 충돌 무시 (단, 강제 공격 대상이면 허용)
            const isManualTarget = (this.source.manualTarget === other);
            if (!isManualTarget && (relation === 'self' || relation === 'ally' || relation === 'neutral')) return false;

            // [수정] 곡사 무기는 지상 장애물 통과
            const isIndirectFire = (this.type === 'shell') || (this.source && this.source.type === 'missile-launcher');
            if (isIndirectFire && other.domain === 'ground') return false;

            // 소스 유닛이 장애물 통과 능력이 있으면 비행 중 충돌 무시
            if (this.source && this.source.canBypassObstacles) return false;

            // 공격 가능 도메인인지 확인 (가장 중요)
            if (!this.source.attackTargets.includes(other.domain || 'ground')) return false;

            const bounds = other.getSelectionBounds ? other.getSelectionBounds() : null;
            if (bounds) {
                return this.x >= bounds.left && this.x <= bounds.right &&
                    this.y >= bounds.top && this.y <= bounds.bottom;
            }
            const dist = Math.hypot(this.x - other.x, this.y - other.y);
            const otherSize = other.size || 40;
            return dist < (this.size / 2 + otherSize / 2);
        };

        // 모든 잠재적 타겟에 대해 충돌 체크 (단일 루프로 통합)
        const allPotentialTargets = [
            engine.entities.base,
            ...engine.entities.units,
            ...engine.entities.enemies,
            ...engine.entities.neutral,
            ...engine.getAllBuildings()
        ];

        for (const target of allPotentialTargets) {
            if (checkCollision(target)) {
                if (this.explosionRadius > 0) {
                    this.explode(engine);
                } else {
                    target.hp -= this.damage;
                    if (target.hp <= 0) {
                        if (target.active !== undefined) target.active = false;
                        if (target.alive !== undefined) target.alive = false;
                    }
                    this.active = false;
                }
                return;
            }
        }

        // 목표 도달 체크
        if (Math.hypot(this.x - this.target.x, this.y - this.target.y) < 15) {
            if (this.explosionRadius > 0) {
                this.explode(engine);
            } else {
                this.target.takeDamage(this.damage);
                this.active = false;
            }
        }
    }

    draw(ctx) {
        if (this.exploding) {
            // 폭발 이펙트
            ctx.save();
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.explosionRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 165, 0, ${this.explosionTimer / 150})`;
            ctx.fill();
            ctx.strokeStyle = `rgba(255, 69, 0, ${this.explosionTimer / 150})`;
            ctx.stroke();
            ctx.restore();
            return;
        }

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        if (this.type === 'shell') {
            // 전차 포탄 외형
            ctx.fillStyle = '#7f8c8d'; // 금속 회색
            ctx.strokeStyle = '#2c3e50';
            ctx.lineWidth = 1;

            // 포탄 몸체 (길쭉한 타원/사각형 조합)
            ctx.beginPath();
            ctx.moveTo(8, 0);
            ctx.lineTo(-4, -3);
            ctx.lineTo(-8, -3);
            ctx.lineTo(-8, 3);
            ctx.lineTo(-4, 3);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // 추진체 불꽃/빛 (뒤쪽)
            ctx.fillStyle = '#e67e22';
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#f39c12';
            ctx.beginPath();
            ctx.arc(-8, 0, 3, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'tracer') {
            // 예광탄 (길쭉한 빨간색 광원)
            ctx.fillStyle = this.color;
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.color;

            // 길쭉한 사각형 (탄환 진행 방향으로)
            ctx.beginPath();
            ctx.roundRect(-8, -1.5, 12, 3, 1.5);
            ctx.fill();

            // 더 밝은 중심선
            ctx.fillStyle = '#fff';
            ctx.fillRect(-4, -0.5, 6, 1);
        } else {
            // 일반 발사체 (빛나는 구체)
            ctx.fillStyle = this.color;
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.color;
            ctx.beginPath();
            ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}
