import { PlayerUnit } from './BaseUnit.js';
import { FallingBomb } from '../projectiles/Bomb.js';

export class ScoutPlane extends PlayerUnit {
    static editorConfig = { category: 'unit', icon: 'scout-plane', name: '정찰기' };
    constructor(x, y, engine) {
        super(x, y, engine);
        this.init(x, y, engine);
    }

    init(x, y, engine) {
        super.init(x, y, engine);
        this.type = 'scout-plane';
        this.name = '고등 정찰 무인기';
        this.domain = 'air';
        this.speed = 4.5;    
        this.visionRange = 18; 
        this.hp = 250;       
        this.maxHp = 250;
        this.population = 2; // 조종사 + 관측수 (현실적 운용 인원)
        this.size = 80;      
        this.cargoSize = 99; 
    }

    getSelectionBounds() {
        const bounds = super.getSelectionBounds();
        const offset = (this.altitude || 1.0) * 8; // draw에서 사용하는 부상 높이 (8)
        return {
            left: bounds.left,
            right: bounds.right,
            top: bounds.top - offset,
            bottom: bounds.bottom - offset
        };
    }

    draw(ctx) {
        if (this.isUnderConstruction) {
            this.drawConstruction(ctx);
            return;
        }
        
        const alt = this.altitude || 1.0; // 기본은 비행 중
        const shadowOffset = alt * 8; // 오프셋 대폭 축소 (15 -> 8)
        const shadowScale = 1 + alt * 0.1; 

        // 0. 그림자 (더 연하게 조정)
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
        ctx.translate(shadowOffset, shadowOffset);
        ctx.scale(shadowScale, shadowScale);
        this.drawPlaneShape(ctx, true);
        ctx.restore();

        // 1. 기체 본체 (고도에 따라 아주 약간만 부상)
        ctx.save();
        ctx.translate(0, -alt * 8); // 부상 높이 대폭 축소 (15 -> 8)
        this.drawPlaneShape(ctx, false);
        ctx.restore();
    }

    drawPlaneShape(ctx, isShadow) {
        // 1. 주익 (Wings)
        ctx.fillStyle = isShadow ? 'transparent' : '#bdc3c7';
        if (isShadow) ctx.fillStyle = 'rgba(0,0,0,1)';
        
        ctx.beginPath();
        ctx.moveTo(10, 0); 
        ctx.lineTo(-18, -48); ctx.lineTo(-28, -48);
        ctx.lineTo(-15, 0);
        ctx.lineTo(-28, 48); ctx.lineTo(-18, 48);
        ctx.closePath();
        ctx.fill();

        // 2. 동체 (Main Body)
        if (!isShadow) ctx.fillStyle = '#ecf0f1';
        ctx.beginPath();
        ctx.moveTo(40, 0);
        ctx.bezierCurveTo(30, -12, 10, -10, -25, -6);
        ctx.lineTo(-25, 6);
        ctx.bezierCurveTo(10, 10, 30, 12, 40, 0);
        ctx.fill();
    }
}

export class Bomber extends PlayerUnit {
    static editorConfig = { category: 'unit', icon: 'bomber', name: '폭격기' };
    constructor(x, y, engine) {
        super(x, y, engine);
        this.init(x, y, engine);
    }

    init(x, y, engine) {
        super.init(x, y, engine);
        this.type = 'bomber';
        this.name = '전략 폭격기';
        this.domain = 'ground'; 
        this.baseSpeed = 2.2;
        this.airSpeed = 5.0;   
        this.speed = 0.5;      
        this.visionRange = 12;
        this.hp = 1200;
        this.maxHp = 1200;
        this.population = 4; // 조종사, 부조종사, 항법사, 폭격수
        this.size = 130; 
        this.damage = 0;
        this.attackTargets = ['ground', 'sea'];
        this.cargoSize = 99; 

        this.bombTimer = 0;
        this.bombInterval = 500;

        this.altitude = 0.0; 
        this.isLandingZoneSafe = false;
        this.lastX = x;
        this.lastY = y;

        this.isTakeoffStarting = false; 
        this.isManualLanding = false;   
        this.maneuverFrameCount = 0;    
        this.takeoffDistance = 0;       
        this.isBombingActive = false;   

        this.ammoType = 'shell';
        this.maxAmmo = 12;
        this.ammo = 12;
    }

