import { TileMap } from '../map/TileMap.js';
import { Entity, PlayerUnit, Base, Enemy, Projectile, Resource, Wall, Airport, Refinery, GoldMine, IronMine, Storage, AmmoFactory, AmmoBox, MilitaryTruck, CargoPlane, ScoutPlane, Bomber, Artillery, AntiAirVehicle, Armory, Tank, MissileLauncher, Rifleman, Sniper, Barracks, CombatEngineer, Apartment } from '../entities/Entities.js';
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

        this.entityClasses = { Entity, PlayerUnit, Base, Enemy, Projectile, Resource, Wall, Airport, Refinery, GoldMine, IronMine, Storage, AmmoFactory, AmmoBox, MilitaryTruck, CargoPlane, ScoutPlane, Bomber, Artillery, AntiAirVehicle, Armory, Tank, MissileLauncher, Rifleman, Sniper, Barracks, CombatEngineer, Apartment };
        this.tileMap = new TileMap(this.canvas);
        this.pathfinding = new Pathfinding(this);

        // EntityManager 초기화 (새로운 최적화 시스템)
        this.entityManager = new EntityManager(this);
        this.renderSystem = new RenderSystem(this);

        // 엔티티 타입 등록
        this.registerEntityTypes();

        const basePos = this.tileMap.gridToWorld(this.tileMap.centerX, this.tileMap.centerY - 0.5);

        // 기존 entities 구조 유지 (하위 호환성)
        // EntityManager의 entities 객체를 직접 참조하여 기존 코드와 호환
        this.entities = this.entityManager.entities;

        // Base 생성
        const [tw, th] = [9, 6];
        const gx = this.tileMap.centerX - 4;
        const gy = this.tileMap.centerY - 3;

        // EntityManager를 통해 Base 생성 (자동 등록됨)
        const b = this.entityManager.create('base',
            (gx + tw / 2) * this.tileMap.tileSize,
            (gy + th / 2) * this.tileMap.tileSize,
            { gridX: gx, gridY: gy, type: 'base' }
        );
        this.entities.base = b;

        this.initResources();

        // --- 초기 유닛 배치 (사령부 주변 대열 정렬) ---
        const startX = basePos.x;
        const spX = 90; // 가로 간격
        const spY = 90; // 세로 간격

        // [북쪽 배치] 항공 전력 (지상 상태로 대기)
        const airY = basePos.y - 180;
        const startBomber = new Bomber(startX - spX, airY, this);
        const startCargo = new CargoPlane(startX, airY, this);
        const startScout = new ScoutPlane(startX + spX, airY, this);

        // [남쪽 배치] 지상군 시작점
        const groundY = basePos.y + 180;

        // 1열: 기갑 및 중화기
        const startTank = new Tank(startX - spX, groundY, this);
        const startMissile = new MissileLauncher(startX, groundY, this);
        const startAntiAir = new AntiAirVehicle(startX + spX, groundY, this);

        // 2열: 보병 및 지원 화력
        const startSniper = new Sniper(startX - spX, groundY + spY, this);
        const startInfantry = new Rifleman(startX, groundY + spY, this);
        const startArtillery = new Artillery(startX + spX, groundY + spY, this);

        // 3열: 공병대 및 수송 트럭
        const startEngineers = [
            new CombatEngineer(startX - spX, groundY + spY * 2, this),
            new CombatEngineer(startX, groundY + spY * 2, this),
            new CombatEngineer(startX + spX, groundY + spY * 2, this),
            new MilitaryTruck(startX + spX * 2, groundY + spY * 2, this)
        ];

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
            ...startEngineers,
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

        // 테스트용 중립 유닛 (플레이어 3) - 조금 더 멀리 배치
        const neutralTank = new Tank(basePos.x - 350, basePos.y - 100, this);
        neutralTank.ownerId = 3;
        neutralTank.name = "중립 전차 (P3)";

        const neutralDrone = new ScoutPlane(basePos.x - 450, basePos.y - 100, this);
        neutralDrone.ownerId = 3;
        neutralDrone.name = "정찰 무인기 (P3)";

        this.entities.units.push(neutralTank, neutralDrone);
        this.entityManager.allEntities.push(neutralTank, neutralDrone);
        this.entityManager.spatialGrid.add(neutralTank);
        this.entityManager.spatialGrid.add(neutralDrone);

        // 초기 적 유닛 (플레이어 2 소유)
        // (필요 시 여기에 Enemy 인스턴스 생성 및 ownerId = 2 부여)

        this.updateVisibility();

        this.buildingRegistry = {
            'wall': { cost: 15, size: [1, 1], className: 'Wall', list: 'walls', buildTime: 1 },
            'airport': { cost: 500, size: [5, 7], className: 'Airport', list: 'airports', buildTime: 1 },
            'apartment': { cost: 800, size: [4, 5], className: 'Apartment', list: 'apartments', buildTime: 1 },
            'refinery': { cost: 300, size: [2, 2], className: 'Refinery', list: 'refineries', onResource: 'oil', buildTime: 1 },
            'gold-mine': { cost: 400, size: [2, 2], className: 'GoldMine', list: 'goldMines', onResource: 'gold', buildTime: 1 },
            'iron-mine': { cost: 400, size: [2, 2], className: 'IronMine', list: 'ironMines', onResource: 'iron', buildTime: 1 },
            'storage': { cost: 200, size: [4, 3], className: 'Storage', list: 'storage', buildTime: 1 },
            'ammo-factory': { cost: 1000, size: [4, 3], className: 'AmmoFactory', list: 'ammoFactories', buildTime: 1 },
            'armory': { cost: 600, size: [4, 3], className: 'Armory', list: 'armories', buildTime: 1 },
            'barracks': { cost: 400, size: [3, 3], className: 'Barracks', list: 'barracks', buildTime: 1 },
            'base': { cost: 0, size: [9, 6], className: 'Base', list: 'base' }
        };

        this.resources = { gold: 999999, oil: 0, iron: 0, population: 0, maxPopulation: 20 };
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
        this.selectedBuildType = null;
        this.isBuildMode = false;
        this.isSellMode = false;
        this.isSkillMode = false;
        this.selectedSkill = null;
        this.unitCommandMode = null;
        this.selectedAirport = null;
        this.selectedEntity = null;
        this.selectedEntities = [];
        this.currentMenuName = 'main';
        this.hoveredEntity = null; // 호버 중인 엔티티 저장용
        this.isHoveringUI = false;
        this.effects = []; // 시각 효과(파티클 등) 관리용 배열 추가
        this.lastPlacedGrid = { x: -1, y: -1 };
        this.isEngineerBuilding = false;
        this.currentBuildSessionQueue = null;

        // Camera State
        const baseWorldPos = this.entities.base;
        const initialZoom = 0.8;
        this.camera = {
            x: this.canvas.width / 2 - baseWorldPos.x * initialZoom,
            y: this.canvas.height / 2 - baseWorldPos.y * initialZoom,
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
        em.register('engineer', CombatEngineer, 'units');
        em.register('military-truck', MilitaryTruck, 'units');
        em.register('cargo-plane', CargoPlane, 'units');
        em.register('scout-plane', ScoutPlane, 'units');
        em.register('bomber', Bomber, 'units');
        em.register('enemy', Enemy, 'enemies');

        // 건물
        em.register('base', Base, 'base');
        em.register('barracks', Barracks, 'barracks');
        em.register('armory', Armory, 'armories');
        em.register('airport', Airport, 'airports');
        em.register('ammo-factory', AmmoFactory, 'ammoFactories');
        em.register('refinery', Refinery, 'refineries');
        em.register('gold-mine', GoldMine, 'goldMines');
        em.register('iron-mine', IronMine, 'ironMines');
        em.register('storage', Storage, 'storage');
        em.register('apartment', Apartment, 'apartments');
        em.register('wall', Wall, 'walls');

        // 자원 및 아이템
        em.register('resource', Resource, 'resources');
        em.register('ammo-box', AmmoBox, 'units');

        // 투사체
        em.register('projectile', Projectile, 'projectiles');
    }

    // [자동화] 엔진이 관리하는 모든 건물 인스턴스를 동적으로 수집 (캐싱 적용)
    getAllBuildings() {
        if (this.cachedBuildings && this.lastCacheFrame === this.frameCount) {
            return this.cachedBuildings;
        }

        const all = [];
        const seenLists = new Set();

        // 1. 레지스트리에 등록된 모든 건물 리스트 순회
        for (const type in this.buildingRegistry) {
            const listName = this.buildingRegistry[type].list;
            if (listName && this.entities[listName] && !seenLists.has(listName)) {
                const entry = this.entities[listName];
                if (Array.isArray(entry)) {
                    all.push(...entry);
                } else if (entry instanceof Entity) {
                    all.push(entry);
                }
                seenLists.add(listName);
            }
        }

        // 2. 레지스트리에 없더라도 별도로 관리되는 특수 객체 체크
        if (this.entities.base && !all.includes(this.entities.base)) {
            all.push(this.entities.base);
        }

        this.cachedBuildings = all;
        this.lastCacheFrame = this.frameCount;
        return all;
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

    // 시각 효과 추가 메서드
    addEffect(type, x, y, color = '#fff', text = '') {
        const effect = {
            type, x, y, color, text,
            timer: 0,
            duration: 500, // 기본 지속 시간 0.5초
            active: true
        };

        // 타입별 세부 설정
        if (type === 'bullet') {
            effect.duration = 200;
            effect.particles = Array.from({ length: 3 }, () => ({
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                size: 1 + Math.random() * 2
            }));
        } else if (type === 'explosion') {
            effect.duration = 400;
            effect.radius = 5;
        } else if (type === 'flak') {
            effect.duration = 300;
            effect.radius = 15;
            effect.particles = Array.from({ length: 5 }, () => ({
                angle: Math.random() * Math.PI * 2,
                dist: Math.random() * 10,
                size: 2 + Math.random() * 3
            }));
        } else if (type === 'system') {
            effect.duration = 1500; // 시스템 텍스트는 좀 더 길게
        }

        this.effects.push(effect);
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

        // 안전장치: 공병이 선택되지 않았다면 건설 모드 강제 해제
        const hasEngineer = this.selectedEntities.some(ent => ent.type === 'engineer');
        if (!hasEngineer) {
            this.isEngineerBuilding = false;
        }

        let menuType = 'main';
        let items = [];

        // 유닛 명령 메뉴가 건설 메뉴보다 우선순위가 높아야 함
        if (this.selectedEntities.length > 0 && !this.isEngineerBuilding) {
            const firstEnt = this.selectedEntities[0];

            // 모든 선택된 개체가 사용자의 것인지 확인
            const isUserOwned = this.selectedEntities.every(ent => ent.ownerId === 1);
            const isEnemy = firstEnt.ownerId === 2;
            const isNeutral = firstEnt.ownerId === 3;
            const allSameType = this.selectedEntities.every(ent => ent.type === firstEnt.type);

            // 유닛 여부 판별 (PlayerUnit 상속 여부 또는 speed 속성 존재 여부)
            const allUnits = this.selectedEntities.every(ent =>
                ent instanceof PlayerUnit || (ent.speed !== undefined && ent.hp !== 99999999 && !ent.type?.includes('turret'))
            );

            if (isUserOwned && allUnits) {                // [아군 유닛 메뉴]
                menuType = 'unit';
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
                    if (unitType === 'engineer') {
                        items[6] = { id: 'engineer_build', name: '건설 (B)', action: 'menu:engineer_build', skillType: 'state' };
                    } else if (unitType === 'missile-launcher') {
                        items[6] = { id: 'siege', name: '시즈 모드 (O)', icon: '🏗️', action: 'unit:siege', skillType: 'state' };
                        items[7] = { id: 'manual_fire', name: '미사일 발사 (F)', icon: '🚀', action: 'unit:manual_fire', skillType: 'targeted' };
                    } else if (unitType === 'bomber' || unitType === 'cargo-plane' || unitType === 'military-truck') {
                        const isFlying = firstEnt.altitude > 0.8;
                        const isLanded = firstEnt.altitude < 0.1 || unitType === 'military-truck';
                        const isManeuvering = firstEnt.isTakeoffStarting || firstEnt.isManualLanding;

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
                            if (isManeuvering) {
                                actionName = firstEnt.isTakeoffStarting ? '이륙 중...' : '착륙 중...';
                            }

                            items[8] = {
                                id: 'takeoff_landing',
                                name: actionName,
                                action: 'unit:takeoff_landing',
                                skillType: 'state',
                                iconKey: actionIcon,
                                active: isManeuvering
                            };
                        }
                    }
                }
            } else if (isEnemy) {
                header.textContent = `[적] ${firstEnt.name}`;
                items = [null, null, null, null, null, null, { type: 'menu:main', name: '닫기', action: 'menu:main' }, null, null];
            } else if (isNeutral) {
                header.textContent = `[중립] ${firstEnt.name}`;
                items = [null, null, null, null, null, null, null, null, null];
            } else if (isUserOwned && allSameType) {
                // [아군 건물 메뉴]
                const type = firstEnt.type;
                header.textContent = this.selectedEntities.length > 1 ? `${firstEnt.name} (${this.selectedEntities.length})` : firstEnt.name;

                if (type === 'armory') {
                    items = [
                        { type: 'skill-tank', name: '전차 생산', cost: 300, action: 'skill:tank' },
                        { type: 'skill-missile', name: '미사일 생산', cost: 500, action: 'skill:missile' },
                        { type: 'skill-artillery', name: '자주포 생산', cost: 800, action: 'skill:artillery' },
                        { type: 'skill-anti-air', name: '대공차량 생산', cost: 400, action: 'skill:anti-air' },
                        { type: 'skill-truck', name: '군용 트럭 생산', cost: 400, action: 'skill:military-truck' },
                        null, { type: 'menu:main', name: '취소', action: 'menu:main' }, null, null
                    ];
                } else if (type === 'barracks') {
                    items = [
                        { type: 'skill-rifleman', name: '소총병 생산', cost: 100, action: 'skill:rifleman' },
                        { type: 'skill-sniper', name: '저격수 생산', cost: 250, action: 'skill:sniper' },
                        null, null, null, null, { type: 'menu:main', name: '취소', action: 'menu:main' }, null, null
                    ];
                } else if (type === 'airport') {
                    items = [
                        { type: 'skill:scout-plane', name: '정찰기 생산', cost: 100, action: 'skill:scout-plane' },
                        { type: 'skill:bomber', name: '폭격기 생산', cost: 1200, action: 'skill:bomber' },
                        { type: 'skill:cargo-plane', name: '수송기 생산', cost: 500, action: 'skill:cargo-plane' },
                        null, null, null, { type: 'menu:main', name: '취소', action: 'menu:main' }, null, null
                    ];
                } else if (type === 'storage') {
                    items = [
                        null, null, null, null, null, null, { type: 'menu:main', name: '취소', action: 'menu:main' }, null, null
                    ];
                } else if (type === 'base') {
                    items = [
                        { type: 'skill-engineer', name: '공병 생산', cost: 150, action: 'skill:engineer' },
                        null, null, null, null, null, null, null, null
                    ];
                } else if (type === 'apartment') {
                    // 아파트(벙커) 전용 메뉴
                    items = [
                        { id: 'unload_all', name: '전원 출동 (U)', icon: '🚪', action: 'unit:unload_all', skillType: 'instant', locked: firstEnt.cargo.length === 0 },
                        null, null, null, null, null, { type: 'menu:main', name: '취소', action: 'menu:main' }, null, { type: 'toggle:sell', name: '판매', action: 'toggle:sell' }
                    ];
                } else if (type === 'ammo-factory') {
                    items = [
                        { type: 'skill-ammo-bullet', name: '총알 탄약 상자', cost: 100, action: 'skill:bullet' },
                        { type: 'skill-ammo-shell', name: '포탄 탄약 상자', cost: 200, action: 'skill:shell' },
                        { type: 'skill-ammo-missile', name: '미사일 탄약 상자', cost: 300, action: 'skill:missile' },
                        null, null, null, { type: 'menu:main', name: '취소', action: 'menu:main' }, null, null
                    ];
                } else {
                    items = [
                        null, null, null, null, null, null, { type: 'menu:main', name: '취소', action: 'menu:main' }, null,
                        { type: 'toggle:sell', name: '판매', action: 'toggle:sell' }
                    ];
                }
            } else {
                header.textContent = `다중 선택 (${this.selectedEntities.length})`;
                items = [null, null, null, null, null, null, { type: 'menu:main', name: '취소', action: 'menu:main' }, null, null];
            }
        } else if (this.isEngineerBuilding) {
            // 공병 건설 메뉴 (공병이 선택된 상태에서 '건설'을 눌렀을 때만 진입)
            header.textContent = '공병 건설';

            if (this.currentMenuName === 'industry') {
                header.textContent = '산업 시설';
                items = [
                    { type: 'refinery', name: '정제소', cost: 300 }, { type: 'gold-mine', name: '금 채굴장', cost: 400 },
                    { type: 'iron-mine', name: '제철소', cost: 400 }, { type: 'storage', name: '보급고', cost: 200 },
                    null, null, { type: 'menu:main', name: '뒤로', action: 'menu:main' }, null, { type: 'toggle:sell', name: '판매', action: 'toggle:sell' }
                ];
            } else if (this.currentMenuName === 'military') {
                header.textContent = '군사 시설';
                items = [
                    { type: 'armory', name: '병기창', cost: 600 }, { type: 'airport', name: '공항', cost: 500 },
                    { type: 'barracks', name: '병영', cost: 400 }, { type: 'ammo-factory', name: '탄약 공장', cost: 1000 },
                    null, null, { type: 'menu:main', name: '뒤로', action: 'menu:main' }, null, { type: 'toggle:sell', name: '판매', action: 'toggle:sell' }
                ];
            } else if (this.currentMenuName === 'city') {
                header.textContent = '도시 시설';
                items = [
                    { type: 'apartment', name: '아파트', cost: 800 }, null, null, null, null, null, { type: 'menu:main', name: '뒤로', action: 'menu:main' }, null, { type: 'toggle:sell', name: '판매', action: 'toggle:sell' }
                ];
            } else {
                items = [
                    { type: 'menu:city', name: '도시', action: 'menu:city' },
                    { type: 'menu:power', name: '산업', action: 'menu:industry' }, { type: 'menu:military', name: '군사', action: 'menu:military' },
                    { type: 'wall', name: '철조망', cost: 15 }, null,
                    null,
                    null,
                    { type: 'toggle:sell', name: '판매', action: 'toggle:sell' }
                ];
                // 6번 슬롯에 '취소(명령으로 복귀)' 버튼
                items[6] = { id: 'back_to_unit', name: '명령 (ESC)', icon: '🔙', action: 'menu:unit_cmds' };
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

            if (item.action === 'toggle:sell' && this.isSellMode) {
                btn.classList.add('active');
            } else if (item.type === this.selectedBuildType && this.isBuildMode) {
                btn.classList.add('active');
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

            // --- Mandatory Icon Check & Fallback to item.icon (Emoji) ---
            if (!iconHtml) {
                if (item.icon) {
                    iconHtml = `<div class="btn-icon gray"><div style="font-size: 24px; display: flex; align-items: center; justify-content: center; height: 100%;">${item.icon}</div></div>`;
                } else if (item.type) {
                    // 아이콘이 없으면 타입 이름으로 다시 시도
                    iconHtml = this.getIconSVG(item.type);
                }

                if (!iconHtml) {
                    console.warn(`[GameEngine] Icon missing for key: ${iconKey}`);
                    iconHtml = `<div class="btn-icon gray"><svg viewBox="0 0 40 40"><rect x="10" y="10" width="20" height="20" fill="#555" stroke="#fff" stroke-width="2"/><text x="20" y="26" text-anchor="middle" fill="#fff" font-size="12">?</text></svg></div>`;
                }
            }

            btn.innerHTML = iconHtml; // Icons only (Mandatory)

            btn.onclick = (e) => {
                e.stopPropagation();
                if (item.action) {
                    this.handleMenuAction(item.action, item);
                } else if (item.type) {
                    this.startBuildMode(item.type, btn);
                }
            };

            btn.addEventListener('mouseenter', (e) => {
                this.isHoveringUI = true;
                let title = item.name;
                let desc = '';

                // Add cost if applicable
                const buildInfo = item.type ? this.buildingRegistry[item.type] : null;
                const cost = item.cost || (buildInfo ? buildInfo.cost : null);
                if (cost) {
                    desc += `<div class="stat-row"><span>💰 비용:</span> <span class="highlight">${cost}G</span></div>`;
                }

                // 건설 시간 표시 추가
                if (buildInfo && buildInfo.buildTime) {
                    desc += `<div class="stat-row"><span>⏳ 건설 시간:</span> <span class="highlight">${buildInfo.buildTime}s</span></div>`;
                }

                // Add specialized descriptions
                if (item.action === 'toggle:sell') {
                    desc += `<div class="item-stats-box text-red">건물을 철거하고 자원의 10%를 회수합니다.</div>`;
                } else if (item.action?.startsWith('unit:')) {
                    const cmd = item.action.split(':')[1];
                    const hotkeys = {
                        move: 'M', stop: 'S', hold: 'H', patrol: 'P', attack: 'A',
                        siege: 'O', manual_fire: 'F', combat_drop: 'D',
                        unload_all: 'U', takeoff_landing: 'T'
                    };
                    desc += `<div class="item-stats-box">단축키: ${hotkeys[cmd] || ''}</div>`;
                }

                this.showUITooltip(title, desc, e.clientX, e.clientY);
            });
            btn.addEventListener('mouseleave', () => {
                this.isHoveringUI = false;
                this.hideUITooltip();
            });

            grid.appendChild(btn);
        });
    }

    handleMenuAction(action, item) {
        if (action === 'menu:engineer_build') {
            this.isEngineerBuilding = true;
            this.currentMenuName = 'main';
            this.updateBuildMenu();
        } else if (action === 'menu:unit_cmds') {
            this.isEngineerBuilding = false;
            this.updateBuildMenu();
        } else if (action.startsWith('menu:')) {
            this.currentMenuName = action.split(':')[1];
            this.updateBuildMenu();
        } else if (action === 'toggle:sell') {
            if (this.isSellMode) this.cancelSellMode();
            else this.startSellMode();
        } else if (action.startsWith('skill:')) {
            const skill = action.split(':')[1];
            const target = this.selectedEntities.length > 0 ? this.selectedEntities[0] : this.selectedEntity;

            if (target && target.isUnderConstruction) return;

            // 생산형 스킬 처리
            const productionSkills = ['tank', 'missile', 'shell', 'bullet', 'cargo', 'cargo-plane', 'military-truck', 'rifleman', 'sniper', 'engineer', 'scout-plane', 'bomber', 'artillery', 'anti-air'];
            if (productionSkills.includes(skill)) {
                if (target && target.requestUnit) {
                    const cost = item.cost || 0;
                    let unitKey = skill;
                    if (skill === 'missile') unitKey = 'missile-launcher';
                    if (skill === 'cargo') unitKey = 'cargo-plane';

                    const popMap = {
                        'tank': 3, 'missile-launcher': 3, 'artillery': 4, 'anti-air': 3,
                        'rifleman': 1, 'sniper': 1, 'engineer': 1,
                        'scout-plane': 1, 'bomber': 6, 'cargo-plane': 4
                    };
                    const unitPopCost = popMap[unitKey] || 0;

                    if (this.resources.population + unitPopCost > this.resources.maxPopulation) {
                        if (this.addEffect) {
                            // 화면 중앙에 가깝게 메시지 표시 (인자 순서: type, x, y, color, text)
                            this.addEffect('system', target.x, target.y - 60, '#ff3131', '보급품 부족 (건물을 더 건설하십시오)');
                        }
                        console.warn("Population limit reached!");
                        return;
                    }

                    if (this.resources.gold >= cost) {
                        if (target.requestUnit(unitKey)) {
                            this.resources.gold -= cost;
                            this.updatePopulation(); // 즉시 갱신
                            this.updateBuildMenu();
                        }
                    }
                }
            } else {
                this.startSkillMode(skill);
            }
        } else if (action.startsWith('unit:')) {
            const cmd = action.split(':')[1];

            // [정리] 스킬 유형별 분기 처리
            const skillType = item.skillType || 'state'; // 기본값은 상태 변환

            if (skillType === 'targeted') {
                // 1. 목표 지정형: 타겟팅 모드 진입
                this.unitCommandMode = cmd;
                this.updateCursor();
            } else {
                // 2. 토글형 또는 상태 변환형: 즉시 실행
                this.executeUnitCommand(cmd);
            }
        }
    }
    initInput() {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // 1. 활성화된 특수 모드(건설, 판매, 스킬, 명령 타겟팅, 디버그 모드) 취소
                const isDebugMode = this.debugSystem && (this.debugSystem.isSpawnSandbagMode || this.debugSystem.isSpawnAirSandbagMode || this.debugSystem.spawnUnitType || this.debugSystem.isEraserMode);
                if (this.isBuildMode || this.isSellMode || this.isSkillMode || this.unitCommandMode || isDebugMode) {
                    this.cancelModes();
                    this.unitCommandMode = null;
                    this.updateCursor();
                    return;
                }

                // 2. 서브 메뉴(네트워크, 발전소 등)에서 메인 메뉴로 뒤로 가기
                if (this.currentMenuName !== 'main') {
                    this.currentMenuName = 'main';
                    this.updateBuildMenu();
                    return;
                }

                // 3. 공병 건설 메뉴에서 유닛 명령 메뉴로 뒤로 가기
                if (this.isEngineerBuilding) {
                    this.isEngineerBuilding = false;
                    this.updateBuildMenu();
                    return;
                }

                // 4. 아무것도 없으면 선택 해제 (RTS 기본 조작)
                if (this.selectedEntities.length > 0) {
                    this.selectedEntities = [];
                    this.selectedEntity = null;
                    this.selectedAirport = null;
                    this.updateBuildMenu();
                    this.updateCursor();
                }
            }

            // --- 부대 지정 시스템 (0-9) ---
            if (e.key >= '0' && e.key <= '9') {
                e.preventDefault(); // 브라우저 기본 동작(탭 전환 등) 방지
                const groupNum = parseInt(e.key);
                const now = Date.now();

                if (e.ctrlKey) {
                    // Ctrl + 숫자: 현재 선택된 유닛들 저장
                    // 아군 유닛만 저장 가능하도록 필터링
                    this.controlGroups[groupNum] = this.selectedEntities.filter(ent => ent.ownerId === 1 && ent.hp > 0);
                    // console.log(`Group ${groupNum} saved:`, this.controlGroups[groupNum].length);
                } else {
                    // 숫자: 부대 선택
                    // 죽은 유닛 제외
                    const group = this.controlGroups[groupNum].filter(ent => ent.active && ent.hp > 0);
                    this.controlGroups[groupNum] = group; // 유효한 유닛들로 갱신

                    if (group.length > 0) {
                        // 선택 업데이트
                        this.selectedEntities = [...group];
                        this.selectedEntity = group[0];
                        this.updateBuildMenu();
                        this.updateCursor();

                        // 더블 탭 체크 (카메라 점프)
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
                    const hasEngineer = this.selectedEntities.some(ent => ent.type === 'engineer');
                    const hasBomber = this.selectedEntities.some(ent => ent.type === 'bomber');

                    if (hasBomber) {
                        this.executeUnitCommand('bombing');
                    } else if (hasEngineer) {
                        this.isEngineerBuilding = true;
                        this.currentMenuName = 'main';
                        this.updateBuildMenu();
                    }
                }
            }
        });


        const grid = document.getElementById('build-grid');
        grid.addEventListener('click', (e) => {
            const btn = e.target.closest('.build-btn');
            if (!btn) return;

            const action = btn.dataset.action;
            const type = btn.dataset.type;

            if (action) {
                if (action.startsWith('menu:')) {
                    this.currentMenuName = action.split(':')[1];
                    this.updateBuildMenu();
                } else if (action === 'toggle:sell') {
                    if (this.isSellMode) {
                        this.cancelSellMode();
                    } else {
                        this.startSellMode(btn);
                    }
                } else if (action.startsWith('skill:')) {
                    const skillName = action.split(':')[1];
                    this.startSkillMode(skillName, btn);
                }
            } else if (type) {
                if (this.selectedBuildType === type && this.isBuildMode) {
                    this.cancelBuildMode();
                } else {
                    this.startBuildMode(type, btn);
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
                    // 모든 유닛 및 건물 중에서 타겟 찾기
                    const potentialTargets = [
                        ...this.entities.units,
                        ...this.entities.enemies,
                        ...this.entities.neutral,
                        ...this.getAllBuildings()
                    ];

                    const clickedTarget = potentialTargets.find(ent => {
                        if (!ent || !ent.active || ent.hp <= 0) return false;
                        const bounds = ent.getSelectionBounds ? ent.getSelectionBounds() : {
                            left: ent.x - 20, right: ent.x + 20, top: ent.y - 20, bottom: ent.y + 20
                        };
                        return worldX >= bounds.left && worldX <= bounds.right && worldY >= bounds.top && worldY <= bounds.bottom;
                    });

                    // [수정] 어택 명령('A') 시에는 관계에 상관없이 (자신 제외) 타겟으로 지정 가능하도록 허용
                    let canTarget = false;
                    if (clickedTarget) {
                        const relation = this.getRelation(1, clickedTarget.ownerId);
                        if (this.unitCommandMode === 'attack') {
                            // 어택 땅/지정 시에는 모든 엔티티 타겟팅 가능 (자기 자신 포함 강제 공격 허용)
                            canTarget = true;
                        } else {
                            // 일반적인 경우(스킬 등) 자신을 제외한 아군이 아닌 경우만
                            if (relation !== 'self' && relation !== 'ally') canTarget = true;
                        }
                    }

                    const finalTarget = canTarget ? clickedTarget : null;
                    this.executeUnitCommand(this.unitCommandMode, worldX, worldY, finalTarget);
                } else if (this.isSellMode) {
                    this.handleSell(worldX, worldY);
                } else if (this.isBuildMode) {
                    if (this.handleInput(worldX, worldY)) {
                        this.cancelBuildMode(); // Single install and cancel
                    }
                } else if (this.isSkillMode) {
                    this.handleInput(worldX, worldY);
                } else if (this.debugSystem && this.debugSystem.isSpawnSandbagMode) {
                    this.debugSystem.executeSpawnSandbag(worldX, worldY);
                } else if (this.debugSystem && this.debugSystem.isSpawnAirSandbagMode) {
                    this.debugSystem.executeSpawnAirSandbag(worldX, worldY);
                } else if (this.debugSystem && this.debugSystem.spawnUnitType) {
                    this.debugSystem.executeSpawnUnit(worldX, worldY);
                } else if (this.debugSystem && this.debugSystem.isEraserMode) {
                    this.debugSystem.executeEraser(worldX, worldY);
                } else {
                    // Start left-click drag selection
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
                } else if (this.isSellMode) {
                    this.handleSell(worldX, worldY);
                } else if (this.isBuildMode) {
                    this.handleInput(worldX, worldY);
                } else if (this.isSkillMode) {
                    this.cancelModes();
                    this.updateCursor();
                } else if (this.selectedEntities.length > 0) {
                    // 1. 클릭 대상 확인 (강제 공격/탑승/수리 타겟팅용)
                    const potentialTargets = [
                        ...this.entities.units,
                        ...this.entities.enemies,
                        ...this.entities.neutral,
                        ...this.getAllBuildings()
                    ];

                    const clickedTarget = potentialTargets.find(ent => {
                        if (!ent || !ent.active || ent.hp <= 0) return false;
                        const bounds = ent.getSelectionBounds ? ent.getSelectionBounds() : {
                            left: ent.x - 20, right: ent.x + 20, top: ent.y - 20, bottom: ent.y + 20
                        };
                        return worldX >= bounds.left && worldX <= bounds.right && worldY >= bounds.top && worldY <= bounds.bottom;
                    });

                    // 1.1 [수정] 우클릭 자동 공격은 '적군(enemy)'일 때만 발동
                    // 중립이나 아군 유닛을 우클릭하면 공격하지 않고 이동하거나 다른 행동 수행
                    if (clickedTarget && this.getRelation(1, clickedTarget.ownerId) === 'enemy') {
                        this.executeUnitCommand('attack', clickedTarget.x, clickedTarget.y, clickedTarget);
                        return;
                    }

                // [탑승 명령] 수송기, 트럭 또는 아파트(벙커) 클릭 시
                const transport = [
                    ...this.entities.cargoPlanes, 
                    ...this.entities.apartments,
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
                            // 아파트(벙커)에는 보병 계열만 탑승 가능
                            if (transport.type === 'apartment') {
                                const isHuman = ['rifleman', 'sniper', 'engineer'].includes(u.type);
                                if (isHuman) {
                                    u.transportTarget = transport;
                                    u.command = 'move';
                                } else if (u === this.selectedEntities[0]) {
                                    this.addEffect?.('system', u.x, u.y - 30, '#ff3131', '차량은 진입 불가');
                                }
                            } else {
                                // 수송기 등 일반 수송 수단
                                u.transportTarget = transport;
                                u.command = 'move';
                            }
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
            } else if (e.buttons === 2) { // RIGHT BUTTON held
                if (this.isSellMode) {
                    this.handleSell(worldX, worldY);
                } else if (this.isBuildMode) {
                    this.handleInput(worldX, worldY);
                }
            }

            // --- 월드 엔티티 호버링 상세 정보 처리 ---
            if (!this.isHoveringUI) {
                const potentialEntities = [
                    ...this.entities.units, ...this.entities.enemies,
                    ...this.getAllBuildings(), // 모든 건물 자동 포함
                    ...this.entities.resources // 자원 엔티티
                ];

                const hovered = potentialEntities.find(ent => {
                    if (!ent || (ent.active === false && ent.hp !== 99999999 && !ent.type?.includes('resource') && ent.covered !== true)) return false;

                    // 선택 범위 계산
                    const b = ent.getSelectionBounds ? ent.getSelectionBounds() : {
                        left: ent.x - 20, right: ent.x + 20, top: ent.y - 20, bottom: ent.y + 20
                    };

                    return worldX >= b.left && worldX <= b.right && worldY >= b.top && worldY <= b.bottom;
                });

                this.hoveredEntity = hovered; // Store for per-frame update

                if (hovered) {
                    this.updateTooltip(hovered, e.clientX, e.clientY);
                } else {
                    // 호버링 중인 대상이 없으면 즉시 숨김
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
                        // Small distance = Single Click action
                        if (!this.isBuildMode && !this.isSellMode && !this.isSkillMode) {
                            this.handleSingleSelection(worldX, worldY, e.shiftKey);
                        }
                    }
                    this.camera.selectionBox = null;
                    this.updateCursor();
                }
                this.lastPlacedGrid = { x: -1, y: -1 };
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
        const classes = ['build-mode-cursor', 'sell-mode-cursor', 'cmd-move-cursor', 'cmd-attack-cursor', 'cmd-patrol-cursor'];
        this.canvas.classList.remove(...classes);

        if (this.isSellMode) {
            this.canvas.classList.add('sell-mode-cursor');
        } else if (this.isBuildMode || this.isSkillMode) {
            this.canvas.classList.add('build-mode-cursor');
        } else if (this.unitCommandMode === 'move') {
            this.canvas.classList.add('cmd-move-cursor');
        } else if (this.unitCommandMode === 'attack' || this.unitCommandMode === 'manual_fire' || this.unitCommandMode === 'bombing') {
            this.canvas.classList.add('cmd-attack-cursor');
        } else if (this.unitCommandMode === 'patrol') {
            this.canvas.classList.add('cmd-patrol-cursor');
        }

        // 인라인 스타일 초기화 (CSS 클래스가 우선하도록)
        this.canvas.style.cursor = '';
    }

    executeUnitCommand(cmd, worldX = null, worldY = null, targetObject = null) {
        if (this.selectedEntities.length === 0) return;

        this.selectedEntities.forEach(unit => {
            // 자신의 유닛(Player 1)이 아니면 명령을 실행하지 않음
            if (unit.ownerId !== 1) return;

            // 명령 변경 시 기존 수동 타겟, 예약 건설, 수송기 탑승 타겟 취소
            unit.manualTarget = (cmd === 'attack') ? targetObject : null;
            unit.transportTarget = null; // 탑승 명령 취소

            if (unit.type === 'engineer' && unit.clearBuildQueue) {
                unit.clearBuildQueue();
            }

            // [정리] 범용 스킬 핸들러 확인
            const skill = unit.getSkillConfig ? unit.getSkillConfig(cmd) : null;
            if (skill) {
                if (skill.type === 'targeted') {
                    if (worldX !== null && skill.handler) {
                        skill.handler.call(unit, worldX, worldY, targetObject);
                    }
                } else if (skill.handler) {
                    // 토글 및 상태 변환형은 즉시 실행
                    skill.handler.call(unit);
                }
                return; // 스킬을 처리했으면 일반 명령 로직 건너뜀
            }

            let finalCmd = cmd;
            // 공격 불가능한 유닛(또는 상태)인 경우 '어택 땅'을 '이동'으로 전환
            if (cmd === 'attack') {
                const canAttack = (unit.type === 'missile-launcher' ? unit.isSieged : (typeof unit.attack === 'function' && unit.type !== 'engineer'));
                if (!canAttack) {
                    finalCmd = 'move';
                    unit.manualTarget = null;
                }
            }

            unit.command = finalCmd;
            if (finalCmd === 'stop') {
                unit.destination = null;
            } else if (finalCmd === 'hold') {
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
                // 유닛 하차 완료 후 인구수 등 갱신을 위해 메뉴 업데이트
                setTimeout(() => this.updateBuildMenu(), 500);
            }
        });
        this.unitCommandMode = null;
        this.updateCursor();
    }

    cancelModes() {
        this.cancelBuildMode();
        this.cancelSellMode();
        this.cancelSkillMode(false);
        this.isEngineerBuilding = false;
        
        // 디버그 모드 해제
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
        // 선택 가능한 엔티티들 수집 (자동화)
        const potentialEntities = [
            ...this.entities.units,
            ...this.entities.enemies,
            ...this.entities.neutral,
            ...this.getAllBuildings()
        ];

        // 클릭 지점에 있는 첫 번째 엔티티 찾기
        const found = potentialEntities.find(ent => {
            // 비활성화된 엔티티(탑승 중 등)는 선택 불가
            if (!ent || (ent.active === false && !ent.isBoarded) || ent.isBoarded) return false;

            const bounds = ent.getSelectionBounds ? ent.getSelectionBounds() : {
                left: ent.x - 20, right: ent.x + 20, top: ent.y - 20, bottom: ent.y + 20
            };
            return worldX >= bounds.left && worldX <= bounds.right && worldY >= bounds.top && worldY <= bounds.bottom;
        });

        if (found) {
            // 적 유닛인 경우 단일 선택만 허용
            const isEnemy = this.entities.enemies.includes(found);

            if (isEnemy) {
                this.selectedEntities = [found];
                this.selectedEntity = found;
            } else if (isShiftKey && !isEnemy) {
                // 아군 유닛 시프트 다중 선택
                const idx = this.selectedEntities.indexOf(found);
                if (idx > -1) {
                    this.selectedEntities.splice(idx, 1);
                } else {
                    // 이미 적군이 선택되어 있었다면 제거 후 추가
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
        this.selectedAirport = null;

        // 드래그 선택 시 아군 유닛과 건물만 고려 (적/중립 제외)
        const potentialEntities = [
            ...this.entities.units.filter(u => u.ownerId === 1),
            ...this.getAllBuildings().filter(b => b.ownerId === 1)
        ];

        const selectedUnits = [];
        const selectedBuildings = [];

        potentialEntities.forEach(ent => {
            if (!ent || (!ent.active && ent !== this.entities.base && !ent.isBoarded)) return;
            if (ent.isBoarded) return; // 탑승 중인 유닛은 선택 불가

            const bounds = ent.getSelectionBounds();
            const overlaps = !(bounds.right < left || bounds.left > right || bounds.bottom < top || bounds.top > bottom);

            if (overlaps) {
                // PlayerUnit 클래스를 상속받은 모든 객체(전차, 공병 등)를 유닛으로 판정
                if (ent instanceof this.entityClasses.PlayerUnit || ent.speed !== undefined && ent.hp !== 99999999 && !ent.type?.includes('turret')) {
                    // 유닛 판정 (instanceof가 가장 확실하지만, 클래스 참조 이슈 대비 보조 조건 추가)
                    selectedUnits.push(ent);
                } else {
                    selectedBuildings.push(ent);
                }
            }
        });

        // 우선순위: 유닛이 하나라도 있으면 유닛만 선택, 없으면 건물 선택
        if (selectedUnits.length > 0) {
            this.selectedEntities = selectedUnits;
        } else {
            this.selectedEntities = selectedBuildings;
        }

        if (this.selectedEntities.length > 0) {
            this.selectedEntity = this.selectedEntities[0];
            if (this.selectedEntity.type === 'airport') this.selectedAirport = this.selectedEntity;
        }

        this.updateCursor();
        this.updateBuildMenu();
    }

    startBuildMode(type, btn) {
        if (this.selectedBuildType === type && this.isBuildMode) {
            this.cancelBuildMode();
            return;
        }
        this.isSellMode = false;
        this.isSkillMode = false;
        this.selectedBuildType = type;
        this.isBuildMode = true;
        this.updateCursor();
        this.updateBuildMenu();
    }

    cancelBuildMode() {
        this.isBuildMode = false;
        this.selectedBuildType = null;
        this.selectedAirport = null;
        this.currentBuildSessionQueue = null; // 세션 큐 초기화
        this.updateCursor();
        this.updateBuildMenu();
    }

    startSellMode(btn) {
        this.isBuildMode = false;
        this.isSkillMode = false;
        this.selectedBuildType = null;
        this.isSellMode = true;
        this.updateCursor();
        this.updateBuildMenu();
    }

    cancelSellMode() {
        this.isSellMode = false;
        this.updateCursor();
        this.updateBuildMenu();
    }

    startSkillMode(skillName, btn) {
        if (!this.selectedEntity) {
            alert('스킬을 사용하려면 건물을 먼저 선택해야 합니다!');
            return;
        }

        const entity = this.selectedEntity;

        // 1. 즉시 실행형 스킬 처리 (타겟 지정 불필요)
        if (skillName === 'cargo' && entity.type === 'storage') {
            const cost = 100;
            if (this.resources.gold >= cost) {
                entity.requestCargoPlane();
                this.resources.gold -= cost;
                this.updateBuildMenu();
            }
            return;
        }

        if ((skillName === 'tank' || skillName === 'missile') && entity.type === 'armory') {
            const cost = skillName === 'tank' ? 300 : 500;
            if (this.resources.gold >= cost) {
                const success = entity.requestUnit(skillName);
                if (success) {
                    this.resources.gold -= cost;
                    this.updateBuildMenu();
                } else {
                    alert('생산 대기열이 가득 찼습니다!');
                }
            }
            return;
        }

        // 2. 타겟 지정형 스킬 처리 (정찰 등)
        this.isBuildMode = false;
        this.isSellMode = false;
        this.isSkillMode = true;
        this.selectedSkill = skillName;
        this.updateCursor();
        this.updateBuildMenu();
    }

    cancelSkillMode(keepSelection = false) {
        this.isSkillMode = false;
        this.selectedSkill = null;
        if (!keepSelection) {
            this.selectedAirport = null;
            this.selectedEntity = null;
            this.updateBuildMenu();
        } else {
            this.updateBuildMenu();
        }
        this.updateCursor();
    }

    handleSkill(worldX, worldY) {
        if (!this.isSkillMode || !this.selectedSkill) return;
        // 정찰 스킬 삭제됨
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

    handleInput(worldX, worldY) {
        if (!this.isBuildMode || !this.selectedBuildType) return false;

        let tileInfo = this.tileMap.getTileAt(worldX, worldY);
        const buildInfo = this.buildingRegistry[this.selectedBuildType];
        if (!tileInfo || !tileInfo.tile.visible || !buildInfo) return false;

        let gridX = tileInfo.x;
        let gridY = tileInfo.y;

        // [추가] 자원 건물 건설 시 스냅 로직
        if (buildInfo.onResource) {
            // 마우스 위치 주변의 자원 엔티티 검색
            const nearestResource = this.entities.resources.find(r =>
                Math.abs(r.x - worldX) < 60 && Math.abs(r.y - worldY) < 60 && r.type === buildInfo.onResource
            );

            if (nearestResource) {
                // 자원의 월드 좌표(중심점)를 기반으로 건물의 좌상단 그리드 좌표 역계산
                // 자원 중심이 (x+1, y+1)*40 이므로, 40으로 나누고 1을 빼면 정확한 좌상단 타일 인덱스가 나옵니다.
                gridX = Math.round(nearestResource.x / this.tileMap.tileSize) - 1;
                gridY = Math.round(nearestResource.y / this.tileMap.tileSize) - 1;

                // 타일 정보 동기화
                const snappedTile = this.tileMap.grid[gridY]?.[gridX];
                if (!snappedTile) return false;
                tileInfo = { x: gridX, y: gridY, tile: snappedTile };
            } else {
                return false; // 주변에 적절한 자원이 없으면 건설 불가
            }
        }

        // 동일한 타일에 중복 예약 방지 (드래그 시 중요)
        if (this.lastPlacedGrid.x === gridX && this.lastPlacedGrid.y === gridY) return false;

        const isFromItem = this.pendingItemIndex !== -1;
        const cost = isFromItem ? 0 : buildInfo.cost;

        if (this.resources.gold < cost) return false;

        const [tw, th] = buildInfo.size;
        let canPlace = true;

        // 1. 위치 검증 (좌상단에서 양수 방향으로 순회)
        for (let dy = 0; dy < th; dy++) {
            for (let dx = 0; dx < tw; dx++) {
                const nx = gridX + dx;
                const ny = gridY + dy;
                if (nx < 0 || nx >= this.tileMap.cols || ny < 0 || ny >= this.tileMap.rows) {
                    canPlace = false; break;
                }
                const tile = this.tileMap.grid[ny][nx];

                // 기본 검증: 지을 수 있는 땅인지, 안개가 걷혔는지
                if (!tile.buildable || !tile.visible) {
                    canPlace = false; break;
                }

                // 점유 상태 검증
                if (tile.occupied) {
                    const isResourceBuilding = !!buildInfo.onResource;
                    const isResourceTile = (tile.type === 'resource');

                    if (!(isResourceBuilding && isResourceTile)) {
                        canPlace = false; break;
                    }
                }
            }
            if (!canPlace) break;
        }

        if (canPlace) {
            // 선택된 모든 공병 수집
            const engineers = this.selectedEntities.filter(u => u.type === 'engineer');

            if (engineers.length > 0) {
                // 월드 좌표 계산 (2x2 건물의 중심점 좌표로 통일)
                const centerX = (gridX + tw / 2) * this.tileMap.tileSize;
                const centerY = (gridY + th / 2) * this.tileMap.tileSize;

                // 1. 현재 세션 큐가 없으면 생성
                if (!this.currentBuildSessionQueue) {
                    this.currentBuildSessionQueue = [];
                }

                // 2. 새로운 작업 생성
                const newTask = {
                    type: this.selectedBuildType,
                    x: centerX,
                    y: centerY,
                    gridX: gridX,
                    gridY: gridY,
                    assignedEngineer: null
                };
                this.currentBuildSessionQueue.push(newTask);

                // 3. 모든 선택된 공병에게 이 큐를 할당
                engineers.forEach(eng => {
                    if (eng.myGroupQueue !== this.currentBuildSessionQueue) {
                        eng.clearBuildQueue();
                        eng.myGroupQueue = this.currentBuildSessionQueue;
                        eng.command = 'build';
                    }
                });

                // 자원 차감 및 타일 점유 (양수 방향 루프)
                this.resources.gold -= cost;
                for (let dy = 0; dy < th; dy++) {
                    for (let dx = 0; dx < tw; dx++) {
                        const nx = gridX + dx, ny = gridY + dy;
                        if (this.tileMap.grid[ny] && this.tileMap.grid[ny][nx]) {
                            this.tileMap.grid[ny][nx].occupied = true;
                            this.tileMap.grid[ny][nx].type = 'building';
                        }
                    }
                }

                this.lastPlacedGrid = { x: gridX, y: gridY };
                return true;
            }
        }
        return false;
    }

    // 공병이 도착했을 때 실제로 건물을 생성하는 메서드
    executeBuildingPlacement(type, worldX, worldY, gridX, gridY) {
        const buildInfo = this.buildingRegistry[type];
        if (!buildInfo) return null;

        const [stw, sth] = buildInfo.size;

        let worldPos;
        if (stw > 1 || sth > 1) {
            // 2x2 건물의 경우, 자원(Resource)의 좌표와 동일하게 (gridX+1, gridY+1) 지점을 중심으로 설정
            worldPos = {
                x: (gridX + stw / 2) * this.tileMap.tileSize,
                y: (gridY + sth / 2) * this.tileMap.tileSize
            };
        } else {
            worldPos = this.tileMap.gridToWorld(gridX, gridY);
        }

        const ClassRef = this.entityClasses[buildInfo.className];
        if (ClassRef) {
            let newEntity;
            if (buildInfo.className === 'Turret') {
                newEntity = new ClassRef(worldPos.x, worldPos.y, type);
                newEntity.damage += (this.globalStats.damage - 10);
                newEntity.range += (this.globalStats.range - 150);
            } else {
                newEntity = new ClassRef(worldPos.x, worldPos.y, this);
            }

            // 건설 초기 설정 및 좌표 저장
            newEntity.isUnderConstruction = true;
            newEntity.buildProgress = 0;
            newEntity.totalBuildTime = buildInfo.buildTime || 5;
            newEntity.hp = 1;
            newEntity.gridX = gridX; // 원래 타일 좌표 저장
            newEntity.gridY = gridY;

            const listName = buildInfo.list;
            if (this.entities[listName]) {
                this.entities[listName].push(newEntity);
            }

            // 자원 채취 건물인 경우 실제 자원 오브젝트 숨김 처리 (삭제 대신)
            if (buildInfo.onResource) {
                const resource = this.entities.resources.find(r =>
                    Math.abs(r.x - worldPos.x) < 20 && Math.abs(r.y - worldPos.y) < 20
                );
                if (resource) {
                    resource.covered = true; // 화면에서 숨김
                    newEntity.targetResource = resource; // 건물에 자원 객체 연결
                }
            }
            return newEntity;
        }
        return null;
    }

    handleSell(worldX, worldY) {
        const tileInfo = this.tileMap.getTileAt(worldX, worldY);
        if (!tileInfo || !tileInfo.tile.occupied) return;

        // [최적화] 모든 건물 중에서 판매 대상 찾기
        const allBuildings = this.getAllBuildings();
        let foundEntity = allBuildings.find(e => {
            if (!e || e.type === 'base') return false; // 기지는 판매 불가
            const bounds = e.getSelectionBounds();
            return worldX >= bounds.left && worldX <= bounds.right &&
                worldY >= bounds.top && worldY <= bounds.bottom;
        });

        if (foundEntity) {
            // 인벤토리나 리스트에서 제거하기 위해 소속 리스트 찾기
            const buildInfo = this.buildingRegistry[foundEntity.type];
            const listName = buildInfo ? buildInfo.list : null;

            if (listName && this.entities[listName]) {
                const foundIdx = this.entities[listName].indexOf(foundEntity);
                if (foundIdx !== -1) {
                    const cost = buildInfo ? buildInfo.cost : 0;
                    this.resources.gold += Math.floor(cost * 0.1);

                    // 판매 시에도 내부 유닛 방출 처리
                    if (foundEntity.onDestruction) foundEntity.onDestruction(this);

                    // 전용 헬퍼 함수를 사용하여 점유된 타일 해제
                    this.clearBuildingTiles(foundEntity);

                    // 리스트에서 제거
                    this.entities[listName].splice(foundIdx, 1);

                    // [추가] EntityManager 및 SpatialGrid에서도 제거하여 렌더링 잔상 방지
                    if (this.entityManager) {
                        const allIdx = this.entityManager.allEntities.indexOf(foundEntity);
                        if (allIdx !== -1) this.entityManager.allEntities.splice(allIdx, 1);
                        this.entityManager.spatialGrid.remove(foundEntity);
                    }

                    // 판매 후 인구수 즉시 갱신
                    this.updatePopulation();
                }
            }
        }
    }

    updateTooltip(hovered, x, y) {
        if (!hovered) return;

        // [추가] 호버링 중인 대상이 시야에서 사라지면 툴팁 숨김
        if (this.tileMap && !this.tileMap.isInSight(hovered.x, hovered.y)) {
            this.hideUITooltip();
            return;
        }

        let title = hovered.name || hovered.type;
        const isEnemy = this.entities.enemies.includes(hovered);
        if (isEnemy) title = `[적] ${title}`;

        let desc = '<div class="item-stats-box">';

        // 자원 엔티티 전용 표시
        if (hovered instanceof Resource || (hovered.type === 'oil' || hovered.type === 'gold' || hovered.type === 'iron')) {
            desc += `<div class="stat-row"><span>💎 종류:</span> <span class="highlight">${hovered.name}</span></div>
                     <div class="stat-row"><span>💡 도움말:</span> <span>적절한 채굴 건물을 지으세요.</span></div>`;
        } else {
            // 일반 유닛/건물 표시
            desc += `<div class="stat-row"><span>❤️ 체력:</span> <span class="highlight">${Math.floor(hovered.hp)} / ${hovered.maxHp}</span></div>`;

            // 채굴 건물의 경우 남은 광물 표시
            if (['refinery', 'gold-mine', 'iron-mine'].includes(hovered.type) && hovered.fuel !== undefined) {
                const fuelName = '남은 광물';
                desc += `<div class="stat-row"><span>⛏️ ${fuelName}:</span> <span class="highlight">${Math.ceil(hovered.fuel)} / ${hovered.maxFuel || '?'}</span></div>`;
            }

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
            // 탄약 상자 전용 수량 표시
            if (hovered.type?.startsWith('ammo-') && hovered.amount !== undefined) {
                desc += `<div class="stat-row"><span>📦 남은 탄약:</span> <span class="highlight">${Math.ceil(hovered.amount)} / ${hovered.maxAmount}</span></div>`;
            }
            // 수송 유닛 전용 정보 (수송기 및 트럭)
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

    clearBuildingTiles(obj) {
        if (!obj) return;
        const buildInfo = this.buildingRegistry[obj.type];
        if (!buildInfo) return;

        const [tw, th] = buildInfo.size;
        const gridX = obj.gridX;
        const gridY = obj.gridY;

        if (gridX === undefined || gridY === undefined) return;

        // 양수 방향으로 순회하며 타일 초기화
        for (let dy = 0; dy < th; dy++) {
            for (let dx = 0; dx < tw; dx++) {
                const nx = gridX + dx;
                const ny = gridY + dy;
                if (this.tileMap.grid[ny] && this.tileMap.grid[ny][nx]) {
                    const tileCenterX = (nx + 0.5) * this.tileMap.tileSize;
                    const tileCenterY = (ny + 0.5) * this.tileMap.tileSize;

                    // 해당 타일이 어느 자원의 영역에 포함되는지 확인 (2x2 자원 크기 80px 고려)
                    const resource = this.entities.resources.find(r =>
                        Math.abs(r.x - tileCenterX) < 30 && Math.abs(r.y - tileCenterY) < 30
                    );

                    if (resource) {
                        this.tileMap.grid[ny][nx].occupied = true;
                        this.tileMap.grid[ny][nx].type = 'resource';
                        if (obj.targetResource === resource) resource.covered = false;
                    } else {
                        this.tileMap.grid[ny][nx].occupied = false;
                        this.tileMap.grid[ny][nx].type = 'empty';
                    }
                }
            }
        }
    }

    update(deltaTime) {
        if (this.gameState !== 'playing') return;

        this.frameCount = (this.frameCount || 0) + 1;

        // 1. 효과 및 카메라 업데이트 (매 프레임)
        for (let i = this.effects.length - 1; i >= 0; i--) {
            const fx = this.effects[i];
            fx.timer += deltaTime;
            if (fx.timer >= fx.duration) this.effects.splice(i, 1);
        }
        this.updateEdgeScroll();

        // [최적화] 시야 업데이트 주기 조절 (Throttling)
        this.visibilityTimer += deltaTime;
        if (this.visibilityTimer >= this.visibilityInterval) {
            this.updateVisibility();
            this.visibilityTimer = 0;
        }

        // EntityManager 업데이트 (SpatialGrid 등 갱신)
        if (this.entityManager) {
            this.entityManager.update(deltaTime);
        }

        // [최적화] 배열을 새로 할당하지 않고 제자리에서(in-place) 필터링하여 GC 부하 감소
        // 투 포인터 알고리즘 사용
        const processList = (list, updateFn) => {
            if (!list) return list;
            
            let writeIdx = 0;
            let countChanged = false;

            for (let readIdx = 0; readIdx < list.length; readIdx++) {
                const obj = list[readIdx];
                
                // 탑승 중인 유닛은 업데이트 함수 호출 스킵 (하지만 리스트에는 유지)
                if (updateFn && !obj.isBoarded) updateFn(obj);

                // 유지 조건 확인
                let keep = true;
                if (!obj.isBoarded) { // 탑승 중이 아닐 때만 삭제 검사
                    if (obj.hp <= 0 || obj.active === false) {
                        keep = false;
                        if (obj.hp <= 0) {
                            if (obj.onDestruction) obj.onDestruction(this);
                            this.clearBuildingTiles(obj);
                        }
                    }
                }

                if (keep) {
                    if (writeIdx !== readIdx) {
                        list[writeIdx] = obj;
                    }
                    writeIdx++;
                } else {
                    countChanged = true;
                    // EntityManager 등에서도 제거 (중복 제거 방지용 체크는 내부에서 함)
                    if (this.entityManager) this.entityManager.remove(obj);
                }
            }

            // 배열 길이 단축
            if (countChanged) {
                list.length = writeIdx;
                this.updatePopulation();
            }
            
            return list;
        };

        // 모든 건물 및 유닛 업데이트
        const buildings = this.getAllBuildings();
        this.entities.refineries = processList(this.entities.refineries, (r) => r.update(deltaTime, this));
        this.entities.goldMines = processList(this.entities.goldMines, (gm) => gm.update(deltaTime, this));
        this.entities.ironMines = processList(this.entities.ironMines, (im) => im.update(deltaTime, this));
        this.entities.airports = processList(this.entities.airports, (a) => a.update(deltaTime, this));
        this.entities.storage = processList(this.entities.storage, (s) => s.update(deltaTime, this));
        this.entities.ammoFactories = processList(this.entities.ammoFactories, (af) => af.update(deltaTime, this));
        this.entities.armories = processList(this.entities.armories, (a) => a.update(deltaTime, this));
        this.entities.barracks = processList(this.entities.barracks, (b) => b.update(deltaTime, this));
        this.entities.apartments = processList(this.entities.apartments, (a) => a.update(deltaTime, this));
        this.entities.walls = processList(this.entities.walls);

        if (this.entities.base) {
            this.entities.base.update(deltaTime, this);
            if (this.entities.base.hp <= 0) {
                this.gameState = 'gameOver';
                document.getElementById('game-over-modal').classList.remove('hidden');
            }
        }

        // 유닛 사망 시 인구수 갱신
        const oldUnitsLen = this.entities.units.length;
        this.entities.units = processList(this.entities.units, (u) => u.update(deltaTime));
        if (this.entities.units.length !== oldUnitsLen) this.updatePopulation();

        this.entities.cargoPlanes = processList(this.entities.cargoPlanes, (p) => p.update(deltaTime));
        this.entities.neutral = processList(this.entities.neutral, (n) => n.update(deltaTime));
        this.entities.projectiles = this.entities.projectiles.filter(p => p.active || p.arrived);
        this.entities.projectiles.forEach(proj => proj.update(deltaTime, this));

        this.entities.enemies = this.entities.enemies.filter(enemy => {
            enemy.update(deltaTime, this.entities.base, buildings, this);
            if (!enemy.active || enemy.hp <= 0) {
                if (enemy.active) this.resources.gold += 10;
                return false;
            }
            return true;
        });

        // 3. 조건부 논리 업데이트 (프레임 내 모든 변화를 수집한 후 마지막에 실행)

        // 4. UI 및 데이터 동기화
        this.refreshFlyerUI();
        this.updateResourceUI();
    }

    render() {
        // [Optimized Rendering]
        if (this.renderSystem) {
            this.renderSystem.render();

            // 오버레이 렌더링 (사거리, 경로, 고스트 등)
            this.ctx.save();
            this.ctx.translate(this.camera.x, this.camera.y);
            this.ctx.scale(this.camera.zoom, this.camera.zoom);
            this.renderOverlays();
            this.ctx.restore();

            // Post-process UI (not handled by RenderSystem yet)
            this.renderBuildQueue(this.getAllBuildings());
            
            // [최적화] 미니맵은 시야 업데이트 주기(100ms)와 맞춰서 갱신하거나 별도 타이머 사용
            // 매 프레임 그리기엔 비용이 큼
            if (this.visibilityTimer === 0) { // updateVisibility 직후에만 갱신
                this.renderMinimap();
            } else if (!this._lastMinimapRendered) {
                // 첫 프레임 보장
                this.renderMinimap();
                this._lastMinimapRendered = true;
            }

            if (this.isSellMode) {
                this.ctx.save();
                this.ctx.fillStyle = '#ff3131';
                this.ctx.font = 'bold 24px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = '#ff3131';
                this.ctx.fillText('판매 모드 (우클릭 드래그로 철거)', this.canvas.width / 2, 100);
                this.ctx.restore();
            }
            return;
        }

        // [Legacy Rendering]
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        this.ctx.translate(this.camera.x, this.camera.y);
        this.ctx.scale(this.camera.zoom, this.camera.zoom);

        // 1. Draw visible grid background
        this.tileMap.drawGrid(this.camera);

        // 2. [자동화] 모든 건물 수집
        const allBuildings = this.getAllBuildings();

        // --- 2.1 기초 기반시설 (Ground Layer) ---
        if (this.entities.base) this.entities.base.draw(this.ctx);
        this.entities.resources.forEach(r => r.draw(this.ctx));

        // --- 2.2 건물 (Building Layer) ---
        // 기지 및 유틸리티 라인을 제외한 모든 건물 일괄 렌더링
        allBuildings.forEach(b => {
            if (b === this.entities.base) return;
            b.draw(this.ctx);
        });

        // --- 2.3 유닛 레이어 분리 (Ground vs Air) ---
        const groundUnits = this.entities.units.filter(u => u.domain !== 'air');
        const airUnits = this.entities.units.filter(u => u.domain === 'air');
        const groundEnemies = this.entities.enemies.filter(e => e.domain !== 'air');
        const airEnemies = this.entities.enemies.filter(e => e.domain === 'air');
        const groundNeutral = this.entities.neutral.filter(n => n.domain !== 'air');
        const airNeutral = this.entities.neutral.filter(n => n.domain === 'air');

        // 1. [지상 레이어] 모든 지상 유닛 렌더링
        groundUnits.forEach(u => {
            if (!u.isBoarded) u.draw(this.ctx);
        });

        // 지상 적 유닛 (시야 내)
        groundEnemies.forEach(e => {
            if (e.isBoarded) return;
            const grid = this.tileMap.worldToGrid(e.x, e.y);
            if (this.tileMap.grid[grid.y] && this.tileMap.grid[grid.y][grid.x] && this.tileMap.grid[grid.y][grid.x].inSight) {
                e.draw(this.ctx);
            }
        });

        // 지상 중립 유닛
        groundNeutral.forEach(n => {
            if (!n.isBoarded) n.draw(this.ctx);
        });

        // 2. [안개 레이어] 지형 및 지상 유닛 위에 안개 그리기
        this.tileMap.drawFog(this.camera);

        // 3. [공중 레이어] 최상위 공중 유닛 렌더링 (안개 및 지상 요소 위)
        airUnits.forEach(u => {
            if (u.isBoarded) return;
            u.draw(this.ctx);
            // [전투 강하] 낙하산 렌더링
            if (u.isFalling) {
                this.ctx.save();
                this.ctx.translate(u.x, u.y);
                const progress = u.fallTimer / u.fallDuration;
                const scale = 1.5 - (progress * 0.5);
                this.ctx.scale(scale, scale);
                const swing = Math.sin(Date.now() / 200) * 0.1;
                this.ctx.rotate(swing);

                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                this.ctx.lineWidth = 1.5;
                this.ctx.beginPath();
                this.ctx.moveTo(-12, -25); this.ctx.lineTo(0, -5);
                this.ctx.moveTo(12, -25); this.ctx.lineTo(0, -5);
                this.ctx.stroke();

                const grd = this.ctx.createLinearGradient(0, -45, 0, -25);
                grd.addColorStop(0, '#ecf0f1');
                grd.addColorStop(1, '#bdc3c7');
                this.ctx.fillStyle = grd;
                this.ctx.beginPath();
                this.ctx.arc(0, -25, 22, Math.PI, 0);
                this.ctx.bezierCurveTo(15, -20, 5, -20, 0, -25);
                this.ctx.bezierCurveTo(-5, -20, -15, -20, -22, -25);
                this.ctx.fill();

                this.ctx.strokeStyle = '#95a5a6';
                this.ctx.lineWidth = 1;
                this.ctx.stroke();
                this.ctx.restore();
            }
        });

        // 공중 적 유닛 (시야 내)
        airEnemies.forEach(e => {
            if (e.isBoarded) return;
            const grid = this.tileMap.worldToGrid(e.x, e.y);
            if (this.tileMap.grid[grid.y] && this.tileMap.grid[grid.y][grid.x] && this.tileMap.grid[grid.y][grid.x].inSight) {
                e.draw(this.ctx);
            }
        });

        // 공중 중립 유닛
        airNeutral.forEach(n => {
            if (!n.isBoarded) n.draw(this.ctx);
        });

        // 4. 투사체 및 효과 (최상단)
        this.entities.projectiles.forEach(p => p.draw(this.ctx));

        // 시각 효과 렌더링
        this.effects.forEach(fx => {
            const progress = fx.timer / fx.duration;
            this.ctx.save();
            this.ctx.globalAlpha = 1 - progress;

            if (fx.type === 'bullet') {
                this.ctx.fillStyle = fx.color;
                fx.particles.forEach(p => {
                    const px = fx.x + p.vx * fx.timer * 0.1;
                    const py = fx.y + p.vy * fx.timer * 0.1;
                    this.ctx.beginPath();
                    this.ctx.arc(px, py, p.size, 0, Math.PI * 2);
                    this.ctx.fill();
                });
            } else if (fx.type === 'hit') {
                this.ctx.strokeStyle = fx.color;
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.arc(fx.x, fx.y, 5 + progress * 10, 0, Math.PI * 2);
                this.ctx.stroke();
            } else if (fx.type === 'explosion') {
                const radius = 5 + progress * 20;
                const grad = this.ctx.createRadialGradient(fx.x, fx.y, 0, fx.x, fx.y, radius);
                grad.addColorStop(0, 'white');
                grad.addColorStop(0.4, fx.color);
                grad.addColorStop(1, 'rgba(255, 69, 0, 0)');
                this.ctx.fillStyle = grad;
                this.ctx.beginPath();
                this.ctx.arc(fx.x, fx.y, radius, 0, Math.PI * 2);
                this.ctx.fill();
            } else if (fx.type === 'flak') {
                this.ctx.fillStyle = '#ff0';
                fx.particles.forEach(p => {
                    const angle = p.angle;
                    const dist = p.dist + progress * 30;
                    const px = fx.x + Math.cos(angle) * dist;
                    const py = fx.y + Math.sin(angle) * dist;
                    this.ctx.beginPath();
                    this.ctx.arc(px, py, p.size * (1 - progress), 0, Math.PI * 2);
                    this.ctx.fill();
                });
                // 중앙 섬광
                if (progress < 0.3) {
                    this.ctx.fillStyle = 'white';
                    this.ctx.beginPath();
                    this.ctx.arc(fx.x, fx.y, 10 * (1 - progress * 3), 0, Math.PI * 2);
                    this.ctx.fill();
                }
            } else if (fx.type === 'system' && fx.text) {
                this.ctx.fillStyle = fx.color;
                this.ctx.font = 'bold 14px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.shadowBlur = 4;
                this.ctx.shadowColor = 'black';
                this.ctx.fillText(fx.text, fx.x, fx.y - progress * 50);
            }
            this.ctx.restore();
        });

        const mouseWorldX = (this.camera.mouseX - this.camera.x) / this.camera.zoom;
        const mouseWorldY = (this.camera.mouseY - this.camera.y) / this.camera.zoom;

        // 6. Draw Active Previews and Highlights on TOP of everything

        // 6.1 Selected Object Highlight
        if (this.selectedEntities.length > 0) {
            this.ctx.save();

            const showPathLimit = 15; // 경로 표시는 최대 15개로 제한
            let pathCount = 0;

            // 1단계: 선택 박스 및 사거리 그리기
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

                // 사거리 표시 (사용자 요청에 따라 모든 유닛 유지)
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

            // 2단계: 이동 경로 그리기 (갯수 상한 적용)
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

                // 목적지 마커
                const dest = ent.destination;
                const m = 5;
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.moveTo(dest.x - m, dest.y - m); this.ctx.lineTo(dest.x + m, dest.y + m);
                this.ctx.moveTo(dest.x + m, dest.y - m); this.ctx.lineTo(dest.x - m, dest.y + m);
                this.ctx.stroke();
            }
            this.ctx.restore();

            // --- [독립 블록] 공격 대상 하이라이트 (Target Highlight) ---
            const targetsToHighlight = new Set();
            this.selectedEntities.forEach(selUnit => {
                // [수정] 오직 플레이어가 직접 지정한 수동 타겟(manualTarget)만 표시
                const mTarget = selUnit.manualTarget;
                if (mTarget && (mTarget.active !== false) && (mTarget.alive !== false) && (mTarget.hp > 0)) {
                    targetsToHighlight.add(mTarget);
                }

                // 미사일 발사대 수동 조준/발사 준비 지점 (플레이어 조작이므로 포함)
                if (selUnit.type === 'missile-launcher' && selUnit.isFiring && selUnit.pendingFirePos) {
                    const fireTarget = [...this.entities.enemies, ...this.entities.neutral].find(ent =>
                        (ent.active !== false && ent.alive !== false) && Math.hypot(ent.x - selUnit.pendingFirePos.x, ent.y - selUnit.pendingFirePos.y) < 60
                    );
                    if (fireTarget) targetsToHighlight.add(fireTarget);
                }
            });

            // 4. 수동 조준 모드 시 마우스 아래의 적 또는 중립 (조준 보조)
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
                const padding = 8; // 패딩을 조금 더 늘려 잘 보이게 함
                const tW = (bounds.right - bounds.left) + padding * 2;
                const tH = (bounds.bottom - bounds.top) + padding * 2;
                const tX = bounds.left - padding;
                const tY = bounds.top - padding;

                this.ctx.save();
                this.ctx.strokeStyle = '#ff3131';
                this.ctx.lineWidth = 3;
                const pulse = Math.sin(Date.now() / 150) * 0.5 + 0.5;
                this.ctx.globalAlpha = 0.5 + pulse * 0.5; // 불투명도 상향

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
            this.ctx.strokeStyle = 'rgba(0, 255, 204, 0.8)';
            this.ctx.lineWidth = 2;
            this.ctx.shadowBlur = 5;
            this.ctx.shadowColor = 'rgba(0, 255, 204, 0.5)';

            const bounds = this.selectedEntity.getSelectionBounds();
            const w = bounds.right - bounds.left;
            const h = bounds.bottom - bounds.top;

            this.ctx.strokeRect(bounds.left, bounds.top, w, h);

            // 유닛(전차, 미사일) 선택 시 공격 사거리(Attack Range) 표시
            if (this.selectedEntity.attackRange) {
                this.ctx.save();
                this.ctx.beginPath();
                this.ctx.arc(this.selectedEntity.x, this.selectedEntity.y, this.selectedEntity.attackRange, 0, Math.PI * 2);
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                this.ctx.setLineDash([5, 5]);
                this.ctx.stroke();
                this.ctx.restore();
            }

            if (this.selectedEntity.type && this.selectedEntity.type.startsWith('turret')) {
                // 포탑은 사거리 원을 아주 연하게 추가 표시
                this.ctx.setLineDash([5, 10]);
                this.ctx.globalAlpha = 0.3;
                this.selectedEntity.draw(this.ctx, true);
            }
            this.ctx.restore();
        }

        // 4.2 Ghost Preview for Building
        if (this.isBuildMode && this.selectedBuildType) {
            let tileInfo = this.tileMap.getTileAt(mouseWorldX, mouseWorldY);
            const buildInfo = this.buildingRegistry[this.selectedBuildType];

            if (tileInfo && buildInfo) {
                let gx = tileInfo.x;
                let gy = tileInfo.y;

                // [추가] 고스트 미리보기 스냅 로직
                if (buildInfo.onResource) {
                    const nearest = this.entities.resources.find(r =>
                        Math.abs(r.x - mouseWorldX) < 60 && Math.abs(r.y - mouseWorldY) < 60 && r.type === buildInfo.onResource
                    );
                    if (nearest) {
                        gx = Math.round(nearest.x / this.tileMap.tileSize) - 1;
                        gy = Math.round(nearest.y / this.tileMap.tileSize) - 1;
                    }
                }

                this.ctx.save();
                this.ctx.globalAlpha = 0.5;

                const [tw, th] = buildInfo.size;
                let worldPos;

                if (tw > 1 || th > 1) {
                    worldPos = {
                        x: (gx + tw / 2) * this.tileMap.tileSize,
                        y: (gy + th / 2) * this.tileMap.tileSize
                    };
                } else {
                    worldPos = this.tileMap.gridToWorld(gx, gy);
                }

                const ClassRef = this.entityClasses[buildInfo.className];
                if (ClassRef) {
                    let ghost;
                    if (buildInfo.className === 'Turret') {
                        ghost = new ClassRef(worldPos.x, worldPos.y, this.selectedBuildType);
                    } else {
                        ghost = new ClassRef(worldPos.x, worldPos.y, this);
                    }

                    if (ghost.draw) {
                        this.ctx.save();
                        this.ctx.translate(worldPos.x, worldPos.y); // 위치 보정 추가
                        ghost.draw(this.ctx);
                        this.ctx.restore();
                    }
                }
                this.ctx.restore();
            }
        }

        // 4.3 Scout Range Preview
        if (this.isSkillMode && this.selectedSkill === 'scout') {
            // 정찰 프리뷰 삭제됨
        }

        // 4.4 Selection Box (StarCraft Style)
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

        this.ctx.restore();

        // 5. 건설 예약 청사진 (Ghost Previews for Build Queue)
        this.renderBuildQueue(allBuildings);

        this.renderMinimap();

        if (this.isSellMode) {
            this.ctx.save();
            this.ctx.fillStyle = '#ff3131';
            this.ctx.font = 'bold 24px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = '#ff3131';
            this.ctx.fillText('판매 모드 (우클릭 드래그로 철거)', this.canvas.width / 2, 100);
            this.ctx.restore();
        }
    }

    renderBuildQueue(allBuildings) {
        // 모든 공병을 순회하며 유니크한 그룹 큐들을 수집
        const uniqueQueues = new Set();
        this.entities.units.forEach(u => {
            if (u.type === 'engineer' && u.myGroupQueue) {
                uniqueQueues.add(u.myGroupQueue);
            }
        });

        if (uniqueQueues.size === 0) return;

        this.ctx.save();
        this.ctx.translate(this.camera.x, this.camera.y);
        this.ctx.scale(this.camera.zoom, this.camera.zoom);

        uniqueQueues.forEach(queue => {
            queue.forEach((task, index) => {
                const buildInfo = this.buildingRegistry[task.type];
                if (!buildInfo) return;

                // 1. 청사진 건물 그리기
                this.ctx.save();
                this.ctx.globalAlpha = 0.3;

                const size = buildInfo.size;
                const stw = size[0], sth = size[1];
                let worldPos;
                const gx = task.gridX, gy = task.gridY;

                if (stw > 1 || sth > 1) {
                    worldPos = {
                        x: (gx + stw / 2) * this.tileMap.tileSize,
                        y: (gy + sth / 2) * this.tileMap.tileSize
                    };
                } else {
                    worldPos = this.tileMap.gridToWorld(gx, gy);
                }

                const ClassRef = this.entityClasses[buildInfo.className];
                if (ClassRef) {
                    let ghost;
                    if (buildInfo.className === 'Turret') {
                        ghost = new ClassRef(worldPos.x, worldPos.y, task.type);
                    } else {
                        ghost = new ClassRef(worldPos.x, worldPos.y, this);
                    }

                    if (ghost.draw) {
                        ghost.draw(this.ctx);
                    }
                }
                this.ctx.restore();
                // 2. 예약 정보 표시
                this.ctx.fillStyle = task.assignedEngineer ? '#39ff14' : '#00ffcc';
                this.ctx.font = 'bold 12px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(task.assignedEngineer ? `작업 중` : `대기 (${index + 1})`, task.x, task.y - 20);
            });
        });

        this.ctx.restore();
    }

    renderTooltip() {
        if (this.isHoveringUI) return;

        const worldX = (this.camera.mouseX - this.camera.x) / this.camera.zoom;
        const worldY = (this.camera.mouseY - this.camera.y) / this.camera.zoom;

        // [추가] 현재 마우스 위치가 시야 확보(inSight)된 지역이 아니면 툴팁을 표시하지 않음
        if (this.tileMap && !this.tileMap.isInSight(worldX, worldY)) {
            this.hideUITooltip();
            return;
        }

        let title = '';
        let desc = '';

        // 1. Check Resources
        const hoveredResource = this.entities.resources.find(r => Math.hypot(r.x - worldX, r.y - worldY) < 15);
        if (hoveredResource) {
            title = hoveredResource.name;
            desc = '자원 채굴 건물을 건설하여 자원을 수집하세요.';
        }

        // 5. Check Walls
        const hoveredWall = this.entities.walls.find(w => Math.hypot(w.x - worldX, w.y - worldY) < 15);
        if (hoveredWall) {
            title = '철조망';
            desc = `<div class="stat-row"><span>🧱 기능:</span> <span>적의 진로 방해</span></div>
                    <div class="stat-row"><span>❤️ 내구도:</span> <span class="highlight">${Math.ceil(hoveredWall.hp)}/${hoveredWall.maxHp}</span></div>`;
        }

        // 7. Check Airport
        const hoveredAirport = this.entities.airports.find(a => Math.abs(a.x - worldX) < 100 && Math.abs(a.y - worldY) < 140);
        if (hoveredAirport) {
            title = '공항';
            desc = `<div class="stat-row"><span>✈️ 기능:</span> <span>항공 유닛 생산 및 특수 스킬</span></div>
                    <div class="stat-row"><span>❤️ 내구도:</span> <span class="highlight">${Math.ceil(hoveredAirport.hp)}/${hoveredAirport.maxHp}</span></div>
                    <div class="stat-row"><span>💡 선택:</span> <span>좌클릭 시 유닛 생산</span></div>`;
        }

        // 8. Check Gold Mine
        const hoveredGoldMine = this.entities.goldMines.find(gm => Math.hypot(gm.x - worldX, gm.y - worldY) < 15);
        if (hoveredGoldMine) {
            title = '금 채굴장';
            desc = `<div class="stat-row"><span>⛽ 남은 자원:</span> <span class="highlight">${Math.ceil(hoveredGoldMine.fuel)}</span></div>
                    <div class="stat-row"><span>❤️ 내구도:</span> <span class="highlight">${Math.ceil(hoveredGoldMine.hp)}/${hoveredGoldMine.maxHp}</span></div>
                    <div class="stat-row"><span>🔌 연결 상태:</span> <span class="${hoveredGoldMine.isConnectedToBase || hoveredGoldMine.connectedTarget ? 'text-green' : 'text-red'}">${hoveredGoldMine.isConnectedToBase || hoveredGoldMine.connectedTarget ? '연결됨' : '연결 안됨'}</span></div>`;
        }

        // 9. Check Storage
        const hoveredStorage = this.entities.storage.find(s => Math.abs(s.x - worldX) < 80 && Math.abs(s.y - worldY) < 60);
        if (hoveredStorage) {
            title = '보급고';
            desc = `<div class="stat-row"><span>📦 보관량:</span> <span class="highlight">${Math.floor(hoveredStorage.storedResources.gold + hoveredStorage.storedResources.oil)}/${hoveredStorage.maxCapacity}</span></div>
                    <div class="stat-row"><span>💰 금:</span> <span class="highlight">${Math.floor(hoveredStorage.storedResources.gold)}</span></div>
                    <div class="stat-row"><span>🛢️ 석유:</span> <span class="highlight">${Math.floor(hoveredStorage.storedResources.oil)}</span></div>
                    <div class="stat-row"><span>❤️ 내구도:</span> <span class="highlight">${Math.ceil(hoveredStorage.hp)}/${hoveredStorage.maxHp}</span></div>
                    <div class="stat-row"><span>💡 선택:</span> <span>좌클릭 시 정보 확인</span></div>`;
        }

        // 10. Check Armory
        const hoveredArmory = this.entities.armories.find(a => Math.abs(a.x - worldX) < 80 && Math.abs(a.y - worldY) < 60);
        if (hoveredArmory) {
            title = '병기창';
            let productionInfo = '';
            if (hoveredArmory.spawnQueue.length > 0) {
                const current = hoveredArmory.spawnQueue[0];
                const progress = Math.floor((current.timer / hoveredArmory.spawnTime) * 100);
                const typeName = current.type === 'tank' ? '전차' : '장비';
                productionInfo = `<div class="stat-row"><span>🏗️ 생산 중:</span> <span class="highlight">${typeName} ${progress}% (대기 ${hoveredArmory.spawnQueue.length})</span></div>`;
            }

            desc = `<div class="stat-row"><span>🛡️ 수비 유닛:</span> <span class="highlight">${hoveredArmory.units.length}대 운용 중</span></div>
                    <div class="stat-row"><span>❤️ 내구도:</span> <span class="highlight">${Math.ceil(hoveredArmory.hp)}/${hoveredArmory.maxHp}</span></div>
                    ${productionInfo}
                    <div class="stat-row"><span>💡 선택:</span> <span>좌클릭 시 유닛 생산</span></div>`;
        }

        // 11. Check Barracks
        const hoveredBarracks = this.entities.barracks.find(b => Math.abs(b.x - worldX) < 60 && Math.abs(b.y - worldY) < 60);
        if (hoveredBarracks) {
            title = '병영';
            let productionInfo = '';
            if (hoveredBarracks.spawnQueue.length > 0) {
                const current = hoveredBarracks.spawnQueue[0];
                const progress = Math.floor((current.timer / hoveredBarracks.spawnTime) * 100);
                productionInfo = `<div class="stat-row"><span>🏗️ 생산 중:</span> <span class="highlight">보병 ${progress}% (대기 ${hoveredBarracks.spawnQueue.length})</span></div>`;
            }

            desc = `<div class="stat-row"><span>🛡️ 기능:</span> <span>보병 유닛 생산</span></div>
                    <div class="stat-row"><span>❤️ 내구도:</span> <span class="highlight">${Math.ceil(hoveredBarracks.hp)}/${hoveredBarracks.maxHp}</span></div>
                    ${productionInfo}
                    <div class="stat-row"><span>💡 선택:</span> <span>좌클릭 시 유닛 생산</span></div>`;
        }

        // 11.5 Check Apartment
        const hoveredApartment = this.entities.apartments.find(a => Math.abs(a.x - worldX) < 80 && Math.abs(a.y - worldY) < 100);
        if (hoveredApartment) {
            title = '아파트';
            desc = `<div class="stat-row"><span>🏠 기능:</span> <span>인구수 제공 (+${hoveredApartment.popProvide})</span></div>
                    <div class="stat-row"><span>❤️ 내구도:</span> <span class="highlight">${Math.ceil(hoveredApartment.hp)}/${hoveredApartment.maxHp}</span></div>`;
        }

        // 12. Check Refinery
        const hoveredRefinery = this.entities.refineries.find(r => Math.hypot(r.x - worldX, r.y - worldY) < 15);
        if (hoveredRefinery) {
            title = '정제소';
            desc = `<div class="stat-row"><span>⛽ 남은 자원:</span> <span class="highlight">${Math.ceil(hoveredRefinery.fuel)}</span></div>
                    <div class="stat-row"><span>❤️ 내구도:</span> <span class="highlight">${Math.ceil(hoveredRefinery.hp)}/${hoveredRefinery.maxHp}</span></div>`;
        }

        // 14. Check Base
        const hoveredBase = Math.abs(this.entities.base.x - worldX) < 100 && Math.abs(this.entities.base.y - worldY) < 100;
        if (hoveredBase) {
            const b = this.entities.base;
            title = '총사령부';
            let productionInfo = '';
            if (b.spawnQueue.length > 0) {
                const current = b.spawnQueue[0];
                const progress = Math.floor((current.timer / b.spawnTime) * 100);
                productionInfo = `<div class="stat-row"><span>🏗️ 생산 중:</span> <span class="highlight">공병 ${progress}% (대기 ${b.spawnQueue.length})</span></div>`;
            }

            desc = `<div class="stat-row"><span>🏰 기능:</span> <span>중앙 지휘 통제 및 공병 생산</span></div>
                    <div class="stat-row"><span>❤️ 내구도:</span> <span class="highlight">${Math.ceil(b.hp)}/${b.maxHp}</span></div>
                    ${productionInfo}
                    <div class="stat-row"><span>💡 선택:</span> <span>좌클릭 시 공병 생산</span></div>`;
        }

        // 15. Check Units
        const hoveredUnit = this.entities.units.find(u => Math.hypot(u.x - worldX, u.y - worldY) < 15);
        const activeUnit = hoveredUnit || (this.selectedEntity && this.entities.units.includes(this.selectedEntity) ? this.selectedEntity : null);

        if (activeUnit) {
            title = activeUnit.name || '유닛';
            let amountInfo = '';
            if (activeUnit.type?.startsWith('ammo-')) {
                amountInfo = `<div class="stat-row"><span>📦 탄약량:</span> <span class="highlight">${activeUnit.amount} / ${activeUnit.maxAmount}</span></div>`;
            }

            desc = `<div class="stat-row"><span>⚔️ 공격력:</span> <span class="highlight">${activeUnit.damage}</span></div>
                    <div class="stat-row"><span>🔭 공격 사거리:</span> <span class="highlight">${activeUnit.attackRange}</span></div>
                    <div class="stat-row"><span>👁️ 시야 범위:</span> <span class="highlight">${activeUnit.visionRange}</span></div>
                    <div class="stat-row"><span>❤️ 체력:</span> <span class="highlight">${Math.ceil(activeUnit.hp)}/${activeUnit.maxHp}</span></div>
                    ${amountInfo}
                    <div class="stat-row"><span>🏠 소속:</span> <span>부대 유닛</span></div>`;
        }

        if (title) {
            this.showUITooltip(title, desc, this.camera.mouseX, this.camera.mouseY);
        } else {
            this.hideUITooltip();
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

        // 1. 전체 배경 및 캐싱된 지형 렌더링
        mCtx.fillStyle = '#0a0a0a';
        mCtx.fillRect(0, 0, mapWorldWidth, mapWorldHeight);

        // [최적화] 매 프레임 수만 개의 타일을 그리는 대신, 캐시된 캔버스를 한 번에 출력
        mCtx.imageSmoothingEnabled = false;
        mCtx.drawImage(this.minimapCacheCanvas, 0, 0, mapWorldWidth, mapWorldHeight);

        // Helper to check if a world position is visible
        const isVisible = (worldX, worldY) => {
            const g = this.tileMap.worldToGrid(worldX, worldY);
            return this.tileMap.grid[g.y] && this.tileMap.grid[g.y][g.x] && this.tileMap.grid[g.y][g.x].visible;
        };

        // 3. 밝혀진 영역 내의 엔티티들만 그림
        const base = this.entities.base;
        if (isVisible(base.x, base.y)) {
            mCtx.fillStyle = '#00d2ff';
            mCtx.beginPath(); mCtx.arc(base.x, base.y, 40, 0, Math.PI * 2); mCtx.fill();
        }

        // 모든 건물 일괄 렌더링 (동적 지원)
        const allBuildings = this.getAllBuildings();
        allBuildings.forEach(b => {
            if (b === base) return; // 기지는 이미 위에서 그림
            if (!isVisible(b.x, b.y)) return;

            // 타입별 미니맵 색상 결정
            let color = '#aaa'; // 기본색
            if (b.type === 'wall') color = '#666';
            else if (b.type === 'refinery') color = '#32cd32';
            else if (b.type === 'gold-mine') color = '#FFD700';
            else if (b.type === 'iron-mine') color = '#a5a5a5';
            else if (b.type === 'apartment') color = '#3498db';
            else if (b.type === 'storage') color = '#00d2ff';
            else if (b.type === 'ammo-factory') color = '#7f8c8d';
            else if (b.type === 'armory') color = '#34495e';
            else if (b.type === 'barracks') color = '#27ae60';
            else if (b.type === 'airport') color = '#7f8c8d';

            mCtx.fillStyle = color;
            const size = 40;
            mCtx.fillRect(b.x - size / 2, b.y - size / 2, size, size);
        });

        this.entities.units.forEach(u => {
            if (u.isBoarded) return;
            if (isVisible(u.x, u.y)) {
                // 아군 유닛은 초록색 계열, 적군은 빨간색
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

        // 5. 뷰포트 사각형 (카메라 영역)
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
        
        // [추가] 디버그 시스템의 전체 시야 모드 활성화 시 업데이트 스킵
        if (this.debugSystem && this.debugSystem.isFullVision) return;

        // 1. 모든 타일의 현재 시야(inSight) 초기화
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
                            this.tileMap.grid[ny][nx].visible = true; // 개척됨
                            this.tileMap.grid[ny][nx].inSight = true; // 현재 보고 있음
                        }
                    }
                }
            }
        };

        // 1. 기지 주변 시야
        reveal(this.entities.base.x, this.entities.base.y, 50);

        // 2. 모든 아군 유닛 주변 시야
        this.entities.units.forEach(unit => {
            if (unit.alive) {
                reveal(unit.x, unit.y, unit.visionRange || 5);
            }
        });

        // 3. (추가) 모든 건물 주변 시야 - 건물이 있는 곳도 현재 시야를 확보해야 함
        const buildings = this.getAllBuildings();
        buildings.forEach(b => {
            if (b.active || b.hp > 0) {
                // 건물은 기본적으로 자기 자리 주변 1~2칸 시야 확보
                reveal(b.x, b.y, 3);
            }
        });

        // [최적화] 시야 데이터 변경 후 오프스크린 포그 캔버스 갱신
        if (this.tileMap && this.tileMap.updateFogCanvas) {
            this.tileMap.updateFogCanvas();
        }

        // [최적화] 시야 변경 시 미니맵 배경 캐시도 함께 갱신
        this.updateMinimapCache();
    }

    updateMinimapCache() {
        if (!this.minimapCacheCtx) return;

        const mCtx = this.minimapCacheCtx;
        const cols = this.tileMap.cols;
        const rows = this.tileMap.rows;

        // ImageData 직접 조작으로 성능 극대화 (미니맵 배경색)
        const imageData = mCtx.createImageData(cols, rows);
        const buffer = new Uint32Array(imageData.data.buffer);

        // 색상 상수 (Abgr 순서 - Little Endian)
        const SOIL = 0xFF37405D; // #5d4037
        const DIRT = 0xFF1A1A1A; // #1a1a1a
        const HIDDEN = 0x00000000; // 아직 안 밝혀진 곳은 투명 (배경색이 보임)

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
        const allBuildings = this.getAllBuildings();

        // 1. 최대 인구수 계산 (전력이 공급되는 건물의 popProvide 합산)
        let maxPop = 0;
        allBuildings.forEach(b => {
            if (b.active && !b.isUnderConstruction) {
                maxPop += b.popProvide || 0;
            }
        });
        this.resources.maxPopulation = maxPop;

        // 2. 현재 인구수 계산 (아군 유닛만)
        let currentPop = 0;
        this.entities.units.forEach(unit => {
            // 탑승 중인 유닛(isBoarded)도 인구수에 포함되어야 함
            if (unit.ownerId === 1 && (unit.active || unit.isBoarded) && unit.hp > 0) {
                currentPop += unit.popCost || 0;
            }
        });

        // 3. 생산 큐에 있는 유닛들도 인구수에 포함
        const popMap = {
            'tank': 3, 'missile-launcher': 3, 'artillery': 4, 'anti-air': 3,
            'rifleman': 1, 'sniper': 1, 'engineer': 1,
            'scout-plane': 1, 'bomber': 6, 'cargo-plane': 4
        };

        allBuildings.forEach(b => {
            if (b && b.spawnQueue) {
                b.spawnQueue.forEach(item => {
                    currentPop += popMap[item.type] || 0;
                });
            }
        });

        this.resources.population = currentPop;
    }

    updateResourceUI() {
        document.getElementById('resource-gold').textContent = Math.floor(this.resources.gold);
        document.getElementById('resource-oil').textContent = Math.floor(this.resources.oil);
        document.getElementById('resource-iron').textContent = Math.floor(this.resources.iron);

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

        if (direction && !this.isBuildMode) {
            document.body.classList.add(`sc-${direction}`);
        }

        // If direction changed or stopped, update mode cursors
        if (direction !== (oldDirection ? oldDirection.replace('sc-', '') : '')) {
            this.updateCursor();
        }
    }

    loop(timestamp) {
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;
        this.update(deltaTime);
        this.render();

        if (this.hoveredEntity) {
            // 호버 중인 엔티티가 죽었는지 확인
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

        // 6. Draw Active Previews and Highlights on TOP of everything

        // 6.1 Selected Object Highlight
        if (this.selectedEntities.length > 0) {

            this.ctx.save();
            this.ctx.lineWidth = 1;
            this.selectedEntities.forEach(ent => {
                // 관계에 따른 하이라이트 색상 결정
                const relation = this.getRelation(1, ent.ownerId);

                if (relation === 'self') this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)'; // 자신: 초록
                else if (relation === 'enemy') this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)'; // 적군: 빨강
                else if (relation === 'neutral') this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)'; // 중립: 노랑
                else if (relation === 'ally') this.ctx.strokeStyle = 'rgba(0, 0, 255, 0.8)'; // 아군: 파랑
                else this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'; // 기타: 흰색

                const bounds = ent.getSelectionBounds ? ent.getSelectionBounds() : {
                    left: ent.x - 20, right: ent.x + 20, top: ent.y - 20, bottom: ent.y + 20
                };
                const w = bounds.right - bounds.left;
                const h = bounds.bottom - bounds.top;
                this.ctx.strokeRect(bounds.left, bounds.top, w, h);

                // 공격 사거리 표시 (내 유닛 또는 아군 유닛인 경우)
                if ((relation === 'self' || relation === 'ally') && ent.attackRange) {
                    this.ctx.save();

                    let rangeColor = 'rgba(255, 255, 255, 0.15)'; // 기본 연한 흰색

                    // 수동 조준 모드일 때 사거리 피드백 추가
                    if (this.unitCommandMode === 'manual_fire' && ent.type === 'missile-launcher') {
                        const dist = Math.hypot(mouseWorldX - ent.x, mouseWorldY - ent.y);
                        if (dist > ent.attackRange) {
                            rangeColor = 'rgba(255, 0, 0, 0.6)'; // 사거리 밖: 빨간색
                        } else {
                            rangeColor = 'rgba(0, 255, 0, 0.4)'; // 사거리 안: 초록색
                        }

                        // 조준 가이드 라인 (유닛에서 마우스까지)
                        this.ctx.beginPath();
                        this.ctx.moveTo(ent.x, ent.y);
                        this.ctx.lineTo(mouseWorldX, mouseWorldY);
                        this.ctx.strokeStyle = rangeColor;
                        this.ctx.setLineDash([2, 2]);
                        this.ctx.stroke();
                    }

                    this.ctx.beginPath();
                    this.ctx.arc(ent.x, ent.y, ent.attackRange, 0, Math.PI * 2);
                    this.ctx.strokeStyle = rangeColor;
                    this.ctx.setLineDash([5, 5]);
                    this.ctx.stroke();
                    this.ctx.restore();
                }

                // Draw movement line if destination exists
                if (ent.destination) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(ent.x, ent.y);

                    // A* 경로가 있으면 경로를 따라 그리기
                    if (ent.path && ent.path.length > 0) {
                        for (const p of ent.path) {
                            this.ctx.lineTo(p.x, p.y);
                        }
                    } else {
                        // 경로가 없거나(계산 전) 공중 유닛인 경우 직선
                        this.ctx.lineTo(ent.destination.x, ent.destination.y);
                    }

                    this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
                    this.ctx.lineWidth = 1.5;
                    this.ctx.setLineDash([5, 5]);
                    this.ctx.stroke();
                    this.ctx.setLineDash([]);

                    // Draw destination X marker
                    this.ctx.beginPath();
                    const dest = ent.destination;
                    const markerSize = 5;
                    this.ctx.moveTo(dest.x - markerSize, dest.y - markerSize);
                    this.ctx.lineTo(dest.x + markerSize, dest.y + markerSize);
                    this.ctx.moveTo(dest.x + markerSize, dest.y - markerSize);
                    this.ctx.lineTo(dest.x - markerSize, dest.y + markerSize);
                    this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
                    this.ctx.lineWidth = 2;
                    this.ctx.stroke();
                }
            });
            this.ctx.restore();

            // --- [독립 블록] 공격 대상 하이라이트 (Target Highlight) ---
            const targetsToHighlight = new Set();
            this.selectedEntities.forEach(selUnit => {
                // [수정] 오직 플레이어가 직접 지정한 수동 타겟(manualTarget)만 표시
                const mTarget = selUnit.manualTarget;
                if (mTarget && (mTarget.active !== false) && (mTarget.alive !== false) && (mTarget.hp > 0)) {
                    targetsToHighlight.add(mTarget);
                }

                // 미사일 발사대 수동 조준/발사 준비 지점 (플레이어 조작이므로 포함)
                if (selUnit.type === 'missile-launcher' && selUnit.isFiring && selUnit.pendingFirePos) {
                    const fireTarget = [...this.entities.enemies, ...this.entities.neutral].find(ent =>
                        (ent.active !== false && ent.alive !== false) && Math.hypot(ent.x - selUnit.pendingFirePos.x, ent.y - selUnit.pendingFirePos.y) < 60
                    );
                    if (fireTarget) targetsToHighlight.add(fireTarget);
                }
            });

            // 4. 수동 조준 모드 시 마우스 아래의 적 또는 중립 (조준 보조)
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
                const padding = 8; // 패딩을 조금 더 늘려 잘 보이게 함
                const tW = (bounds.right - bounds.left) + padding * 2;
                const tH = (bounds.bottom - bounds.top) + padding * 2;
                const tX = bounds.left - padding;
                const tY = bounds.top - padding;

                this.ctx.save();
                this.ctx.strokeStyle = '#ff3131';
                this.ctx.lineWidth = 3;
                const pulse = Math.sin(Date.now() / 150) * 0.5 + 0.5;
                this.ctx.globalAlpha = 0.5 + pulse * 0.5; // 불투명도 상향

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
            this.ctx.strokeStyle = 'rgba(0, 255, 204, 0.8)';
            this.ctx.lineWidth = 2;
            this.ctx.shadowBlur = 5;
            this.ctx.shadowColor = 'rgba(0, 255, 204, 0.5)';

            const bounds = this.selectedEntity.getSelectionBounds();
            const w = bounds.right - bounds.left;
            const h = bounds.bottom - bounds.top;

            this.ctx.strokeRect(bounds.left, bounds.top, w, h);

            // 유닛(전차, 미사일) 선택 시 공격 사거리(Attack Range) 표시
            if (this.selectedEntity.attackRange) {
                this.ctx.save();
                this.ctx.beginPath();
                this.ctx.arc(this.selectedEntity.x, this.selectedEntity.y, this.selectedEntity.attackRange, 0, Math.PI * 2);
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                this.ctx.setLineDash([5, 5]);
                this.ctx.stroke();
                this.ctx.restore();
            }

            if (this.selectedEntity.type && this.selectedEntity.type.startsWith('turret')) {
                // 포탑은 사거리 원을 아주 연하게 추가 표시
                this.ctx.setLineDash([5, 10]);
                this.ctx.globalAlpha = 0.3;
                this.selectedEntity.draw(this.ctx, true);
            }
            this.ctx.restore();
        }

        // 4.2 Ghost Preview for Building
        if (this.isBuildMode && this.selectedBuildType) {
            let tileInfo = this.tileMap.getTileAt(mouseWorldX, mouseWorldY);
            const buildInfo = this.buildingRegistry[this.selectedBuildType];

            if (tileInfo && buildInfo) {
                let gx = tileInfo.x;
                let gy = tileInfo.y;

                // [추가] 고스트 미리보기 스냅 로직
                if (buildInfo.onResource) {
                    const nearest = this.entities.resources.find(r =>
                        Math.abs(r.x - mouseWorldX) < 60 && Math.abs(r.y - mouseWorldY) < 60 && r.type === buildInfo.onResource
                    );
                    if (nearest) {
                        gx = Math.round(nearest.x / this.tileMap.tileSize) - 1;
                        gy = Math.round(nearest.y / this.tileMap.tileSize) - 1;
                    }
                }

                this.ctx.save();
                this.ctx.globalAlpha = 0.5;

                const [tw, th] = buildInfo.size;
                let worldPos;

                if (tw > 1 || th > 1) {
                    worldPos = {
                        x: (gx + tw / 2) * this.tileMap.tileSize,
                        y: (gy + th / 2) * this.tileMap.tileSize
                    };
                } else {
                    worldPos = this.tileMap.gridToWorld(gx, gy);
                }

                const ClassRef = this.entityClasses[buildInfo.className];
                if (ClassRef) {
                    let ghost;
                    if (buildInfo.className === 'Turret') {
                        ghost = new ClassRef(worldPos.x, worldPos.y, this.selectedBuildType);
                    } else {
                        ghost = new ClassRef(worldPos.x, worldPos.y, this);
                    }

                    if (ghost.draw) {
                        this.ctx.save();
                        this.ctx.translate(worldPos.x, worldPos.y); // 위치 보정 추가
                        ghost.draw(this.ctx);
                        this.ctx.restore();
                    }
                }
                this.ctx.restore();
            }
        }

        // 4.4 Selection Box (StarCraft Style)
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
    }

    start() {
        requestAnimationFrame((t) => this.loop(t));
    }

    jumpToGroup(group) {
        if (!group || group.length === 0) return;

        let avgX = 0;
        let avgY = 0;
        group.forEach(u => {
            avgX += u.x;
            avgY += u.y;
        });
        avgX /= group.length;
        avgY /= group.length;

        this.camera.x = this.canvas.width / 2 - avgX * this.camera.zoom;
        this.camera.y = this.canvas.height / 2 - avgY * this.camera.zoom;
    }
}
