export class DebugSystem {
    constructor(engine) {
        this.engine = engine;
        this.isGodMode = false;
        this.isFullVision = false;
        this.isSpawnSandbagMode = false;
        this.isSpawnAirSandbagMode = false;
        this.isEraserMode = false;
        this.spawnUnitType = null; // 현재 소환할 유닛 타입
        this.init();
    }

    init() {
        // UI 버튼 이벤트 바인딩
        document.getElementById('db-god-mode')?.addEventListener('click', () => this.toggleGodMode());
        document.getElementById('db-add-gold')?.addEventListener('click', () => this.addResources('gold', 10000));
        document.getElementById('db-add-oil')?.addEventListener('click', () => this.addResources('oil', 10000));
        document.getElementById('db-spawn-sandbag')?.addEventListener('click', () => this.toggleSpawnSandbagMode());
        document.getElementById('db-spawn-air-sandbag')?.addEventListener('click', () => this.toggleSpawnAirSandbagMode());
        document.getElementById('db-eraser')?.addEventListener('click', () => this.toggleEraserMode());
        document.getElementById('db-heal-all')?.addEventListener('click', () => this.healAll());
        document.getElementById('db-clear-fog')?.addEventListener('click', () => this.toggleFullVision());

        // 유닛 소환 버튼들
        this.unitTypeMap = {
            'db-spawn-tank': { type: 'tank' },
            'db-spawn-artillery': { type: 'artillery' },
            'db-spawn-anti-air': { type: 'anti-air' },
            'db-spawn-missile': { type: 'missile-launcher' },
            'db-spawn-rifleman': { type: 'rifleman' },
            'db-spawn-sniper': { type: 'sniper' },
            'db-spawn-engineer': { type: 'engineer' },
            'db-spawn-truck': { type: 'military-truck' },
            'db-spawn-bomber': { type: 'bomber' },
            'db-spawn-cargo-plane': { type: 'cargo-plane' },
            'db-spawn-scout-plane': { type: 'scout-plane' },
            'db-spawn-ammo-bullet': { type: 'ammo-box', options: { ammoType: 'bullet' } },
            'db-spawn-ammo-shell': { type: 'ammo-box', options: { ammoType: 'shell' } },
            'db-spawn-ammo-missile': { type: 'ammo-box', options: { ammoType: 'missile' } }
        };

        for (const id in this.unitTypeMap) {
            document.getElementById(id)?.addEventListener('click', () => this.toggleSpawnUnitMode(id));
        }

        console.log("[DebugSystem] Practice Tool Initialized");
    }

    toggleSpawnUnitMode(btnId) {
        const wasSameId = this.activeSpawnBtnId === btnId;
        this.engine.cancelModes?.();

        if (!wasSameId) {
            this.activeSpawnBtnId = btnId;
            this.spawnUnitType = this.unitTypeMap[btnId].type;
            this.spawnUnitOptions = this.unitTypeMap[btnId].options || {};
            
            const btn = document.getElementById(btnId);
            if (btn) btn.classList.add('active');
        } else {
            this.activeSpawnBtnId = null;
            this.spawnUnitType = null;
            this.spawnUnitOptions = null;
        }
    }

    executeSpawnUnit(worldX, worldY) {
        if (!this.spawnUnitType) return;

        const baseOptions = { ownerId: 1 };
        const finalOptions = Object.assign({}, baseOptions, this.spawnUnitOptions);

        const entity = this.engine.entityManager?.create(this.spawnUnitType, worldX, worldY, finalOptions);

        if (entity) {
            let label = entity.name || this.spawnUnitType;
            if (this.spawnUnitOptions?.ammoType) label += ` (${this.spawnUnitOptions.ammoType})`;
            this.engine.addEffect?.('system', worldX, worldY - 40, '#39ff14', `${label} 생성`);
        }
    }

    toggleGodMode() {
        this.isGodMode = !this.isGodMode;
        const btn = document.getElementById('db-god-mode');
        if (btn) btn.classList.toggle('active', this.isGodMode);
        this.engine.addEffect?.('system', this.engine.canvas.width / 2, 100, this.isGodMode ? '#ff3131' : '#fff', `God Mode: ${this.isGodMode ? 'ON' : 'OFF'}`);
    }

    toggleSpawnSandbagMode() {
        const wasActive = this.isSpawnSandbagMode;
        this.engine.cancelModes?.(); 
        
        if (!wasActive) {
            this.isSpawnSandbagMode = true;
            const btn = document.getElementById('db-spawn-sandbag');
            if (btn) btn.classList.add('active');
        }
    }

    toggleSpawnAirSandbagMode() {
        const wasActive = this.isSpawnAirSandbagMode;
        this.engine.cancelModes?.();

        if (!wasActive) {
            this.isSpawnAirSandbagMode = true;
            const btn = document.getElementById('db-spawn-air-sandbag');
            if (btn) btn.classList.add('active');
        }
    }

