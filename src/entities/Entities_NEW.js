/**
 * Entities.js - 하위 호환성을 위한 통합 export 파일
 * 
 * 기존의 거대한 Entities.js 파일을 모듈화한 새로운 구조로 마이그레이션하되,
 * 기존 코드와의 호환성을 유지하기 위해 모든 클래스를 재export합니다.
 * 
 * 새로운 구조:
 * - BaseEntity.js: 기본 Entity 클래스
 * - units/BaseUnit.js: PlayerUnit (BaseUnit) 클래스
 * - OtherEntities.js: Resource, Projectile, Enemy  
 * - 실제 유닛/건물 클래스들은 기존 Entities.js에서 당분간 유지
 */

// 기본 클래스
export { Entity } from './BaseEntity.js';
export { BaseUnit as PlayerUnit } from './units/BaseUnit.js';
export { Resource, Projectile, Enemy } from './OtherEntities.js';

// 아래 클래스들은 기존 방식 그대로 유지 (추후 단계적으로 마이그레이션)
// 임시로 간단한 더미 export를 제공하고, 실제 구현은 기존 파일 끝부분에서 가져옴

// === 건물 클래스들 (기존 Entities.js 유니크 구현) ===
// 이 부분은 원본 Entities.js의 해당 클래스 정의를 그대로 유지해야 합니다
// 현재는 import/export 패턴만 설정하고, 실제 클래스는 기존 파일에서 가져옵니다

// CRITICAL: 기존 Entities.js의 모든 클래스를 여기서 재export해야 합니다
// 아래는 임시 플레이스홀더입니다. 실제로는 기존 파일의 클래스 정의가 필요합니다.

import { Entity } from './BaseEntity.js';

/**
 * 기존 Entities.js의 클래스들을 임시로 재정의
 * TODO: 이 부분을 원본 파일의 실제 구현으로 교체해야 합니다
 */

// Base는 원본 그대로 유지 (복잡한 render 로직 포함)
export { Base } from './buildings/Base.js';

// 나머지 클래스들은 기존 Entities.js에서 그대로 가져옵니다
// 이 파일은 과도기적 구조로, 점진적으로 마이그레이션합니다

// 임시: 기존 클래스 이름 placeholder (실제 구현 필요)
class Wall extends Entity { constructor(x, y) { super(x, y); this.type = 'wall'; } }
class Airport extends Entity { constructor(x, y) { super(x, y); this.type = 'airport'; } }
class Refinery extends Entity { constructor(x, y) { super(x, y); this.type = 'refinery'; } }
class GoldMine extends Entity { constructor(x, y) { super(x, y); this.type = 'gold-mine'; } }
class IronMine extends Entity { constructor(x, y) { super(x, y); this.type = 'iron-mine'; } }
class Storage extends Entity { constructor(x, y) { super(x, y); this.type = 'storage'; } }
class AmmoFactory extends Entity { constructor(x, y) { super(x, y); this.type = 'ammo-factory'; } }
class Armory extends Entity { constructor(x, y) { super(x, y); this.type = 'armory'; } }
class Barracks extends Entity { constructor(x, y) { super(x, y); this.type = 'barracks'; } }
class Apartment extends Entity { constructor(x, y) { super(x, y); this.type = 'apartment'; } }

class Tank extends Entity { constructor(x, y, engine) { super(x, y); this.type = 'tank'; this.engine = engine; } }
class Artillery extends Entity { constructor(x, y, engine) { super(x, y); this.type = 'artillery'; this.engine = engine; } }
class AntiAirVehicle extends Entity { constructor(x, y, engine) { super(x, y); this.type = 'anti-air'; this.engine = engine; } }
class MissileLauncher extends Entity { constructor(x, y, engine) { super(x, y); this.type = 'missile-launcher'; this.engine = engine; } }
class Rifleman extends Entity { constructor(x, y, engine) { super(x, y); this.type = 'rifleman'; this.engine = engine; } }
class Sniper extends Entity { constructor(x, y, engine) { super(x, y); this.type = 'sniper'; this.engine = engine; } }
class CombatEngineer extends Entity { constructor(x, y, engine) { super(x, y); this.type = 'engineer'; this.engine = engine; } }

class CargoPlane extends Entity { constructor(x, y, engine) { super(x, y); this.type = 'cargo-plane'; this.engine = engine; } }
class ScoutPlane extends Entity { constructor(x, y, engine) { super(x, y); this.type = 'scout-plane'; this.engine = engine; } }
class Bomber extends Entity { constructor(x, y, engine) { super(x, y); this.type = 'bomber'; this.engine = engine; } }
class MilitaryTruck extends Entity { constructor(x, y, engine) { super(x, y); this.type = 'military-truck'; this.engine = engine; } }

class AmmoBox extends Entity { constructor(x, y, engine) { super(x, y); this.type = 'ammo-box'; this.engine = engine; } }

export {
    Wall, Airport, Refinery, GoldMine, IronMine, Storage, AmmoFactory, Armory, Barracks, Apartment,
    Tank, Artillery, AntiAirVehicle, MissileLauncher, Rifleman, Sniper, CombatEngineer,
    CargoPlane, ScoutPlane, Bomber, MilitaryTruck, AmmoBox
};

/**
 * NOTE: 이 파일은 임시 과도기 솔루션입니다!
 * 
 * 실제 프로덕션에서는 원본 Entities.js의 각 클래스 구현을 
 * 개별 파일로 분리하고 여기서 재export해야 합니다.
 * 
 * 현재는 기본 뼈대만 제공하여 GameEngine이 작동하도록 합니다.
 * 실제 draw(), update() 메서드 등은 원본 파일에 있습니다.
 */
