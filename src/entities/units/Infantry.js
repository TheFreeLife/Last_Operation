import { PlayerUnit } from './BaseUnit.js';

export class Rifleman extends PlayerUnit {
    static editorConfig = { category: 'unit', icon: 'rifleman', name: '보병' };
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'rifleman';
        this.name = '보병';
        this.speed = 1.0;    // 단일 유닛이 되어 기동성 소폭 상향
        this.fireRate = 450; // 분대 사격보다 연사 속도 정상화
        this.damage = 5;     // 공격력 1/3 하향 (15 -> 5)
        this.attackRange = 220; 
        this.size = 24;      // 크기 축소 (40 -> 24)
        this.visionRange = 5;
        this.hp = 70;        // 체력 1/3 하향 (210 -> 70)
        this.maxHp = 70;
        this.population = 1; // 인구수 1명
        this.attackTargets = ['ground', 'sea', 'air'];
        this.cargoSize = 1;  
        this.hitEffectType = 'bullet';

        this.ammoType = 'bullet';
        this.maxAmmo = 50;
        this.ammo = 50;
        this.ammoConsumption = 1;
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
        
        // 숨쉬기 애니메이션
        const breathing = Math.sin(Date.now() / 400) * 0.5;
        ctx.rotate(breathing * 0.05);
        ctx.scale(1.8, 1.8);

        const isShooting = (this.target && (Date.now() - this.lastFireTime < 200));

        // 0. 하부 그림자 (부드러운 타원)
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath(); ctx.ellipse(0, 2, 5, 3, 0, 0, Math.PI * 2); ctx.fill();

        // 1. 전술 백팩
        ctx.fillStyle = '#2d3310';
        ctx.fillRect(-10.5, -5, 6, 10);
        ctx.fillStyle = '#3a4118';
        ctx.fillRect(-10, -5, 5, 10);

        // 2. 바디 (전투복 & 레이어드 아머)
        ctx.fillStyle = '#556644';
        ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();

        // 플레이트 캐리어
        ctx.fillStyle = '#4b5320';
        ctx.beginPath();
        ctx.roundRect(-2.5, -5, 7, 10, 1);
        ctx.fill();

        // 3. 헬멧
        ctx.fillStyle = '#4b5320';
        ctx.beginPath(); ctx.arc(1, 0, 4.8, 0, Math.PI * 2); ctx.fill();

        // 4. 전술 소총
        ctx.save();
        ctx.translate(3.5, 2);
        if (isShooting) ctx.translate(-1.2, 0);

        ctx.fillStyle = '#1e272e';
        ctx.fillRect(1, -1.5, 9, 3.5);
        ctx.fillRect(10, -1.2, 11, 2.4);

        // 팔 및 손
        ctx.fillStyle = '#556644';
        ctx.beginPath(); ctx.arc(0, 0, 2.8, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(10, 2.2, 2.5, 0, Math.PI * 2); ctx.fill();

        ctx.restore();
        ctx.restore();
    }
}

export class Sniper extends PlayerUnit {
    static editorConfig = { category: 'unit', icon: 'sniper', name: '저격수' };
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'sniper';
        this.name = '저격수';
        this.speed = 1.0; 
        this.fireRate = 2500; 
        this.damage = 80;
        this.attackRange = 500;
        this.size = 24;      // 크기 축소
        this.visionRange = 12; 
        this.hp = 50;
        this.maxHp = 50;
        this.population = 1; // 2인 1조에서 단일 유닛으로 변경
        this.attackTargets = ['ground', 'sea', 'air'];
        this.hitEffectType = 'hit';

        this.ammoType = 'bullet';
        this.maxAmmo = 10;
        this.ammo = 10;
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
        ctx.scale(2.2, 2.2); // 약간 크게 그림

        const isShooting = (this.target && (Date.now() - this.lastFireTime < 200));

        // 0. 그림자
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(0, 3, 6, 4, 0, 0, Math.PI * 2); ctx.fill();

        // 1. 길리 슈트 (더 빽빽하게)
        ctx.fillStyle = '#2d3310';
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.bezierCurveTo(-10, -6, -12, 0, -10, 6);
        ctx.lineTo(0, 7);
        ctx.bezierCurveTo(10, 6, 10, -6, 0, -6);
        ctx.fill();

        // 2. 머리
        ctx.fillStyle = '#3a4118';
        ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.fill();

        // 3. 대구경 저격 소총
        ctx.save();
        ctx.translate(5, 1);
        if (isShooting) ctx.translate(-3, 0);

        ctx.fillStyle = '#1e272e'; // 더 어두운 색상
        ctx.fillRect(0, -1.8, 10, 3.6); // 본체
        ctx.fillRect(10, -1.2, 22, 2.4); // 총열

        // 조준경
        ctx.fillStyle = '#2f3640';
        ctx.fillRect(2, -3.5, 6, 2.5);

        ctx.restore();
        ctx.restore();
    }
}