    getSelectionBounds() {
        const bounds = super.getSelectionBounds();
        const offset = (this.altitude || 0) * 12; // draw에서 사용하는 부상 높이 (12)
        return {
            left: bounds.left,
            right: bounds.right,
            top: bounds.top - offset,
            bottom: bounds.bottom - offset
        };
    }

    // 스킬 설정 정보 제공
    getSkillConfig(cmd) {
        const skills = {
            'bombing': { type: 'toggle', handler: this.toggleBombing },
            'takeoff_landing': { type: 'state', handler: this.toggleTakeoff }
        };
        return skills[cmd];
    }

    getCacheKey() {
        // 이착륙 조작 중이거나 폭격 중일 때는 실시간 렌더링
        if (this.isTakeoffStarting || this.isManualLanding || this.isBombingActive) return null;
        // 고도에 따라 다른 캐시 이미지 사용 (지상 vs 공중)
        const state = (this.altitude > 0.8) ? 'air' : 'ground';
        return `${this.type}-${state}`;
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
        const alt = this.altitude || 0;
        const shadowOffset = alt * 10; // 오프셋 대폭 축소 (20 -> 10)
        const shadowScale = 1 + alt * 0.1; 

        // 0. 그림자 (연하고 자연스럽게)
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
        ctx.translate(shadowOffset, shadowOffset);
        ctx.scale(shadowScale, shadowScale);
        this.drawBomberShape(ctx, true);
        ctx.restore();

        // 1. 기체 본체
        ctx.save();
        ctx.translate(0, -alt * 12); // 부상 높이 대폭 축소 (25 -> 12)
        this.drawBomberShape(ctx, false);
        ctx.restore();
    }



    drawBomberShape(ctx, isShadow) {
        // 1. 주익
        ctx.fillStyle = isShadow ? 'rgba(0,0,0,1)' : '#2c3e50';
        ctx.beginPath();
        ctx.moveTo(15, 0); ctx.lineTo(-20, -75); ctx.lineTo(-35, -75);
        ctx.lineTo(-10, 0); ctx.lineTo(-35, 75); ctx.lineTo(-20, 75);
        ctx.closePath(); ctx.fill();

        // 2. 엔진
        const engineOffsets = [-28, -52, 28, 52];
        engineOffsets.forEach(offset => {
            if (!isShadow) ctx.fillStyle = '#2c3e50';
            ctx.fillRect(-18, offset - 6, 26, 12);
            
            // 비행 중일 때만 엔진 화염 효과
            if (!isShadow && this.altitude > 0.1) {
                const pulse = 1 + Math.random() * 0.5;
                ctx.fillStyle = '#ff8c00';
                ctx.fillRect(-22, offset - 3, 6 * pulse, 6);
            }
        });

        // 3. 동체
        if (!isShadow) ctx.fillStyle = '#34495e';
        ctx.beginPath();
        ctx.moveTo(60, 0); ctx.bezierCurveTo(60, -14, 50, -16, 40, -16);
        ctx.lineTo(-55, -12); ctx.lineTo(-65, 0); ctx.lineTo(-55, 12);
        ctx.lineTo(40, 16); ctx.bezierCurveTo(50, 16, 60, 14, 60, 0);
        ctx.fill();

        // 4. 꼬리 날개
        if (!isShadow) ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.moveTo(-45, 0); ctx.lineTo(-65, -30); ctx.lineTo(-75, -30);
        ctx.lineTo(-60, 0); ctx.lineTo(-75, 30); ctx.lineTo(-65, 30);
        ctx.closePath(); ctx.fill();
    }
}

export class CargoPlane extends PlayerUnit {
    static editorConfig = { category: 'unit', icon: 'cargo-plane', name: '수송기' };
    constructor(x, y, engine) {
        super(x, y, engine);
        this.init(x, y, engine);
    }

