export class MapEditor {
    constructor(engine) {
        this.engine = engine;
        this.active = false;
        this.currentLayer = 'floor'; 
        this.currentTool = 'pencil'; 
        this.selectedItem = null;
        this.currentRotation = 0; // 0, 1, 2, 3 (90도 단위)
        this.currentOwnerId = 2; // 기본 소유자 (Enemy)
        this.showCeiling = true; // 천장 표시 여부 토글
        
        // 카드 시스템 관련
        this.availableCards = [];
        this.enabledCardIds = new Set(); // 선택된 카드 ID 저장
        
        // 유닛 드로잉을 위한 임시 인스턴스 저장소 (캐시)
        this.dummyUnits = new Map();

        this.layers = {
            floor: new Map(),
            wall: new Map(),
            unit: new Map(),
            ceiling: new Map()
        };

        this.isDrawing = false;
        this.startPos = { x: 0, y: 0 };
        this.endPos = { x: 0, y: 0 };

        this.palette = {
            floor: {
                '자연': [
                    { id: 'dirt', name: '흙', rotatable: false },
                    { id: 'grass', name: '풀', rotatable: false },
                    { id: 'sand', name: '모래', rotatable: false },
                    { id: 'snow', name: '눈', rotatable: false },
                    { id: 'water', name: '물', rotatable: false }
                ],
                '인프라': [
                    { id: 'asphalt', name: '아스팔트', rotatable: false },
                    { id: 'concrete', name: '콘크리트', rotatable: false },
                    { id: 'metal-plate', name: '금속판', rotatable: true },
                    { id: 'sidewalk', name: '인도', rotatable: true },
                    { id: 'tactile-paving', name: '유도 블록', rotatable: true },
                    { id: 'brick-floor', name: '벽돌 바닥', rotatable: true }
                ],
                '도로': [
                    { id: 'curb-edge', name: '경계석', rotatable: true },
                    { id: 'curb-h', name: '가로 경계석', rotatable: true },
                    { id: 'curb-v', name: '세로 경계석', rotatable: true },
                    { id: 'road-line-white', name: '도로 흰선', rotatable: true },
                    { id: 'road-line-yellow', name: '도로 황선', rotatable: true },
                    { id: 'crosswalk', name: '횡단보도', rotatable: true }
                ],
                '공항': [
                    { id: 'runway', name: '활주로', rotatable: true },
                    { id: 'runway-edge', name: '활주로 경계', rotatable: true },
                    { id: 'taxiway', name: '유도로', rotatable: true },
                    { id: 'container-floor', name: '컨테이너 바닥', rotatable: false }
                ]
            },
            wall: {
                '건물': [
                    { id: 'stone-wall', name: '석재 벽', rotatable: true },
                    { id: 'brick-wall', name: '벽돌 벽', rotatable: true },
                    { id: 'concrete-wall', name: '콘크리트 벽', rotatable: true },
                    { id: 'container-wall', name: '컨테이너 벽', rotatable: true },
                    { id: 'container-wall-corner', name: '컨테이너 모서리', rotatable: true },
                    { id: 'container-door', name: '컨테이너 문', rotatable: true },
                    { id: 'control-tower', name: '관제탑', rotatable: false }
                ],
                '자연물': [
                    { id: 'tree', name: '나무', rotatable: false },
                    { id: 'rock', name: '바위', rotatable: true }
                ],
                '철도': [
                    { id: 'rail-straight', name: '직선 철도', rotatable: true },
                    { id: 'rail-corner', name: '모서리 철도', rotatable: true }
                ],
                '방어/시설': [
                    { id: 'fence', name: '울타리', rotatable: true },
                    { id: 'fence-corner', name: '울타리 모서리', rotatable: true },
                    { id: 'sandbag', name: '모래주머니', rotatable: true },
                    { id: 'barricade', name: '바리케이드', rotatable: true },
                    { id: 'airport-fence', name: '보안 펜스', rotatable: true },
                    { id: 'airport-fence-corner', name: '보안 펜스 모서리', rotatable: true },
                    { id: 'street-lamp', name: '가로등', rotatable: false },
                    { id: 'hydrant', name: '소화전', rotatable: false },
                    { id: 'trash-can', name: '쓰레기통', rotatable: true },
                    { id: 'radar', name: '레이더', rotatable: false },
                    { id: 'spawn-point', name: '스폰 지점', rotatable: true }
                ]
            },
            unit: {},
            ceiling: {
                '천장/지붕': [
                    { id: 'concrete-roof', name: '콘크리트 지붕', rotatable: true },
                    { id: 'metal-roof', name: '금속 지붕', rotatable: true },
                    { id: 'wooden-roof', name: '목재 지붕', rotatable: true },
                    { id: 'container-roof', name: '컨테이너 지붕', rotatable: true }
                ]
            }
        };

        this.initUI();
        this.initKeyListeners();
    }

