import { Entity } from '../BaseEntity.js';


export class Enemy extends Entity {
    constructor(x, y) {
        super(x, y);
        this.ownerId = 2; // 플레이어 2 (적) 소유
        this.speed = 1.8;
        this.maxHp = 50;
        this.hp = this.maxHp;
        this.size = 40; // 20 -> 40
        this.damage = 10;
        this.attackRange = 35;
        this.attackInterval = 1000;
        this.lastAttackTime = 0;
        this.currentTarget = null;
        this.path = [];
        this.pathTimer = Math.random() * 2000; // 초기 경로 계산 분산
    }

    update(deltaTime, engine) {
        if (!engine) return;
        if (this.hitTimer > 0) this.hitTimer -= deltaTime;
        const now = Date.now();

        // 1. 타겟 결정 로직 (관계 기반)
        if (!this.currentTarget || !this.currentTarget.active || this.currentTarget.hp <= 0) {
            // 가장 가까운 적(Player 1 등) 찾기
            const potentialTargets = [
                ...engine.entities.units
            ];

            let minDist = Infinity;
            let bestTarget = null;

            for (const target of potentialTargets) {
                if (!target || !target.active || target.hp <= 0) continue;

                // 관계 확인
                if (engine.getRelation(this.ownerId, target.ownerId) === 'enemy') {
                    const d = Math.hypot(this.x - target.x, this.y - target.y);
                    if (d < minDist) {
                        minDist = d;
                        bestTarget = target;
                    }
                }
            }
            this.currentTarget = bestTarget;
        }

        if (!this.currentTarget) return;

        // 2초마다 경로 재계산
        this.pathTimer += deltaTime;
        if (this.pathTimer >= 2000 || (this.path.length === 0 && this.hp > 0)) {
            const pf = engine.pathfinding;
            this.path = pf.findPath(this.x, this.y, this.currentTarget.x, this.currentTarget.y, false, this.pathfindingSize) || [];
            this.pathTimer = 0;
        }

        let moveTarget = this.currentTarget;

        // 경로 추종 로직
        while (this.path.length > 0) {
            const waypoint = this.path[0];
            const distToWaypoint = Math.hypot(waypoint.x - this.x, waypoint.y - this.y);
            if (distToWaypoint < 15) {
                this.path.shift();
            } else {
                moveTarget = waypoint;
                break;
            }
        }

        const angleToTarget = Math.atan2(moveTarget.y - this.y, moveTarget.x - this.x);
        this.angle = angleToTarget; // 방향 업데이트

        // 이동 적용
        const dist = this.speed;
        this.x += Math.cos(this.angle) * dist;
        this.y += Math.sin(this.angle) * dist;

        // --- 유닛 간 밀어내기 및 끼임 탈출 ---
        let pushX = 0;
        let pushY = 0;
        const allUnits = [...engine.entities.units, ...engine.entities.enemies];
        for (const other of allUnits) {
            if (other === this || !other.active) continue;
            const d = Math.hypot(this.x - other.x, this.y - other.y);
            const minDist = (this.size + other.size) * 0.4;
            if (d < minDist) {
                const pushAngle = Math.atan2(this.y - other.y, this.x - other.x);
                pushX += Math.cos(pushAngle) * 0.5;
                pushY += Math.sin(pushAngle) * 0.5;
            }
        }
        this.x += pushX;
        this.y += pushY;

        // 공격 로직
        if (this.currentTarget && (this.currentTarget.active !== false) && this.currentTarget.hp > 0) {
            const attackDist = Math.hypot(this.x - this.currentTarget.x, this.y - this.currentTarget.y);
            const rangeThreshold = (this.size / 2 + (this.currentTarget.width || this.currentTarget.size || 40) / 2 + 5);

            if (attackDist <= rangeThreshold) {
                if (now - this.lastAttackTime > this.attackInterval) {
                    this.currentTarget.hp -= this.damage;
                    this.lastAttackTime = now;
                }
            }
        }
    }

    draw(ctx) {
        ctx.save();

        // 적군 외형: 육각형 모양의 위협적인 기계 유닛
        ctx.fillStyle = '#441111';
        ctx.strokeStyle = '#ff3131';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            const px = Math.cos(angle) * (this.size / 2.5);
            const py = Math.sin(angle) * (this.size / 2.5);
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 중앙 '코어'
        ctx.fillStyle = '#ff3131';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
