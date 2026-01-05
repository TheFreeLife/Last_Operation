import { PlayerUnit } from './BaseUnit.js';
import { Missile } from '../projectiles/Missile.js';

export class Tank extends PlayerUnit {
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'tank';
        this.name = '전차';
        this.speed = 1.8; // 1.2 -> 1.8 (1.5배 상향)
        this.fireRate = 1800;
        this.damage = 200;
        this.color = '#39ff14';
        this.attackRange = 360;
        this.visionRange = 6; // 전차 시야: 보병보다 넓음
        this.explosionRadius = 40; // 폭발 반경 추가
        this.cargoSize = 10; // 전차 부피 10
        this.hp = 1000;
        this.maxHp = 1000;
        this.attackType = 'hitscan';
        this.hitEffectType = 'explosion';
        this.popCost = 3;

        this.ammoType = 'shell';
        this.maxAmmo = 20;
        this.ammo = 20;
    }

    attack() {
        this.performAttack();
    }

    draw(ctx) {
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
        ctx.save();
        ctx.scale(2, 2);

        // 1. 하부 및 궤도
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-14, -13, 28, 26);
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(-14, -13, 28, 4);
        ctx.fillRect(-14, 9, 28, 4);

        // 2. 메인 차체
        ctx.fillStyle = '#4b5320';
        ctx.beginPath();
        ctx.moveTo(-14, -9); ctx.lineTo(10, -9);
        ctx.lineTo(16, -6); ctx.lineTo(16, 6);
        ctx.lineTo(10, 9); ctx.lineTo(-14, 9);
        ctx.closePath();
        ctx.fill();

        // 3. 포탑
        ctx.save();
        ctx.translate(-3, 0);
        ctx.fillStyle = '#556644';
        ctx.beginPath();
        ctx.moveTo(-8, -8); ctx.lineTo(5, -8); ctx.lineTo(10, -4);
        ctx.lineTo(10, 4); ctx.lineTo(5, 8); ctx.lineTo(-8, 8);
        ctx.closePath();
        ctx.fill();

        // 4. 주포
        ctx.fillStyle = '#1e272e';
        ctx.fillRect(10, -1.2, 30, 2.4);
        ctx.restore();

        ctx.restore();
    }
}

export class MissileLauncher extends PlayerUnit {
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'missile-launcher';
        this.name = '이동식 미사일 발사대';
        this.speed = 1.4;
        this.baseSpeed = 1.4;
        this.fireRate = 2500;
        this.damage = 1000; // 350 -> 1000 (대폭 상향)
        this.attackRange = 1800;
        this.visionRange = 8;
        this.recoil = 0;
        this.canBypassObstacles = false;
        this.cargoSize = 10;

        this.isSieged = false;
        this.isTransitioning = false;
        this.transitionTimer = 0;
        this.maxTransitionTime = 60;
        this.raiseAngle = 0;

        this.isFiring = false;
        this.fireDelayTimer = 0;
        this.maxFireDelay = 45;
        this.pendingFirePos = { x: 0, y: 0 };
        this.attackType = 'projectile';
        this.attackTargets = ['ground', 'sea'];
        this.popCost = 3;

        this.ammoType = 'missile';
        this.maxAmmo = 6;
        this.ammo = 6;
    }

    getSkillConfig(cmd) {
        const skills = {
            'siege': { type: 'state', handler: this.toggleSiege },
            'manual_fire': { type: 'targeted', handler: this.fireAt }
        };
        return skills[cmd];
    }

    toggleSiege() {
        if (this.isTransitioning || this.isFiring) return;
        this.isTransitioning = true;
        this.transitionTimer = 0;
        this.destination = null;
        this.speed = 0;
        this.engine.addEffect?.('system', this.x, this.y, '#fff', this.isSieged ? '시즈 해제 중...' : '시즈 모드 설정 중...');
    }

    update(deltaTime) {
        super.update(deltaTime);

        if (this.isTransitioning) {
            this.transitionTimer++;
            if (this.isSieged) {
                this.raiseAngle = 1 - (this.transitionTimer / this.maxTransitionTime);
            } else {
                this.raiseAngle = this.transitionTimer / this.maxTransitionTime;
            }

            if (this.transitionTimer >= this.maxTransitionTime) {
                this.isTransitioning = false;
                this.isSieged = !this.isSieged;
                this.raiseAngle = this.isSieged ? 1 : 0;
                this.speed = this.isSieged ? 0 : this.baseSpeed;
                if (this.isSieged) this.destination = null;
            }
        }

        if (this.isFiring) {
            this.fireDelayTimer++;
            const targetAngle = Math.atan2(this.pendingFirePos.y - this.y, this.pendingFirePos.x - this.x);
            let angleDiff = targetAngle - this.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            this.angle += angleDiff * 0.15;

            if (this.fireDelayTimer >= this.maxFireDelay) {
                this.executeFire();
                this.isFiring = false;
                this.fireDelayTimer = 0;
            }
        }
    }

    attack() {
        if (this.isSieged && !this.isTransitioning && !this.isFiring) {
            this.performAttack();
        }
    }

    fireAt(targetX, targetY) {
        if (!this.isSieged || this.isTransitioning || this.isFiring) return;

        // 탄약 체크 추가
        if (this.ammo <= 0) {
            if (this.engine.addEffect) {
                this.engine.addEffect('system', this.x, this.y - 40, '#ff3131', '미사일 고갈!');
            }
            return;
        }

        const dist = Math.hypot(targetX - this.x, targetY - this.y);
        if (dist > this.attackRange) return;

        const now = Date.now();
        if (now - this.lastFireTime > this.fireRate) {
            this.isFiring = true;
            this.fireDelayTimer = 0;
            this.pendingFirePos = { x: targetX, y: targetY };
        }
    }

    executeFire() {
        if (this.ammo <= 0) return; // 안전장치

        const { x: targetX, y: targetY } = this.pendingFirePos;
        const launchDist = 35 * 2;
        const tiltDir = Math.cos(this.angle) >= 0 ? -1 : 1;
        const visualAngle = this.angle + (tiltDir * (Math.PI / 10) * this.raiseAngle);

        const spawnX = this.x + Math.cos(visualAngle) * launchDist;
        const spawnY = this.y + Math.sin(visualAngle) * launchDist;

        const missile = new Missile(spawnX, spawnY, targetX, targetY, this.damage, this.engine, this);
        missile.peakHeight = Math.max(missile.peakHeight, 150);

        this.engine.entities.projectiles.push(missile);

        // 탄약 1발 소모
        this.ammo--;

        this.lastFireTime = Date.now();
        this.recoil = 15;
    }

    draw(ctx) {
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
        ctx.save();
        ctx.scale(2, 2);

        // 차체 베이스
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(-22, -10, 44, 20);

        // 운전석
        ctx.fillStyle = '#34495e';
        ctx.fillRect(12, -10, 10, 20);

        // 발사관 (캐니스터)
        ctx.save();
        ctx.translate(-15, 0);
        ctx.fillStyle = '#4b5320';
        ctx.fillRect(0, -7, 32, 14);
        ctx.restore();

        ctx.restore();
    }
}

