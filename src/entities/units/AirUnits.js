import { PlayerUnit } from './BaseUnit.js';
import { FallingBomb } from '../projectiles/Bomb.js';

export class ScoutPlane extends PlayerUnit {
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'scout-plane';
        this.name = '고등 정찰 무인기';
        this.domain = 'air';
        this.speed = 4.5;    // 속도 살짝 상향
        this.visionRange = 18; // 정찰 능력 강화
        this.hp = 250;       // 체력 상향
        this.maxHp = 250;
        this.size = 70;      // 크기 대폭 확장
        this.popCost = 1;
        this.cargoSize = 99; // 수송기 탑승 불가
    }

    draw(ctx) {
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // 1. 그림자 (공중에 떠 있는 느낌)
        ctx.save();
        ctx.translate(-5, 5);
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.moveTo(35, 0); ctx.lineTo(-15, -45); ctx.lineTo(-25, 0); ctx.lineTo(-15, 45);
        ctx.closePath(); ctx.fill();
        ctx.restore();

        // 2. 주익 (Wings - 델타익 스타일의 세련된 날개)
        const wingGrd = ctx.createLinearGradient(-20, -45, -20, 45);
        wingGrd.addColorStop(0, '#7f8c8d');
        wingGrd.addColorStop(0.5, '#bdc3c7');
        wingGrd.addColorStop(1, '#7f8c8d');

        ctx.fillStyle = wingGrd;
        ctx.beginPath();
        ctx.moveTo(10, 0);       // 앞쪽 중앙
        ctx.lineTo(-18, -48);    // 왼쪽 날개 끝
        ctx.lineTo(-28, -48);    // 왼쪽 날개 뒷단
        ctx.lineTo(-15, 0);      // 뒤쪽 중앙
        ctx.lineTo(-28, 48);     // 오른쪽 날개 뒷단
        ctx.lineTo(-18, 48);     // 오른쪽 날개 끝
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 날개 디테일 (플랩 및 라인)
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.moveTo(-10, -25); ctx.lineTo(-22, -25);
        ctx.moveTo(-10, 25); ctx.lineTo(-22, 25);
        ctx.stroke();

        // 3. 동체 (Main Body - 유선형 무인기 스타일)
        const bodyGrd = ctx.createLinearGradient(0, -10, 0, 10);
        bodyGrd.addColorStop(0, '#ecf0f1');
        bodyGrd.addColorStop(0.5, '#bdc3c7');
        bodyGrd.addColorStop(1, '#95a5a6');

        ctx.fillStyle = bodyGrd;
        ctx.beginPath();
        ctx.moveTo(40, 0);       // 기수
        ctx.bezierCurveTo(30, -12, 10, -10, -25, -6); // 상단 라인
        ctx.lineTo(-25, 6);      // 하단 끝
        ctx.bezierCurveTo(10, 10, 30, 12, 40, 0);   // 하단 라인
        ctx.fill();
        ctx.stroke();

        // 4. 엔진 배기구 및 제트 화염
        ctx.fillStyle = '#333';
        ctx.fillRect(-28, -5, 5, 10);

        if (this.destination || Math.random() > 0.3) {
            const flicker = Math.random() * 5;
            const engineGrd = ctx.createRadialGradient(-30, 0, 2, -35, 0, 15);
            engineGrd.addColorStop(0, '#fff');
            engineGrd.addColorStop(0.4, '#00d2ff');
            engineGrd.addColorStop(1, 'transparent');
            ctx.fillStyle = engineGrd;
            ctx.beginPath();
            ctx.moveTo(-28, -4);
            ctx.lineTo(-45 - flicker, 0);
            ctx.lineTo(-28, 4);
            ctx.fill();
        }

        // 5. 정찰용 센서 터렛 (기수 하단)
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.arc(25, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e74c3c'; // 렌즈 안광
        ctx.beginPath();
        ctx.arc(27, 0, 2, 0, Math.PI * 2);
        ctx.fill();

        // 6. 콕핏/위성 안테나 페어링 (무인기 특유의 불룩한 기수)
        ctx.fillStyle = 'rgba(0, 210, 255, 0.3)';
        ctx.beginPath();
        ctx.ellipse(15, 0, 12, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.stroke();

        // 7. 항법등 (깜빡이는 라이트)
        const blink = Math.sin(Date.now() / 200) > 0;
        if (blink) {
            ctx.fillStyle = '#ff3131'; // 좌익단 적색등
            ctx.beginPath(); ctx.arc(-22, -48, 3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#2ecc71'; // 우익단 녹색등
            ctx.beginPath(); ctx.arc(-22, 48, 3, 0, Math.PI * 2); ctx.fill();
        }

        ctx.restore();

        // HP 바 (기체 크기에 맞춰 위치 조정)
        const barW = 50;
        const barY = this.y - 50;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - barW / 2, barY, barW, 5);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW / 2, barY, (this.hp / this.maxHp) * barW, 5);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x - barW / 2, barY, barW, 5);
    }
}

