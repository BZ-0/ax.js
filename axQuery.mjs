
import Timer from "./axTime.mjs";

//
export class DynamicHandler {
    constructor(query = "", index = 0) {
        this.index = index;
        this.query = query;
    }

    //
    get(target, name, ctx) {
        const array = Array.from(target.querySelectorAll(this.query)??[]);

        //
        if (Number.isInteger(name)) {
            return array[(this.index ?? 0) + parseInt(name)];
        }

        //
        if (name == "length") {
            return (array[name] - (this.index ?? 0));
        }

        //
        if (array[name] != null) {
            return (typeof array[name] == 'function' || array[name] instanceof Function) ? array[name].bind(array) : array[name];
        }

        //
        const _f = array[this.index ?? 0][name];
        return (typeof _f == 'function' || _f instanceof Function) ? _f.bind(ctx) : _f;
    }

    //
    set(target, name, value) {
        const array = Array.from(target.querySelectorAll(this.query)??[]);

        //
        if (Number.isInteger(name)) {
            //return (array[this.index + name] = value) != null;
            return false;
        }

        //
        if (array[name] != null /*&& (typeof array[name] == 'function' || array[name] instanceof Function)*/) {
            return false;
        }

        //
        return (array[this.index ?? 0][name] = value) != null;
    }
}

//
const movement = {};
const screen = {};

//
const registerMove = (e)=>{
    movement[e.pointerId] = {
        x: e.pageX - (screen[e.pointerId]?.x ?? e.pageX),
        y: e.pageY - (screen[e.pointerId]?.y ?? e.pageY),
    };
    screen[e.pointerId] = {x: e.pageX, y: e.pageY};
}

//
const removePointer = (e)=>{
    delete movement[e.pointerId];
    delete screen[e.pointerId];
};

//
document.addEventListener("pointerdown", registerMove, {capture: true, passive: true});
document.addEventListener("pointermove", registerMove, {capture: true, passive: true});
document.addEventListener("pointerup", removePointer, {capture: true, passive: true});
document.addEventListener("pointercancel", removePointer, {capture: true, passive: true});


//
const _changed_ = Symbol("changed");
const _bound_ = Symbol("bound");

//
export default class AxQuery {
    #nodeObserver = null;
    #attributeObserver = null;
    #attribListener = new Map([]);
    #eventListener = new WeakMap([]);
    #domListener = new Map([]);

    //
    movementX(pointerId = 0) { return (movement[pointerId]?.x||0) * this.pixelRatio; };
    movementY(pointerId = 0) { return (movement[pointerId]?.y||0) * this.pixelRatio; };

    //
    static movementX(pointerId = 0) { return (movement[pointerId]?.x||0) * this.pixelRatio; };
    static movementY(pointerId = 0) { return (movement[pointerId]?.y||0) * this.pixelRatio; };

    //
    get pixelRatio() {
        return devicePixelRatio||1;
    }

    //
    static get pixelRatio() {
        return devicePixelRatio||1;
    }

    //
    #muted = false;

