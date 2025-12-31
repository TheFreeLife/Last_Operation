export class UpgradeManager {
    constructor(engine) {
        this.engine = engine;
        // 주사위 버튼으로 뽑는 아이템 (인벤토리 보관)
        this.shopItems = [
            { id: 'item_turret_fast', name: 'Fast 포탑', desc: '공격 속도가 빠른 포탑을 설치합니다.', icon: '🔫', type: 'build-item', buildType: 'turret-fast', apply: () => this.engine.startItemBuildMode('turret-fast') },
            { id: 'item_turret_sniper', name: 'Sniper 포탑', desc: '사거리가 매우 긴 포탑을 설치합니다.', icon: '🎯', type: 'build-item', buildType: 'turret-sniper', apply: () => this.engine.startItemBuildMode('turret-sniper') },
            { id: 'item_turret_tesla', name: 'Tesla 포탑', desc: '전기로 적을 지져 지속적인 피해를 줍니다.', icon: '⚡', type: 'build-item', buildType: 'turret-tesla', apply: () => this.engine.startItemBuildMode('turret-tesla') },
            { id: 'item_turret_flame', name: 'Flame 포탑', desc: '강력한 화염을 뿜어 범위 내 모든 적을 태웁니다.', icon: '🔥', type: 'build-item', buildType: 'turret-flamethrower', apply: () => this.engine.startItemBuildMode('turret-flamethrower') }
        ];
    }

    getRandomItems(count = 1) {
        const shuffled = [...this.shopItems].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }
}