    toggleEraserMode() {
        const wasActive = this.isEraserMode;
        this.engine.cancelModes?.();

        if (!wasActive) {
            this.isEraserMode = true;
            const btn = document.getElementById('db-eraser');
            if (btn) btn.classList.add('active');
        }
    }

    addResources(type, amount) {
        if (this.engine.resources[type] !== undefined) {
            this.engine.resources[type] += amount;
            this.engine.updateResourceUI?.();
            this.engine.addEffect?.('system', this.engine.canvas.width / 2, 150, '#ffd700', `${type} +${amount}`);
        }
    }

    healAll() {
        const units = this.engine.entities.units || [];
        const buildings = this.engine.getAllBuildings?.() || [];
        
        [...units, ...buildings].forEach(ent => {
            if (ent.ownerId === 1) {
                ent.hp = ent.maxHp;
            }
        });
        
        if (this.engine.entities.base) {
            this.engine.entities.base.hp = this.engine.entities.base.maxHp;
        }

        this.engine.addEffect?.('system', this.engine.canvas.width / 2, 200, '#2ecc71', '아군 전원 회복 완료');
    }

    executeSpawnSandbag(worldX, worldY) {
        const { Enemy } = this.engine.entityClasses;
        if (Enemy) {
            const sandbag = new Enemy(worldX, worldY, this.engine);
            sandbag.name = "연습용 샌드백";
            sandbag.maxHp = 10000;
            sandbag.hp = 10000;
            sandbag.speed = 0; // 움직이지 않음
            sandbag.attack = () => {}; // 공격하지 않음
            
            // 적군 플레이어(2번) 소유로 설정하여 공격 대상으로 인식되게 함
            sandbag.ownerId = 2;
            
            this.engine.entities.enemies.push(sandbag);
            this.engine.entityManager?.spatialGrid.add(sandbag);
            this.engine.entityManager?.allEntities.push(sandbag);
            
            this.engine.addEffect?.('system', worldX, worldY - 50, '#ff3131', '샌드백 생성');
        }
    }

    executeSpawnAirSandbag(worldX, worldY) {
        const { Enemy } = this.engine.entityClasses;
        if (Enemy) {
            const sandbag = new Enemy(worldX, worldY, this.engine);
            sandbag.name = "연습용 공중 샌드백";
            sandbag.maxHp = 10000;
            sandbag.hp = 10000;
            sandbag.speed = 0;
            sandbag.attack = () => {};
            
            // 공중 유닛 설정
            sandbag.domain = 'air';
            sandbag.altitude = 1;
            sandbag.ownerId = 2;
            
            this.engine.entities.enemies.push(sandbag);
            this.engine.entityManager?.spatialGrid.add(sandbag);
            this.engine.entityManager?.allEntities.push(sandbag);
            
            this.engine.addEffect?.('system', worldX, worldY - 50, '#00d2ff', '공중 샌드백 생성');
        }
    }

    executeEraser(worldX, worldY) {
        // 클릭 지점의 엔티티 찾기
        const targets = [
            ...this.engine.entities.units,
            ...this.engine.entities.enemies,
            ...this.engine.entities.neutral,
            ...this.engine.getAllBuildings()
        ];

        const found = targets.find(ent => {
            if (!ent || !ent.active) return false;
            const b = ent.getSelectionBounds ? ent.getSelectionBounds() : {
                left: ent.x - 20, right: ent.x + 20, top: ent.y - 20, bottom: ent.y + 20
            };
            return worldX >= b.left && worldX <= b.right && worldY >= b.top && worldY <= b.bottom;
        });

        if (found && found.type !== 'base') { // 사령부는 보호
            found.hp = 0;
            found.active = false;
            if (found.alive !== undefined) found.alive = false;
            
            // 건물인 경우 타일 해제 필요
            if (this.engine.buildingRegistry[found.type]) {
                this.engine.clearBuildingTiles?.(found);
            }

            this.engine.addEffect?.('system', worldX, worldY, '#ff3131', '삭제됨');
        }
    }

    toggleFullVision() {
        this.isFullVision = !this.isFullVision;
        const btn = document.getElementById('db-clear-fog');
        if (btn) btn.classList.toggle('active', this.isFullVision);

        if (this.engine.tileMap) {
            // 안개 제거/복구는 TileMap의 가시성 상태를 조작
            for (let y = 0; y < this.engine.tileMap.rows; y++) {
                for (let x = 0; x < this.engine.tileMap.cols; x++) {
                    const tile = this.engine.tileMap.grid[y][x];
                    if (this.isFullVision) {
                        tile.visible = true;
                        tile.inSight = true;
                    } else {
                        // 기본 시야 업데이트로 돌아감 (다음 프레임에 자동 갱신됨)
                    }
                }
            }
            this.engine.tileMap.updateFogCanvas?.();
        }
    }

    // takeDamage 가로채기용 체크
    checkInvincibility(entity) {
        if (this.isGodMode && entity.ownerId === 1) {
            return true; // 대미지 무시
        }
        return false;
    }
}