    init(x, y, engine) {
        super.init(x, y, engine);
        this.type = 'cargo-plane';
        this.name = '전략 수송기';
        this.domain = 'ground'; 
        this.baseSpeed = 0.8;   
        this.airSpeed = 2.2;    
        this.speed = 0.3;       
        this.hp = 1500;
        this.maxHp = 1500;
        this.population = 2; // 조종사 2명
        this.size = 130; 
        this.altitude = 0.0; 
        this.isLandingZoneSafe = false;
        this.lastX = x;
        this.lastY = y;

        this.isTakeoffStarting = false;
        this.isManualLanding = false;
        this.maneuverFrameCount = 0;
        this.takeoffDistance = 0;

        this.cargo = [];
        this.cargoCapacity = 20; 
        this.cargoSize = 99; 
        this.isUnloading = false;
        this.unloadTimer = 0;
        this.unloadInterval = 300;
    }

    getSelectionBounds() {
        const bounds = super.getSelectionBounds();
        const offset = (this.altitude || 0) * 15; // draw에서 사용하는 부상 높이 (15)
        return {
            left: bounds.left,
            right: bounds.right,
            top: bounds.top - offset,
            bottom: bounds.bottom - offset
        };
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

    getCacheKey() {
        // 애니메이션이 필요한 상황들
        if (this.isTakeoffStarting || this.isManualLanding || 
            this.isUnloading || this.isCombatDropping) return null;
        
        const state = (this.altitude > 0.8) ? 'air' : 'ground';
        return `${this.type}-${state}`;
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
        
        const alt = this.altitude || 0;
        const shadowOffset = alt * 12; // 오프셋 대폭 축소 (25 -> 12)
        const shadowScale = 1 + alt * 0.05; 

        // 0. 그림자 (매우 연하게)
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.translate(shadowOffset, shadowOffset);
        ctx.scale(shadowScale, shadowScale);
        this.drawCargoShape(ctx, true);
        ctx.restore();

        // 1. 기체 본체
        ctx.save();
        ctx.translate(0, -alt * 15); // 부상 높이 대폭 축소 (30 -> 15)
        this.drawCargoShape(ctx, false);
        ctx.restore();
    }

    drawCargoShape(ctx, isShadow) {
        // 1. 고익기 주익
        ctx.fillStyle = isShadow ? 'rgba(0,0,0,1)' : '#bdc3c7';
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(-38, -115); ctx.lineTo(-72, -115);
        ctx.lineTo(-28, 0);
        ctx.lineTo(-72, 115); ctx.lineTo(-38, 115);
        ctx.closePath(); ctx.fill();

        // 2. 엔진
        const engineOffsets = [-88, -52, 52, 88];
        engineOffsets.forEach(offset => {
            if (!isShadow) ctx.fillStyle = '#34495e';
            ctx.fillRect(-18, offset - 9, 28, 18);
            
            // 엔진 배기 이펙트
            if (!isShadow && this.altitude > 0.1) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.beginPath();
                ctx.arc(-25, offset, 8 * (1 + Math.random() * 0.5), 0, Math.PI * 2);
                ctx.fill();
            }
        });

        // 3. 동체
        if (!isShadow) ctx.fillStyle = '#bdc3c7';
        ctx.beginPath();
        ctx.moveTo(85, 0);
        ctx.bezierCurveTo(85, -24, 65, -26, 45, -26);
        ctx.lineTo(-65, -26);
        ctx.bezierCurveTo(-100, -26, -100, 26, -65, 26);
        ctx.lineTo(45, 26);
        ctx.bezierCurveTo(65, 26, 85, 24, 85, 0);
        ctx.fill();

        // 4. 꼬리 날개
        if (!isShadow) ctx.fillStyle = '#95a5a6';
        ctx.save();
        ctx.translate(-92, 0);
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(-18, -48); ctx.lineTo(-32, -48);
        ctx.lineTo(-22, 0); ctx.lineTo(-32, 48); ctx.lineTo(-18, 48);
        ctx.closePath(); ctx.fill();
        ctx.restore();
    }
}
