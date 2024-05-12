import Timer from "./axTime.mjs"
import AQ from "./axQuery.mjs"

//
const clamp = (min, val, max)=>{
    return Math.max(min, Math.min(val, max));
}

//
const tpm = (callback = ()=>{}, timeout = 1000)=>{
    return new Promise((resolve, reject) => {
        // Set up the timeout
        const timer = setTimeout(() => {
            reject(new Error(`Promise timed out after ${timeout} ms`));
        }, timeout);

        // Set up the real work
        callback(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                clearTimeout(timer);
                reject(error);
            }
        );
    });
}

export default class AxGesture {
    #holder = null;
    #getSizeDiff = ()=>{};

    //
    constructor(holder) {
        this.#holder = holder;
        this.#getSizeDiff = Timer.cached((holder, container)=>{
            const widthDiff  = container.clientWidth  - holder.offsetWidth;
            const heightDiff = container.clientHeight - holder.offsetHeight;
            return [widthDiff, heightDiff];
        }, 100);
    }

    //
    limitDrag(status, holder, container) {
        const [widthDiff, heightDiff] = this.#getSizeDiff(holder, container) || [0, 0];

        // if centered
        status.translate[0] = clamp(-widthDiff *0.5, status.translate[0], widthDiff *0.5);
        status.translate[1] = clamp(-heightDiff*0.5, status.translate[1], heightDiff*0.5);

        // if top-left aligned
        //status.translate[0] = clamp(0, status.translate[0], widthDiff );
        //status.translate[1] = clamp(0, status.translate[1], heightDiff);
    }

    //
    draggable(options) {
        const handler = options.handler ?? this.#holder;
        const status = {
            pointerId: -1,
            translate: [0, 0]
        }

        //
        const dragMove = [(ev)=>{
            if (status.pointerId == ev.pointerId) {
                status.translate[0] += AQ.movementX(ev.pointerId);
                status.translate[1] += AQ.movementY(ev.pointerId);
                this.limitDrag(status, this.#holder, this.#holder.parentNode);
            }
        }, { capture: true, passive: false }];

        //
        const dragEnd = [(ev)=>{
            if (status.pointerId == ev.pointerId) {
                status.pointerId = -1;

                //
                document.removeEventListener("pointermove", ...dragMove);
                document.removeEventListener("pointerup", ...dragEnd);
                document.removeEventListener("pointercancel", ...dragEnd);
            }
        }, { capture: true, passive: false}]

        // TODO: draggable library
        handler.addEventListener("pointerdown", (ev)=>{
            if (status.pointerId < 0 && window.matchMedia("(width >= 10in)").matches) {
                status.pointerId = ev.pointerId;

                //
                document.addEventListener("pointermove", ...dragMove);
                document.addEventListener("pointerup", ...dragEnd);
                document.addEventListener("pointercancel", ...dragEnd);
            }
        }, { capture: false, passive: false });

        //
        Timer.rafLoop(()=>{
            if (status.pointerId >= 0) {
                this.limitDrag(status, this.#holder, this.#holder.parentNode);
                this.propFloat("--rx", status.translate[0]);
                this.propFloat("--ry", status.translate[1]);
            }
        }, handler);
    }

    //
    propFloat(name, val) {
        if (parseFloat(this.#holder.style.getPropertyValue(name)) != val) {
            this.#holder.style.setProperty(name, val, "");
        }
    }

    //
    longtap(fx, options) {
        const handler = options.handler || this.#holder;
        const action  = {
            pointerId    : -1,
            timer        : null,
            cancelPromise: null,
            imTimer      : null,
            pageCoord    : [0, 0],
            lastCoord    : [0, 0],
            ready        : false
        };

        //
        const prepare = (resolve, action, ev)=>{
            return async ()=>{
                if (action.pointerId == ev.pointerId) resolve?.();
            }
        }

        //
        const inPlace = ()=>{
            return (Math.hypot(...action.lastCoord.map((n,i)=>((action?.pageCoord?.[i]||0)-n))) / AQ.pixelRatio) <= (options?.maxOffsetRadius ?? 10);
        }

        //
        const immediate = (resolve, action, ev)=>{
            return async ()=>{
                if (action.pointerId == ev.pointerId) {
                    if (inPlace()) {
                        resolve?.();
                        fx?.(ev);
                    }
                    action.cancelRv?.();
                }
            }
        }

        //
        const forMove = [null, {capture: true}];
        const forCanc = [null, {capture: true}];

        //
        const registerCoord = [(ev) => {
            if (ev.pointerId == action.pointerId) {
                action.lastCoord[0] = ev.pageX;
                action.lastCoord[1] = ev.pageY;
            }
        }, {capture: true, passive: true}];

        //
        const triggerOrCancel = (ev) => {
            if (ev.pointerId == action.pointerId) {
                action.lastCoord[0] = ev.pageX;
                action.lastCoord[1] = ev.pageY;

                //
                ev.preventDefault();
                ev.stopPropagation();

                // JS math logic megalovania...
                if (action.ready) {
                    immediate(null, action, ev);
                } else {
                    action.cancelRv?.();
                }
            }
        }

        //
        const cancelWhenMove = (ev) => {
            if (ev.pointerId == action.pointerId) {
                action.lastCoord[0] = ev.pageX;
                action.lastCoord[1] = ev.pageY;

                //
                ev.preventDefault();
                ev.stopPropagation();

                // JS math logic megalovania...
                if (!inPlace()) {
                    action.cancelRv?.();
                }
            }
        }

        //
        forCanc[0] = triggerOrCancel;
        forMove[0] = cancelWhenMove;

        //
        handler.addEventListener('pointerdown', ev => {
            if (action.pointerId < 0 && (options.anyPointer || ev.pointerType == "touch")) {
                ev.preventDefault();
                ev.stopPropagation();

                //
                action.pageCoord = [ev.pageX, ev.pageY];
                action.lastCoord = [ev.pageX, ev.pageY];
                action.pointerId =  ev.pointerId;
                action.cancelPromise = new Promise((rv)=>{
                    action.cancelRv = () => {
                        //
                        document.removeEventListener('pointerup'    , ...forCanc);
                        document.removeEventListener('pointercancel', ...forCanc);
                        document.removeEventListener('pointermove'  , ...forMove);

                        //
                        clearTimeout(action.timer);
                        clearTimeout(action.imTimer);
                        action.ready         = false;
                        action.timer         = null;
                        action.imTimer       = null;
                        action.cancelRv      = null;
                        action.cancelPromise = null;
                        action.pointerId     = -1;
                        rv();
                    }
                });

                //
                if (ev.pointerType == "mouse" && options.mouseImmediate) {
                    fx?.(ev); action?.cancelRv?.();
                } else {
                    //
                    Promise.any([
                        tpm((resolve, $rj) => (action.timer   = setTimeout(  prepare(resolve, action, ev), options?.minHoldTime ?? 300)), 1000*5).then(()=>(action.ready=true)),
                        tpm((resolve, $rj) => (action.imTimer = setTimeout(immediate(resolve, action, ev), options?.maxHoldTime ?? 600)), 1000),
                        action.cancelPromise
                    ])
                        .catch(console.warn.bind(console))
                        .then(action.cancelRv);
                }

                //
                document.addEventListener('pointerup'    , ...forCanc);
                document.addEventListener('pointercancel', ...forCanc);
                document.addEventListener('pointermove'  , ...forMove);
            }
        }, {passive: false, capture: false});

        //
        document.addEventListener('pointerup'    , ...registerCoord);
        document.addEventListener('pointercancel', ...registerCoord);
        document.addEventListener('pointermove'  , ...registerCoord);
    }

}
