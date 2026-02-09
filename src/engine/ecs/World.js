/**
 * ECS World - Data-oriented TypedArray Storage
 */
export class World {
    constructor(maxEntities = 20000) {
        this.maxEntities = maxEntities;
        this.nextIndex = 0;
        this.freeIndices = [];

        this.active = new Uint8Array(maxEntities);
        this.typeId = new Uint16Array(maxEntities);
        this.ownerId = new Uint8Array(maxEntities);

        this.x = new Float32Array(maxEntities);
        this.y = new Float32Array(maxEntities);
        this.vx = new Float32Array(maxEntities);
        this.vy = new Float32Array(maxEntities);
        this.angle = new Float32Array(maxEntities);
        this.speed = new Float32Array(maxEntities);

        this.hp = new Float32Array(maxEntities);
        this.maxHp = new Float32Array(maxEntities);
        this.damage = new Float32Array(maxEntities);
        
        // 투사체 전용 데이터
        this.targetX = new Float32Array(maxEntities);
        this.targetY = new Float32Array(maxEntities);
        this.startX = new Float32Array(maxEntities);
        this.startY = new Float32Array(maxEntities);
        this.peakHeight = new Float32Array(maxEntities);
        this.startHeight = new Float32Array(maxEntities);
        this.explosionRadius = new Float32Array(maxEntities);
        this.isIndirect = new Uint8Array(maxEntities); // 0: 직사, 1: 곡사
        this.weaponType = new Uint8Array(maxEntities); // 0: bullet, 1: sniper, 2: shell, 3: missile, 4: fire
    }

    createEntity() {
        let idx = this.freeIndices.length > 0 ? this.freeIndices.pop() : this.nextIndex++;
        if (idx >= this.maxEntities) return -1;
        this.active[idx] = 1;
        return idx;
    }

    destroyEntity(idx) {
        if (this.active[idx] === 0) return;
        this.active[idx] = 0;
        this.freeIndices.push(idx);
    }
}
