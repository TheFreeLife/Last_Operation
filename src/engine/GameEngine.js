import { TileMap } from '../map/TileMap.js';
import { PlayerUnit, Base, Turret, Enemy, Projectile, Generator, Resource, CoalGenerator, OilGenerator, PowerLine, Wall, Airport, ScoutPlane, Refinery, PipeLine, GoldMine, Storage, CargoPlane, Armory, Tank, MissileLauncher, Rifleman, Barracks, CombatEngineer } from '../entities/Entities.js';
import { UpgradeManager } from '../systems/GameSystems.js';
import { ICONS } from '../assets/Icons.js';

export class GameEngine {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.minimapCanvas = document.getElementById('minimapCanvas');
        this.minimapCtx = this.minimapCanvas.getContext('2d');

        this.resize();

        this.entityClasses = { PlayerUnit, Base, Turret, Enemy, Projectile, Generator, CoalGenerator, OilGenerator, PowerLine, Wall, Airport, ScoutPlane, Refinery, PipeLine, GoldMine, Storage, CargoPlane, Armory, Tank, MissileLauncher, Rifleman, Barracks, CombatEngineer };
        this.tileMap = new TileMap(this.canvas);

        const basePos = this.tileMap.gridToWorld(this.tileMap.centerX, this.tileMap.centerY);
        this.entities = {
            enemies: [],
            turrets: [],
            projectiles: [],
            generators: [],
            powerLines: [],
            walls: [],
            airports: [],
            refineries: [],
            goldMines: [],
            storage: [],
            armories: [],
            barracks: [],
            units: [],
            pipeLines: [],
            scoutPlanes: [],
            cargoPlanes: [],
            resources: [],
            base: new Base(basePos.x, basePos.y)
        };

        this.initResources();
        
        // Spawn starting units near base
        const spawnOffset = 100;
        const startTank = new Tank(basePos.x - spawnOffset, basePos.y + spawnOffset, this);
        const startMissile = new MissileLauncher(basePos.x + spawnOffset, basePos.y + spawnOffset, this);
        const startInfantry = new Rifleman(basePos.x, basePos.y + spawnOffset + 20, this);
        
        // 공병 3마리 기본 제공
        const startEngineers = [
            new CombatEngineer(basePos.x - 40, basePos.y + spawnOffset + 40, this),
            new CombatEngineer(basePos.x, basePos.y + spawnOffset + 40, this),
            new CombatEngineer(basePos.x + 40, basePos.y + spawnOffset + 40, this)
        ];
        
        startTank.destination = { x: basePos.x - spawnOffset - 40, y: basePos.y + spawnOffset + 40 };
        startMissile.destination = { x: basePos.x + spawnOffset + 40, y: basePos.y + spawnOffset + 40 };
        startInfantry.destination = { x: basePos.x, y: basePos.y + spawnOffset + 60 };
        
        this.entities.units.push(startTank, startMissile, startInfantry, ...startEngineers);

        this.updateVisibility(); // 초기 시야 확보

        this.buildingRegistry = {
            'turret-basic': { cost: 50, size: [1, 1], className: 'Turret', list: 'turrets', buildTime: 5 },
            'turret-fast': { cost: 100, size: [1, 1], className: 'Turret', list: 'turrets', buildTime: 8 },
            'turret-sniper': { cost: 150, size: [1, 1], className: 'Turret', list: 'turrets', buildTime: 12 },
            'turret-tesla': { cost: 200, size: [1, 1], className: 'Turret', list: 'turrets', buildTime: 10 },
            'turret-flamethrower': { cost: 250, size: [1, 1], className: 'Turret', list: 'turrets', buildTime: 10 },
            'power-line': { cost: 10, size: [1, 1], className: 'PowerLine', list: 'powerLines', buildTime: 1 },
            'pipe-line': { cost: 10, size: [1, 1], className: 'PipeLine', list: 'pipeLines', buildTime: 1 },
            'wall': { cost: 30, size: [1, 1], className: 'Wall', list: 'walls', buildTime: 3 },
            'airport': { cost: 500, size: [2, 3], className: 'Airport', list: 'airports', buildTime: 20 },
            'refinery': { cost: 300, size: [1, 1], className: 'Refinery', list: 'refineries', onResource: 'oil', buildTime: 15 },
            'gold-mine': { cost: 400, size: [1, 1], className: 'GoldMine', list: 'goldMines', onResource: 'gold', buildTime: 15 },
            'storage': { cost: 200, size: [2, 2], className: 'Storage', list: 'storage', buildTime: 12 },
            'armory': { cost: 600, size: [2, 2], className: 'Armory', list: 'armories', buildTime: 18 },
            'barracks': { cost: 400, size: [2, 2], className: 'Barracks', list: 'barracks', buildTime: 15 },
            'base': { cost: 0, size: [5, 5], className: 'Base', list: 'base' }, // 크기 업데이트
            'coal-generator': { cost: 200, size: [1, 1], className: 'CoalGenerator', list: 'generators', onResource: 'coal', buildTime: 10 },
            'oil-generator': { cost: 200, size: [1, 1], className: 'OilGenerator', list: 'generators', onResource: 'oil', buildTime: 10 }
        };

        this.resources = { gold: 999999, oil: 0 };
        this.globalStats = { damage: 10, range: 150, fireRate: 1000 };
        this.upgradeManager = new UpgradeManager(this);

        this.lastTime = 0;
        this.gameState = 'playing'; // playing, upgrading, gameOver
        this.selectedBuildType = null;
        this.isBuildMode = false;
        this.isSellMode = false;
        this.isSkillMode = false;
        this.selectedSkill = null;
        this.unitCommandMode = null; // 'move', 'attack', 'patrol' 등
        this.selectedAirport = null;
        this.selectedEntity = null; // Track any selected building
        this.selectedEntities = []; // Track multiple selected units
        this.currentMenuName = 'main'; // Track current sub-menu
        this.inventory = [];
        this.maxInventorySize = 6;
        this.isHoveringUI = false;
        this.pendingItemIndex = -1; // To track which item is being used for building
        this.lastPlacedGrid = { x: -1, y: -1 }; // 연속 건설 버그 방지용 추가
        this.isEngineerBuilding = false; // 공병 건설 메뉴 오픈 여부

        // Camera State (Center on base considering zoom)
        const baseWorldPos = this.entities.base;
        const initialZoom = 0.8;
        this.camera = {
            x: this.canvas.width / 2 - baseWorldPos.x * initialZoom,
            y: this.canvas.height / 2 - baseWorldPos.y * initialZoom,
            zoom: initialZoom,
            mouseX: 0,
            mouseY: 0,
            edgeScrollSpeed: 15,
            edgeThreshold: 30,
            selectionBox: null // { startX, startY, endX, endY }
        };

