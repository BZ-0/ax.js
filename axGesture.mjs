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
    #dragStatus = {};
    #resizeStatus = {};

    //
    constructor(holder) {
        this.#holder = holder;
        this.#getSizeDiff = Timer.cached((holder, container, shifting = [0, 0])=>{
            const widthDiff  = container.clientWidth  - (holder.offsetWidth  - shifting[0]);
            const heightDiff = container.clientHeight - (holder.offsetHeight - shifting[1]);
            return [widthDiff, heightDiff];
        }, 100);
    }


    //
    swipe(options) {
        if (options?.handler) {

            //
            const swipes = new Map([

            ]);

            //
            options?.handler?.addEventListener("pointerdown", (ev)=>{
                if (ev.target == options?.handler) {
                    swipes.set(ev.pointerId, {
                        target: ev.target,
                        start: [ev.pageX, ev.pageY],
                        current: [ev.pageX, ev.pageY],
                        pointerId: ev.pointerId,
                        startTime: performance.now(),
                        time: performance.now(),
                        speed: 0
                    });
                }
            });

            //
            const registerMove = (ev)=>{
                if (swipes.has(ev.pointerId)) {
                    const swipe = swipes.get(ev.pointerId);
                    //const diffP = [ev.pageX - swipe.current[0], ev.pageY - swipe.current[1]];
                    //const diffT = (performance.now() - swipe.time);

                    //
                    //const speed = Math.hypot(...diffP) / AQ.pixelRatio / diffT;

                    //
                    Object.assign(swipe, {
                        //speed: (swipe.speed == 0 ? speed : (speed * 0.8 + swipe.speed * 0.2)),
                        current: [ev.pageX, ev.pageY],
                        pointerId: ev.pointerId,
                        time: performance.now()
                    });
                }
            }

            //
            const compAngle = (a, c)=>{
                return (a-c+540) % 360 - 180;
            }

            //
            const comleteSwipe = (pointerId)=>{
                if (swipes.has(pointerId)) {
                    const swipe = swipes.get(pointerId);
                    const diffP = [swipe.start[0] - swipe.current[0], swipe.start[1] - swipe.current[1]];
                    const diffT = (performance.now() - swipe.startTime);

                    //
                    const speed = Math.hypot(...diffP) / AQ.pixelRatio / diffT;
                    swipe.speed = speed;

                    //
                    if (swipe.speed > (options.threshold || 0.5)) {
                        const swipeAngle = Math.atan2((swipe.current[1] - swipe.start[1]), (swipe.current[0] - swipe.start[0]));
                        swipe.swipeAngle = swipeAngle;
                        swipe.direction = "name";

                        //
                        if (Math.abs(compAngle(swipe.swipeAngle * (180 / Math.PI), 0)) <= 20) {
                            //AR.get(el.getAttribute("data-swipe-action-left"))?.(el);
                            swipe.direction = "left";
                        }

                        if (Math.abs(compAngle(swipe.swipeAngle * (180 / Math.PI), 180)) <= 20) {
                            //AR.get(el.getAttribute("data-swipe-action-right"))?.(el);
                            swipe.direction = "right";
                        }

                        if (Math.abs(compAngle(swipe.swipeAngle * (180 / Math.PI), 270)) <= 20) {
                            //AR.get(el.getAttribute("data-swipe-action-up"))?.(el);
                            swipe.direction = "up";
                        }

                        if (Math.abs(compAngle(swipe.swipeAngle * (180 / Math.PI), 90)) <= 20) {
                            //AR.get(el.getAttribute("data-swipe-action-down"))?.(el);
                            swipe.direction = "down";
                        }

                        options?.trigger?.(swipe);
                    }
                    swipes.delete(pointerId);
                }
            }

            //
            document.addEventListener("pointermove", registerMove, {capture: true});
            document.addEventListener("pointerup", (ev)=>comleteSwipe(ev.pointerId), {capture: true});
            document.addEventListener("pointercancel", (ev)=>comleteSwipe(ev.pointerId), {capture: true});

        }


    }

    
    //
    limitResize(status, holder, container) {
        const [widthDiff, heightDiff] = this.#getSizeDiff(holder, container, [
            this.propGet("--rsx")||0,
            this.propGet("--rsy")||0
        ]);

        // if centered
        status.realTranslate[0] = clamp(0, status.translate[0], widthDiff);
        status.realTranslate[1] = clamp(0, status.translate[1], heightDiff);

        //
        this.propFloat("--rsx", status.realTranslate[0]);
        this.propFloat("--rsy", status.realTranslate[1]);

        // if top-left aligned
        //status.translate[0] = clamp(0, status.translate[0], widthDiff );
        //status.translate[1] = clamp(0, status.translate[1], heightDiff);
    }


    //
    limitDrag(status, holder, container) {
        const [widthDiff, heightDiff] = this.#getSizeDiff(holder, container) || [0, 0];

        // if centered
        status.realTranslate[0] = clamp(-widthDiff *0.5, status.translate[0], widthDiff *0.5);
        status.realTranslate[1] = clamp(-heightDiff*0.5, status.translate[1], heightDiff*0.5);

        // if top-left aligned
        //status.translate[0] = clamp(0, status.translate[0], widthDiff );
        //status.translate[1] = clamp(0, status.translate[1], heightDiff);

        this.propFloat("--rx", status.realTranslate[0]);
        this.propFloat("--ry", status.realTranslate[1]);
    }


    //
    resizable(options) {
        const handler = options.handler ?? this.#holder;
        const status = {
            pointerId: -1,
            realTranslate: [
                this.propGet("--rsx") || 0,
                this.propGet("--rsy") || 0,
            ],
            translate: [
                this.propGet("--rsx") || 0,
                this.propGet("--rsy") || 0,
            ]
        }

        //
        this.propFloat("--rsx", status.realTranslate[0] || 0);
        this.propFloat("--rsy", status.realTranslate[1] || 0);

        //
        this.#resizeStatus = status;

        //
        const dragMove = [(ev)=>{
            if (status.pointerId == ev.pointerId) {
                const diff = [
                    AQ.movementX(ev.pointerId),
                    AQ.movementY(ev.pointerId)
                ]

                //
                const previous = [...status.realTranslate];

                //
                status.translate[0] += diff[0];
                status.translate[1] += diff[1];
                this.limitResize(status, this.#holder, this.#holder.parentNode);

                //
                this.#dragStatus.translate[0] += (status.realTranslate[0]-previous[0])/2;
                this.#dragStatus.translate[1] += (status.realTranslate[1]-previous[1])/2;

                //
                this.limitDrag(this.#dragStatus, this.#holder, this.#holder.parentNode);
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

        handler.addEventListener("pointerdown", (ev)=>{
            if (status.pointerId < 0) {
                status.pointerId = ev.pointerId

                //
                status.translate[0] = (this.propGet("--rsx")??status.realTranslate[0])||0;
                status.translate[1] = (this.propGet("--rsy")??status.realTranslate[1])||0;
                status.realTranslate[0] = status.translate[0];
                status.realTranslate[1] = status.translate[1];

                //
                document.addEventListener('pointermove', ...dragMove)
                document.addEventListener('pointerup', ...dragEnd)
                document.addEventListener('pointercancel', ...dragEnd)
            }
        }, { capture: false, passive: false });
    }

    //
    draggable(options) {
        const handler = options.handler ?? this.#holder;
        const status = {
            pointerId: -1,
            realTranslate: [
                this.propGet("--rx") || 0,
                this.propGet("--ry") || 0,
            ],
            translate: [
                this.propGet("--rx") || 0,
                this.propGet("--ry") || 0,
            ]
        }

        //
        this.propFloat("--rx", status.realTranslate[0] || 0);
        this.propFloat("--ry", status.realTranslate[1] || 0);

        //
        this.#dragStatus = status;

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

        handler.addEventListener("pointerdown", (ev)=>{
            if (status.pointerId < 0) {
                status.pointerId = ev.pointerId

                //
                status.translate[0] = (this.propGet("--rx")??status.realTranslate[0])||0,
                status.translate[1] = (this.propGet("--ry")??status.realTranslate[1])||0
                status.realTranslate[0] = status.translate[0];
                status.realTranslate[1] = status.translate[1];

                //
                document.addEventListener('pointermove', ...dragMove)
                document.addEventListener('pointerup', ...dragEnd)
                document.addEventListener('pointercancel', ...dragEnd)
            }
        }, { capture: false, passive: false });
    }

    //
    propGet(name) {
        const prop = this.#holder.style.getPropertyValue(name)
        const num = (prop != null && prop != "") ? (parseFloat(prop)||0) : null;
        return num || null;
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
