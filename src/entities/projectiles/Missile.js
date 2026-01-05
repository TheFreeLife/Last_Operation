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
        this.speed = 7; 
        this.angle = Math.atan2(targetY - startY, targetX - startX);
        this.totalDistance = Math.hypot(targetX - startX, targetY - startY);
        this.active = true;
        this.explosionRadius = 150; // 80 -> 150 (약 4타일 반경)
        this.arrived = false;
        this.explosionTimer = 0;
        this.maxExplosionTime = 300; 
        this.peakHeight = Math.max(200, Math.min(this.totalDistance * 0.4, 600));
        this.trail = [];
    }

    update(deltaTime) {
        if (!this.active) return;

        if (!this.arrived) {
            const currentDist = Math.hypot(this.x - this.startX, this.y - this.startY);
            const progress = Math.min(currentDist / this.totalDistance, 1);

            if (progress >= 1) {
                this.explode();
            } else {
                this.x += Math.cos(this.angle) * this.speed;
                this.y += Math.sin(this.angle) * this.speed;

                const altitude = Math.sin(progress * Math.PI) * this.peakHeight;
                this.trail.push({ x: this.x, y: this.y - altitude, alpha: 1.0 });
                if (this.trail.length > 60) this.trail.shift();
            }
        } else {
            this.explosionTimer++;
            if (this.explosionTimer >= this.maxExplosionTime && this.trail.length === 0) {
                this.active = false;
            }
        }

        this.trail.forEach(p => {
            const decay = (deltaTime / 16.6) * 0.015;
            p.alpha -= decay;
        });
        this.trail = this.trail.filter(p => p.alpha > 0);
    }

    explode() {
        this.arrived = true;
        this.explosionTimer = 0;

        // 중앙 집중형 폭발 효과 호출
        if (this.engine.addEffect) {
            this.engine.addEffect('explosion', this.targetX, this.targetY);
            // 미사일 특유의 거대 연기 구름을 위해 추가 호출
            for(let i=0; i<3; i++) this.engine.addEffect('explosion', this.targetX + (Math.random()-0.5)*40, this.targetY + (Math.random()-0.5)*40);
        }

        const targets = [
            ...this.engine.entities.enemies,
            ...this.engine.entities.neutral,
            ...this.engine.entities.units,
            ...this.engine.getAllBuildings()
        ];

        targets.forEach(target => {
            if (!target || target.hp === undefined || !target.active || target.hp <= 0) return;
            if (target.domain === 'air') return;
            const relation = this.engine.getRelation(this.ownerId, target.ownerId);
            const isManualTarget = (this.source && this.source.manualTarget === target);
            if (!isManualTarget && (relation === 'self' || relation === 'ally')) return;

            const dist = Math.hypot(target.x - this.targetX, target.y - this.targetY);
            if (dist <= this.explosionRadius) {
                target.takeDamage(this.damage);
            }
        });
        this.damage = 0;
    }

    draw(ctx) {
        if (!this.active) return;

        // 1. 비행 연기 트레일 (항상 그림)
        this.trail.forEach(p => {
            ctx.save();
            ctx.globalAlpha = p.alpha * 0.5;
            ctx.fillStyle = '#bdc3c7';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

        if (this.arrived) {
            // 2. 폭발 이펙트
            ctx.save();
            const progress = this.explosionTimer / this.maxExplosionTime;
            const fireAlpha = Math.max(0, 1 - progress * 5);
            const smokeAlpha = Math.max(0, 1 - Math.pow(progress, 0.7)); 

            if (this.smokeParticles) {
                this.smokeParticles.forEach(p => {
                    const shiftX = p.vx * this.explosionTimer * 0.5;
                    const shiftY = (p.vy * this.explosionTimer * 0.5) - (this.explosionTimer * 0.2); 
                    const size = p.size * (1 + Math.sqrt(progress) * 1.5); 

                    ctx.save();
                    ctx.globalAlpha = smokeAlpha * 0.8; 
                    ctx.fillStyle = p.color;
                    ctx.beginPath();
                    const px = this.targetX + Math.cos(p.angle) * p.dist + shiftX;
                    const py = this.targetY + Math.sin(p.angle) * p.dist + shiftY;
                    ctx.arc(px, py, size, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                });
            }

            if (progress < 0.2) {
                ctx.beginPath();
                ctx.arc(this.targetX, this.targetY, this.explosionRadius * Math.pow(progress / 0.2, 0.5), 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255, 255, 255, ${(1 - progress / 0.2) * 0.8})`;
                ctx.lineWidth = 5;
                ctx.stroke();
            }

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
        } else {
            // 3. 미사일 본체 (비행 중)
            const currentDist = Math.hypot(this.x - this.startX, this.y - this.startY);
            const progress = Math.min(currentDist / this.totalDistance, 1);
            const altitude = Math.sin(progress * Math.PI) * this.peakHeight;

            ctx.save();
            ctx.globalAlpha = 0.2;
            ctx.fillStyle = '#000';
            const shadowSize = Math.max(5, 10 * (1 - altitude / this.peakHeight));
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, shadowSize, shadowSize * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            ctx.save();
            ctx.translate(this.x, this.y - altitude);
            const vx = Math.cos(this.angle);
            const vy = Math.sin(this.angle);
            const dAlt = this.peakHeight * Math.PI * Math.cos(progress * Math.PI);
            const flightAngle = Math.atan2(vy * this.totalDistance - dAlt, vx * this.totalDistance);
            ctx.rotate(flightAngle);

            ctx.fillStyle = '#f5f6fa';
            ctx.beginPath();
            ctx.moveTo(16, 0); ctx.lineTo(6, -3); ctx.lineTo(-12, -3); ctx.lineTo(-12, 3); ctx.lineTo(6, 3);
            ctx.closePath(); ctx.fill();

            ctx.fillStyle = '#2d3436';
            ctx.beginPath(); ctx.moveTo(-6, -3); ctx.lineTo(-12, -7); ctx.lineTo(-12, -3); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-6, 3); ctx.lineTo(-12, 7); ctx.lineTo(-12, 3); ctx.closePath(); ctx.fill();

            const flameSize = 6 + Math.random() * 4;
            // 1단계: 외곽 광원 (Glow)
            ctx.fillStyle = 'rgba(255, 165, 0, 0.6)';
            ctx.beginPath(); ctx.arc(-14, 0, flameSize * 1.5, 0, Math.PI * 2); ctx.fill();
            
            // 2단계: 메인 화염 (Inner)
            ctx.fillStyle = '#ff8c00';
            ctx.beginPath(); ctx.arc(-13, 0, flameSize, 0, Math.PI * 2); ctx.fill();
            
            // 3단계: 화이트 코어 (Core)
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(-12, 0, flameSize * 0.4, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
    }
}