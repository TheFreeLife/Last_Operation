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
        this.trail = []; // 궤적 저장을 위한 배열
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
            this.explosionTimer = 150; // 150ms 동안 연출

            // 시네마틱 폭발 효과 발생 (명중 지점)
            if (engine.addEffect) {
                engine.addEffect('explosion', this.x, this.y);
            }
        } else {
            // 단일 타겟 처리
            if (engine.addEffect) {
                engine.addEffect('hit', this.x, this.y, this.color);
            }
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

        // 궤적 업데이트 (속도감 향상)
        this.trail.push({ x: this.x, y: this.y, alpha: 1.0 });
        if (this.trail.length > 6) this.trail.shift();
        this.trail.forEach(t => t.alpha -= 0.15);

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

        // [최적화] SpatialGrid를 사용하여 주변 엔티티만 검색
        // 투사체 속도가 빠르므로 검색 반경을 넉넉하게 잡음 (자신 크기 + 최대 타겟 크기 + 이동 속도)
        const searchRadius = 60; 
        const nearbyTargets = engine.entityManager.getNearby(this.x, this.y, searchRadius);

        for (const target of nearbyTargets) {
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
            ctx.restore();
            return;
        }

        // 궤적(Trail) 렌더링
        this.trail.forEach(t => {
            ctx.save();
            ctx.globalAlpha = t.alpha * 0.4;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(t.x, t.y, this.size / 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        if (this.type === 'shell') {
            // 뾰족한 포탄 몸체
            ctx.fillStyle = '#7f8c8d';
            ctx.beginPath();
            ctx.moveTo(10, 0);
            ctx.lineTo(-2, -4);
            ctx.lineTo(-8, -4);
            ctx.lineTo(-8, 4);
            ctx.lineTo(-2, 4);
            ctx.closePath();
            ctx.fill();

            // 뒤쪽 추진 불꽃
            ctx.fillStyle = '#ff8c00';
            ctx.beginPath();
            ctx.arc(-8, 0, 3 + Math.random() * 2, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'tracer') {
            // 레이저 같은 예광탄
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.roundRect(-12, -1.5, 16, 3, 1.5);
            ctx.fill();
            // 중심 하이라이트
            ctx.fillStyle = '#fff';
            ctx.fillRect(-6, -0.5, 10, 1);
        } else {
            // 일반 탄환
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}
