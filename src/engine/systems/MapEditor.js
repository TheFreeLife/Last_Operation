export class MapEditor {
    constructor(engine) {
        this.engine = engine;
        this.active = false;
        this.currentLayer = 'floor'; // 'floor', 'wall', 'unit'
        this.selectedItem = null;
        
        // 무한 캔버스를 위한 Map 구조 (Key: "x,y")
        this.layers = {
            floor: new Map(),
            wall: new Map(),
            unit: new Map()
        };

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
        const tabs = document.querySelectorAll('.palette-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.setLayer(tab.dataset.layer);
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
            });
        });

        document.getElementById('editor-save-btn')?.addEventListener('click', () => this.showExportModal());
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
        
        // 초기 카메라 위치를 중앙으로
        this.engine.camera.zoom = 1.0;
        this.engine.camera.x = this.engine.canvas.width / 2;
        this.engine.camera.y = this.engine.canvas.height / 2;
    }

    deactivate() {
        this.active = false;
    }

    setLayer(layer) {
        this.currentLayer = layer;
        const layerDisplay = document.getElementById('current-layer-name');
        if (layerDisplay) layerDisplay.textContent = `Layer: ${layer.charAt(0).toUpperCase() + layer.slice(1)}`;
        this.updatePalette();
    }

    updatePalette() {
        const grid = document.getElementById('palette-items');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        // 지우개 추가
        const eraser = document.createElement('div');
        eraser.className = 'palette-item';
        eraser.textContent = '❌';
        eraser.title = '삭제';
        eraser.onclick = () => this.selectItem(null, eraser);
        grid.appendChild(eraser);

        this.palette[this.currentLayer].forEach(item => {
            const el = document.createElement('div');
            el.className = 'palette-item';
            el.textContent = item.icon;
            el.title = item.name;
            el.onclick = () => this.selectItem(item, el);
            grid.appendChild(el);
            
            if (this.selectedItem && this.selectedItem.id === item.id) {
                el.classList.add('active');
            }
        });
    }

    selectItem(item, element) {
        this.selectedItem = item;
        document.querySelectorAll('.palette-item').forEach(el => el.classList.remove('active'));
        element.classList.add('active');
    }

    handleInput(worldX, worldY, isClick, isRightClick) {
        if (!this.active) return;

        const gridX = Math.floor(worldX / this.engine.tileMap.tileSize);
        const gridY = Math.floor(worldY / this.engine.tileMap.tileSize);
        const key = `${gridX},${gridY}`;

        const coordsDisplay = document.getElementById('mouse-coords');
        if (coordsDisplay) coordsDisplay.textContent = `${gridX}, ${gridY}`;

        if (isClick) {
            if (isRightClick) {
                this.layers[this.currentLayer].delete(key);
            } else {
                if (this.selectedItem) {
                    this.layers[this.currentLayer].set(key, { ...this.selectedItem });
                } else {
                    this.layers[this.currentLayer].delete(key);
                }
            }
        }
    }

    showExportModal() {
        const modal = document.getElementById('export-modal');
        const textarea = document.getElementById('export-textarea');
        
        // 설치된 모든 타일의 범위 계산
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let hasData = false;

        for (const layerName in this.layers) {
            for (const key of this.layers[layerName].keys()) {
                const [x, y] = key.split(',').map(Number);
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
                hasData = true;
            }
        }

        if (!hasData) {
            alert('설치된 타일이 없습니다!');
            return;
        }

        const width = maxX - minX + 1;
        const height = maxY - minY + 1;

        // 단일 그리드 배열 생성 [floor, wall, unit]
        const exportGrid = Array.from({ length: height }, () => 
            Array.from({ length: width }, () => [null, null, null])
        );

        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const key = `${x},${y}`;
                const localX = x - minX;
                const localY = y - minY;

                const floor = this.layers.floor.get(key);
                const wall = this.layers.wall.get(key);
                const unit = this.layers.unit.get(key);

                exportGrid[localY][localX] = [
                    floor ? floor.id : 'dirt',
                    wall ? wall.id : null,
                    unit ? { id: unit.id, ownerId: unit.ownerId } : null
                ];
            }
        }
        
        const exportData = {
            width: width,
            height: height,
            tileSize: this.engine.tileMap.tileSize,
            grid: exportGrid
        };
        
        // 가독성과 압축을 동시에 잡는 커스텀 포맷팅
        const jsonHeader = `{\n  "width": ${width},\n  "height": ${height},\n  "tileSize": ${this.engine.tileMap.tileSize},\n  "grid": [\n`;
        const jsonFooter = '\n  ]\n}';
        const jsonBody = exportGrid.map(row => `    ${JSON.stringify(row)}`).join(',\n');
        
        textarea.value = jsonHeader + jsonBody + jsonFooter;
        modal.classList.remove('hidden');
    }

    render(ctx) {
        const tileSize = this.engine.tileMap.tileSize;
        const canvas = this.engine.canvas;

        // 0. 배경 전체 블랙
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        // 1. 가이드 그리드 (무한 느낌을 주기 위해 카메라 주변에만 그림)
        const camera = this.engine.camera;
        const viewL = -camera.x / camera.zoom;
        const viewT = -camera.y / camera.zoom;
        const viewR = viewL + canvas.width / camera.zoom;
        const viewB = viewT + canvas.height / camera.zoom;

        const startX = Math.floor(viewL / tileSize);
        const endX = Math.ceil(viewR / tileSize);
        const startY = Math.floor(viewT / tileSize);
        const endY = Math.ceil(viewB / tileSize);

        ctx.strokeStyle = '#111111';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = startX; x <= endX; x++) {
            ctx.moveTo(x * tileSize, viewT);
            ctx.lineTo(x * tileSize, viewB);
        }
        for (let y = startY; y <= endY; y++) {
            ctx.moveTo(viewL, y * tileSize);
            ctx.lineTo(viewR, y * tileSize);
        }
        ctx.stroke();

        // 2. 레이어 렌더링 (순서: floor -> wall -> unit)
        ['floor', 'wall', 'unit'].forEach(layerName => {
            const layer = this.layers[layerName];
            if (layerName === 'unit') ctx.globalAlpha = 0.8;
            
            // 보이는 영역만 렌더링 최적화
            for (let y = startY; y <= endY; y++) {
                for (let x = startX; x <= endX; x++) {
                    const key = `${x},${y}`;
                    const item = layer.get(key);
                    if (item) {
                        if (layerName === 'floor') {
                            ctx.fillStyle = this.getTileColor(item.id || item);
                            ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
                        } else {
                            this.drawEditorItem(ctx, item, x, y);
                        }
                    }
                }
            }
            ctx.globalAlpha = 1.0;
        });

        // 3. 마우스 호버 가이드
        const mouseWorldX = (camera.mouseX - camera.x) / camera.zoom;
        const mouseWorldY = (camera.mouseY - camera.y) / camera.zoom;
        const mouseGridX = Math.floor(mouseWorldX / tileSize);
        const mouseGridY = Math.floor(mouseWorldY / tileSize);
        
        ctx.strokeStyle = 'rgba(0, 210, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(mouseGridX * tileSize, mouseGridY * tileSize, tileSize, tileSize);
        
        if (this.selectedItem) {
            ctx.globalAlpha = 0.4;
            this.drawEditorItem(ctx, this.selectedItem, mouseGridX, mouseGridY);
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
        
        // 아이콘 찾기 (팔레트 데이터 참조)
        let icon = typeof item === 'object' ? item.icon : null;
        if (!icon) {
            for (const category in this.palette) {
                const found = this.palette[category].find(p => p.id === itemId);
                if (found) {
                    icon = found.icon;
                    break;
                }
            }
        }

        ctx.font = `${tileSize * 0.7}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon || '?', x * tileSize + tileSize/2, y * tileSize + tileSize/2);
    }
}