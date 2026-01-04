import { Entity } from './BaseEntity.js';

/**
 * Resource - 자원 엔티티 (골드, 오일, 철)
 */
export class Resource extends Entity {
    constructor(x, y, type) {
        super(x, y);
        this.type = type;
        this.size = 80;
        this.width = 80;
        this.height = 80;
        this.amount = 1000;
        this.covered = false;
        this.passable = false;

        const colors = {
            'gold': '#ffd700',
            'oil': '#2c1810',
            'iron': '#95a5a6'
        };
        this.color = colors[type] || '#888';
    }

    draw(ctx) {
        if (this.covered) return;

        ctx.save();
        ctx.translate(this.x, this.y);

        const r = this.size / 2;

        if (this.type === 'gold') {
            // 금광 - 황금빛 광석
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
            gradient.addColorStop(0, '#fff9c4');
            gradient.addColorStop(0.5, '#ffd700');
            gradient.addColorStop(1, '#b8860b');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();

            // 광석 디테일
            ctx.strokeStyle = '#b8860b';
            ctx.lineWidth = 2;
            ctx.stroke();
        } else if (this.type === 'oil') {
            // 오일 - 검은색 유전
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
            gradient.addColorStop(0, '#3e2723');
            gradient.addColorStop(0.5, '#2c1810');
            gradient.addColorStop(1, '#1a0d08');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();

            // 유출 효과
            ctx.strokeStyle = '#1a0d08';
            ctx.lineWidth = 3;
            ctx.stroke();
        } else if (this.type === 'iron') {
            // 철광석 - 회색 금속
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
            gradient.addColorStop(0, '#bdc3c7');
            gradient.addColorStop(0.5, '#95a5a6');
            gradient.addColorStop(1, '#7f8c8d');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();

            // 금속 광택
            ctx.strokeStyle = '#7f8c8d';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        ctx.restore();
    }
}

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
