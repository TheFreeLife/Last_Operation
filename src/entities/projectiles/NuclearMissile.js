import { Entity } from '../BaseEntity.js';
import { CombatLogic } from '../../engine/systems/CombatLogic.js';

export class NuclearMissile extends Entity {
    constructor(x, y, engine) {
        super(x, y);
        this.init(x, y, engine);
    }

    init(x, y, engine) {
        this.x = x;
        this.y = y;
        this.engine = engine;
        this.type = 'nuclear-missile';
        this.ownerId = 0;
        
        this.startX = x;
        this.startY = y;
        this.targetX = x;
        this.targetY = y;
        this.damage = 0;
        this.domain = 'projectile';
        this.isIndirect = true;

        this.speed = 3.5; 
        this.moveAngle = 0;
        this.angle = 0;
        
        this.totalDistance = 1;
        this.peakHeight = 400;
        
        this.active = true;
        this.arrived = false;
        this.progress = 0; 
        
        this.passable = true;
        this.size = 0; 
        
        this.trail = [];
        this.explosionRadius = 350;
        this.lifeTime = 0;
        this.visible = true;
        this.alive = true;
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

        // 더 짙고 붉은 연기 트레일
        if (Math.random() > 0.2) {
            this.trail.push({
                x: this.x,
                y: this.y - altitude,
                size: 8 + Math.random() * 10,
                alpha: 0.9,
                life: 1.5,
                vx: (Math.random() - 0.5) * 0.8,
                vy: (Math.random() - 0.5) * 0.8,
                color: Math.random() > 0.8 ? '#f39c12' : '#7f8c8d'
            });
        }

        this.trail.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.015 * (deltaTime / 16.6);
            p.size += 0.4;
            p.alpha = p.life * 0.7;
        });
        this.trail = this.trail.filter(p => p.life > 0);
    }

    explode() {
        this.arrived = true;

        const isIntercepted = CombatLogic.handleImpact(this.engine, this.targetX, this.targetY, {
            radius: this.explosionRadius,
            damage: this.damage,
            weaponType: 'missile', // 상성 시스템 적용
            isIndirect: true,
            useFalloff: true,
            effectType: 'nuke_explosion'
        });

        if (isIntercepted) {
            this.engine.addEffect?.('system', this.targetX, this.targetY - 100, '#00bcd4', 'NUCLEAR INTERCEPTED BY CEILING');
        } else {
            // 핵 미사일 특유의 추가 폭발 및 메시지 (지면 충돌 시에만)
            for(let i=0; i<6; i++) {
                setTimeout(() => {
                    const angle = (i / 6) * Math.PI * 2;
                    this.engine.addEffect?.('explosion', 
                        this.targetX + Math.cos(angle) * 100, 
                        this.targetY + Math.sin(angle) * 100
                    );
                }, (i + 1) * 120);
            }
            this.engine.addEffect?.('system', this.targetX, this.targetY - 100, '#ffcc00', 'NUCLEAR IMPACT');
        }

        this.finalizeExplosion();
    }

    finalizeExplosion() {
        const checkCleanup = () => {
            if (this.trail.length === 0) {
                this.active = false;
            } else {
                this.trail.forEach(p => {
                    p.life -= 0.04;
                    p.alpha = Math.max(0, p.life * 0.7);
                });
                this.trail = this.trail.filter(p => p.life > 0);
                requestAnimationFrame(checkCleanup);
            }
        };
        checkCleanup();
    }

    draw(ctx) {
        if (!this.active) return;

        ctx.save();
        this.trail.forEach(p => {
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x - this.x, p.y - this.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();

        if (!this.arrived) {
            const altitude = this.peakHeight * 4 * this.progress * (1 - this.progress);

            // 거대한 그림자
            ctx.save();
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = '#000';
            const shadowScale = Math.max(0.7, 1 - (altitude / this.peakHeight) * 0.4);
            const shadowSize = 25 * shadowScale;
            ctx.beginPath();
            ctx.ellipse(0, 0, shadowSize, shadowSize * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            ctx.save();
            ctx.translate(0, -altitude);
            
            const p1 = this.progress;
            const p2 = Math.min(1.0, p1 + 0.01);
            const dx = (this.targetX - this.startX) * (p2 - p1);
            const dy_ground = (this.targetY - this.startY) * (p2 - p1);
            const dy_alt = -(this.peakHeight * 4 * p2 * (1 - p2)) - (-(this.peakHeight * 4 * p1 * (1 - p1)));
            const flightAngle = Math.atan2(dy_ground + dy_alt, dx);
            ctx.rotate(flightAngle);

            // [추가] 좌측 방향 비행 시 상하 뒤집힘 방지
            const isFlyingLeft = dx < 0;
            if (isFlyingLeft) {
                ctx.scale(1, -1);
            }

            // 핵미사일 본체 (더 크고 위협적인 검은색/노란색 배색)
            ctx.fillStyle = '#2d3436';
            ctx.beginPath();
            ctx.moveTo(30, 0); 
            ctx.lineTo(12, -8);
            ctx.lineTo(-25, -8);
            ctx.lineTo(-25, 8);
            ctx.lineTo(12, 8);
            ctx.closePath();
            ctx.fill();

            // 방사능 경고 마크 패턴
            ctx.fillStyle = '#f1c40f';
            ctx.fillRect(0, -8, 8, 16);

            // 거대한 날개
            ctx.fillStyle = '#c0392b';
            ctx.beginPath(); ctx.moveTo(-10, -8); ctx.lineTo(-28, -18); ctx.lineTo(-28, -8); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-10, 8); ctx.lineTo(-28, 18); ctx.lineTo(-28, 8); ctx.closePath(); ctx.fill();

            // 강렬한 엔진 화염
            const flamePulse = 1.2 + Math.random() * 0.6;
            ctx.shadowBlur = 30;
            ctx.shadowColor = '#e67e22';
            ctx.fillStyle = '#d35400';
            ctx.beginPath(); ctx.arc(-28, 0, 12 * flamePulse, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#f1c40f';
            ctx.beginPath(); ctx.arc(-27, 0, 6 * flamePulse, 0, Math.PI * 2); ctx.fill();
            
            ctx.restore();
        }
    }
}