    //
    constructor(ROOT = (typeof document != 'undefined' ? (document?.body ?? document) : null)) {
        const attribListener = new Map([]);
        const eventListener = new WeakMap([]);
        const domListener = new Map([]);

        //
        const attributeObserver =
            typeof MutationObserver != 'undefined'
                ? new MutationObserver(async (mutationList, observer) => {
                    if (!this.#muted) {
                        mutationList.forEach(async (mut) => {
                            const allowed = ['style'].indexOf(mut.attributeName) < 0;
                            const value = mut.target.getAttribute(mut.attributeName);
                            if (!mut?.attributeName?.startsWith("aq-") && value != mut?.oldValue && !mut.target[_changed_]) {

                                // TODO: de-apply events (i.e. unselected)
                                for (const [selector, fns] of attribListener.entries()) {
                                    if (allowed && mut.target.matches(selector)) {
                                        fns.map((F) => F([mut.target], selector, mut.attributeName));
                                    }
                                }

                            }
                        });
                    }
                })
                : null;

        //
        const nodeObserver =
            typeof MutationObserver != 'undefined'
                ? new MutationObserver(async (mutationList, observer) => {
                    if (!this.#muted) {
                        for (const [selector, fns] of domListener.entries()) {
                            mutationList.forEach(async (mut) => {
                                //
                                let elems = mut.childList?.filter((e) => {
                                    //return elements.indexOf(e) > -1;
                                    return e.matches(selector);
                                }) || [];

                                //
                                if (mut.target.matches(selector) && elems.indexOf(mut.target) < 0) {
                                    elems.push(mut.target);
                                }

                                //
                                elems = [...new Set(elems)];
                                fns.map((F) => F(elems, selector));
                            });
                        }
                    }
                })
                : null;

        //
        nodeObserver?.observe?.(this.ROOT = ROOT, { childList: true, subtree: true });

        //
        this.defer.then(()=>{
            for (const [selector, fns] of domListener.entries()) {
                fns.map((F) => F(this.dynamic(selector).filter((el)=>!el[_changed_]), selector));
            }
            /*for (const [selector, fns] of attribListener.entries()) {
                fns.map((F) => F(this.dynamic(selector).filter((el)=>!el[_changed_]), selector));
            }*/
        });

        //
        this.#nodeObserver = nodeObserver;
        this.#attributeObserver = attributeObserver;
        this.#attribListener = attribListener;
        this.#eventListener = eventListener;
        this.#domListener = domListener;
    }

