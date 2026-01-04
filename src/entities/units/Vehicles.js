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
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.scale(2, 2);

        const time = Date.now();
        const recoil = (time - this.lastFireTime < 150) ? 3 : 0;

        // 1. 하부 및 궤도 (Bottom Layer)
        ctx.fillStyle = '#1a1a1a'; // 어두운 궤도 내부
        ctx.fillRect(-14, -13, 28, 26);

        // 궤도 윗면 디테일
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(-14, -13, 28, 4); // 좌측 궤도
        ctx.fillRect(-14, 9, 28, 4);   // 우측 궤도

        // 2. 사이드 스커트 (Side Skirts) - 차체 옆면 두께감
        ctx.fillStyle = '#3a4118'; // 어두운 녹색 (측면 장갑)
        ctx.fillRect(-15, -14, 30, 5);
        ctx.fillRect(-15, 9, 30, 5);

        // 스커트 분할선 (Panel Lines)
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 0.5;
        for (let i = -10; i <= 10; i += 6) {
            ctx.beginPath(); ctx.moveTo(i, -14); ctx.lineTo(i, -9); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(i, 9); ctx.lineTo(i, 14); ctx.stroke();
        }

        // 3. 메인 차체 (Hull) - 입체 박스 형태
        // 차체 측면 두께 (Depth)
        ctx.fillStyle = '#3a4118';
        ctx.fillRect(-14, -9, 28, 18);

        // 차체 상판 (Main Deck) - 밝은 녹색
        ctx.fillStyle = '#4b5320';
        ctx.beginPath();
        ctx.moveTo(-14, -9); ctx.lineTo(10, -9); // 후면부
        ctx.lineTo(16, -6); ctx.lineTo(16, 6);   // 전면 경사 장갑
        ctx.lineTo(10, 9); ctx.lineTo(-14, 9);   // 측면
        ctx.closePath();
        ctx.fill();

        // 차체 전면 하부 경사 (2.5D 입체감)
        ctx.fillStyle = '#3a4118';
        ctx.beginPath();
        ctx.moveTo(16, -6); ctx.lineTo(18, -4); ctx.lineTo(18, 4); ctx.lineTo(16, 6);
        ctx.fill();

        // 엔진 그릴 및 후방 디테일
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(-12, -6, 7, 12);
        for (let i = 0; i < 3; i++) {
            ctx.strokeStyle = '#1a1a1a';
            ctx.beginPath(); ctx.moveTo(-11 + i * 2, -5); ctx.lineTo(-11 + i * 2, 5); ctx.stroke();
        }

        // 4. 포탑 (Turret) - 상하 레이어 구분
        ctx.save();
        ctx.translate(-3 - recoil * 0.5, 0);

        // 포탑 하부 그림자
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(-6, -8, 18, 16);

        // 포탑 측면 (두께)
        ctx.fillStyle = '#3a4118';
        ctx.beginPath();
        ctx.moveTo(-8, -8); ctx.lineTo(6, -8); ctx.lineTo(11, -4);
        ctx.lineTo(11, 4); ctx.lineTo(6, 8); ctx.lineTo(-8, 8);
        ctx.fill();

        // 포탑 상판 (Wedge-shaped Upper Plate)
        ctx.fillStyle = '#556644';
        ctx.beginPath();
        ctx.moveTo(-8, -8); ctx.lineTo(5, -8); ctx.lineTo(10, -4);
        ctx.lineTo(10, 4); ctx.lineTo(5, 8); ctx.lineTo(-8, 8);
        ctx.closePath();
        ctx.fill();

        // 포탑 모서리 하이라이트
        ctx.strokeStyle = '#6ab04c';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // 전차장 조준경 (CITV) - 입체 원통
        ctx.fillStyle = '#2d3436';
        ctx.beginPath(); ctx.arc(0, -4, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#444';
        ctx.beginPath(); ctx.arc(0, -4, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#00d2ff'; // 렌즈 반사
        ctx.fillRect(0.5, -4.5, 1, 1);

        // 해치 (Hatches)
        ctx.fillStyle = '#3a4118';
        ctx.beginPath(); ctx.arc(-4, 3, 3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#2d3436';
        ctx.beginPath(); ctx.arc(-4, 3, 3, 0, Math.PI * 2); ctx.stroke();

        // 5. 주포 (120mm Smoothbore Gun)
        ctx.save();
        ctx.translate(10, 0);

        // 포방패 (Mantlet) - 입체 박스
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(0, -3.5, 5, 7);
        ctx.fillStyle = '#3a4118';
        ctx.fillRect(0, -3.5, 4, 7);

        // 포신 (Main Gun)
        const gunX = -recoil;
        ctx.fillStyle = '#1e272e';
        // 메인 포신
        ctx.fillRect(gunX, -1.2, 30, 2.4);

        // 서멀 슬리브 디테일 (Thermal Sleeves)
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(gunX + 8, -1.6, 5, 3.2);
        ctx.fillRect(gunX + 18, -1.6, 4, 3.2);

        // 포구 동적 보정 장치 (MRS) 및 머즐
        ctx.fillStyle = '#000';
        ctx.fillRect(gunX + 30, -1.5, 2, 3);

        // 사격 이펙트
        if (recoil > 0) {
            ctx.save();
            ctx.translate(32, 0);
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 15);
            grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
            grad.addColorStop(0.3, 'rgba(255, 215, 0, 0.7)');
            grad.addColorStop(1, 'rgba(255, 69, 0, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
        ctx.restore();

        // 6. 안테나 및 기타 부착물
        ctx.strokeStyle = '#95a5a6';
        ctx.lineWidth = 0.4;
        ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(-14, -14); ctx.stroke();

        // 연막탄 발사기 (Smoke Launchers)
        ctx.fillStyle = '#1e272e';
        ctx.fillRect(2, -8.5, 3, 2);
        ctx.fillRect(2, 6.5, 3, 2);

        ctx.restore();
        ctx.restore();

        // 아군 체력 바
        const barW = 30;
        const barY = this.y - 35;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - barW / 2, barY, barW, 4);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW / 2, barY, (this.hp / this.maxHp) * barW, 4);
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
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        if (this.recoil > 0) {
            ctx.translate(-this.recoil, 0);
            this.recoil *= 0.85;
            if (this.recoil < 0.1) this.recoil = 0;
        }

        ctx.scale(2, 2);

        if (this.raiseAngle > 0) {
            ctx.fillStyle = '#636e72';
            const extend = 8 * this.raiseAngle;
            ctx.fillRect(-15, -12 - extend, 4, 4);
            ctx.fillRect(-15, 8 + extend, 4, 4);
            ctx.fillRect(11, -12 - extend, 4, 4);
            ctx.fillRect(11, 8 + extend, 4, 4);
        }

        ctx.fillStyle = '#2d3436';
        ctx.fillRect(-22, -10, 44, 20);

        ctx.fillStyle = '#34495e';
        ctx.fillRect(12, -10, 10, 20);
        ctx.fillStyle = '#81ecec';
        ctx.fillRect(16, -8, 4, 16);

        ctx.fillStyle = '#1a1a1a';
        const wheelX = [-17, -7, 3, 13];
        wheelX.forEach(x => {
            ctx.fillRect(x, -12, 6, 3);
            ctx.fillRect(x, 9, 6, 3);
        });

        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(-20, -8, 30, 16);

        ctx.save();
        ctx.translate(-15, 0);
        const tiltDir = Math.cos(this.angle) >= 0 ? -1 : 1;
        ctx.rotate(tiltDir * (Math.PI / 10) * this.raiseAngle);

        ctx.fillStyle = '#4b5320';
        const scaleS = 1 + (this.raiseAngle * 0.1);
        const canisterLen = 32 * scaleS;
        ctx.fillRect(0, -7, canisterLen, 14);

        ctx.strokeStyle = '#3a4118';
        for (let i = 4; i <= 28; i += 4) {
            ctx.beginPath(); ctx.moveTo(i, -7); ctx.lineTo(i, 7); ctx.stroke();
        }

        // 해치 개방 애니메이션
        const hatchProgress = this.isFiring ? (this.fireDelayTimer / this.maxFireDelay) : 0;
        ctx.fillStyle = '#2d3436';
        if (hatchProgress < 0.1) {
            ctx.fillRect(canisterLen - 2, -7, 3, 14);
        } else {
            const openDist = 8 * Math.min(hatchProgress * 1.5, 1);
            ctx.fillRect(canisterLen - 2, -7 - openDist, 3, 7); // 상단
            ctx.fillRect(canisterLen - 2, 0 + openDist, 3, 7);  // 하단
            if (hatchProgress > 0.6) {
                ctx.fillStyle = `rgba(255, 165, 0, ${(hatchProgress - 0.6) * 2.5})`;
                ctx.fillRect(canisterLen - 4, -4, 4, 8);
            }
        }

        if (this.recoil > 5) {
            ctx.save();
            ctx.translate(canisterLen, 0);
            ctx.fillStyle = '#ff4500';
            ctx.beginPath(); ctx.arc(5, 0, 12, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ff8c00';
            ctx.beginPath(); ctx.arc(8, 0, 8, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
        ctx.restore();

        // 발사 준비 중 스파크 효과
        if (this.isFiring && this.fireDelayTimer > 15) {
            ctx.save();
            ctx.translate(15, 0);
            ctx.fillStyle = '#f1c40f';
            for (let i = 0; i < 3; i++) {
                ctx.fillRect(Math.random() * 15, (Math.random() - 0.5) * 15, 2, 2);
            }
            ctx.restore();
        }

        ctx.strokeStyle = '#95a5a6';
        ctx.beginPath(); ctx.moveTo(-18, -7); ctx.lineTo(-24, -13); ctx.stroke();
        ctx.restore();

        const barW = 30;
        const barY = this.y - 30;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - barW / 2, barY, barW, 4);
        if (this.isFiring) {
            ctx.fillStyle = '#e67e22'; // 발사 준비 게이지
            ctx.fillRect(this.x - barW / 2, barY, (this.fireDelayTimer / this.maxFireDelay) * barW, 4);
        } else {
            ctx.fillStyle = this.isSieged ? '#f1c40f' : '#2ecc71';
            ctx.fillRect(this.x - barW / 2, barY, (this.hp / this.maxHp) * barW, 4);
        }
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
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.scale(2, 2);

        // 1. 하부 궤도 및 차체 (Chassis)
        ctx.fillStyle = '#1a1a1a'; // 궤도 색상
        ctx.fillRect(-16, -11, 32, 22);

        ctx.fillStyle = '#4b5320'; // 올리브 드랩 (메인 차체)
        ctx.beginPath();
        ctx.moveTo(-15, -10); ctx.lineTo(15, -10);
        ctx.lineTo(18, -8); ctx.lineTo(18, 8); ctx.lineTo(15, 10);
        ctx.lineTo(-15, 10); ctx.lineTo(-18, 8); ctx.lineTo(-18, -8);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#3a4118';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // 보기륜 (Wheels) 디테일
        ctx.fillStyle = '#2d3436';
        for (let i = -12; i <= 12; i += 6) {
            ctx.beginPath(); ctx.arc(i, -10, 2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(i, 10, 2, 0, Math.PI * 2); ctx.fill();
        }

        // 2. 거대 박스형 포탑 (Turret)
        ctx.save();
        // 포탑은 차체보다 약간 뒤쪽에 위치
        ctx.translate(-2, 0);

        ctx.fillStyle = '#556644';
        ctx.fillRect(-10, -9, 22, 18);
        ctx.strokeStyle = '#2d3436';
        ctx.strokeRect(-10, -9, 22, 18);

        // 포탑 상부 디테일 (해치 및 장비)
        ctx.fillStyle = '#3a4118';
        ctx.fillRect(-2, -6, 6, 6); // 메인 해치
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(8, -8, 2, 16); // 포탑 후면 바스켓 느낌

        // 3. 초장거리 포신 (Main Gun)
        ctx.fillStyle = '#4b5320';
        ctx.fillRect(12, -2, 28, 4); // 매우 긴 포신

        // 제퇴기 (Muzzle Brake)
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(38, -3, 4, 6);
        ctx.strokeStyle = '#111';
        ctx.strokeRect(38, -3, 4, 6);

        // 포신 뿌리 부분 (Gun Mantlet)
        ctx.fillStyle = '#3a4118';
        ctx.fillRect(10, -4, 4, 8);

        // 4. 안테나 (Antenna)
        ctx.strokeStyle = '#95a5a6';
        ctx.lineWidth = 0.3;
        ctx.beginPath();
        ctx.moveTo(-8, -7); ctx.lineTo(-15, -15);
        ctx.stroke();

        ctx.restore();

        // 5. 전면 라이트
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath(); ctx.arc(16, -7, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(16, 7, 1.5, 0, Math.PI * 2); ctx.fill();

        ctx.restore();
        this.drawHealthBar(ctx);
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
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.scale(2, 2);

        const time = Date.now();
        const recoil = (time - this.lastFireTime < 150) ? 2 : 0;

        // 1. 하부 궤도 (Tracks) - 2.5D 측면
        ctx.fillStyle = '#1a1a1a'; // 궤도 측면 그림자
        ctx.fillRect(-14, -14, 30, 28);

        ctx.fillStyle = '#2d3436'; // 궤도 윗면
        ctx.fillRect(-14, -14, 30, 5); // 좌측 궤도
        ctx.fillRect(-14, 9, 30, 5);   // 우측 궤도

        // 휠 디테일
        ctx.fillStyle = '#000';
        for (let i = 0; i < 4; i++) {
            ctx.fillRect(-10 + i * 7, -14, 2, 5);
            ctx.fillRect(-10 + i * 7, 9, 2, 5);
        }

        // 2. 차체 (Chassis) - 입체형
        // 차체 그림자
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(-12, -8, 26, 18);

        // 차체 측면 (두께)
        ctx.fillStyle = '#3a4118';
        ctx.fillRect(-12, -9, 24, 18);

        // 차체 상판 (Main Deck)
        ctx.fillStyle = '#4b5320';
        ctx.beginPath();
        ctx.moveTo(-12, -9); ctx.lineTo(12, -9); // 후면
        ctx.lineTo(16, -7); ctx.lineTo(16, 7);   // 전면 경사 시작
        ctx.lineTo(12, 9); ctx.lineTo(-12, 9);   // 우측면
        ctx.closePath();
        ctx.fill();

        // 엔진 그릴 (후방)
        ctx.fillStyle = '#2d3436';
        for (let i = 0; i < 3; i++) ctx.fillRect(-10 + i * 3, -5, 2, 10);

        // 3. 포탑 (Turret) - 입체 박스
        ctx.save();
        // 포탑 그림자
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(-5, -8, 12, 16);

        // 포탑 베이스 (링)
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();

        // 포탑 본체 측면 (어두운 면)
        ctx.fillStyle = '#3a4118';
        ctx.fillRect(-6, -7, 12, 14);

        // 포탑 상판 (밝은 면)
        ctx.fillStyle = '#556644';
        ctx.fillRect(-6, -7, 10, 14);
        // 포탑 모서리 하이라이트
        ctx.strokeStyle = '#6ab04c';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(-6, -7, 10, 14);

        // 4. 레이더 시스템 (2.5D)
        // 전방 추적 레이더 (Tracking Radar)
        ctx.fillStyle = '#2f3542';
        ctx.beginPath(); ctx.arc(6, 0, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#a4b0be'; // 렌즈/센서
        ctx.beginPath(); ctx.arc(7, 0, 1.5, 0, Math.PI * 2); ctx.fill();

        // 후방 탐색 레이더 (Search Radar) - 회전 및 입체감
        ctx.save();
        ctx.translate(-7, 0);
        const radarAngle = this.active ? time / 600 : 0;
        ctx.rotate(radarAngle);

        // 레이더 접시 (Dish)
        ctx.fillStyle = '#95a5a6';
        ctx.fillRect(-2, -8, 4, 16); // 메인 바
        ctx.fillStyle = '#7f8c8d'; // 뒷면/두께
        ctx.fillRect(-3, -8, 1, 16);
        // 안테나 그릴 표현
        ctx.fillStyle = '#333';
        ctx.fillRect(-1, -6, 2, 12);
        ctx.restore();

        // 5. 쌍열 35mm 기관포 (Oerlikon KDA)
        const drawGunSystem = (side) => { // side: 1 or -1
            ctx.save();
            ctx.translate(-2, side * 9);

            // 포신 구동부 (Housing) - 입체
            ctx.fillStyle = '#3a4118'; // 측면
            ctx.fillRect(-6, -3, 12, 6);
            ctx.fillStyle = '#4b5320'; // 윗면
            ctx.fillRect(-6, -3, 10, 6);

            // 포신 (Barrel)
            ctx.fillStyle = '#1e272e';
            const kick = (side === 1 && recoil > 0) || (side === -1 && recoil > 0) ? recoil : 0;

            // 총열 덮개/방열판
            ctx.fillRect(4, -2, 8, 4);
            // 긴 포신
            ctx.fillRect(12 - kick, -1, 20, 2);

            // 소염기 (Muzzle Brake)
            ctx.fillStyle = '#000';
            ctx.fillRect(32 - kick, -1.5, 4, 3);

            // 탄띠 급탄부 (Ammo Feed)
            ctx.fillStyle = '#2d3436';
            ctx.beginPath();
            ctx.moveTo(-2, side * -2);
            ctx.lineTo(-2, side * -5); // 포탑 쪽으로 연결
            ctx.stroke();

            // 발사 이펙트
            if (kick > 0) {
                ctx.fillStyle = `rgba(255, 200, 50, ${0.7 + Math.random() * 0.3})`;
                ctx.beginPath();
                ctx.moveTo(36, 0);
                ctx.lineTo(45, -3); ctx.lineTo(48, 0); ctx.lineTo(45, 3);
                ctx.fill();

                // 연기
                ctx.fillStyle = 'rgba(200, 200, 200, 0.4)';
                ctx.beginPath(); ctx.arc(38, 0, 3 + Math.random() * 2, 0, Math.PI * 2); ctx.fill();
            }

            ctx.restore();
        };

        drawGunSystem(-1);
        drawGunSystem(1);

        ctx.restore();
        ctx.restore();
        this.drawHealthBar(ctx);
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
