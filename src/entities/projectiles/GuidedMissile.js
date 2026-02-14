import { Entity } from '../BaseEntity.js';
import { CombatLogic } from '../../engine/systems/CombatLogic.js';

export class GuidedMissile extends Entity {
    constructor(x, y, engine) {
        super(x, y);
        this.init(x, y, engine);
    }

    init(x, y, engine) {
        this.x = x;
        this.y = y;
        this.engine = engine;
        this.type = 'missile'; 
        this.ownerId = 0;
        
        this.target = null;
        this.damage = 0;
        this.domain = 'projectile';
        this.isIndirect = false;

        this.speed = 6; 
        this.turnSpeed = 0.12; 
        this.flightAngle = 0; // 실제 비행 각도
        this.angle = 0;       // 렌더러 자동 회전 방지용 (0 고정)
        
        this.active = true;
        this.arrived = false;
        this.lifeTime = 0;
        this.maxLifeTime = 5000; 
        
        this.trail = [];
        this.explosionRadius = 60;
        this.visible = true;
        this.alive = true;
    }

    update(deltaTime) {
        if (!this.active || this.arrived) return;

        this.lifeTime += deltaTime;
        if (this.lifeTime > this.maxLifeTime) {
            this.explode();
            return;
        }

        if (this.target && this.target.active && this.target.hp > 0) {
            const targetAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            const angleDiff = Math.atan2(Math.sin(targetAngle - this.flightAngle), Math.cos(targetAngle - this.flightAngle));
            this.flightAngle += angleDiff * this.turnSpeed;
        } else {
            if (this.lifeTime > 2000) {
                this.explode();
                return;
            }
        }

        this.x += Math.cos(this.flightAngle) * this.speed;
        this.y += Math.sin(this.flightAngle) * this.speed;

        if (this.target) {
            const dist = Math.hypot(this.target.x - this.x, this.target.y - this.y);
            if (dist < 20) {
                this.explode();
                return;
            }
        }

        if (Math.random() > 0.4) {
            this.trail.push({
                x: this.x,
                y: this.y,
                size: 4 + Math.random() * 4,
                alpha: 0.6,
                life: 1.0
            });
        }

        this.trail.forEach(p => {
            p.life -= 0.03 * (deltaTime / 16.6);
            p.size += 0.2;
            p.alpha = p.life * 0.5;
        });
        this.trail = this.trail.filter(p => p.life > 0);
    }

    explode() {
        if (this.arrived) return;
        this.arrived = true;
        
        CombatLogic.handleImpact(this.engine, this.x, this.y, {
            radius: this.explosionRadius,
            damage: this.damage,
            weaponType: 'missile',
            canHitAir: true, // 대공 미사일이므로 공중 타격 허용
            effectType: 'impact_missile'
        });

        this.finalizeExplosion();
    }

    finalizeExplosion() {
        const checkCleanup = () => {
            if (this.trail.length === 0) {
                this.active = false;
            } else {
                this.trail.forEach(p => {
                    p.life -= 0.1;
                    p.alpha = Math.max(0, p.life * 0.5);
                });
                this.trail = this.trail.filter(p => p.life > 0);
                requestAnimationFrame(checkCleanup);
            }
        };
        checkCleanup();
    }

    draw(ctx) {
        if (!this.active) return;

        // 1. 트레일 (월드 좌표 기준이므로 현재 위치 오프셋만 적용)
        ctx.save();
        this.trail.forEach(p => {
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = '#bdc3c7';
            ctx.beginPath();
            ctx.arc(p.x - this.x, p.y - this.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();

        // 2. 미사일 본체
        if (!this.arrived) {
            ctx.save();
            ctx.rotate(this.flightAngle);
            
            // [제거] 상하 대칭 미사일이므로 불필요한 scale 보정 로직 삭제 (방향 오류 방지)
            
            // 몸체
            ctx.fillStyle = '#fff';
            ctx.fillRect(-10, -2, 20, 4);
            
            // 탄두
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            ctx.moveTo(10, -2); ctx.lineTo(15, 0); ctx.lineTo(10, 2);
            ctx.fill();

            // 엔진 화염
            const pulse = 1 + Math.random() * 0.5;
            ctx.fillStyle = '#ff8c00';
            ctx.beginPath();
            ctx.arc(-12, 0, 4 * pulse, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
        }
    }
}
