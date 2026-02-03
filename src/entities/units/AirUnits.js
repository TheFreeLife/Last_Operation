import { PlayerUnit } from './BaseUnit.js';
import { FallingBomb } from '../projectiles/Bomb.js';
import { CombatLogic } from '../../engine/systems/CombatLogic.js';

export class ScoutPlane extends PlayerUnit {
    static editorConfig = { category: 'logistics', icon: 'scout-plane', name: '정찰기' };
    constructor(x, y, engine) {
        super(x, y, engine);
        this.init(x, y, engine);
    }

    init(x, y, engine) {
        super.init(x, y, engine);
        this.type = 'scout-plane';
        this.name = '고등 정찰 무인기';
        this.domain = 'air';
        this.altitude = 1.0; // [추가] 항상 비행 상태
        this.speed = 4.5;    
        this.visionRange = 18; 
        this.hp = 250;       
        this.maxHp = 250;
        this.population = 2; // 조종사 + 관측수 (현실적 운용 인원)
        this.size = 80;      
        this.cargoSize = 99; 
        this.armorType = 'light';
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
    static editorConfig = { category: 'air', icon: 'bomber', name: '폭격기' };
    constructor(x, y, engine) {
        super(x, y, engine);
        this.init(x, y, engine);
    }

    init(x, y, engine) {
        super.init(x, y, engine);
        this.type = 'bomber';
        this.name = '전략 폭격기';
        this.domain = 'ground'; 
        this.baseSpeed = 1.1;  // 2.2 -> 1.1 (절반으로 하향)
        this.airSpeed = 5.0;   
        this.speed = 0.25;     // 0.5 -> 0.25
        this.visionRange = 12;
        this.hp = 1200;
        this.maxHp = 1200;
        this.population = 4; // 조종사, 부조종사, 항법사, 폭격수
        this.size = 130; 
        this.damage = 300;
        this.attackTargets = ['ground', 'sea'];
        this.isIndirect = true; // [추가] 곡사 판정 (지붕 우선 공격을 위함)
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

        this.armorType = 'light';
        this.weaponType = 'shell';

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
            this.speed = 0.25; // 0.5 -> 0.25
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
                // 1) 활주 중 가속: 0.25에서 baseSpeed까지 (활주 거리 300px 기준)
                const takeoffProgress = Math.min(1.0, this.takeoffDistance / 300);
                this.speed = 0.25 + (this.baseSpeed - 0.25) * takeoffProgress;
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
                    this.engine.audioSystem.play('missile_flight', { volume: 0.1 });
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
    static editorConfig = { category: 'logistics', icon: 'cargo-plane', name: '수송기' };
    constructor(x, y, engine) {
        super(x, y, engine);
        this.init(x, y, engine);
    }

    init(x, y, engine) {
        super.init(x, y, engine);
        this.type = 'cargo-plane';
        this.name = '전략 수송기';
        this.domain = 'ground'; 
        this.baseSpeed = 0.4;   // 0.8 -> 0.4
        this.airSpeed = 2.2;    
        this.speed = 0.15;      // 0.3 -> 0.15
        this.hp = 1500;
        this.maxHp = 1500;
        this.population = 2; // 조종사 2명
        this.size = 130; 
        this.armorType = 'light';
        this.altitude = 0.0; 
        this.isLandingZoneSafe = false;
        this.lastX = x;
        this.lastY = y;

        this.isTakeoffStarting = false;
        this.isManualLanding = false;
        this.maneuverFrameCount = 0;
        this.takeoffDistance = 0;

        this.cargo = []; // 화물 비우기
        this.cargoCapacity = 20; 
        this.cargoSize = 99; 
        this.isUnloading = false;
        this.isCombatDropping = false; // [추가] 강하 상태 초기화
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
            unit.path = [];
            unit.command = 'stop';

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
            unit.path = [];
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
            this.speed = 0.15; // 0.3 -> 0.15
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
                this.speed = 0.15 + (this.baseSpeed - 0.15) * takeoffProgress; // 0.3 -> 0.15
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

export class Helicopter extends PlayerUnit {
    static editorConfig = { category: 'air', icon: 'helicopter', name: '공중강습 헬기' };
    constructor(x, y, engine) {
        super(x, y, engine);
        this.init(x, y, engine);
    }

    init(x, y, engine) {
        super.init(x, y, engine);
        this.type = 'helicopter';
        this.name = '공중강습 헬기';
        this.domain = 'ground';
        this.baseSpeed = 1.0; 
        this.airSpeed = 3.5;  
        this.speed = 1.0;
        this.visionRange = 10;
        this.hp = 700;
        this.maxHp = 700;
        this.population = 2; // 조종사, 부조종사/사수
        this.size = 90;
        this.altitude = 0.0;
        
        // 무장 설정: 기관총 (지상/공중 모두 타격)
        this.attackRange = 280;
        this.fireRate = 200; 
        this.damage = 12;
        this.attackTargets = ['ground', 'air', 'sea'];
        
        this.armorType = 'light';
        this.weaponType = 'bullet';
        
        this.ammoType = 'bullet';
        this.maxAmmo = 400;
        this.ammo = 400;

        // 수송 설정
        this.cargo = [];
        this.cargoCapacity = 4;
        this.cargoSize = 99; // 헬기는 다른 기체에 탈 수 없음
        this.isUnloading = false;
        this.unloadTimer = 0;
        this.unloadInterval = 400;

        this.isTransitioning = false; // 이착륙 전환 중
    }

    getSelectionBounds() {
        const bounds = super.getSelectionBounds();
        const offset = (this.altitude || 0) * 10;
        return {
            left: bounds.left,
            right: bounds.right,
            top: bounds.top - offset,
            bottom: bounds.bottom - offset
        };
    }

    getSkillConfig(cmd) {
        const skills = {
            'takeoff_landing': { type: 'state', handler: this.toggleTakeoff },
            'unload_all': { type: 'instant', handler: this.startUnloading }
        };
        return skills[cmd];
    }

    getCacheKey() {
        // 로터 애니메이션을 위해 비행 중에는 캐싱 방지
        if (this.altitude > 0.05 || this.isTransitioning) return null;
        return `${this.type}-landed`;
    }

    toggleTakeoff() {
        if (this.isTransitioning) return;
        this.isTransitioning = true;
        this.command = 'stop';
        this.destination = null;
    }

    loadUnit(unit) {
        if (this.isUnloading || this.altitude > 0.1) return false;
        const uSize = unit.cargoSize || 1;
        if (this.cargo.length + uSize > this.cargoCapacity) return false;

        unit.isBoarded = true;
        unit.command = 'stop';
        unit.destination = null;
        unit.path = [];
        this.cargo.push(unit);

        if (this.engine.selectedEntities) {
            this.engine.selectedEntities = this.engine.selectedEntities.filter(e => e !== unit);
        }
        this.engine.addEffect?.('system', this.x, this.y - 20, '#ffff00', '헬기 탑승');
        if (this.engine.updateBuildMenu) this.engine.updateBuildMenu();
        return true;
    }

    startUnloading() {
        if (this.altitude > 0.1 || this.cargo.length === 0) return;
        this.isUnloading = true;
        this.unloadTimer = 0;
    }

    processUnloading(deltaTime) {
        if (!this.isUnloading || this.cargo.length === 0) {
            this.isUnloading = false;
            return;
        }
        this.unloadTimer += deltaTime;
        if (this.unloadTimer >= this.unloadInterval) {
            this.unloadTimer = 0;
            const unit = this.cargo.shift();
            unit.isBoarded = false;
            unit.active = true;
            unit.destination = null;
            unit.path = [];
            unit.x = this.x + (Math.random() - 0.5) * 40;
            unit.y = this.y + (Math.random() - 0.5) * 40;
            if (this.cargo.length === 0) this.isUnloading = false;
        }
    }

    update(deltaTime) {
        // 1. 이착륙 전환 로직 (VTOL)
        if (this.isTransitioning) {
            if (this.altitude < 1.0 && this.domain === 'ground') {
                this.altitude = Math.min(1.0, this.altitude + 0.01);
                if (this.altitude >= 1.0) {
                    this.isTransitioning = false;
                    this.domain = 'air';
                }
            } else {
                this.altitude = Math.max(0.0, this.altitude - 0.01);
                if (this.altitude <= 0.0) {
                    this.isTransitioning = false;
                    this.domain = 'ground';
                }
            }
            this.speed = 0; // 전환 중 정지
        } else {
            this.speed = this.altitude > 0.8 ? this.airSpeed : this.baseSpeed;
        }

        // 2. 수송 하차 처리
        if (this.isUnloading) this.processUnloading(deltaTime);

        super.update(deltaTime);
    }

    attack() {
        // 공중에서도 사격 가능
        this.performAttack();
    }

    draw(ctx) {
        const alt = this.altitude || 0;
        const shadowOffset = alt * 10;
        const rotorRotation = (Date.now() / 20) % (Math.PI * 2);

        // 0. 그림자
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.translate(shadowOffset, shadowOffset);
        this.drawHelicopterShape(ctx, true, rotorRotation);
        ctx.restore();

        // 1. 본체
        ctx.save();
        ctx.translate(0, -alt * 15);
        this.drawHelicopterShape(ctx, false, rotorRotation);
        ctx.restore();
    }

    drawHelicopterShape(ctx, isShadow, rotorRot) {
        // 동체 (Fuselage)
        ctx.fillStyle = isShadow ? 'rgba(0,0,0,1)' : '#34495e';
        ctx.beginPath();
        ctx.ellipse(5, 0, 35, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // 꼬리 (Tail Boom)
        ctx.beginPath();
        ctx.moveTo(-25, 0);
        ctx.lineTo(-65, -4);
        ctx.lineTo(-65, 4);
        ctx.closePath();
        ctx.fill();

        // 꼬리 날개
        ctx.fillRect(-68, -12, 4, 24);

        if (!isShadow) {
            // 조종석 (Cockpit)
            ctx.fillStyle = '#2980b9';
            ctx.beginPath();
            ctx.ellipse(25, 0, 12, 8, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // 메인 로터 (Main Rotor) - 애니메이션
        ctx.save();
        ctx.translate(0, 0);
        ctx.rotate(rotorRot);
        ctx.fillStyle = isShadow ? 'rgba(0,0,0,1)' : '#2c3e50';
        for (let i = 0; i < 4; i++) {
            ctx.rotate(Math.PI / 2);
            ctx.fillRect(-2, -50, 4, 100);
        }
        ctx.restore();

        // 랜딩 기어 (Skids)
        if (!isShadow) {
            ctx.strokeStyle = '#2c3e50';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-15, -15); ctx.lineTo(25, -15);
            ctx.moveTo(-15, 15); ctx.lineTo(25, 15);
            ctx.stroke();
        }
    }
}

export class SuicideDrone extends PlayerUnit {
    static editorConfig = { category: 'air', icon: 'drone', name: '자폭 드론' };
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'suicide-drone';
        this.name = '자폭 드론';
        this.domain = 'air';
        this.baseSpeed = 2.1;
        this.dashSpeed = 5.4;
        this.speed = 2.1;
        this.attackRange = 20; // 거의 붙어야 터짐
        this.visionRange = 10;
        this.damage = 450;
        this.explosionRadius = 120;
        this.hp = 40;
        this.maxHp = 40;
        this.population = 0; // 무인기이므로 인구수 0
        this.attackTargets = ['ground', 'air', 'sea'];
        this.size = 24;
        this.altitude = 1.0;
        this.isDashing = false;

        this.armorType = 'infantry'; // 드론은 작으므로 보병 판정
        this.weaponType = 'fire';
    }

    init(x, y, engine) {
        super.init(x, y, engine);
        this.speed = this.baseSpeed || 2.1;
        this.isDashing = false;
        this.ammo = 0; // 탄약 미사용
        this.maxAmmo = 0;
    }

    getCacheKey() {
        return null; // 드론은 상시 애니메이션(로터, 불빛)이 있으므로 캐싱 제외
    }

    update(deltaTime) {
        if (!this.alive) return;

        // --- 드론 원격 제어 시스템 ---
        // 0.5초마다 아군 운용병 체크 (최적화)
        if (!this._controlCheckTimer) this._controlCheckTimer = 0;
        this._controlCheckTimer += deltaTime;

        if (this._controlCheckTimer >= 500) {
            this._controlCheckTimer = 0;
            
            // 주변의 플레이어(1) 소유 드론 운용병 검색
            const operators = this.engine.entityManager.getNearby(this.x, this.y, 800); 
            const hasFriendlyOperator = operators.some(op => 
                op.type === 'drone-operator' && 
                op.ownerId === 1 && 
                !op.isBoarded && 
                Math.hypot(this.x - op.x, this.y - op.y) <= op.attackRange
            );

            if (this.ownerId === 1 && !hasFriendlyOperator) {
                // 제어권 상실
                this.ownerId = 0;
                this.command = 'stop';
                this.destination = null;
                this.target = null;
                this.engine.addEffect?.('system', this.x, this.y - 20, '#ff3131', 'Signal Lost');
            } else if (this.ownerId === 0 && hasFriendlyOperator) {
                // 제어권 획득
                this.ownerId = 1;
                this.engine.addEffect?.('system', this.x, this.y - 20, '#39ff14', 'Signal Linked');
            }
        }

        // 중립 상태면 더 이상 업데이트(이동/공격) 안 함
        if (this.ownerId === 0) {
            // 중립 드론은 제자리 부유만 함
            this.angle += 0.01; 
            return;
        }

        // 타겟이 있으면 돌진 상태로 전환
        if (this.target) {
            const dist = Math.hypot(this.target.x - this.x, this.target.y - this.y);
            if (dist < 400) { // 인지 범위 내에 들어오면 가속
                this.isDashing = true;
                this.speed = this.dashSpeed;
            }
            
            // 실제 충돌 판정 (사거리보다 약간 넉넉하게)
            if (dist < this.attackRange + 10) {
                this.explode();
                return;
            }
        } else {
            this.isDashing = false;
            this.speed = this.baseSpeed;
        }

        super.update(deltaTime);
    }

    attack() {
        // BaseUnit의 performAttack(투사체 발사)을 무시하고 직접 충돌 체크
        if (this.target) {
            const dist = Math.hypot(this.target.x - this.x, this.target.y - this.y);
            if (dist < this.attackRange + 10) {
                this.explode();
            }
        }
    }

    explode() {
        if (!this.active || this.hp <= 0) return;
        
        this.hp = 0;
        this.active = false;
        this.alive = false;

        // [수정] CombatLogic을 사용하여 곡사 화기(폭탄 등)와 동일한 폭발 메커니즘 적용
        // isIndirect: true를 통해 천장이 있을 경우 지면의 유닛과 오브젝트를 보호함
        CombatLogic.handleImpact(this.engine, this.x, this.y, {
            radius: this.explosionRadius,
            damage: this.damage,
            weaponType: 'fire',
            isIndirect: true, 
            effectType: 'explosion'
        });

        // 자신 제거
        this.engine.entityManager.remove(this);
    }

    draw(ctx) {
        const alt = 1.0;
        const shadowOffset = alt * 6;
        
        // 0. 그림자
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.translate(shadowOffset, shadowOffset);
        this.drawDroneShape(ctx, true);
        ctx.restore();

        // 1. 본체
        ctx.save();
        ctx.translate(0, -alt * 10);
        if (this.isDashing) {
            // 돌진 시 흔들림 효과
            ctx.translate((Math.random()-0.5)*2, (Math.random()-0.5)*2);
        }
        this.drawDroneShape(ctx, false);
        ctx.restore();
    }

    drawDroneShape(ctx, isShadow) {
        ctx.save();
        ctx.scale(1.5, 1.5);

        // X자형 프레임
        ctx.strokeStyle = isShadow ? 'rgba(0,0,0,1)' : '#2d3436';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-8, -8); ctx.lineTo(8, 8);
        ctx.moveTo(8, -8); ctx.lineTo(-8, 8);
        ctx.stroke();

        // 중앙 몸체 (폭약 뭉치)
        ctx.fillStyle = isShadow ? 'rgba(0,0,0,1)' : (this.isDashing ? '#d63031' : '#636e72');
        ctx.fillRect(-4, -4, 8, 8);
        
        if (!isShadow) {
            // 경고등
            const pulse = Math.sin(Date.now() / (this.isDashing ? 50 : 200)) * 0.5 + 0.5;
            ctx.fillStyle = `rgba(255, 0, 0, ${pulse})`;
            ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI*2); ctx.fill();
        }

        // 4개의 로터
        const rot = (Date.now() / (this.isDashing ? 20 : 50)) % (Math.PI * 2);
        [[-8,-8], [8,-8], [-8,8], [8,8]].forEach(pos => {
            ctx.save();
            ctx.translate(pos[0], pos[1]);
            if (!isShadow) {
                ctx.rotate(rot);
                ctx.fillStyle = '#1e272e';
                ctx.fillRect(-6, -1, 12, 2);
            } else {
                ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI*2); ctx.fill();
            }
            ctx.restore();
        });

        ctx.restore();
    }
}

export class CarrierDrone extends PlayerUnit {
    static editorConfig = { category: 'air', icon: 'drone', name: '군집 드론' };
    constructor(x, y, engine) {
        super(x, y, engine);
        this.type = 'carrier-drone';
        this.name = '군집 드론';
        this.domain = 'air';
        this.baseSpeed = 2.4; // 조금 더 빠름
        this.dashSpeed = 6.0;
        this.speed = 2.4;
        this.attackRange = 20; 
        this.visionRange = 10;
        this.damage = 450;
        this.explosionRadius = 120;
        this.hp = 30; // 체력은 조금 더 낮음
        this.maxHp = 30;
        this.population = 0; 
        this.attackTargets = ['ground', 'air', 'sea'];
        this.size = 22;
        this.altitude = 1.0;
        this.isDashing = false;

        this.armorType = 'infantry';
        this.weaponType = 'fire';

        // 트럭 사출 드론 전용 속성
        this.parentTruck = null;
        this.isAutoSuicide = true;
    }

    init(x, y, engine) {
        super.init(x, y, engine);
        this.speed = this.baseSpeed || 2.4;
        this.isDashing = false;
        this.ammo = 0;
        this.maxAmmo = 0;
    }

    getCacheKey() {
        return null; // 실시간 애니메이션 및 사거리 이탈 상태 반영을 위해 캐싱 제외
    }

    update(deltaTime) {
        if (!this.alive) return;

        // --- 드론 제어권 및 모함(Adoption) 시스템 ---
        if (!this._controlCheckTimer) this._controlCheckTimer = 0;
        this._controlCheckTimer += deltaTime;

        if (this._controlCheckTimer >= 500) {
            this._controlCheckTimer = 0;
            // 주기적으로 유효한 모함이 있는지 체크 (아래 거리 제한 로직에서 상세 처리)
        }

        // --- 드론 트럭 전용 자동 타켓팅 AI ---
        // 수동 타겟(manualTarget)을 설정하여 '강제 공격' 상태로 만듦 (BaseUnit이 다른 타겟으로 변경하지 못하게 함)
        if (this.ownerId === 1 && this.isAutoSuicide && this.parentTruck) {
            // 만약 현재 타겟이 있는데 그 타겟이 천장 아래로 들어갔다면 타겟 해제
            if (this.manualTarget) {
                const targetGrid = this.engine.tileMap.worldToGrid(this.manualTarget.x, this.manualTarget.y);
                const tile = this.engine.tileMap.grid[targetGrid.y]?.[targetGrid.x];
                const hasCeiling = tile && this.engine.tileMap.layers.ceiling[targetGrid.y]?.[targetGrid.x]?.id && tile.ceilingHp > 0;
                
                if (hasCeiling) {
                    this.manualTarget = null;
                    this.command = 'stop';
                }
            }

            if (!this.manualTarget) {
                const truckRange = this.parentTruck.attackRange;
                const enemies = this.engine.entities.enemies;
                
                // 1. 트럭 사거리 내의 유효한 적 후보군 추출 (천장 체크 포함)
                const candidates = enemies.filter(e => {
                    if (!e.active || e.hp <= 0) return false;
                    
                    // 트럭 사거리 체크
                    if (Math.hypot(e.x - this.parentTruck.x, e.y - this.parentTruck.y) > truckRange) return false;

                    // 천장(실내) 체크: 드론은 실내의 적을 발견하거나 공격할 수 없음
                    const targetGrid = this.engine.tileMap.worldToGrid(e.x, e.y);
                    const tile = this.engine.tileMap.grid[targetGrid.y]?.[targetGrid.x];
                    const hasCeiling = tile && this.engine.tileMap.layers.ceiling[targetGrid.y]?.[targetGrid.x]?.id && tile.ceilingHp > 0;
                    if (hasCeiling) return false;

                    return true;
                });

                if (candidates.length > 0) {
                    // 2. 거리순 정렬 (가까운 순)
                    candidates.sort((a, b) => {
                        const dA = Math.hypot(a.x - this.x, a.y - this.y);
                        const dB = Math.hypot(b.x - this.x, b.y - this.y);
                        return dA - dB;
                    });

                    // 3. 분산 타겟팅: 다른 드론이 노리지 않는 적 우선 선택
                    let selected = candidates.find(candidate => {
                        // 내 형제 드론들 중 이 적을 manualTarget으로 잡은 놈이 있는지 확인
                        return !this.parentTruck.launchedDrones.some(otherDrone => 
                            otherDrone !== this && 
                            otherDrone.active && 
                            otherDrone.manualTarget === candidate
                        );
                    });

                    // 4. 모든 적이 이미 타겟팅 되었다면, 가장 가까운 적 선택 (다구리)
                    if (!selected) {
                        selected = candidates[0];
                    }

                    if (selected) {
                        this.manualTarget = selected;
                        this.command = 'attack';
                    }
                }
            }
        }

        // 타겟이 있으면 돌진 상태로 전환 (manualTarget 포함)
        const activeTarget = this.target || this.manualTarget;
        if (activeTarget) {
            const dist = Math.hypot(activeTarget.x - this.x, activeTarget.y - this.y);
            if (dist < 400) { 
                this.isDashing = true;
                this.speed = this.dashSpeed;
            }
            
            if (dist < this.attackRange + 10) {
                this.explode();
                return;
            }
        } else {
            this.isDashing = false;
            this.speed = this.baseSpeed;
        }

        // [수정] 작전 반경(트럭 사거리) 제한 및 Adoption 로직
        // "어떤" 드론 트럭이라도 범위 내에 있으면 활성화 및 소속 변경
        this.isOutOfRange = true; 
        
        // 1. 모든 우호 트럭 탐색
        const trucks = this.engine.entities.units.filter(u => 
            u.type === 'drone-truck' && u.ownerId === this.ownerId && u.active && u.hp > 0
        );

        // 2. 현재 나를 제어할 수 있는 가장 가까운 트럭 찾기
        let bestController = null;
        let minDist = Infinity;

        for (const truck of trucks) {
            const d = Math.hypot(this.x - truck.x, this.y - truck.y);
            if (d <= truck.attackRange + 15) { // 15px 정도 마진
                if (d < minDist) {
                    minDist = d;
                    bestController = truck;
                }
            }
        }

        if (bestController) {
            this.isOutOfRange = false;
            // 제어권 이전 (Adoption): 모함이 바뀌면 해당 트럭의 관리 리스트로 이동
            if (this.parentTruck !== bestController) {
                this.parentTruck = bestController;
                if (!bestController.launchedDrones.includes(this)) {
                    bestController.launchedDrones.push(this);
                }
            }
        } else {
            // 모든 트럭의 범위를 벗어남 -> 정지
            this.destination = null;
            this.target = null;
            this.manualTarget = null;
            this.command = 'stop';
            this.isDashing = false;
            this.speed = this.baseSpeed;
        }

        super.update(deltaTime);
    }

    attack() {
        if (this.target) {
            const dist = Math.hypot(this.target.x - this.x, this.target.y - this.y);
            if (dist < this.attackRange + 10) {
                this.explode();
            }
        }
    }

    explode() {
        if (!this.active || this.hp <= 0) return;
        
        this.hp = 0;
        this.active = false;
        this.alive = false;

        // [수정] CombatLogic을 사용하여 곡사 화기(폭탄 등)와 동일한 폭발 메커니즘 적용
        // isIndirect: true를 통해 천장이 있을 경우 지면의 유닛과 오브젝트를 보호함
        CombatLogic.handleImpact(this.engine, this.x, this.y, {
            radius: this.explosionRadius,
            damage: this.damage,
            weaponType: 'fire',
            isIndirect: true, 
            effectType: 'explosion'
        });

        // 자신 제거
        this.engine.entityManager.remove(this);
    }

    draw(ctx) {
        // 기존 드론과 약간 다르게 그리기 (예: 색상 변경)
        const alt = 1.0;
        const shadowOffset = alt * 6;
        
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.translate(shadowOffset, shadowOffset);
        this.drawDroneShape(ctx, true);
        ctx.restore();

        ctx.save();
        ctx.translate(0, -alt * 10);
        if (this.isDashing) {
            ctx.translate((Math.random()-0.5)*2, (Math.random()-0.5)*2);
        }
        this.drawDroneShape(ctx, false);
        ctx.restore();
    }

    drawDroneShape(ctx, isShadow) {
        ctx.save();
        ctx.scale(1.4, 1.4); // 기존보다 약간 작게

        // X자형 프레임
        ctx.strokeStyle = isShadow ? 'rgba(0,0,0,1)' : '#2d3436';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-8, -8); ctx.lineTo(8, 8);
        ctx.moveTo(8, -8); ctx.lineTo(-8, 8);
        ctx.stroke();

        // 중앙 몸체 (CarrierDrone은 파란색 계열 포인트)
        // 사거리 밖이면 회색, 돌진 시 붉은색, 평상시 파란색
        const bodyColor = this.isOutOfRange ? '#95a5a6' : (this.isDashing ? '#e74c3c' : '#3498db');
        ctx.fillStyle = isShadow ? 'rgba(0,0,0,1)' : bodyColor;
        ctx.fillRect(-4, -4, 8, 8);
        
        if (!isShadow) {
            if (this.isOutOfRange) {
                // 작동 중지된 불빛 (어두운 색)
                ctx.fillStyle = '#2c3e50';
            } else {
                const pulse = Math.sin(Date.now() / (this.isDashing ? 50 : 200)) * 0.5 + 0.5;
                ctx.fillStyle = `rgba(50, 200, 255, ${pulse})`;
            }
            ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI*2); ctx.fill();
        }

        const rot = (Date.now() / (this.isDashing ? 15 : 40)) % (Math.PI * 2);
        [[-8,-8], [8,-8], [-8,8], [8,8]].forEach(pos => {
            ctx.save();
            ctx.translate(pos[0], pos[1]);
            if (!isShadow) {
                ctx.rotate(rot);
                ctx.fillStyle = '#1e272e';
                ctx.fillRect(-6, -1, 12, 2);
            } else {
                ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI*2); ctx.fill();
            }
            ctx.restore();
        });

        ctx.restore();
    }
}
