/* exported init, cleanup, get_animation_status, get_transparency_status, minimum_fade_in, update_transition_type */
/* exported fade_in, fade_out */

const Lang = imports.lang;

const Main = imports.ui.main;
const Panel = Main.panel;

const Params = imports.misc.params;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Settings = Me.imports.settings;
const Theming = Me.imports.theming;
const Util = Me.imports.util;

const TIME_SCALE_FACTOR = 1000;

/**
 * Intialize.
 *
 */
function init() {
    /* Objects to track where the transparency is and where it's going. */
    this.status = new TransparencyStatus();
    this.animation_status = new AnimationStatus();
    this.transition_type = TransitionType.from_index(Settings.get_transition_type());

    /* Override the gnome animation preferences if need be. The default tweener obeys animation settings, the core one doesn't. */
    if (Settings.get_force_animation()) {
        this.tweener = imports.tweener.tweener;
    } else {
        this.tweener = imports.ui.tweener;
    }

    /* Register our property with the tweener of choice. */
    this.tweener.registerSpecialProperty('background_alpha', Theming.get_background_alpha, Theming.set_background_alpha);
}

/**
 * Freeup any held assets on disable.
 *
 */
function cleanup() {
    this.animation_status = null;
    this.transition_type = null;
    this.status = null;
    this.tweener = null;
}

/**
 * Updates the default transition type from settings.
 *
 */
function update_transition_type() {
    this.transition_type = TransitionType.from_index(Settings.get_transition_type());
}


/**
 * Get the current status of the panel's transparency.
 *
 * @returns {Object} Current transparency. @see TransparencyStatus
 */
function get_transparency_status() {
    return this.status;
}

/**
 * Get any animation that the panel is currently doing.
 *
 * @returns {Object} Current animation status. @see AnimationStatus
 */
function get_animation_status() {
    return this.animation_status;
}

/**
 * Fades the panel into the unmaximized (minimum) alpha. Used for closing the overview.
 *
 * @param {Object} params [params=null] - Parameters for the transition.
 * @param {Number} params.time - Transition speed in milliseconds.
 */
function minimum_fade_in(params) {
    if (Main.overview.visible || Main.overview._shown)
        return;

    params = Params.parse(params, { time: Settings.get_transition_speed(), transition: this.transition_type, interruptible: false });

    if (params.interruptible || this.animation_status.ready() || !this.animation_status.same(AnimationAction.FADE_IN, AnimationDestination.MINIMUM)) {
        this.animation_status.set(AnimationAction.FADE_IN, AnimationDestination.MINIMUM);
    } else {
        return;
    }



    let transition = TransitionType.to_code_string(params.transition, AnimationAction.FADING_IN);

    this.status.set_transparent(true);
    this.status.set_blank(false);

    let time = params.time / TIME_SCALE_FACTOR;

    Theming.set_panel_color();

    /* Avoid Tweener if the time or opacity don't require it. */
    if (time <= 0 || Theming.get_unmaximized_opacity() <= 0) {
        Theming.set_background_alpha(Panel.actor, Theming.get_unmaximized_opacity());
        this.fade_in_complete();
        this.animation_status.done();
    } else {
        this.tweener.addTween(Panel.actor, {
            time: time,
            transition: transition,
            background_alpha: Theming.get_unmaximized_opacity(),
            onComplete: Lang.bind(this, fade_in_complete)
        });
    }
}

/**
 * Fades the panel into the nmaximized (maximum) alpha.
 *
 * @param {Object} params [params=null] - Parameters for the transition.
 * @param {Number} params.time - Transition speed in milliseconds.
 */
