import { TileMap } from '../map/TileMap.js';
import { Entity, PlayerUnit, AmmoBox, MilitaryTruck, MedicalTruck, DroneContainerTruck, CargoPlane, ScoutPlane, Bomber, Helicopter, Artillery, AntiAirVehicle, Tank, MissileLauncher, MobileICBMLauncher, Rifleman, Sniper, AntiTankInfantry, Medic, MortarTeam, SuicideDrone, CarrierDrone, DroneOperator, SpecialForces, Train, FreightCar, SmallBoat } from '../entities/Entities.js';
import { Pathfinding } from './systems/Pathfinding.js';
import { ICONS } from '../assets/Icons.js';
import { EntityManager } from '../entities/EntityManager.js';
import { RenderSystem } from './systems/RenderSystem.js';
import { FlowField } from './systems/FlowField.js';
import { DebugSystem } from './systems/DebugSystem.js';
import { MapEditor } from './systems/MapEditor.js';
import { DeploymentSystem } from './systems/DeploymentSystem.js';
import { audioSystem } from './systems/AudioSystem.js';
import { CombatLogic } from './systems/CombatLogic.js';

import { renderECS } from './ecs/systems/RenderSystem.js';

import { FallingBomb } from '../entities/projectiles/Bomb.js';
import { Missile } from '../entities/projectiles/Missile.js';
import { NuclearMissile } from '../entities/projectiles/NuclearMissile.js';

export const GameState = {
    MENU: 'MENU',
    MAP_SELECT: 'MAP_SELECT',
    PLAYING: 'PLAYING',
    EDITOR: 'EDITOR'
};

export class GameEngine {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.gameState = GameState.MENU;
        this.missions = [];
        this.isTestMode = false; // 에디터 테스트 플레이 여부 추적

        this.minimapCanvas = document.getElementById('minimapCanvas');
        this.minimapCtx = this.minimapCanvas.getContext('2d');

        this.resize();

        this.entityClasses = { Entity, PlayerUnit, AmmoBox, MilitaryTruck, MedicalTruck, DroneContainerTruck, CargoPlane, ScoutPlane, Bomber, Helicopter, Artillery, AntiAirVehicle, Tank, MissileLauncher, MobileICBMLauncher, Rifleman, Sniper, AntiTankInfantry, Medic, MortarTeam, SuicideDrone, CarrierDrone, DroneOperator, SpecialForces, Train, FreightCar, SmallBoat };
        this.tileMap = new TileMap(this, this.canvas, 48);
        this.pathfinding = new Pathfinding(this);

        this.entityManager = new EntityManager(this);
        this.renderSystem = new RenderSystem(this);
        this.flowField = new FlowField(this);
        this.enemyFlowField = new FlowField(this); // 적군 전용 유동장 추가
        this.mapEditor = new MapEditor(this);
        this.deploymentSystem = new DeploymentSystem(this);
        this.combatLogic = CombatLogic;

        this.registerEntityTypes();

        this.entities = this.entityManager.entities;

        this.players = {
            1: { name: 'Player 1 (User)', team: 1 },
            2: { name: 'Player 2 (Enemy)', team: 2 },
            0: { name: 'Neutral', team: 0 }
        };

        this.controlGroups = {
            1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [], 0: []
        };
        
        this.relations = {
            '1-2': 'enemy',
            '2-1': 'enemy',
            '1-0': 'neutral',
            '0-1': 'neutral',
            '2-0': 'neutral',
            '0-2': 'neutral'
        };

        this.lastTime = 0;
        this.unitCommandMode = null;
        this.selectedEntity = null;
        this.selectedEntities = [];
        this.hoveredEntity = null;
        this.isHoveringUI = false;
        this.effects = [];

        // 마우스 및 더블 클릭 상태 추적
        this.isMouseDown = false;
        this.isRightMouseDown = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.lastClickTime = 0;
        this.lastClickedEntity = null;

        // Camera State
        const initialZoom = 0.8;
        this.camera = {
            x: 0,
            y: 0,
            width: this.canvas.width,
            height: this.canvas.height,
            zoom: initialZoom,
            mouseX: 0,
            mouseY: 0,
            edgeScrollSpeed: 15,
            edgeThreshold: 30,
            selectionBox: null
        };

        this.visibilityTimer = 0;
        this.visibilityInterval = 100;

        this.minimapCacheCanvas = document.createElement('canvas');
        this.minimapCacheCanvas.width = this.tileMap.cols;
        this.minimapCacheCanvas.height = this.tileMap.rows;
        this.minimapCacheCtx = this.minimapCacheCanvas.getContext('2d');

        this.debugSystem = new DebugSystem(this);

        // 오디오 시스템 초기화
        this.audioSystem = audioSystem;
        this.audioSystem.init('./data/sounds.json');

        // 민심 시스템 추가 (라이프 역할)
        this.publicSentiment = 100; // 초기 민심 100%

        window.addEventListener('resize', () => this.resize());
        this.initInput();
        this.initUI();
        
