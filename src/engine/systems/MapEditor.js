import { EDITOR_ICONS } from '../../assets/EditorIcons.js';

export class MapEditor {
    constructor(engine) {
        this.engine = engine;
        this.active = false;
        this.currentLayer = 'floor'; 
        this.currentTool = 'pencil'; 
        this.selectedItem = null;
        
        // 유닛 드로잉을 위한 임시 인스턴스 저장소 (캐시)
        this.dummyUnits = new Map();

        this.layers = {
            floor: new Map(),
            wall: new Map(),
            unit: new Map()
        };

        this.isDrawing = false;
        this.startPos = { x: 0, y: 0 };
        this.endPos = { x: 0, y: 0 };

        this.palette = {
            floor: [
                { id: 'dirt', name: '흙' },
                { id: 'grass', name: '풀' },
                { id: 'sand', name: '모래' },
                { id: 'water', name: '물' },
                { id: 'asphalt', name: '아스팔트' },
                { id: 'concrete', name: '콘크리트' },
                { id: 'metal-plate', name: '금속판' },
                { id: 'sidewalk', name: '인도' },
                { id: 'tactile-paving', name: '유도 블록' },
                { id: 'brick-floor', name: '벽돌 바닥' },
                { id: 'curb-edge', name: '경계석' },
                { id: 'curb-h', name: '가로 경계석' },
                { id: 'curb-v', name: '세로 경계석' },
                { id: 'road-line-white', name: '도로 흰선' },
                { id: 'road-line-yellow', name: '도로 황선' },
                { id: 'crosswalk', name: '횡단보도' }
            ],
            wall: [
                { id: 'stone-wall', name: '석재 벽' },
                { id: 'brick-wall', name: '벽돌 벽' },
                { id: 'concrete-wall', name: '콘크리트 벽' },
                { id: 'tree', name: '나무' },
                { id: 'rock', name: '바위' },
                { id: 'fence', name: '울타리' },
                { id: 'sandbag', name: '모래주머니' },
                { id: 'barricade', name: '바리케이드' },
                { id: 'street-lamp', name: '가로등' },
                { id: 'hydrant', name: '소화전' },
                { id: 'trash-can', name: '쓰레기통' }
            ],
            unit: []
        };

        this.initUI();
    }

    syncPaletteWithEngine() {
        if (!this.engine.entityManager) return;
        const engineItems = this.engine.entityManager.getPlaceableItems();
        this.palette.unit = engineItems.filter(item => item.category === 'unit');
        
        // 더미 유닛 인스턴스 생성 (드로잉용)
        this.palette.unit.forEach(item => {
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

    initUI() {
        const toolBtns = document.querySelectorAll('.tool-btn, .sub-tool-btn');
        const mainShapeBtn = document.getElementById('shape-tool-main');

        toolBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.dataset.tool;
                this.currentTool = tool;
                this.isDrawing = false;
                document.querySelectorAll('.tool-btn, .sub-tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (['rect', 'circle', 'triangle'].includes(tool)) {
                    if (mainShapeBtn) mainShapeBtn.classList.add('active');
                } else {
                    if (mainShapeBtn) mainShapeBtn.classList.remove('active');
                }
            });
        });