function fade_in(params) {
    if (Main.overview.visible || Main.overview._shown)
        return;

    params = Params.parse(params, { time: Settings.get_transition_speed(), transition: this.transition_type, interruptible: false });

    if (params.interruptible || this.animation_status.ready() || !this.animation_status.same(AnimationAction.FADE_IN, AnimationDestination.MAXIMUM)) {
        this.animation_status.set(AnimationAction.FADE_IN, AnimationDestination.MAXIMUM);
    } else {
        return;
    }

    let transition = TransitionType.to_code_string(params.transition, AnimationAction.FADING_IN);

    this.status.set_transparent(false);
    this.status.set_blank(false);

    let time = params.time / TIME_SCALE_FACTOR;

    Theming.set_panel_color();

    if (time <= 0) {
        Theming.set_background_alpha(Panel.actor, Theming.get_maximized_opacity());
        this.fade_in_complete();
        this.animation_status.done();
    } else {
        this.tweener.addTween(Panel.actor, {
            time: time,
            transition: transition,
            background_alpha: Theming.get_maximized_opacity(),
            onComplete: Lang.bind(this, fade_in_complete)
        });
    }
}

/**
 * Callback for when a fade_in transition is completed.
 *
 */
function fade_in_complete() {
    if (Main.overview._shown) {
        blank_fade_out();
        return;
    }

    if (!Settings.get_hide_corners()) {
        update_corner_alpha();
    }

    if (!Settings.remove_panel_styling()) {
        Theming.reapply_panel_styling();
    }

    this.animation_status.done();
}

// TODO: Could this be used for minimum_fade_in?

/**
 * Fades the panel into the unmaximized (minimum) alpha.
 *
 * @param {Object} params [params=null] - Parameters for the transition.
 * @param {Number} params.time - Transition speed in milliseconds.
 */
function fade_out(params) {
    params = Params.parse(params, { time: Settings.get_transition_speed(), transition: this.transition_type, interruptible: false });

    if (params.interruptible || this.animation_status.ready() || !this.animation_status.same(AnimationAction.FADE_OUT, AnimationDestination.MINIMUM)) {
        this.animation_status.set(AnimationAction.FADE_OUT, AnimationDestination.MINIMUM);
    } else {
        return;
    }

    let transition = TransitionType.to_code_string(params.transition, AnimationAction.FADING_OUT);

    this.status.set_transparent(true);
    this.status.set_blank(false);

    let time = params.time / TIME_SCALE_FACTOR;

    /* we can't actually fade these, so we'll attempt to hide the fact we're jerkily removing them */
    /* always hide to update preference changes */
    if (!Settings.get_hide_corners()) {
        update_corner_alpha();
    } else {
        update_corner_alpha(0);
    }

    Theming.strip_panel_styling();

    if (time <= 0 && !Main.overview._shown) {
        Theming.set_background_alpha(Panel.actor, Theming.get_unmaximized_opacity());
        Theming.set_panel_color();
        this.animation_status.done();
    } else if (Main.overview._shown) {
        blank_fade_out({
            time: 0
        });
    } else {
        this.tweener.addTween(Panel.actor, {
            time: time,
            transition: transition,
            background_alpha: Theming.get_unmaximized_opacity(),
            onComplete: Lang.bind(this, function () {
                Theming.set_panel_color();
                this.animation_status.done();
            })
        });
    }

}


/**
 * Fades the panel's alpha to 0. Used for opening the overview & displaying the screenShield.
 *
 * @param {Object} params [params=null] - Parameters for the transition.
 * @param {Number} params.time - Transition speed in milliseconds.
 */
