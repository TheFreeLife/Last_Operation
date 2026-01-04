import { Entity } from '../BaseEntity.js';

export class Missile extends Entity {
    constructor(startX, startY, targetX, targetY, damage, engine, source = null) {
        super(startX, startY);
        this.source = source;
        this.ownerId = source ? source.ownerId : 0;
        this.startX = startX;
        this.startY = startY;
        this.targetX = targetX;
        this.targetY = targetY;
        this.damage = damage;
        this.engine = engine;
        this.speed = 7; // 비행 속도 상향 (4 -> 7)
        this.angle = Math.atan2(targetY - startY, targetX - startX);
        this.totalDistance = Math.hypot(targetX - startX, targetY - startY);
        this.active = true;
        this.explosionRadius = 80; // 약 2칸 반경
        this.arrived = false;
        this.explosionTimer = 0;
        this.maxExplosionTime = 120; // 약 2초간 지속 (충분한 연기 감상 시간)
        // 거리에 따라 고도를 동적으로 조절 (최소 200, 최대 600)
        this.peakHeight = Math.max(200, Math.min(this.totalDistance * 0.4, 600));
        this.trail = [];
    }

    update(deltaTime) {
        if (!this.active && !this.arrived) return;

        if (this.active) {
            const currentDist = Math.hypot(this.x - this.startX, this.y - this.startY);
            const progress = Math.min(currentDist / this.totalDistance, 1);

            if (progress >= 1) {
                this.explode();
            } else {
                this.x += Math.cos(this.angle) * this.speed;
                this.y += Math.sin(this.angle) * this.speed;

                const altitude = Math.sin(progress * Math.PI) * this.peakHeight;
                this.trail.push({ x: this.x, y: this.y - altitude, alpha: 1.0 });
                if (this.trail.length > 25) this.trail.shift();
            }
        } else if (this.arrived) {
            this.explosionTimer++;
            if (this.explosionTimer >= this.maxExplosionTime) {
                this.arrived = false;
            }
        }

        this.trail.forEach(p => p.alpha -= 0.04);
        this.trail = this.trail.filter(p => p.alpha > 0);
    }

    explode() {
        this.active = false;
        this.arrived = true;
        this.explosionTimer = 0;

        this.smokeParticles = [];
        for (let i = 0; i < 15; i++) {
            this.smokeParticles.push({
                angle: Math.random() * Math.PI * 2,
                dist: Math.random() * this.explosionRadius * 0.8,
                size: 30 + Math.random() * 30,
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4 - 0.5,
                color: Math.random() > 0.5 ? '#7f8c8d' : '#95a5a6'
            });
        }

        const targets = [
            ...this.engine.entities.enemies,
            ...this.engine.entities.neutral,
            ...this.engine.entities.units,
            ...this.engine.getAllBuildings()
        ];

        targets.forEach(target => {
            if (!target || target.hp === undefined || !target.active || target.hp <= 0) return;

            // 공중 유닛 공격 제외
            if (target.domain === 'air') return;

            // 관계 체크 (자신 및 아군 오사 방지)
            const relation = this.engine.getRelation(this.ownerId, target.ownerId);
            const isManualTarget = (this.source && this.source.manualTarget === target);

            // 강제 공격 대상이면 관계 무시
            if (!isManualTarget && (relation === 'self' || relation === 'ally')) return;

            const dist = Math.hypot(target.x - this.targetX, target.y - this.targetY);
            if (dist <= this.explosionRadius) {
                target.takeDamage(this.damage);
            }
        });
    }