        window.addEventListener('resize', () => this.resize());
        this.initInput();
        this.initUI();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.minimapCanvas.width = 200;
        this.minimapCanvas.height = 200;
    }

        initResources() {

            const resourceTypes = ['coal', 'oil', 'gold'];

            const numberOfVeins = 120; // Increased count to accommodate gold

    

            for (let i = 0; i < numberOfVeins; i++) {

                let startX, startY;
            let validStart = false;
            let attempts = 0;

            while (!validStart && attempts < 100) {
                startX = Math.floor(Math.random() * (this.tileMap.cols - 4)) + 2;
                startY = Math.floor(Math.random() * (this.tileMap.rows - 4)) + 2;

                const distToBase = Math.hypot(startX - this.tileMap.centerX, startY - this.tileMap.centerY);
                if (distToBase > 5) {
                    validStart = true;
                }
                attempts++;
            }

            if (!validStart) continue;

            const currentVeinType = resourceTypes[Math.floor(Math.random() * resourceTypes.length)];
            const patternType = Math.random();

            if (patternType < 0.4) {
                this.generateBlob(startX, startY, currentVeinType);
            } else if (patternType < 0.7) {
                this.generateSnake(startX, startY, currentVeinType);
            } else {
                this.generateScatter(startX, startY, currentVeinType);
            }
        }
    }

    generateBlob(cx, cy, type) {
        const radius = 2; 
        for (let y = -radius; y <= radius; y++) {
            for (let x = -radius; x <= radius; x++) {
                if (x*x + y*y <= radius*radius + 0.5) {
                    if (Math.abs(x) <= 1 && Math.abs(y) <= 1 || Math.random() > 0.2) {
                        this.tryPlaceResource(cx + x, cy + y, type);
                    }
                }
            }
        }
    }

    generateSnake(startX, startY, type) {
        let x = startX;
        let y = startY;
        const length = 5 + Math.floor(Math.random() * 5);

        for (let i = 0; i < length; i++) {
            this.tryPlaceResource(x, y, type);
            const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
            const dir = dirs[Math.floor(Math.random() * dirs.length)];
            x += dir[0];
            y += dir[1];
        }
    }

    generateScatter(cx, cy, type) {
        const count = 6 + Math.floor(Math.random() * 4);
        for (let i = 0; i < count; i++) {
            const ox = Math.floor((Math.random() - 0.5) * 6);
            const oy = Math.floor((Math.random() - 0.5) * 6);
            this.tryPlaceResource(cx + ox, cy + oy, type);
        }
    }

    tryPlaceResource(x, y, type) {
        if (x >= 0 && x < this.tileMap.cols && y >= 0 && y < this.tileMap.rows) {
            const tile = this.tileMap.grid[y][x];
            const distToBase = Math.hypot(x - this.tileMap.centerX, y - this.tileMap.centerY);
            
            if (tile.buildable && !tile.occupied && distToBase > 5) {
                this.placeResource(x, y, type);
            }
        }
    }

    placeResource(x, y, type) {
        const pos = this.tileMap.gridToWorld(x, y);
        this.entities.resources.push(new Resource(pos.x, pos.y, type));
        this.tileMap.grid[y][x].occupied = true;
        this.tileMap.grid[y][x].type = 'resource'; // 타일 타입을 resource로 명시
    }

    initUI() {
        document.getElementById('restart-btn')?.addEventListener('click', () => location.reload());
        document.getElementById('roll-card-btn')?.addEventListener('click', () => this.rollRandomCard());
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
        
        let menuType = 'main';
        let items = [];

        if (this.selectedEntities.length > 0 && !this.isEngineerBuilding) {
            const unitTypes = ['tank', 'missile-launcher', 'rifleman', 'engineer'];
            const allUnits = this.selectedEntities.every(ent => unitTypes.includes(ent.type));
            const firstType = this.selectedEntities[0].type;
            const allSameType = this.selectedEntities.every(ent => ent.type === firstType);

            if (allUnits) {
                menuType = 'unit';
                header.textContent = this.selectedEntities.length > 1 ? `부대 (${this.selectedEntities.length})` : this.selectedEntities[0].name;
                
                // 1. 모든 유닛 공통 명령 (이동, 정지, 홀드, 패트롤, 어택)
                items = [
                    { id: 'move', name: '이동 (M)', icon: '🏃', action: 'unit:move' },
                    { id: 'stop', name: '정지 (S)', icon: '🛑', action: 'unit:stop' },
                    { id: 'hold', name: '홀드 (H)', icon: '🛡️', action: 'unit:hold' },
                    { id: 'patrol', name: '패트롤 (P)', icon: '🔄', action: 'unit:patrol' },
                    { id: 'attack', name: '어택 (A)', icon: '⚔️', action: 'unit:attack' },
                    null, null, null, null
                ];

                // 2. 고유 스킬 판정: 모든 선택 유닛이 동일한 타입일 때만 활성화 (건물과 동일한 규칙)
                if (allSameType) {
                    const unitType = firstType;
                    if (unitType === 'engineer') {
                        // 공병 고유 스킬: 건설 (6번 슬롯 - 좌측 하단)
                        items[6] = { id: 'engineer_build', name: '건설 (B)', action: 'menu:engineer_build' };
                    }
                    // 향후 다른 유닛(전차, 미사일 등)의 고유 스킬도 여기에 추가 가능
                }
            } else if (allSameType) {
                const type = firstType;
                header.textContent = this.selectedEntities.length > 1 ? `${this.selectedEntities[0].name} (${this.selectedEntities.length})` : this.selectedEntities[0].name;
                
                if (type === 'armory') {
                    items = [
                        { type: 'skill-tank', name: '전차 생산', cost: 300, action: 'skill:tank' },
                        { type: 'skill-missile', name: '미사일 생산', cost: 500, action: 'skill:missile' },
                        null, null, null, null, { type: 'menu:main', name: '취소', action: 'menu:main' }, null, null
                    ];
                } else if (type === 'barracks') {
                    items = [
                        { type: 'skill-rifleman', name: '소총병 생산', cost: 100, action: 'skill:rifleman' },
                        null, null, null, null, null, { type: 'menu:main', name: '취소', action: 'menu:main' }, null, null
                    ];
                } else if (type === 'airport') {
                    items = [
                        { type: 'skill-scout', name: '정찰', cost: 100, action: 'skill:scout' },
                        null, null, null, null, null, { type: 'menu:main', name: '취소', action: 'menu:main' }, null, null
                    ];
                } else if (type === 'storage') {
                    items = [
                        { type: 'skill-cargo', name: '수송기 생산', cost: 100, action: 'skill:cargo' },
                        null, null, null, null, null, { type: 'menu:main', name: '취소', action: 'menu:main' }, null, null
                    ];
                } else if (type === 'base') {
                    items = [
                        { type: 'skill-engineer', name: '공병 생산', cost: 150, action: 'skill:engineer' },
                        null, null, null, null, null, null, null, null
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
            
            if (this.currentMenuName === 'network') {
                header.textContent = '네트워크';
                items = [
                    { type: 'power-line', name: '전선', cost: 10 }, { type: 'pipe-line', name: '파이프', cost: 10 },
                    null, null, null, null, { type: 'menu:main', name: '뒤로', action: 'menu:main' }, null, { type: 'toggle:sell', name: '판매', action: 'toggle:sell' }
                ];
            } else if (this.currentMenuName === 'power') {
                header.textContent = '발전소';
                items = [
                    { type: 'coal-generator', name: '석탄 발전', cost: 200 }, { type: 'oil-generator', name: '석유 발전', cost: 200 },
                    { type: 'refinery', name: '정제소', cost: 300 }, { type: 'gold-mine', name: '금 채굴장', cost: 400 },
                    { type: 'storage', name: '창고', cost: 200 }, null, { type: 'menu:main', name: '뒤로', action: 'menu:main' }, null, { type: 'toggle:sell', name: '판매', action: 'toggle:sell' }
                ];
            } else if (this.currentMenuName === 'military') {
                header.textContent = '군사 시설';
                items = [
                    { type: 'armory', name: '병기창', cost: 600 }, { type: 'airport', name: '공항', cost: 500 },
                    { type: 'barracks', name: '병영', cost: 400 }, null, null, null, { type: 'menu:main', name: '뒤로', action: 'menu:main' }, null, { type: 'toggle:sell', name: '판매', action: 'toggle:sell' }
                ];
            } else {
                items = [
                    { type: 'turret-basic', name: '기본 포탑', cost: 50 }, { type: 'menu:network', name: '네트워크', action: 'menu:network' },
                    null, { type: 'menu:power', name: '에너지', action: 'menu:power' },
                    { type: 'wall', name: '벽', cost: 30 }, { type: 'menu:military', name: '군사', action: 'menu:military' },
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

            // Determine which icon key to use
            const iconKey = item.action || item.type;
            let iconHtml = this.getIconSVG(iconKey);
            
            // --- Mandatory Icon Check ---
            if (!iconHtml) {
                console.warn(`[GameEngine] Icon missing for key: ${iconKey}`);
                // Use a default placeholder icon if none found
                iconHtml = `<div class="btn-icon gray"><svg viewBox="0 0 40 40"><rect x="10" y="10" width="20" height="20" fill="#555" stroke="#fff" stroke-width="2"/><text x="20" y="26" text-anchor="middle" fill="#fff" font-size="12">?</text></svg></div>`;
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
                if (item.type === 'turret-basic') {
                    const stats = this.getTurretStats('turret-basic');
                    desc += `<div class="item-stats-box">
                        <div class="stat-row"><span>⚔️ 공격력:</span> <span class="highlight">${stats.damage}</span></div>
                        <div class="stat-row"><span>🔭 사거리:</span> <span class="highlight">${stats.range}</span></div>
                    </div>`;
                } else if (item.action === 'toggle:sell') {
                    desc += `<div class="item-stats-box text-red">건물을 철거하고 자원의 10%를 회수합니다.</div>`;
                } else if (item.action?.startsWith('unit:')) {
                    const cmd = item.action.split(':')[1];
                    const hotkeys = { move: 'M', stop: 'S', hold: 'H', patrol: 'P', attack: 'A' };
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
            if (this.currentMenuName === 'main' && this.selectedEntities.length > 0) {
                // 공병 건설 메뉴 내에서 '뒤로'를 누르면 유닛 명령으로 갈지, 메인 건설로 갈지 결정
                // 여기서는 일단 서브메뉴(네트워크 등)에서 메인 건설로 가는 용도로 유지
            }
            this.updateBuildMenu();
        } else if (action === 'toggle:sell') {
            if (this.isSellMode) this.cancelSellMode();
            else this.startSellMode();
        } else if (action.startsWith('skill:')) {
            const skill = action.split(':')[1];
            if (skill === 'tank' || skill === 'missile' || skill === 'cargo' || skill === 'rifleman' || skill === 'engineer') {
                const target = this.selectedEntities.length > 0 ? this.selectedEntities[0] : this.selectedEntity;
                if (target && target.requestUnit) {
                    const cost = item.cost || 0;
                    if (this.resources.gold >= cost) {
                        const unitKey = (skill === 'missile') ? 'missile-launcher' : skill;
                        if (target.requestUnit(unitKey)) {
                            this.resources.gold -= cost;
                            this.updateBuildMenu();
                        }
                    }
                }
            } else {
                this.startSkillMode(skill);
            }
        } else if (action.startsWith('unit:')) {
            const cmd = action.split(':')[1];
            if (cmd === 'stop' || cmd === 'hold') {
                this.executeUnitCommand(cmd);
            } else {
                this.unitCommandMode = cmd;
                this.updateCursor();
            }
        }
    }

    initInput() {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // 1. 활성화된 특수 모드(건설, 판매, 스킬, 명령 타겟팅) 취소
                if (this.isBuildMode || this.isSellMode || this.isSkillMode || this.unitCommandMode) {
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
            // 스타크래프트 단축키
            if (this.selectedEntities.length > 0) {
                const key = e.key.toLowerCase();
                if (key === 'm') { this.unitCommandMode = 'move'; this.updateCursor(); }
                else if (key === 's') this.executeUnitCommand('stop');
                else if (key === 'h') this.executeUnitCommand('hold');
                else if (key === 'p') { this.unitCommandMode = 'patrol'; this.updateCursor(); }
                else if (key === 'a') { this.unitCommandMode = 'attack'; this.updateCursor(); }
                else if (key === 'b') {
                    const hasEngineer = this.selectedEntities.some(ent => ent.type === 'engineer');
                    if (hasEngineer) {
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
                    this.executeUnitCommand(this.unitCommandMode, worldX, worldY);
                } else if (this.isSellMode) {
                    this.handleSell(worldX, worldY);
                } else if (this.isBuildMode) {
                    if (this.handleInput(worldX, worldY)) {
                        this.cancelBuildMode(); // Single install and cancel
                    }
                } else if (this.isSkillMode) {
                    this.handleInput(worldX, worldY);
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
                    // Check if any selected unit is an engineer and right-clicked a building
                    const engineer = this.selectedEntities.find(u => u.type === 'engineer');
                    if (engineer) {
                        const buildings = [
                            ...this.entities.turrets, ...this.entities.generators, ...this.entities.airports,
                            ...this.entities.refineries, ...this.entities.goldMines, ...this.entities.storage,
                            ...this.entities.armories, ...this.entities.barracks, ...this.entities.walls, this.entities.base
                        ];
                        const targetBuilding = buildings.find(b => {
                            const bounds = b.getSelectionBounds();
                            return worldX >= bounds.left && worldX <= bounds.right && worldY >= bounds.top && worldY <= bounds.bottom;
                        });
                        
                        if (targetBuilding && targetBuilding.hp < targetBuilding.maxHp) {
                            this.selectedEntities.forEach(u => {
                                if (u.type === 'engineer') {
                                    if (u.clearBuildQueue) u.clearBuildQueue(); // 수리 명령 시에도 건설 예약 취소
                                    u.command = 'repair';
                                    u.targetObject = targetBuilding;
                                } else {
                                    u.executeCommand('move', worldX, worldY);
                                }
                            });
                            return;
                        }
                    }

                    // SC Style Move command (ignores enemies)
                    this.executeUnitCommand('move', worldX, worldY);
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
        const modeClasses = ['build-mode-cursor', 'sell-mode-cursor', 'cmd-move-cursor', 'cmd-attack-cursor', 'cmd-patrol-cursor'];
        const scClasses = ['sc-n', 'sc-s', 'sc-e', 'sc-w', 'sc-ne', 'sc-nw', 'sc-se', 'sc-sw'];
        
        document.body.classList.remove(...modeClasses);

        // Only show mode cursors if NOT edge scrolling (scrolling has priority)
        const isScrolling = scClasses.some(cls => document.body.classList.contains(cls));
        if (isScrolling) return;

        if (this.isBuildMode) {
            document.body.classList.add('build-mode-cursor');
        } else if (this.isSellMode) {
            document.body.classList.add('sell-mode-cursor');
        } else if (this.unitCommandMode) {
            document.body.classList.add(`cmd-${this.unitCommandMode}-cursor`);
        }
    }

    executeUnitCommand(cmd, worldX = null, worldY = null) {
        if (this.selectedEntities.length === 0) return;

        this.selectedEntities.forEach(unit => {
            // 명령 변경 시 예약된 건설 취소
            if (unit.type === 'engineer' && unit.clearBuildQueue) {
                unit.clearBuildQueue();
            }
            
            unit.command = cmd;
            if (cmd === 'stop') {
                unit.destination = null;
            } else if (cmd === 'hold') {
                unit.destination = null;
            } else if (cmd === 'move' && worldX !== null) {
                unit.destination = { x: worldX, y: worldY };
            } else if (cmd === 'patrol' && worldX !== null) {
                unit.patrolStart = { x: unit.x, y: unit.y };
                unit.patrolEnd = { x: worldX, y: worldY };
                unit.destination = unit.patrolEnd;
            } else if (cmd === 'attack' && worldX !== null) {
                unit.destination = { x: worldX, y: worldY };
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
    }

    handleSingleSelection(worldX, worldY, isShiftKey) {
        // 선택 가능한 엔티티들만 수집 (전선, 파이프 제외)
        const potentialEntities = [
            ...this.entities.units,
            ...this.entities.airports,
            ...this.entities.storage,
            ...this.entities.armories,
            ...this.entities.barracks,
            ...this.entities.turrets,
            ...this.entities.generators,
            ...this.entities.walls,
            this.entities.base
        ];

        // Find the first entity that contains the click point
        const found = potentialEntities.find(ent => {
            if (!ent || (!ent.active && ent !== this.entities.base)) return false;
            const bounds = ent.getSelectionBounds();
            return worldX >= bounds.left && worldX <= bounds.right && 
                   worldY >= bounds.top && worldY <= bounds.bottom;
        });

        if (isShiftKey) {
            if (found) {
                const idx = this.selectedEntities.indexOf(found);
                if (idx !== -1) {
                    this.selectedEntities.splice(idx, 1);
                } else {
                    this.selectedEntities.push(found);
                }
            }
        } else {
            this.selectedEntities = found ? [found] : [];
        }

        this.isEngineerBuilding = false; // 선택 변경 시 공병 건설 모드 해제

        // 편의를 위해 첫 번째 선택된 객체를 selectedEntity로 참조 (기존 코드 호환성)
        this.selectedEntity = this.selectedEntities.length > 0 ? this.selectedEntities[0] : null;
        this.selectedAirport = (this.selectedEntity && this.selectedEntity.type === 'airport') ? this.selectedEntity : null;

        this.updateCursor();
        this.updateBuildMenu();
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

        const potentialEntities = [
            ...this.entities.units,
            ...this.entities.turrets,
            ...this.entities.generators,
            ...this.entities.walls,
            ...this.entities.airports,
            ...this.entities.refineries,
            ...this.entities.goldMines,
            ...this.entities.storage,
            ...this.entities.armories,
            ...this.entities.barracks,
            this.entities.base
        ];


        const selectedUnits = [];
        const selectedBuildings = [];

        potentialEntities.forEach(ent => {
            if (!ent || (!ent.active && ent !== this.entities.base)) return;
            
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
        this.pendingItemIndex = -1;
        this.updateCursor();
        this.updateBuildMenu();
        this.updateInventoryUI(); // Refresh inventory highlights
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

        const cost = 100; // Targeted skill cost (scout)
        if (this.resources.gold < cost) return;

        if (this.selectedSkill === 'scout') {
            // Find nearest airport to launch from
            let nearestAirport = this.entities.airports[0];
            
            if (nearestAirport) {
                this.entities.scoutPlanes.push(new ScoutPlane(nearestAirport.x, nearestAirport.y, worldX, worldY, this));
                this.resources.gold -= cost;
                this.cancelSkillMode(true); // Exit skill mode but keep airport selection
            }
        }
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

        const tileInfo = this.tileMap.getTileAt(worldX, worldY);
        const buildInfo = this.buildingRegistry[this.selectedBuildType];
        if (!tileInfo || !tileInfo.tile.visible || !buildInfo) return false;

        // 동일한 타일에 중복 예약 방지 (드래그 시 중요)
        if (this.lastPlacedGrid.x === tileInfo.x && this.lastPlacedGrid.y === tileInfo.y) return false;

        const isFromItem = this.pendingItemIndex !== -1;
        const cost = isFromItem ? 0 : buildInfo.cost;

        if (this.resources.gold < cost) return false;

        const [tw, th] = buildInfo.size;
        const gridX = tileInfo.x;
        const gridY = tileInfo.y;
        let canPlace = true;

        // 1. 위치 검증
        for (let dy = 0; dy > -th; dy--) {
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
                    // 예외: 자원 추출 건물이 자원 타일 위에 짓는 경우는 허용
                    const isResourceBuilding = !!buildInfo.onResource;
                    const isResourceTile = (tile.type === 'resource');
                    
                    if (!(isResourceBuilding && isResourceTile)) {
                        canPlace = false; break;
                    }
                }
            }
            if (!canPlace) break;
        }

        // 2. 자원 전용 체크
        if (buildInfo.onResource) {
            const pos = this.tileMap.gridToWorld(gridX, gridY);
            const resourceIndex = this.entities.resources.findIndex(r => 
                Math.abs(r.x - pos.x) < 5 && Math.abs(r.y - pos.y) < 5 && r.type === buildInfo.onResource
            );
            if (resourceIndex === -1) canPlace = false;
        }

        if (canPlace) {
            const engineer = this.selectedEntities.find(u => u.type === 'engineer');
            if (engineer) {
                // 타일 중앙 좌표 계산
                const centerPos = this.tileMap.gridToWorld(gridX, gridY);
                
                // 작업 큐에 정규화된 좌표 저장
                engineer.command = 'build';
                engineer.buildQueue.push({ 
                    type: this.selectedBuildType, 
                    x: centerPos.x, 
                    y: centerPos.y,
                    gridX: gridX,
                    gridY: gridY
                });
                
                // 자원 즉시 차감 및 타일 임시 점유
                this.resources.gold -= cost;
                for (let dy = 0; dy > -th; dy--) {
                    for (let dx = 0; dx < tw; dx++) {
                        const nx = gridX + dx, ny = gridY + dy;
                        if (this.tileMap.grid[ny] && this.tileMap.grid[ny][nx]) {
                            this.tileMap.grid[ny][nx].occupied = true;
                            this.tileMap.grid[ny][nx].type = 'building';
                        }
                    }
                }

                this.lastPlacedGrid = { x: gridX, y: gridY };

                if (isFromItem) {
                    this.inventory.splice(this.pendingItemIndex, 1);
                    this.pendingItemIndex = -1;
                    this.updateInventoryUI();
                    this.cancelBuildMode(); // 아이템 건설은 단발성으로 유지
                }
                
                // 일반 건설은 cancelBuildMode를 호출하지 않아 드래그 연속 건설 가능
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
            worldPos = {
                x: (gridX + stw / 2) * this.tileMap.tileSize,
                y: (gridY - (sth / 2 - 1)) * this.tileMap.tileSize
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

        let foundEntity = null;
        let listName = '';
        let foundIdx = -1;

        // All potential building lists
        const lists = ['turrets', 'generators', 'powerLines', 'walls', 'airports', 'refineries', 'goldMines', 'storage', 'armories', 'pipeLines', 'barracks'];
        
        for (const name of lists) {
            const idx = this.entities[name].findIndex(e => {
                if (!e) return false;
                const bounds = e.getSelectionBounds();
                return worldX >= bounds.left && worldX <= bounds.right && 
                       worldY >= bounds.top && worldY <= bounds.bottom;
            });

            if (idx !== -1) {
                foundEntity = this.entities[name][idx];
                listName = name;
                foundIdx = idx;
                break;
            }
        }

        if (foundEntity) {
            const buildInfo = this.buildingRegistry[foundEntity.type];
            const cost = buildInfo ? buildInfo.cost : 0;
            this.resources.gold += Math.floor(cost * 0.1);
            
            // Generic tile clearing logic: iterate all tiles and free those belonging to this entity
            const [tw, th] = buildInfo ? buildInfo.size : [1, 1];
            
            for (let ry = 0; ry < this.tileMap.rows; ry++) {
                for (let rx = 0; rx < this.tileMap.cols; rx++) {
                    const worldPos = this.tileMap.gridToWorld(rx, ry);
                    const bounds = foundEntity.getSelectionBounds();
                    // If tile center is within entity selection bounds, free it
                    if (worldPos.x >= bounds.left && worldPos.x <= bounds.right && 
                        worldPos.y >= bounds.top && worldPos.y <= bounds.bottom) {
                        this.tileMap.grid[ry][rx].occupied = false;
                    }
                }
            }

            // Remove from list
            this.entities[listName].splice(foundIdx, 1);
        }
    }

    rollRandomCard() {
        const cost = 100;
        if (this.resources.gold >= cost) {
            this.resources.gold -= cost;
            const items = this.upgradeManager.getRandomItems(1);
            if (items.length > 0) {
                const item = items[0];
                this.addToInventory(item);
            }
        }
    }

    addToInventory(item) {
        if (this.inventory.length < this.maxInventorySize) {
            this.inventory.push(item);
        } else {
            // If full, remove oldest and add new (or just don't add, but usually shifting is better for "last 6 collection")
            this.inventory.shift();
            this.inventory.push(item);
        }
        this.updateInventoryUI();
    }

    updateInventoryUI() {
        const slots = document.querySelectorAll('.inventory-slot');
        slots.forEach((slot, index) => {
            slot.innerHTML = '';
            slot.classList.remove('filled');
            
            // Clean up old listeners by cloning
            const newSlot = slot.cloneNode(true);
            slot.parentNode.replaceChild(newSlot, slot);
            
            if (this.inventory[index]) {
                newSlot.classList.add('filled');
                if (this.pendingItemIndex === index) {
                    newSlot.classList.add('active');
                }
                const itemIcon = document.createElement('div');
                itemIcon.className = 'inventory-item-icon';
                itemIcon.textContent = this.inventory[index].icon;
                newSlot.appendChild(itemIcon);

                newSlot.addEventListener('mouseenter', (e) => {
                    this.isHoveringUI = true;
                    let itemDesc = this.inventory[index].desc;
                    
                    // Add detailed stats if it's a build item (Turrets)
                    if (this.inventory[index].type === 'build-item' && this.inventory[index].buildType) {
                        const stats = this.getTurretStats(this.inventory[index].buildType);
                        const fireRateSec = (1000 / stats.fireRate).toFixed(1);
                        
                        itemDesc += `<div class="item-stats-box">
                            <div class="stat-row"><span>⚔️ 공격력:</span> <span class="highlight">${stats.damage}</span></div>
                            <div class="stat-row"><span>⚡ 연사 속도:</span> <span class="highlight">${fireRateSec}/s</span></div>
                            <div class="stat-row"><span>🔭 사거리:</span> <span class="highlight">${stats.range}</span></div>
                            <div class="stat-row"><span>❤️ 내구도:</span> <span class="highlight">${stats.maxHp}</span></div>
                        </div>`;
                        itemDesc += `<br><span class="highlight text-green">사용 시 즉시 설치 가능</span>`;
                    }
                    
                    this.showUITooltip(this.inventory[index].icon + ' ' + this.inventory[index].name, itemDesc, e.clientX, e.clientY);
                });
                newSlot.addEventListener('mousemove', (e) => {
                    this.moveUITooltip(e.clientX, e.clientY);
                });
                newSlot.addEventListener('mouseleave', () => {
                    this.isHoveringUI = false;
                    this.hideUITooltip();
                });

                newSlot.addEventListener('click', () => {
                    this.useItem(index);
                });
            }
        });
    }

    useItem(index) {
        if (this.inventory[index]) {
            const item = this.inventory[index];
            if (item.type === 'build-item') {
                this.pendingItemIndex = index;
                item.apply();
            } else {
                item.apply();
                this.inventory.splice(index, 1);
                this.updateInventoryUI();
                this.hideUITooltip();
            }
        }
    }

    startItemBuildMode(type) {
        this.startBuildMode(type);
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
        // 이 생산업체(광산/정제소)가 기지에 직접 연결되어 있는지 확인
        if (producer.isConnectedToBase) {
            this.resources[type] += amount;
            return true;
        }

        // 기지에 직접 연결되지 않았다면, 연결된 창고가 있는지 확인
        if (producer.connectedTarget && producer.connectedTarget.type === 'storage') {
            const storage = producer.connectedTarget;
            const totalStored = storage.storedResources.gold + storage.storedResources.oil;
            
            if (totalStored < storage.maxCapacity) {
                storage.storedResources[type] += amount;
                
                // 보관량 초과 시 초과분 제거
                const newTotal = storage.storedResources.gold + storage.storedResources.oil;
                if (newTotal > storage.maxCapacity) {
                    const overflow = newTotal - storage.maxCapacity;
                    storage.storedResources[type] -= overflow;
                }
                return true;
            }
        }
        return false;
    }

    update(deltaTime) {
        if (this.gameState !== 'playing') return;

        this.updateEdgeScroll();
        this.updatePower();
        this.updateOilNetwork();
        this.updateVisibility();

        const checkDestruction = (list) => {
            return list.filter(obj => {
                if (obj.hp <= 0) {
                    const grid = this.tileMap.worldToGrid(obj.x, obj.y);
                    if (this.tileMap.grid[grid.y] && this.tileMap.grid[grid.y][grid.x]) {
                        this.tileMap.grid[grid.y][grid.x].occupied = false;
                    }
                    return false;
                }
                return true;
            });
        };

        this.entities.turrets = checkDestruction(this.entities.turrets);
        this.entities.generators = this.entities.generators.filter(obj => {
            obj.update(deltaTime);
            if (obj.fuel <= 0 || obj.hp <= 0) {
                const grid = this.tileMap.worldToGrid(obj.x, obj.y);
                if (this.tileMap.grid[grid.y] && this.tileMap.grid[grid.y][grid.x]) {
                    this.tileMap.grid[grid.y][grid.x].occupied = false;
                }
                return false;
            }
            return true;
        });
        this.entities.powerLines = checkDestruction(this.entities.powerLines);
        this.entities.walls = checkDestruction(this.entities.walls);
        this.entities.airports = checkDestruction(this.entities.airports);
        this.entities.pipeLines = checkDestruction(this.entities.pipeLines);
        this.entities.refineries = this.entities.refineries.filter(obj => {
            obj.update(deltaTime, this);
            if (obj.fuel <= 0 || obj.hp <= 0) {
                const grid = this.tileMap.worldToGrid(obj.x, obj.y);
                if (this.tileMap.grid[grid.y] && this.tileMap.grid[grid.y][grid.x]) {
                    this.tileMap.grid[grid.y][grid.x].occupied = false;
                }
                return false;
            }
            return true;
        });
                this.entities.goldMines = this.entities.goldMines.filter(obj => {
                    obj.update(deltaTime, this);
                    if (obj.fuel <= 0 || obj.hp <= 0) {
                        const grid = this.tileMap.worldToGrid(obj.x, obj.y);
                        if (this.tileMap.grid[grid.y] && this.tileMap.grid[grid.y][grid.x]) {
                            this.tileMap.grid[grid.y][grid.x].occupied = false;
                        }
                        return false;
                    }
                    return true;
                });
                this.entities.storage.forEach(s => s.update(deltaTime, this));
                this.entities.storage = checkDestruction(this.entities.storage);
                this.entities.base.update(deltaTime, this); // 총사령부 업데이트 추가
                this.entities.armories.forEach(a => a.update(deltaTime, this));
                this.entities.armories = checkDestruction(this.entities.armories);
                this.entities.barracks.forEach(b => b.update(deltaTime, this));
                this.entities.barracks = checkDestruction(this.entities.barracks);
                this.entities.units.forEach(u => u.update(deltaTime));
                this.entities.units = this.entities.units.filter(u => u.alive);
                this.entities.scoutPlanes.forEach(p => p.update(deltaTime));
        this.entities.scoutPlanes = this.entities.scoutPlanes.filter(p => p.alive);

        this.entities.cargoPlanes.forEach(p => p.update(deltaTime));
        this.entities.cargoPlanes = this.entities.cargoPlanes.filter(p => p.alive);

        this.entities.enemies = this.entities.enemies.filter(enemy => {
            if (!enemy.active && enemy.hp <= 0) {
                this.resources.gold += 10;
            }
            return enemy.active;
        });

        // 모든 충돌 가능 장애물 동적 수집
        const buildings = [];
        const excludedForEnemies = ['projectiles', 'scoutPlanes', 'cargoPlanes', 'enemies'];
        for (const key in this.entities) {
            if (excludedForEnemies.includes(key)) continue;
            const entry = this.entities[key];
            if (Array.isArray(entry)) buildings.push(...entry);
            else if (entry && entry !== null) buildings.push(entry);
        }

        this.entities.enemies.forEach(enemy => enemy.update(deltaTime, this.entities.base, buildings));
        this.entities.turrets.forEach(turret => turret.update(deltaTime, this.entities.enemies, this.entities.projectiles));
        this.entities.projectiles = this.entities.projectiles.filter(p => p.active);
        this.entities.projectiles.forEach(proj => proj.update(deltaTime));

        if (this.entities.base.hp <= 0) {
            this.gameState = 'gameOver';
            document.getElementById('game-over-modal').classList.remove('hidden');
        }

        document.getElementById('resource-gold').textContent = Math.floor(this.resources.gold);
        document.getElementById('resource-oil').textContent = Math.floor(this.resources.oil);

        const rollBtn = document.getElementById('roll-card-btn');
        if (rollBtn) {
            rollBtn.disabled = (this.resources.gold < 100);
        }
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        this.ctx.translate(this.camera.x, this.camera.y);
        this.ctx.scale(this.camera.zoom, this.camera.zoom);

        // 1. Draw visible grid background
        this.tileMap.drawGrid();

        // 2. Draw all entities
        const buildingsForPower = [
            ...this.entities.turrets,
            ...this.entities.generators,
            ...this.entities.powerLines,
            ...this.entities.walls,
            ...this.entities.airports,
            ...this.entities.refineries,
            ...this.entities.goldMines,
            ...this.entities.storage,
            ...this.entities.armories,
            ...this.entities.barracks,
            ...this.entities.pipeLines,
            this.entities.base
        ];

        if (this.entities.base) this.entities.base.draw(this.ctx);
        this.entities.resources.forEach(r => r.draw(this.ctx));
        this.entities.powerLines.forEach(pl => pl.draw(this.ctx, buildingsForPower, this));
        this.entities.pipeLines.forEach(pl => pl.draw(this.ctx, buildingsForPower, this));
        this.entities.walls.forEach(w => w.draw(this.ctx));
        this.entities.airports.forEach(a => a.draw(this.ctx));
        this.entities.refineries.forEach(ref => ref.draw(this.ctx));
        this.entities.goldMines.forEach(gm => gm.draw(this.ctx));
        this.entities.storage.forEach(s => s.draw(this.ctx));
        this.entities.armories.forEach(a => a.draw(this.ctx));
        this.entities.barracks.forEach(b => b.draw(this.ctx));
        this.entities.units.forEach(u => u.draw(this.ctx));
        this.entities.generators.forEach(g => g.draw(this.ctx));
        this.entities.turrets.forEach(t => t.draw(this.ctx, this.isBuildMode));
        
        // 적 유닛은 현재 시야(inSight) 내에 있을 때만 렌더링
        this.entities.enemies.forEach(e => {
            const grid = this.tileMap.worldToGrid(e.x, e.y);
            if (this.tileMap.grid[grid.y] && this.tileMap.grid[grid.y][grid.x] && this.tileMap.grid[grid.y][grid.x].inSight) {
                e.draw(this.ctx);
            }
        });

        this.entities.projectiles.forEach(p => p.draw(this.ctx));
        this.entities.scoutPlanes.forEach(p => p.draw(this.ctx));
        this.entities.cargoPlanes.forEach(p => p.draw(this.ctx));

        const mouseWorldX = (this.camera.mouseX - this.camera.x) / this.camera.zoom;
        const mouseWorldY = (this.camera.mouseY - this.camera.y) / this.camera.zoom;

        // 3. Draw fog on top to hide everything in dark areas
        this.tileMap.drawFog();

        // 4. Draw Active Previews and Highlights on TOP of fog
        
        // 4.1 Selected Object Highlight
        if (this.selectedEntities.length > 0) {
            this.ctx.save();
            this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)'; // 초록색 테두리
            this.ctx.lineWidth = 1;
            this.selectedEntities.forEach(ent => {
                const bounds = ent.getSelectionBounds();
                const w = bounds.right - bounds.left;
                const h = bounds.bottom - bounds.top;
                this.ctx.strokeRect(bounds.left, bounds.top, w, h);

                // Draw attack range for each selected unit
                if (ent.attackRange) {
                    this.ctx.save();
                    this.ctx.beginPath();
                    this.ctx.arc(ent.x, ent.y, ent.attackRange, 0, Math.PI * 2);
                    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'; // 연한 흰색 원
                    this.ctx.setLineDash([5, 5]);
                    this.ctx.stroke();
                    this.ctx.restore();
                }

                // Draw movement line if destination exists
                if (ent.destination) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(ent.x, ent.y);
                    this.ctx.lineTo(ent.destination.x, ent.destination.y);
                    this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
                    this.ctx.setLineDash([5, 5]);
                    this.ctx.stroke();
                    this.ctx.setLineDash([]);

                    // Draw destination X marker
                    this.ctx.beginPath();
                    const markerSize = 5;
                    this.ctx.moveTo(ent.destination.x - markerSize, ent.destination.y - markerSize);
                    this.ctx.lineTo(ent.destination.x + markerSize, ent.destination.y + markerSize);
                    this.ctx.moveTo(ent.destination.x + markerSize, ent.destination.y - markerSize);
                    this.ctx.lineTo(ent.destination.x - markerSize, ent.destination.y + markerSize);
                    this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
                    this.ctx.stroke();
                }
            });
            this.ctx.restore();
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
            const tileInfo = this.tileMap.getTileAt(mouseWorldX, mouseWorldY);
            const buildInfo = this.buildingRegistry[this.selectedBuildType];
            
            if (tileInfo && buildInfo) {
                this.ctx.save();
                this.ctx.globalAlpha = 0.5;

                const [tw, th] = buildInfo.size;
                let worldPos;

                if (tw > 1 || th > 1) {
                    // Generic multi-tile position calculation
                    worldPos = {
                        x: (tileInfo.x + tw / 2) * this.tileMap.tileSize,
                        y: (tileInfo.y - (th / 2 - 1)) * this.tileMap.tileSize
                    };
                } else {
                    worldPos = this.tileMap.gridToWorld(tileInfo.x, tileInfo.y);
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
                        if (['PowerLine', 'PipeLine'].includes(buildInfo.className)) {
                            ghost.draw(this.ctx, [...buildingsForPower], this);
                        } else {
                            ghost.draw(this.ctx);
                        }
                    }
                }
                this.ctx.restore();
            }
        }

        // 4.3 Scout Range Preview
        if (this.isSkillMode && this.selectedSkill === 'scout') {
            this.ctx.save();
            this.ctx.beginPath();
            const radius = 20 * this.tileMap.tileSize;
            this.ctx.arc(mouseWorldX, mouseWorldY, radius, 0, Math.PI * 2);
            this.ctx.strokeStyle = 'rgba(0, 255, 204, 0.8)'; // More intense color
            this.ctx.setLineDash([10, 5]);
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
            this.ctx.fillStyle = 'rgba(0, 255, 204, 0.2)';
            this.ctx.fill();
            this.ctx.restore();
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
        this.renderTooltip();
        
        // 5. 건설 예약 청사진 (Ghost Previews for Build Queue)
        this.renderBuildQueue();

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

    renderBuildQueue() {
        this.ctx.save();
        this.ctx.translate(this.camera.x, this.camera.y);
        this.ctx.scale(this.camera.zoom, this.camera.zoom);

        this.entities.units.forEach(unit => {
            if (unit.type === 'engineer' && unit.buildQueue.length > 0) {
                let lastX = unit.x;
                let lastY = unit.y;

                unit.buildQueue.forEach((task, index) => {
                    const buildInfo = this.buildingRegistry[task.type];
                    if (!buildInfo) return;

                    // 1. 청사진 건물 그리기
                    this.ctx.save();
                    this.ctx.globalAlpha = 0.3; // 반투명
                    
                    const [tw, th] = buildInfo.size;
                    let worldPos;
                    const tileInfo = this.tileMap.getTileAt(task.x, task.y);
                    if (tileInfo) {
                        if (tw > 1 || th > 1) {
                            worldPos = {
                                x: (tileInfo.x + tw / 2) * this.tileMap.tileSize,
                                y: (tileInfo.y - (th / 2 - 1)) * this.tileMap.tileSize
                            };
                        } else {
                            worldPos = this.tileMap.gridToWorld(tileInfo.x, tileInfo.y);
                        }

                        const ClassRef = this.entityClasses[buildInfo.className];
                        if (ClassRef) {
                            let ghost;
                            if (buildInfo.className === 'Turret') {
                                ghost = new ClassRef(worldPos.x, worldPos.y, task.type);
                            } else {
                                ghost = new ClassRef(worldPos.x, worldPos.y, this);
                            }
                            if (ghost.draw) ghost.draw(this.ctx);
                        }
                    }
                    this.ctx.restore();

                    // 2. 예약 순서 연결선
                    this.ctx.beginPath();
                    this.ctx.moveTo(lastX, lastY);
                    this.ctx.lineTo(task.x, task.y);
                    this.ctx.strokeStyle = 'rgba(0, 255, 204, 0.4)';
                    this.ctx.setLineDash([5, 5]);
                    this.ctx.lineWidth = 2;
                    this.ctx.stroke();

                    // 3. 순서 번호 표시
                    this.ctx.fillStyle = '#00ffcc';
                    this.ctx.font = 'bold 12px Arial';
                    this.ctx.textAlign = 'center';
                    this.ctx.fillText(index + 1, task.x, task.y - 20);

                    lastX = task.x;
                    lastY = task.y;
                });
            }
        });

        this.ctx.restore();
    }

    getTurretStats(type) {
        // 임시 포탑 인스턴스를 만들어 기본 스탯을 가져옴
        const { Turret } = this.entityClasses;
        const temp = new Turret(0, 0, type);
        return {
            damage: temp.damage,
            fireRate: temp.fireRate,
            range: temp.range,
            maxHp: temp.maxHp
        };
    }

    renderTooltip() {
        if (this.isHoveringUI) return;

        const worldX = (this.camera.mouseX - this.camera.x) / this.camera.zoom;
        const worldY = (this.camera.mouseY - this.camera.y) / this.camera.zoom;
        
        let title = '';
        let desc = '';

        // 1. Check Resources
        const hoveredResource = this.entities.resources.find(r => Math.hypot(r.x - worldX, r.y - worldY) < 15);
        if (hoveredResource) {
            title = hoveredResource.name;
            desc = '발전소를 건설하여 전력을 생산하세요.';
        }

        // 2. Check Generators
        const hoveredGenerator = this.entities.generators.find(g => Math.hypot(g.x - worldX, g.y - worldY) < 15);
        if (hoveredGenerator) {
            title = hoveredGenerator.type === 'coal-generator' ? '석탄 발전소' : '석유 발전소';
            desc = `<div class="stat-row"><span>⛽ 남은 자원:</span> <span class="highlight">${Math.ceil(hoveredGenerator.fuel)}</span></div>
                    <div class="stat-row"><span>❤️ 내구도:</span> <span class="highlight">${Math.ceil(hoveredGenerator.hp)}/${hoveredGenerator.maxHp}</span></div>`;
        }

        // 3. Check Turrets
        const hoveredTurret = this.entities.turrets.find(t => Math.hypot(t.x - worldX, t.y - worldY) < 15);
        if (hoveredTurret) {
            const typeNames = { 'turret-basic': '기본 포탑', 'turret-fast': 'Fast 포탑', 'turret-sniper': 'Sniper 포탑', 'turret-tesla': 'Tesla 포탑', 'turret-flamethrower': 'Flame 포탑' };
            title = typeNames[hoveredTurret.type] || '포탑';
            const fireRateSec = (1000 / hoveredTurret.fireRate).toFixed(1);
            desc = `<div class="stat-row"><span>⚔️ 공격력:</span> <span class="highlight">${hoveredTurret.damage}</span></div>
                    <div class="stat-row"><span>⚡ 연사 속도:</span> <span class="highlight">${fireRateSec}/s</span></div>
                    <div class="stat-row"><span>🔭 사거리:</span> <span class="highlight">${hoveredTurret.range}</span></div>
                    <div class="stat-row"><span>❤️ 내구도:</span> <span class="highlight">${Math.ceil(hoveredTurret.hp)}/${hoveredTurret.maxHp}</span></div>
                    <div class="stat-row"><span>🔌 전력 상태:</span> <span class="${hoveredTurret.isPowered ? 'text-green' : 'text-red'}">${hoveredTurret.isPowered ? '공급 중' : '중단됨'}</span></div>`;
        }

        // 5. Check Walls
        const hoveredWall = this.entities.walls.find(w => Math.hypot(w.x - worldX, w.y - worldY) < 15);
        if (hoveredWall) {
            title = '벽';
            desc = `<div class="stat-row"><span>🧱 기능:</span> <span>적의 진로 방해</span></div>
                    <div class="stat-row"><span>❤️ 내구도:</span> <span class="highlight">${Math.ceil(hoveredWall.hp)}/${hoveredWall.maxHp}</span></div>`;
        }

        // 6. Check Power Lines
        const hoveredLine = this.entities.powerLines.find(p => Math.hypot(p.x - worldX, p.y - worldY) < 10);
        if (hoveredLine) {
            title = '전선';
            desc = `<div class="stat-row"><span>🔌 기능:</span> <span>에너지 전달 (직선 제한)</span></div>
                    <div class="stat-row"><span>❤️ 내구도:</span> <span class="highlight">${Math.ceil(hoveredLine.hp)}/${hoveredLine.maxHp}</span></div>`;
        }

        // 7. Check Airport
        const hoveredAirport = this.entities.airports.find(a => Math.abs(a.x - worldX) < 40 && Math.abs(a.y - worldY) < 60);
        if (hoveredAirport) {
            title = '공항';
            desc = `<div class="stat-row"><span>✈️ 기능:</span> <span>특수 스킬 사용</span></div>
                    <div class="stat-row"><span>❤️ 내구도:</span> <span class="highlight">${Math.ceil(hoveredAirport.hp)}/${hoveredAirport.maxHp}</span></div>
                    <div class="stat-row"><span>💡 선택:</span> <span>좌클릭 시 스킬 메뉴</span></div>`;
        }

        // 8. Check Gold Mine
        const hoveredGoldMine = this.entities.goldMines.find(gm => Math.hypot(gm.x - worldX, gm.y - worldY) < 15);
        if (hoveredGoldMine) {
            title = '금 채굴장';
            desc = `<div class="stat-row"><span>⛽ 남은 자원:</span> <span class="highlight">${Math.ceil(hoveredGoldMine.fuel)}</span></div>
                    <div class="stat-row"><span>❤️ 내구도:</span> <span class="highlight">${Math.ceil(hoveredGoldMine.hp)}/${hoveredGoldMine.maxHp}</span></div>
                    <div class="stat-row"><span>🔌 연결 상태:</span> <span class="${hoveredGoldMine.isConnected ? 'text-green' : 'text-red'}">${hoveredGoldMine.isConnected ? '기지 연결됨' : '연결 안됨'}</span></div>`;
        }

        // 9. Check Storage
        const hoveredStorage = this.entities.storage.find(s => Math.hypot(s.x - worldX, s.y - worldY) < 20);
        if (hoveredStorage) {
            title = '창고';
            const totalStored = Math.floor(hoveredStorage.storedResources.gold + hoveredStorage.storedResources.oil);
            let productionInfo = '';
            if (hoveredStorage.spawnQueue > 0) {
                const progress = Math.floor((hoveredStorage.spawnTimer / hoveredStorage.spawnTimeRequired) * 100);
                productionInfo = `<div class="stat-row"><span>🏗️ 생산 중:</span> <span class="highlight">${progress}% (${hoveredStorage.spawnQueue}대 대기)</span></div>`;
            }

            desc = `<div class="stat-row"><span>📦 보관량:</span> <span class="highlight">${totalStored}/${hoveredStorage.maxCapacity}</span></div>
                    <div class="stat-row"><span>💰 금:</span> <span class="highlight">${Math.floor(hoveredStorage.storedResources.gold)}</span></div>
                    <div class="stat-row"><span>🛢️ 석유:</span> <span class="highlight">${Math.floor(hoveredStorage.storedResources.oil)}</span></div>
                    <div class="stat-row"><span>🔌 기지 연결:</span> <span class="${hoveredStorage.isConnectedToBase ? 'text-green' : 'text-red'}">${hoveredStorage.isConnectedToBase ? '전송 중' : '연결 안됨'}</span></div>
                    <div class="stat-row"><span>✈️ 수송기:</span> <span class="highlight">${hoveredStorage.cargoPlanes.length}대 운용 중</span></div>
                    ${productionInfo}
                    <div class="stat-row"><span>💡 선택:</span> <span>좌클릭 시 스킬 메뉴</span></div>`;
        }

        // 10. Check Armory
        const hoveredArmory = this.entities.armories.find(a => Math.abs(a.x - worldX) < 40 && Math.abs(a.y - worldY) < 40);
        if (hoveredArmory) {
            title = '병기창';
            let productionInfo = '';
            if (hoveredArmory.spawnQueue.length > 0) {
                const current = hoveredArmory.spawnQueue[0];
                const progress = Math.floor((current.timer / hoveredArmory.spawnTime) * 100);
                const typeName = current.type === 'tank' ? '전차' : '미사일';
                productionInfo = `<div class="stat-row"><span>🏗️ 생산 중:</span> <span class="highlight">${typeName} ${progress}% (대기 ${hoveredArmory.spawnQueue.length})</span></div>`;
            }

            desc = `<div class="stat-row"><span>🛡️ 수비 유닛:</span> <span class="highlight">${hoveredArmory.units.length}/${hoveredArmory.maxUnits}대</span></div>
                    <div class="stat-row"><span>❤️ 내구도:</span> <span class="highlight">${Math.ceil(hoveredArmory.hp)}/${hoveredArmory.maxHp}</span></div>
                    <div class="stat-row"><span>🔌 전력 상태:</span> <span class="${hoveredArmory.isPowered ? 'text-green' : 'text-red'}">${hoveredArmory.isPowered ? '공급 중' : '중단됨'}</span></div>
                    ${productionInfo}
                    <div class="stat-row"><span>💡 선택:</span> <span>좌클릭 시 스킬 메뉴</span></div>`;
        }

        // 11. Check Units
        const hoveredUnit = this.entities.units.find(u => Math.hypot(u.x - worldX, u.y - worldY) < 15);
        const activeUnit = hoveredUnit || (this.selectedEntity && this.entities.units.includes(this.selectedEntity) ? this.selectedEntity : null);
        
        if (activeUnit) {
            title = activeUnit.name || '유닛';
            desc = `<div class="stat-row"><span>⚔️ 공격력:</span> <span class="highlight">${activeUnit.damage}</span></div>
                    <div class="stat-row"><span>🔭 공격 사거리:</span> <span class="highlight">${activeUnit.attackRange}</span></div>
                    <div class="stat-row"><span>👁️ 시야 범위:</span> <span class="highlight">${activeUnit.visionRange}</span></div>
                    <div class="stat-row"><span>❤️ 체력:</span> <span class="highlight">${Math.ceil(activeUnit.hp)}/${activeUnit.maxHp}</span></div>
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
        
        // 1. 전체 배경을 아주 어두운 색(안개)으로 채움
        mCtx.fillStyle = '#0a0a0a';
        mCtx.fillRect(0, 0, mapWorldWidth, mapWorldHeight);

        // 2. 밝혀진 타일의 바닥면을 먼저 그림
        mCtx.fillStyle = '#1a1a1a';
        for (let y = 0; y < this.tileMap.rows; y++) {
            for (let x = 0; x < this.tileMap.cols; x++) {
                if (this.tileMap.grid[y][x].visible) {
                    mCtx.fillRect(x * 40, y * 40, 40, 40);
                }
            }
        }

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

        mCtx.fillStyle = '#39ff14'; 
        this.entities.turrets.forEach(t => {
            if (isVisible(t.x, t.y)) mCtx.fillRect(t.x - 20, t.y - 20, 40, 40);
        });

        mCtx.fillStyle = '#ffff00'; 
        this.entities.generators.forEach(g => {
            if (isVisible(g.x, g.y)) mCtx.fillRect(g.x - 20, g.y - 20, 40, 40);
        });

        mCtx.fillStyle = '#9370DB'; 
        this.entities.pipeLines.forEach(pl => {
            if (isVisible(pl.x, pl.y)) mCtx.fillRect(pl.x - 10, pl.y - 10, 20, 20);
        });

        mCtx.fillStyle = '#666'; 
        this.entities.walls.forEach(w => {
            if (isVisible(w.x, w.y)) mCtx.fillRect(w.x - 15, w.y - 15, 30, 30);
        });

        mCtx.fillStyle = '#aaa'; 
        this.entities.airports.forEach(a => {
            if (isVisible(a.x, a.y)) mCtx.fillRect(a.x - 20, a.y - 20, 40, 40);
        });

        mCtx.fillStyle = '#32cd32'; 
        this.entities.refineries.forEach(ref => {
            if (isVisible(ref.x, ref.y)) mCtx.fillRect(ref.x - 15, ref.y - 15, 30, 30);
        });

        mCtx.fillStyle = '#FFD700'; 
        this.entities.goldMines.forEach(gm => {
            if (isVisible(gm.x, gm.y)) mCtx.fillRect(gm.x - 15, gm.y - 15, 30, 30);
        });

        mCtx.fillStyle = '#00d2ff'; 
        this.entities.storage.forEach(s => {
            if (isVisible(s.x, s.y)) mCtx.fillRect(s.x - 20, s.y - 20, 40, 40);
        });

        mCtx.fillStyle = '#34495e'; 
        this.entities.armories.forEach(a => {
            if (isVisible(a.x, a.y)) mCtx.fillRect(a.x - 20, a.y - 20, 40, 40);
        });

        this.entities.units.forEach(u => {
            if (isVisible(u.x, u.y)) {
                mCtx.fillStyle = u.type === 'tank' ? '#39ff14' : '#ff3131';
                mCtx.fillRect(u.x - 5, u.y - 5, 10, 10);
            }
        });

        this.entities.resources.forEach(r => { 
            if (isVisible(r.x, r.y)) {
                mCtx.fillStyle = r.color; 
                mCtx.fillRect(r.x - 15, r.y - 15, 30, 30); 
            }
        });

        mCtx.fillStyle = '#ff3131'; 
        this.entities.enemies.forEach(e => { 
            if (isVisible(e.x, e.y)) {
                mCtx.beginPath(); mCtx.arc(e.x, e.y, 15, 0, Math.PI * 2); mCtx.fill(); 
            }
        });

        // 4. 격자선 (밝혀진 곳만 희미하게)
        mCtx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        mCtx.lineWidth = 1;
        for (let y = 0; y < this.tileMap.rows; y+=5) {
            for (let x = 0; x < this.tileMap.cols; x+=5) {
                if (this.tileMap.grid[y][x].visible) {
                    mCtx.strokeRect(x * 40, y * 40, 200, 200);
                }
            }
        }

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

    updateOilNetwork() {
        // 1. 초기화
        this.entities.pipeLines.forEach(p => {
            p.isConnected = false;
            p.canReachHub = false; // 허브(기지/창고)에 닿을 수 있는지 여부
        });
        this.entities.refineries.forEach(r => { 
            r.isConnectedToBase = false; 
            r.connectedTarget = null; 
        });
        this.entities.goldMines.forEach(gm => { 
            gm.isConnectedToBase = false; 
            gm.connectedTarget = null; 
        });
        this.entities.storage.forEach(s => s.isConnectedToBase = false);

        // 2. 그리드 매핑
        const oilGrid = {};
        this.entities.pipeLines.forEach(p => {
            const gp = this.tileMap.worldToGrid(p.x, p.y);
            oilGrid[`${gp.x},${gp.y}`] = p;
        });
        
        const baseGp = this.tileMap.worldToGrid(this.entities.base.x, this.entities.base.y);
        const hubGps = [baseGp];
        this.entities.storage.forEach(s => hubGps.push(this.tileMap.worldToGrid(s.x, s.y)));

        // 3. Step 1: 허브로부터 역추적하여 도달 가능한 모든 파이프/생산업체 찾기 (canReachHub)
        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        const findReachablePipes = (startHubGps, hubObj) => {
            const queue = [...startHubGps];
            const visited = new Set(startHubGps.map(gp => `${gp.x},${gp.y}`));
            while (queue.length > 0) {
                const curr = queue.shift();
                for (const dir of dirs) {
                    const nx = curr.x + dir[0], ny = curr.y + dir[1], key = `${nx},${ny}`;
                    if (visited.has(key)) continue;

                    const pipe = oilGrid[key];
                    if (pipe) {
                        pipe.canReachHub = true;
                        visited.add(key);
                        queue.push({x: nx, y: ny});
                        continue;
                    }
                    
                    // 생산업체(정제소, 금 채굴장) 확인
                    const producer = [...this.entities.refineries, ...this.entities.goldMines].find(p => {
                        const pgp = this.tileMap.worldToGrid(p.x, p.y);
                        return pgp.x === nx && pgp.y === ny;
                    });

                    if (producer) {
                        if (hubObj.maxHp === 99999999) producer.isConnectedToBase = true;
                        else producer.connectedTarget = hubObj;
                        visited.add(key);
                        continue;
                    }

                    // 창고 확인 (기지에서 시작했을 때만)
                    if (hubObj.maxHp === 99999999) {
                        const storage = this.entities.storage.find(s => {
                            const startX = Math.round(s.x / 40 - 1);
                            const startY = Math.round(s.y / 40);
                            // 2x2 타일 중 하나라도 닿으면 연결
                            return nx >= startX && nx <= startX + 1 && ny >= startY - 1 && ny <= startY;
                        });
                        if (storage) {
                            storage.isConnectedToBase = true;
                            visited.add(key);
                            // 창고의 모든 타일을 큐에 추가하여 탐색 확장
                            const startX = Math.round(storage.x / 40 - 1);
                            const startY = Math.round(storage.y / 40);
                            for(let gy = startY - 1; gy <= startY; gy++) {
                                for(let gx = startX; gx <= startX + 1; gx++) {
                                    const skey = `${gx},${gy}`;
                                    if(!visited.has(skey)) {
                                        visited.add(skey);
                                        queue.push({x: gx, y: gy});
                                    }
                                }
                            }
                        }
                    }
                }
            }
        };

        // 기지 탐색 (기지는 1x1이므로 단일 좌표 전달)
        findReachablePipes([baseGp], this.entities.base);

        // 각 창고로부터 탐색 시작 (창고는 2x2이므로 모든 타일 좌표 전달)
        this.entities.storage.forEach(s => {
            const startX = Math.round(s.x / 40 - 1);
            const startY = Math.round(s.y / 40);
            const storageGps = [];
            for(let gy = startY - 1; gy <= startY; gy++) {
                for(let gx = startX; gx <= startX + 1; gx++) {
                    storageGps.push({x: gx, y: gy});
                }
            }
            findReachablePipes(storageGps, s);
        });

        // 4. Step 2: 작동 중인 생산업체로부터 허브로 가는 경로의 파이프 활성화 (isConnected)
        const activeProducers = [
            ...this.entities.refineries.filter(r => r.fuel > 0 && (r.isConnectedToBase || r.connectedTarget)),
            ...this.entities.goldMines.filter(gm => gm.fuel > 0 && (gm.isConnectedToBase || gm.connectedTarget))
        ];

        activeProducers.forEach(prod => {
            const startGp = this.tileMap.worldToGrid(prod.x, prod.y);
            const queue = [startGp];
            const visited = new Set([`${startGp.x},${startGp.y}`]);
            while (queue.length > 0) {
                const curr = queue.shift();
                for (const dir of dirs) {
                    const nx = curr.x + dir[0], ny = curr.y + dir[1], key = `${nx},${ny}`;
                    if (visited.has(key)) continue;
                    const pipe = oilGrid[key];
                    // 허브에 닿을 수 있는 파이프만 활성화
                    if (pipe && pipe.canReachHub) {
                        pipe.isConnected = true;
                        visited.add(key);
                        queue.push({x: nx, y: ny});
                    }
                }
            }
        });
    }

    updatePower() {
        // 1. 모든 전력 기기 및 소비자 초기화
        const consumers = [
            ...this.entities.turrets,
            ...this.entities.armories,
            ...this.entities.barracks,
            ...this.entities.airports,
            ...this.entities.storage
        ];
        consumers.forEach(c => c.isPowered = false);
        this.entities.powerLines.forEach(pl => pl.isPowered = false);

        // 모든 전력 객체 매핑
        const powerGrid = {}; 
        
        // 전선 등록
        this.entities.powerLines.forEach(pl => {
            const gp = this.tileMap.worldToGrid(pl.x, pl.y);
            powerGrid[`${gp.x},${gp.y}`] = pl;
        });

        // 소비자 및 전력 원 등록
        const allBuildings = [
            ...consumers,
            ...this.entities.refineries, ...this.entities.goldMines,
            ...this.entities.generators, this.entities.base
        ];

        allBuildings.forEach(b => {
            const tilesW = (b.width || b.size || 40) / 40;
            const tilesH = (b.height || b.size || 40) / 40;
            for(let gy = 0; gy < tilesH; gy++) {
                for(let gx = 0; gx < tilesW; gx++) {
                    const nx = Math.floor(b.x / 40 - tilesW/2 + gx + (tilesW % 2 === 0 ? 0.5 : 0));
                    const ny = Math.floor(b.y / 40 - tilesH/2 + gy + (tilesH % 2 === 0 ? 0.5 : 0));
                    powerGrid[`${nx},${ny}`] = b;
                }
            }
        });

        // 탐색 큐 (발전소 및 기지에서 시작)
        const queue = [];
        const visited = new Set();

        const addSource = (x, y) => {
            const gridPos = this.tileMap.worldToGrid(x, y);
            const key = `${gridPos.x},${gridPos.y}`;
            queue.push(gridPos);
            visited.add(key);
        };

        this.entities.generators.forEach(g => addSource(g.x, g.y));
        addSource(this.entities.base.x, this.entities.base.y);

        // 3. BFS 전파 (전선망 활성화)
        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        while (queue.length > 0) {
            const curr = queue.shift();
            for (const dir of dirs) {
                const nx = curr.x + dir[0], ny = curr.y + dir[1], key = `${nx},${ny}`;
                const ent = powerGrid[key];
                if (ent && !visited.has(key)) {
                    ent.isPowered = true;
                    visited.add(key);
                    if (ent.type === 'power-line') {
                        queue.push({x: nx, y: ny});
                    }
                }
            }
        }

        // 4. 소비자 건물 활성화 (인접 전력원 체크)
        const activeSources = [
            ...this.entities.generators,
            ...this.entities.powerLines.filter(pl => pl.isPowered),
            this.entities.base
        ];

        const checkAreaPower = (target) => {
            const targetGp = this.tileMap.worldToGrid(target.x, target.y);
            // 대각선 제거: 오직 상하좌우(4방향) 및 자기 자신(0,0)만 허용
            const areaDirs = [[0,1],[0,-1],[1,0],[-1,0],[0,0]];
            
            for (const dir of areaDirs) {
                const nx = targetGp.x + dir[0], ny = targetGp.y + dir[1];
                const source = activeSources.find(s => {
                    const tw = (s.width || s.size || 40) / 40;
                    const th = (s.height || s.size || 40) / 40;
                    for(let gy = 0; gy < th; gy++) {
                        for(let gx = 0; gx < tw; gx++) {
                            const snx = Math.floor(s.x / 40 - tw/2 + gx + (tw % 2 === 0 ? 0.5 : 0));
                            const sny = Math.floor(s.y / 40 - th/2 + gy + (th % 2 === 0 ? 0.5 : 0));
                            if (snx === nx && sny === ny) return true;
                        }
                    }
                    return false;
                });
                if (source) return true;
            }
            return false;
        };

        consumers.forEach(c => c.isPowered = checkAreaPower(c));
    }

    updateVisibility() {
        // 모든 타일의 현재 시야(inSight) 초기화
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
        reveal(this.entities.base.x, this.entities.base.y, 30);

        // 2. 모든 아군 유닛 주변 시야
        this.entities.units.forEach(unit => {
            if (unit.alive) {
                reveal(unit.x, unit.y, unit.visionRange || 5);
            }
        });

        // 3. (추가) 모든 건물 주변 시야 - 건물이 있는 곳도 현재 시야를 확보해야 함
        const buildings = [
            ...this.entities.turrets,
            ...this.entities.generators,
            ...this.entities.airports,
            ...this.entities.refineries,
            ...this.entities.goldMines,
            ...this.entities.storage,
            ...this.entities.armories,
            ...this.entities.barracks
        ];
        buildings.forEach(b => {
            if (b.active || b.hp > 0) {
                // 건물은 기본적으로 자기 자리 주변 1~2칸 시야 확보
                reveal(b.x, b.y, 3);
            }
        });
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
        requestAnimationFrame((t) => this.loop(t));
    }

    start() {
        requestAnimationFrame((t) => this.loop(t));
    }
}
