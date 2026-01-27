import { TileMap } from '../map/TileMap.js';
import { Entity, PlayerUnit, Enemy, Projectile, Resource, AmmoBox, MilitaryTruck, CargoPlane, ScoutPlane, Bomber, Artillery, AntiAirVehicle, Tank, MissileLauncher, Rifleman, Sniper } from '../entities/Entities.js';
import { Pathfinding } from './systems/Pathfinding.js';
import { ICONS } from '../assets/Icons.js';
import { EntityManager } from '../entities/EntityManager.js';
import { RenderSystem } from './systems/RenderSystem.js';
import { DebugSystem } from './systems/DebugSystem.js';

export class GameEngine {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        // imageSmoothingEnabled를 기본값(true)으로 유지하여 격자 현상 완화

        this.minimapCanvas = document.getElementById('minimapCanvas');
        this.minimapCtx = this.minimapCanvas.getContext('2d');

        this.resize();

        this.entityClasses = { Entity, PlayerUnit, Enemy, Projectile, Resource, AmmoBox, MilitaryTruck, CargoPlane, ScoutPlane, Bomber, Artillery, AntiAirVehicle, Tank, MissileLauncher, Rifleman, Sniper };
        this.tileMap = new TileMap(this.canvas);
        this.pathfinding = new Pathfinding(this);

        // EntityManager 초기화 (새로운 최적화 시스템)
        this.entityManager = new EntityManager(this);
        this.renderSystem = new RenderSystem(this);

        // 엔티티 타입 등록
        this.registerEntityTypes();

        const centerX = (this.tileMap.cols * this.tileMap.tileSize) / 2;
        const centerY = (this.tileMap.rows * this.tileMap.tileSize) / 2;

        // 기존 entities 구조 유지 (하위 호환성)
        // EntityManager의 entities 객체를 직접 참조하여 기존 코드와 호환
        this.entities = this.entityManager.entities;

        this.initResources();

        // --- 초기 유닛 배치 ---
        const startX = centerX;
        const startY = centerY;
        const spX = 90; // 가로 간격
        const spY = 90; // 세로 간격

        // [공중 전력]
        const airY = startY - 180;
        const startBomber = new Bomber(startX - spX, airY, this);
        const startCargo = new CargoPlane(startX, airY, this);
        const startScout = new ScoutPlane(startX + spX, airY, this);

        // [지상군]
        const groundY = startY + 180;

        // 1열: 기갑 및 중화기
        const startTank = new Tank(startX - spX, groundY, this);
        const startMissile = new MissileLauncher(startX, groundY, this);
        const startAntiAir = new AntiAirVehicle(startX + spX, groundY, this);

        // 2열: 보병 및 지원 화력
        const startSniper = new Sniper(startX - spX, groundY + spY, this);
        const startInfantry = new Rifleman(startX, groundY + spY, this);
        const startArtillery = new Artillery(startX + spX, groundY + spY, this);

        // 3열: 수송 트럭
        const startTruck = new MilitaryTruck(startX, groundY + spY * 2, this);

        // 4열: 탄약 보급품 (상자 유닛)
        const startAmmoBoxes = [
            new AmmoBox(startX - spX, groundY + spY * 3, this, 'bullet'),
            new AmmoBox(startX, groundY + spY * 3, this, 'shell'),
            new AmmoBox(startX + spX, groundY + spY * 3, this, 'missile')
        ];

        // 모든 아군 유닛 설정 및 등록
        const allStartingUnits = [
            startTank, startMissile, startAntiAir,
            startSniper, startInfantry, startArtillery,
            startTruck,
            ...startAmmoBoxes,
            startBomber, startCargo, startScout
        ];

        allStartingUnits.forEach(u => {
            u.ownerId = 1;
            // 살짝 아래를 바라보게 설정
            u.angle = Math.PI / 2;
            this.entities.units.push(u);

            // [중요] EntityManager에 수동 등록 (create를 안 썼으므로)
            this.entityManager.allEntities.push(u);
            this.entityManager.spatialGrid.add(u);

            // 수송기는 전용 리스트에도 등록
            if (u.type === 'cargo-plane') this.entities.cargoPlanes.push(u);
        });

        // 테스트용 중립 유닛 (플레이어 3)
        const neutralTank = new Tank(startX - 350, startY - 100, this);
        neutralTank.ownerId = 3;
        neutralTank.name = "중립 전차 (P3)";

        const neutralDrone = new ScoutPlane(startX - 450, startY - 100, this);
        neutralDrone.ownerId = 3;
        neutralDrone.name = "정찰 무인기 (P3)";

        this.entities.units.push(neutralTank, neutralDrone);
        this.entityManager.allEntities.push(neutralTank, neutralDrone);
        this.entityManager.spatialGrid.add(neutralTank);
        this.entityManager.spatialGrid.add(neutralDrone);

        this.updateVisibility();

        this.resources = { gold: 999999, oil: 0, iron: 0, population: 0, maxPopulation: 200 };
        this.globalStats = { damage: 10, range: 150, fireRate: 1000 };


        // 플레이어 시스템 초기화
        this.players = {
            1: { name: 'Player 1 (User)', team: 1 },
            2: { name: 'Player 2 (Enemy)', team: 2 },
            3: { name: 'Player 3 (Neutral)', team: 3 }
        };

        // 부대 지정 시스템 (StarCraft Style)
        this.controlGroups = {
            1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [], 0: []
        };
        this.lastControlGroupKey = null;
        this.lastControlGroupTime = 0;

        // 관계 설정 (나중에 외부 설정 파일로 분리 가능)
        this.relations = {
            '1-2': 'enemy',
            '2-1': 'enemy',
            '1-3': 'neutral',
            '3-1': 'neutral',
            '2-3': 'neutral',
            '3-2': 'neutral'
        };

        this.lastTime = 0;
        this.gameState = 'playing';
        this.unitCommandMode = null;
        this.selectedEntity = null;
        this.selectedEntities = [];
        this.currentMenuName = 'main';
        this.hoveredEntity = null; // 호버 중인 엔티티 저장용
        this.isHoveringUI = false;
        this.effects = []; // 시각 효과(파티클 등) 관리용 배열 추가

        // Camera State
        const initialZoom = 0.8;
        this.camera = {
            x: this.canvas.width / 2 - centerX * initialZoom,
            y: this.canvas.height / 2 - centerY * initialZoom,
            width: this.canvas.width,
            height: this.canvas.height,
            zoom: initialZoom,
            mouseX: 0,
            mouseY: 0,
            edgeScrollSpeed: 15,
            edgeThreshold: 30,
            selectionBox: null
        };

        // Visibility Optimization
        this.visibilityTimer = 0;
        this.visibilityInterval = 100; // 100ms

        // [최적화] 미니맵 배경 캐시 캔버스 (1px = 1타일)
        this.minimapCacheCanvas = document.createElement('canvas');
        this.minimapCacheCanvas.width = this.tileMap.cols;
        this.minimapCacheCanvas.height = this.tileMap.rows;
        this.minimapCacheCtx = this.minimapCacheCanvas.getContext('2d');

        // 초기 인구수 계산
        this.updatePopulation();

        this.debugSystem = new DebugSystem(this);

