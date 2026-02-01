import { PlayerUnit } from './BaseUnit.js';
import { Missile } from '../projectiles/Missile.js';
import { NuclearMissile } from '../projectiles/NuclearMissile.js';

export class Tank extends PlayerUnit {
    static editorConfig = { category: 'unit', icon: 'tank', name: '전차' };
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
        // [수정] 시즈 모드 중에는 차체(하단부) 회전 고정
        const prevAngle = this.angle;

        // 부모의 업데이트를 호출하여 충돌 및 상태 관리를 유지함
        super.update(deltaTime);

        if (this.isSieged) {
            this.angle = prevAngle; // 시즈 중이면 차체 각도를 이전 상태로 고정
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
            // [수정] ECS 기반 performAttack 대신 객체 기반 executeFire 호출
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
    static editorConfig = { category: 'unit', icon: 'icbm-launcher', name: '이동식 ICBM 발사대' };
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
        this.maxFireDelay = 150; // 발사 전 최종 점검 시간
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
            if (this.fireDelayTimer >= this.maxFireDelay) {
                this.executeFire();
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

    executeFire() {
        if (this.ammo <= 0) return;
        const { x: targetX, y: targetY } = this.pendingFirePos;
        
        const totalAngle = this.angle + this.turretAngle;
        const launchDist = 40;
        const spawnX = this.x + Math.cos(totalAngle) * launchDist;
        const spawnY = this.y + Math.sin(totalAngle) * launchDist;

        const missile = new NuclearMissile(spawnX, spawnY, targetX, targetY, this.damage, this.engine, this);
        this.engine.entities.projectiles.push(missile);

        this.ammo--;
        this.lastFireTime = Date.now();
        this.recoil = 25;
        
        // 발사 시 주변에 강력한 먼지 폭풍 효과
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
        ctx.scale(2.5, 2.5); // 크기 확대

        // --- 1. 거대한 8륜 차체 ---
        // 아웃리거 (4개에서 6개로 증가)
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

        // 차체 프레임
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(-35, -12, 70, 24);
        
        // 8개의 바퀴
        ctx.fillStyle = '#000';
        for(let i=0; i<4; i++) {
            ctx.fillRect(-30 + i*20, -14, 12, 4);
            ctx.fillRect(-30 + i*20, 10, 12, 4);
        }

        // 대형 운전석 (앞쪽)
        ctx.fillStyle = '#34495e';
        ctx.fillRect(20, -12, 15, 24);
        ctx.fillStyle = '#2980b9'; // 창문
        ctx.fillRect(30, -10, 3, 20);

        // --- 2. 전략 발사관 ---
        ctx.save();
        ctx.translate(-10, 0);
        ctx.rotate(this.turretAngle);

        // 거대한 회전 플랫폼
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();

        // 발사관 (매우 길고 굵음)
        const canisterLen = 50 - (this.raiseAngle * 15);
        const canisterWidth = 20;

        // 거대 유압 시스템
        if (this.raiseAngle > 0.1) {
            ctx.fillStyle = '#7f8c8d';
            ctx.fillRect(5, -4, 15 * this.raiseAngle, 3);
            ctx.fillRect(5, 1, 15 * this.raiseAngle, 3);
        }

        // 전략 미사일 캐니스터
        const mslGrd = ctx.createLinearGradient(0, -10, 0, 10);
        mslGrd.addColorStop(0, '#34495e');
        mslGrd.addColorStop(0.5, '#2d3436');
        mslGrd.addColorStop(1, '#1e272e');
        ctx.fillStyle = mslGrd;
        ctx.fillRect(-5, -10, canisterLen, 20);
        
        // 노란색/검은색 경고 스트라이프
        ctx.fillStyle = '#f1c40f';
        for(let i=0; i<3; i++) {
            ctx.fillRect(5 + i*12, -10, 3, 20);
        }

        // 사출구 해치 디테일
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

        // 긴급 점멸등
        if (this.isSieged) {
            const pulse = Math.sin(Date.now() / 100) * 0.5 + 0.5;
            ctx.fillStyle = `rgba(241, 196, 15, ${0.3 + pulse * 0.7})`;
            ctx.beginPath(); ctx.arc(-30, -8, 3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(-30, 8, 3, 0, Math.PI * 2); ctx.fill();
        }

        ctx.restore();
    }
}