    draw(ctx) {
        if (!this.active && !this.arrived) return;

        // 1. 비행 연기 트레일
        this.trail.forEach(p => {
            ctx.save();
            ctx.globalAlpha = p.alpha * 0.5;
            ctx.fillStyle = '#bdc3c7';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

        if (this.active) {
            const currentDist = Math.hypot(this.x - this.startX, this.y - this.startY);
            const progress = Math.min(currentDist / this.totalDistance, 1);
            const altitude = Math.sin(progress * Math.PI) * this.peakHeight;

            // 2. 그림자 (고도에 따라 크기 변화)
            ctx.save();
            ctx.globalAlpha = 0.2;
            ctx.fillStyle = '#000';
            const shadowSize = Math.max(5, 10 * (1 - altitude / this.peakHeight));
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, shadowSize, shadowSize * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // 3. 미사일 본체
            ctx.save();
            ctx.translate(this.x, this.y - altitude);

            // --- 정밀 탄도 각도 계산 (접선 벡터) ---
            // 수평 속도 벡터
            const vx = Math.cos(this.angle);
            const vy = Math.sin(this.angle);

            // 수직 고도 변화율 (sin 미분 -> cos)
            // altitude = peakHeight * sin(progress * PI)
            // d(altitude)/d(progress) = peakHeight * PI * cos(progress * PI)
            const dAlt = this.peakHeight * Math.PI * Math.cos(progress * Math.PI);

            // progress = dist / totalDist 이므로 d(progress)/dt 연쇄법칙 적용
            // 최종적으로 비행 기울기 산출
            const flightAngle = Math.atan2(vy * this.totalDistance - dAlt, vx * this.totalDistance);

            ctx.rotate(flightAngle);

            ctx.fillStyle = '#f5f6fa';
            ctx.beginPath();
            ctx.moveTo(16, 0); ctx.lineTo(6, -3); ctx.lineTo(-12, -3); ctx.lineTo(-12, 3); ctx.lineTo(6, 3);
            ctx.closePath(); ctx.fill();

            ctx.fillStyle = '#2d3436';
            ctx.beginPath(); ctx.moveTo(-6, -3); ctx.lineTo(-12, -7); ctx.lineTo(-12, -3); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-6, 3); ctx.lineTo(-12, 7); ctx.lineTo(-12, 3); ctx.closePath(); ctx.fill();

            const flameSize = 4 + Math.random() * 3;
            ctx.fillStyle = '#f1c40f';
            ctx.beginPath(); ctx.arc(-13, 0, flameSize, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#e67e22';
            ctx.beginPath(); ctx.arc(-13, 0, flameSize * 0.6, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        } else if (this.arrived) {
            ctx.save();
            const progress = this.explosionTimer / this.maxExplosionTime;
            const fireAlpha = Math.max(0, 1 - progress * 4); // 화염은 아주 짧게 (0.5초 이내)
            const smokeAlpha = Math.max(0, 1 - progress);   // 연기는 2초 동안 서서히

            // 1. 잔류 연기 효과 (Lingering Smoke)
            if (this.smokeParticles) {
                this.smokeParticles.forEach(p => {
                    const shiftX = p.vx * this.explosionTimer;
                    const shiftY = p.vy * this.explosionTimer;
                    const size = p.size * (1 + progress * 2); // 연기가 대폭 확산

                    ctx.save();
                    ctx.globalAlpha = smokeAlpha * 0.95; // 연기 농도 대폭 강화
                    ctx.fillStyle = p.color;
                    ctx.beginPath();
                    const px = this.targetX + Math.cos(p.angle) * p.dist + shiftX;
                    const py = this.targetY + Math.sin(p.angle) * p.dist + shiftY;
                    ctx.arc(px, py, size, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                });
            }

            // 2. 충격파 고리
            if (progress < 0.2) {
                ctx.beginPath();
                ctx.arc(this.targetX, this.targetY, this.explosionRadius * Math.pow(progress / 0.2, 0.5), 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255, 255, 255, ${(1 - progress / 0.2) * 0.8})`;
                ctx.lineWidth = 5;
                ctx.stroke();
            }

            // 3. 메인 화염 (Fire)
            if (fireAlpha > 0) {
                const grad = ctx.createRadialGradient(this.targetX, this.targetY, 0, this.targetX, this.targetY, this.explosionRadius);
                grad.addColorStop(0, `rgba(255, 255, 255, ${fireAlpha})`);
                grad.addColorStop(0.3, `rgba(255, 215, 0, ${fireAlpha * 0.9})`);
                grad.addColorStop(1, `rgba(255, 69, 0, 0)`);

                ctx.beginPath();
                ctx.arc(this.targetX, this.targetY, this.explosionRadius * (1 + progress), 0, Math.PI * 2);
                ctx.fillStyle = grad;
                ctx.fill();
            }

            ctx.restore();
        }
    }
}