    //
    #reflectAttribInStyle(selector, elements, attribs) {
        for (const [key, unit] of attribs.entries()) {
            elements.map(async (e, I) => {
                if (!e[_changed_]) {
                    //await Timer.raf;
                    const K = await (typeof key == 'function' ? key(e, I) : key);
                    const k = `${K}`; //(K.startsWith("aq-") ? `--${K}` : `--aq-${K}`);
                    const v = typeof unit == 'function' ? await unit?.(e?.getAttribute?.(K), e) : `${e?.getAttribute?.(K)}${unit ?? ''}`;

                    //
                    //await Timer.raf;
                    e[_changed_] = true;
                    if (e?.matches?.(selector)) {
                        if (e?.style?.getPropertyValue?.(k) !== v) {
                            e?.style?.setProperty?.(k, v, '');
                        }
                    } else {
                        e?.style?.removeProperty?.(k);
                    }
                    e[_changed_] = false;
                }
            });
        }
    }

    //
    #applyEvents(selector, elements, args) {
        elements.map(async (e, I) => {
            //
            const mb = e?.matches?.(selector);

            //
            const evts = this.#eventListener.get(e);
            const evt = evts?.find(([a, s])=> (a == args));
            if (mb && (!this.#eventListener.has(e) || !evt?.[1]?.["alive"])) {
                try {
                    e?.removeEventListener?.(...args);
                    //await Timer.raf;
                    if (mb) { e?.addEventListener?.(...args); };
                } catch(er) { console.warn("Event binding unsuccessful..."); };

                //
                //this.#listenAttributes(e, selector);

                //
                if (!this.#eventListener.has(e)) {
                    this.#eventListener.set(e, []);
                }

                //
                if (!evt) {
                    this.#eventListener.get(e).push([args, {"alive": true}]);
                } else {
                    evt[1]["active"] = true;
                }
            } else
            if (!mb && evt?.[1]?.["alive"]) {
                e?.removeEventListener?.(...args);
                evt[1]["active"] = false;
            }
        });
    }

    //
    async #listenAttributes(e, selector, mutation) {

        //
        if (!e[_bound_]) {
            //await Timer.raf;
            e[_changed_] = true;
            e[_bound_] = true;
            this.#attributeObserver.observe(e, { attributes: true });
            e[_changed_] = false;

            //
            e.addEventListener(
                'pointerenter',
                (evt) => {
                    //evt.stopPropagation();
                    const clss = `aq-hover-${evt.pointerId}`;
                    if (!e.classList.contains(clss)) { e.classList.add(clss); }
                    this.#attribListener.get(selector)?.map?.((F) => F([e], selector));
                },
                { passive: true, capture: false }
            );

            //
            this.ROOT.addEventListener(
                'pointercancel',
                (evt) => {
                    //evt.stopPropagation();
                    e.classList.remove(`aq-hover-${evt.pointerId}`);
                    e.classList.remove(`aq-active-${evt.pointerId}`);
                    this.#attribListener.get(selector)?.map?.((F) => F([e], selector));
                },
                { passive: true, capture: true }
            );

            //
            e.addEventListener(
                'pointerleave',
                (evt) => {
                    //evt.stopPropagation();
                    e.classList.remove(`aq-hover-${evt.pointerId}`);
                    e.classList.remove(`aq-active-${evt.pointerId}`);
                    this.#attribListener.get(selector)?.map?.((F) => F([e], selector));
                },
                { passive: true, capture: false }
            );

            //
            e.addEventListener(
                'pointerdown',
                (evt) => {
                    //evt.stopPropagation();
                    const clss = `aq-active-${evt.pointerId}`;
                    if (!e.classList.contains(clss)) { e.classList.add(clss); }
                    this.#attribListener.get(selector)?.map?.((F) => F([e], selector));
                },
                { passive: true, capture: false }
            );

            //
            this.ROOT.addEventListener(
                'pointerup',
                (evt) => {
                    //evt.stopPropagation();
                    e.classList.remove(`aq-active-${evt.pointerId}`);
                    this.#attribListener.get(selector)?.map?.((F) => F([e], selector));
                },
                { passive: true, capture: true }
            );
        }
    }

    //
    #observeAttrib(selector, elements, attribs, mutation) {
        for (const [key, value] of attribs.entries()) {
            elements.map(async (e, I) => {
                if (!e[_changed_] && e.matches(selector)) {
                    if (["style", "class", "id"].indexOf(mutation??key) < 0 && (mutation ? (key == mutation) : true) && !key.startsWith('aq-')) {
                        //await Timer.raf;
                        e[_changed_] = true; value(e, I); e[_changed_] = false;
                    }
                    //this.#listenAttributes(e, selector);
                }
            });
        }
    };

    //
    #applyAttrib(selector, elements, attribs, mutation) {
        for (const [key, value] of attribs.entries()) {
            elements.map(async (e, I) => {
                if (!e[_changed_] && e.matches(selector)) {
                    if ((["style", "class", "id"].indexOf(mutation) >= 0 ? (key != mutation) : (mutation ? (key == mutation) : true)) && !key.startsWith('aq-')) {
                        //await Timer.raf;
                        e[_changed_] = true;
                        const val = await (typeof value == 'function' ? value(e, I) : value);
                        if (e.getAttribute(key) != val) { e.setAttribute(key, val); };
                        e[_changed_] = false;
                    }
                    //this.#listenAttributes(e, selector);
                }
            });
        }
    };

    //
    $domListen(selector, fn_) {
        const fn = this.#mutfn(async (els, ...args) => {
            return fn_(els.filter((el)=>(!el[_changed_] && el.matches(selector))), ...args);
        });

        //
        if (!this.#domListener.has(selector)) {
            this.#domListener.set(selector, [fn]);
        } else {
            this.#domListener.get(selector).push(fn);
        }

        //
        return fn(this.dynamic(selector), selector);
    }

    //
    $attribListen(selector, fn_) {
        const fn = this.#mutfn(async (els, ...args) => {
            return fn_(els.filter((el)=>(!el[_changed_] && el.matches(selector))), ...args);
        });

        //
        if (!this.#attribListener.has(selector)) {
            this.$domListen(selector, (els)=>els.map((el)=>this.#listenAttributes(el, selector)));
            this.#attribListener.set(selector, [fn]);
        } else {
            this.#attribListener.get(selector).push(fn);
        }

        //
        return fn(this.dynamic(selector), selector);
    }

    //
    once(selector, fn, muted = true) {
        this.#muted = muted;
        const result = this.dynamic(selector).map(fn);
        this.#muted = false;
        return result;
    }

    // new events type, based on bubble and delegation
    // bindings to root element, not on every selected elements
    delegated(selector, args) {
        const dynamic = this.dynamic(selector);
        this.ROOT.addEventListener(args[0], async (e)=>{
            //await Timer.raf;
            if (e?.target?.matches?.(selector) && dynamic.indexOf(e.target) >= 0) {
                args[1](e);
            }
        }, {...(args?.[2]??{}), capture: args?.[2]?.capture ?? false, once: args?.[2]?.once ?? false, passive: args?.[2]?.passive ?? false});
        return dynamic;
    }

    // more agressive events type, based on capture or delegation
    // bindings to root element, not on every selected elements
    propogated(selector, args) {
        const dynamic = this.dynamic(selector);
        this.ROOT.addEventListener(args[0], async ($e)=>{
            const e = $e.clientX == null && $e.clientY == null && $e.detail ? $e.detail : $e;
            e.stopPropagation();
            let target = this.ROOT?.elementFromPoint?.(e.clientX, e.clientY);
            if (target != null) {
                if (target.matches(selector) && dynamic.indexOf(target) >= 0) {
                    await args[1]($e, target);
                } else

                // try on parent nodes
                if ((target = target.closest(selector)) != null && !args?.[2]?.targetOnly) {
                    if (target.matches(selector) && dynamic.indexOf(target) >= 0 && Array.from(this.ROOT?.elementsFromPoint?.(e.clientX, e.clientY)).indexOf(target) >= 0) {
                        await args[1]($e, target);
                    }
                }
            }
        }, {...(args?.[2]??{}), capture: args?.[2]?.capture ?? true, once: args?.[2]?.once ?? false, passive: args?.[2]?.passive ?? false});
        return dynamic;
    }

    #mutfn(fn) {
        return (...args)=>{
            this.#muted = true;
            const result = fn(...args);
            this.#muted = false;
            return result;
        }
    }

    //
    per(s, fn) {
        return this.$domListen(s, (e, sel = s, m) => this.#mutfn(e.map(async (el)=>{
            if (el.matches(sel) && (m == null || ["id", "class"].indexOf(m) >= 0) && !el[_changed_]) {
                await Timer.raf;
                el[_changed_] = true;
                const chg = await fn(el, sel, m);
                el[_changed_] = false;
                return chg;
            }
            return null;
        })));
    }

    //
    observe(s, attributes) {
        return this.$attribListen(s, (elements, selector = s, mutation = null) => {
            // pre-set attributes
            return this.#observeAttrib(selector ?? s, elements, attributes instanceof Map ? attributes : new Map(attributes), mutation);
        });
    }

    //
    sheet(s, attributes) {
        return this.$attribListen(s, (elements, selector = s, mutation = null) => {
            // pre-set attributes
            return this.#applyAttrib(selector ?? s, elements, attributes instanceof Map ? attributes : new Map(attributes), mutation);
        });
    }

    //
    event(s, args) {
        return this.$attribListen(s, (elements, selector = s, mutation = null) => {
            // pre-set attributes
            return this.#applyEvents(selector ?? s, elements, args);
        });
    }

    //
    attribCSS(s, attributes) {
        return this.$attribListen(s, (elements, selector = s, mutation = null) => {
            return this.#reflectAttribInStyle(selector ?? s, elements, attributes);
        });
    }

    //
    get defer() {
        const resolveOf = async (x)=>{
            if (['loading', 'interactive', 'complete'].indexOf(this.ROOT.readyState ?? document.readyState) >= 1) {
                await Timer.raf;
                x({}); return true;
            }
            return false;
        }
        return new Promise(async (x) => {
            if (!await resolveOf(x)) {
                document.addEventListener('readystatechange', (e)=>resolveOf(x), { once: false, passive: true });
            }
        });
    }

    //
    dynamic(s, i = 0) {
        return new Proxy(this.ROOT, new DynamicHandler(s, i));
    }
}
