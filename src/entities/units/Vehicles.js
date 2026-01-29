import { PlayerUnit } from './BaseUnit.js';
import { Missile } from '../projectiles/Missile.js';

export class Tank extends PlayerUnit {
    static editorConfig = { category: 'unit', icon: 'tank', name: '전차' };
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'tank';
        this.name = '전차';
        this.speed = 1.8;
        this.fireRate = 1800;
        this.damage = 200;
        this.color = '#39ff14';
        this.attackRange = 360;
        this.visionRange = 6;
        this.explosionRadius = 40;
        this.size = 80;
        this.cargoSize = 10;
        this.hp = 1000;
        this.maxHp = 1000;
        this.attackType = 'hitscan';
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
    static editorConfig = { category: 'unit', icon: 'missile-launcher', name: '미사일 발사대' };
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
        this.attackType = 'projectile';
        this.attackTargets = ['ground', 'sea'];

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

    getCacheKey() {
        // 독립 회전 및 변신 애니메이션이 있으므로 시즈 관련 상태일 땐 실시간
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
        // [중요] 시즈 모드 중에는 부모(BaseUnit)의 이동/회전 로직을 건너뜀
        if (this.isSieged && !this.isTransitioning) {
            // 부모의 update 대신 기본적인 속성 업데이트만 수행 (필요 시)
            // (BaseUnit.update가 각도를 강제로 조절하는 것을 방지)
        } else {
            super.update(deltaTime);
        }

        // 시즈 모드 중 상부 독립 회전 로직
        if (this.isSieged && !this.isTransitioning) {
            if (this.isFiring) {
                // 발사 중일 때만 타겟 방향으로 회전
                const targetAngle = Math.atan2(this.pendingFirePos.y - this.y, this.pendingFirePos.x - this.x);
                let relativeTargetAngle = targetAngle - this.angle;
                
                let diff = relativeTargetAngle - this.turretAngle;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                
                // 포탑 회전 속도 극도로 하향 (0.025 -> 0.0125)
                this.turretAngle += diff * 0.0125;

                // 포탑이 어느 정도 정렬되었을 때만 발사 타이머 가동 (차이 < 0.05 라디안)
                if (Math.abs(diff) < 0.05) {
                    this.fireDelayTimer++;
                }
            }
        } else if (!this.isSieged) {
            // 시즈 모드가 완전히 해제된 상태에서만 정면 정렬
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
            // 발사 예고 효과
            this.engine.addEffect?.('system', this.x, this.y - 50, '#ff3131', '미사일 포탑 정렬 중...');
        }
    }

    executeFire() {
        if (this.ammo <= 0) return;
        const { x: targetX, y: targetY } = this.pendingFirePos;
        
        // 발사 위치 계산 (회전된 상부 기준)
        const totalAngle = this.angle + this.turretAngle;
        const launchDist = 30;
        const spawnX = this.x + Math.cos(totalAngle) * launchDist;
        const spawnY = this.y + Math.sin(totalAngle) * launchDist;

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

        // --- 1. 고정 하부 (차체) ---
        // 아웃리거 (지지대)
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

        // 기본 몸체
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(-22, -10, 44, 20);
        // 운전석
        ctx.fillStyle = '#34495e';
        ctx.fillRect(12, -10, 10, 20);

        // --- 2. 회전 상부 (발사관) ---
        ctx.save();
        // 포탑 회전축 (차체 뒤쪽)
        ctx.translate(-8, 0);
        ctx.rotate(this.turretAngle); // 하부 기준 상대적 회전

        // 회전 링
        ctx.fillStyle = '#1e272e';
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();

        // 발사관
        const canisterLen = 32 - (this.raiseAngle * 12);
        const canisterWidth = 14 + (this.raiseAngle * 2);

        // 유압 실린더
        if (this.raiseAngle > 0.1) {
            ctx.fillStyle = '#bdc3c7';
            ctx.fillRect(2, -2, 8 * this.raiseAngle, 4);
        }

        // 메인 캐니스터
        ctx.fillStyle = '#4b5320';
        ctx.fillRect(-4, -7, canisterLen, 14);
        
        // 탄두 사출구 디테일
        if (this.raiseAngle > 0.8) {
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath(); ctx.arc(canisterLen - 8, 0, 5, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(canisterLen - 6, -5, 2, 10);
        }
        ctx.restore();

        // 상태 지시등
        if (this.isSieged && !this.isTransitioning) {
            const pulse = Math.sin(Date.now() / 150) * 0.5 + 0.5;
            ctx.fillStyle = `rgba(255, 49, 49, ${0.4 + pulse * 0.6})`;
            ctx.beginPath(); ctx.arc(-18, 0, 2, 0, Math.PI * 2); ctx.fill();
        }

        ctx.restore();
    }
}

export class Artillery extends PlayerUnit {
    static editorConfig = { category: 'unit', icon: 'artillery', name: '자주포' };
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'artillery';
        this.name = '자주포';
        this.speed = 0.9;
        this.fireRate = 4000;
        this.damage = 100;
        this.attackRange = 600;
        this.explosionRadius = 60;
        this.size = 80;
        this.cargoSize = 5;
        this.attackType = 'projectile';

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
    static editorConfig = { category: 'unit', icon: 'anti-air', name: '대공포' };
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
        this.attackType = 'hitscan';
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