function blank_fade_out(params) {
    params = Params.parse(params, { time: Settings.get_transition_speed(), transition: this.transition_type, interruptible: false });

    if (params.interruptible || this.animation_status.ready() || !this.animation_status.same(AnimationAction.FADE_OUT, AnimationDestination.BLANK)) {
        this.animation_status.set(AnimationAction.FADE_OUT, AnimationDestination.BLANK);
    } else {
        return;
    }

    let transition = TransitionType.to_code_string(params.transition, AnimationAction.FADING_IN);

    this.status.set_transparent(true);
    this.status.set_blank(true);

    let time = params.time / TIME_SCALE_FACTOR;

    /* we can't actually fade these, so we'll attempt to hide the fact we're jerkily removing them */
    /* always hide to update preference changes */

    update_corner_alpha(0);

    if (time <= 0) {
        Theming.set_background_alpha(Panel.actor, 0);
        Theming.set_panel_color();
        this.animation_status.done();
    } else {
        this.tweener.addTween(Panel.actor, {
            time: time,
            transition: transition,
            background_alpha: 0,
            onComplete: Lang.bind(this, function () {
                Theming.set_panel_color();
                this.animation_status.done();
            })
        });
    }
}


/**
 * Updates the alpha value of the corners' coloring. Slightly awkward overlap is unavoidable.
 *
 * @param {Number} alpha - Alpha value ranging from 0-255.
 */
function update_corner_alpha(alpha = null) {
    if (alpha === null) {
        alpha = this.status.is_transparent() ? Theming.get_unmaximized_opacity() : Theming.get_maximized_opacity();
    }

    Theming.set_corner_color({
        alpha: alpha
    });
}

const TransparencyStatus = new Lang.Class({
    Name: 'DynamicPanelTransparency_TransparencyStatus',
    _init: function () {
        this.transparent = false;
        this.blank = false;
    },
    is_transparent: function () {
        return this.transparent;
    },
    is_blank: function () {
        return this.blank;
    },
    set_transparent: function (transparent) {
        this.transparent = transparent;
    },
    set_blank: function (blank) {
        this.blank = blank;
    }
});

const AnimationStatus = new Lang.Class({
    Name: 'DynamicPanelTransparency_AnimationStatus',
    _init: function () {
        this.destination = null;
        this.action = null;
    },
    get_action: function () {
        return this.action;
    },
    get_destination: function () {
        return this.destination;
    },
    set: function (action, destination) {
        this.action = action;
        this.destination = destination;
    },
    done: function () {
        this.action = null;
        this.destination = null;
    },
    same: function (action, destination) {
        return (this.action === action && this.destination === destination);
    },
    ready: function () {
        return (this.action === null && this.destination === null);
    }
});

const TransitionType = {
    LINEAR: { code: 'linear', name: 'Linear', index: 1 },
    SINE: { code: 'Sine', name: 'Sine', index: 2 },
    QUAD: { code: 'Quad', name: 'Quadratic', index: 3 },
    CUBIC: { code: 'Cubic', name: 'Cubic', index: 4 },
    QUARTIC: { code: 'Quart', name: 'Quartic', index: 5 },
    QUINTIC: { code: 'Quint', name: 'Quintic', index: 6 },
    EXPONENTIAL: { code: 'Expo', name: 'Exponential', index: 7 },
    CIRCULAR: { code: 'Circ', name: 'Circle', index: 8 },
    BACK: { code: 'Back', name: 'Back', index: 15 },
    ELASTIC: { code: 'Elastic', name: 'Elastic', index: 9 },
    BOUNCE: { code: 'Bounce', name: 'Bounce', index: 10 },
    from_index: function (search_index) {
        for (let key in this) {
            let value = this[key];
            if (typeof (value) === 'object' && search_index === value.index) {
                return value;
            }
        }
        return null;
    },
    to_code_string: function (type, action) {
        /* 'linear' is a special case. It doesn't have in/out modes. */
        if (type.code === this.LINEAR.code) {
            return this.LINEAR.code;
        }
        return (action === AnimationAction.FADING_IN ? 'easeIn' : 'easeOut') + type.code;
    }
};
Util.deep_freeze(TransitionType);

const AnimationAction = {
    FADING_OUT: 0,
    FADING_IN: 1
};
Util.deep_freeze(AnimationAction);

const AnimationDestination = {
    BLANK: 0,
    MINIMUM: 1,
    MAXIMUM: 2
};
Util.deep_freeze(AnimationDestination);
