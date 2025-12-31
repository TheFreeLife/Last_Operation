import { TileMap } from '../map/TileMap.js';
import { Base, Turret, Enemy, Projectile, Generator, Resource, CoalGenerator, OilGenerator, PowerLine, Substation, Wall, Airport, ScoutPlane, Refinery, PipeLine, GoldMine, Storage, CargoPlane, Armory, Tank, MissileLauncher, Rifleman, Barracks } from '../entities/Entities.js';
import { UpgradeManager } from '../systems/GameSystems.js';

export class GameEngine {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.minimapCanvas = document.getElementById('minimapCanvas');
        this.minimapCtx = this.minimapCanvas.getContext('2d');

        this.resize();

        this.entityClasses = { Base, Turret, Enemy, Projectile, Generator, CoalGenerator, OilGenerator, PowerLine, Substation, Wall, Airport, ScoutPlane, Refinery, PipeLine, GoldMine, Storage, CargoPlane, Armory, Tank, MissileLauncher, Rifleman, Barracks };
        this.tileMap = new TileMap(this.canvas);

        const basePos = this.tileMap.gridToWorld(this.tileMap.centerX, this.tileMap.centerY);
        this.entities = {
            enemies: [],
            turrets: [],
            projectiles: [],
            generators: [],
            powerLines: [],
            substations: [],
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
        const startTank = new Tank(basePos.x - 60, basePos.y + 60, this);
        const startMissile = new MissileLauncher(basePos.x + 60, basePos.y + 60, this);
        const startInfantry = new Rifleman(basePos.x, basePos.y + 80, this);
        startTank.destination = { x: basePos.x - 100, y: basePos.y + 100 };
        startMissile.destination = { x: basePos.x + 100, y: basePos.y + 100 };
        startInfantry.destination = { x: basePos.x, y: basePos.y + 120 };
        this.entities.units.push(startTank, startMissile, startInfantry);

        this.updateVisibility(); // 초기 시야 확보

        this.buildingRegistry = {
            'turret-basic': { cost: 50, size: [1, 1], className: 'Turret', list: 'turrets' },
            'turret-fast': { cost: 100, size: [1, 1], className: 'Turret', list: 'turrets' },
            'turret-sniper': { cost: 150, size: [1, 1], className: 'Turret', list: 'turrets' },
            'turret-tesla': { cost: 200, size: [1, 1], className: 'Turret', list: 'turrets' },
            'turret-flamethrower': { cost: 250, size: [1, 1], className: 'Turret', list: 'turrets' },
            'power-line': { cost: 10, size: [1, 1], className: 'PowerLine', list: 'powerLines' },
            'pipe-line': { cost: 10, size: [1, 1], className: 'PipeLine', list: 'pipeLines' },
            'substation': { cost: 100, size: [1, 1], className: 'Substation', list: 'substations' },
            'wall': { cost: 30, size: [1, 1], className: 'Wall', list: 'walls' },
            'airport': { cost: 500, size: [2, 3], className: 'Airport', list: 'airports' },
            'refinery': { cost: 300, size: [1, 1], className: 'Refinery', list: 'refineries', onResource: 'oil' },
            'gold-mine': { cost: 400, size: [1, 1], className: 'GoldMine', list: 'goldMines', onResource: 'gold' },
            'storage': { cost: 200, size: [2, 2], className: 'Storage', list: 'storage' },
            'armory': { cost: 600, size: [2, 2], className: 'Armory', list: 'armories' },
            'barracks': { cost: 400, size: [2, 2], className: 'Barracks', list: 'barracks' },
            'coal-generator': { cost: 200, size: [1, 1], className: 'CoalGenerator', list: 'generators', onResource: 'coal' },
            'oil-generator': { cost: 200, size: [1, 1], className: 'OilGenerator', list: 'generators', onResource: 'oil' }
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
    }

    initUI() {
        document.getElementById('restart-btn')?.addEventListener('click', () => location.reload());
        document.getElementById('roll-card-btn')?.addEventListener('click', () => this.rollRandomCard());
        this.updateBuildMenu();
    }

    getIconSVG(type) {
        const svgs = {
            'turret-basic': `<div class="btn-icon blue"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="12" fill="#333" stroke="#00d2ff" stroke-width="2"/><rect x="16" y="8" width="8" height="14" fill="#00d2ff"/></svg></div>`,
            'turret-fast': `<div class="btn-icon green"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="12" fill="#333" stroke="#39ff14" stroke-width="2"/><rect x="14" y="6" width="4" height="16" fill="#39ff14"/><rect x="22" y="6" width="4" height="16" fill="#39ff14"/></svg></div>`,
            'turret-sniper': `<div class="btn-icon red"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="12" fill="#333" stroke="#ff3131" stroke-width="2"/><rect x="18" y="2" width="4" height="20" fill="#ff3131"/><circle cx="20" cy="20" r="4" fill="none" stroke="#ff3131" stroke-width="2"/><line x1="20" y1="14" x2="20" y2="26" stroke="#ff3131" stroke-width="1"/><line x1="14" y1="20" x2="26" y2="20" stroke="#ff3131" stroke-width="1"/></svg></div>`,
            'coal-generator': `<div class="btn-icon orange"><svg viewBox="0 0 40 40"><rect x="10" y="20" width="20" height="15" fill="#333" stroke="#ff6600" stroke-width="2"/><rect x="22" y="10" width="6" height="12" fill="#333" stroke="#ff6600" stroke-width="2"/><circle cx="25" cy="8" r="3" fill="rgba(200,200,200,0.5)"/><circle cx="28" cy="4" r="4" fill="rgba(200,200,200,0.3)"/><path d="M15 28 Q20 20 25 28" stroke="#ff6600" stroke-width="2" fill="none"/></svg></div>`,
            'oil-generator': `<div class="btn-icon purple"><svg viewBox="0 0 40 40"><rect x="12" y="12" width="16" height="20" rx="3" fill="#333" stroke="#9370DB" stroke-width="2"/><path d="M12 16 L28 16" stroke="#9370DB" stroke-width="1"/><path d="M12 28 L28 28" stroke="#9370DB" stroke-width="1"/><circle cx="20" cy="12" r="4" fill="#333" stroke="#9370DB" stroke-width="2"/><path d="M8 20 L12 20" stroke="#9370DB" stroke-width="2"/></svg></div>`,
            'refinery': `<div class="btn-icon green"><svg viewBox="0 0 40 40"><rect x="8" y="10" width="10" height="25" fill="#333" stroke="#32cd32" stroke-width="2"/><rect x="22" y="10" width="10" height="25" fill="#333" stroke="#32cd32" stroke-width="2"/><path d="M18 20 H22" stroke="#32cd32" stroke-width="2"/><circle cx="20" cy="15" r="4" fill="#ffd700" opacity="0.8"/></svg></div>`,
            'gold-mine': `<div class="btn-icon yellow"><svg viewBox="0 0 40 40"><rect x="10" y="20" width="20" height="15" fill="#333" stroke="#FFD700" stroke-width="2"/><path d="M15 20 L20 10 L25 20" fill="#FFD700" stroke="#FFD700" stroke-width="1"/><circle cx="20" cy="28" r="4" fill="#FFD700"/></svg></div>`,
            'storage': `<div class="btn-icon blue"><svg viewBox="0 0 40 40"><rect x="5" y="15" width="30" height="20" fill="#333" stroke="#00d2ff" stroke-width="2"/><path d="M5 15 L20 5 L35 15" fill="#555" stroke="#00d2ff" stroke-width="2"/><rect x="18" y="25" width="4" height="10" fill="#00d2ff" opacity="0.5"/></svg></div>`,
            'substation': `<div class="btn-icon cyan"><svg viewBox="0 0 40 40"><rect x="10" y="10" width="20" height="20" fill="#333" stroke="#00ffcc" stroke-width="2"/><rect x="14" y="14" width="12" height="12" fill="#00ffcc" opacity="0.5"/><rect x="17" y="6" width="6" height="4" fill="#666"/></svg></div>`,
            'airport': `<div class="btn-icon"><svg viewBox="0 0 40 40"><rect x="5" y="15" width="30" height="15" fill="#444" stroke="#aaa" stroke-width="2"/><path d="M10 15 L20 5 L30 15" fill="#666" stroke="#aaa" stroke-width="2"/><rect x="18" y="20" width="4" height="10" fill="#fff" opacity="0.3"/></svg></div>`,
            'barracks': `<div class="btn-icon green"><svg viewBox="0 0 40 40"><rect x="5" y="10" width="30" height="25" fill="#2d3436" stroke="#1e272e" stroke-width="2"/><path d="M2 20 L20 5 L38 20" fill="#4a5d4b" stroke="#1e272e" stroke-width="2"/><rect x="15" y="25" width="10" height="10" fill="#111" stroke="#39ff14" stroke-width="1"/><rect x="8" y="18" width="6" height="4" fill="#00d2ff" opacity="0.5"/></svg></div>`,
            'armory': `<div class="btn-icon"><svg viewBox="0 0 40 40"><rect x="5" y="10" width="30" height="25" fill="#34495e" stroke="#2c3e50" stroke-width="2"/><rect x="10" y="20" width="20" height="15" fill="#111"/><path d="M5 10 L20 2 L35 10" fill="#2c3e50" stroke="#2c3e50" stroke-width="2"/></svg></div>`,
            'skill-rifleman': `<div class="btn-icon green"><svg viewBox="0 0 40 40"><circle cx="20" cy="15" r="6" fill="#2d3436"/><path d="M12 25 L28 25 L20 15 Z" fill="#556644"/><rect x="22" y="20" width="8" height="2" fill="#636e72"/></svg></div>`,
            'skill-scout': `<div class="btn-icon blue"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="15" fill="none" stroke="#00d2ff" stroke-width="2"/><path d="M20 10 V30 M10 20 H30" stroke="#00d2ff" stroke-width="1"/><circle cx="20" cy="20" r="5" fill="#00d2ff" opacity="0.5"/></svg></div>`,
            'skill-cargo': `<div class="btn-icon yellow"><svg viewBox="0 0 40 40"><path d="M10 25 L30 25 L35 15 L5 15 Z" fill="#FFD700" stroke="#aaa" stroke-width="2"/><rect x="15" y="10" width="10" height="5" fill="#888"/><path d="M5 15 L20 5 L35 15" stroke="#aaa" stroke-width="2" fill="none"/></svg></div>`,
            'skill-tank': `<div class="btn-icon green"><svg viewBox="0 0 40 40"><rect x="10" y="15" width="20" height="15" fill="#2c3e50" stroke="#39ff14" stroke-width="2"/><circle cx="20" cy="22" r="5" fill="#34495e"/><rect x="20" y="20" width="12" height="4" fill="#39ff14"/></svg></div>`,
            'skill-missile': `<div class="btn-icon red"><svg viewBox="0 0 40 40"><rect x="10" y="15" width="20" height="15" fill="#444" stroke="#ff3131" stroke-width="2"/><rect x="15" y="10" width="10" height="15" fill="#222"/><path d="M20 5 L24 12 L16 12 Z" fill="#ff3131"/></svg></div>`,
            'wall': `<div class="btn-icon"><svg viewBox="0 0 40 40"><rect x="5" y="10" width="30" height="25" fill="#444" stroke="#888" stroke-width="2"/><line x1="5" y1="22" x2="35" y2="22" stroke="#888" stroke-width="1"/><line x1="15" y1="10" x2="15" y2="22" stroke="#888" stroke-width="1"/><line x1="25" y1="22" x2="25" y2="35" stroke="#888" stroke-width="1"/></svg></div>`,
            'category-power': `<div class="btn-icon yellow"><svg viewBox="0 0 40 40"><path d="M10 20 L30 20 M20 10 L20 30" stroke="#ffff00" stroke-width="3"/><circle cx="20" cy="20" r="15" fill="none" stroke="#ffff00" stroke-width="2"/></svg></div>`,
            'category-network': `<div class="btn-icon purple"><svg viewBox="0 0 40 40"><circle cx="15" cy="15" r="5" fill="#ffff00"/><circle cx="25" cy="25" r="5" fill="#9370DB"/><path d="M15 15 L25 25" stroke="#fff" stroke-width="2"/></svg></div>`,
            'category-military': `<div class="btn-icon red"><svg viewBox="0 0 40 40"><rect x="10" y="10" width="20" height="20" fill="#333" stroke="#ff3131" stroke-width="2"/><path d="M5 15 L10 10 M35 15 L30 10 M20 5 V10" stroke="#ff3131" stroke-width="2"/><path d="M15 20 L25 20 M20 15 V25" stroke="#ff3131" stroke-width="2"/></svg></div>`,
            'power-line': `<div class="btn-icon yellow"><svg viewBox="0 0 40 40"><line x1="20" y1="5" x2="20" y2="35" stroke="#ffff00" stroke-width="4"/><circle cx="20" cy="20" r="6" fill="#333" stroke="#ffff00" stroke-width="2"/></svg></div>`,
            'pipe-line': `<div class="btn-icon purple"><svg viewBox="0 0 40 40"><rect x="10" y="10" width="20" height="20" rx="4" fill="#333" stroke="#9370DB" stroke-width="4"/><path d="M15 20 H25" stroke="#9370DB" stroke-width="2"/></svg></div>`,
            'menu:network': `<div class="btn-icon purple"><svg viewBox="0 0 40 40"><circle cx="15" cy="15" r="5" fill="#ffff00"/><circle cx="25" cy="25" r="5" fill="#9370DB"/><path d="M15 15 L25 25" stroke="#fff" stroke-width="2"/></svg></div>`,
            'menu:power': `<div class="btn-icon yellow"><svg viewBox="0 0 40 40"><path d="M10 20 L30 20 M20 10 L20 30" stroke="#ffff00" stroke-width="3"/><circle cx="20" cy="20" r="15" fill="none" stroke="#ffff00" stroke-width="2"/></svg></div>`,
            'menu:military': `<div class="btn-icon red"><svg viewBox="0 0 40 40"><rect x="10" y="10" width="20" height="20" fill="#333" stroke="#ff3131" stroke-width="2"/><path d="M5 15 L10 10 M35 15 L30 10 M20 5 V10" stroke="#ff3131" stroke-width="2"/><path d="M15 20 L25 20 M20 15 V25" stroke="#ff3131" stroke-width="2"/></svg></div>`,
            'skill:tank': `<div class="btn-icon green"><svg viewBox="0 0 40 40"><rect x="10" y="15" width="20" height="15" fill="#2c3e50" stroke="#39ff14" stroke-width="2"/><circle cx="20" cy="22" r="5" fill="#34495e"/><rect x="20" y="20" width="12" height="4" fill="#39ff14"/></svg></div>`,
            'skill:missile': `<div class="btn-icon red"><svg viewBox="0 0 40 40"><rect x="10" y="15" width="20" height="15" fill="#444" stroke="#ff3131" stroke-width="2"/><rect x="15" y="10" width="10" height="15" fill="#222"/><path d="M20 5 L24 12 L16 12 Z" fill="#ff3131"/></svg></div>`,
            'skill:rifleman': `<div class="btn-icon green"><svg viewBox="0 0 40 40"><circle cx="20" cy="15" r="6" fill="#2d3436"/><path d="M12 25 L28 25 L20 15 Z" fill="#556644"/><rect x="22" y="20" width="8" height="2" fill="#636e72"/></svg></div>`,
            'skill:cargo': `<div class="btn-icon yellow"><svg viewBox="0 0 40 40"><path d="M10 25 L30 25 L35 15 L5 15 Z" fill="#FFD700" stroke="#aaa" stroke-width="2"/><rect x="15" y="10" width="10" height="5" fill="#888"/><path d="M5 15 L20 5 L35 15" stroke="#aaa" stroke-width="2" fill="none"/></svg></div>`,
            'skill:scout': `<div class="btn-icon blue"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="15" fill="none" stroke="#00d2ff" stroke-width="2"/><path d="M20 10 V30 M10 20 H30" stroke="#00d2ff" stroke-width="1"/><circle cx="20" cy="20" r="5" fill="#00d2ff" opacity="0.5"/></svg></div>`,
            'unit:move': `<div class="btn-icon blue"><svg viewBox="0 0 40 40"><path d="M10 20 L30 20 M22 12 L30 20 L22 28" stroke="#00d2ff" stroke-width="3" fill="none"/></svg></div>`,
            'unit:stop': `<div class="btn-icon red"><svg viewBox="0 0 40 40"><rect x="10" y="10" width="20" height="20" fill="#ff3131"/></svg></div>`,
            'unit:hold': `<div class="btn-icon yellow"><svg viewBox="0 0 40 40"><path d="M20 5 L32 12 V25 L20 35 L8 25 V12 Z" fill="#333" stroke="#ffff00" stroke-width="2"/></svg></div>`,
            'unit:patrol': `<div class="btn-icon cyan"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="12" fill="none" stroke="#00ffcc" stroke-width="2" stroke-dasharray="5,3"/><path d="M32 20 L28 16 M32 20 L28 24" stroke="#00ffcc" stroke-width="2" fill="none"/></svg></div>`,
            'unit:attack': `<div class="btn-icon red"><svg viewBox="0 0 40 40"><path d="M10 30 L30 10 M10 10 L30 30" stroke="#ff3131" stroke-width="4"/><path d="M15 15 L10 10 M25 15 L30 10" stroke="#fff" stroke-width="2"/></svg></div>`,
            'back': `<div class="btn-icon"><svg viewBox="0 0 40 40"><path d="M25 10 L15 20 L25 30" stroke="#fff" stroke-width="3" fill="none"/></svg></div>`,
            'menu:main': `<div class="btn-icon"><svg viewBox="0 0 40 40"><path d="M25 10 L15 20 L25 30" stroke="#fff" stroke-width="3" fill="none"/></svg></div>`,
            'toggle:sell': `<div class="btn-icon red"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="none" stroke="#ff3131" stroke-width="3"/><line x1="8" y1="8" x2="32" y2="32" stroke="#ff3131" stroke-width="3"/><text x="20" y="27" text-anchor="middle" fill="#ff3131" font-size="18" font-weight="900" style="text-shadow: 0 0 5px #000;">$</text></svg></div>`,
            'sell': `<div class="btn-icon red"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="none" stroke="#ff3131" stroke-width="3"/><line x1="8" y1="8" x2="32" y2="32" stroke="#ff3131" stroke-width="3"/><text x="20" y="27" text-anchor="middle" fill="#ff3131" font-size="18" font-weight="900" style="text-shadow: 0 0 5px #000;">$</text></svg></div>`
        };
        return svgs[type] || '';
    }

    updateBuildMenu() {
        const grid = document.getElementById('build-grid');
        grid.innerHTML = '';
        
        const header = document.querySelector('.panel-header');
        if (!header) return;
        
        // 1. Determine which menu to show based on selection
        let menuType = 'main';
        let items = [];

        if (this.selectedEntities.length > 0) {
            // Check if all selected entities are units
            const unitTypes = ['tank', 'missile-launcher', 'rifleman'];
            const allUnits = this.selectedEntities.every(ent => unitTypes.includes(ent.type));
            // Check if all selected entities are of the same building type
            const firstType = this.selectedEntities[0].type;
            const allSameType = this.selectedEntities.every(ent => ent.type === firstType);

            if (allUnits) {
                menuType = 'unit';
                header.textContent = this.selectedEntities.length > 1 ? `부대 (${this.selectedEntities.length})` : this.selectedEntities[0].name;
                items = [
                    { id: 'move', name: '이동 (M)', icon: '🏃', action: 'unit:move' },
                    { id: 'stop', name: '정지 (S)', icon: '🛑', action: 'unit:stop' },
                    { id: 'hold', name: '홀드 (H)', icon: '🛡️', action: 'unit:hold' },
                    { id: 'patrol', name: '패트롤 (P)', icon: '🔄', action: 'unit:patrol' },
                    { id: 'attack', name: '어택 (A)', icon: '⚔️', action: 'unit:attack' },
                    null, null, null, null
                ];
            } else if (allSameType) {
                const type = firstType;
                if (type === 'armory') {
                    menuType = 'armory';
                    header.textContent = this.selectedEntities.length > 1 ? `병기창 (${this.selectedEntities.length})` : '병기창';
                    items = [
                        { type: 'skill-tank', name: '전차 생산', cost: 300, icon: '🚜', action: 'skill:tank' },
                        { type: 'skill-missile', name: '미사일 생산', cost: 500, icon: '🚀', action: 'skill:missile' },
                        null, null, null, null,
                        { type: 'menu:main', name: '취소', action: 'menu:main' },
                        null, null
                    ];
                } else if (type === 'airport') {
                    menuType = 'airport';
                    header.textContent = this.selectedEntities.length > 1 ? `공항 (${this.selectedEntities.length})` : '공항';
                    items = [
                        { type: 'skill-scout', name: '정찰', cost: 100, icon: '✈️', action: 'skill:scout' },
                        null, null, null, null, null,
                        { type: 'menu:main', name: '취소', action: 'menu:main' },
                        null, null
                    ];
                } else if (type === 'storage') {
                    menuType = 'storage';
                    header.textContent = this.selectedEntities.length > 1 ? `창고 (${this.selectedEntities.length})` : '창고';
                    items = [
                        { type: 'skill-cargo', name: '수송기 생산', cost: 100, icon: '📦', action: 'skill:cargo' },
                        null, null, null, null, null,
                        { type: 'menu:main', name: '취소', action: 'menu:main' },
                        null, null
                    ];
                } else {
                    menuType = 'building';
                    header.textContent = allSameType ? `${this.selectedEntities[0].name || '건물'} (${this.selectedEntities.length})` : '건물 정보';
                    items = [
                        null, null, null, null, null, null,
                        { type: 'menu:main', name: '취소', action: 'menu:main' },
                        null,
                        { type: 'toggle:sell', name: '판매', action: 'toggle:sell' }
                    ];
                }
            } else {
                // Mixed types selected (e.g., a unit and a building, or two different buildings)
                menuType = 'mixed';
                header.textContent = `다중 선택 (${this.selectedEntities.length})`;
                items = [null, null, null, null, null, null, { type: 'menu:main', name: '취소', action: 'menu:main' }, null, null];
            }
        } else if (this.selectedEntity) {
            const type = this.selectedEntity.type;
            if (type === 'armory') {
                menuType = 'armory';
                header.textContent = '병기창';
                items = [
                    { type: 'skill-tank', name: '전차 생산', cost: 300, icon: '🚜', action: 'skill:tank' },
                    { type: 'skill-missile', name: '미사일 생산', cost: 500, icon: '🚀', action: 'skill:missile' },
                    null, null, null, null,
                    { type: 'menu:main', name: '취소', action: 'menu:main' },
                    null, null
                ];
            } else if (type === 'barracks') {
                menuType = 'barracks';
                header.textContent = '병영';
                items = [
                    { type: 'skill-rifleman', name: '소총병 생산', cost: 100, icon: '💂', action: 'skill:rifleman' },
                    null, null, null, null, null,
                    { type: 'menu:main', name: '취소', action: 'menu:main' },
                    null, null
                ];
            } else if (type === 'airport') {
                menuType = 'airport';
                header.textContent = '공항';
                items = [
                    { type: 'skill-scout', name: '정찰', cost: 100, icon: '✈️', action: 'skill:scout' },
                    null, null, null, null, null,
                    { type: 'menu:main', name: '취소', action: 'menu:main' },
                    null, null
                ];
            } else if (type === 'storage') {
                menuType = 'storage';
                header.textContent = '창고';
                items = [
                    { type: 'skill-cargo', name: '수송기 생산', cost: 100, icon: '📦', action: 'skill:cargo' },
                    null, null, null, null, null,
                    { type: 'menu:main', name: '취소', action: 'menu:main' },
                    null, null
                ];
            } else {
                menuType = 'building';
                header.textContent = '건물 정보';
                items = [
                    null, null, null, null, null, null,
                    { type: 'menu:main', name: '취소', action: 'menu:main' },
                    null,
                    { type: 'sell', name: '판매', action: 'toggle:sell', icon: '💰' }
                ];
            }
        } else {
            header.textContent = '건 설';
            if (this.currentMenuName === 'network') {
                header.textContent = '네트워크';
                items = [
                    { type: 'power-line', name: '전선', cost: 10 },
                    { type: 'pipe-line', name: '파이프', cost: 10 },
                    null, null, null, null,
                    { type: 'menu:main', name: '뒤로', action: 'menu:main' },
                    null,
                    { type: 'toggle:sell', name: '판매', action: 'toggle:sell' }
                ];
            } else if (this.currentMenuName === 'power') {
                header.textContent = '발전소';
                items = [
                    { type: 'coal-generator', name: '석탄 발전', cost: 200 },
                    { type: 'oil-generator', name: '석유 발전', cost: 200 },
                    { type: 'refinery', name: '정제소', cost: 300 },
                    { type: 'gold-mine', name: '금 채굴장', cost: 400 },
                    { type: 'storage', name: '창고', cost: 200 },
                    null,
                    { type: 'menu:main', name: '뒤로', action: 'menu:main' },
                    null,
                    { type: 'toggle:sell', name: '판매', action: 'toggle:sell' }
                ];
            } else if (this.currentMenuName === 'military') {
                header.textContent = '군사 시설';
                items = [
                    { type: 'armory', name: '병기창', cost: 600 },
                    { type: 'airport', name: '공항', cost: 500 },
                    { type: 'barracks', name: '병영', cost: 400 },
                    null, null, null,
                    { type: 'menu:main', name: '뒤로', action: 'menu:main' },
                    null,
                    { type: 'toggle:sell', name: '판매', action: 'toggle:sell' }
                ];
            } else {
                items = [
                    { type: 'turret-basic', name: '기본 포탑', cost: 50 },
                    { type: 'menu:network', name: '네트워크', action: 'menu:network' },
                    { type: 'substation', name: '변전소', cost: 100 },
                    { type: 'menu:power', name: '에너지', action: 'menu:power' },
                    { type: 'wall', name: '벽', cost: 30 },
                    { type: 'menu:military', name: '군사', action: 'menu:military' },
                    null,
                    null,
                    { type: 'toggle:sell', name: '판매', action: 'toggle:sell' }
                ];
            }
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
        if (action.startsWith('menu:')) {
            this.currentMenuName = action.split(':')[1];
            this.selectedEntity = null;
            this.selectedEntities = [];
            this.updateBuildMenu();
        } else if (action === 'toggle:sell') {
            if (this.isSellMode) this.cancelSellMode();
            else this.startSellMode();
        } else if (action.startsWith('skill:')) {
            const skill = action.split(':')[1];
            if (skill === 'tank' || skill === 'missile' || skill === 'cargo' || skill === 'rifleman') {
                if (this.selectedEntity && this.selectedEntity.requestUnit) {
                    const cost = item.cost || 0;
                    if (this.resources.gold >= cost) {
                        if (this.selectedEntity.requestUnit(skill === 'missile' ? 'missile-launcher' : skill)) {
                            this.resources.gold -= cost;
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
                this.cancelModes();
                this.unitCommandMode = null;
                this.updateCursor();
            }
            // 스타크래프트 단축키
            if (this.selectedEntities.length > 0) {
                const key = e.key.toLowerCase();
                if (key === 'm') { this.unitCommandMode = 'move'; this.updateCursor(); }
                else if (key === 's') this.executeUnitCommand('stop');
                else if (key === 'h') this.executeUnitCommand('hold');
                else if (key === 'p') { this.unitCommandMode = 'patrol'; this.updateCursor(); }
                else if (key === 'a') { this.unitCommandMode = 'attack'; this.updateCursor(); }
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
    }

    handleSingleSelection(worldX, worldY, isShiftKey) {
        // Collect all potential entities to check
        const potentialEntities = [
            ...this.entities.units,
            ...this.entities.airports,
            ...this.entities.storage,
            ...this.entities.armories,
            ...this.entities.barracks,
            ...this.entities.turrets,
            ...this.entities.generators,
            ...this.entities.powerLines,
            ...this.entities.substations,
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
                // Check if already selected
                const idx = this.selectedEntities.indexOf(found);
                if (idx !== -1) {
                    // Deselect
                    this.selectedEntities.splice(idx, 1);
                    if (this.selectedEntity === found) {
                        this.selectedEntity = this.selectedEntities.length > 0 ? this.selectedEntities[this.selectedEntities.length - 1] : null;
                    }
                } else {
                    // Select
                    // Ensure existing selectedEntity is in list if it wasn't (e.g. single building selected previously)
                    if (this.selectedEntities.length === 0 && this.selectedEntity) {
                        this.selectedEntities.push(this.selectedEntity);
                    }
                    this.selectedEntities.push(found);
                    this.selectedEntity = found;
                }
            }
        } else {
            this.selectedEntity = null;
            this.selectedEntities = [];
            this.selectedAirport = null;

            if (found) {
                this.selectedEntity = found;
                const unitTypes = ['tank', 'missile-launcher', 'rifleman'];
                if (unitTypes.includes(found.type)) {
                    this.selectedEntities = [found];
                }
                if (found.type === 'airport') this.selectedAirport = found;
            }
        }

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
            ...this.entities.powerLines,
            ...this.entities.pipeLines,
            ...this.entities.substations,
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
                const unitTypes = ['tank', 'missile-launcher', 'rifleman'];
                if (unitTypes.includes(ent.type)) {
                    selectedUnits.push(ent);
                } else {
                    selectedBuildings.push(ent);
                }
            }
        });

        // Priority: Units > Buildings
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

        // If using an item, cost is 0
        const isFromItem = this.pendingItemIndex !== -1;
        const cost = isFromItem ? 0 : buildInfo.cost;

        if (this.resources.gold < cost) return false;

        const [tw, th] = buildInfo.size;
        const gridX = tileInfo.x;
        const gridY = tileInfo.y;
        let canPlace = true;

        // 1. Validate area for multi-tile buildings
        for (let dy = 0; dy > -th; dy--) {
            for (let dx = 0; dx < tw; dx++) {
                const nx = gridX + dx;
                const ny = gridY + dy;
                if (nx < 0 || nx >= this.tileMap.cols || ny < 0 || ny >= this.tileMap.rows) {
                    canPlace = false; break;
                }
                const tile = this.tileMap.grid[ny][nx];
                if (!tile.buildable || tile.occupied || !tile.visible) {
                    canPlace = false; break;
                }
            }
            if (!canPlace) break;
        }

        // 2. Resource specific check (Generators/Mines)
        let resourceIndex = -1;
        if (buildInfo.onResource) {
            const pos = this.tileMap.gridToWorld(gridX, gridY);
            resourceIndex = this.entities.resources.findIndex(r => 
                Math.abs(r.x - pos.x) < 5 && Math.abs(r.y - pos.y) < 5 && r.type === buildInfo.onResource
            );
            if (resourceIndex === -1) canPlace = false;
        }

        if (canPlace) {
            let worldPos;
            if (tw > 1 || th > 1) {
                worldPos = {
                    x: (gridX + tw / 2) * this.tileMap.tileSize,
                    y: (gridY - (th / 2 - 1)) * this.tileMap.tileSize
                };
            } else {
                worldPos = this.tileMap.gridToWorld(gridX, gridY);
            }

            // Instantiate class
            const ClassRef = this.entityClasses[buildInfo.className];
            if (ClassRef) {
                let newEntity;
                if (buildInfo.className === 'Turret') {
                    newEntity = new ClassRef(worldPos.x, worldPos.y, this.selectedBuildType);
                    newEntity.damage += (this.globalStats.damage - 10);
                    newEntity.range += (this.globalStats.range - 150);
                } else {
                    newEntity = new ClassRef(worldPos.x, worldPos.y, this);
                }

                // Add to appropriate list
                const listName = buildInfo.list;
                if (this.entities[listName]) {
                    this.entities[listName].push(newEntity);
                }

                // Mark tiles as occupied
                for (let dy = 0; dy > -th; dy--) {
                    for (let dx = 0; dx < tw; dx++) {
                        this.tileMap.grid[gridY + dy][gridX + dx].occupied = true;
                    }
                }

                // Remove resource if extracted
                if (resourceIndex !== -1) {
                    this.entities.resources.splice(resourceIndex, 1);
                }

                this.resources.gold -= cost;
                this.lastPlacedGrid = { x: gridX, y: gridY };

                if (isFromItem) {
                    this.inventory.splice(this.pendingItemIndex, 1);
                    this.pendingItemIndex = -1;
                    this.cancelBuildMode();
                    this.updateInventoryUI();
                    this.hideUITooltip();
                }
                return true;
            }
        }
        return false;
    }

    handleSell(worldX, worldY) {
        const tileInfo = this.tileMap.getTileAt(worldX, worldY);
        if (!tileInfo || !tileInfo.tile.occupied) return;

        let foundEntity = null;
        let listName = '';
        let foundIdx = -1;

        // All potential building lists
        const lists = ['turrets', 'generators', 'powerLines', 'substations', 'walls', 'airports', 'refineries', 'goldMines', 'storage', 'armories', 'pipeLines', 'barracks'];
        
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
        this.entities.substations = checkDestruction(this.entities.substations);
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

        const buildings = [...this.entities.turrets, ...this.entities.generators, ...this.entities.powerLines, ...this.entities.substations, ...this.entities.walls, ...this.entities.airports, ...this.entities.refineries, ...this.entities.goldMines, ...this.entities.storage, ...this.entities.armories, ...this.entities.barracks, ...this.entities.units, ...this.entities.pipeLines, ...this.entities.resources];
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
            ...this.entities.substations,
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
        this.entities.substations.forEach(s => s.draw(this.ctx));
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
        this.entities.enemies.forEach(e => e.draw(this.ctx));
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

        // 4. Check Substations
        const hoveredSub = this.entities.substations.find(s => Math.hypot(s.x - worldX, s.y - worldY) < 15);
        if (hoveredSub) {
            title = '변전소';
            desc = `<div class="stat-row"><span>📡 기능:</span> <span>주변 8방향 전력 공급</span></div>
                    <div class="stat-row"><span>❤️ 내구도:</span> <span class="highlight">${Math.ceil(hoveredSub.hp)}/${hoveredSub.maxHp}</span></div>
                    <div class="stat-row"><span>🔌 전력 상태:</span> <span class="${hoveredSub.isPowered ? 'text-green' : 'text-red'}">${hoveredSub.isPowered ? '공급 중' : '중단됨'}</span></div>`;
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
                    <div class="stat-row"><span>❤️ 체력:</span> <span class="highlight">${Math.ceil(activeUnit.hp)}/${activeUnit.maxHp}</span></div>
                    <div class="stat-row"><span>🏠 소속:</span> <span>병기창 유닛</span></div>`;
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

        mCtx.fillStyle = '#00ffcc'; 
        this.entities.substations.forEach(s => {
            if (isVisible(s.x, s.y)) mCtx.fillRect(s.x - 15, s.y - 15, 30, 30);
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
        // 1. 모든 전력 기기 초기화
        this.entities.turrets.forEach(t => t.isPowered = false);
        this.entities.powerLines.forEach(pl => pl.isPowered = false);
        this.entities.substations.forEach(s => s.isPowered = false);
        this.entities.armories.forEach(a => a.isPowered = false);
        this.entities.barracks.forEach(b => b.isPowered = false);

        // 모든 전력 전달 가능 객체(전선, 변전소, 모든 건물) 매핑
        const powerGrid = {}; 
        
        // 1. 전달자 등록 (전선, 변전소)
        this.entities.powerLines.forEach(pl => {
            const gp = this.tileMap.worldToGrid(pl.x, pl.y);
            powerGrid[`${gp.x},${gp.y}`] = pl;
        });
        this.entities.substations.forEach(s => {
            const gp = this.tileMap.worldToGrid(s.x, s.y);
            powerGrid[`${gp.x},${gp.y}`] = s;
        });

        // 2. 소비자 및 전력 원 등록 (대형 건물 포함 모든 건물)
        const allBuildings = [
            ...this.entities.airports, ...this.entities.storage, ...this.entities.armories,
            ...this.entities.barracks, ...this.entities.refineries, ...this.entities.goldMines,
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

        // 탐색 큐 준비
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

        // 3. BFS 전파 (전선과 변전소를 통해서만 전기가 흐름)
        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];

        while (queue.length > 0) {
            const curr = queue.shift();
            for (const dir of dirs) {
                const nx = curr.x + dir[0], ny = curr.y + dir[1], key = `${nx},${ny}`;
                const ent = powerGrid[key];
                if (ent && !visited.has(key)) {
                    ent.isPowered = true;
                    visited.add(key);
                    
                    // 핵심 로직: 전선이나 변전소일 때만 다음 이웃으로 전력을 전파 (큐에 추가)
                    // 일반 건물은 전력을 받기만 하고 전달하지 않음
                    if (ent.type === 'power-line' || ent.type === 'substation') {
                        queue.push({x: nx, y: ny});
                    }
                }
            }
        }

        // 4. 주변 포탑 활성화 (변전소, 발전소, 기지로부터 직접 전력을 공급받는 포탑)
        const activeSources = [
            ...this.entities.generators,
            ...this.entities.substations.filter(s => s.isPowered),
            this.entities.base
        ];

        const checkAreaPower = (target) => {
            const targetGp = this.tileMap.worldToGrid(target.x, target.y);
            const areaDirs = [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1],[0,0]];
            
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

        this.entities.turrets.forEach(t => t.isPowered = checkAreaPower(t));
    }

    updateVisibility() {
        const reveal = (worldX, worldY, radius) => {
            const grid = this.tileMap.worldToGrid(worldX, worldY);
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const nx = grid.x + dx;
                    const ny = grid.y + dy;
                    if (nx >= 0 && nx < this.tileMap.cols && ny >= 0 && ny < this.tileMap.rows) {
                        if (dx * dx + dy * dy <= radius * radius) {
                            this.tileMap.grid[ny][nx].visible = true;
                        }
                    }
                }
            }
        };

        // 오직 기지 주변만 시야를 밝힘 (건물 시야 기능 제거)
        reveal(this.entities.base.x, this.entities.base.y, 30);
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