export class Bomber extends PlayerUnit {
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'bomber';
        this.name = '전략 폭격기';
        this.domain = 'ground'; // 지상 시작
        this.baseSpeed = 2.2;
        this.airSpeed = 5.0;   // 공중 비행 속도 (7.0 -> 5.0 하향)
        this.speed = 0.5;      // 낮은 속도로 시작
        this.visionRange = 12;
        this.hp = 1200;
        this.maxHp = 1200;
        this.size = 92;
        this.width = 140;
        this.height = 115;
        this.damage = 0;
        this.attackTargets = ['ground', 'sea'];
        this.cargoSize = 99; // 수송기 탑승 불가

        this.bombTimer = 0;
        this.bombInterval = 500;

        // 이착륙 시스템
        this.altitude = 0.0; // 지상 시작
        this.isLandingZoneSafe = false;
        this.lastX = x;
        this.lastY = y;

        this.isTakeoffStarting = false; // 수동 이륙 플래그
        this.isManualLanding = false;   // 수동 착륙 플래그
        this.maneuverFrameCount = 0;    // 활주 시작 프레임 카운터
        this.takeoffDistance = 0;       // 활주 거리 누적
        this.isBombingActive = false;   // 폭격 모드 활성화 여부
        this.popCost = 6;

        this.ammoType = 'shell';
        this.maxAmmo = 12;
        this.ammo = 12;
    }

    // 스킬 설정 정보 제공
    getSkillConfig(cmd) {
        const skills = {
            'bombing': { type: 'toggle', handler: this.toggleBombing },
            'takeoff_landing': { type: 'state', handler: this.toggleTakeoff }
        };
        return skills[cmd];
    }

    toggleBombing() {
        this.isBombingActive = !this.isBombingActive;
    }

    toggleTakeoff() {
        if (this.altitude < 0.1) {
            // 지상이면 이륙 프로세스 시작
            this.isTakeoffStarting = true;
            this.isManualLanding = false;
            this.maneuverFrameCount = 0;
            this.takeoffDistance = 0;
            this.speed = 0.5; // 이륙 시작 시 속도 초기화
            this.command = 'move';
            this.destination = null;
        } else {
            // 공중이면 착륙 프로세스 시작
            this.isManualLanding = true;
            this.isTakeoffStarting = false;
            this.maneuverFrameCount = 0;
            this.command = 'move';
            this.destination = null;
        }
    }

    update(deltaTime) {
        const movedDist = Math.hypot(this.x - this.lastX, this.y - this.lastY);
        this.lastX = this.x;
        this.lastY = this.y;

        // 0. 속도 관리 로직 (이륙 가속 및 공중 고속 비행)
        if (this.isTakeoffStarting) {
            if (this.altitude <= 0) {
                // 1) 활주 중 가속: 0.5에서 baseSpeed까지 (활주 거리 300px 기준)
                const takeoffProgress = Math.min(1.0, this.takeoffDistance / 300);
                this.speed = 0.5 + (this.baseSpeed - 0.5) * takeoffProgress;
            } else {
                // 2) 이륙 상승 중 가속: baseSpeed에서 airSpeed까지 (고도 기준)
                this.speed = this.baseSpeed + (this.airSpeed - this.baseSpeed) * this.altitude;
            }
        } else if (this.isManualLanding) {
            // 3) 착륙 시 감속: 고도에 따라 airSpeed에서 baseSpeed까지
            this.speed = this.baseSpeed + (this.airSpeed - this.baseSpeed) * this.altitude;
        } else if (this.altitude > 0) {
            // 4) 일반 비행 중: 고도에 따른 속도 유지
            this.speed = this.baseSpeed + (this.airSpeed - this.baseSpeed) * this.altitude;
        } else {
            // 5) 지상 대기/이동 중
            this.speed = this.baseSpeed;
        }

        // 1. 도메인 판정
        this.domain = (this.altitude > 0.8) ? 'air' : 'ground';

        // 2. 폭격 자동 투하 로직 (폭격 모드가 켜져 있고 충분한 고도일 때만 투하)
        if (this.isBombingActive && this.altitude > 0.8) {
            this.bombTimer += deltaTime;
            if (this.bombTimer >= this.bombInterval) {
                // 탄약 체크
                if (this.ammo > 0) {
                    this.bombTimer = 0;
                    this.ammo--; // 포탄 1발 소모
                    const bomb = new FallingBomb(this.x, this.y, this.engine, 300, this);
                    this.engine.entities.projectiles.push(bomb);
                } else {
                    // 탄약 고갈 시 폭격 중단 및 알림
                    this.isBombingActive = false;
                    if (this.engine.addEffect) {
                        this.engine.addEffect('system', this.x, this.y - 40, '#ff3131', '포탄 고갈! 폭격 중단');
                    }
                }
            }
        }

        // 3. 자동 전진 로직 (이륙 또는 착륙 활주 중일 때)
        if (this.isTakeoffStarting || this.isManualLanding) {
            this.maneuverFrameCount++;

            // 다음 전진 지점 계산 및 지형 충돌 체크
            const nextX = this.x + Math.cos(this.angle) * this.speed;
            const nextY = this.y + Math.sin(this.angle) * this.speed;
            const grid = this.engine.tileMap.worldToGrid(nextX, nextY);
            const tile = this.engine.tileMap.grid[grid.y]?.[grid.x];

            // 고도가 낮을 때만 지상 장애물에 막힘 (충돌 판정)
            const isBlocked = (this.altitude < 0.7) && (tile && (tile.occupied || !tile.buildable));

            if (!isBlocked) {
                this.x = nextX;
                this.y = nextY;
            }

            // 실제로 움직이고 있는지 확인 (장애물 체크 - 판정 기준)
            const isMoving = this.maneuverFrameCount < 15 || movedDist > this.speed * 0.25;

            if (this.isTakeoffStarting) {
                if (isMoving) {
                    this.takeoffDistance += Math.max(movedDist, this.speed * 0.5);
                    // 최소 300px 활주 후 상승 시작
                    if (this.takeoffDistance > 300) {
                        this.altitude = Math.min(1.0, this.altitude + 0.015);
                    }
                    if (this.altitude >= 1.0) {
                        this.isTakeoffStarting = false;
                        this.command = 'stop';
                    }
                } else {
                    // 장애물에 막혀 속도가 떨어지면 즉시 이륙 취소
                    if (this.altitude < 0.8) {
                        this.isTakeoffStarting = false;
                        this.altitude = 0;
                        this.command = 'stop';
                    }
                }
            } else if (this.isManualLanding) {
                // 발밑 지형 확인
                const grid = this.engine.tileMap.worldToGrid(this.x, this.y);
                const tile = this.engine.tileMap.grid[grid.y]?.[grid.x];
                const isGroundClear = tile && !tile.occupied && tile.buildable;

                if (isMoving) {
                    if (isGroundClear) {
                        // 하강 속도를 절반으로 줄여 착륙 거리를 2배로 연장 (0.015 -> 0.0075)
                        this.altitude = Math.max(0, this.altitude - 0.0075);
                        if (this.altitude <= 0) {
                            this.isManualLanding = false;
                            this.command = 'stop';
                        }
                    } else {
                        // 장애물 위라면 더 천천히 하강하며 평지 탐색
                        this.altitude = Math.max(0.15, this.altitude - 0.005);
                    }
                } else {
                    // 착륙 중 충돌 시 즉시 정지
                    this.isManualLanding = false;
                    this.altitude = 0;
                    this.command = 'stop';
                }
            }
            return;
        }

        super.update(deltaTime);

        // 4. 목적지 지형 확인 (일반 이동 시)
        if (this.destination) {
            const grid = this.engine.tileMap.worldToGrid(this.destination.x, this.destination.y);
            const tile = this.engine.tileMap.grid[grid.y]?.[grid.x];
            this.isLandingZoneSafe = tile && !tile.occupied && tile.buildable;
        }

        // 5. 고도 보정 (수동 조작 중이 아닐 때)
        if (this.altitude > 0 && this.altitude < 1.0) {
            if (this.altitude > 0.5) this.altitude = Math.min(1.0, this.altitude + 0.01);
            else this.altitude = Math.max(0, this.altitude - 0.01);
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // 시각 효과 계산
        const shadowMaxOffset = 15;
        const shadowOffset = shadowMaxOffset * this.altitude;

        // 이륙 시 활주 시작부터 엔진 가동 연출
        const isEnginesRunning = this.altitude > 0 || (this.command === 'move' && this.isLandingZoneSafe);
        const propSpeedFactor = isEnginesRunning ? Math.max(0.2, this.altitude) : 0;
        const propAngle = propSpeedFactor > 0 ? (Date.now() / (60 / propSpeedFactor)) % (Math.PI * 2) : 0;

        // 0. 그림자
        ctx.save();
        ctx.translate(-shadowOffset, shadowOffset);
        ctx.globalAlpha = 0.1 + (1.0 - this.altitude) * 0.2;
        ctx.fillStyle = '#000';
        // 날개 그림자
        ctx.beginPath();
        ctx.moveTo(15, 0); ctx.lineTo(-20, -75); ctx.lineTo(-35, -75);
        ctx.lineTo(-10, 0); ctx.lineTo(-35, 75); ctx.lineTo(-20, 75);
        ctx.closePath(); ctx.fill();
        // 동체 그림자
        ctx.beginPath();
        ctx.moveTo(60, 0); ctx.bezierCurveTo(60, -14, 50, -16, 40, -16);
        ctx.lineTo(-55, -12); ctx.lineTo(-65, 0); ctx.lineTo(-55, 12);
        ctx.lineTo(40, 16); ctx.bezierCurveTo(50, 16, 60, 14, 60, 0);
        ctx.fill();
        ctx.restore();

        // 1. 주익
        const wingColor = '#2c3e50';
        ctx.fillStyle = wingColor;
        ctx.beginPath();
        ctx.moveTo(15, 0); ctx.lineTo(-20, -75); ctx.lineTo(-35, -75);
        ctx.lineTo(-10, 0); ctx.lineTo(-35, 75); ctx.lineTo(-20, 75);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 1.5; ctx.stroke();

        // 2. 엔진 & 프로펠러
        const engineOffsets = [-28, -52, 28, 52];
        engineOffsets.forEach(offset => {
            ctx.save();
            ctx.translate(-8, offset);
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(-10, -6, 26, 12);
            ctx.strokeStyle = '#000'; ctx.strokeRect(-10, -6, 26, 12);
            ctx.fillStyle = '#bdc3c7';
            ctx.beginPath(); ctx.arc(16, 0, 3.5, 0, Math.PI * 2); ctx.fill();

            ctx.save();
            ctx.translate(16, 0);
            ctx.rotate(propAngle);
            ctx.fillStyle = '#0a0a0a';
            for (let i = 0; i < 4; i++) {
                ctx.rotate(Math.PI / 2);
                ctx.beginPath(); ctx.ellipse(0, 9, 2.5, 11, 0, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
            ctx.restore();
        });

        // 3. 동체
        const bodyGrd = ctx.createLinearGradient(0, -15, 0, 15);
        bodyGrd.addColorStop(0, '#34495e'); bodyGrd.addColorStop(0.5, '#2c3e50'); bodyGrd.addColorStop(1, '#1c2833');
        ctx.fillStyle = bodyGrd;
        ctx.beginPath();
        ctx.moveTo(60, 0); ctx.bezierCurveTo(60, -14, 50, -16, 40, -16);
        ctx.lineTo(-55, -12); ctx.lineTo(-65, 0); ctx.lineTo(-55, 12);
        ctx.lineTo(40, 16); ctx.bezierCurveTo(50, 16, 60, 14, 60, 0);
        ctx.fill(); ctx.stroke();

        // 4. 조종석
        ctx.fillStyle = 'rgba(0, 150, 255, 0.4)';
        ctx.beginPath();
        ctx.moveTo(48, -6); ctx.bezierCurveTo(52, -5, 52, 5, 48, 6);
        ctx.lineTo(42, 5); ctx.lineTo(42, -6);
        ctx.closePath(); ctx.fill();

        // 5. 꼬리 날개
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.moveTo(-45, 0); ctx.lineTo(-65, -30); ctx.lineTo(-75, -30);
        ctx.lineTo(-60, 0); ctx.lineTo(-75, 30); ctx.lineTo(-65, 30);
        ctx.closePath(); ctx.fill(); ctx.stroke();

        if (this.command === 'bombing') {
            const blink = Math.sin(Date.now() / 150) > 0;
            if (blink) {
                ctx.fillStyle = 'rgba(255, 0, 0, 0.6)';
                ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#000'; ctx.fillRect(-20, -6, 40, 12);
            }
        }
        ctx.restore();

        // HP 바
        const barW = 100;
        const barY = this.y - 70;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - barW / 2, barY, barW, 6);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW / 2, barY, (this.hp / this.maxHp) * barW, 6);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(this.x - barW / 2, barY, barW, 6);
    }
}

