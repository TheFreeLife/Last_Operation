import { PlayerUnit } from './BaseUnit.js';
import { Missile } from '../projectiles/Missile.js';
import { NuclearMissile } from '../projectiles/NuclearMissile.js';

export class Tank extends PlayerUnit {
    static editorConfig = { category: 'vehicle', icon: 'tank', name: '전차' };
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'tank';
        this.name = '전차';
        this.speed = 1.8;
        this.fireRate = 1800;
        this.damage = 180; // 데미지 소폭 조정 (광역딜 밸런스)
        this.color = '#39ff14';
        this.attackRange = 360;
        this.visionRange = 6;
        this.explosionRadius = 70; // 범위 피해 반경 확대 (40 -> 70)
        this.size = 80;
        this.cargoSize = 10;
        this.population = 4; // 전차장, 포수, 탄약수, 조종수
        this.hp = 1000;
        this.maxHp = 1000;
        this.muzzleOffset = 60;
        this.projectileSpeed = 18; // 탄속 상향 (16 -> 18)
        this.hitEffectType = 'explosion';

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

        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-14, -13, 28, 26);
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(-14, -13, 28, 4);
        ctx.fillRect(-14, 9, 28, 4);

        ctx.fillStyle = '#4b5320';
        ctx.beginPath();
        ctx.moveTo(-14, -9); ctx.lineTo(10, -9);
        ctx.lineTo(16, -6); ctx.lineTo(16, 6);
        ctx.lineTo(10, 9); ctx.lineTo(-14, 9);
        ctx.closePath();
        ctx.fill();

        ctx.save();
        ctx.translate(-3, 0);
        ctx.fillStyle = '#556644';
        ctx.beginPath();
        ctx.moveTo(-8, -8); ctx.lineTo(5, -8); ctx.lineTo(10, -4);
        ctx.lineTo(10, 4); ctx.lineTo(5, 8); ctx.lineTo(-8, 8);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#1e272e';
        ctx.fillRect(10, -1.2, 30, 2.4);
        ctx.restore();

        ctx.restore();
    }
}

export class MissileLauncher extends PlayerUnit {
    static editorConfig = { category: 'vehicle', icon: 'missile-launcher', name: '미사일 발사대' };
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'missile-launcher';
        this.name = '이동식 미사일 발사대';
        this.speed = 1.4;
        this.baseSpeed = 1.4;
        this.fireRate = 2500;
        this.damage = 1000;
        this.attackRange = 1800;
        this.visionRange = 8;
        this.recoil = 0;
        this.size = 80;
        this.cargoSize = 10;
        this.population = 3; // 운전수, 사격통제수 2명
        this.isSieged = false;
        this.isTransitioning = false;
        this.transitionTimer = 0;
        this.maxTransitionTime = 60;
        this.raiseAngle = 0;
        this.turretAngle = 0; // 차체 기준 상부 회전 각도

        this.isFiring = false;
        this.fireDelayTimer = 0;
        this.maxFireDelay = 90; // 정렬 후 대기 시간 (약 1.5초)
        this.pendingFirePos = { x: 0, y: 0 };
        this.attackTargets = ['ground', 'sea'];