    initKeyListeners() {
        window.addEventListener('keydown', (e) => {
            if (!this.active) return;
            
            // [추가] 입력 창에 포커스가 있는 경우 단축키 무시
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
                return;
            }

            if (e.key.toLowerCase() === 'r') {
                if (this.selectedItem && this.selectedItem.rotatable !== false) {
                    this.currentRotation = (this.currentRotation + 1) % 4;
                } else {
                    this.currentRotation = 0;
                }
            }
            if (e.key.toLowerCase() === 'h') {
                this.toggleCeilingVisibility();
            }
        });
    }

    syncPaletteWithEngine() {
        if (!this.engine.entityManager) return;
        const engineItems = this.engine.entityManager.getPlaceableItems();
        
        // 유닛 카테고리별 그룹화
        this.palette.unit = {
            '보병': engineItems.filter(item => item.category === 'infantry'),
            '차량': engineItems.filter(item => item.category === 'vehicle'),
            '해상': engineItems.filter(item => item.category === 'sea'),
            '항공': engineItems.filter(item => item.category === 'air'),
            '군수': engineItems.filter(item => item.category === 'logistics'),
            '아이템': engineItems.filter(item => item.category === 'item')
        };
        
        // 더미 유닛 인스턴스 생성 (드로잉용)
        const allUnits = [
            ...this.palette.unit['보병'],
            ...this.palette.unit['차량'],
            ...this.palette.unit['해상'],
            ...this.palette.unit['항공'],
            ...this.palette.unit['군수'],
            ...this.palette.unit['아이템']
        ];

        allUnits.forEach(item => {
            if (!this.dummyUnits.has(item.id)) {
                const registration = this.engine.entityManager.registry.get(item.id);
                if (registration) {
                    const unit = new registration.EntityClass(0, 0, this.engine);
                    if (item.options) Object.assign(unit, item.options);
                    unit.ownerId = item.ownerId;
                    this.dummyUnits.set(`${item.id}_${JSON.stringify(item.options || {})}`, unit);
                }
            }
        });
    }

    updateStatusUI() {
        const toolEl = document.getElementById('selected-tool-name');
        const itemEl = document.getElementById('selected-item-name');
        if (toolEl) toolEl.textContent = this.currentTool;
        if (itemEl) {
            let itemName = this.selectedItem ? this.selectedItem.name : 'None';
            if (this.selectedItem && this.selectedItem.options?.ammoType) {
                itemName += ` (${this.selectedItem.options.ammoType})`;
            }
            itemEl.textContent = itemName;
        }
    }

    initUI() {
        const toolBtns = document.querySelectorAll('.tool-btn, .sub-tool-btn');
        const mainShapeBtn = document.getElementById('shape-tool-main');

        // AI 상태 변경 시 반경 입력 필드 가시성 제어
        document.getElementById('config-ai-state')?.addEventListener('change', (e) => {
            const radiusRow = document.getElementById('config-ai-radius-row');
            if (radiusRow) {
                radiusRow.style.display = 'none';
            }
        });

        toolBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.dataset.tool;
                if (!tool) return; // tool 데이터가 없는 버튼(토글 버튼 등)은 무시

                this.currentTool = tool;
                this.isDrawing = false;
                this.updateStatusUI();
                document.querySelectorAll('.tool-btn, .sub-tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (['rect', 'circle', 'triangle'].includes(tool)) {
                    if (mainShapeBtn) mainShapeBtn.classList.add('active');
                } else {
                    if (mainShapeBtn) mainShapeBtn.classList.remove('active');
                }
            });
        });

        // 천장 토글 버튼 초기 상태 설정
        const toggleCeilingBtn = document.getElementById('toggle-ceiling-btn');
        if (toggleCeilingBtn) {
            toggleCeilingBtn.classList.toggle('active', this.showCeiling);
            toggleCeilingBtn.addEventListener('click', (e) => {
                this.toggleCeilingVisibility();
            });
        }

        const tabs = document.querySelectorAll('.palette-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.setLayer(tab.dataset.layer);
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
            });
        });

        // Owner Selector Buttons
        const ownerBtns = document.querySelectorAll('.owner-btn');
        ownerBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentOwnerId = parseInt(btn.dataset.owner);
                ownerBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        document.getElementById('editor-save-btn')?.addEventListener('click', () => this.exportToSidebar());
        document.getElementById('sidebar-import-btn')?.addEventListener('click', () => this.importFromSidebar());
        document.getElementById('editor-test-btn')?.addEventListener('click', () => this.testCurrentMap());
        document.getElementById('editor-clear-btn')?.addEventListener('click', () => this.clearCanvas());
        document.getElementById('sidebar-copy-btn')?.addEventListener('click', () => {
            const area = document.getElementById('sidebar-data-area');
            area.select();
            document.execCommand('copy');
            alert('복사되었습니다!');
        });
        document.getElementById('editor-exit-btn')?.addEventListener('click', () => this.engine.setGameState('MENU'));

        // Mission Cards Modal
        this.missionCardsModal = document.getElementById('mission-cards-modal');
        document.getElementById('editor-mission-cards-btn')?.addEventListener('click', () => {
            this.missionCardsModal.classList.remove('hidden');
        });
        document.getElementById('cards-save-btn')?.addEventListener('click', () => {
            this.missionCardsModal.classList.add('hidden');
        });

        // Unit Config Modal
        this.configModal = document.getElementById('unit-config-modal');
        this.configSaveBtn = document.getElementById('config-save-btn');
        this.configDeleteBtn = document.getElementById('config-delete-btn');
        this.configCancelBtn = document.getElementById('config-cancel-btn');

        this.configSaveBtn?.addEventListener('click', () => this.saveUnitConfig());
        this.configDeleteBtn?.addEventListener('click', () => this.deleteCurrentUnit());
        this.configCancelBtn?.addEventListener('click', () => this.closeUnitConfig());
        
        // 모달창 클릭 시 캔버스 이벤트 전파 방지
        this.configModal?.addEventListener('mousedown', (e) => e.stopPropagation());
        this.configModal?.addEventListener('click', (e) => e.stopPropagation());
        
        // 미션 카드 모달 전파 방지
        this.missionCardsModal?.addEventListener('mousedown', (e) => e.stopPropagation());
        this.missionCardsModal?.addEventListener('click', (e) => e.stopPropagation());

        // 미션 카드 리스트 초기화
        this.initMissionCardsUI();
    }

    async initMissionCardsUI() {
        const listEl = document.getElementById('mission-cards-list');
        if (!listEl) return;

        try {
            const response = await fetch('./data/deployment_cards.json');
            const data = await response.json();
            this.availableCards = data.cards || [];

            listEl.innerHTML = '';
            this.availableCards.forEach(card => {
                const item = document.createElement('label');
                item.className = 'mission-card-item';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = card.id;
                // 기본적으로 모든 카드를 활성화 상태로 시작 (편의성)
                checkbox.checked = true;
                this.enabledCardIds.add(card.id);

                checkbox.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        this.enabledCardIds.add(card.id);
                        item.classList.add('active');
                    } else {
                        this.enabledCardIds.delete(card.id);
                        item.classList.remove('active');
                    }
                });

                item.appendChild(checkbox);
                
                const name = document.createElement('span');
                name.textContent = `${card.icon} ${card.name}`;
                item.appendChild(name);

                if (checkbox.checked) item.classList.add('active');
                listEl.appendChild(item);
            });
        } catch (e) {
            console.error('Failed to load deployment cards for editor:', e);
        }
    }

    deleteCurrentUnit() {
        if (this.editingUnitKey) {
            this.layers.unit.delete(this.editingUnitKey);
            this.closeUnitConfig();
        }
    }

    openUnitConfig(key, data) {
        this.editingUnitKey = key;
        const nameDisplay = document.getElementById('config-unit-name');
        if (nameDisplay) nameDisplay.textContent = data.id.toUpperCase() + ' CONFIG';

        // stats 객체가 있으면 거기서 기본값을 가져옴
        const stats = data.stats || {};

        document.getElementById('config-owner').value = (data.ownerId !== undefined) ? data.ownerId : 1;
        document.getElementById('config-hp').value = (data.hp !== undefined) ? data.hp : (stats.hp !== undefined ? stats.hp : 100);
        document.getElementById('config-damage').value = (data.damage !== undefined) ? data.damage : (stats.damage !== undefined ? stats.damage : 0);
        document.getElementById('config-speed').value = (data.speed !== undefined) ? data.speed : (stats.speed !== undefined ? stats.speed : 0);
        document.getElementById('config-ammo').value = (data.ammo !== undefined) ? data.ammo : (stats.ammo !== undefined ? stats.ammo : 0);
        document.getElementById('config-rotation').value = (data.r !== undefined) ? data.r : 0;
        document.getElementById('config-ai-state').value = data.aiState || 'guard';
        document.getElementById('config-ai-radius').value = (data.aiRadius !== undefined) ? data.aiRadius : 300;
        document.getElementById('config-options').value = data.options ? JSON.stringify(data.options) : '';

        // 초기 가시성 설정
        const radiusRow = document.getElementById('config-ai-radius-row');
        if (radiusRow) {
            radiusRow.style.display = 'none';
        }

        this.configModal.classList.remove('hidden');

        // [추가] 숫자 입력 필드 포커스 시 전체 선택 (빠른 수정 용도)
        const numInputs = this.configModal.querySelectorAll('input[type="number"]');
        numInputs.forEach(input => {
            input.addEventListener('focus', () => input.select());
        });
    }

    saveUnitConfig() {
        if (!this.editingUnitKey) return;
        
        const ownerId = parseInt(document.getElementById('config-owner').value);
        const hp = parseInt(document.getElementById('config-hp').value);
        const damage = parseInt(document.getElementById('config-damage').value);
        const speed = parseFloat(document.getElementById('config-speed').value);
        const ammo = parseInt(document.getElementById('config-ammo').value);
        const rotation = parseInt(document.getElementById('config-rotation').value);
        const aiState = document.getElementById('config-ai-state').value;
        const aiRadius = parseInt(document.getElementById('config-ai-radius').value);
        const optionsStr = document.getElementById('config-options').value;
        
        let options = null;
        if (optionsStr.trim()) {
            try {
                options = JSON.parse(optionsStr);
            } catch (e) {
                alert('JSON 형식이 올바르지 않습니다.');
                return;
            }
        }

        const unitData = this.layers.unit.get(this.editingUnitKey);
        if (unitData) {
            unitData.ownerId = ownerId;
            unitData.hp = hp;
            unitData.damage = damage;
            unitData.speed = speed;
            unitData.ammo = ammo;
            unitData.r = rotation;
            unitData.aiState = aiState;
            unitData.aiRadius = aiRadius;
            unitData.options = options;

            // stats 객체도 업데이트하여 최신 상태 유지
            if (!unitData.stats) unitData.stats = {};
            unitData.stats.hp = hp;
            unitData.stats.maxHp = hp;
            unitData.stats.damage = damage;
            unitData.stats.speed = speed;
            unitData.stats.ammo = ammo;
        }

        this.closeUnitConfig();
    }

    closeUnitConfig() {
        this.configModal.classList.add('hidden');
        this.editingUnitKey = null;
    }

    toggleCeilingVisibility() {
        this.showCeiling = !this.showCeiling;
        const btn = document.getElementById('toggle-ceiling-btn');
        if (btn) {
            btn.classList.toggle('active', this.showCeiling);
        }
        console.log(`[MapEditor] Show Ceiling: ${this.showCeiling}`);
    }

    clearCanvas() {
        if (!confirm('정말 맵을 초기화하시겠습니까? 모든 데이터가 삭제됩니다.')) return;
        
        // 모든 맵 레이어 비우기
        this.layers.floor.clear();
        this.layers.wall.clear();
        this.layers.unit.clear();
        
        // 텍스트 영역 비우기
        const area = document.getElementById('sidebar-data-area');
        if (area) area.value = '';
        
        console.log('[MapEditor] Canvas cleared.');
    }

    activate() {
        this.active = true;
        this.syncPaletteWithEngine();
        
        // [수정] 이전에 선택된 레이어를 유지 (초기값은 floor)
        this.setLayer(this.currentLayer);
        
        // [추가] UI 탭 활성 상태 동기화
        const tabs = document.querySelectorAll('.palette-tab');
        tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.layer === this.currentLayer);
        });

        this.updateStatusUI();
        
        this.engine.camera.zoom = 1.0;
        this.engine.camera.x = this.engine.canvas.width / 2 - 400; 
        this.engine.camera.y = this.engine.canvas.height / 2;
    }

    deactivate() { this.active = false; }

    setLayer(layer) {
        this.currentLayer = layer;
        this.selectedItem = null; // 레이어 변경 시 선택된 아이템 초기화 (오배치 방지)
        const layerDisplay = document.getElementById('current-layer-name');
        if (layerDisplay) layerDisplay.textContent = layer.toUpperCase();
        
        // 유닛 레이어인 경우에만 소유자 선택기 강조
        const ownerSelector = document.getElementById('editor-owner-selector');
        if (ownerSelector) {
            ownerSelector.style.opacity = (layer === 'unit') ? '1' : '0.4';
            ownerSelector.style.pointerEvents = (layer === 'unit') ? 'auto' : 'none';
        }

        this.updatePalette();
    }

    updatePalette() {
        const grid = document.getElementById('palette-items');
        if (!grid) return;
        grid.innerHTML = '';
        
        const categories = this.palette[this.currentLayer];
        
        for (const [categoryName, items] of Object.entries(categories)) {
            if (items.length === 0) continue;

            // 카테고리 헤더 추가
            const header = document.createElement('div');
            header.className = 'palette-category-header';
            header.textContent = categoryName;
            grid.appendChild(header);

            // 아이템 그리드 컨테이너 (그리드 내부의 그리드 느낌)
            const subGrid = document.createElement('div');
            subGrid.className = 'palette-subgrid';

            items.forEach(item => {
                const el = document.createElement('div');
                el.className = 'palette-item-container';
                
                const preview = document.createElement('canvas');
                preview.width = 60;
                preview.height = 60;
                el.appendChild(preview);
                
                const label = document.createElement('div');
                label.className = 'palette-label';
                label.textContent = item.name;
                el.appendChild(label);

                this.renderPalettePreview(preview, item);

                el.onclick = () => this.selectItem(item, el);
                subGrid.appendChild(el);
                
                if (this.selectedItem && this.selectedItem.id === item.id) {
                    if (!item.options || (this.selectedItem.options && item.options.ammoType === this.selectedItem.options.ammoType)) {
                        el.classList.add('active');
                    }
                }
            });
            grid.appendChild(subGrid);
        }
    }

    renderPalettePreview(canvas, item) {
        const ctx = canvas.getContext('2d');
        const ts = 50;
        if (this.currentLayer === 'floor') {
            this.engine.tileMap.drawTileTexture(ctx, 5, 5, item.id, 0);
        } else if (this.currentLayer === 'wall') {
            const config = this.engine.tileMap.wallRegistry[item.id];
            if (config && config.isTall) {
                ctx.save();
                ctx.translate(30, 45); // 관제탑 상단이 보이도록 중심점을 아래로 이동
                ctx.scale(0.4, 0.4);   // 전체 높이가 60px 안에 들어오도록 축소
                config.render(ctx, ts, -ts/2, -ts/2);
                ctx.restore();
            } else {
                this.engine.tileMap.drawSingleWall(ctx, item.id, 5, 5, ts, 0);
            }
        } else if (this.currentLayer === 'ceiling') {
            this.engine.tileMap.drawSingleCeiling(ctx, item.id, 5, 5, ts, 0);
        } else {
            const dummy = this.dummyUnits.get(`${item.id}_${JSON.stringify(item.options || {})}`);
            if (dummy) {
                ctx.save();
                ctx.translate(30, 30); ctx.scale(0.6, 0.6);
                dummy.draw(ctx);
                ctx.restore();
            }
        }
    }

    selectItem(item, element) {
        if (this.selectedItem && this.selectedItem.id === item?.id && 
            JSON.stringify(this.selectedItem.options) === JSON.stringify(item?.options)) {
            this.selectedItem = null;
            this.currentRotation = 0;
            document.querySelectorAll('.palette-item-container').forEach(el => el.classList.remove('active'));
        } else {
            this.selectedItem = item;
            // 회전 불가능한 타일이면 강제로 0도 고정, 가능하면 이전 회전 유지 혹은 초기화 (여기서는 사용자 편의를 위해 초기화)
            this.currentRotation = 0; 
            document.querySelectorAll('.palette-item-container').forEach(el => el.classList.remove('active'));
            if (element) element.classList.add('active');
        }
        this.updateStatusUI();
    }

    handleInput(worldX, worldY, isMouseDown, isRightClick) {
        if (!this.active) return;
        const tileSize = this.engine.tileMap.tileSize;
        const gridX = Math.floor(worldX / tileSize);
        const gridY = Math.floor(worldY / tileSize);
        const key = `${gridX},${gridY}`;

        document.getElementById('mouse-coords').textContent = `${gridX}, ${gridY} | R: ${this.currentRotation * 90}°`;

        if (isRightClick) {
            if (this.currentLayer === 'unit') {
                const unit = this.layers.unit.get(key);
                if (unit) {
                    this.openUnitConfig(key, unit);
                }
            }
            // 일반 레이어에서 우클릭 시 즉시 삭제 로직 제거 (화면 이동 충돌 방지)
            return;
        }

        if (isMouseDown) {
            if (!this.isDrawing) {
                this.isDrawing = true;
                this.startPos = { x: gridX, y: gridY };
                if (this.currentTool === 'fill') {
                    this.floodFill(gridX, gridY);
                    this.isDrawing = false;
                }
            }
            this.endPos = { x: gridX, y: gridY };
            if (this.currentTool === 'pencil') this.applyToTile(gridX, gridY);
            else if (this.currentTool === 'eraser') {
                const wasCeiling = this.layers.ceiling.has(key);
                this.layers[this.currentLayer].delete(key);
                // [추가] 삭제 시에도 유동장 갱신
                if (this.currentLayer === 'wall') {
                    const gridCell = this.engine.tileMap.grid[gridY]?.[gridX];
                    if (gridCell) {
                        gridCell.occupied = false;
                        gridCell.passable = true;
                        this.engine.tileMap.layers.wall[gridY][gridX] = null;
                    }
                    this.engine.flowField.updateAllCostMaps();
                    this.engine.enemyFlowField.updateAllCostMaps();
                } else if (this.currentLayer === 'ceiling') {
                    const gridCell = this.engine.tileMap.grid[gridY]?.[gridX];
                    if (gridCell) {
                        gridCell.ceilingHp = 0;
                        gridCell.ceilingMaxHp = 0;
                        this.engine.tileMap.layers.ceiling[gridY][gridX] = null;
                    }
                    this.engine.tileMap.updateRoomIds();
                }
            }
        } else {
            if (this.isDrawing) {
                if (['rect', 'circle', 'triangle'].includes(this.currentTool)) this.commitShape();
                this.isDrawing = false;
            }
        }
    }

    getUnitDefaults(type) {
        const registration = this.engine.entityManager.registry.get(type);
        if (!registration) return {};
        
        const { EntityClass } = registration;
        // 임시 인스턴스 생성하여 기본값 추출
        const temp = new EntityClass(0, 0, this.engine);
        
        return {
            hp: temp.hp || 100,
            maxHp: temp.maxHp || 100,
            damage: temp.damage || 0,
            attackRange: temp.attackRange || 0,
            visionRange: temp.visionRange || 5,
            speed: temp.speed || 1,
            ammo: temp.ammo || 0,
            maxAmmo: temp.maxAmmo || 0,
            population: temp.population || 1,
            name: temp.name || type
        };
    }

    applyToTile(x, y) {
        if (!this.selectedItem) return;
        const tileMap = this.engine.tileMap;

        // [추가] 스폰 지점(spawn-point)은 3x3 크기이며 맵에 하나만 존재해야 함
        if (this.selectedItem.id === 'spawn-point') {
            // 1. 기존 스폰 지점 전체(9타일)를 찾아 완벽히 제거
            this.layers.wall.forEach((val, key) => {
                if (val.id === 'spawn-point') {
                    const [oldX, oldY] = key.split(',').map(Number);
                    this.layers.wall.delete(key);
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const gx = oldX + dx, gy = oldY + dy;
                            const oldGrid = tileMap.grid[gy]?.[gx];
                            if (oldGrid) {
                                if (dx === 0 && dy === 0) tileMap.layers.wall[gy][gx] = null;
                                oldGrid.buildable = true;
                                oldGrid.occupied = false;
                                oldGrid.passable = (oldGrid.terrain !== 'water');
                            }
                        }
                    }
                }
            });

            // 2. 새로운 3x3 영역 설정 (범위 체크 생략 - 맵 끝단 주의)
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const gx = x + dx, gy = y + dy;
                    const gridCell = tileMap.grid[gy]?.[gx];
                    if (gridCell) {
                        gridCell.buildable = false;
                        gridCell.occupied = false;
                        gridCell.passable = true;
                    }
                }
            }
        }

        const data = { 
            id: this.selectedItem.id, 
            r: this.currentRotation,
            options: this.selectedItem.options,
            ownerId: (this.currentLayer === 'unit') ? this.currentOwnerId : undefined
        };

        // [추가] 유닛인 경우 기본 스탯 포함
        if (this.currentLayer === 'unit') {
            const defaults = this.getUnitDefaults(this.selectedItem.id);
            data.stats = defaults;
        }
        
        this.layers[this.currentLayer].set(`${x},${y}`, data);

        // [수정] TileMap 데이터 즉시 동기화
        const gridCell = tileMap.grid[y]?.[x];
        if (gridCell) {
            if (this.currentLayer === 'floor') {
                tileMap.updateTile(x, y, data.id, data.r);
            } else if (this.currentLayer === 'wall') {
                tileMap.layers.wall[y][x] = { id: data.id, r: data.r };
                const maxHp = tileMap.getWallMaxHp(data.id);
                const wallConfig = tileMap.wallRegistry[data.id];
                gridCell.hp = maxHp;
                gridCell.maxHp = maxHp;
                
                if (data.id !== 'spawn-point' && !wallConfig?.isPassable) {
                    gridCell.occupied = true;
                    gridCell.passable = false;
                } else {
                    gridCell.occupied = false;
                    gridCell.passable = true;
                }
                
                // [추가] 장애물 배치 시 모든 유동장 비용 맵 갱신
                this.engine.flowField.updateAllCostMaps();
                this.engine.enemyFlowField.updateAllCostMaps();
            } else if (this.currentLayer === 'ceiling') {
                tileMap.layers.ceiling[y][x] = { id: data.id, r: data.r };
                const maxHp = tileMap.ceilingRegistry[data.id]?.maxHp || 100;
                gridCell.ceilingHp = maxHp;
                gridCell.ceilingMaxHp = maxHp;
                tileMap.updateRoomIds(); // 룸 ID 즉시 갱신
            }
        }
    }

    floodFill(startX, startY) {
        if (!this.selectedItem) return;
        const layer = this.layers[this.currentLayer];
        const targetValue = layer.get(`${startX},${startY}`)?.id || null;
        const newValue = this.selectedItem.id;
        if (targetValue === newValue) return;
        const queue = [[startX, startY]], visited = new Set(), limit = 5000;
        while (queue.length > 0 && visited.size < limit) {
            const [x, y] = queue.shift(), key = `${x},${y}`;
            if (visited.has(key)) continue;
            visited.add(key);
            if ((layer.get(key)?.id || null) === targetValue) {
                this.applyToTile(x, y);
                queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
            }
        }
    }

    commitShape() {
        this.getShapePoints(this.startPos, this.endPos, this.currentTool).forEach(p => this.applyToTile(p.x, p.y));
    }

    getShapePoints(start, end, tool) {
        const points = [];
        const x1 = Math.min(start.x, end.x), x2 = Math.max(start.x, end.x);
        const y1 = Math.min(start.y, end.y), y2 = Math.max(start.y, end.y);
        if (tool === 'rect') {
            for (let x = x1; x <= x2; x++) for (let y = y1; y <= y2; y++) points.push({ x, y });
        } else if (tool === 'circle') {
            const cx = (start.x + end.x) / 2, cy = (start.y + end.y) / 2, r = Math.hypot(end.x - start.x, end.y - start.y) / 2;
            for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) 
                for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); iy++)
                    if (Math.hypot(x - cx, y - cy) <= r) points.push({ x, y });
        } else if (tool === 'triangle') {
            const mx = Math.floor((start.x + end.x) / 2);
            for (let y = y1; y <= y2; y++) {
                const rw = Math.floor(((y - y1) / (y2 - y1)) * (x2 - x1) / 2);
                for (let x = mx - rw; x <= mx + rw; x++) points.push({ x, y });
            }
        }
        return points;
    }

    render(ctx) {
        const tileSize = this.engine.tileMap.tileSize;
        const canvas = this.engine.canvas;
        const camera = this.engine.camera;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        const viewL = -camera.x / camera.zoom, viewT = -camera.y / camera.zoom;
        const viewR = viewL + canvas.width / camera.zoom, viewB = viewT + canvas.height / camera.zoom;
        const sX = Math.floor(viewL / tileSize), eX = Math.ceil(viewR / tileSize);
        const sY = Math.floor(viewT / tileSize), eY = Math.ceil(viewB / tileSize);

        // 그리드
        ctx.strokeStyle = '#151515';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = sX; x <= eX; x++) { ctx.moveTo(x * tileSize, viewT); ctx.lineTo(x * tileSize, viewB); }
        for (let y = sY; y <= eY; y++) { ctx.moveTo(viewL, y * tileSize); ctx.lineTo(viewR, y * tileSize); }
        ctx.stroke();

        // 실물 렌더링
        ['floor', 'wall', 'ceiling', 'unit'].forEach(layerName => {
            if (layerName === 'ceiling' && !this.showCeiling) return;

            this.layers[layerName].forEach((item, key) => {
                const [x, y] = key.split(',').map(Number);
                if (x >= sX && x <= eX && y >= sY && y <= eY) {
                    this.drawActualItem(ctx, item, x, y, layerName);
                }
            });
        });

        // 고스트 및 프리뷰
        const mWorldX = (camera.mouseX - camera.x) / camera.zoom;
        const mWorldY = (camera.mouseY - camera.y) / camera.zoom;
        const mGX = Math.floor(mWorldX / tileSize), mGY = Math.floor(mWorldY / tileSize);

        if (this.isDrawing && ['rect', 'circle', 'triangle'].includes(this.currentTool)) {
            ctx.fillStyle = 'rgba(0, 210, 255, 0.2)';
            this.getShapePoints(this.startPos, this.endPos, this.currentTool).forEach(p => ctx.fillRect(p.x * tileSize, p.y * tileSize, tileSize, tileSize));
        }

        if (this.selectedItem && !this.isDrawing) {
            ctx.globalAlpha = 0.5;
            const isLarge = this.selectedItem.id === 'spawn-point';
            if (isLarge) {
                ctx.strokeStyle = '#00d2ff';
                ctx.lineWidth = 2;
                ctx.strokeRect((mGX-1) * tileSize, (mGY-1) * tileSize, tileSize * 3, tileSize * 3);
            }
            const previewData = { ...this.selectedItem, r: this.currentRotation };
            if (this.currentLayer === 'unit') {
                previewData.ownerId = this.currentOwnerId;
            }
            this.drawActualItem(ctx, previewData, mGX, mGY, this.currentLayer);
            ctx.globalAlpha = 1.0;
        }
        
        ctx.strokeStyle = 'rgba(0, 210, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(mGX * tileSize, mGY * tileSize, tileSize, tileSize);
    }

    drawActualItem(ctx, item, x, y, layer) {
        const tileSize = this.engine.tileMap.tileSize;
        const wx = x * tileSize, wy = y * tileSize;
        const cx = wx + tileSize / 2, cy = wy + tileSize / 2;
        const r = item.r || 0;

        if (layer === 'floor') {
            this.engine.tileMap.drawTileTexture(ctx, wx, wy, item.id || item, r);
        } else if (layer === 'wall') {
            this.engine.tileMap.drawSingleWall(ctx, item.id || item, wx, wy, tileSize, r);
        } else if (layer === 'ceiling') {
            this.engine.tileMap.drawSingleCeiling(ctx, item.id || item, wx, wy, tileSize, r);
        } else {
            const dummy = this.dummyUnits.get(`${item.id}_${JSON.stringify(item.options || {})}`);
            if (dummy) {
                ctx.save();
                ctx.translate(cx, cy);
                
                // 소유자별 색상 설정
                let ownerColor = 'rgba(0, 255, 0, 0.2)'; // 기본 아군 (Player 1)
                if (item.ownerId === 2) ownerColor = 'rgba(255, 0, 0, 0.3)'; // 적군
                else if (item.ownerId === 0) ownerColor = 'rgba(200, 200, 200, 0.3)'; // 중립
                
                ctx.fillStyle = ownerColor;
                ctx.beginPath(); ctx.arc(0, 0, tileSize/2.5, 0, Math.PI*2); ctx.fill();
                
                ctx.rotate((r * 90) * Math.PI / 180);
                dummy.draw(ctx);
                ctx.restore();
            }
        }
    }

    exportToSidebar() {
        const area = document.getElementById('sidebar-data-area');
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, hasData = false;
        for (const ln in this.layers) {
            this.layers[ln].forEach((v, k) => {
                const [x, y] = k.split(',').map(Number);
                minX = Math.min(minX, x); minY = Math.min(minY, y);
                maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
                hasData = true;
            });
        }
        if (!hasData) return;
        const w = maxX - minX + 1, h = maxY - minY + 1;
        const grid = Array.from({ length: h }, () => Array.from({ length: w }, () => [null, null, null]));
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const k = `${x},${y}`, lx = x - minX, ly = y - minY;
                const f = this.layers.floor.get(k), wl = this.layers.wall.get(k), u = this.layers.unit.get(k), c = this.layers.ceiling.get(k);
                // [ [id, rotation], [id, rotation], unitData, [id, rotation] ]
                grid[ly][lx] = [
                    f ? [f.id, f.r || 0] : 'dirt',
                    wl ? [wl.id, wl.r || 0] : null,
                    u ? { 
                        id: u.id, 
                        ownerId: u.ownerId, 
                        r: u.r || 0, 
                        stats: u.stats,
                        aiState: u.aiState, 
                        aiRadius: u.aiRadius, 
                        options: u.options 
                    } : null,
                    c ? [c.id, c.r || 0] : null
                ];
            }
        }
        const header = `{\n  "width": ${w},\n  "height": ${h},\n  "tileSize": ${this.engine.tileMap.tileSize},\n  "enabledCards": ${JSON.stringify(Array.from(this.enabledCardIds))},\n  "grid": [\n`;
        const body = grid.map(row => `    ${JSON.stringify(row)}`).join(',\n');
        area.value = header + body + '\n  ]\n}';
    }

    importFromSidebar() {
        const area = document.getElementById('sidebar-data-area');
        try {
            const data = JSON.parse(area.value);
            this.layers.floor.clear(); this.layers.wall.clear(); this.layers.unit.clear();
            
            // [추가] 활성화된 카드 정보 복구
            if (data.enabledCards && Array.isArray(data.enabledCards)) {
                this.enabledCardIds = new Set(data.enabledCards);
                // UI 체크박스 갱신
                const listEl = document.getElementById('mission-cards-list');
                const checkboxes = listEl.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach(cb => {
                    cb.checked = this.enabledCardIds.has(cb.value);
                    const item = cb.closest('.mission-card-item');
                    if (item) item.classList.toggle('active', cb.checked);
                });
            }

            data.grid.forEach((row, y) => {
                row.forEach((cell, x) => {
                    const k = `${x},${y}`, [f, wl, u, c] = cell;
                    const parse = (d) => {
                        if (!d) return null;
                        if (typeof d === 'string') return { id: d, r: 0 };
                        if (Array.isArray(d)) return { id: d[0], r: d[1] || 0 };
                        return d;
                    };
                    if (f) this.layers.floor.set(k, parse(f));
                    if (wl) this.layers.wall.set(k, parse(wl));
                    if (u) this.layers.unit.set(k, u);
                    if (c) this.layers.ceiling.set(k, parse(c));
                });
            });
            this.syncPaletteWithEngine();
            this.engine.camera.x = this.engine.canvas.width / 2 - (data.width * this.engine.tileMap.tileSize) / 2 - 160;
            this.engine.camera.y = this.engine.canvas.height / 2 - (data.height * this.engine.tileMap.tileSize) / 2;
        } catch (e) { alert("형식이 올바르지 않습니다."); }
    }

    async testCurrentMap() {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, hasData = false;
        for (const ln in this.layers) {
            this.layers[ln].forEach((v, k) => {
                const [x, y] = k.split(',').map(Number);
                minX = Math.min(minX, x); minY = Math.min(minY, y);
                maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
                hasData = true;
            });
        }
        if (!hasData) return;
        const w = maxX - minX + 1, h = maxY - minY + 1;
        const grid = Array.from({ length: h }, () => Array.from({ length: w }, () => [null, null, null]));
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const k = `${x},${y}`, lx = x - minX, ly = y - minY;
                const f = this.layers.floor.get(k), wl = this.layers.wall.get(k), u = this.layers.unit.get(k), c = this.layers.ceiling.get(k);
                grid[ly][lx] = [
                    f ? [f.id, f.r || 0] : 'dirt',
                    wl ? [wl.id, wl.r || 0] : null,
                    u ? { id: u.id, ownerId: u.ownerId, r: u.r || 0, hp: u.hp || 100, aiState: u.aiState, aiRadius: u.aiRadius, options: u.options } : null,
                    c ? [c.id, c.r || 0] : null
                ];
            }
        }
        this.engine.isMouseDown = false; this.engine.isRightMouseDown = false; this.engine.isTestMode = true;
        const success = await this.engine.loadMission({ 
            name: 'Test', 
            data: { 
                width: w, 
                height: h, 
                tileSize: this.engine.tileMap.tileSize, 
                enabledCards: Array.from(this.enabledCardIds),
                grid: grid 
            } 
        });
        if (success) this.engine.setGameState('PLAYING');
    }
}