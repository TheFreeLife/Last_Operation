import { Entity } from '../BaseEntity.js';

export class Missile extends Entity {
    constructor(startX, startY, targetX, targetY, damage, engine, source = null) {
        super(startX, startY);
        this.type = 'missile';
        this.source = source;
        this.ownerId = source ? source.ownerId : 0;
        
        this.startX = startX;
        this.startY = startY;
        this.targetX = targetX;
        this.targetY = targetY;
        this.damage = damage;
        this.engine = engine;

        // 물리 설정
        this.speed = 8; 
        // RenderSystem의 자동 회전을 피하기 위해 moveAngle로 이름을 바꿈
        this.moveAngle = Math.atan2(targetY - startY, targetX - startX);
        this.angle = 0; // Renderer가 회전시키지 못하게 0으로 고정
        
        this.totalDistance = Math.hypot(targetX - startX, targetY - startY);
        this.peakHeight = Math.max(250, this.totalDistance * 0.5); 
        
        this.active = true;
        this.arrived = false;
        this.progress = 0; 
        
        this.trail = [];
        this.explosionRadius = 160;
        this.lifeTime = 0;
    }

    update(deltaTime) {
        if (!this.active || this.arrived) return;

        const frameStep = (this.speed * (deltaTime / 16.6)) / this.totalDistance;
        this.progress += frameStep;

        if (this.progress >= 1.0) {
            this.progress = 1.0;
            this.x = this.targetX;
            this.y = this.targetY;
            this.explode();
            return;
        }

        this.x = this.startX + (this.targetX - this.startX) * this.progress;
        this.y = this.startY + (this.targetY - this.startY) * this.progress;

        const altitude = this.peakHeight * 4 * this.progress * (1 - this.progress);

        if (Math.random() > 0.3) {
            this.trail.push({
                x: this.x,
                y: this.y - altitude,
                size: 5 + Math.random() * 5,
                alpha: 0.8,
                life: 1.0,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5
            });
        }

        this.trail.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.02 * (deltaTime / 16.6);
            p.size += 0.3;
            p.alpha = p.life * 0.6;
        });
        this.trail = this.trail.filter(p => p.life > 0);
    }

    explode() {
        this.arrived = true;
        if (this.engine.addEffect) {
            this.engine.addEffect('explosion', this.targetX, this.targetY);
            for(let i=0; i<5; i++) {
                setTimeout(() => {
                    this.engine.addEffect('explosion', 
                        this.targetX + (Math.random()-0.5)*80, 
                        this.targetY + (Math.random()-0.5)*80
                    );
                }, i * 60);
            }
        }

        const targets = [...this.engine.entities.enemies, ...this.engine.entities.neutral, ...this.engine.entities.units];
        targets.forEach(target => {
            if (!target || !target.active || target.hp === undefined || target.domain === 'air') return;
            const dist = Math.hypot(target.x - this.targetX, target.y - this.targetY);
            if (dist <= this.explosionRadius) {
                const damageMult = 1 - (dist / this.explosionRadius) * 0.5;
                target.takeDamage(this.damage * damageMult);
            }
        });

        const checkCleanup = () => {
            if (this.trail.length === 0) {
                this.active = false;
            } else {
                this.trail.forEach(p => {
                    p.life -= 0.05;
                    p.alpha = Math.max(0, p.life * 0.6);
                });
                this.trail = this.trail.filter(p => p.life > 0);
                requestAnimationFrame(checkCleanup);
            }
        };
        checkCleanup();
    }

    draw(ctx) {
        if (!this.active) return;

        // 1. 연기 트레일 (지면 기준 상대 좌표)
        ctx.save();
        this.trail.forEach(p => {
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = '#ecf0f1';
            ctx.beginPath();
            ctx.arc(p.x - this.x, p.y - this.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();

        if (!this.arrived) {
            const altitude = this.peakHeight * 4 * this.progress * (1 - this.progress);

            // 2. 그림자
            ctx.save();
            ctx.globalAlpha = 0.25;
            ctx.fillStyle = '#000';
            const shadowScale = Math.max(0.5, 1 - (altitude / this.peakHeight) * 0.5);
            const shadowSize = 12 * shadowScale;
            ctx.beginPath();
            ctx.ellipse(0, 0, shadowSize, shadowSize * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // 3. 미사일 본체 (상공)
            ctx.save();
            ctx.translate(0, -altitude);
            
            // [해결] 화면 좌표계 기반의 절대 각도 계산
            const p1 = this.progress;
            const p2 = Math.min(1.0, p1 + 0.01);
            
            // p1, p2 지점의 화면 좌표 차이 계산
            const dx = (this.targetX - this.startX) * (p2 - p1);
            const dy_ground = (this.targetY - this.startY) * (p2 - p1);
            const dy_alt = -(this.peakHeight * 4 * p2 * (1 - p2)) - (-(this.peakHeight * 4 * p1 * (1 - p1)));
            
            const flightAngle = Math.atan2(dy_ground + dy_alt, dx);
            ctx.rotate(flightAngle);

            // 몸체 (탄두가 뾰족한 로켓 형태)
            const bodyGrd = ctx.createLinearGradient(0, -5, 0, 5);
            bodyGrd.addColorStop(0, '#ffffff');
            bodyGrd.addColorStop(0.5, '#f5f6fa');
            bodyGrd.addColorStop(1, '#dcdde1');
            ctx.fillStyle = bodyGrd;
            
            ctx.beginPath();
            ctx.moveTo(20, 0); // 탄두
            ctx.lineTo(8, -5);
            ctx.lineTo(-15, -5);
            ctx.lineTo(-15, 5);
            ctx.lineTo(8, 5);
            ctx.closePath();
            ctx.fill();

            // 날개
            ctx.fillStyle = '#c0392b';
            ctx.beginPath(); ctx.moveTo(-5, -5); ctx.lineTo(-18, -12); ctx.lineTo(-18, -5); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-5, 5); ctx.lineTo(-18, 12); ctx.lineTo(-18, 5); ctx.closePath(); ctx.fill();

            // 엔진 화염
            const flamePulse = 1 + Math.random() * 0.5;
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#f39c12';
            ctx.fillStyle = '#ff8c00';
            ctx.beginPath(); ctx.arc(-18, 0, 8 * flamePulse, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(-17, 0, 4 * flamePulse, 0, Math.PI * 2); ctx.fill();
            
            ctx.restore();
        }
    }
}
