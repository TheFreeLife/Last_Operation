export class DeploymentSystem {
    constructor(engine) {
        this.engine = engine;
        this.overlay = document.getElementById('unit-selection-overlay');
        this.cardList = document.getElementById('unit-card-list');
        this.availableCards = [];
        this.activeCards = [];
        
        this.loadCards();
    }

    async loadCards() {
        try {
            const response = await fetch('./data/deployment_cards.json');
            const data = await response.json();
            this.availableCards = data.cards || [];
            console.log(`[DeploymentSystem] Loaded ${this.availableCards.length} cards.`);
        } catch (error) {
            console.error('Failed to load deployment cards:', error);
        }
    }

    /**
     * 무작위 작전 카드 3장을 추출하여 UI 표시
     */
    presentOptions() {
        if (this.availableCards.length === 0) {
            console.warn('[DeploymentSystem] No cards available yet. Retrying...');
            this.loadCards().then(() => this._internalPresent());
            return;
        }
        this._internalPresent();
    }

    _internalPresent() {
        const shuffled = [...this.availableCards].sort(() => 0.5 - Math.random());
        this.activeCards = shuffled.slice(0, 3);
        this.renderSelectionUI();
    }

    renderSelectionUI() {
        if (!this.overlay || !this.cardList) return;
        this.cardList.innerHTML = '';

        this.activeCards.forEach(cardData => {
            const cardElement = this.createCardElement(cardData);
            this.cardList.appendChild(cardElement);
        });

        this.overlay.classList.remove('hidden');
    }

    createCardElement(cardData) {
        const div = document.createElement('div');
        div.className = 'unit-card';
        
        // 부대 구성 정보 및 총 인구수 계산
        let totalPop = 0;
        let unitDetailsHtml = '';
        
        cardData.units.forEach(u => {
            const registration = this.engine.entityManager.registry.get(u.id);
            if (registration) {
                const temp = new registration.EntityClass(0, 0, this.engine);
                totalPop += (temp.population || 1) * u.count;
                unitDetailsHtml += `<div class="card-stat-row"><span>${temp.name}</span> <span class="stat-val">x${u.count}</span></div>`;
            }
        });

        const cost = Math.ceil(totalPop / 2);
        const canAfford = this.engine.publicSentiment >= cost;

        if (!canAfford) div.classList.add('locked-card');

        div.innerHTML = `
            <div class="card-icon-container" style="font-size: 3rem;">${cardData.icon}</div>
            <div class="card-name">${cardData.name}</div>
            <p style="font-size: 0.8rem; color: #888; text-align: center; margin: 0 10px;">${cardData.description}</p>
            <div class="card-stats">
                ${unitDetailsHtml}
                <div class="card-stat-row" style="margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px;">
                    <span>총 인원</span> <span class="stat-val">${totalPop}명</span>
                </div>
                <div class="card-stat-row">
                    <span>징집 비용</span> <span class="stat-val ${canAfford ? 'text-green' : 'text-red'}">민심 ${cost}%</span>
                </div>
            </div>
            <button class="select-btn" ${canAfford ? '' : 'disabled'}>${canAfford ? '배치 승인' : '민심 부족'}</button>
        `;

        if (canAfford) {
            div.onclick = () => this.confirmDeployment(cardData, cost);
        }

        return div;
    }

    confirmDeployment(cardData, cost) {
        if (this.engine.publicSentiment < cost) return;

        // 1. 스폰 위치 확인
        let spawnPos = null;
        let spawnAngle = 0;
        for (let y = 0; y < this.engine.tileMap.rows; y++) {
            for (let x = 0; x < this.engine.tileMap.cols; x++) {
                const wall = this.engine.tileMap.layers.wall[y][x];
                if (wall && wall.id === 'spawn-point') {
                    spawnPos = this.engine.tileMap.gridToWorld(x, y);
                    spawnAngle = (wall.r || 0) * (Math.PI / 2);
                    break;
                }
            }
            if (spawnPos) break;
        }

        if (!spawnPos) {
            this.engine.addEffect?.('system', this.engine.canvas.width/2, this.engine.canvas.height/2, '#ff3131', '배치 구역이 없습니다!');
            return;
        }

        // 2. 민심 차감
        this.engine.updateSentiment(-cost);

        // 3. 다중 유닛 생성 (대형 형성)
        let spawnedCount = 0;
        cardData.units.forEach((uInfo, groupIdx) => {
            for (let i = 0; i < uInfo.count; i++) {
                // 약간의 흩뿌림과 대형 오프셋 적용
                const offsetX = (groupIdx * 40) + (Math.random() - 0.5) * 60;
                const offsetY = (i * 30) + (Math.random() - 0.5) * 60;
                
                const unit = this.engine.entityManager.create(uInfo.id, spawnPos.x + offsetX, spawnPos.y + offsetY, { ownerId: 1 });
                if (unit) {
                    unit.angle = spawnAngle;
                    spawnedCount++;
                }
            }
        });

        this.engine.addEffect?.('system', spawnPos.x, spawnPos.y, '#39ff14', `${cardData.name} 도착! (${spawnedCount}기 배치)`);
        this.hideUI();
    }

    hideUI() {
        if (this.overlay) this.overlay.classList.add('hidden');
    }
}
