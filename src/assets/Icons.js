export const ICONS = {
    'turret-basic': `<div class="btn-icon blue"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="12" fill="#333" stroke="#00d2ff" stroke-width="2"/><rect x="16" y="8" width="8" height="14" fill="#00d2ff"/></svg></div>`,
    'turret-fast': `<div class="btn-icon green"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="12" fill="#333" stroke="#39ff14" stroke-width="2"/><rect x="14" y="6" width="4" height="16" fill="#39ff14"/><rect x="22" y="6" width="4" height="16" fill="#39ff14"/></svg></div>`,
    'turret-sniper': `<div class="btn-icon red"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="12" fill="#333" stroke="#ff3131" stroke-width="2"/><rect x="18" y="2" width="4" height="20" fill="#ff3131"/><circle cx="20" cy="20" r="4" fill="none" stroke="#ff3131" stroke-width="2"/><line x1="20" y1="14" x2="20" y2="26" stroke="#ff3131" stroke-width="1"/><line x1="14" y1="20" x2="26" y2="20" stroke="#ff3131" stroke-width="1"/></svg></div>`,
    'turret-tesla': `<div class="btn-icon blue"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="12" fill="#333" stroke="#00ffff" stroke-width="2"/><path d="M20 8 V15 M15 20 H25" stroke="#00ffff" stroke-width="2"/></svg></div>`,
    'turret-flamethrower': `<div class="btn-icon orange"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="12" fill="#333" stroke="#ff6600" stroke-width="2"/><path d="M15 15 Q20 5 25 15 T30 25" fill="#ff6600"/></svg></div>`,
    'coal-generator': `<div class="btn-icon orange"><svg viewBox="0 0 40 40"><rect x="10" y="20" width="20" height="15" fill="#333" stroke="#ff6600" stroke-width="2"/><rect x="22" y="10" width="6" height="12" fill="#333" stroke="#ff6600" stroke-width="2"/><circle cx="25" cy="8" r="3" fill="rgba(200,200,200,0.5)"/><circle cx="28" cy="4" r="4" fill="rgba(200,200,200,0.3)"/><path d="M15 28 Q20 20 25 28" stroke="#ff6600" stroke-width="2" fill="none"/></svg></div>`,
    'oil-generator': `<div class="btn-icon purple"><svg viewBox="0 0 40 40"><rect x="12" y="12" width="16" height="20" rx="3" fill="#333" stroke="#9370DB" stroke-width="2"/><path d="M12 16 L28 16" stroke="#9370DB" stroke-width="1"/><path d="M12 28 L28 28" stroke="#9370DB" stroke-width="1"/><circle cx="20" cy="12" r="4" fill="#333" stroke="#9370DB" stroke-width="2"/><path d="M8 20 L12 20" stroke="#9370DB" stroke-width="2"/></svg></div>`,
    'refinery': `<div class="btn-icon green"><svg viewBox="0 0 40 40"><rect x="8" y="10" width="10" height="25" fill="#333" stroke="#32cd32" stroke-width="2"/><rect x="22" y="10" width="10" height="25" fill="#333" stroke="#32cd32" stroke-width="2"/><path d="M18 20 H22" stroke="#32cd32" stroke-width="2"/><circle cx="20" cy="15" r="4" fill="#ffd700" opacity="0.8"/></svg></div>`,
    'gold-mine': `<div class="btn-icon yellow"><svg viewBox="0 0 40 40"><rect x="10" y="20" width="20" height="15" fill="#333" stroke="#FFD700" stroke-width="2"/><path d="M15 20 L20 10 L25 20" fill="#FFD700" stroke="#FFD700" stroke-width="1"/><circle cx="20" cy="28" r="4" fill="#FFD700"/></svg></div>`,
    'storage': `<div class="btn-icon blue"><svg viewBox="0 0 40 40"><rect x="5" y="15" width="30" height="20" fill="#333" stroke="#00d2ff" stroke-width="2"/><path d="M5 15 L20 5 L35 15" fill="#555" stroke="#00d2ff" stroke-width="2"/><rect x="18" y="25" width="4" height="10" fill="#00d2ff" opacity="0.5"/></svg></div>`,
    'airport': `<div class="btn-icon blue"><svg viewBox="0 0 40 40">
        <!-- 공항 베이스 -->
        <rect x="5" y="5" width="30" height="30" fill="#2c3e50" stroke="#1a252f" stroke-width="1"/>
        <!-- 활주로 -->
        <rect x="15" y="5" width="10" height="30" fill="#111"/>
        <line x1="20" y1="8" x2="20" y2="32" stroke="#fff" stroke-width="1" stroke-dasharray="3,3"/>
        <!-- 관제탑 -->
        <rect x="27" y="10" width="6" height="6" fill="#bdc3c7"/>
        <rect x="26" y="8" width="8" height="3" fill="#2980b9"/>
        <!-- 레이더 -->
        <circle cx="10" cy="25" r="4" fill="#95a5a6"/>
        <line x1="10" y1="25" x2="14" y2="21" stroke="#e74c3c" stroke-width="1.5"/>
    </svg></div>`,
    'barracks': `<div class="btn-icon green"><svg viewBox="0 0 40 40">
        <!-- 2.5D 막사 형태 -->
        <rect x="5" y="15" width="30" height="20" fill="#2d3310" stroke="#1e272e" stroke-width="1"/>
        <path d="M5 15 L20 8 L35 15 L20 22 Z" fill="#4a5d4b" stroke="#1e272e" stroke-width="1"/>
        <line x1="20" y1="8" x2="20" y2="22" stroke="rgba(0,0,0,0.2)" stroke-width="1"/>
        <rect x="17" y="24" width="6" height="8" fill="#111" stroke="#39ff14" stroke-width="1"/>
    </svg></div>`,
    'armory': `<div class="btn-icon"><svg viewBox="0 0 40 40">
        <!-- 톱니형 지붕 공장 -->
        <rect x="5" y="18" width="30" height="18" fill="#2c3e50" stroke="#2c3e50" stroke-width="1"/>
        <path d="M5 18 L15 18 L15 8 Z M15 18 L25 18 L25 8 Z M25 18 L35 18 L35 8 Z" fill="#95a5a6" stroke="#2c3e50" stroke-width="1"/>
        <rect x="12" y="25" width="16" height="11" fill="#111" stroke="#39ff14" stroke-width="1"/>
        <rect x="30" y="5" width="4" height="15" fill="#333"/>
    </svg></div>`,
    'skill-rifleman': `<div class="btn-icon green"><svg viewBox="0 0 40 40"><circle cx="20" cy="15" r="6" fill="#2d3436"/><path d="M12 25 L28 25 L20 15 Z" fill="#556644"/><rect x="22" y="20" width="8" height="2" fill="#636e72"/></svg></div>`,
    'skill-cargo': `<div class="btn-icon yellow"><svg viewBox="0 0 40 40"><path d="M10 25 L30 25 L35 15 L5 15 Z" fill="#FFD700" stroke="#aaa" stroke-width="2"/><rect x="15" y="10" width="10" height="5" fill="#888"/><path d="M5 15 L20 5 L35 15" stroke="#aaa" stroke-width="2" fill="none"/></svg></div>`,
    'skill-tank': `<div class="btn-icon green"><svg viewBox="0 0 40 40"><rect x="10" y="15" width="20" height="15" fill="#2c3e50" stroke="#39ff14" stroke-width="2"/><circle cx="20" cy="22" r="5" fill="#34495e"/><rect x="20" y="20" width="12" height="4" fill="#39ff14"/></svg></div>`,
    'skill-missile': `<div class="btn-icon red"><svg viewBox="0 0 40 40"><rect x="10" y="15" width="20" height="15" fill="#444" stroke="#ff3131" stroke-width="2"/><rect x="15" y="10" width="10" height="15" fill="#222"/><path d="M20 5 L24 12 L16 12 Z" fill="#ff3131"/></svg></div>`,
    'wall': `<div class="btn-icon yellow"><svg viewBox="0 0 40 40">
        <!-- 철조망 아이콘 -->
        <rect x="8" y="10" width="3" height="25" fill="#5d4037"/>
        <rect x="29" y="10" width="3" height="25" fill="#5d4037"/>
        <path d="M8 15 L29 15 M8 22 L29 30 M8 30 L29 22 M8 30 L29 30" stroke="#95a5a6" stroke-width="1.5" fill="none"/>
        <circle cx="15" cy="15" r="1" fill="#fff"/>
        <circle cx="22" cy="26" r="1" fill="#fff"/>
    </svg></div>`,
    'category-power': `<div class="btn-icon yellow"><svg viewBox="0 0 40 40"><path d="M10 20 L30 20 M20 10 L20 30" stroke="#ffff00" stroke-width="3"/><circle cx="20" cy="20" r="15" fill="none" stroke="#ffff00" stroke-width="2"/></svg></div>`,
    'category-network': `<div class="btn-icon purple"><svg viewBox="0 0 40 40"><circle cx="15" cy="15" r="5" fill="#ffff00"/><circle cx="25" cy="25" r="5" fill="#9370DB"/><path d="M15 15 L25 25" stroke="#fff" stroke-width="2"/></svg></div>`,
    'category-military': `<div class="btn-icon red"><svg viewBox="0 0 40 40"><rect x="10" y="10" width="20" height="20" fill="#333" stroke="#ff3131" stroke-width="2"/><path d="M5 15 L10 10 M35 15 L30 10 M20 5 V10" stroke="#ff3131" stroke-width="2"/><path d="M15 20 L25 20 M20 15 V25" stroke="#ff3131" stroke-width="2"/></svg></div>`,
    'power-line': `<div class="btn-icon yellow"><svg viewBox="0 0 40 40"><line x1="20" y1="5" x2="20" y2="35" stroke="#ffff00" stroke-width="4"/><circle cx="20" cy="20" r="6" fill="#333" stroke="#ffff00" stroke-width="2"/></svg></div>`,
    'pipe-line': `<div class="btn-icon purple"><svg viewBox="0 0 40 40"><rect x="10" y="10" width="20" height="20" rx="4" fill="#333" stroke="#9370DB" stroke-width="4"/><path d="M15 20 H25" stroke="#9370DB" stroke-width="2"/></svg></div>`,
    'menu:network': `<div class="btn-icon purple"><svg viewBox="0 0 40 40"><circle cx="15" cy="15" r="5" fill="#ffff00"/><circle cx="25" cy="25" r="5" fill="#9370DB"/><path d="M15 15 L25 25" stroke="#fff" stroke-width="2"/></svg></div>`,
    'menu:power': `<div class="btn-icon yellow"><svg viewBox="0 0 40 40"><path d="M10 20 L30 20 M20 10 L20 30" stroke="#ffff00" stroke-width="3"/><circle cx="20" cy="20" r="15" fill="none" stroke="#ffff00" stroke-width="2"/></svg></div>`,
    'menu:military': `<div class="btn-icon red"><svg viewBox="0 0 40 40"><rect x="10" y="10" width="20" height="20" fill="#333" stroke="#ff3131" stroke-width="2"/><path d="M5 15 L10 10 M35 15 L30 10 M20 5 V10" stroke="#ff3131" stroke-width="2"/><path d="M15 20 L25 20 M20 15 V25" stroke="#ff3131" stroke-width="2"/></svg></div>`,
    'skill:tank': `<div class="btn-icon green"><svg viewBox="0 0 40 40"><rect x="10" y="15" width="20" height="15" fill="#2c3e50" stroke="#39ff14" stroke-width="2"/><circle cx="20" cy="22" r="5" fill="#34495e"/><rect x="20" y="20" width="12" height="4" fill="#39ff14"/></svg></div>`,
    'skill:missile': `<div class="btn-icon red"><svg viewBox="0 0 40 40"><rect x="10" y="15" width="20" height="15" fill="#444" stroke="#ff3131" stroke-width="2"/><rect x="15" y="10" width="10" height="15" fill="#222"/><path d="M20 5 L24 12 L16 12 Z" fill="#ff3131"/></svg></div>`,
    'skill:artillery': `<div class="btn-icon yellow"><svg viewBox="0 0 40 40"><rect x="10" y="20" width="20" height="12" fill="#333" stroke="#f1c40f" stroke-width="2"/><rect x="18" y="10" width="4" height="15" fill="#f1c40f"/><circle cx="20" cy="22" r="6" fill="#444" stroke="#f1c40f" stroke-width="1"/></svg></div>`,
    'skill:anti-air': `<div class="btn-icon blue"><svg viewBox="0 0 40 40"><rect x="10" y="20" width="20" height="12" rx="2" fill="#2d3436" stroke="#00d2ff" stroke-width="2"/><path d="M15 10 L18 20 M25 10 L22 20" stroke="#00d2ff" stroke-width="3"/><path d="M15 10 L18 13 L12 13 Z" fill="#fff"/><path d="M25 10 L28 13 L22 13 Z" fill="#fff"/></svg></div>`,
    'skill:rifleman': `<div class="btn-icon green"><svg viewBox="0 0 40 40"><circle cx="20" cy="15" r="6" fill="#2d3436"/><path d="M12 25 L28 25 L20 15 Z" fill="#556644"/><rect x="22" y="20" width="8" height="2" fill="#636e72"/></svg></div>`,
    'skill:cargo': `<div class="btn-icon yellow"><svg viewBox="0 0 40 40"><path d="M10 25 L30 25 L35 15 L5 15 Z" fill="#FFD700" stroke="#aaa" stroke-width="2"/><rect x="15" y="10" width="10" height="5" fill="#888"/><path d="M5 15 L20 5 L35 15" stroke="#aaa" stroke-width="2" fill="none"/></svg></div>`,
    'skill:scout-plane': `<div class="btn-icon blue"><svg viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="15" fill="none" stroke="#00d2ff" stroke-width="1" stroke-dasharray="2,2"/>
        <path d="M20 10 L28 25 L20 22 L12 25 Z" fill="#00d2ff" stroke="#fff" stroke-width="1"/>
        <circle cx="20" cy="20" r="3" fill="#fff" opacity="0.5"/>
    </svg></div>`,
    'skill:engineer': `<div class="btn-icon yellow"><svg viewBox="0 0 40 40"><rect x="10" y="10" width="20" height="20" fill="#f1c40f"/><path d="M15 15 L25 25 M25 15 L15 25" stroke="#333" stroke-width="2"/><circle cx="20" cy="20" r="4" fill="#3498db"/></svg></div>`,
    'unit:move': `<div class="btn-icon blue"><svg viewBox="0 0 40 40"><path d="M10 20 L30 20 M22 12 L30 20 L22 28" stroke="#00d2ff" stroke-width="3" fill="none"/></svg></div>`,
    'unit:stop': `<div class="btn-icon red"><svg viewBox="0 0 40 40"><rect x="10" y="10" width="20" height="20" fill="#ff3131"/></svg></div>`,
    'unit:hold': `<div class="btn-icon yellow"><svg viewBox="0 0 40 40"><path d="M20 5 L32 12 V25 L20 35 L8 25 V12 Z" fill="#333" stroke="#ffff00" stroke-width="2"/></svg></div>`,
    'unit:patrol': `<div class="btn-icon cyan"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="12" fill="none" stroke="#00ffcc" stroke-width="2" stroke-dasharray="5,3"/><path d="M32 20 L28 16 M32 20 L28 24" stroke="#00ffcc" stroke-width="2" fill="none"/></svg></div>`,
    'unit:attack': `<div class="btn-icon red"><svg viewBox="0 0 40 40"><path d="M10 30 L30 10 M10 10 L30 30" stroke="#ff3131" stroke-width="4"/><path d="M15 15 L10 10 M25 15 L30 10" stroke="#fff" stroke-width="2"/></svg></div>`,
    'unit:siege': `<div class="btn-icon cyan"><svg viewBox="0 0 40 40">
        <!-- 바닥 지지대 (Outriggers) -->
        <path d="M10 32 L5 37 M30 32 L35 37 M10 12 L5 7 M30 12 L35 7" stroke="#00ffcc" stroke-width="3" fill="none"/>
        <!-- 차체 베이스 -->
        <rect x="12" y="12" width="16" height="20" rx="2" fill="#2d3436" stroke="#00ffcc" stroke-width="2"/>
        <!-- 수직 미사일 발사관 -->
        <rect x="17" y="5" width="6" height="15" fill="#00ffcc"/>
        <path d="M17 5 L20 0 L23 5 Z" fill="#fff"/>
        <!-- 조준 마크 -->
        <circle cx="20" cy="20" r="4" fill="none" stroke="#00ffcc" stroke-width="1" stroke-dasharray="2,2"/>
    </svg></div>`,
    'unit:manual_fire': `<div class="btn-icon red"><svg viewBox="0 0 40 40">
        <!-- 타겟 조준경 -->
        <circle cx="20" cy="20" r="16" fill="none" stroke="#ff3131" stroke-width="2"/>
        <line x1="20" y1="5" x2="20" y2="35" stroke="#ff3131" stroke-width="1" stroke-dasharray="4,2"/>
        <line x1="5" y1="20" x2="35" y2="20" stroke="#ff3131" stroke-width="1" stroke-dasharray="4,2"/>
        <!-- 미사일 실루엣 -->
        <path d="M20 8 L24 18 L24 32 L16 32 L16 18 Z" fill="#ff3131"/>
        <path d="M20 5 L23 10 L17 10 Z" fill="#fff"/>
        <!-- 발사 불꽃 효과 -->
        <path d="M17 32 Q20 38 23 32" fill="#ff8c00"/>
    </svg></div>`,
    'back': `<div class="btn-icon"><svg viewBox="0 0 40 40"><path d="M25 10 L15 20 L25 30" stroke="#fff" stroke-width="3" fill="none"/></svg></div>`,
    'menu:main': `<div class="btn-icon"><svg viewBox="0 0 40 40"><path d="M25 10 L15 20 L25 30" stroke="#fff" stroke-width="3" fill="none"/></svg></div>`,
    'toggle:sell': `<div class="btn-icon red"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="none" stroke="#ff3131" stroke-width="3"/><line x1="8" y1="8" x2="32" y2="32" stroke="#ff3131" stroke-width="3"/><text x="20" y="27" text-anchor="middle" fill="#ff3131" font-size="18" font-weight="900" style="text-shadow: 0 0 5px #000;">$</text></svg></div>`,
    'sell': `<div class="btn-icon red"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="none" stroke="#ff3131" stroke-width="3"/><line x1="8" y1="8" x2="32" y2="32" stroke="#ff3131" stroke-width="3"/><text x="20" y="27" text-anchor="middle" fill="#ff3131" font-size="18" font-weight="900" style="text-shadow: 0 0 5px #000;">$</text></svg></div>`,
    'menu:engineer_build': `<div class="btn-icon yellow"><svg viewBox="0 0 40 40"><rect x="8" y="12" width="24" height="20" rx="2" fill="#333" stroke="#f1c40f" stroke-width="2"/><path d="M14 12 V8 H26 V12" fill="none" stroke="#f1c40f" stroke-width="2"/><path d="M12 20 H28 M20 12 V28" stroke="#f1c40f" stroke-width="2" opacity="0.5"/></svg></div>`,
    'menu:unit_cmds': `<div class="btn-icon"><svg viewBox="0 0 40 40"><path d="M25 10 L15 20 L25 30" stroke="#fff" stroke-width="3" fill="none"/></svg></div>`
};