        this.ammoType = 'missile';
        this.maxAmmo = 6;
        this.ammo = 6;
    }

    init(x, y, engine) {
        super.init(x, y, engine);
        this.isSieged = false;
        this.isTransitioning = false;
        this.transitionTimer = 0;
        this.raiseAngle = 0;
        this.turretAngle = 0;
        this.isFiring = false;
        this.fireDelayTimer = 0;
        this.speed = this.baseSpeed || 1.4;
    }

    getSkillConfig(cmd) {
        const skills = {
            'siege': { type: 'state', handler: this.toggleSiege },
            'manual_fire': { type: 'targeted', handler: this.fireAt }
        };
        return skills[cmd];
    }

    getCacheKey() {
        if (this.isTransitioning || this.isSieged || this.turretAngle !== 0) return null;
        return `${this.type}-idle`;
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
        const prevAngle = this.angle;
        super.update(deltaTime);

        if (this.isSieged) {
            this.angle = prevAngle;
        }

        if (this.isSieged && !this.isTransitioning) {
            if (this.isFiring) {
                const targetAngle = Math.atan2(this.pendingFirePos.y - this.y, this.pendingFirePos.x - this.x);
                let relativeTargetAngle = targetAngle - this.angle;
                let diff = relativeTargetAngle - this.turretAngle;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                this.turretAngle += diff * 0.0125;
                if (Math.abs(diff) < 0.05) {
                    this.fireDelayTimer++;
                }
            }
        } else if (!this.isSieged) {
            this.turretAngle *= 0.9;
            if (Math.abs(this.turretAngle) < 0.01) this.turretAngle = 0;
        }

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
            }
        }

        if (this.isFiring) {
            // 발사 15프레임(약 0.25초) 전에 사운드를 미리 재생하여 씽크를 맞춤
            if (this.fireDelayTimer === this.maxFireDelay - 15) {
                this.engine.audioSystem.play('missile_flight', { volume: 0.2 });
            }

            if (this.fireDelayTimer >= this.maxFireDelay) {
                this.executeFire({ skipSound: true });
                this.isFiring = false;
                this.fireDelayTimer = 0;
            }
        }
    }

    attack() {
        if (this.isSieged && !this.isTransitioning && !this.isFiring) {
            const now = Date.now();
            if (now - this.lastFireTime > this.fireRate && this.target) {
                this.pendingFirePos = { x: this.target.x, y: this.target.y };
                this.executeFire();
            }
        }
    }

    fireAt(targetX, targetY) {
        if (!this.isSieged || this.isTransitioning || this.isFiring) return;
        if (this.ammo <= 0) {
            this.engine.addEffect?.('system', this.x, this.y - 40, '#ff3131', '미사일 고갈!');
            return;
        }
        const dist = Math.hypot(targetX - this.x, targetY - this.y);
        if (dist > this.attackRange) return;

        const now = Date.now();
        if (now - this.lastFireTime > this.fireRate) {
            this.isFiring = true;
            this.fireDelayTimer = 0;
            this.pendingFirePos = { x: targetX, y: targetY };
            this.engine.addEffect?.('system', this.x, this.y - 50, '#ff3131', '미사일 포탑 정렬 중...');
        }
    }

    executeFire(options = {}) {
        if (this.ammo <= 0) return;
        const { x: targetX, y: targetY } = this.pendingFirePos;
        const totalAngle = this.angle + this.turretAngle;
        const launchDist = 30;
        const spawnX = this.x + Math.cos(totalAngle) * launchDist;
        const spawnY = this.y + Math.sin(totalAngle) * launchDist;

        if (!options.skipSound) {
            this.engine.audioSystem.play('missile_flight', { volume: 0.2 });
        }
        const missile = new Missile(spawnX, spawnY, targetX, targetY, this.damage, this.engine, this);
        this.engine.entities.projectiles.push(missile);

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
        if (this.raiseAngle > 0) {
            const outDist = this.raiseAngle * 8;
            ctx.fillStyle = '#2d3436';
            const outriggers = [
                { x: -15, y: -9, dx: -1, dy: -1 }, { x: 15, y: -9, dx: 1, dy: -1 },  
                { x: -15, y: 9, dx: -1, dy: 1 }, { x: 15, y: 9, dx: 1, dy: 1 }    
            ];
            outriggers.forEach(o => {
                ctx.save();
                ctx.translate(o.x + o.dx * outDist, o.y + o.dy * outDist);
                ctx.fillRect(-2, -2, 4, 4);
                ctx.strokeStyle = '#7f8c8d';
                ctx.lineWidth = 0.5;
                ctx.beginPath(); ctx.moveTo(-o.dx * outDist, -o.dy * outDist); ctx.lineTo(0, 0); ctx.stroke();
                ctx.restore();
            });
        }
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(-22, -10, 44, 20);
        ctx.fillStyle = '#34495e';
        ctx.fillRect(12, -10, 10, 20);
        ctx.save();
        ctx.translate(-8, 0);
        ctx.rotate(this.turretAngle);
        ctx.fillStyle = '#1e272e';
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
        const canisterLen = 32 - (this.raiseAngle * 12);
        if (this.raiseAngle > 0.1) {
            ctx.fillStyle = '#bdc3c7';
            ctx.fillRect(2, -2, 8 * this.raiseAngle, 4);
        }
        ctx.fillStyle = '#4b5320';
        ctx.fillRect(-4, -7, canisterLen, 14);
        if (this.raiseAngle > 0.8) {
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath(); ctx.arc(canisterLen - 8, 0, 5, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(canisterLen - 6, -5, 2, 10);
        }
        ctx.restore();
        if (this.isSieged && !this.isTransitioning) {
            const pulse = Math.sin(Date.now() / 150) * 0.5 + 0.5;
            ctx.fillStyle = `rgba(255, 49, 49, ${0.4 + pulse * 0.6})`;
            ctx.beginPath(); ctx.arc(-18, 0, 2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }
}

export class Artillery extends PlayerUnit {
    static editorConfig = { category: 'vehicle', icon: 'artillery', name: '자주포' };
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'artillery';
        this.name = '자주포';
        this.speed = 0.9;
        this.fireRate = 4000;
        this.damage = 100;
        this.attackRange = 600;
        this.visionRange = 8;
        this.explosionRadius = 60;
        this.size = 80;
        this.cargoSize = 5;
        this.population = 5; // 승무원 5명
        this.isIndirect = true; // 자주포는 곡사 사격

        this.ammoType = 'shell';
        this.maxAmmo = 20;
        this.ammo = 20;
        this.muzzleOffset = 80;
        this.projectileSpeed = 10; // 곡사포는 탄속이 약간 느림
    }

    attack() {
        this.performAttack();
    }

    draw(ctx) {
        if (this.isUnderConstruction) { this.drawConstruction(ctx); return; }
        ctx.save();
        ctx.scale(2, 2);
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-16, -11, 32, 22);
        ctx.fillStyle = '#4b5320';
        ctx.fillRect(-15, -10, 30, 20);
        ctx.save();
        ctx.translate(-2, 0);
        ctx.fillStyle = '#556644';
        ctx.fillRect(-10, -9, 22, 18);
        ctx.fillStyle = '#4b5320';
        ctx.fillRect(12, -2, 28, 4);
        ctx.restore();
        ctx.restore();
    }
}

