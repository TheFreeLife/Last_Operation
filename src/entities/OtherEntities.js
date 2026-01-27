import { Entity } from './BaseEntity.js';

/**
 * Projectile - 발사체 엔티티
 */
export class Projectile extends Entity {
    constructor(x, y, target, damage, color = '#ffff00', owner = null) {
        super(x, y);
        this.type = 'projectile';
        this.target = target;
        this.damage = damage;
        this.color = color;
        this.speed = 10;
        this.size = 8;
        this.domain = 'air';
        this.explosionRadius = 0;
        this.owner = owner;
        this.ownerId = owner ? owner.ownerId : 0;
    }

    update(deltaTime, engine) {
        if (!this.target || !this.target.active) {
            this.active = false;
            return;
        }

        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist < this.speed) {
            // 명중
            if (this.explosionRadius > 0) {
                // 범위 공격
                const nearby = engine.entityManager?.getNearby(
                    this.target.x,
                    this.target.y,
                    this.explosionRadius
                ) || [];

                for (const ent of nearby) {
                    if (this.owner && this.owner.canDamage(ent, engine)) {
                        ent.takeDamage(this.damage);
                    }
                }

                if (engine.addEffect) {
                    engine.addEffect('explosion', this.target.x, this.target.y, this.color);
                }
            } else {
                // 단일 타격
                this.target.takeDamage(this.damage);

                if (engine.addEffect) {
                    const effectType = this.type === 'tracer' ? 'flak' : 'bullet';
                    engine.addEffect(effectType, this.target.x, this.target.y, this.color);
                }
            }

            this.active = false;
        } else {
            // 이동
            const angle = Math.atan2(dy, dx);
            this.x += Math.cos(angle) * this.speed;
            this.y += Math.sin(angle) * this.speed;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

/**
 * Enemy - 적 유닛 (추후 확장)
 */
export class Enemy extends Entity {
    constructor(x, y) {
        super(x, y);
        this.type = 'enemy';
        this.ownerId = 2;
        this.hp = 100;
        this.maxHp = 100;
        this.size = 30;
        this.speed = 0.8;
        this.color = '#ff0000';
    }

    update(deltaTime, engine) {
        // 적 AI 로직 (추후 구현)
    }

    draw(ctx) {
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
        ctx.fill();

        // HP 바
        const barW = this.size;
        const barH = 4;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(this.x - barW / 2, this.y - this.size / 2 - 8, barW, barH);
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(this.x - barW / 2, this.y - this.size / 2 - 8, barW * (this.hp / this.maxHp), barH);

        ctx.restore();
    }
}
