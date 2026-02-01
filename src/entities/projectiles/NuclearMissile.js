import { Entity } from '../BaseEntity.js';

export class NuclearMissile extends Entity {
    constructor(startX, startY, targetX, targetY, damage, engine, source = null) {
        super(startX, startY);
        this.type = 'nuclear-missile';
        this.source = source;
        this.ownerId = source ? source.ownerId : 0;
        
        this.startX = startX;
        this.startY = startY;
        this.targetX = targetX;
        this.targetY = targetY;
        this.damage = damage;
        this.engine = engine;
        this.domain = 'projectile';

        this.speed = 3.5; // ICBM은 약간 더 무겁고 웅장하게 이동
        this.moveAngle = Math.atan2(targetY - startY, targetX - startX);
        this.angle = 0;
        
        this.totalDistance = Math.hypot(targetX - startX, targetY - startY);
        this.peakHeight = Math.max(400, this.totalDistance * 0.7); // 더 높게 비상
        
        this.active = true;
        this.arrived = false;
        this.progress = 0; 
        
        this.passable = true;
        this.size = 0; 
        
        this.trail = [];
        this.explosionRadius = 350; // 압도적인 폭발 범위 (기존 160)
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
        if (this.engine.addEffect) {
            // 거대한 중앙 폭발
            this.engine.addEffect('explosion', this.targetX, this.targetY);
            
            // 주변 연쇄 대형 폭발 (버섯구름 형상화)
            for(let i=0; i<12; i++) {
                setTimeout(() => {
                    const angle = (i / 12) * Math.PI * 2;
                    const dist = Math.random() * 150;
                    this.engine.addEffect('explosion', 
                        this.targetX + Math.cos(angle) * dist, 
                        this.targetY + Math.sin(angle) * dist
                    );
                }, i * 40);
            }

            // 섬광 효과 (시스템 메시지로 대체 표현)
            this.engine.addEffect?.('system', this.targetX, this.targetY - 100, '#ffcc00', 'NUCLEAR IMPACT');
        }

        // 광범위 피해 적용
        const targets = [...this.engine.entities.enemies, ...this.engine.entities.neutral, ...this.engine.entities.units];
        targets.forEach(target => {
            if (!target || !target.active || target.hp === undefined) return;
            const dist = Math.hypot(target.x - this.targetX, target.y - this.targetY);
            if (dist <= this.explosionRadius) {
                // 핵은 거리에 따른 위력 감소가 적음 (더 치명적)
                const damageMult = 1 - (dist / this.explosionRadius) * 0.3;
                target.takeDamage(this.damage * damageMult);
            }
        });

        // 지형 파괴 (벽)
        const tileMap = this.engine.tileMap;
        if (tileMap) {
            const gridRadius = Math.ceil(this.explosionRadius / tileMap.tileSize);
            const center = tileMap.worldToGrid(this.targetX, this.targetY);
            
            for (let dy = -gridRadius; dy <= gridRadius; dy++) {
                for (let dx = -gridRadius; dx <= gridRadius; dx++) {
                    const gx = center.x + dx;
                    const gy = center.y + dy;
                    if (gx < 0 || gx >= tileMap.cols || gy < 0 || gy >= tileMap.rows) continue;
                    
                    const worldPos = tileMap.gridToWorld(gx, gy);
                    const dist = Math.hypot(worldPos.x - this.targetX, worldPos.y - this.targetY);
                    if (dist <= this.explosionRadius) {
                        tileMap.damageTile(gx, gy, this.damage);
                    }
                }
            }
        }

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
