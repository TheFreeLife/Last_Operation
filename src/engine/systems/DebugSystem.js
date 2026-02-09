export class DebugSystem {
    constructor(engine) {
        this.engine = engine;
        this.isGodMode = false;
        this.isFullVision = false;
        this.isEraserMode = false;
        this.currentOwnerId = 1; // 기본 소유자: 플레이어
        this.spawnUnitType = null; // 현재 소환할 유닛 타입
        this.init();
    }

    init() {
        // UI 버튼 이벤트 바인딩
        document.getElementById('db-god-mode')?.addEventListener('click', () => this.toggleGodMode());
        document.getElementById('db-eraser')?.addEventListener('click', () => this.toggleEraserMode());
        document.getElementById('db-toggle-owner')?.addEventListener('click', () => this.toggleOwner());
        document.getElementById('db-heal-all')?.addEventListener('click', () => this.healAll());
        document.getElementById('db-clear-fog')?.addEventListener('click', () => this.toggleFullVision());

        // 유닛 소환 버튼들
        this.unitTypeMap = {
            'db-spawn-tank': { type: 'tank' },
            'db-spawn-artillery': { type: 'artillery' },
            'db-spawn-wheeled-artillery': { type: 'wheeled-artillery' },
            'db-spawn-anti-air': { type: 'anti-air' },
            'db-spawn-sam': { type: 'sam-launcher' },
            'db-spawn-missile': { type: 'missile-launcher' },
            'db-spawn-icbm': { type: 'icbm-launcher' },
            'db-spawn-rifleman': { type: 'rifleman' },
            'db-spawn-sniper': { type: 'sniper' },
            'db-spawn-anti-tank': { type: 'anti-tank' },
            'db-spawn-special-forces': { type: 'special-forces' },
            'db-spawn-medic': { type: 'medic' },
            'db-spawn-mortar': { type: 'mortar-team' },
            'db-spawn-drone-op': { type: 'drone-operator' },
            'db-spawn-suicide-drone': { type: 'suicide-drone' },
            'db-spawn-military-truck': { type: 'military-truck' },
            'db-spawn-medical-truck': { type: 'medical-truck' },
            'db-spawn-bomber': { type: 'bomber' },
            'db-spawn-cargo-plane': { type: 'cargo-plane' },
            'db-spawn-scout-plane': { type: 'scout-plane' },
            'db-spawn-helicopter': { type: 'helicopter' },
            'db-spawn-drone-truck': { type: 'drone-truck' },
            'db-spawn-boat': { type: 'small-boat' },
            'db-spawn-train': { type: 'train' },
            'db-spawn-freight': { type: 'freight-car' },
            'db-spawn-ammo-bullet': { type: 'ammo-box', options: { ammoType: 'bullet' } },
            'db-spawn-ammo-shell': { type: 'ammo-box', options: { ammoType: 'shell' } },
            'db-spawn-ammo-missile': { type: 'ammo-box', options: { ammoType: 'missile' } },
            'db-spawn-ammo-nuclear': { type: 'ammo-box', options: { ammoType: 'nuclear-missile' } },
            'db-spawn-sentiment': { type: 'system:sentiment' }
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
        }
    }

    /**
     * 모든 디버그 모드 상태 리셋
     */
    reset() {
        this.activeSpawnBtnId = null;
        this.spawnUnitType = null;
        this.spawnUnitOptions = null;
        this.isEraserMode = false;
        
        // 모든 디버그 버튼의 active 클래스 제거
        const dbBtns = document.querySelectorAll('#debug-panel .debug-btn');
        dbBtns.forEach(btn => btn.classList.remove('active'));
        
        // God Mode와 Full Vision은 유지할지 선택할 수 있으나, 
        // 여기서는 명시적으로 활성화된 버튼들만 끕니다.
        if (this.isGodMode) document.getElementById('db-god-mode')?.classList.add('active');
        if (this.isFullVision) document.getElementById('db-clear-fog')?.classList.add('active');
    }

    executeSpawnUnit(worldX, worldY) {
        if (!this.spawnUnitType) return;

        // 시스템 명령 처리 (예: 민심 회복)
        if (this.spawnUnitType === 'system:sentiment') {
            this.engine.publicSentiment = 100;
            this.engine.addEffect?.('system', worldX, worldY - 40, '#39ff14', `국가 지지율 100% 회복`);
            return;
        }

        const baseOptions = { ownerId: this.currentOwnerId };
        const finalOptions = Object.assign({}, baseOptions, this.spawnUnitOptions);

        // 소유주에 따른 리스트 오버라이드 결정
        let listOverride = undefined;
        if (this.currentOwnerId === 2) listOverride = 'enemies';
        else if (this.currentOwnerId === 0) listOverride = 'neutral';
        else if (this.currentOwnerId === 1) listOverride = 'units';

        const entity = this.engine.entityManager?.create(this.spawnUnitType, worldX, worldY, finalOptions, listOverride);

        if (entity) {
            // [추가] 수송기의 경우 전용 리스트에도 등록
            if (this.spawnUnitType === 'cargo-plane' && this.engine.entities.cargoPlanes) {
                if (!this.engine.entities.cargoPlanes.includes(entity)) {
                    this.engine.entities.cargoPlanes.push(entity);
                }
            }

            let label = entity.name || this.spawnUnitType;
            if (this.spawnUnitOptions?.ammoType) label += ` (${this.spawnUnitOptions.ammoType})`;
            
            const color = this.currentOwnerId === 1 ? '#39ff14' : (this.currentOwnerId === 2 ? '#ff3131' : '#ffff00');
            this.engine.addEffect?.('system', worldX, worldY - 40, color, `${label} 생성 (${this.currentOwnerId === 1 ? '아군' : '적군'})`);
        }
    }

    toggleOwner() {
        // 1 (플레이어) -> 2 (적군) -> 0 (중립) 순환
        if (this.currentOwnerId === 1) this.currentOwnerId = 2;
        else if (this.currentOwnerId === 2) this.currentOwnerId = 0;
        else this.currentOwnerId = 1;

        const btn = document.getElementById('db-toggle-owner');
        const tooltip = document.getElementById('db-owner-tooltip');
        
        if (btn && tooltip) {
            if (this.currentOwnerId === 1) {
                btn.textContent = '👤';
                tooltip.textContent = '소환 소유자: 플레이어';
                btn.style.borderColor = '#c8aa6e';
            } else if (this.currentOwnerId === 2) {
                btn.textContent = '🤖';
                tooltip.textContent = '소환 소유자: 적군';
                btn.style.borderColor = '#ff3131';
            } else {
                btn.textContent = '🏳️';
                tooltip.textContent = '소환 소유자: 중립';
                btn.style.borderColor = '#ffff00';
            }
        }
    }

    toggleGodMode() {
        this.isGodMode = !this.isGodMode;
        const btn = document.getElementById('db-god-mode');
        if (btn) btn.classList.toggle('active', this.isGodMode);
        this.engine.addEffect?.('system', this.engine.canvas.width / 2, 100, this.isGodMode ? '#ff3131' : '#fff', `God Mode: ${this.isGodMode ? 'ON' : 'OFF'}`);
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

    healAll() {
        const units = this.engine.entities.units || [];
        
        units.forEach(ent => {
            if (ent.ownerId === 1) {
                ent.hp = ent.maxHp;
            }
        });

        this.engine.addEffect?.('system', this.engine.canvas.width / 2, 200, '#2ecc71', '아군 전원 회복 완료');
    }

    executeEraser(worldX, worldY) {
        // 클릭 지점의 엔티티 찾기
        const targets = [
            ...this.engine.entities.units,
            ...this.engine.entities.enemies,
            ...this.engine.entities.neutral
        ];

        const found = targets.find(ent => {
            if (!ent || !ent.active) return false;
            const b = ent.getSelectionBounds ? ent.getSelectionBounds() : {
                left: ent.x - 20, right: ent.x + 20, top: ent.y - 20, bottom: ent.y + 20
            };
            return worldX >= b.left && worldX <= b.right && worldY >= b.top && worldY <= b.bottom;
        });

        if (found) {
            if (found.onDeath) {
                found.onDeath();
            } else {
                found.hp = 0;
                found.active = false;
                if (found.alive !== undefined) found.alive = false;
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
