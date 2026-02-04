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
        this.projectileSpeed = 35; // 고속정 탄속 상향 (20 -> 35)
        this.hitEffectType = 'bullet';

        this.domain = 'sea'; // 해상 도메인
        this.attackTargets = ['ground', 'sea', 'air']; // 만능 공격?

        this.armorType = 'light';
        this.weaponType = 'bullet';

        this.ammoType = 'bullet';
        this.maxAmmo = 200;
        this.ammo = 200;

        this.turretAngle = this.angle; // 독립적인 포탑 각도
    }

    init(x, y, engine) {
        super.init(x, y, engine);
        this.turretAngle = this.angle;
    }

    getCacheKey() {
        // 포탑이 차체와 정렬되어 있을 때만 비트맵 캐싱 사용
        if (Math.abs(this.turretAngle - this.angle) > 0.05) return null;
        return this.type;
    }

    update(deltaTime) {
        // 1. 이전 상태 저장
        const prevHullAngle = this.angle;
        const oldTarget = this.target;

        // 2. 부모 클래스(BaseUnit) 로직 수행
        super.update(deltaTime);

        // 3. 이동 중일 때 물보라 파티클 생성
        if (this.active && this._destination && Math.hypot(this.x - this._destination.x, this.y - this._destination.y) > 10) {
            if (Math.random() < 0.15) {
                const bx = this.x + Math.cos(this.angle + Math.PI) * 20;
                const by = this.y + Math.sin(this.angle + Math.PI) * 20;
                this.engine.addEffect?.('water_wake', bx, by, this.angle);
            }
        }

        // 4. [상태 기반 타겟 관리]
        if (this.command === 'move') {
            this.target = null;
            this.manualTarget = null;
        } 
        else if (!this.target && oldTarget && oldTarget.active && oldTarget.hp > 0) {
            const dist = Math.hypot(oldTarget.x - this.x, oldTarget.y - this.y);
            if (dist <= this.attackRange * 1.1) {
                this.target = oldTarget;
            }
        }

        // 5. [하단부 제어] 이동 중에만 회전
        if (this._destination) {
            const targetMoveAngle = this.getMovementAngle();
            const angleDiff = Math.atan2(Math.sin(targetMoveAngle - prevHullAngle), Math.cos(targetMoveAngle - prevHullAngle));
            this.angle = prevHullAngle + angleDiff * 0.1; // 배는 차량보다 약간 더 느리게 회전
        } else {
            this.angle = prevHullAngle;
        }

        // 6. [상단부 제어] 포탑 회전
        if (this.target) {
            const targetAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            let diff = targetAngle - this.turretAngle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            
            this.turretAngle += diff * 0.1; // 포탑 회전 속도
            this.attack();
        } else {
            // 타겟이 없으면 선체 정면 방향으로 서서히 정렬
            let diff = this.angle - this.turretAngle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.turretAngle += diff * 0.05;
        }
    }

    getMovementAngle() {
        if (!this._destination) return this.angle;
        const ff = (this.ownerId === 2) ? this.engine.enemyFlowField : this.engine.flowField;
        const vector = ff.getFlowVector(this.x, this.y, this._destination.x, this._destination.y, this.sizeClass, this.domain);
        if (vector.x !== 0 || vector.y !== 0) return Math.atan2(vector.y, vector.x);
        return Math.atan2(this._destination.y - this.y, this._destination.x - this.x);
    }

    attack() {
        if (!this.target) return;
        const targetAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
        let diff = targetAngle - this.turretAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        if (Math.abs(diff) < 0.1) {
            this.performAttack();
        }
    }

    performAttack() {
        const now = Date.now();
        if (now - this.lastFireTime < this.fireRate || !this.target) return;

        const dist = Math.hypot(this.target.x - this.x, this.target.y - this.y);
        if (dist > this.attackRange) return;

        if (this.maxAmmo > 0 && this.ammo < this.ammoConsumption) return;
        if (this.maxAmmo > 0) this.ammo -= this.ammoConsumption;

        if (this.engine.addEffect) {
            const mx = this.x + Math.cos(this.turretAngle) * this.muzzleOffset;
            const my = this.y + Math.sin(this.turretAngle) * this.muzzleOffset;
            this.engine.addEffect('muzzle', mx, my, '#ff8c00');
        }

        this.executeProjectileAttack();
        this.lastFireTime = now;
    }

    executeProjectileAttack() {
        const spawnX = this.x + Math.cos(this.turretAngle) * this.muzzleOffset;
        const spawnY = this.y + Math.sin(this.turretAngle) * this.muzzleOffset;

        const options = {
            speed: this.projectileSpeed,
            ownerId: this.ownerId,
            isIndirect: false,
            weaponType: this.weaponType
        };

        this.engine.entityManager.spawnProjectileECS(spawnX, spawnY, this.target, this.damage, options);
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

        // --- 포탑 (Turret) - turretAngle 적용 ---
        ctx.save();
        // 선체의 로컬 좌표계에서 turretAngle(월드) - angle(선체 월드) 만큼 회전
        ctx.translate(10, 0);
        ctx.rotate(this.turretAngle - this.angle);
        
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
