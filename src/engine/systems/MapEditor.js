export class MapEditor {
    constructor(engine) {
        this.engine = engine;
        this.active = false;
        this.currentLayer = 'floor'; 
        this.currentTool = 'pencil'; // 'pencil', 'eraser', 'fill', 'rect', 'circle', 'triangle'
        this.selectedItem = null;
        
        this.layers = {
            floor: new Map(),
            wall: new Map(),
            unit: new Map()
        };

        // 도형 그리기를 위한 상태
        this.isDrawing = false;
        this.startPos = { x: 0, y: 0 };
        this.endPos = { x: 0, y: 0 };

        this.palette = {
            floor: [
                { id: 'dirt', name: '흙', icon: '🟫' },
                { id: 'grass', name: '풀', icon: '🟩' },
                { id: 'sand', name: '모래', icon: '🟨' },
                { id: 'water', name: '물', icon: '🟦' }
            ],
            wall: [
                { id: 'stone-wall', name: '석재 벽', icon: '🧱' },
                { id: 'tree', name: '나무', icon: '🌳' },
                { id: 'rock', name: '바위', icon: '🪨' },
                { id: 'fence', name: '울타리', icon: '🚧' }
            ],
            unit: [
                { id: 'tank', name: '전차', icon: '🚜', ownerId: 1 },
                { id: 'rifleman', name: '보병', icon: '🔫', ownerId: 1 },
                { id: 'enemy', name: '적군', icon: '🔴', ownerId: 2 },
                { id: 'ammo-box', name: '탄약고', icon: '📦', ownerId: 1 }
            ]
        };

        this.initUI();
    }

    initUI() {
        // 도구 버튼 설정
        const toolBtns = document.querySelectorAll('.tool-btn, .sub-tool-btn');
        const mainShapeBtn = document.getElementById('shape-tool-main');

        toolBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.dataset.tool;
                this.currentTool = tool;
                this.isDrawing = false;

                // UI 업데이트
                document.querySelectorAll('.tool-btn, .sub-tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // 도형 도구인 경우 메인 버튼 활성화 상태 변경
                if (['rect', 'circle', 'triangle'].includes(tool)) {
                    if (mainShapeBtn) {
                        mainShapeBtn.classList.add('active');
                    }
                } else {
                    if (mainShapeBtn) mainShapeBtn.classList.remove('active');
                }
            });
        });

        // 레이어 탭 설정
        const tabs = document.querySelectorAll('.palette-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.setLayer(tab.dataset.layer);
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
            });
        });

        document.getElementById('editor-save-btn')?.addEventListener('click', () => this.showExportModal());
        document.getElementById('editor-exit-btn')?.addEventListener('click', () => this.engine.setGameState('MENU'));
        document.getElementById('close-export-btn')?.addEventListener('click', () => {
            document.getElementById('export-modal').classList.add('hidden');
        });
        document.getElementById('copy-json-btn')?.addEventListener('click', () => {
            const textarea = document.getElementById('export-textarea');
            textarea.select();
            document.execCommand('copy');
            alert('클립보드에 복사되었습니다!');
        });
    }

    activate() {
        this.active = true;
        this.setLayer('floor');
        this.updatePalette();
        
        this.engine.camera.zoom = 1.0;
        this.engine.camera.x = this.engine.canvas.width / 2 - 320/2; // 사이드바 고려
        this.engine.camera.y = this.engine.canvas.height / 2;
    }

    deactivate() {
        this.active = false;
    }

    setLayer(layer) {
        this.currentLayer = layer;
        const layerDisplay = document.getElementById('current-layer-name');
        if (layerDisplay) layerDisplay.textContent = layer.charAt(0).toUpperCase() + layer.slice(1);
        this.updatePalette();
    }

    updatePalette() {
        const grid = document.getElementById('palette-items');
        if (!grid) return;
        grid.innerHTML = '';
        
        this.palette[this.currentLayer].forEach(item => {
            const el = document.createElement('div');
            el.className = 'palette-item';
            el.textContent = item.icon;
            el.title = item.name;
            el.onclick = () => this.selectItem(item, el);
            grid.appendChild(el);
            if (this.selectedItem && this.selectedItem.id === item.id) el.classList.add('active');
        });
        if (!this.selectedItem && this.palette[this.currentLayer].length > 0) {
            this.selectItem(this.palette[this.currentLayer][0], grid.firstChild);
        }
    }

    selectItem(item, element) {
        if (this.selectedItem && this.selectedItem.id === item?.id) {
            // 이미 선택된 항목을 다시 누르면 선택 취소
            this.selectedItem = null;
            document.querySelectorAll('.palette-item').forEach(el => el.classList.remove('active'));
        } else {
            this.selectedItem = item;
            document.querySelectorAll('.palette-item').forEach(el => el.classList.remove('active'));
            if (element) element.classList.add('active');
        }
    }

    handleInput(worldX, worldY, isMouseDown, isRightClick) {
        if (!this.active) return;

        const gridX = Math.floor(worldX / this.engine.tileMap.tileSize);
        const gridY = Math.floor(worldY / this.engine.tileMap.tileSize);
        const key = `${gridX},${gridY}`;

        // 좌표 실시간 업데이트
        const coordsDisplay = document.getElementById('mouse-coords');
        if (coordsDisplay) coordsDisplay.textContent = `${gridX}, ${gridY}`;

        if (isRightClick) {
            this.layers[this.currentLayer].delete(key);
            return;
        }

        if (isMouseDown) {
            if (!this.isDrawing) {
                this.isDrawing = true;
                this.startPos = { x: gridX, y: gridY };
                
                // 클릭 즉시 실행되는 도구들
                if (this.currentTool === 'fill') {
                    this.floodFill(gridX, gridY);
                    this.isDrawing = false; // 채우기는 즉시 완료
                }
            }
            
            this.endPos = { x: gridX, y: gridY };

            // 드래그 중 실시간 반영되는 도구들
            if (this.currentTool === 'pencil') {
                this.applyToTile(gridX, gridY);
            } else if (this.currentTool === 'eraser') {
                this.layers[this.currentLayer].delete(key);
            }
        } else {
            // 마우스 버튼을 뗐을 때
            if (this.isDrawing) {
                if (['rect', 'circle', 'triangle'].includes(this.currentTool)) {
                    this.commitShape();
                }
                this.isDrawing = false;
            }
        }
    }

    applyToTile(x, y) {
        if (!this.selectedItem) return;
        const key = `${x},${y}`;
        this.layers[this.currentLayer].set(key, { ...this.selectedItem });
    }

    floodFill(startX, startY) {
        if (!this.selectedItem) return;
        const layer = this.layers[this.currentLayer];
        const targetValue = layer.get(`${startX},${startY}`)?.id || null;
        const newValue = this.selectedItem.id;
        
        if (targetValue === newValue) return;

        const queue = [[startX, startY]];
        const visited = new Set();
        const limit = 5000; // 안전 장치

        while (queue.length > 0 && visited.size < limit) {
            const [x, y] = queue.shift();
            const key = `${x},${y}`;

            if (visited.has(key)) continue;
            visited.add(key);

            const currentValue = layer.get(key)?.id || null;
            if (currentValue === targetValue) {
                this.applyToTile(x, y);
                queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
            }
        }
    }

    commitShape() {
        const points = this.getShapePoints(this.startPos, this.endPos, this.currentTool);
        points.forEach(p => this.applyToTile(p.x, p.y));
    }

    getShapePoints(start, end, tool) {
        const points = [];
        const x1 = Math.min(start.x, end.x);
        const x2 = Math.max(start.x, end.x);
        const y1 = Math.min(start.y, end.y);
        const y2 = Math.max(start.y, end.y);

        if (tool === 'rect') {
            for (let x = x1; x <= x2; x++) {
                for (let y = y1; y <= y2; y++) points.push({ x, y });
            }
        } else if (tool === 'circle') {
            const centerX = (start.x + end.x) / 2;
            const centerY = (start.y + end.y) / 2;
            const radius = Math.hypot(end.x - start.x, end.y - start.y) / 2;
            for (let x = Math.floor(centerX - radius); x <= Math.ceil(centerX + radius); x++) {
                for (let y = Math.floor(centerY - radius); y <= Math.ceil(centerY + radius); y++) {
                    if (Math.hypot(x - centerX, y - centerY) <= radius) points.push({ x, y });
                }
            }
        } else if (tool === 'triangle') {
            // 단순 수직 이등변 삼각형
            const midX = Math.floor((start.x + end.x) / 2);
            for (let y = y1; y <= y2; y++) {
                const rowWidth = Math.floor(((y - y1) / (y2 - y1)) * (x2 - x1) / 2);
                for (let x = midX - rowWidth; x <= midX + rowWidth; x++) points.push({ x, y });
            }
        }
        return points;
    }

    render(ctx) {
        const tileSize = this.engine.tileMap.tileSize;
        const canvas = this.engine.canvas;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        const camera = this.engine.camera;
        const viewL = -camera.x / camera.zoom;
        const viewT = -camera.y / camera.zoom;
        const viewR = viewL + canvas.width / camera.zoom;
        const viewB = viewT + canvas.height / camera.zoom;

        const startX = Math.floor(viewL / tileSize);
        const endX = Math.ceil(viewR / tileSize);
        const startY = Math.floor(viewT / tileSize);
        const endY = Math.ceil(viewB / tileSize);

        // 그리드 렌더링
        ctx.strokeStyle = '#111111';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = startX; x <= endX; x++) { ctx.moveTo(x * tileSize, viewT); ctx.lineTo(x * tileSize, viewB); }
        for (let y = startY; y <= endY; y++) { ctx.moveTo(viewL, y * tileSize); ctx.lineTo(viewR, y * tileSize); }
        ctx.stroke();

        // 레이어 렌더링
        ['floor', 'wall', 'unit'].forEach(layerName => {
            const layer = this.layers[layerName];
            if (layerName === 'unit') ctx.globalAlpha = 0.8;
            layer.forEach((item, key) => {
                const [x, y] = key.split(',').map(Number);
                if (x >= startX && x <= endX && y >= startY && y <= endY) {
                    if (layerName === 'floor') {
                        ctx.fillStyle = this.getTileColor(item.id || item);
                        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
                    } else {
                        this.drawEditorItem(ctx, item, x, y);
                    }
                }
            });
            ctx.globalAlpha = 1.0;
        });

        // 도형 그리기 프리뷰
        if (this.isDrawing && ['rect', 'circle', 'triangle'].includes(this.currentTool)) {
            const points = this.getShapePoints(this.startPos, this.endPos, this.currentTool);
            ctx.fillStyle = 'rgba(0, 210, 255, 0.3)';
            points.forEach(p => ctx.fillRect(p.x * tileSize, p.y * tileSize, tileSize, tileSize));
        }

        // 마우스 호버 가이드
        const mouseGrid = this.engine.tileMap.worldToGrid((camera.mouseX - camera.x) / camera.zoom, (camera.mouseY - camera.y) / camera.zoom);
        ctx.strokeStyle = 'rgba(0, 210, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(mouseGrid.x * tileSize, mouseGrid.y * tileSize, tileSize, tileSize);
        if (this.selectedItem && !this.isDrawing) {
            ctx.globalAlpha = 0.4;
            this.drawEditorItem(ctx, this.selectedItem, mouseGrid.x, mouseGrid.y);
            ctx.globalAlpha = 1.0;
        }
    }

    getTileColor(type) {
        switch(type) {
            case 'dirt': return '#4a3b31';
            case 'grass': return '#2d4d2d';
            case 'sand': return '#4d4d2d';
            case 'water': return '#2d4d6d';
            default: return '#333333';
        }
    }

    drawEditorItem(ctx, item, x, y) {
        const tileSize = this.engine.tileMap.tileSize;
        const itemId = typeof item === 'string' ? item : item.id;
        let icon = typeof item === 'object' ? item.icon : null;
        if (!icon) {
            for (const category in this.palette) {
                const found = this.palette[category].find(p => p.id === itemId);
                if (found) { icon = found.icon; break; }
            }
        }
        ctx.font = `${tileSize * 0.7}px Arial`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(icon || '?', x * tileSize + tileSize/2, y * tileSize + tileSize/2);
    }

    showExportModal() {
        const modal = document.getElementById('export-modal');
        const textarea = document.getElementById('export-textarea');
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let hasData = false;
        for (const ln in this.layers) {
            this.layers[ln].forEach((v, k) => {
                const [x, y] = k.split(',').map(Number);
                minX = Math.min(minX, x); minY = Math.min(minY, y);
                maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
                hasData = true;
            });
        }
        if (!hasData) return;
        const width = maxX - minX + 1, height = maxY - minY + 1;
        const exportGrid = Array.from({ length: height }, () => Array.from({ length: width }, () => ['dirt', null, null]));
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const k = `${x},${y}`, lx = x - minX, ly = y - minY;
                const f = this.layers.floor.get(k), w = this.layers.wall.get(k), u = this.layers.unit.get(k);
                exportGrid[ly][lx] = [f ? f.id : 'dirt', w ? w.id : null, u ? { id: u.id, ownerId: u.ownerId } : null];
            }
        }
        const jsonHeader = `{\n  "width": ${width},\n  "height": ${height},\n  "tileSize": ${this.engine.tileMap.tileSize},\n  "grid": [\n`;
        const jsonBody = exportGrid.map(row => `    ${JSON.stringify(row)}`).join(',\n');
        textarea.value = jsonHeader + jsonBody + '\n  ]\n}';
        modal.classList.remove('hidden');
    }
}