        this.setGameState(GameState.MENU);
    }

    async setGameState(newState) {
        const oldState = this.gameState;
        this.gameState = newState;
        
        // UI 레이어 토글
        document.getElementById('main-menu').classList.toggle('hidden', newState !== GameState.MENU);
        document.getElementById('map-selection').classList.toggle('hidden', newState !== GameState.MAP_SELECT);
        document.getElementById('ui-layer').classList.toggle('hidden', newState !== GameState.PLAYING);
        document.getElementById('editor-ui').classList.toggle('hidden', newState !== GameState.EDITOR);
        document.getElementById('debug-panel').classList.toggle('hidden', newState !== GameState.PLAYING);

        if (newState === GameState.MAP_SELECT) {
            await this.fetchMissions();
            this.renderMapList();
        } else if (newState === GameState.EDITOR) {
            this.mapEditor.activate();
            // 테스트 모드였다면 복귀 시 게임 세션만 정리
            if (oldState === GameState.PLAYING) {
                this.resetGameSession();
            }
        } else if (newState === GameState.MENU) {
            this.mapEditor.deactivate();
            this.isTestMode = false; // 테스트 모드 해제
            
            // 게임 플레이 중이었다가 메뉴로 나가는 경우 세션 초기화
            if (oldState === GameState.PLAYING || oldState === GameState.MAP_SELECT) {
                this.resetGameSession();
            }
        }
    }

    resetGameSession() {
        console.log('[Game] Resetting game session...');
        
        // 1. 엔티티 및 관리자 초기화
        if (this.entityManager) this.entityManager.clear();
        
        // 2. 선택 상태 초기화
        this.selectedEntities = [];
        this.selectedEntity = null;
        this.hoveredEntity = null;
        this.unitCommandMode = null;
        this.updateCursor();
        
        // 3. 부대 지정 초기화
        this.controlGroups = {
            1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [], 0: []
        };
        
        // 4. 시각 효과 및 파티클 초기화
        this.effects = [];
        if (this.renderSystem) {
            this.renderSystem.particles = [];
        }
        
        // 5. UI 초기화
        this.updateBuildMenu();
        this.hideUITooltip();
        
        // 6. 타일맵 초기화 (선택 사항 - loadMission에서 어차피 새로고침함)
        if (this.tileMap) {
            this.tileMap.initGrid();
        }
    }

    async fetchMissions() {
        if (this.missions.length > 0) return; // 이미 불러왔다면 건너뜀
        try {
            const response = await fetch('./data/map.json');
            const data = await response.json();
            this.missions = data.missions || [];
        } catch (error) {
            console.error('Failed to fetch missions:', error);
        }
    }

    renderMapList() {
        const list = document.getElementById('map-list');
        list.innerHTML = '';

        this.missions.forEach((mission, index) => {
            const card = document.createElement('div');
            card.className = 'map-card';
            card.innerHTML = `
                <div class="map-card-icon">${mission.icon || '⚔️'}</div>
                <div class="map-card-title">${mission.name}</div>
            `;
            card.onclick = () => {
                this.loadMission(mission);
                this.setGameState(GameState.PLAYING);
            };
            list.appendChild(card);
        });
    }

    async loadMission(missionData) {
        const mapData = missionData.data;
        if (!mapData) return;

        this.currentMission = missionData; // 미션 정보 보관

        try {
            console.log(`[Game] Loading mission: ${missionData.name}...`);
            
            // 1. 세션 초기화
            this.resetGameSession();

            // 2. 타일맵 데이터 로드 및 렌더링 준비
            this.tileMap.loadFromData(mapData);
            this.flowField.init(this.tileMap.cols, this.tileMap.rows);
            this.enemyFlowField.init(this.tileMap.cols, this.tileMap.rows);
            
            // 3. 미니맵 캐시 갱신
            if (this.minimapCacheCanvas) {
                this.minimapCacheCanvas.width = this.tileMap.cols;
                this.minimapCacheCanvas.height = this.tileMap.rows;
                this.minimapCacheCtx = this.minimapCacheCanvas.getContext('2d');
            }

            // 4. 유닛 스폰 (지연 방지를 위해 즉시 실행)
            const unitLayer = this.tileMap.layers.unit;
            const tileSize = this.tileMap.tileSize;

            for (let y = 0; y < mapData.height; y++) {
                if (!unitLayer[y]) continue;
                for (let x = 0; x < mapData.width; x++) {
                    const unitInfo = unitLayer[y][x];
                    if (unitInfo && unitInfo.id) {
                        // [추가] 등록된 엔티티 타입인지 확인 (지형 데이터 등이 유닛 레이어에 섞여 들어오는 것 방지)
                        if (!this.entityManager.registry.has(unitInfo.id)) {
                            console.warn(`[Game] Skipping invalid unit type in map data: ${unitInfo.id}`);
                            continue;
                        }

                        const worldX = x * tileSize + tileSize / 2;
                        const worldY = y * tileSize + tileSize / 2;
                        
                        const ownerId = (unitInfo.ownerId !== undefined) ? unitInfo.ownerId : 1;
                        const spawnOptions = { ownerId };
                        
                        // [추가] 에디터에서 저장된 기본 스탯 적용
                        if (unitInfo.stats) {
                            Object.assign(spawnOptions, unitInfo.stats);
                        }
                        
                        // 개별 속성이 직접 설정된 경우 (레거시 또는 수동 편집)
                        if (unitInfo.hp !== undefined) {
                            spawnOptions.hp = unitInfo.hp;
                            spawnOptions.maxHp = unitInfo.hp;
                        }
                        if (unitInfo.damage !== undefined) spawnOptions.damage = unitInfo.damage;
                        if (unitInfo.speed !== undefined) spawnOptions.speed = unitInfo.speed;
                        if (unitInfo.ammo !== undefined) spawnOptions.ammo = unitInfo.ammo;
                        if (unitInfo.aiState !== undefined) spawnOptions.aiState = unitInfo.aiState;
                        if (unitInfo.aiRadius !== undefined) spawnOptions.aiRadius = unitInfo.aiRadius;
                        
                        if (unitInfo.options) Object.assign(spawnOptions, unitInfo.options);

                        // ownerId에 따른 적절한 리스트 결정
                        let listOverride = undefined;
                        if (ownerId === 2) listOverride = 'enemies';
                        else if (ownerId === 0) listOverride = 'neutral';
                        else if (ownerId === 1) listOverride = 'units';

                        const entity = this.entityManager.create(unitInfo.id, worldX, worldY, spawnOptions, listOverride);
                        if (entity) {
                            entity.alive = true;
                            entity.angle = (unitInfo.r !== undefined) ? (unitInfo.r * Math.PI / 2) : 0;
                        }
                    }
                }
            }
            
            // 5. 카메라 설정
            const mapPixelWidth = mapData.width * tileSize;
            const mapPixelHeight = mapData.height * tileSize;
            
            // 화면 크기에 맞게 줌 조절 (최대 1.0, 최소 0.3)
            const padding = 1.2;
            const idealZoom = Math.min(this.canvas.width / (mapPixelWidth * padding), this.canvas.height / (mapPixelHeight * padding));
            this.camera.zoom = Math.min(Math.max(idealZoom, 0.4), 1.0);

            this.camera.x = this.canvas.width / 2 - (mapPixelWidth * this.camera.zoom) / 2;
            this.camera.y = this.canvas.height / 2 - (mapPixelHeight * this.camera.zoom) / 2;

            // 6. 시야 및 렌더링 강제 갱신
            this.updateVisibility();
            if (this.tileMap.updateFogCanvas) this.tileMap.updateFogCanvas();
            this.updateMinimapCache();
            this.updateDeploymentButtonState(); // 스폰 지점 유무에 따른 버튼 활성화
            
            return true; // 로드 성공
        } catch (error) {
            console.error('Failed to load mission:', error);
            return false;
        }
    }

    // 유닛 소환 위임
    spawnRandomUnit() {
        if (!this.checkSpawnPointExists()) {
            this.addEffect('system', this.canvas.width/2, this.canvas.height/2, '#ff3131', "배치 가능한 스폰 지점이 없습니다!");
            return;
        }
        this.deploymentSystem.presentOptions();
    }

    checkSpawnPointExists() {
        if (!this.tileMap || !this.tileMap.layers.wall) return false;
        for (let y = 0; y < this.tileMap.rows; y++) {
            for (let x = 0; x < this.tileMap.cols; x++) {
                if (this.tileMap.layers.wall[y][x]?.id === 'spawn-point') return true;
            }
        }
        return false;
    }

    updateDeploymentButtonState() {
        const btn = document.getElementById('random-spawn-btn');
        if (!btn) return;
        
        const exists = this.checkSpawnPointExists();
        btn.disabled = !exists;
        btn.classList.toggle('locked', !exists);
        
        // 툴팁 힌트 제공 (선택 사항)
        if (!exists) {
            btn.title = "맵에 스폰 지점이 없어 병력을 소환할 수 없습니다.";
        } else {
            btn.title = "";
        }
    }

    updateSentiment(amount) {
        this.publicSentiment = Math.min(100, Math.max(0, this.publicSentiment + amount));
        if (this.publicSentiment <= 0) {
            this.triggerGameOver("민심 악화로 인한 지휘권 박탈 (지지율 0%)");
        }
    }

    triggerGameOver(reason) {
        this.gameState = GameState.MENU; // 임시로 메뉴로 보냄 (또는 게임오버 상태)
        const modal = document.getElementById('game-over-modal');
        if (modal) {
            modal.querySelector('p').textContent = reason;
            modal.classList.remove('hidden');
        }
    }

    registerEntityTypes() {
        const em = this.entityManager;
        // 유닛
        em.register('tank', Tank, 'units');
        em.register('missile-launcher', MissileLauncher, 'units');
        em.register('icbm-launcher', MobileICBMLauncher, 'units');
        em.register('anti-air', AntiAirVehicle, 'units');
        em.register('artillery', Artillery, 'units');
        em.register('rifleman', Rifleman, 'units');
        em.register('sniper', Sniper, 'units');
        em.register('anti-tank', AntiTankInfantry, 'units');
        em.register('mortar-team', MortarTeam, 'units');
        em.register('drone-operator', DroneOperator, 'units');
        em.register('medic', Medic, 'units');
        em.register('special-forces', SpecialForces, 'units');
        em.register('military-truck', MilitaryTruck, 'units');
        em.register('medical-truck', MedicalTruck, 'units');
        em.register('drone-truck', DroneContainerTruck, 'units');
        em.register('cargo-plane', CargoPlane, 'units');
        em.register('scout-plane', ScoutPlane, 'units');
        em.register('bomber', Bomber, 'units');
        em.register('helicopter', Helicopter, 'units');
        em.register('suicide-drone', SuicideDrone, 'units');
        em.register('carrier-drone', CarrierDrone, 'units');
        em.register('train', Train, 'units');
        em.register('freight-car', FreightCar, 'units');
        em.register('small-boat', SmallBoat, 'units');

        // 자원 및 아이템
        em.register('ammo-box', AmmoBox, 'units');
        
        // 투사체 (레거시 호환)
        em.register('falling-bomb', FallingBomb, 'neutral');
        em.register('missile', Missile, 'neutral');
        em.register('nuclear-missile', NuclearMissile, 'neutral');
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.minimapCanvas.width = 200;
        this.minimapCanvas.height = 200;
    }

    getRelation(p1Id, p2Id) {
        if (p1Id === p2Id) return 'self';
        
        // 0번(중립)과의 관계는 항상 중립
        if (p1Id === 0 || p2Id === 0) return 'neutral';

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

    // 시각 효과 추가 메서드 (탄환 명중과 유닛 파괴 효과 완전 분리)
    addEffect(type, x, y, color = '#fff', text = '') {
        if (!this.renderSystem) return;

        // --- [CATEGORY 1: IMPACTS] 탄환/투사체 명중 시 효과 ---
        if (type === 'impact_shell') {
            // 포탄 명중: 찰나의 섬광 + 튀어오르는 흙먼지
            this.audioSystem.play('explosion', { volume: 0.12 });
            this.renderSystem.addParticle(x, y, 0, 0, 35, '#8b8682', 1200, 'smoke'); 
            for (let i = 0; i < 6; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 2.0 + Math.random() * 3.0;
                this.renderSystem.addParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 6 + Math.random() * 8, '#ffcc00', 200 + Math.random() * 200, 'fire');
            }
        } else if (type === 'impact_missile') {
            // 미사일 명중: 붉은 화염 폭발 + 순간적인 충격 연기
            this.audioSystem.play('explosion', { volume: 0.18 });
            this.renderSystem.addParticle(x, y, 0, 0, 50, '#555', 1500, 'smoke'); 
            for (let i = 0; i < 12; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 1.0 + Math.random() * 5.0;
                this.renderSystem.addParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 12 + Math.random() * 10, '#ff4500', 500 + Math.random() * 300, 'fire');
            }
        } else if (type === 'impact_bullet' || type === 'hit') {
            // 총탄 명중: 작은 불꽃/스파크
            for (let i = 0; i < 4; i++) {
                this.renderSystem.addParticle(x, y, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, 1 + Math.random() * 1.5, color, 300, 'spark');
            }

        // --- [CATEGORY 2: DEATHS] 유닛 파괴 시 효과 ---
        } else if (type === 'death_vehicle') {
            // 일반 차량 파괴: 화염과 연기 규모 축소 + 수직 상승 연기 추가
            this.audioSystem.play('explosion', { volume: 0.2 });
            for (let i = 0; i < 4; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 0.5 + Math.random() * 2.0;
                this.renderSystem.addParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 12 + Math.random() * 12, '#333', 3000 + Math.random() * 1500, 'smoke');
            }
            // 수직 상승 기둥 연기 (몽글몽글하게 피어오름 - 크기 축소)
            for (let i = 0; i < 3; i++) {
                const vx = (Math.random() - 0.5) * 0.3;
                const vy = -0.4 - Math.random() * 0.4;
                this.renderSystem.addParticle(x, y, vx, vy, 5 + Math.random() * 4, '#222', 5000 + Math.random() * 2000, 'smoke');
            }
            for (let i = 0; i < 8; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 1.5 + Math.random() * 4.0;
                this.renderSystem.addParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 10 + Math.random() * 10, '#ff6600', 500 + Math.random() * 300, 'fire');
            }
        } else if (type === 'death_heavy') {
            // 대형 기계 파괴: 묵직함은 유지하되 수직 기둥 연기 강화
            this.audioSystem.play('explosion', { volume: 0.3 });
            for (let i = 0; i < 2; i++) {
                this.renderSystem.addParticle(x, y, 0, 0, 35 + i * 15, '#111', 4000 + i * 1000, 'smoke');
            }
            // 강력한 수직 상승 기둥 연기 (크기 축소)
            for (let i = 0; i < 5; i++) {
                const vx = (Math.random() - 0.5) * 0.4;
                const vy = -0.6 - Math.random() * 0.6;
                this.renderSystem.addParticle(x, y, vx, vy, 8 + Math.random() * 6, '#111', 7000 + Math.random() * 3000, 'smoke');
            }
            for (let i = 0; i < 12; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 0.5 + Math.random() * 6.0;
                this.renderSystem.addParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 15 + Math.random() * 10, (i % 2 === 0 ? '#ff3300' : '#ffaa00'), 800 + Math.random() * 500, 'fire');
            }
        } else if (type === 'death_infantry') {
            // 보병 사망: 파편 개수 감소 및 간결화
            for (let i = 0; i < 5; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 1 + Math.random() * 2;
                this.renderSystem.addParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 1.5 + Math.random() * 1.5, '#8b0000', 400, 'spark');
            }

        // --- [CATEGORY 3: SPECIALS] 특수 효과 (핵, 무즐, 기타) ---
        } else if (type === 'nuke_explosion') {
            // 핵폭발 전용 사운드 및 강화된 시각 효과 (웅장한 잔상 연기)
            this.audioSystem.play('nuke_explosion', { volume: 0.5, cooldown: 1000 });
            
            // 1. 거대 중심 연기 (매우 오래 지속, 회색빛)
            for (let i = 0; i < 5; i++) {
                this.renderSystem.addParticle(x, y, 0, 0, 150 + i * 20, '#555', 8000 + Math.random() * 4000, 'smoke');
            }

            // 2. 주변으로 퍼지는 잔상 연기들 (짙은 회색)
            for (let i = 0; i < 15; i++) {
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * 100;
                const px = x + Math.cos(angle) * dist;
                const py = y + Math.sin(angle) * dist;
                this.renderSystem.addParticle(px, py, 0, 0, 80 + Math.random() * 60, '#444', 6000 + Math.random() * 3000, 'smoke');
            }

            // 3. 폭발 화염 파티클 (빠르게 타오름)
            for (let i = 0; i < 60; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 2.0 + Math.random() * 15.0;
                this.renderSystem.addParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 30 + Math.random() * 40, '#ff4500', 1500 + Math.random() * 1000, 'fire');
            }

            // 4. 고온 광휘 효과 (중앙 화염)
            for (let i = 0; i < 20; i++) {
                this.renderSystem.addParticle(x, y, (Math.random()-0.5)*2, (Math.random()-0.5)*2, 50 + Math.random() * 50, '#ffcc00', 800, 'fire');
            }
        } else if (type === 'muzzle_large') {
            // 전차/자주포용 포구 화염 (강하지만 짧게)
            this.audioSystem.play('cannon_shot', { volume: 0.2 });
            for (let i = 0; i < 5; i++) {
                const angle = (Math.random() - 0.5) * 0.5; // 전방으로 집중
                this.renderSystem.addParticle(x, y, Math.cos(angle) * 2, Math.sin(angle) * 2, 15 + Math.random() * 10, '#ffd700', 100, 'fire');
            }
        } else if (type === 'muzzle_sniper') {
            // 저격총 총구 화염 및 사운드
            this.audioSystem.play('sniper_rifle', { volume: 0.15 });
            this.renderSystem.addParticle(x, y, 0, 0, 10 + Math.random() * 5, '#fff', 120, 'fire');
        } else if (type === 'muzzle') {
            // 일반 보병용 총구 화염 (간결하게)
            this.audioSystem.play('rifle', { volume: 0.05 });
            this.renderSystem.addParticle(x, y, 0, 0, 6 + Math.random() * 6, '#fff', 80, 'fire');
        } else if (type === 'hit' || type === 'flak') {
            // 일반 피격 스파크
            for (let i = 0; i < 6; i++) {
                this.renderSystem.addParticle(x, y, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, 1 + Math.random() * 2, color, 400, 'spark');
            }
        } else if (type === 'smoke') {
            // 유닛 데미지용 연기 효과 (위로 살짝 피어오름)
            const vx = (Math.random() - 0.5) * 0.5;
            const vy = -0.5 - Math.random() * 0.5;
            this.renderSystem.addParticle(x, y, vx, vy, 8 + Math.random() * 8, color, 3000 + Math.random() * 2000, 'smoke');
        } else if (type === 'water_wake') {
            // 해상 유닛용 물보라 효과 (크기 및 속도 하향, 색상 연하게)
            const angle = color; 
            const spread = (Math.random() - 0.5) * 0.4;
            const vx = Math.cos(angle + Math.PI + spread) * (0.5 + Math.random() * 0.5);
            const vy = Math.sin(angle + Math.PI + spread) * (0.5 + Math.random() * 0.5);
            this.renderSystem.addParticle(x, y, vx, vy, 1.5 + Math.random() * 2, '#d0eaff', 400 + Math.random() * 300, 'smoke');
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

    initUI() {
        const playBtnSound = () => this.audioSystem.play('button_click', { volume: 0.15 });

        document.getElementById('start-game-btn')?.addEventListener('click', () => {
            playBtnSound();
            this.setGameState(GameState.MAP_SELECT);
        });
        document.getElementById('map-select-back-btn')?.addEventListener('click', () => {
            playBtnSound();
            this.setGameState(GameState.MENU);
        });
        document.getElementById('map-editor-btn')?.addEventListener('click', () => {
            playBtnSound();
            this.setGameState(GameState.EDITOR);
        });
        
        document.getElementById('in-game-exit-btn')?.addEventListener('click', () => {
            playBtnSound();
            if (this.isTestMode) {
                this.setGameState(GameState.EDITOR);
            } else {
                this.setGameState(GameState.MENU);
            }
        });

        document.getElementById('editor-exit-btn')?.addEventListener('click', () => {
            playBtnSound();
            this.setGameState(GameState.MENU);
        });
        document.getElementById('restart-btn')?.addEventListener('click', () => {
            playBtnSound();
            location.reload();
        });
        
        // 랜덤 소환 및 선택 취소 버튼 리스너
        document.getElementById('random-spawn-btn')?.addEventListener('click', () => {
            playBtnSound();
            this.spawnRandomUnit();
        });

        this.updateBuildMenu();
    }

    getIconSVG(type) {
        return ICONS[type] || '';
    }

    updateBuildMenu() {
        if (this.gameState !== GameState.PLAYING) return;
        const grid = document.getElementById('build-grid');
        if (!grid) return;
        grid.innerHTML = '';

        const header = document.querySelector('.panel-header');
        if (!header) return;

        let items = [];

        if (this.selectedEntities.length > 0) {
            const firstEnt = this.selectedEntities[0];

            // 모든 선택된 개체가 사용자의 것인지 확인
            const isUserOwned = this.selectedEntities.every(ent => ent.ownerId === 1);
            const isEnemy = firstEnt.ownerId === 2;
            const isNeutral = firstEnt.ownerId === 0;
            const allSameType = this.selectedEntities.every(ent => ent.type === firstEnt.type);

            // 유닛 여부 판별
            const allUnits = this.selectedEntities.every(ent =>
                ent instanceof PlayerUnit || (ent.speed !== undefined && ent.hp !== 99999999)
            );

            if (isUserOwned && allUnits) {
                const sizeInfo = (this.selectedEntities.length === 1) ? ` [${firstEnt.sizeCategoryName}]` : '';
                header.textContent = (this.selectedEntities.length > 1 ? `GROUPS (${this.selectedEntities.length})` : firstEnt.name.toUpperCase()) + sizeInfo;

                // 유동적 배열: 필요한 명령만 담음
                items = [];

                if (allSameType) {
                    const unitType = firstEnt.type;
                    if (unitType === 'missile-launcher' || unitType === 'icbm-launcher' || unitType === 'mortar-team') {
                        items.push({ id: 'siege', name: 'SIEGE (O)', icon: '🏗️', action: 'unit:siege', skillType: 'state' });
                        if (unitType === 'missile-launcher' || unitType === 'icbm-launcher') {
                            items.push({ id: 'manual_fire', name: 'FIRE (F)', icon: '🚀', action: 'unit:manual_fire', skillType: 'targeted' });
                        }
                    } else if (unitType === 'bomber' || unitType === 'cargo-plane' || unitType === 'helicopter' || unitType === 'military-truck' || unitType === 'medical-truck' || unitType === 'drone-truck') {
                        const isFlying = firstEnt.altitude > 0.8;
                        const isLanded = firstEnt.altitude < 0.1 || unitType === 'military-truck' || unitType === 'medical-truck' || unitType === 'drone-truck';

                        if (unitType === 'bomber') {
                            items.push({
                                id: 'bombing',
                                name: 'BOMB (B)',
                                action: 'unit:bombing',
                                skillType: 'toggle',
                                locked: !isFlying,
                                active: firstEnt.isBombingActive
                            });
                        } else if (unitType === 'drone-truck') {
                            items.push({
                                id: 'sortie',
                                name: 'SORTIE (U)',
                                icon: '🐝',
                                action: 'unit:sortie',
                                skillType: 'toggle',
                                active: firstEnt.isSortieActive,
                                locked: firstEnt.droneCount <= 0
                            });
                        } else if (unitType === 'cargo-plane' || unitType === 'helicopter' || unitType === 'military-truck' || unitType === 'medical-truck') {
                            items.push({
                                id: 'unload_all',
                                name: 'UNLOAD (U)',
                                action: 'unit:unload_all',
                                skillType: 'instant',
                                locked: !isLanded || firstEnt.cargo.length === 0
                            });

                            if (unitType === 'cargo-plane') {
                                items.push({
                                    id: 'combat_drop',
                                    name: 'DROP (D)',
                                    action: 'unit:combat_drop',
                                    skillType: 'instant',
                                    locked: !isFlying || firstEnt.cargo.length === 0
                                });
                            }
                        }
                    }
                }
            } else if (isEnemy) {
                const sizeInfo = firstEnt.sizeCategoryName ? ` [${firstEnt.sizeCategoryName}]` : '';
                header.textContent = `[ENEMY] ${firstEnt.name}${sizeInfo}`;
            } else if (isNeutral) {
                const sizeInfo = firstEnt.sizeCategoryName ? ` [${firstEnt.sizeCategoryName}]` : '';
                header.textContent = `[NEUTRAL] ${firstEnt.name}${sizeInfo}`;
            }
        } else {
            // 아무것도 선택되지 않은 상태
            header.textContent = 'COMMAND';
            items = []; // 빈 배열로 초기화
        }

        this.isHoveringUI = false;
        this.hideUITooltip();

        items.forEach(item => {
            if (!item) return;

            const btn = document.createElement('div');
            btn.className = 'build-btn';

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
                    iconHtml = `<div class="btn-icon gray"><div style="font-size: 20px; display: flex; align-items: center; justify-content: center; height: 100%;">${item.icon}</div></div>`;
                }
            }

            btn.innerHTML = (iconHtml || `<div class="btn-icon gray">?</div>`) + `<div class="btn-name">${item.name}</div>`;

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
        this.audioSystem.play('button_click', { volume: 0.15 });
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
        window.addEventListener('contextmenu', (e) => e.preventDefault());

        window.addEventListener('keydown', (e) => {
            // [추가] 입력 창에 포커스가 있는 경우 게임 단축키 무시 (부대 지정 등 방지)
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
                return;
            }

            // 에디터 모드 시 브라우저 기본 단축키 차단 (저장, 인쇄 등)
            if (this.gameState === GameState.EDITOR) {
                if ((e.ctrlKey || e.metaKey) && ['s', 'p', 'f', 'g'].includes(e.key.toLowerCase())) {
                    e.preventDefault();
                }
            }

            if (e.key === 'Escape') {
                // 에디터 모드에서는 메뉴로 이동
                if (this.gameState === GameState.EDITOR) {
                    this.setGameState(GameState.MENU);
                    return;
                }

                // 1. 활성화된 특수 모드(명령 타겟팅, 디버그 모드) 취소
                const isDebugMode = this.debugSystem && (this.debugSystem.spawnUnitType || this.debugSystem.isEraserMode);
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
                else if (key === 'o') this.executeUnitCommand('siege');
                else if (key === 'f') { this.unitCommandMode = 'manual_fire'; this.updateCursor(); }
                else if (key === 'a') { this.unitCommandMode = 'attack'; this.updateCursor(); }
                else if (key === 't') this.executeUnitCommand('takeoff_landing');
                else if (key === 'd') this.executeUnitCommand('combat_drop');
                else if (key === 'u') {
                    if (this.selectedEntities.some(ent => ent.type === 'drone-truck')) {
                        this.executeUnitCommand('sortie');
                    }
                    this.executeUnitCommand('unload_all');
                }
                else if (key === 'b') {
                    const hasBomber = this.selectedEntities.some(ent => ent.type === 'bomber');
                    if (hasBomber) this.executeUnitCommand('bombing');
                }
            }
        });

        this.canvas.addEventListener('mousedown', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const worldX = (e.clientX - rect.left - this.camera.x) / this.camera.zoom;
            const worldY = (e.clientY - rect.top - this.camera.y) / this.camera.zoom;

            if (this.gameState === GameState.EDITOR) {
                if (this.mapEditor.editingUnitKey) return; // 모달 열려있으면 차단
                
                if (e.button === 0) {
                    this.isMouseDown = true;
                    this.mapEditor.handleInput(worldX, worldY, true, false);
                } else if (e.button === 2) {
                    this.isRightMouseDown = true;
                    this.lastMouseX = e.clientX;
                    this.lastMouseY = e.clientY;
                    // 우클릭은 화면 이동을 위해 예약 (즉시 삭제 방지)
                }
                return;
            }

            if (e.button === 0) this.isMouseDown = true;
            if (e.button === 2) {
                this.isRightMouseDown = true;
                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
            }

            if (this.gameState !== GameState.PLAYING) return;

            if (e.button === 0) { // LEFT CLICK
                if (this.unitCommandMode) {
                    const potentialTargets = [
                        ...this.entities.units,
                        ...this.entities.enemies,
                        ...this.entities.neutral
                    ];

                    const clickedTarget = potentialTargets.find(ent => {
                        if (!ent || !ent.active || ent.hp <= 0) return false;

                        // [추가] 천장 가림 판정
                        if (this.tileMap && !(this.debugSystem?.isFullVision)) {
                            if (!this.tileMap.isInSight(ent.x, ent.y)) return false;

                            const g = this.tileMap.worldToGrid(ent.x, ent.y);
                            const tile = this.tileMap.grid[g.y]?.[g.x];
                            const hasCeiling = tile && this.tileMap.layers.ceiling[g.y]?.[g.x]?.id && tile.ceilingHp > 0;

                            if (hasCeiling) {
                                // 아군이 있는 방인지 확인
                                const activeRoomIds = new Set();
                                this.entities.units.forEach(u => {
                                    const isFlying = (u.domain === 'air' || (u.altitude !== undefined && u.altitude > 0.01));
                                    if (u.ownerId === 1 && u.active && u.hp > 0 && !isFlying && !u.isBoarded) {
                                        const ug = this.tileMap.worldToGrid(u.x, u.y);
                                        const rid = this.tileMap.grid[ug.y]?.[ug.x]?.roomId;
                                        if (rid) activeRoomIds.add(rid);
                                    }
                                });
                                if (!activeRoomIds.has(tile.roomId)) return false;
                            }
                        }

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

                    // [추가] 유닛 타겟이 없으면 타일맵 블록 확인
                    let tileTarget = null;
                    if (!finalTarget && this.unitCommandMode === 'attack') {
                        const grid = this.tileMap.worldToGrid(worldX, worldY);
                        const wall = this.tileMap.layers.wall[grid.y]?.[grid.x];
                        if (wall && wall.id && wall.id !== 'spawn-point') {
                            const worldPos = this.tileMap.gridToWorld(grid.x, grid.y);
                            tileTarget = {
                                type: 'tile',
                                x: worldPos.x,
                                y: worldPos.y,
                                gx: grid.x,
                                gy: grid.y,
                                ownerId: 0, // 중립 판정
                                active: true,
                                hp: this.tileMap.grid[grid.y][grid.x].hp
                            };
                        }
                    }

                    this.executeUnitCommand(this.unitCommandMode, worldX, worldY, finalTarget || tileTarget);
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

                        // [추가] 천장 가림 판정
                        if (this.tileMap && !(this.debugSystem?.isFullVision)) {
                            if (!this.tileMap.isInSight(ent.x, ent.y)) return false;

                            const g = this.tileMap.worldToGrid(ent.x, ent.y);
                            const tile = this.tileMap.grid[g.y]?.[g.x];
                            const hasCeiling = tile && this.tileMap.layers.ceiling[g.y]?.[g.x]?.id && tile.ceilingHp > 0;

                            if (hasCeiling) {
                                // 아군이 있는 방인지 확인
                                const activeRoomIds = new Set();
                                this.entities.units.forEach(u => {
                                    const isFlying = (u.domain === 'air' || (u.altitude !== undefined && u.altitude > 0.01));
                                    if (u.ownerId === 1 && u.active && u.hp > 0 && !isFlying && !u.isBoarded) {
                                        const ug = this.tileMap.worldToGrid(u.x, u.y);
                                        const rid = this.tileMap.grid[ug.y]?.[ug.x]?.roomId;
                                        if (rid) activeRoomIds.add(rid);
                                    }
                                });
                                if (!activeRoomIds.has(tile.roomId)) return false;
                            }
                        }

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
                        ...this.entities.units.filter(u => u.type === 'military-truck' || u.type === 'medical-truck' || u.type === 'cargo-plane' || u.type === 'helicopter')
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
            const rect = this.canvas.getBoundingClientRect();
            const worldX = (e.clientX - rect.left - this.camera.x) / this.camera.zoom;
            const worldY = (e.clientY - rect.top - this.camera.y) / this.camera.zoom;

            // 에디터 모드 조작
            if (this.gameState === GameState.EDITOR) {
                if (this.mapEditor.editingUnitKey) return; // 모달 열려있으면 차단
                
                // 클릭 중일 때는 드래그 처리, 아닐 때도 좌표 업데이트를 위해 호출
                this.mapEditor.handleInput(worldX, worldY, this.isMouseDown, false);

                if (this.isRightMouseDown) {
                    const dx = e.clientX - this.lastMouseX;
                    const dy = e.clientY - this.lastMouseY;
                    this.camera.x += dx;
                    this.camera.y += dy;
                    this.lastMouseX = e.clientX;
                    this.lastMouseY = e.clientY;
                }
            }

            this.camera.mouseX = e.clientX;
            this.camera.mouseY = e.clientY;

            if (this.camera.selectionBox) {
                this.camera.selectionBox.currentX = worldX;
                this.camera.selectionBox.currentY = worldY;
            }

            if (!this.isHoveringUI) {
                const potentialEntities = [
                    ...this.entities.units, ...this.entities.enemies
                ];

                const hovered = potentialEntities.find(ent => {
                    if (!ent || (ent.active === false && ent.hp !== 99999999)) return false;

                    // [시야 체크] 아군 외 유닛은 시야 내에 있을 때만 호버 정보 표시
                    const isAlly = (ent.ownerId === 1 || ent.ownerId === 3);
                    if (!isAlly && this.tileMap && !this.tileMap.isInSight(ent.x, ent.y) && !(this.debugSystem?.isFullVision)) {
                        return false;
                    }

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
            if (e.button === 0) this.isMouseDown = false;
            if (e.button === 2) this.isRightMouseDown = false;

            const rect = this.canvas.getBoundingClientRect();
            const worldX = (e.clientX - rect.left - this.camera.x) / this.camera.zoom;
            const worldY = (e.clientY - rect.top - this.camera.y) / this.camera.zoom;

            if (this.gameState === GameState.EDITOR) {
                this.mapEditor.handleInput(worldX, worldY, false, e.button === 2);
                return;
            }

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
        const classes = ['cmd-move-cursor', 'cmd-attack-cursor'];
        this.canvas.classList.remove(...classes);

        if (this.unitCommandMode === 'move') {
            this.canvas.classList.add('cmd-move-cursor');
        } else if (this.unitCommandMode === 'attack' || this.unitCommandMode === 'manual_fire' || this.unitCommandMode === 'bombing') {
            this.canvas.classList.add('cmd-attack-cursor');
        }
        this.canvas.style.cursor = '';
    }

    executeUnitCommand(cmd, worldX = null, worldY = null, targetObject = null) {
        if (this.selectedEntities.length === 0) return;

        this.selectedEntities.forEach(unit => {
            if (unit.ownerId !== 1) return;
            if (unit.type === 'carrier-drone') return; // 군집 드론은 AI가 제어하므로 명령 무시
            
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
                const canAttack = ((unit.type === 'missile-launcher' || unit.type === 'icbm-launcher') ? unit.isSieged : (typeof unit.attack === 'function'));
                if (!canAttack) {
                    finalCmd = 'move';
                    unit.manualTarget = null;
                }
            }

            unit.command = finalCmd;
            if (finalCmd === 'move' && worldX !== null) {
                unit.destination = { x: worldX, y: worldY };
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
            this.debugSystem.spawnUnitType = null;
            this.debugSystem.isEraserMode = false;
            
            // 모든 디버그 소환 버튼 ID 리스트 (자동으로 unitTypeMap 기반으로 처리하면 좋으나 일단 명시적 유지)
            const dbBtns = [
                'db-eraser', 'db-spawn-tank', 'db-spawn-artillery', 'db-spawn-anti-air', 
                'db-spawn-missile', 'db-spawn-icbm', 'db-spawn-rifleman', 'db-spawn-sniper',
                'db-spawn-anti-tank', 'db-spawn-special-forces', 'db-spawn-medic', 'db-spawn-mortar',
                'db-spawn-drone-op', 'db-spawn-suicide-drone', 'db-spawn-military-truck',
                'db-spawn-medical-truck', 'db-spawn-bomber', 'db-spawn-cargo-plane',
                'db-spawn-scout-plane', 'db-spawn-helicopter', 'db-spawn-drone-truck', 
                'db-spawn-boat', 'db-spawn-train', 'db-spawn-freight',
                'db-spawn-ammo-bullet', 'db-spawn-ammo-shell', 'db-spawn-ammo-missile', 
                'db-spawn-ammo-nuclear', 'db-spawn-sentiment'
            ];
            
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
            
            // [시야 체크] 아군 외 유닛은 시야 내에 있을 때만 선택 가능
            const isAlly = (ent.ownerId === 1);
            if (!isAlly && this.tileMap && !this.tileMap.isInSight(ent.x, ent.y) && !(this.debugSystem?.isFullVision)) {
                return false;
            }

            const bounds = ent.getSelectionBounds ? ent.getSelectionBounds() : {
                left: ent.x - 20, right: ent.x + 20, top: ent.y - 20, bottom: ent.y + 20
            };
            return worldX >= bounds.left && worldX <= bounds.right && worldY >= bounds.top && worldY <= bounds.bottom;
        });

        const now = Date.now();
        const isDoubleClick = (found && this.lastClickedEntity === found && (now - this.lastClickTime) < 300);
        
        this.lastClickTime = now;
        this.lastClickedEntity = found;

        if (found) {
            const isEnemy = this.entities.enemies.includes(found);
            const isPlayerUnit = found.ownerId === 1;

            if (isDoubleClick && isPlayerUnit) {
                // --- 더블 클릭: 화면 내 동일 타입 유닛 일괄 선택 ---
                const viewL = -this.camera.x / this.camera.zoom;
                const viewT = -this.camera.y / this.camera.zoom;
                const viewR = viewL + this.canvas.width / this.camera.zoom;
                const viewB = viewT + this.canvas.height / this.camera.zoom;

                this.selectedEntities = this.entities.units.filter(u => {
                    if (u.ownerId !== 1 || u.type !== found.type || !u.active || u.isBoarded) return false;
                    // 화면 범위 내에 있는지 확인
                    return u.x >= viewL && u.x <= viewR && u.y >= viewT && u.y <= viewB;
                });
                this.selectedEntity = found;
            } else if (isEnemy) {
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
            ...this.entities.units.filter(u => u.ownerId === 1 && u.type !== 'carrier-drone')
        ];

        const selectedUnits = [];
        potentialEntities.forEach(ent => {
            if (!ent || (!ent.active && !ent.isBoarded) || ent.isBoarded) return;

            // [시야 체크] 아군 외 유닛은 시야 내에 있을 때만 멀티 선택 가능
            const isAlly = (ent.ownerId === 1);
            if (!isAlly && this.tileMap && !this.tileMap.isInSight(ent.x, ent.y) && !(this.debugSystem?.isFullVision)) {
                return;
            }

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

        if (this.tileMap) {
            // 1. 기본 시야(Fog of War) 체크
            if (!this.tileMap.isInSight(hovered.x, hovered.y) && !(this.debugSystem?.isFullVision)) {
                const isAlly = (hovered.ownerId === 1);
                if (!isAlly) {
                    this.hideUITooltip();
                    return;
                }
            }
        }

        let title = hovered.name || hovered.type;
        const isEnemy = this.entities.enemies.includes(hovered);
        if (isEnemy) title = `[적] ${title}`;

        let desc = '<div class="item-stats-box">';
        desc += `<div class="stat-row"><span>❤️ 체력:</span> <span class="highlight">${Math.floor(hovered.hp)} / ${hovered.maxHp}</span></div>`;

        if (hovered.population !== undefined) {
            desc += `<div class="stat-row"><span>👥 인원:</span> <span class="highlight">${hovered.population}명</span></div>`;
        }

        const armorNames = { infantry: '보병용', light: '경장갑', heavy: '중장갑' };
        const weaponNames = { bullet: '소구경', sniper: '정밀저격', shell: '고폭포탄', missile: '대기갑/대전차', fire: '화염/자폭' };
        
        if (hovered.armorType) {
            desc += `<div class="stat-row"><span>🛡️ 장갑:</span> <span class="highlight">${armorNames[hovered.armorType] || hovered.armorType}</span></div>`;
        }
        if (hovered.weaponType) {
            desc += `<div class="stat-row"><span>🔫 무기:</span> <span class="highlight">${weaponNames[hovered.weaponType] || hovered.weaponType}</span></div>`;
        }

        // 데미지 표시: 기본 데미지가 있거나 폭격기인 경우
        const displayDmg = (hovered.type === 'bomber') ? 300 : hovered.damage;
        if (displayDmg > 0) {
            desc += `<div class="stat-row"><span>⚔️ 공격력:</span> <span class="highlight">${displayDmg}</span></div>`;
        }
        
        const displayRange = hovered.attackRange || hovered.range;
        if (displayRange > 0) {
            desc += `<div class="stat-row"><span>🔭 사거리:</span> <span class="highlight">${displayRange}</span></div>`;
        }
        if (hovered.visionRange !== undefined) {
            desc += `<div class="stat-row"><span>👁️ 시야:</span> <span class="highlight">${hovered.visionRange}</span></div>`;
        }
        if (hovered.sizeCategoryName) {
            desc += `<div class="stat-row"><span>📏 체급:</span> <span class="highlight">${hovered.sizeCategoryName}</span></div>`;
        }
        
        // [리팩토링] 수송 점유 칸수 필수 표시
        const sizeText = (hovered.cargoSize >= 99) ? '수송 불가' : `${hovered.cargoSize}칸`;
        desc += `<div class="stat-row"><span>📦 점유:</span> <span class="highlight">${sizeText}</span></div>`;

        if (hovered.speed > 0) {
            desc += `<div class="stat-row"><span>🏃 속도:</span> <span class="highlight">${hovered.speed}</span></div>`;
        }
        if (hovered.type?.startsWith('ammo-') && hovered.amount !== undefined) {
            desc += `<div class="stat-row full-width"><span>📦 남은 탄약:</span> <span class="highlight">${Math.ceil(hovered.amount)} / ${hovered.maxAmount}</span></div>`;
        }
        if (hovered.type === 'drone-truck' && hovered.droneCount !== undefined) {
            const colorClass = (hovered.droneCount <= 0) ? 'text-red' : 'highlight';
            desc += `<div class="stat-row"><span>🐝 드론 재고:</span> <span class="${colorClass}">${hovered.droneCount} / ${hovered.maxDroneCount}</span></div>`;
        }
        if (hovered.cargoCapacity > 0 && hovered.type !== 'drone-truck') {
            const occupied = hovered.getOccupiedSize ? hovered.getOccupiedSize() : (hovered.cargo ? hovered.cargo.length : 0);
            desc += `<div class="stat-row"><span>📦 적재량:</span> <span class="highlight">${occupied} / ${hovered.cargoCapacity}</span></div>`;
            if (hovered.cargo && hovered.cargo.length > 0) {
                const cargoNames = hovered.cargo.map(u => u.name).join(', ');
                desc += `<div class="stat-row full-width text-blue" style="font-size: 0.75rem;">탑승: ${cargoNames}</div>`;
            }
        }
        if (hovered.maxAmmo > 0) {
            const ammoNames = { bullet: '총알', shell: '포탄', missile: '미사일', 'nuclear-missile': '핵미사일' };
            const name = ammoNames[hovered.ammoType] || '탄약';
            const colorClass = (hovered.ammo <= 0) ? 'text-red' : 'highlight';
            desc += `<div class="stat-row"><span>🔋 ${name}:</span> <span class="${colorClass}">${Math.floor(hovered.ammo)} / ${hovered.maxAmmo}</span></div>`;
        }
        if (hovered.type === 'medic' && hovered.maxEnergy > 0) {
            const colorClass = (hovered.energy <= 0) ? 'text-red' : 'highlight';
            desc += `<div class="stat-row"><span>⚡ 활력:</span> <span class="${colorClass}">${Math.floor(hovered.energy)} / ${hovered.maxEnergy}</span></div>`;
        }
        if (hovered.domain) {
            const domainMap = { ground: '지상', air: '공중', sea: '해상' };
            desc += `<div class="stat-row"><span>🌐 영역:</span> <span class="highlight">${domainMap[hovered.domain] || hovered.domain}</span></div>`;
        }

        // [추가] 공격 방식 (직사/곡사) 표시
        if (hovered.damage > 0) {
            const attackMethod = hovered.isIndirect ? '곡사' : '직사';
            desc += `<div class="stat-row"><span>🎯 방식:</span> <span class="highlight">${attackMethod}</span></div>`;
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

    update(deltaTime) {
        if (this.gameState === GameState.MENU) return;
        
        if (this.gameState === GameState.EDITOR) {
            // 에디터에서는 외곽 스크롤 비활성화 (사용자 요청)
            return;
        }

        if (this.gameState !== GameState.PLAYING) return;

        this.frameCount = (this.frameCount || 0) + 1;

        // --- 천장 구역 예약 갱신 처리 ---
        if (this.tileMap && this.tileMap.shouldUpdateRooms) {
            this.tileMap.updateRoomIds();
            this.tileMap.shouldUpdateRooms = false;
            this.updateVisibility(); // 구역이 변했으므로 시야도 즉시 갱신
        }

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

        const processList = (list) => {
            if (!list) return list;
            let writeIdx = 0;
            let countChanged = false;

                        for (let readIdx = 0; readIdx < list.length; readIdx++) {
                            const obj = list[readIdx];
                            // [수정] update 호출 제거 (EntityManager에서 수행함)
                            
                            let keep = true;
                            if (!obj.isBoarded) {
                                if (obj.hp <= 0 || obj.active === false) {
                                    keep = false;
                                    
                                    // 민심 시스템 반영
                                    if (obj.hp <= 0) { // 파괴된 경우에만 (비활성화 제외)
                                        const isAlly = (obj.ownerId === 1);
                                        const isEnemy = (obj.ownerId === 2);
            
                                        if (isAlly) {
                                            // 아군 손실: 민심 하락 (인구수가 1 이상인 경우에만)
                                            const pop = obj.population || 0;
                                            if (pop > 0) {
                                                const penalty = -pop;
                                                this.updateSentiment(penalty);
                                                this.addEffect('system', obj.x, obj.y - 20, '#ff3131', `민심 하락 ${penalty}`);
                                            }
                                        } else if (isEnemy) {
                                            // 적군 처치: 민심 상승 (승전보 효과)
                                            this.updateSentiment(2);
                                            this.addEffect('system', obj.x, obj.y - 20, '#39ff14', `민심 상승 +2`);
                                        }
                                    }
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
            }
            return list;
        };

        this.entities.units = processList(this.entities.units);
        this.entities.neutral = processList(this.entities.neutral);
        
        // [ECS 최적화] 투사체 업데이트는 entityManager.update(deltaTime) 내의 ECS 시스템에서 일괄 처리됨

        this.entities.enemies = this.entities.enemies.filter(enemy => {
            // [수정] update 호출 제거
            if (!enemy.active || enemy.hp <= 0) {
                return false;
            }
            return true;
        });

        this.refreshFlyerUI();
    }

    render() {
        if (this.gameState === GameState.EDITOR) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.save();
            this.ctx.translate(this.camera.x, this.camera.y);
            this.ctx.scale(this.camera.zoom, this.camera.zoom);
            this.mapEditor.render(this.ctx);
            this.ctx.restore();
            return;
        }

        if (this.renderSystem) {
            this.renderSystem.render();
            this.ctx.save();
            this.ctx.translate(this.camera.x, this.camera.y);
            this.ctx.scale(this.camera.zoom, this.camera.zoom);
            
            // ECS 엔티티 일괄 렌더링 (투사체 등)
            renderECS(this.entityManager.ecsWorld, this.ctx, this);

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
            if (!this.tileMap.grid[g.y] || !this.tileMap.grid[g.y][g.x]) return false;
            
            const tile = this.tileMap.grid[g.y][g.x];
            // [안개 시스템] 디버그 모드가 아닐 때, 현재 시야(inSight) 내에 있는 것만 미니맵에 표시
            return (this.debugSystem?.isFullVision) ? tile.visible : tile.inSight;
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

        const viewX = -this.camera.x / this.camera.zoom;
        const viewY = -this.camera.y / this.camera.zoom;
        const viewW = this.canvas.width / this.camera.zoom;
        const viewH = this.canvas.height / this.camera.zoom;

        mCtx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        mCtx.lineWidth = 15;
        mCtx.strokeRect(viewX, viewY, viewW, viewH);
        mCtx.restore();
    }

    _revealArea(worldX, worldY, radius, isAirUnit = false) {
        const grid = this.tileMap.worldToGrid(worldX, worldY);
        const sourceTile = this.tileMap.grid[grid.y]?.[grid.x];
        const sourceHasCeiling = sourceTile && this.tileMap.layers.ceiling[grid.y]?.[grid.x]?.id && sourceTile.ceilingHp > 0;
        const radiusSq = radius * radius;
        
        for (let dy = -radius; dy <= radius; dy++) {
            const ny = grid.y + dy;
            if (ny < 0 || ny >= this.tileMap.rows) continue;
            
            for (let dx = -radius; dx <= radius; dx++) {
                const nx = grid.x + dx;
                if (nx < 0 || nx >= this.tileMap.cols) continue;
                
                if (dx * dx + dy * dy <= radiusSq) {
                    const tile = this.tileMap.grid[ny][nx];
                    const targetHasCeiling = this.tileMap.layers.ceiling[ny][nx]?.id && tile.ceilingHp > 0;

                    // 1. 탐사 여부(visible)는 항상 true (지붕이라도 발견해야 하므로)
                    tile.visible = true;

                    // 2. 실시간 시야(inSight) 판정
                    
                    // [수정] 천장 내부 판정 로직 강화
                    if (targetHasCeiling) {
                        // 공중 유닛은 천장 내부를 절대 볼 수 없음 (지붕 위를 비행)
                        if (isAirUnit) continue;

                        // 지상 유닛이 외부에 있다면 천장 내부를 볼 수 없음
                        if (!sourceHasCeiling) continue;

                        // 지상 유닛이 내부에 있더라도, 다른 방(roomId)인 경우 차단 (벽 투시 방지)
                        if (sourceTile.roomId !== tile.roomId) continue;
                    }
                    
                    tile.inSight = true;
                }
            }
        }
    }

    updateVisibility() {
        if (!this.tileMap) return;
        if (this.debugSystem && this.debugSystem.isFullVision) return;

        const grid = this.tileMap.grid;
        const rows = this.tileMap.rows;
        const cols = this.tileMap.cols;

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                if (grid[y] && grid[y][x]) {
                    grid[y][x].inSight = false;
                }
            }
        }

        // [추가] 스폰 지점 주변 시야 상시 확보 (유닛 없어도 보임)
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const wall = this.tileMap.layers.wall[y][x];
                if (wall && wall.id === 'spawn-point') {
                    const worldPos = this.tileMap.gridToWorld(x, y);
                    this._revealArea(worldPos.x, worldPos.y, 8); // 8타일 반경 시야 제공
                }
            }
        }

        this.entities.units.forEach(unit => {
            // [수정] 살아있고, 활성 상태이며, 탑승 중이 아닌 유닛만 시야를 밝힘
            if (unit.alive && unit.active && !unit.isBoarded) {
                const relation = this.getRelation(1, unit.ownerId);
                if (relation === 'self' || relation === 'ally') {
                    // [수정] 도메인이 air이거나 고도가 조금이라도 있으면 공중 유닛으로 판정
                    const isAir = (unit.domain === 'air' || (unit.altitude !== undefined && unit.altitude > 0.01));

                    // 1. 일반 시야 반경 확보
                    this._revealArea(unit.x, unit.y, unit.visionRange || 5, isAir);

                    // 2. 구역(Room) 시야 확보: 천장 아래에 있으면 구역 전체 공개 (공중 유닛 제외)
                    if (!isAir) {
                        const g = this.tileMap.worldToGrid(unit.x, unit.y);
                        const roomId = this.tileMap.grid[g.y]?.[g.x]?.roomId;
                        if (roomId) {
                            this.tileMap.revealRoom(roomId);
                        }
                    }
                }
            }
        });

        if (this.tileMap.updateFogCanvas) {
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

    refreshFlyerUI() {
        const selectedFlyer = this.selectedEntities.find(ent => ent.type === 'bomber' || ent.type === 'cargo-plane' || ent.type === 'helicopter');
        if (selectedFlyer) {
            const isFlying = selectedFlyer.altitude > 0.8;
            const isManeuvering = selectedFlyer.isTakeoffStarting || selectedFlyer.isManualLanding || selectedFlyer.isTransitioning;
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

            // 타겟 하이라이트 (중복 방지를 위해 Set 사용)
            const targetsToHighlight = new Set();
            this.selectedEntities.forEach(selUnit => {
                const mTarget = selUnit.manualTarget;
                if (mTarget && mTarget.active && mTarget.hp > 0) {
                    targetsToHighlight.add(mTarget);
                }
                if ((selUnit.type === 'missile-launcher' || selUnit.type === 'icbm-launcher') && selUnit.isFiring && selUnit.pendingFirePos) {
                    const fireTarget = [...this.entities.enemies, ...this.entities.neutral].find(ent =>
                        ent.active && Math.hypot(ent.x - selUnit.pendingFirePos.x, ent.y - selUnit.pendingFirePos.y) < 60
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
                // [시야 체크] 아군 외 타겟은 시야 내에 있을 때만 하이라이트 표시
                const isAlly = (target.ownerId === 1);
                if (!isAlly && this.tileMap && !this.tileMap.isInSight(target.x, target.y) && !(this.debugSystem?.isFullVision)) {
                    return;
                }

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