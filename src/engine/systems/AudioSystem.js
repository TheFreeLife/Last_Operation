export class AudioSystem {
    constructor() {
        this.sounds = {};
        this.enabled = true;
        this.volume = 0.2; // 기본 볼륨 낮춤 (0.5 -> 0.2)
        this.lastPlayTime = {}; // 중복 재생 방지용 타이머
    }

    async init(soundConfigPath) {
        try {
            const response = await fetch(soundConfigPath);
            const config = await response.json();
            
            const loadPromises = Object.entries(config).map(([key, path]) => {
                return this.loadSound(key, path);
            });

            await Promise.all(loadPromises);
            console.log('Audio System initialized');
        } catch (error) {
            console.error('Failed to initialize Audio System:', error);
        }
    }

    loadSound(key, path) {
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            audio.src = path;
            audio.preload = 'auto';
            
            audio.oncanplaythrough = () => {
                this.sounds[key] = audio;
                resolve();
            };
            
            audio.onerror = (err) => {
                console.warn(`Failed to load sound: ${path}`, err);
                resolve(); 
            };
        });
    }

    play(key, options = {}) {
        if (!this.enabled || !this.sounds[key]) return;

        // 중복 재생 방지 (Throttling): 동일 사운드는 100ms 이내에 다시 재생하지 않음
        const now = Date.now();
        const cooldown = options.cooldown || 100;
        if (this.lastPlayTime[key] && now - this.lastPlayTime[key] < cooldown) {
            return;
        }
        this.lastPlayTime[key] = now;

        const sound = this.sounds[key];
        const volume = options.volume !== undefined ? options.volume : this.volume;
        
        const soundClone = sound.cloneNode();
        soundClone.volume = volume;
        
        if (options.loop) {
            soundClone.loop = true;
        }

        soundClone.play().catch(e => {
            if (e.name !== 'NotAllowedError') console.warn('Audio play failed:', e);
        });

        return soundClone;
    }

    setVolume(value) {
        this.volume = Math.max(0, Math.min(1, value));
    }

    toggle(state) {
        this.enabled = state !== undefined ? state : !this.enabled;
    }
}

export const audioSystem = new AudioSystem();