        const tabs = document.querySelectorAll('.palette-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.setLayer(tab.dataset.layer);
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
            });
        });

        document.getElementById('editor-save-btn')?.addEventListener('click', () => this.exportToSidebar());
        document.getElementById('sidebar-import-btn')?.addEventListener('click', () => this.importFromSidebar());
        document.getElementById('editor-test-btn')?.addEventListener('click', () => this.testCurrentMap());
        document.getElementById('sidebar-copy-btn')?.addEventListener('click', () => {
            const area = document.getElementById('sidebar-data-area');
            area.select();
            document.execCommand('copy');
            alert('복사되었습니다!');
        });
        document.getElementById('editor-exit-btn')?.addEventListener('click', () => this.engine.setGameState('MENU'));
    }

    activate() {
        this.active = true;
        this.syncPaletteWithEngine();
        this.setLayer('floor');
        
        this.engine.camera.zoom = 1.0;
        this.engine.camera.x = this.engine.canvas.width / 2 - 400; 
        this.engine.camera.y = this.engine.canvas.height / 2;
    }

    deactivate() { this.active = false; }

    setLayer(layer) {
        this.currentLayer = layer;
        const layerDisplay = document.getElementById('current-layer-name');
        if (layerDisplay) layerDisplay.textContent = layer.toUpperCase();
        this.updatePalette();
    }

    updatePalette() {
        const grid = document.getElementById('palette-items');
        if (!grid) return;
        grid.innerHTML = '';
        
        const items = this.palette[this.currentLayer];
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
            grid.appendChild(el);
            
            if (this.selectedItem && this.selectedItem.id === item.id) {
                if (!item.options || (this.selectedItem.options && item.options.ammoType === this.selectedItem.options.ammoType)) {
                    el.classList.add('active');
                }
            }
        });
    }

    renderPalettePreview(canvas, item) {
        const ctx = canvas.getContext('2d');
        const mid = canvas.width / 2;
        
        if (this.currentLayer === 'floor') {
            this.engine.tileMap.drawTileTexture(ctx, 5, 5, item.id);
            // 크기 보정 (팔레트 미리보기는 50x50 영역 권장)
            // drawTileTexture가 이미 그렸으므로 추가 작업 불필요
        } else if (this.currentLayer === 'wall') {
            this.engine.tileMap.drawSingleWall(ctx, item.id, 5, 5, 50);
        } else {
            // 유닛 실물 렌더링
            const dummy = this.dummyUnits.get(`${item.id}_${JSON.stringify(item.options || {})}`);
            if (dummy) {
                ctx.translate(mid, mid);
                ctx.scale(0.6, 0.6); // 팔레트 크기에 맞춤
                dummy.draw(ctx);
            }
        }
    }

    selectItem(item, element) {
        if (this.selectedItem && this.selectedItem.id === item?.id && 
            JSON.stringify(this.selectedItem.options) === JSON.stringify(item?.options)) {
            this.selectedItem = null;
            document.querySelectorAll('.palette-item-container').forEach(el => el.classList.remove('active'));
        } else {
            this.selectedItem = item;
            document.querySelectorAll('.palette-item-container').forEach(el => el.classList.remove('active'));
            if (element) element.classList.add('active');
        }
    }

    handleInput(worldX, worldY, isMouseDown, isRightClick) {
        if (!this.active) return;
        const tileSize = this.engine.tileMap.tileSize;
        const gridX = Math.floor(worldX / tileSize);
        const gridY = Math.floor(worldY / tileSize);
        const key = `${gridX},${gridY}`;

        document.getElementById('mouse-coords').textContent = `${gridX}, ${gridY}`;

        if (isRightClick) {
            this.layers[this.currentLayer].delete(key);
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
            else if (this.currentTool === 'eraser') this.layers[this.currentLayer].delete(key);
        } else {
            if (this.isDrawing) {
                if (['rect', 'circle', 'triangle'].includes(this.currentTool)) this.commitShape();
                this.isDrawing = false;
            }
        }
    }

    applyToTile(x, y) {
        if (!this.selectedItem) return;
        this.layers[this.currentLayer].set(`${x},${y}`, { ...this.selectedItem });
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
                for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
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
        ['floor', 'wall', 'unit'].forEach(layerName => {
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
            this.drawActualItem(ctx, this.selectedItem, mGX, mGY, this.currentLayer);
            ctx.globalAlpha = 1.0;
            // 사거리 가이드
            const dummy = this.dummyUnits.get(`${this.selectedItem.id}_${JSON.stringify(this.selectedItem.options || {})}`);
            if (dummy && dummy.attackRange) {
                ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.arc(mGX * tileSize + tileSize/2, mGY * tileSize + tileSize/2, dummy.attackRange, 0, Math.PI*2);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
        
        ctx.strokeStyle = 'rgba(0, 210, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(mGX * tileSize, mGY * tileSize, tileSize, tileSize);
    }

    drawActualItem(ctx, item, x, y, layer) {
        const tileSize = this.engine.tileMap.tileSize;
        const wx = x * tileSize, wy = y * tileSize;
        const cx = wx + tileSize / 2, cy = wy + tileSize / 2;

        if (layer === 'floor') {
            this.engine.tileMap.drawTileTexture(ctx, wx, wy, item.id || item);
        } else if (layer === 'wall') {
            this.engine.tileMap.drawSingleWall(ctx, item.id || item, wx, wy, tileSize);
        } else {
            const dummy = this.dummyUnits.get(`${item.id}_${JSON.stringify(item.options || {})}`);
            if (dummy) {
                ctx.save();
                ctx.translate(cx, cy);
                // 팀 컬러 인디케이터
                ctx.fillStyle = item.ownerId === 2 ? 'rgba(255,0,0,0.3)' : 'rgba(0,255,0,0.2)';
                ctx.beginPath(); ctx.arc(0, 0, tileSize/2.5, 0, Math.PI*2); ctx.fill();
                ctx.rotate(Math.PI/2);
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
                const f = this.layers.floor.get(k), wl = this.layers.wall.get(k), u = this.layers.unit.get(k);
                grid[ly][lx] = [f ? f.id : null, wl ? wl.id : null, u ? { id: u.id, ownerId: u.ownerId, options: u.options } : null];
            }
        }
        const header = `{\n  "width": ${w},\n  "height": ${h},\n  "tileSize": ${this.engine.tileMap.tileSize},\n  "grid": [\n`;
        const body = grid.map(row => `    ${JSON.stringify(row)}`).join(',\n');
        area.value = header + body + '\n  ]\n}';
    }

    importFromSidebar() {
        const area = document.getElementById('sidebar-data-area');
        try {
            const data = JSON.parse(area.value);
            this.layers.floor.clear(); this.layers.wall.clear(); this.layers.unit.clear();
            data.grid.forEach((row, y) => {
                row.forEach((cell, x) => {
                    const k = `${x},${y}`, [f, wl, u] = cell;
                    if (f) this.layers.floor.set(k, { id: f });
                    if (wl) this.layers.wall.set(k, { id: wl });
                    if (u) this.layers.unit.set(k, { id: u.id, ownerId: u.ownerId, options: u.options });
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
                const f = this.layers.floor.get(k), wl = this.layers.wall.get(k), u = this.layers.unit.get(k);
                grid[ly][lx] = [f ? f.id : 'dirt', wl ? wl.id : null, u ? { id: u.id, ownerId: u.ownerId, options: u.options } : null];
            }
        }
        this.engine.isMouseDown = false; this.engine.isRightMouseDown = false; this.engine.isTestMode = true;
        const success = await this.engine.loadMission({ name: 'Test', data: { width: w, height: h, tileSize: this.engine.tileMap.tileSize, grid: grid } });
        if (success) this.engine.setGameState('PLAYING');
    }
}