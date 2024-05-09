const $get = Symbol("get");
const $set = Symbol("set");
const $initialize = Symbol("initialize");

//
export default class AxPersistency {
    #names = new Map([]);
    #namespace = "psx";
    #smap = new WeakMap();

    //
    constructor(namespace = "psx", names = []){
        this.#names = new Map(names);
        this.#namespace = namespace;
    }

    //
    synchronizeWith(obj) {
        const tmp = {};
        const self = this;
        this.#smap.set(obj, tmp);
        Array.from(this.#names.entries()).forEach(([n, act])=>{
            tmp[n] = obj[n];
            Object.defineProperties(obj, {
                [n]: {
                    get: ( ) => { return self[$get]([obj, n, obj], act); },
                    set: (v) => { return self[$set]([obj, n, v  ], act); },
                    enumerable: true,
                    configurable: true
                }
            });
            self[$initialize](obj, tmp, n, act);
        });
    }

    // svelte specific (TODO: weak ref support)
    makeWritable(name, base = null) {
        const unit = base ?? {[name]: null};
        const subs = new Set([]);
        this.synchronizeWith(unit);

        //
        return {
            set: (value)=>{
                unit[name] = value;
                Array.from(subs.values()).forEach((cb)=>cb(value));
            },
            update: (fx)=>{
                const value = fx(unit[name]);
                unit[name] = value;
                Array.from(subs.values()).forEach((cb)=>cb(value));
            },
            ubsubscribe: (fx)=>{
                subs.delete(fx);
            },
            subscribe: (fx)=>{
                subs.add(fx);
            }
        }
    }

    // svelte specific (TODO: weak ref support)
    makeReadable(name, base = null) {
        const unit = base ?? {[name]: null};
        const subs = new Set([]);
        this.synchronizeWith(unit);

        //
        return {
            get: ()=>{
                const value = unit[name];
                Array.from(subs.values()).forEach((cb)=>cb(value));
                return value;
            },
            update: (fx)=>{
                const value = fx(unit[name]);
                unit[name] = value;
                Array.from(subs.values()).forEach((cb)=>cb(value));
            },
            ubsubscribe: (fx)=>{
                subs.delete(fx);
            },
            subscribe: (fx)=>{
                subs.add(fx);
            }
        }
    }

    //
    getFromStorage(name) {
        const act = this.#names.get(name);
        const initial = act?.["initial"] ?? null;

        //
        if (localStorage.getItem(this.#namespace + ":" + name) == null && (initial != null)) {
            localStorage.setItem(this.#namespace + ":" + name, initial);
        }

        //
        const res = localStorage.getItem(this.#namespace + ":" + name) ?? initial;
        return (typeof res == "function" ? res.bind(ctx) : res);
    }

    //
    [$initialize](target, obj, name, act = {}) {
        let value = act["get"]?.call?.(target, target) ?? obj?.[name] ?? localStorage.getItem(this.#namespace + ":" + name) ?? act?.["initial"] ?? null;

        //
        value = act["getproxy"]?.call?.(target, value, target) ?? value;
        if ((value != null && typeof value != "function") && localStorage.getItem(this.#namespace + ":" + name) == null) {
            localStorage.setItem(this.#namespace + ":" + name, value);
        }

        //
        value = act["setproxy"]?.call?.(target, value, target) ?? value;
        if ((value != null && typeof value != "function")) {
            localStorage.setItem(this.#namespace + ":" + name, value);
        }

        //
        if (act["set"]?.call?.(target, value, target) == null) {
            return (obj[name] = value) != null;
        }

        //
        return null;
    }

    //
    [$get]([target, name, ctx], act = {}) {
        const obj = this.#smap.get(target);
        const initial = act?.["initial"] ?? null;

        //
        if (localStorage.getItem(this.#namespace + ":" + name) == null && (initial != null)) {
            localStorage.setItem(this.#namespace + ":" + name, initial);
        }

        //
        let res = act["get"]?.call?.(target, target) ?? obj?.[name] ?? localStorage.getItem(this.#namespace + ":" + name) ?? initial;
        res = act["getproxy"]?.call?.(target, res, target) ?? res;

        //
        return (typeof res == "function" ? res.bind(ctx) : res);
    }

    //
    [$set]([target, name, value], act = {}) {
        const obj = this.#smap.get(target);
        value = act["setproxy"]?.call?.(target, value, target) ?? value;

        //
        if (typeof value != "function" && value != null) {
            localStorage.setItem(this.#namespace + ":" + name, value);
        }

        //
        if (act["set"]?.call?.(target, value, target) == null) {
            return (obj[name] = value) != null;
        }

        //
        return null;
    }
}