export class CargoPlane extends PlayerUnit {
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'cargo-plane';
        this.name = '전략 수송기';
        this.domain = 'ground'; // 지상 시작
        this.baseSpeed = 0.8;   // 지상 이동/활주 속도 (하향)
        this.airSpeed = 2.2;    // 공중 비행 속도 (반으로 하향)
        this.speed = 0.3;       // 초기 속도 (하향)
        this.hp = 1500;
        this.maxHp = 1500;
        this.size = 110;
        this.width = 130;
        this.height = 140;

        // 이착륙 시스템 (폭격기와 동일)
        this.altitude = 0.0; // 지상 시작
        this.isLandingZoneSafe = false;
        this.lastX = x;
        this.lastY = y;

        this.isTakeoffStarting = false;
        this.isManualLanding = false;
        this.maneuverFrameCount = 0;
        this.takeoffDistance = 0;

        // --- 수송 시스템 설정 ---
        this.cargo = [];
        this.cargoCapacity = 20; // 최대 부피 20
        this.cargoSize = 99; // 수송기 탑승 불가
        this.isUnloading = false;
        this.unloadTimer = 0;
        this.unloadInterval = 300;
        this.popCost = 4;
    }

    // 현재 적재된 총 부피 계산
    getOccupiedSize() {
        return this.cargo.reduce((sum, unit) => sum + (unit.cargoSize || 1), 0);
    }

    // 스킬 설정 정보 제공
    getSkillConfig(cmd) {
        const skills = {
            'takeoff_landing': { type: 'state', handler: this.toggleTakeoff },
            'unload_all': { type: 'instant', handler: this.startUnloading },
            'combat_drop': { type: 'instant', handler: this.startCombatDrop }
        };
        return skills[cmd];
    }

    // 유닛 탑승 처리
    loadUnit(unit) {
        if (this.isUnloading) return false;
        const uSize = unit.cargoSize || 1;
        if (this.getOccupiedSize() + uSize > this.cargoCapacity) return false;
        if (this.altitude > 0.1) return false;

        // 탑승 상태 설정
        unit.isBoarded = true;
        unit.command = 'stop';
        unit.destination = null;
        unit.path = [];

        // --- 유닛별 특수 상태 초기화 (미사일 발사대 등) ---
        if (unit.type === 'missile-launcher') {
            unit.isSieged = false;
            unit.isTransitioning = false;
            unit.isFiring = false;
            unit.speed = unit.baseSpeed || 1.4;
            unit.raiseAngle = 0;
        }

        this.cargo.push(unit);

        // 선택 해제
        if (this.engine.selectedEntities) {
            this.engine.selectedEntities = this.engine.selectedEntities.filter(e => e !== unit);
        }
        if (this.engine.selectedEntity === unit) this.engine.selectedEntity = null;

        // 시각 효과
        this.engine.addEffect?.('system', this.x, this.y - 20, '#ffff00', '유닛 탑승');

        // UI 즉시 갱신 (하차 버튼 활성화 등)
        if (this.engine.updateBuildMenu) {
            this.engine.updateBuildMenu();
        }

        return true;
    }

    // 하차 시작
    startUnloading() {
        if (this.altitude > 0.1 || this.cargo.length === 0) return;
        this.isUnloading = true;
        this.unloadTimer = 0;
    }

    // 순차적 하차 처리 (update에서 호출)
    processUnloading(deltaTime) {
        if (!this.isUnloading || this.cargo.length === 0) {
            this.isUnloading = false;
            return;
        }

        this.unloadTimer += deltaTime;
        if (this.unloadTimer >= this.unloadInterval) {
            this.unloadTimer = 0;
            const unit = this.cargo.shift();

            // 수송기 뒤쪽 위치 계산
            const rearDist = 80;
            const rearX = this.x + Math.cos(this.angle + Math.PI) * rearDist;
            const rearY = this.y + Math.sin(this.angle + Math.PI) * rearDist;

            unit.isBoarded = false;
            unit.active = true;
            unit.x = rearX;
            unit.y = rearY;
            unit.angle = this.angle + Math.PI; // 반대 방향 바라보기

            // 하차 후 약간 전진 시키기
            const exitDestX = rearX + Math.cos(this.angle + Math.PI) * 60;
            const exitDestY = rearY + Math.sin(this.angle + Math.PI) * 60;
            unit.destination = { x: exitDestX, y: exitDestY };

            // this.engine.entities.units.push(unit); // 제거: 이미 리스트에 있음

            if (this.cargo.length === 0) this.isUnloading = false;
        }
    }

    startCombatDrop() {
        if (this.altitude < 0.8) {
            this.engine.addEffect?.('system', this.x, this.y, '#ff3131', '고도가 너무 낮습니다!');
            return;
        }
        if (this.cargo.length === 0) {
            this.engine.addEffect?.('system', this.x, this.y, '#ff3131', '탑승한 유닛이 없습니다.');
            return;
        }
        if (this.engine.resources.gold < 100) {
            this.engine.addEffect?.('system', this.x, this.y, '#ff3131', '골드가 부족합니다 (100G)');
            return;
        }

        this.engine.resources.gold -= 100;
        this.isCombatDropping = true;
        this.dropTimer = 0;
        this.engine.addEffect?.('system', this.x, this.y, '#fff', '전투 강하 개시!');
    }

    processCombatDrop(deltaTime) {
        if (!this.isCombatDropping || this.cargo.length === 0) {
            this.isCombatDropping = false;
            return;
        }

        this.dropTimer += deltaTime;
        if (this.dropTimer >= 1200) { // 1.2초 간격으로 상향 (더 넓게 투하)
            this.dropTimer = 0;

            // 투하 위치 확인
            const grid = this.engine.tileMap.worldToGrid(this.x, this.y);
            const tile = this.engine.tileMap.grid[grid.y]?.[grid.x];

            // 장애물이 있으면 스킵 (다음 이동 위치에서 재시도)
            if (tile && (tile.occupied || !tile.buildable)) {
                return;
            }

            const unit = this.cargo.shift();
            unit.isBoarded = false; // 탑승 해제
            unit.active = true;
            unit.x = this.x;
            unit.y = this.y;
            unit.domain = 'air'; // 낙하 중 공중 판정
            unit.isFalling = true;
            unit.fallTimer = 0;
            unit.fallDuration = 2000; // 2초간 낙하
            unit.destination = null;
            unit.command = 'stop';

            // this.engine.entities.units.push(unit); // 제거: 이미 리스트에 있음
            this.engine.addEffect?.('system', this.x, this.y, '#fff', 'Drop!');

            if (this.cargo.length === 0) {
                this.isCombatDropping = false;
                this.engine.addEffect?.('system', this.x, this.y, '#fff', '강하 완료');
            }
        }
    }

    toggleTakeoff() {
        if (this.altitude < 0.1) {
            this.isTakeoffStarting = true;
            this.isManualLanding = false;
            this.maneuverFrameCount = 0;
            this.takeoffDistance = 0;
            this.speed = 0.5;
            this.command = 'move';
            this.destination = null;
        } else {
            this.isManualLanding = true;
            this.isTakeoffStarting = false;
            this.maneuverFrameCount = 0;
            this.command = 'move';
            this.destination = null;
        }
    }

    update(deltaTime) {
        const movedDist = Math.hypot(this.x - this.lastX, this.y - this.lastY);
        this.lastX = this.x;
        this.lastY = this.y;

        // 하차 로직 처리
        if (this.isUnloading) {
            this.processUnloading(deltaTime);
        }

        // 전투 강하 로직
        if (this.isCombatDropping) {
            this.processCombatDrop(deltaTime);
        }

        // 0. 속도 관리 로직
        if (this.isTakeoffStarting) {
            if (this.altitude <= 0) {
                const takeoffProgress = Math.min(1.0, this.takeoffDistance / 350); // 수송기는 더 긴 활주 거리 필요
                this.speed = 0.3 + (this.baseSpeed - 0.3) * takeoffProgress;
            } else {
                this.speed = this.baseSpeed + (this.airSpeed - this.baseSpeed) * this.altitude;
            }
        } else if (this.isManualLanding) {
            this.speed = this.baseSpeed + (this.airSpeed - this.baseSpeed) * this.altitude;
        } else if (this.altitude > 0) {
            this.speed = this.baseSpeed + (this.airSpeed - this.baseSpeed) * this.altitude;
        } else {
            this.speed = this.baseSpeed;
        }

        // 1. 도메인 판정
        this.domain = (this.altitude > 0.8) ? 'air' : 'ground';

        // 2. 자동 전진 로직 (이륙 또는 착륙 활주 중일 때)
        if (this.isTakeoffStarting || this.isManualLanding) {
            this.maneuverFrameCount++;

            const nextX = this.x + Math.cos(this.angle) * this.speed;
            const nextY = this.y + Math.sin(this.angle) * this.speed;
            const grid = this.engine.tileMap.worldToGrid(nextX, nextY);
            const tile = this.engine.tileMap.grid[grid.y]?.[grid.x];

            const isBlocked = (this.altitude < 0.7) && (tile && (tile.occupied || !tile.buildable));

            if (!isBlocked) {
                this.x = nextX;
                this.y = nextY;
            }

            const isMoving = this.maneuverFrameCount < 15 || movedDist > this.speed * 0.25;

            if (this.isTakeoffStarting) {
                if (isMoving) {
                    this.takeoffDistance += Math.max(movedDist, this.speed * 0.5);
                    if (this.takeoffDistance > 350) {
                        this.altitude = Math.min(1.0, this.altitude + 0.012); // 수송기는 약간 더 천천히 상승
                    }
                    if (this.altitude >= 1.0) {
                        this.isTakeoffStarting = false;
                        this.command = 'stop';
                    }
                } else {
                    if (this.altitude < 0.8) {
                        this.isTakeoffStarting = false;
                        this.altitude = 0;
                        this.command = 'stop';
                    }
                }
            } else if (this.isManualLanding) {
                const grid = this.engine.tileMap.worldToGrid(this.x, this.y);
                const tile = this.engine.tileMap.grid[grid.y]?.[grid.x];
                const isGroundClear = tile && !tile.occupied && tile.buildable;

                if (isMoving) {
                    if (isGroundClear) {
                        this.altitude = Math.max(0, this.altitude - 0.006); // 더 완만하게 착륙
                        if (this.altitude <= 0) {
                            this.isManualLanding = false;
                            this.command = 'stop';
                        }
                    } else {
                        this.altitude = Math.max(0.15, this.altitude - 0.004);
                    }
                } else {
                    this.isManualLanding = false;
                    this.altitude = 0;
                    this.command = 'stop';
                }
            }
            return;
        }

        super.update(deltaTime);

        // 3. 고도 보정 (수동 조작 중이 아닐 때)
        if (this.altitude > 0 && this.altitude < 1.0) {
            if (this.altitude > 0.5) this.altitude = Math.min(1.0, this.altitude + 0.01);
            else this.altitude = Math.max(0, this.altitude - 0.01);
        }
    }

    draw(ctx) {
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        const time = Date.now();
        const shadowOffset = 22 * this.altitude;

        // 0. 그림자 (더 부드럽게)
        ctx.save();
        ctx.translate(-shadowOffset, shadowOffset);
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.moveTo(10, 0); ctx.lineTo(-45, -115); ctx.lineTo(-75, -115);
        ctx.lineTo(-35, 0); ctx.lineTo(-75, 115); ctx.lineTo(-45, 115);
        ctx.closePath(); ctx.fill();
        ctx.fillRect(-90, -22, 170, 44);
        ctx.restore();

        // 1. 고익기 주익 (Wing Structure with Control Surfaces)
        const drawWing = () => {
            const wingGrd = ctx.createLinearGradient(0, -115, 0, 115);
            wingGrd.addColorStop(0, '#7f8c8d');
            wingGrd.addColorStop(0.5, '#bdc3c7');
            wingGrd.addColorStop(1, '#7f8c8d');
            ctx.fillStyle = wingGrd;
            ctx.beginPath();
            ctx.moveTo(12, 0);
            ctx.lineTo(-38, -115); ctx.lineTo(-72, -115); // 좌측 날개
            ctx.lineTo(-28, 0);
            ctx.lineTo(-72, 115); ctx.lineTo(-38, 115);  // 우측 날개
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#2c3e50';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            // 플랩 & 에일러론 라인 (날개 가동면)
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath();
            ctx.moveTo(-25, -50); ctx.lineTo(-55, -50);
            ctx.moveTo(-25, 50); ctx.lineTo(-55, 50);
            ctx.stroke();
        };
        drawWing();

        // 2. 4발 정밀 제트 엔진 (Engine Nacelles with Exhaust)
        const engineOffsets = [-88, -52, 52, 88];
        engineOffsets.forEach(offset => {
            ctx.save();
            const wingX = -12 - Math.abs(offset) * 0.22;
            ctx.translate(wingX, offset);

            // 배기구 그을린 금속 (Exhaust Cone)
            ctx.fillStyle = '#1c2833';
            ctx.fillRect(-12, -6, 15, 12);

            // 엔진 본체
            const engGrd = ctx.createLinearGradient(0, -9, 0, 9);
            engGrd.addColorStop(0, '#34495e'); engGrd.addColorStop(0.5, '#5d6d7e'); engGrd.addColorStop(1, '#2c3e50');
            ctx.fillStyle = engGrd;
            ctx.fillRect(-6, -9, 28, 18);
            ctx.strokeRect(-6, -9, 28, 18);

            // 공기 흡입구 및 내부 팬 블레이드 실루엣
            ctx.fillStyle = '#0a0a0a';
            ctx.beginPath(); ctx.ellipse(22, 0, 5, 8, 0, 0, Math.PI * 2); ctx.fill();

            // 엔진 가동 시 팬 블레이드 회전 효과 (이륙/비행 중일 때만)
            const isEnginesRunning = this.altitude > 0 || this.isTakeoffStarting || (this.command === 'move' && this.destination);
            if (isEnginesRunning) {
                ctx.strokeStyle = '#2c3e50';
                for (let i = 0; i < 4; i++) {
                    ctx.beginPath(); ctx.moveTo(22, 0);
                    ctx.lineTo(22 + Math.cos(time / 100 + i * Math.PI / 2) * 3, Math.sin(time / 100 + i * Math.PI / 2) * 5);
                    ctx.stroke();
                }
            }
            ctx.restore();
        });

        // 3. 거대 중량 동체 (Heavy-Lift Fuselage)
        const bodyGrd = ctx.createLinearGradient(0, -25, 0, 25);
        bodyGrd.addColorStop(0, '#7f8c8d');
        bodyGrd.addColorStop(0.2, '#bdc3c7');
        bodyGrd.addColorStop(0.5, '#ecf0f1');
        bodyGrd.addColorStop(0.8, '#bdc3c7');
        bodyGrd.addColorStop(1, '#7f8c8d');
        ctx.fillStyle = bodyGrd;

        ctx.beginPath();
        ctx.moveTo(85, 0); // 더 길어진 기수
        ctx.bezierCurveTo(85, -24, 65, -26, 45, -26);
        ctx.lineTo(-65, -26);
        ctx.bezierCurveTo(-100, -26, -100, 26, -65, 26);
        ctx.lineTo(45, 26);
        ctx.bezierCurveTo(65, 26, 85, 24, 85, 0);
        ctx.fill();
        ctx.stroke();

        // 기수 레이돔 (Radome) 라인
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath(); ctx.arc(65, 0, 24, -Math.PI / 2, Math.PI / 2); ctx.stroke();

        // 공중 급유 프로브 (Refueling Probe - 기수 오른쪽)
        ctx.fillStyle = '#7f8c8d';
        ctx.fillRect(60, -18, 20, 3);
        ctx.strokeRect(60, -18, 20, 3);

        // 랜딩 기어 벌지 & 패널 디테일
        ctx.fillStyle = '#95a5a6';
        ctx.fillRect(-25, -29, 60, 5);
        ctx.fillRect(-25, 24, 60, 5);
        ctx.strokeRect(-25, -29, 60, 5);
        ctx.strokeRect(-25, 24, 60, 5);

        // 4. 조종석 및 관측창
        ctx.fillStyle = '#0a192f';
        ctx.beginPath();
        ctx.moveTo(68, -11); ctx.bezierCurveTo(74, -9, 74, 9, 68, 11);
        ctx.lineTo(55, 10); ctx.lineTo(55, -10); ctx.closePath();
        ctx.fill();
        // 동체 측면 작은 창문들
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        for (let i = 0; i < 3; i++) ctx.fillRect(10 - i * 25, -22, 4, 3);

        // 5. T-Tail Complex
        // 수직 미익 기둥 (패널 라인 포함)
        ctx.fillStyle = '#bdc3c7';
        ctx.fillRect(-92, -4, 35, 8);
        ctx.strokeRect(-92, -4, 35, 8);

        // 상부 수평 미익 (High Mounted Elevators)
        ctx.save();
        ctx.translate(-92, 0);
        ctx.fillStyle = '#95a5a6';
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(-18, -48); ctx.lineTo(-32, -48);
        ctx.lineTo(-22, 0); ctx.lineTo(-32, 48); ctx.lineTo(-18, 48);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // 꼬리 끝단 정비창 디테일
        ctx.fillStyle = '#7f8c8d';
        ctx.fillRect(-15, -2, 10, 4);
        ctx.restore();

        // 6. 후면 카고 램프 (Cargo Ramp) 라인
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.moveTo(-60, -26); ctx.lineTo(-95, 0); ctx.lineTo(-60, 26);
        ctx.stroke();

        // 항공 등화 (강화됨)
        const blink = Math.sin(time / 450) > 0;
        ctx.shadowBlur = blink ? 5 : 0;
        ctx.shadowColor = '#ff0000';
        ctx.fillStyle = blink ? '#ff3131' : '#440000';
        ctx.beginPath(); ctx.arc(-45, -115, 4, 0, Math.PI * 2); ctx.fill(); // Left Wing
        ctx.beginPath(); ctx.arc(-45, 115, 4, 0, Math.PI * 2); ctx.fill();  // Right Wing
        ctx.beginPath(); ctx.arc(-118, 0, 4, 0, Math.PI * 2); ctx.fill();   // Tail Tip
        ctx.shadowBlur = 0;

        // --- 적재량 상세 표시 (선택 시에만) ---
        if (this.engine.selectedEntities.includes(this) && (this.cargo.length > 0)) {
            ctx.save();
            ctx.rotate(-this.angle); // 텍스트 수평 유지

            const counts = {};
            this.cargo.forEach(u => {
                const name = u.name || u.type;
                counts[name] = (counts[name] || 0) + 1;
            });

            // 목록 생성 및 상단에 총 용량 추가
            const occupied = this.getOccupiedSize ? this.getOccupiedSize() : this.cargo.length;
            const entries = [
                `적재 용량: ${occupied} / ${this.cargoCapacity}`,
                ...Object.entries(counts).map(([name, count]) => `${name} x ${count}`)
            ];

            const lineHeight = 20;
            const padding = 10;

            ctx.font = 'bold 14px "Segoe UI", Arial';
            let maxWidth = 0;
            entries.forEach(text => {
                maxWidth = Math.max(maxWidth, ctx.measureText(text).width);
            });

            const boxWidth = maxWidth + padding * 2;
            const boxHeight = entries.length * lineHeight + padding;
            const boxY = -80 - boxHeight; // 위치를 조금 더 위로

            // 메인 샴퍼 배경
            ctx.fillStyle = 'rgba(10, 20, 30, 0.85)';
            ctx.beginPath();
            ctx.roundRect(-boxWidth / 2, boxY, boxWidth, boxHeight, 6);
            ctx.fill();

            // 상단 하이라이트 테두리
            ctx.strokeStyle = 'rgba(0, 210, 255, 0.5)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // 텍스트 출력
            ctx.textAlign = 'center';
            entries.forEach((text, i) => {
                // 첫 번째 줄(용량)은 노란색 강조, 나머지는 밝은 흰색/시안
                if (i === 0) {
                    ctx.fillStyle = '#f1c40f';
                    ctx.font = 'bold 14px "Segoe UI", Arial';
                } else {
                    ctx.fillStyle = '#ecf0f1';
                    ctx.font = '13px "Segoe UI", Arial';
                }
                ctx.fillText(text, 0, boxY + padding + 14 + i * lineHeight);
            });
            ctx.restore();
        }

        ctx.restore();

        // HP 바 상시 표시 (수송기 크기에 맞춰 확장)
        const barW = 110;
        const barY = this.y - 85;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - barW / 2, barY, barW, 6);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW / 2, barY, (this.hp / this.maxHp) * barW, 6);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x - barW / 2, barY, barW, 6);
    }
}
