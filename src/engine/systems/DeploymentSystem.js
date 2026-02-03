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
        // [추가] 미션 데이터에 따른 카드 필터링
        let pool = this.availableCards;
        const enabledIds = this.engine.currentMission?.data?.enabledCards;
        
        if (enabledIds && Array.isArray(enabledIds) && enabledIds.length > 0) {
            pool = this.availableCards.filter(card => enabledIds.includes(card.id));
        }

        if (pool.length === 0) {
            this.engine.addEffect?.('system', this.engine.canvas.width/2, this.engine.canvas.height/2, '#ff3131', '사용 가능한 병력 카드가 없습니다!');
            return;
        }

        // 가중치 기반 무작위 선택 (3장 추출)
        const selected = [];
        const tempPool = [...pool];
        
        while (selected.length < 3 && tempPool.length > 0) {
            const totalWeight = tempPool.reduce((sum, card) => sum + (card.weight || 10), 0);
            let random = Math.random() * totalWeight;
            
            for (let i = 0; i < tempPool.length; i++) {
                const weight = tempPool[i].weight || 10;
                if (random < weight) {
                    selected.push(tempPool.splice(i, 1)[0]);
                    break;
                }
                random -= weight;
            }
        }

        this.activeCards = selected;
        this.renderSelectionUI();
    }

    getRarityInfo(weight) {
        if (weight >= 80) return { name: '표준', color: '#ffffff' };
        if (weight >= 40) return { name: '베테랑', color: '#1eff00' };
        if (weight >= 20) return { name: '정예', color: '#0070dd' };
        if (weight >= 10) return { name: '최정예', color: '#a335ee' };
        return { name: '기밀', color: '#ff8000' };
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
        
        const rarity = this.getRarityInfo(cardData.weight || 10);
        // 희귀도 색상을 CSS 변수로 전달하여 스타일시트에서 활용 가능하게 함
        div.style.setProperty('--rarity-color', rarity.color);
        div.style.borderColor = rarity.color;
        div.style.boxShadow = `0 0 15px ${rarity.color}33`;

        // 부대 구성 정보 표시용
        let unitDetailsHtml = '';
        cardData.units.forEach(u => {
            const registration = this.engine.entityManager.registry.get(u.id);
            if (registration) {
                const temp = new registration.EntityClass(0, 0, this.engine);
                unitDetailsHtml += `<div class="card-stat-row"><span>${temp.name}</span> <span class="stat-val">x${u.count}</span></div>`;
            }
        });

        const cost = cardData.cost || 0;
        const canAfford = this.engine.publicSentiment >= cost;

        if (!canAfford) div.classList.add('locked-card');

        div.innerHTML = `
            <div class="card-rarity" style="color: ${rarity.color}; font-size: 0.8rem; font-weight: 900; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 1px;">${rarity.name}</div>
            <div class="card-icon-container" style="font-size: 3.5rem; margin-bottom: 10px;">${cardData.icon}</div>
            <div class="card-name" style="margin-bottom: 5px;">${cardData.name}</div>
            <p style="font-size: 0.8rem; color: #aaa; text-align: center; margin: 0 10px 15px 10px; line-height: 1.4;">${cardData.description}</p>
            <div class="card-stats">
                ${unitDetailsHtml}
                <div class="card-stat-row" style="margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">
                    <span style="font-weight: bold;">징집 비용</span> <span class="stat-val ${canAfford ? 'text-green' : 'text-red'}" style="font-size: 1.1rem;">민심 ${cost}%</span>
                </div>
            </div>
            <button class="select-btn" ${canAfford ? '' : 'disabled'} style="${canAfford ? 'background: ' + rarity.color + '22; border-color: ' + rarity.color + ';' : ''}">
                ${canAfford ? '배치 승인' : '민심 부족'}
            </button>
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
                
                // [수정] 카드에 정의된 추가 옵션(options)을 병합하여 전달
                const spawnOptions = Object.assign({ ownerId: 1 }, uInfo.options || {});
                
                const unit = this.engine.entityManager.create(uInfo.id, spawnPos.x + offsetX, spawnPos.y + offsetY, spawnOptions);
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
