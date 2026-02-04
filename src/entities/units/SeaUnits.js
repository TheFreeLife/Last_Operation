import { PlayerUnit } from './BaseUnit.js';

export class SmallBoat extends PlayerUnit {
    static editorConfig = { category: 'sea', icon: 'boat', name: '고속정' };
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'small-boat';
        this.name = '고속정';
        this.speed = 2.5; // 해상 유닛은 비교적 빠름
        this.fireRate = 800;
        this.damage = 25;
        this.color = '#3498db';
        this.attackRange = 400;
        this.visionRange = 7;
        this.size = 60;
        this.population = 4; // 승무원 4명
        this.hp = 400;
        this.maxHp = 400;
        this.muzzleOffset = 35;
        this.projectileSpeed = 20;
        this.hitEffectType = 'bullet';

        this.domain = 'sea'; // 해상 도메인
        this.attackTargets = ['ground', 'sea', 'air']; // 만능 공격?

        this.armorType = 'light';
        this.weaponType = 'bullet';

        this.ammoType = 'bullet';
        this.maxAmmo = 200;
        this.ammo = 200;
    }

    attack() {
        this.performAttack();
    }

    update(deltaTime) {
        super.update(deltaTime);

        // 이동 중일 때 물보라 파티클 생성 (빈도 감소: 0.4 -> 0.15)
        if (this.active && this._destination && Math.hypot(this.x - this._destination.x, this.y - this._destination.y) > 10) {
            if (Math.random() < 0.15) {
                // 배 뒤쪽 위치 계산
                const bx = this.x + Math.cos(this.angle + Math.PI) * 20;
                const by = this.y + Math.sin(this.angle + Math.PI) * 20;
                this.engine.addEffect?.('water_wake', bx, by, this.angle);
            }
        }
    }

    draw(ctx) {
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
        ctx.save();
        ctx.scale(1.5, 1.5);

        // --- 선체 (Hull) ---
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.moveTo(-20, -10);
        ctx.lineTo(15, -10);
        ctx.lineTo(25, 0);
        ctx.lineTo(15, 10);
        ctx.lineTo(-20, 10);
        ctx.closePath();
        ctx.fill();

        // --- 갑판 (Deck) ---
        ctx.fillStyle = '#7f8c8d';
        ctx.beginPath();
        ctx.moveTo(-15, -7);
        ctx.lineTo(12, -7);
        ctx.lineTo(18, 0);
        ctx.lineTo(12, 7);
        ctx.lineTo(-15, 7);
        ctx.closePath();
        ctx.fill();

        // --- 조타실 (Bridge) ---
        ctx.fillStyle = '#34495e';
        ctx.fillRect(-8, -5, 12, 10);
        ctx.fillStyle = '#85c1e9'; // 창문
        ctx.fillRect(0, -4, 3, 8);

        // --- 포탑 (Turret) ---
        ctx.save();
        ctx.translate(10, 0);
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(3, -1, 10, 2); // 포신
        ctx.restore();

        ctx.restore();
    }
}
