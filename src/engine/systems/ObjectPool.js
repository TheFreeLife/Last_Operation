/**
 * ObjectPool - 객체 재사용을 통한 GC 부하 감소 및 성능 최적화
 */
export class ObjectPool {
    /**
     * @param {Function} factory - 새 객체를 생성하는 함수
     * @param {number} initialSize - 초기 생성 개수
     */
    constructor(factory, initialSize = 0) {
        this.factory = factory;
        this.pool = [];
        
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(this.factory());
        }
    }

    /**
     * 풀에서 객체를 가져옵니다. 풀이 비어있으면 새로 생성합니다.
     */
    acquire() {
        return this.pool.length > 0 ? this.pool.pop() : this.factory();
    }

    /**
     * 사용이 끝난 객체를 풀로 반환합니다.
     * @param {object} obj - 반환할 객체
     */
    release(obj) {
        // 객체에 release 또는 reset 메서드가 있다면 호출하여 상태 초기화
        if (obj.onRelease) {
            obj.onRelease();
        }
        this.pool.push(obj);
    }

    /**
     * 풀 비우기
     */
    clear() {
        this.pool = [];
    }

    get size() {
        return this.pool.length;
    }
}