        window.addEventListener('resize', () => this.resize());
        this.initInput();
        this.initUI();
    }

    registerEntityTypes() {
        const em = this.entityManager;
        // 유닛
        em.register('tank', Tank, 'units');
        em.register('missile-launcher', MissileLauncher, 'units');
        em.register('anti-air', AntiAirVehicle, 'units');
        em.register('artillery', Artillery, 'units');
        em.register('rifleman', Rifleman, 'units');
        em.register('sniper', Sniper, 'units');
        em.register('military-truck', MilitaryTruck, 'units');
        em.register('cargo-plane', CargoPlane, 'units');
        em.register('scout-plane', ScoutPlane, 'units');
        em.register('bomber', Bomber, 'units');
        em.register('enemy', Enemy, 'enemies');

        // 자원 및 아이템
        em.register('resource', Resource, 'resources');
        em.register('ammo-box', AmmoBox, 'units');

        // 투사체
        em.register('projectile', Projectile, 'projectiles');
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.minimapCanvas.width = 200;
        this.minimapCanvas.height = 200;
    }

    getRelation(p1Id, p2Id) {
        if (p1Id === p2Id) return 'self';

        const p1 = this.players[p1Id];
        const p2 = this.players[p2Id];

        // 1. 같은 팀이면 아군
        if (p1 && p2 && p1.team === p2.team) return 'ally';

        // 2. 명시적 관계 확인
        const key = p1Id < p2Id ? `${p1Id}-${p2Id}` : `${p2Id}-${p1Id}`;
        const relation = this.relations[key];

        if (relation === 'enemy') return 'enemy';
        if (relation === 'neutral') return 'neutral';
        if (relation === 'ally') return 'ally'; // 명시적 동맹 지원

        return 'enemy'; // 기본값은 적군
    }

    // 시각 효과 추가 메서드 (포구 화염 최적화 및 명중 효과 강화)
    addEffect(type, x, y, color = '#fff', text = '') {
        if (!this.renderSystem) return;

        if (type === 'explosion') {
            // 명중 시 대형 폭발 ( cinematic )
            this.renderSystem.addParticle(x, y, 0, 0, 50, '#fff', 150, 'smoke'); 
            for (let i = 0; i < 15; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 1.0 + Math.random() * 4.0;
                this.renderSystem.addParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 10 + Math.random() * 12, '#ff4500', 700 + Math.random() * 500, 'fire');
            }
            for (let i = 0; i < 25; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 5 + Math.random() * 10;
                this.renderSystem.addParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 1 + Math.random() * 2, '#ffd700', 500, 'spark');
            }
        } else if (type === 'muzzle_large') {
            // 전차/자주포용 포구 화염 (강하지만 짧게)
            for (let i = 0; i < 5; i++) {
                const angle = (Math.random() - 0.5) * 0.5; // 전방으로 집중
                this.renderSystem.addParticle(x, y, Math.cos(angle) * 2, Math.sin(angle) * 2, 15 + Math.random() * 10, '#ffd700', 100, 'fire');
            }
        } else if (type === 'muzzle') {
            // 일반 보병용 총구 화염 (간결하게)
            this.renderSystem.addParticle(x, y, 0, 0, 6 + Math.random() * 6, '#fff', 80, 'fire');
        } else if (type === 'hit' || type === 'flak') {
            // 일반 피격 스파크
            for (let i = 0; i < 6; i++) {
                this.renderSystem.addParticle(x, y, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, 1 + Math.random() * 2, color, 400, 'spark');
            }
        } else if (type === 'system') {
            this.effects.push({ type, x, y, color, text, timer: 0, duration: 1500, active: true });
        }
    }

    // 엔티티의 소유권 유형을 특정 플레이어 관점에서 반환
    getOwnershipType(viewerId, entity) {
        if (!entity) return 'none';
        const ownerId = entity.ownerId || 0;
        return this.getRelation(viewerId, ownerId);
    }

    initResources() {
        const resourceTypes = ['oil', 'gold', 'iron'];
        const numberOfClusters = 18; // 덩어리(허브) 개수 감소

        for (let i = 0; i < numberOfClusters; i++) {
            let startX, startY;
            let validStart = false;
            let attempts = 0;

            // 1. 군집 중심점 찾기
            while (!validStart && attempts < 100) {
                startX = Math.floor(Math.random() * (this.tileMap.cols - 15)) + 7;
                startY = Math.floor(Math.random() * (this.tileMap.rows - 15)) + 7;

                const distToBase = Math.hypot(startX - this.tileMap.centerX, startY - this.tileMap.centerY);
                if (distToBase > 20) { // 기지에서 더 멀리 배치
                    validStart = true;
                }
                attempts++;
            }

            if (!validStart) continue;

            const currentType = resourceTypes[Math.floor(Math.random() * resourceTypes.length)];

            // 2. 해당 지점을 중심으로 적은 수의 소형 클러스터 생성
            const subClusters = 2 + Math.floor(Math.random() * 3); // 한 군집당 2~4개로 감소
            for (let j = 0; j < subClusters; j++) {
                const offsetX = Math.floor((Math.random() - 0.5) * 10);
                const offsetY = Math.floor((Math.random() - 0.5) * 10);
                const clusterType = Math.random();

                if (clusterType < 0.7) {
                    this.generateBlob(startX + offsetX, startY + offsetY, currentType);
                } else {
                    this.generateSnake(startX + offsetX, startY + offsetY, currentType);
                }
            }
        }
    }

    generateBlob(cx, cy, type) {
        const radius = 1.5 + Math.random() * 1.5; // 크기 축소
        for (let y = -Math.floor(radius); y <= radius; y++) {
            for (let x = -Math.floor(radius); x <= radius; x++) {
                if (x * x + y * y <= radius * radius) {
                    if (x % 2 === 0 && y % 2 === 0) {
                        this.tryPlaceResource(cx + x, cy + y, type);
                    }
                }
            }
        }
    }

    generateSnake(startX, startY, type) {
        let x = startX;
        let y = startY;
        const length = 4 + Math.floor(Math.random() * 4); // 길이 축소

        for (let i = 0; i < length; i++) {
            if (i % 2 === 0) {
                this.tryPlaceResource(x, y, type);
            }
            const dirs = [[2, 0], [-2, 0], [0, 2], [0, -2]];
            const dir = dirs[Math.floor(Math.random() * dirs.length)];
            x += dir[0];
            y += dir[1];
        }
    }

    tryPlaceResource(x, y, type) {
        if (x >= 0 && x + 1 < this.tileMap.cols && y >= 0 && y + 1 < this.tileMap.rows) {
            // 2x2 영역이 모두 건설 가능하고 비어있는지 확인
            let canPlace = true;
            for (let dy = 0; dy < 2; dy++) {
                for (let dx = 0; dx < 2; dx++) {
                    const tile = this.tileMap.grid[y + dy][x + dx];
                    if (!tile.buildable || tile.occupied) {
                        canPlace = false; break;
                    }
                }
                if (!canPlace) break;
            }

            const distToBase = Math.hypot(x - this.tileMap.centerX, y - this.tileMap.centerY);
            if (canPlace && distToBase > 8) { // 기지에서 조금 더 멀리 배치
                this.placeResource(x, y, type);
            }
        }
    }

    placeResource(x, y, type) {
        // 2x2 중심 월드 좌표 계산
        const pos = {
            x: (x + 1) * this.tileMap.tileSize,
            y: (y + 1) * this.tileMap.tileSize
        };

        // EntityManager를 통해 리소스 생성
        const res = this.entityManager.create('resource', pos.x, pos.y, { type: type });

        // 2x2 타일 점유 처리
        for (let dy = 0; dy < 2; dy++) {
            for (let dx = 0; dx < 2; dx++) {
                this.tileMap.grid[y + dy][x + dx].occupied = true;
                this.tileMap.grid[y + dy][x + dx].type = 'resource';
            }
        }
    }

    initUI() {
        document.getElementById('restart-btn')?.addEventListener('click', () => location.reload());
        this.updateBuildMenu();
    }

    getIconSVG(type) {
        return ICONS[type] || '';
    }

    updateBuildMenu() {
        const grid = document.getElementById('build-grid');
        grid.innerHTML = '';

        const header = document.querySelector('.panel-header');
        if (!header) return;

        let items = [];

        if (this.selectedEntities.length > 0) {
            const firstEnt = this.selectedEntities[0];

            // 모든 선택된 개체가 사용자의 것인지 확인
            const isUserOwned = this.selectedEntities.every(ent => ent.ownerId === 1);
            const isEnemy = firstEnt.ownerId === 2;
            const isNeutral = firstEnt.ownerId === 3;
            const allSameType = this.selectedEntities.every(ent => ent.type === firstEnt.type);

            // 유닛 여부 판별
            const allUnits = this.selectedEntities.every(ent =>
                ent instanceof PlayerUnit || (ent.speed !== undefined && ent.hp !== 99999999)
            );

            if (isUserOwned && allUnits) {                // [아군 유닛 메뉴]
                header.textContent = this.selectedEntities.length > 1 ? `부대 (${this.selectedEntities.length})` : firstEnt.name;

                items = [
                    { id: 'move', name: '이동 (M)', icon: '🏃', action: 'unit:move', skillType: 'targeted' },
                    { id: 'stop', name: '정지 (S)', icon: '🛑', action: 'unit:stop' },
                    null,
                    { id: 'hold', name: '홀드 (H)', icon: '🛡️', action: 'unit:hold' },
                    { id: 'patrol', name: '패트롤 (P)', icon: '🔄', action: 'unit:patrol', skillType: 'targeted' },
                    { id: 'attack', name: '어택 (A)', icon: '⚔️', action: 'unit:attack', skillType: 'targeted' },
                    null, null, null
                ];

                if (allSameType) {
                    const unitType = firstEnt.type;
                    if (unitType === 'missile-launcher') {
                        items[6] = { id: 'siege', name: '시즈 모드 (O)', icon: '🏗️', action: 'unit:siege', skillType: 'state' };
                        items[7] = { id: 'manual_fire', name: '미사일 발사 (F)', icon: '🚀', action: 'unit:manual_fire', skillType: 'targeted' };
                    } else if (unitType === 'bomber' || unitType === 'cargo-plane' || unitType === 'military-truck') {
                        const isFlying = firstEnt.altitude > 0.8;
                        const isLanded = firstEnt.altitude < 0.1 || unitType === 'military-truck';

                        if (unitType === 'bomber') {
                            items[6] = {
                                id: 'bombing',
                                name: isFlying ? '폭격 (B)' : '폭격 (비행 시 가능)',
                                action: 'unit:bombing',
                                skillType: 'toggle',
                                locked: !isFlying,
                                active: firstEnt.isBombingActive
                            };
                        } else if (unitType === 'cargo-plane' || unitType === 'military-truck') {
                            items[6] = {
                                id: 'unload_all',
                                name: isLanded ? '전체 하차 (U)' : '하차 (지상 시 가능)',
                                action: 'unit:unload_all',
                                skillType: 'instant',
                                locked: !isLanded || firstEnt.cargo.length === 0
                            };

                            if (unitType === 'cargo-plane') {
                                items[7] = {
                                    id: 'combat_drop',
                                    name: isFlying ? '전투 강하 (D)' : '전투 강하 (비행 시 가능)',
                                    action: 'unit:combat_drop',
                                    skillType: 'instant',
                                    locked: !isFlying || firstEnt.cargo.length === 0,
                                    cost: 100
                                };
                            }
                        }

                        // 이착륙 버튼 동적 구성 (항공기 전용)
                        if (unitType !== 'military-truck') {
                            let actionName = '이륙 (T)';
                            let actionIcon = 'unit:takeoff';
                            if (isFlying || firstEnt.isManualLanding) {
                                actionName = '착륙 (T)';
                                actionIcon = 'unit:landing';
                            }
                            if (firstEnt.isTakeoffStarting || firstEnt.isManualLanding) {
                                actionName = firstEnt.isTakeoffStarting ? '이륙 중...' : '착륙 중...';
                            }

                            items[8] = {
                                id: 'takeoff_landing',
                                name: actionName,
                                action: 'unit:takeoff_landing',
                                skillType: 'state',
                                iconKey: actionIcon
                            };
                        }
                    }
                }
            } else if (isEnemy) {
                header.textContent = `[적] ${firstEnt.name}`;
            } else if (isNeutral) {
                header.textContent = `[중립] ${firstEnt.name}`;
            }
        } else {
            // 아무것도 선택되지 않은 상태
            header.textContent = '-';
            items = [null, null, null, null, null, null, null, null, null];
        }

        this.isHoveringUI = false;
        this.hideUITooltip();

        items.forEach(item => {
            const btn = document.createElement('div');
            btn.className = 'build-btn';

            if (!item) {
                grid.appendChild(btn);
                return;
            }

            if (item.locked) {
                btn.classList.add('locked');
            }

            if (item.active) {
                btn.classList.add('active');
            }

            // Determine which icon key to use
            const iconKey = item.iconKey || item.action || item.type || item.id;
            let iconHtml = this.getIconSVG(iconKey);

            if (!iconHtml) {
                if (item.icon) {
                    iconHtml = `<div class="btn-icon gray"><div style="font-size: 24px; display: flex; align-items: center; justify-content: center; height: 100%;">${item.icon}</div></div>`;
                }
            }

            btn.innerHTML = iconHtml || `<div class="btn-icon gray">?</div>`;

            btn.onclick = (e) => {
                e.stopPropagation();
                if (item.action) {
                    this.handleMenuAction(item.action, item);
                }
            };

            btn.addEventListener('mouseenter', (e) => {
                this.isHoveringUI = true;
                this.showUITooltip(item.name, '', e.clientX, e.clientY);
            });
            btn.addEventListener('mouseleave', () => {
                this.isHoveringUI = false;
                this.hideUITooltip();
            });

            grid.appendChild(btn);
        });
    }

    handleMenuAction(action, item) {
        if (action.startsWith('unit:')) {
            const cmd = action.split(':')[1];
            const skillType = item.skillType || 'state';

            if (skillType === 'targeted') {
                this.unitCommandMode = cmd;
                this.updateCursor();
            } else {
                this.executeUnitCommand(cmd);
            }
        }
    }
    initInput() {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // 1. 활성화된 특수 모드(명령 타겟팅, 디버그 모드) 취소
                const isDebugMode = this.debugSystem && (this.debugSystem.isSpawnSandbagMode || this.debugSystem.isSpawnAirSandbagMode || this.debugSystem.spawnUnitType || this.debugSystem.isEraserMode);
                if (this.unitCommandMode || isDebugMode) {
                    this.cancelModes();
                    this.unitCommandMode = null;
                    this.updateCursor();
                    return;
                }

                // 2. 아무것도 없으면 선택 해제 (RTS 기본 조작)
                if (this.selectedEntities.length > 0) {
                    this.selectedEntities = [];
                    this.selectedEntity = null;
                    this.updateBuildMenu();
                    this.updateCursor();
                }
            }

            // --- 부대 지정 시스템 (0-9) ---
            if (e.key >= '0' && e.key <= '9') {
                e.preventDefault();
                const groupNum = parseInt(e.key);
                const now = Date.now();

                if (e.ctrlKey) {
                    this.controlGroups[groupNum] = this.selectedEntities.filter(ent => ent.ownerId === 1 && ent.hp > 0);
                } else {
                    const group = this.controlGroups[groupNum].filter(ent => ent.active && ent.hp > 0);
                    this.controlGroups[groupNum] = group;

                    if (group.length > 0) {
                        this.selectedEntities = [...group];
                        this.selectedEntity = group[0];
                        this.updateBuildMenu();
                        this.updateCursor();

                        if (this.lastControlGroupKey === e.key && (now - this.lastControlGroupTime) < 300) {
                            this.jumpToGroup(group);
                        }
                    }
                }
                this.lastControlGroupKey = e.key;
                this.lastControlGroupTime = now;
            }

            // 스타크래프트 단축키
            if (this.selectedEntities.length > 0) {
                const key = e.key.toLowerCase();
                if (key === 'm') { this.unitCommandMode = 'move'; this.updateCursor(); }
                else if (key === 's') this.executeUnitCommand('stop');
                else if (key === 'o') this.executeUnitCommand('siege');
                else if (key === 'f') { this.unitCommandMode = 'manual_fire'; this.updateCursor(); }
                else if (key === 'h') this.executeUnitCommand('hold');
                else if (key === 'p') { this.unitCommandMode = 'patrol'; this.updateCursor(); }
                else if (key === 'a') { this.unitCommandMode = 'attack'; this.updateCursor(); }
                else if (key === 't') this.executeUnitCommand('takeoff_landing');
                else if (key === 'd') this.executeUnitCommand('combat_drop');
                else if (key === 'u') this.executeUnitCommand('unload_all');
                else if (key === 'b') {
                    const hasBomber = this.selectedEntities.some(ent => ent.type === 'bomber');
                    if (hasBomber) this.executeUnitCommand('bombing');
                }
            }
        });

        this.canvas.addEventListener('mousedown', (e) => {
            if (this.gameState !== 'playing') return;

            const rect = this.canvas.getBoundingClientRect();
            const worldX = (e.clientX - rect.left - this.camera.x) / this.camera.zoom;
            const worldY = (e.clientY - rect.top - this.camera.y) / this.camera.zoom;

            if (e.button === 0) { // LEFT CLICK
                if (this.unitCommandMode) {
                    const potentialTargets = [
                        ...this.entities.units,
                        ...this.entities.enemies,
                        ...this.entities.neutral
                    ];

                    const clickedTarget = potentialTargets.find(ent => {
                        if (!ent || !ent.active || ent.hp <= 0) return false;
                        const bounds = ent.getSelectionBounds ? ent.getSelectionBounds() : {
                            left: ent.x - 20, right: ent.x + 20, top: ent.y - 20, bottom: ent.y + 20
                        };
                        return worldX >= bounds.left && worldX <= bounds.right && worldY >= bounds.top && worldY <= bounds.bottom;
                    });

                    let canTarget = false;
                    if (clickedTarget) {
                        const relation = this.getRelation(1, clickedTarget.ownerId);
                        if (this.unitCommandMode === 'attack') {
                            canTarget = true;
                        } else {
                            if (relation !== 'self' && relation !== 'ally') canTarget = true;
                        }
                    }

                    const finalTarget = canTarget ? clickedTarget : null;
                    this.executeUnitCommand(this.unitCommandMode, worldX, worldY, finalTarget);
                } else if (this.debugSystem && this.debugSystem.isSpawnSandbagMode) {
                    this.debugSystem.executeSpawnSandbag(worldX, worldY);
                } else if (this.debugSystem && this.debugSystem.isSpawnAirSandbagMode) {
                    this.debugSystem.executeSpawnAirSandbag(worldX, worldY);
                } else if (this.debugSystem && this.debugSystem.spawnUnitType) {
                    this.debugSystem.executeSpawnUnit(worldX, worldY);
                } else if (this.debugSystem && this.debugSystem.isEraserMode) {
                    this.debugSystem.executeEraser(worldX, worldY);
                } else {
                    this.camera.selectionBox = {
                        startX: worldX,
                        startY: worldY,
                        currentX: worldX,
                        currentY: worldY
                    };
                }
            } else if (e.button === 2) { // RIGHT CLICK
                if (this.unitCommandMode) {
                    this.unitCommandMode = null;
                    this.updateCursor();
                } else if (this.selectedEntities.length > 0) {
                    const potentialTargets = [
                        ...this.entities.units,
                        ...this.entities.enemies,
                        ...this.entities.neutral
                    ];

                    const clickedTarget = potentialTargets.find(ent => {
                        if (!ent || !ent.active || ent.hp <= 0) return false;
                        const bounds = ent.getSelectionBounds ? ent.getSelectionBounds() : {
                            left: ent.x - 20, right: ent.x + 20, top: ent.y - 20, bottom: ent.y + 20
                        };
                        return worldX >= bounds.left && worldX <= bounds.right && worldY >= bounds.top && worldY <= bounds.bottom;
                    });

                    if (clickedTarget && this.getRelation(1, clickedTarget.ownerId) === 'enemy') {
                        this.executeUnitCommand('attack', clickedTarget.x, clickedTarget.y, clickedTarget);
                        return;
                    }

                    const transport = [
                        ...this.entities.cargoPlanes, 
                        ...this.entities.units.filter(u => u.type === 'military-truck' || u.type === 'cargo-plane')
                    ].find(t => {
                        if (!t || !t.active || t.hp <= 0 || t.ownerId !== 1) return false;
                        const b = t.getSelectionBounds ? t.getSelectionBounds() : {
                            left: t.x - 50, right: t.x + 50, top: t.y - 50, bottom: t.y + 50
                        };
                        return worldX >= b.left && worldX <= b.right && worldY >= b.top && worldY <= b.bottom;
                    });

                    if (transport) {
                        this.selectedEntities.forEach(u => {
                            if (u.ownerId === 1 && u.domain === 'ground') {
                                u.transportTarget = transport;
                                u.command = 'move';
                            }
                        });
                        return;
                    }

                    this.executeUnitCommand('move', worldX, worldY, clickedTarget);
                }
            }
        });

        window.addEventListener('mousemove', (e) => {
            this.camera.mouseX = e.clientX;
            this.camera.mouseY = e.clientY;

            const rect = this.canvas.getBoundingClientRect();
            const worldX = (e.clientX - rect.left - this.camera.x) / this.camera.zoom;
            const worldY = (e.clientY - rect.top - this.camera.y) / this.camera.zoom;

            if (this.camera.selectionBox) {
                this.camera.selectionBox.currentX = worldX;
                this.camera.selectionBox.currentY = worldY;
            }

            if (!this.isHoveringUI) {
                const potentialEntities = [
                    ...this.entities.units, ...this.entities.enemies,
                    ...this.entities.resources
                ];

                const hovered = potentialEntities.find(ent => {
                    if (!ent || (ent.active === false && ent.hp !== 99999999 && !ent.type?.includes('resource') && ent.covered !== true)) return false;
                    const b = ent.getSelectionBounds ? ent.getSelectionBounds() : {
                        left: ent.x - 20, right: ent.x + 20, top: ent.y - 20, bottom: ent.y + 20
                    };
                    return worldX >= b.left && worldX <= b.right && worldY >= b.top && worldY <= b.bottom;
                });

                this.hoveredEntity = hovered;
                if (hovered) {
                    this.updateTooltip(hovered, e.clientX, e.clientY);
                } else {
                    this.hideUITooltip();
                }
            }
        });

        window.addEventListener('mouseup', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const worldX = (e.clientX - rect.left - this.camera.x) / this.camera.zoom;
            const worldY = (e.clientY - rect.top - this.camera.y) / this.camera.zoom;

            if (e.button === 0) { // LEFT CLICK
                if (this.camera.selectionBox) {
                    const { startX, startY, currentX, currentY } = this.camera.selectionBox;
                    const dragDist = Math.hypot(currentX - startX, currentY - startY);

                    if (dragDist > 5) {
                        this.handleMultiSelection();
                    } else {
                        this.handleSingleSelection(worldX, worldY, e.shiftKey);
                    }
                    this.camera.selectionBox = null;
                    this.updateCursor();
                }
            }
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomSpeed = 0.1;
            const delta = e.deltaY > 0 ? -zoomSpeed : zoomSpeed;
            const oldZoom = this.camera.zoom;
            this.camera.zoom = Math.min(Math.max(0.2, this.camera.zoom + delta), 3);

            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const worldX = (mouseX - this.camera.x) / oldZoom;
            const worldY = (mouseY - this.camera.y) / oldZoom;

            this.camera.x = mouseX - worldX * this.camera.zoom;
            this.camera.y = mouseY - worldY * this.camera.zoom;
        }, { passive: false });

        this.minimapCanvas.addEventListener('mousedown', (e) => this.handleMinimapInteraction(e));
        this.minimapCanvas.addEventListener('mousemove', (e) => {
            if (e.buttons === 1) this.handleMinimapInteraction(e);
        });

        window.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    updateCursor() {
        const classes = ['cmd-move-cursor', 'cmd-attack-cursor', 'cmd-patrol-cursor'];
        this.canvas.classList.remove(...classes);

        if (this.unitCommandMode === 'move') {
            this.canvas.classList.add('cmd-move-cursor');
        } else if (this.unitCommandMode === 'attack' || this.unitCommandMode === 'manual_fire' || this.unitCommandMode === 'bombing') {
            this.canvas.classList.add('cmd-attack-cursor');
        } else if (this.unitCommandMode === 'patrol') {
            this.canvas.classList.add('cmd-patrol-cursor');
        }
        this.canvas.style.cursor = '';
    }

    executeUnitCommand(cmd, worldX = null, worldY = null, targetObject = null) {
        if (this.selectedEntities.length === 0) return;

        this.selectedEntities.forEach(unit => {
            if (unit.ownerId !== 1) return;
            unit.manualTarget = (cmd === 'attack') ? targetObject : null;
            unit.transportTarget = null;

            const skill = unit.getSkillConfig ? unit.getSkillConfig(cmd) : null;
            if (skill) {
                if (skill.type === 'targeted') {
                    if (worldX !== null && skill.handler) {
                        skill.handler.call(unit, worldX, worldY, targetObject);
                    }
                } else if (skill.handler) {
                    skill.handler.call(unit);
                }
                return;
            }

            let finalCmd = cmd;
            if (cmd === 'attack') {
                const canAttack = (unit.type === 'missile-launcher' ? unit.isSieged : (typeof unit.attack === 'function'));
                if (!canAttack) {
                    finalCmd = 'move';
                    unit.manualTarget = null;
                }
            }

            unit.command = finalCmd;
            if (finalCmd === 'stop' || finalCmd === 'hold') {
                unit.destination = null;
            } else if (finalCmd === 'move' && worldX !== null) {
                unit.destination = { x: worldX, y: worldY };
            } else if (finalCmd === 'patrol' && worldX !== null) {
                unit.patrolStart = { x: unit.x, y: unit.y };
                unit.patrolEnd = { x: worldX, y: worldY };
                unit.destination = unit.patrolEnd;
            } else if (finalCmd === 'attack' && worldX !== null) {
                unit.destination = { x: worldX, y: worldY };
            } else if (finalCmd === 'unload_all') {
                if (unit.unloadAll) unit.unloadAll();
                setTimeout(() => this.updateBuildMenu(), 500);
            }
        });
        this.unitCommandMode = null;
        this.updateCursor();
    }

    cancelModes() {
        if (this.debugSystem) {
            this.debugSystem.isSpawnSandbagMode = false;
            this.debugSystem.isSpawnAirSandbagMode = false;
            this.debugSystem.spawnUnitType = null;
            this.debugSystem.isEraserMode = false;
            
            const dbBtns = ['db-spawn-sandbag', 'db-spawn-air-sandbag', 'db-eraser', 
                           'db-spawn-tank', 'db-spawn-rifleman', 'db-spawn-sniper', 
                           'db-spawn-engineer', 'db-spawn-missile'];
            
            dbBtns.forEach(id => {
                const btn = document.getElementById(id);
                if (btn) btn.classList.remove('active');
            });
        }
    }

    handleSingleSelection(worldX, worldY, isShiftKey) {
        const potentialEntities = [
            ...this.entities.units,
            ...this.entities.enemies,
            ...this.entities.neutral
        ];

        const found = potentialEntities.find(ent => {
            if (!ent || (ent.active === false && !ent.isBoarded) || ent.isBoarded) return false;
            const bounds = ent.getSelectionBounds ? ent.getSelectionBounds() : {
                left: ent.x - 20, right: ent.x + 20, top: ent.y - 20, bottom: ent.y + 20
            };
            return worldX >= bounds.left && worldX <= bounds.right && worldY >= bounds.top && worldY <= bounds.bottom;
        });

        if (found) {
            const isEnemy = this.entities.enemies.includes(found);
            if (isEnemy) {
                this.selectedEntities = [found];
                this.selectedEntity = found;
            } else if (isShiftKey) {
                const idx = this.selectedEntities.indexOf(found);
                if (idx > -1) {
                    this.selectedEntities.splice(idx, 1);
                } else {
                    this.selectedEntities = this.selectedEntities.filter(ent => !this.entities.enemies.includes(ent));
                    this.selectedEntities.push(found);
                }
            } else {
                this.selectedEntities = [found];
                this.selectedEntity = found;
            }
        } else {
            this.selectedEntities = [];
            this.selectedEntity = null;
        }

        this.updateBuildMenu();
        this.updateCursor();
    }

    handleMultiSelection() {
        if (!this.camera.selectionBox) return;
        const { startX, startY, currentX, currentY } = this.camera.selectionBox;
        if (Math.hypot(currentX - startX, currentY - startY) < 5) return;

        const left = Math.min(startX, currentX), right = Math.max(startX, currentX);
        const top = Math.min(startY, currentY), bottom = Math.max(startY, currentY);

        this.selectedEntities = [];
        this.selectedEntity = null;

        const potentialEntities = [
            ...this.entities.units.filter(u => u.ownerId === 1)
        ];

        const selectedUnits = [];
        potentialEntities.forEach(ent => {
            if (!ent || (!ent.active && !ent.isBoarded) || ent.isBoarded) return;
            const bounds = ent.getSelectionBounds();
            const overlaps = !(bounds.right < left || bounds.left > right || bounds.bottom < top || bounds.top > bottom);
            if (overlaps) selectedUnits.push(ent);
        });

        this.selectedEntities = selectedUnits;
        if (this.selectedEntities.length > 0) this.selectedEntity = this.selectedEntities[0];

        this.updateCursor();
        this.updateBuildMenu();
    }

    handleMinimapInteraction(e) {
        const rect = this.minimapCanvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const mapWorldWidth = this.tileMap.cols * this.tileMap.tileSize;
        const mapWorldHeight = this.tileMap.rows * this.tileMap.tileSize;

        const scaleX = this.minimapCanvas.width / mapWorldWidth;
        const scaleY = this.minimapCanvas.height / mapWorldHeight;
        const scale = Math.min(scaleX, scaleY);

        const offsetX = (this.minimapCanvas.width - mapWorldWidth * scale) / 2;
        const offsetY = (this.minimapCanvas.height - mapWorldHeight * scale) / 2;

        const worldX = (mx - offsetX) / scale;
        const worldY = (my - offsetY) / scale;

        this.camera.x = this.canvas.width / 2 - worldX * this.camera.zoom;
        this.camera.y = this.canvas.height / 2 - worldY * this.camera.zoom;
    }

    updateTooltip(hovered, x, y) {
        if (!hovered) return;

        if (this.tileMap && !this.tileMap.isInSight(hovered.x, hovered.y)) {
            this.hideUITooltip();
            return;
        }

        let title = hovered.name || hovered.type;
        const isEnemy = this.entities.enemies.includes(hovered);
        if (isEnemy) title = `[적] ${title}`;

        let desc = '<div class="item-stats-box">';

        if (hovered instanceof Resource || (hovered.type === 'oil' || hovered.type === 'gold' || hovered.type === 'iron')) {
            desc += `<div class="stat-row"><span>💎 종류:</span> <span class="highlight">${hovered.name}</span></div>
                     <div class="stat-row"><span>💡 도움말:</span> <span>자원은 맵 곳곳에 흩어져 있습니다.</span></div>`;
        } else {
            desc += `<div class="stat-row"><span>❤️ 체력:</span> <span class="highlight">${Math.floor(hovered.hp)} / ${hovered.maxHp}</span></div>`;

            if (hovered.damage > 0) {
                desc += `<div class="stat-row"><span>⚔️ 공격력:</span> <span class="highlight">${hovered.damage}</span></div>`;
            }
            const displayRange = hovered.attackRange || hovered.range;
            if (displayRange > 0) {
                desc += `<div class="stat-row"><span>🔭 사거리:</span> <span class="highlight">${displayRange}</span></div>`;
            }
            if (hovered.speed > 0) {
                desc += `<div class="stat-row"><span>🏃 속도:</span> <span class="highlight">${hovered.speed}</span></div>`;
            }
            if (hovered.type?.startsWith('ammo-') && hovered.amount !== undefined) {
                desc += `<div class="stat-row"><span>📦 남은 탄약:</span> <span class="highlight">${Math.ceil(hovered.amount)} / ${hovered.maxAmount}</span></div>`;
            }
            if (hovered.cargo !== undefined) {
                const occupied = hovered.getOccupiedSize ? hovered.getOccupiedSize() : hovered.cargo.length;
                desc += `<div class="stat-row"><span>📦 적재량:</span> <span class="highlight">${occupied} / ${hovered.cargoCapacity}</span></div>`;
                if (hovered.cargo.length > 0) {
                    const cargoNames = hovered.cargo.map(u => u.name).join(', ');
                    desc += `<div class="item-stats-box text-blue">탑승 중: ${cargoNames}</div>`;
                }
            }
            if (hovered.maxAmmo > 0) {
                const ammoNames = { bullet: '총알', shell: '포탄', missile: '미사일' };
                const name = ammoNames[hovered.ammoType] || '탄약';
                const colorClass = (hovered.ammo <= 0) ? 'text-red' : 'highlight';
                desc += `<div class="stat-row"><span>🔋 ${name}:</span> <span class="${colorClass}">${Math.floor(hovered.ammo)} / ${hovered.maxAmmo}</span></div>`;
            }
            if (hovered.domain) {
                const domainMap = { ground: '지상', air: '공중', sea: '해상' };
                desc += `<div class="stat-row"><span>🌐 영역:</span> <span class="highlight">${domainMap[hovered.domain] || hovered.domain}</span></div>`;
            }
        }

        desc += `</div>`;
        this.showUITooltip(title, desc, x, y);
    }

    showUITooltip(title, desc, x, y) {
        const tooltip = document.getElementById('ui-tooltip');
        if (!tooltip) return;
        tooltip.querySelector('.tooltip-title').innerHTML = title;
        tooltip.querySelector('.tooltip-desc').innerHTML = desc;
        tooltip.classList.remove('hidden');
        this.moveUITooltip(x, y);
    }

    moveUITooltip(x, y) {
        const tooltip = document.getElementById('ui-tooltip');
        if (!tooltip) return;
        const offset = 20;
        let finalX = x + offset;
        let finalY = y + offset;
        if (finalX + tooltip.offsetWidth > window.innerWidth) finalX = x - tooltip.offsetWidth - offset;
        if (finalY + tooltip.offsetHeight > window.innerHeight) finalY = y - tooltip.offsetHeight - offset;
        tooltip.style.left = `${finalX}px`;
        tooltip.style.top = `${finalY}px`;
    }

    hideUITooltip() {
        const tooltip = document.getElementById('ui-tooltip');
        if (tooltip) tooltip.classList.add('hidden');
    }

    produceResource(type, amount, producer) {
        this.resources[type] += amount;
        return true;
    }

    update(deltaTime) {
        if (this.gameState !== 'playing') return;

        this.frameCount = (this.frameCount || 0) + 1;

        for (let i = this.effects.length - 1; i >= 0; i--) {
            const fx = this.effects[i];
            fx.timer += deltaTime;
            if (fx.timer >= fx.duration) this.effects.splice(i, 1);
        }
        this.updateEdgeScroll();

        this.visibilityTimer += deltaTime;
        if (this.visibilityTimer >= this.visibilityInterval) {
            this.updateVisibility();
            this.visibilityTimer = 0;
        }

        if (this.entityManager) {
            this.entityManager.update(deltaTime);
        }

        const processList = (list, updateFn) => {
            if (!list) return list;
            let writeIdx = 0;
            let countChanged = false;

            for (let readIdx = 0; readIdx < list.length; readIdx++) {
                const obj = list[readIdx];
                if (updateFn && !obj.isBoarded) updateFn(obj);
                let keep = true;
                if (!obj.isBoarded) {
                    if (obj.hp <= 0 || obj.active === false) {
                        keep = false;
                    }
                }
                if (keep) {
                    if (writeIdx !== readIdx) list[writeIdx] = obj;
                    writeIdx++;
                } else {
                    countChanged = true;
                    if (this.entityManager) this.entityManager.remove(obj);
                }
            }
            if (countChanged) {
                list.length = writeIdx;
                this.updatePopulation();
            }
            return list;
        };

        const oldUnitsLen = this.entities.units.length;
        this.entities.units = processList(this.entities.units, (u) => u.update(deltaTime));
        if (this.entities.units.length !== oldUnitsLen) this.updatePopulation();

        this.entities.cargoPlanes = processList(this.entities.cargoPlanes, (p) => p.update(deltaTime));
        this.entities.neutral = processList(this.entities.neutral, (n) => n.update(deltaTime));
        this.entities.projectiles = this.entities.projectiles.filter(p => p.active || p.arrived);
        this.entities.projectiles.forEach(proj => proj.update(deltaTime, this));

        this.entities.enemies = this.entities.enemies.filter(enemy => {
            enemy.update(deltaTime, null, [], this);
            if (!enemy.active || enemy.hp <= 0) {
                if (enemy.active) this.resources.gold += 10;
                return false;
            }
            return true;
        });

        this.refreshFlyerUI();
        this.updateResourceUI();
    }

    render() {
        if (this.renderSystem) {
            this.renderSystem.render();
            this.ctx.save();
            this.ctx.translate(this.camera.x, this.camera.y);
            this.ctx.scale(this.camera.zoom, this.camera.zoom);
            this.renderOverlays();
            this.ctx.restore();
            
            if (this.visibilityTimer === 0) {
                this.renderMinimap();
            } else if (!this._lastMinimapRendered) {
                this.renderMinimap();
                this._lastMinimapRendered = true;
            }
        }
    }

    renderMinimap() {
        const mCtx = this.minimapCtx;
        const mWidth = this.minimapCanvas.width;
        const mHeight = this.minimapCanvas.height;
        mCtx.clearRect(0, 0, mWidth, mHeight);
        const mapWorldWidth = this.tileMap.cols * this.tileMap.tileSize;
        const mapWorldHeight = this.tileMap.rows * this.tileMap.tileSize;
        const scale = Math.min(mWidth / mapWorldWidth, mHeight / mapWorldHeight);
        const offsetX = (mWidth - mapWorldWidth * scale) / 2;
        const offsetY = (mHeight - mapWorldHeight * scale) / 2;
        mCtx.save();
        mCtx.translate(offsetX, offsetY);
        mCtx.scale(scale, scale);

        mCtx.fillStyle = '#0a0a0a';
        mCtx.fillRect(0, 0, mapWorldWidth, mapWorldHeight);
        mCtx.imageSmoothingEnabled = false;
        mCtx.drawImage(this.minimapCacheCanvas, 0, 0, mapWorldWidth, mapWorldHeight);

        const isVisible = (worldX, worldY) => {
            const g = this.tileMap.worldToGrid(worldX, worldY);
            return this.tileMap.grid[g.y] && this.tileMap.grid[g.y][g.x] && this.tileMap.grid[g.y][g.x].visible;
        };

        this.entities.units.forEach(u => {
            if (u.isBoarded) return;
            if (isVisible(u.x, u.y)) {
                const relation = this.getRelation(1, u.ownerId);
                mCtx.fillStyle = (relation === 'self' || relation === 'ally') ? '#39ff14' : '#ff3131';
                mCtx.fillRect(u.x - 10, u.y - 10, 20, 20);
            }
        });

        this.entities.enemies.forEach(e => {
            if (e.isBoarded) return;
            if (isVisible(e.x, e.y)) {
                mCtx.fillStyle = '#ff3131';
                mCtx.fillRect(e.x - 10, e.y - 10, 20, 20);
            }
        });

        this.entities.neutral.forEach(n => {
            if (n.isBoarded) return;
            if (isVisible(n.x, n.y)) {
                mCtx.fillStyle = '#ffff00';
                mCtx.fillRect(n.x - 10, n.y - 10, 20, 20);
            }
        });

        this.entities.resources.forEach(r => {
            if (isVisible(r.x, r.y)) {
                mCtx.fillStyle = r.color;
                mCtx.fillRect(r.x - 15, r.y - 15, 30, 30);
            }
        });

        const viewX = -this.camera.x / this.camera.zoom;
        const viewY = -this.camera.y / this.camera.zoom;
        const viewW = this.canvas.width / this.camera.zoom;
        const viewH = this.canvas.height / this.camera.zoom;

        mCtx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        mCtx.lineWidth = 15;
        mCtx.strokeRect(viewX, viewY, viewW, viewH);
        mCtx.restore();
    }

    updateVisibility() {
        if (!this.tileMap) return;
        if (this.debugSystem && this.debugSystem.isFullVision) return;

        for (let y = 0; y < this.tileMap.rows; y++) {
            for (let x = 0; x < this.tileMap.cols; x++) {
                this.tileMap.grid[y][x].inSight = false;
            }
        }

        const reveal = (worldX, worldY, radius) => {
            const grid = this.tileMap.worldToGrid(worldX, worldY);
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const nx = grid.x + dx;
                    const ny = grid.y + dy;
                    if (nx >= 0 && nx < this.tileMap.cols && ny >= 0 && ny < this.tileMap.rows) {
                        if (dx * dx + dy * dy <= radius * radius) {
                            this.tileMap.grid[ny][nx].visible = true;
                            this.tileMap.grid[ny][nx].inSight = true;
                        }
                    }
                }
            }
        };

        this.entities.units.forEach(unit => {
            if (unit.alive) {
                reveal(unit.x, unit.y, unit.visionRange || 5);
            }
        });

        if (this.tileMap && this.tileMap.updateFogCanvas) {
            this.tileMap.updateFogCanvas();
        }
        this.updateMinimapCache();
    }

    updateMinimapCache() {
        if (!this.minimapCacheCtx) return;
        const mCtx = this.minimapCacheCtx;
        const cols = this.tileMap.cols;
        const rows = this.tileMap.rows;
        const imageData = mCtx.createImageData(cols, rows);
        const buffer = new Uint32Array(imageData.data.buffer);
        const SOIL = 0xFF37405D;
        const DIRT = 0xFF1A1A1A;
        const HIDDEN = 0x00000000;
        for (let y = 0; y < rows; y++) {
            const rowOffset = y * cols;
            for (let x = 0; x < cols; x++) {
                const tile = this.tileMap.grid[y][x];
                if (tile.visible) {
                    buffer[rowOffset + x] = (tile.terrain === 'fertile-soil' ? SOIL : DIRT);
                } else {
                    buffer[rowOffset + x] = HIDDEN;
                }
            }
        }
        mCtx.putImageData(imageData, 0, 0);
    }

    updatePopulation() {
        this.resources.maxPopulation = 200;
        let currentPop = 0;
        this.entities.units.forEach(unit => {
            if (unit.ownerId === 1 && (unit.active || unit.isBoarded) && unit.hp > 0) {
                currentPop += unit.popCost || 0;
            }
        });
        this.resources.population = currentPop;
    }

    updateResourceUI() {
        const goldEl = document.getElementById('resource-gold');
        const oilEl = document.getElementById('resource-oil');
        const ironEl = document.getElementById('resource-iron');
        if (goldEl) goldEl.textContent = Math.floor(this.resources.gold);
        if (oilEl) oilEl.textContent = Math.floor(this.resources.oil);
        if (ironEl) ironEl.textContent = Math.floor(this.resources.iron);
        const popValue = document.getElementById('resource-population');
        if (popValue) {
            popValue.textContent = `${this.resources.population} / ${this.resources.maxPopulation}`;
            popValue.style.color = (this.resources.population > this.resources.maxPopulation) ? '#ff3131' : '#fff';
        }
    }

    refreshFlyerUI() {
        const selectedFlyer = this.selectedEntities.find(ent => ent.type === 'bomber' || ent.type === 'cargo-plane');
        if (selectedFlyer) {
            const isFlying = selectedFlyer.altitude > 0.8;
            const isManeuvering = selectedFlyer.isTakeoffStarting || selectedFlyer.isManualLanding;
            const isBombing = selectedFlyer.isBombingActive || false;
            if (this._lastFlyerFlying !== isFlying || this._lastFlyerManeuvering !== isManeuvering || this._lastFlyerBombing !== isBombing) {
                this.updateBuildMenu();
                this._lastFlyerFlying = isFlying;
                this._lastFlyerManeuvering = isManeuvering;
                this._lastFlyerBombing = isBombing;
            }
        } else {
            this._lastFlyerFlying = this._lastFlyerManeuvering = this._lastFlyerBombing = null;
        }
    }

    updateEdgeScroll() {
        const { mouseX, mouseY, edgeThreshold, edgeScrollSpeed } = this.camera;
        const width = this.canvas.width;
        const height = this.canvas.height;
        let direction = '';
        if (mouseX < edgeThreshold) { this.camera.x += edgeScrollSpeed; direction += 'w'; }
        else if (mouseX > width - edgeThreshold) { this.camera.x -= edgeScrollSpeed; direction += 'e'; }
        if (mouseY < edgeThreshold) { this.camera.y += edgeScrollSpeed; direction = 'n' + direction; }
        else if (mouseY > height - edgeThreshold) { this.camera.y -= edgeScrollSpeed; direction = 's' + direction; }
        const scClasses = ['sc-n', 'sc-s', 'sc-e', 'sc-w', 'sc-ne', 'sc-nw', 'sc-se', 'sc-sw'];
        const oldDirection = scClasses.find(cls => document.body.classList.contains(cls));
        document.body.classList.remove(...scClasses);
        if (direction) document.body.classList.add(`sc-${direction}`);
        if (direction !== (oldDirection ? oldDirection.replace('sc-', '') : '')) this.updateCursor();
    }

    loop(timestamp) {
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;
        this.update(deltaTime);
        this.render();
        if (this.hoveredEntity) {
            if (this.hoveredEntity.hp <= 0 && this.hoveredEntity.maxHp !== 99999999) {
                this.hoveredEntity = null;
                this.hideUITooltip();
            } else {
                this.updateTooltip(this.hoveredEntity, this.camera.mouseX, this.camera.mouseY);
            }
        }
        requestAnimationFrame((t) => this.loop(t));
    }

    renderOverlays() {
        const mouseWorldX = (this.camera.mouseX - this.camera.x) / this.camera.zoom;
        const mouseWorldY = (this.camera.mouseY - this.camera.y) / this.camera.zoom;
        if (this.selectedEntities.length > 0) {
            this.ctx.save();
            const showPathLimit = 15;
            let pathCount = 0;
            this.selectedEntities.forEach(ent => {
                const relation = this.getRelation(1, ent.ownerId);
                if (relation === 'self') this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
                else if (relation === 'enemy') this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
                else if (relation === 'neutral') this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
                else if (relation === 'ally') this.ctx.strokeStyle = 'rgba(0, 0, 255, 0.8)';
                else this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                const bounds = ent.getSelectionBounds ? ent.getSelectionBounds() : {
                    left: ent.x - 20, right: ent.x + 20, top: ent.y - 20, bottom: ent.y + 20
                };
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
                if ((relation === 'self' || relation === 'ally') && ent.attackRange) {
                    this.ctx.beginPath();
                    this.ctx.arc(ent.x, ent.y, ent.attackRange, 0, Math.PI * 2);
                    this.ctx.globalAlpha = 0.15;
                    this.ctx.setLineDash([5, 5]);
                    this.ctx.stroke();
                    this.ctx.setLineDash([]);
                    this.ctx.globalAlpha = 1.0;
                }
            });
            this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
            this.ctx.lineWidth = 1.5;
            this.ctx.setLineDash([5, 5]);
            for (let i = 0; i < this.selectedEntities.length; i++) {
                const ent = this.selectedEntities[i];
                if (!ent.destination) continue;
                pathCount++;
                if (pathCount > showPathLimit) break;
                this.ctx.beginPath();
                this.ctx.moveTo(ent.x, ent.y);
                if (ent.path && ent.path.length > 0) {
                    for (const p of ent.path) this.ctx.lineTo(p.x, p.y);
                } else {
                    this.ctx.lineTo(ent.destination.x, ent.destination.y);
                }
                this.ctx.stroke();
                const dest = ent.destination;
                const m = 5;
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.moveTo(dest.x - m, dest.y - m); this.ctx.lineTo(dest.x + m, dest.y + m);
                this.ctx.moveTo(dest.x + m, dest.y - m); this.ctx.lineTo(dest.x - m, dest.y + m);
                this.ctx.stroke();
            }
            this.ctx.restore();
            const targetsToHighlight = new Set();
            this.selectedEntities.forEach(selUnit => {
                const mTarget = selUnit.manualTarget;
                if (mTarget && (mTarget.active !== false) && (mTarget.alive !== false) && (mTarget.hp > 0)) {
                    targetsToHighlight.add(mTarget);
                }
                if (selUnit.type === 'missile-launcher' && selUnit.isFiring && selUnit.pendingFirePos) {
                    const fireTarget = [...this.entities.enemies, ...this.entities.neutral].find(ent =>
                        (ent.active !== false && ent.alive !== false) && Math.hypot(ent.x - selUnit.pendingFirePos.x, ent.y - selUnit.pendingFirePos.y) < 60
                    );
                    if (fireTarget) targetsToHighlight.add(fireTarget);
                }
            });
            if (this.unitCommandMode === 'manual_fire') {
                const hoverTarget = [...this.entities.enemies, ...this.entities.neutral].find(ent => {
                    if (ent.active === false || ent.alive === false) return false;
                    const b = ent.getSelectionBounds ? ent.getSelectionBounds() : {
                        left: ent.x - 20, right: ent.x + 20, top: ent.y - 20, bottom: ent.y + 20
                    };
                    return mouseWorldX >= b.left && mouseWorldX <= b.right && mouseWorldY >= b.top && mouseWorldY <= b.bottom;
                });
                if (hoverTarget) targetsToHighlight.add(hoverTarget);
            }
            targetsToHighlight.forEach(target => {
                const bounds = target.getSelectionBounds ? target.getSelectionBounds() : {
                    left: target.x - 20, right: target.x + 20, top: target.y - 20, bottom: target.y + 20
                };
                const padding = 8;
                const tW = (bounds.right - bounds.left) + padding * 2;
                const tH = (bounds.bottom - bounds.top) + padding * 2;
                const tX = bounds.left - padding;
                const tY = bounds.top - padding;
                this.ctx.save();
                this.ctx.strokeStyle = '#ff3131';
                this.ctx.lineWidth = 3;
                const pulse = Math.sin(Date.now() / 150) * 0.5 + 0.5;
                this.ctx.globalAlpha = 0.5 + pulse * 0.5;
                this.ctx.strokeRect(tX, tY, tW, tH);
                const len = 12;
                this.ctx.beginPath();
                this.ctx.moveTo(tX, tY + len); this.ctx.lineTo(tX, tY); this.ctx.lineTo(tX + len, tY);
                this.ctx.moveTo(tX + tW - len, tY); this.ctx.lineTo(tX + tW, tY); this.ctx.lineTo(tX + tW, tY + len);
                this.ctx.moveTo(tX, tY + tH - len); this.ctx.lineTo(tX, tY + tH); this.ctx.lineTo(tX + len, tY + tH);
                this.ctx.moveTo(tX + tW - len, tY + tH); this.ctx.lineTo(tX + tW, tY + tH); this.ctx.lineTo(tX + tW, tY + tH - len);
                this.ctx.stroke();
                this.ctx.fillStyle = '#ff3131';
                this.ctx.font = 'bold 12px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('TARGET', tX + tW / 2, tY - 10);
                this.ctx.restore();
            });
        }
        if (this.selectedEntity && !this.selectedEntities.includes(this.selectedEntity)) {
            this.ctx.save();
            this.ctx.shadowBlur = 5;
            this.ctx.shadowColor = 'rgba(0, 255, 204, 0.5)';
            const bounds = this.selectedEntity.getSelectionBounds();
            if (this.selectedEntity.attackRange) {
                this.ctx.save();
                this.ctx.beginPath();
                this.ctx.arc(this.selectedEntity.x, this.selectedEntity.y, this.selectedEntity.attackRange, 0, Math.PI * 2);
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                this.ctx.setLineDash([5, 5]);
                this.ctx.stroke();
                this.ctx.restore();
            }
            this.ctx.restore();
        }
        if (this.camera.selectionBox) {
            this.ctx.save();
            this.ctx.strokeStyle = '#00ff00';
            this.ctx.lineWidth = 2;
            this.ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
            const { startX, startY, currentX, currentY } = this.camera.selectionBox;
            const w = currentX - startX;
            const h = currentY - startY;
            this.ctx.strokeRect(startX, startY, w, h);
            this.ctx.fillRect(startX, startY, w, h);
            this.ctx.restore();
        }
        this.renderMinimap();
    }

    start() {
        requestAnimationFrame((t) => this.loop(t));
    }

    jumpToGroup(group) {
        if (!group || group.length === 0) return;
        let avgX = 0, avgY = 0;
        group.forEach(u => { avgX += u.x; avgY += u.y; });
        avgX /= group.length; avgY /= group.length;
        this.camera.x = this.canvas.width / 2 - avgX * this.camera.zoom;
        this.camera.y = this.canvas.height / 2 - avgY * this.camera.zoom;
    }
}