export class AntiAirVehicle extends PlayerUnit {
    static editorConfig = { category: 'vehicle', icon: 'anti-air', name: '대공포' };
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'anti-air';
        this.name = '자주 대공포';
        this.speed = 1.3;
        this.fireRate = 150;
        this.damage = 8;
        this.attackRange = 600;
        this.visionRange = 10;
        this.attackTargets = ['air'];
        this.lastBarrelSide = 1;
        this.size = 80;
        this.cargoSize = 5;
        this.population = 3; // 운전수, 포수, 지휘관
        this.muzzleOffset = 50;
        this.projectileSpeed = 20; // 대공탄은 빠름
        this.hitEffectType = 'flak';

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
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-14, -14, 30, 28);
        ctx.fillStyle = '#4b5320';
        ctx.fillRect(-12, -9, 24, 18);
        ctx.fillStyle = '#556644';
        ctx.fillRect(-6, -7, 10, 14);
        ctx.fillStyle = '#1e272e';
        ctx.fillRect(2, -10, 20, 2);
        ctx.fillRect(2, 8, 20, 2);
        ctx.restore();
    }
}

export class MobileICBMLauncher extends PlayerUnit {
    static editorConfig = { category: 'vehicle', icon: 'icbm-launcher', name: '이동식 ICBM 발사대' };
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'icbm-launcher';
        this.name = '이동식 ICBM 발사대';
        this.speed = 1.0; // 매우 느림
        this.baseSpeed = 1.0;
        this.fireRate = 8000; // 매우 긴 재장전 시간
        this.damage = 5000; // 압도적인 데미지
        this.attackRange = 3000; // 맵 전체 수준의 사거리
        this.visionRange = 10;
        this.recoil = 0;
        this.size = 110; // 더 거대함
        this.cargoSize = 15;
        this.population = 6; // 다수의 운용 인원
        this.isSieged = false;
        this.isTransitioning = false;
        this.transitionTimer = 0;
        this.maxTransitionTime = 120; // 시즈 모드 전환에 긴 시간 소요
        this.raiseAngle = 0;
        this.turretAngle = 0;

