import { PlayerUnit } from './BaseUnit.js';

export class Rifleman extends PlayerUnit {
    static editorConfig = { category: 'unit', icon: 'rifleman', name: '보병 분대' };
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'rifleman';
        this.name = '보병 분대'; // 이름 변경
        this.speed = 0.9;
        this.fireRate = 150; // 분대 사격 연사력 조정
        this.damage = 15;    // 분대 통합 공격력 15
        this.attackRange = 200; // 사거리 소폭 상향
        this.size = 40;      // 소형 표준
        this.visionRange = 5;
        this.hp = 210;       // 3인 통합 체력 (70*3)
        this.maxHp = 210;
        this.population = 3; // 분대원 3명
        this.attackTargets = ['ground', 'sea', 'air'];
        this.cargoSize = 3;  // 분대이므로 적재 용량 증가
        this.attackType = 'hitscan';
        this.hitEffectType = 'bullet';

        this.ammoType = 'bullet';
        this.maxAmmo = 150;
        this.ammo = 150;
        this.ammoConsumption = 3;
    }

    attack() {
        this.performAttack();
    }

    draw(ctx) {
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }

        // 삼각형 대열 오프셋 (중심 기준)
        const formation = [
            { x: 15, y: 0 },   // 리더 (앞)
            { x: -12, y: -18 }, // 좌측 후방
            { x: -12, y: 18 }   // 우측 후방
        ];

        formation.forEach((pos, index) => {
            ctx.save();
            ctx.translate(pos.x, pos.y);

            // 분대원마다 미세한 각도 및 애니메이션 차이 부여 (생동감)
            const individualOffset = (index * 1234) % 100;
            const breathing = Math.sin((Date.now() + individualOffset) / 400) * 0.5;
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
        });
    }
}

export class Sniper extends PlayerUnit {
    static editorConfig = { category: 'unit', icon: 'sniper', name: '저격수' };
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'sniper';
        this.name = '저격수';
        this.speed = 0.8; // 소총병보다 약간 느림
        this.fireRate = 2000; // 2초에 한 번 발사
        this.damage = 70;
        this.attackRange = 450;
        this.size = 40;
        this.visionRange = 10; // 시야가 매우 넓음
        this.hp = 40;
        this.maxHp = 40;
        this.population = 2; // 사수 + 관측수
        this.attackTargets = ['ground', 'sea', 'air'];
        this.attackType = 'hitscan';
        this.hitEffectType = 'hit'; // 피격 이펙트 타입 설정

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
        ctx.scale(2, 2);

        const isShooting = (this.target && (Date.now() - this.lastFireTime < 200));

        // 1. 길리 슈트
        ctx.fillStyle = '#2d3310';
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.bezierCurveTo(-8, -5, -10, 0, -8, 5);
        ctx.lineTo(0, 6);
        ctx.bezierCurveTo(8, 5, 8, -5, 0, -5);
        ctx.fill();

        // 2. 머리
        ctx.fillStyle = '#3a4118';
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();

        // 3. 대구경 저격 소총
        ctx.save();
        ctx.translate(4, 1);
        if (isShooting) ctx.translate(-2, 0);

        ctx.fillStyle = '#2f3640';
        ctx.fillRect(0, -1.5, 8, 3);
        ctx.fillRect(8, -1, 16, 2);

        ctx.restore();
        ctx.restore();
    }
}