export class Artillery extends PlayerUnit {
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'artillery';
        this.name = '자주포';
        this.speed = 0.9;
        this.fireRate = 4000; // 매우 느린 연사
        this.damage = 100;    // 강력한 한 방
        this.attackRange = 600;
        this.explosionRadius = 60;
        this.cargoSize = 5; // 자주포 부피 5
        this.attackType = 'projectile';
        this.popCost = 4;

        this.ammoType = 'shell';
        this.maxAmmo = 20;
        this.ammo = 20;
    }

    attack() {
        this.performAttack();
    }

    draw(ctx) {
        if (this.isUnderConstruction) { this.drawConstruction(ctx); return; }
        ctx.save();
        ctx.scale(2, 2);

        // 1. 하부 궤도 및 차체
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-16, -11, 32, 22);
        ctx.fillStyle = '#4b5320';
        ctx.fillRect(-15, -10, 30, 20);

        // 2. 포탑
        ctx.save();
        ctx.translate(-2, 0);
        ctx.fillStyle = '#556644';
        ctx.fillRect(-10, -9, 22, 18);

        // 3. 주포
        ctx.fillStyle = '#4b5320';
        ctx.fillRect(12, -2, 28, 4);
        ctx.restore();

        ctx.restore();
    }

    drawHealthBar(ctx) {
        const barW = 30;
        const barY = this.y - 30;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - barW / 2, barY, barW, 4);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW / 2, barY, (this.hp / this.maxHp) * barW, 4);
    }
}

export class AntiAirVehicle extends PlayerUnit {
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'anti-air';
        this.name = '자주 대공포';
        this.speed = 1.3;
        this.fireRate = 150; // 기관포 느낌을 위해 매우 빠른 연사 (800 -> 150)
        this.damage = 8;    // 연사력이 높아졌으므로 발당 데미지 하향
        this.attackRange = 600;
        this.visionRange = 10;
        this.attackTargets = ['air']; // 공중 유닛만 공격 가능
        this.lastBarrelSide = 1; // 사격 포구 번갈아 가기 위한 상태
        this.cargoSize = 5; // 대공포 적재 용량 5
        this.attackType = 'hitscan';
        this.hitEffectType = 'flak';
        this.popCost = 3;

        this.ammoType = 'bullet';
        this.maxAmmo = 200;
        this.ammo = 200;
        this.ammoConsumption = 2;
    }

    attack() {
        this.performAttack();
    }

    draw(ctx) {
        if (this.isUnderConstruction) { this.drawConstruction(ctx); return; }
        ctx.save();
        ctx.scale(2, 2);

        // 1. 하부 궤도 및 차체
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-14, -14, 30, 28);
        ctx.fillStyle = '#4b5320';
        ctx.fillRect(-12, -9, 24, 18);

        // 2. 포탑
        ctx.fillStyle = '#556644';
        ctx.fillRect(-6, -7, 10, 14);

        // 3. 쌍열 기관포
        ctx.fillStyle = '#1e272e';
        ctx.fillRect(2, -10, 20, 2); // 좌측 포신
        ctx.fillRect(2, 8, 20, 2);  // 우측 포신

        ctx.restore();
    }

    drawHealthBar(ctx) {
        const barW = 30;
        const barY = this.y - 30;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - barW / 2, barY, barW, 4);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW / 2, barY, (this.hp / this.maxHp) * barW, 4);
    }
}