        this.isFiring = false;
        this.fireDelayTimer = 0;
        this.maxFireDelay = 180; // 3초 카운트다운 (60fps * 3)
        this.pendingFirePos = { x: 0, y: 0 };
        this.attackTargets = ['ground', 'sea'];

        this.ammoType = 'nuclear-missile';
        this.maxAmmo = 2; // 탄약 제한적
        this.ammo = 2;
        this.hp = 1500;
        this.maxHp = 1500;
    }

    init(x, y, engine) {
        super.init(x, y, engine);
        this.isSieged = false;
        this.isTransitioning = false;
        this.transitionTimer = 0;
        this.raiseAngle = 0;
        this.turretAngle = 0;
        this.isFiring = false;
        this.fireDelayTimer = 0;
        this.speed = this.baseSpeed || 1.0;
    }

    getSkillConfig(cmd) {
        const skills = {
            'siege': { type: 'state', handler: this.toggleSiege },
            'manual_fire': { type: 'targeted', handler: this.fireAt }
        };
        return skills[cmd];
    }

    getCacheKey() {
        if (this.isTransitioning || this.isSieged || this.turretAngle !== 0) return null;
        return `${this.type}-idle`;
    }

    toggleSiege() {
        if (this.isTransitioning || this.isFiring) return;
        this.isTransitioning = true;
        this.transitionTimer = 0;
        this.destination = null;
        this.speed = 0;
        this.engine.addEffect?.('system', this.x, this.y, '#fff', this.isSieged ? '발사대 수평 전환 중...' : '전략 미사일 기립 중...');
    }

    update(deltaTime) {
        const prevAngle = this.angle;
        super.update(deltaTime);

        if (this.isSieged) {
            this.angle = prevAngle;
        }

        if (this.isSieged && !this.isTransitioning) {
            if (this.isFiring) {
                const targetAngle = Math.atan2(this.pendingFirePos.y - this.y, this.pendingFirePos.x - this.x);
                let relativeTargetAngle = targetAngle - this.angle;
                let diff = relativeTargetAngle - this.turretAngle;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                
                this.turretAngle += diff * 0.008; // 매우 느리고 신중한 회전

                if (Math.abs(diff) < 0.05) {
                    this.fireDelayTimer++;
                }
            }
        } else if (!this.isSieged) {
            this.turretAngle *= 0.95;
            if (Math.abs(this.turretAngle) < 0.01) this.turretAngle = 0;
        }

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
            }
        }

        if (this.isFiring) {
            if (this.fireDelayTimer === 1) this.engine.addEffect?.('system', this.x, this.y - 80, '#ff3131', '3');
            if (this.fireDelayTimer === 60) this.engine.addEffect?.('system', this.x, this.y - 80, '#ff3131', '2');
            if (this.fireDelayTimer === 120) this.engine.addEffect?.('system', this.x, this.y - 80, '#ff3131', '1');
            if (this.fireDelayTimer === 165) { // LAUNCH! 텍스트 및 실제 발사보다 15프레임 빠르게
                this.engine.audioSystem.play('missile_flight', { volume: 0.3 });
            }
            if (this.fireDelayTimer === 175) this.engine.addEffect?.('system', this.x, this.y - 80, '#ff3131', 'LAUNCH!');

            if (this.fireDelayTimer >= this.maxFireDelay) {
                this.executeFire({ skipSound: true });
                this.isFiring = false;
                this.fireDelayTimer = 0;
            }
        }
    }

    attack() {
        if (this.isSieged && !this.isTransitioning && !this.isFiring) {
            const now = Date.now();
            if (now - this.lastFireTime > this.fireRate && this.target) {
                this.pendingFirePos = { x: this.target.x, y: this.target.y };
                this.executeFire();
            }
        }
    }

    fireAt(targetX, targetY) {
        if (!this.isSieged || this.isTransitioning || this.isFiring) return;
        if (this.ammo <= 0) {
            this.engine.addEffect?.('system', this.x, this.y - 40, '#ff3131', '핵탄두 고갈!');
            return;
        }
        const dist = Math.hypot(targetX - this.x, targetY - this.y);
        if (dist > this.attackRange) return;

        const now = Date.now();
        if (now - this.lastFireTime > this.fireRate) {
            this.isFiring = true;
            this.fireDelayTimer = 0;
            this.pendingFirePos = { x: targetX, y: targetY };
            this.engine.addEffect?.('system', this.x, this.y - 60, '#f1c40f', '전략 핵 미사일 발사 시퀀스 개시');
        }
    }

    executeFire(options = {}) {
        if (this.ammo <= 0) return;
        const { x: targetX, y: targetY } = this.pendingFirePos;
        
        const totalAngle = this.angle + this.turretAngle;
        const launchDist = 40;
        const spawnX = this.x + Math.cos(totalAngle) * launchDist;
        const spawnY = this.y + Math.sin(totalAngle) * launchDist;

        if (!options.skipSound) {
            this.engine.audioSystem.play('missile_flight', { volume: 0.3 });
        }
        const missile = new NuclearMissile(spawnX, spawnY, targetX, targetY, this.damage, this.engine, this);
        this.engine.entities.projectiles.push(missile);

        this.ammo--;
        this.lastFireTime = Date.now();
        this.recoil = 25;
        for(let i=0; i<8; i++) {
            this.engine.addEffect?.('smoke', spawnX, spawnY);
        }
    }

    draw(ctx) {
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
        ctx.save();
        ctx.scale(2.5, 2.5);
        if (this.raiseAngle > 0) {
            const outDist = this.raiseAngle * 12;
            ctx.fillStyle = '#1e272e';
            const outriggers = [
                { x: -25, y: -12, dx: -1, dy: -1 }, { x: 0, y: -12, dx: 0, dy: -1 }, { x: 25, y: -12, dx: 1, dy: -1 },
                { x: -25, y: 12, dx: -1, dy: 1 }, { x: 0, y: 12, dx: 0, dy: 1 }, { x: 25, y: 12, dx: 1, dy: 1 }
            ];
            outriggers.forEach(o => {
                ctx.save();
                ctx.translate(o.x + o.dx * outDist, o.y + o.dy * outDist);
                ctx.fillRect(-3, -3, 6, 6);
                ctx.strokeStyle = '#95a5a6';
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(-o.dx * outDist, -o.dy * outDist); ctx.lineTo(0, 0); ctx.stroke();
                ctx.restore();
            });
        }
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(-35, -12, 70, 24);
        ctx.fillStyle = '#000';
        for(let i=0; i<4; i++) {
            ctx.fillRect(-30 + i*20, -14, 12, 4);
            ctx.fillRect(-30 + i*20, 10, 12, 4);
        }
        ctx.fillStyle = '#34495e';
        ctx.fillRect(20, -12, 15, 24);
        ctx.fillStyle = '#2980b9';
        ctx.fillRect(30, -10, 3, 20);
        ctx.save();
        ctx.translate(-10, 0);
        ctx.rotate(this.turretAngle);
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
        const canisterLen = 50 - (this.raiseAngle * 15);
        if (this.raiseAngle > 0.1) {
            ctx.fillStyle = '#7f8c8d';
            ctx.fillRect(5, -4, 15 * this.raiseAngle, 3);
            ctx.fillRect(5, 1, 15 * this.raiseAngle, 3);
        }
        const mslGrd = ctx.createLinearGradient(0, -10, 0, 10);
        mslGrd.addColorStop(0, '#34495e');
        mslGrd.addColorStop(0.5, '#2d3436');
        mslGrd.addColorStop(1, '#1e272e');
        ctx.fillStyle = mslGrd;
        ctx.fillRect(-5, -10, canisterLen, 20);
        ctx.fillStyle = '#f1c40f';
        for(let i=0; i<3; i++) {
            ctx.fillRect(5 + i*12, -10, 3, 20);
        }
        if (this.raiseAngle > 0.8) {
            ctx.fillStyle = '#c0392b';
            ctx.beginPath(); ctx.arc(canisterLen - 10, 0, 8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#000';
            ctx.beginPath(); ctx.arc(canisterLen - 10, 0, 6, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(canisterLen - 8, -8, 4, 16);
        }
        ctx.restore();
        if (this.isSieged) {
            const pulse = Math.sin(Date.now() / 100) * 0.5 + 0.5;
            ctx.fillStyle = `rgba(241, 196, 15, ${0.3 + pulse * 0.7})`;
            ctx.beginPath(); ctx.arc(-30, -8, 3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(-30, 8, 3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }
}
