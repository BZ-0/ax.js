export default class State {
    static $story = new Set();

    //
    constructor() {
        
    }

    //
    static pushState(obj, href) {
        const prevState = this.$story.size > 0 ? this.$story.get(this.$story.size-1) : null;

        //
        const state = [obj, "", location.hash = href];
        history.pushState(...state);
        this.$story.add(state);

        //
        const event = new CustomEvent("mx-push-state", { detail: {
            prevState, state
        } });
    }

    //
    static replaceState(obj, href) {
        this.back();
        this.pushState(obj, href);
    }

    //
    static back() {
        const prevState = this.$story.size > 0 ? this.$story.get(this.$story.size-1) : null;
        history.back();this.$story.remove(this.$story.size-1);
        const state = this.$story.get(this.$story.size-1);

        //
        const event = new CustomEvent("mx-pop-state", { detail: {
            prevState, state
        } });
    }
}