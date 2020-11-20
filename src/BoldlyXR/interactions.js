import {
    isIn2DInterstitial,
    handleExitTo2DInterstitial,
    exit2DInterstitialAndEnterVR,
    forceExitFrom2DInterstitial
  } from "../utils/vr-interstitial";

class BoldInteractions {
    constructor() {
        this.actionsHistory = [];
        this.synced = false;

        this.hideChatActions = true;

        this.registeredAnimationMixers = [];

        this.lastUpdate = Date.now();
        this.tick();
    }

    tick() {
        var now = Date.now();
        var dt = (now - this.lastUpdate) / 1000;
        this.lastUpdate = now;
            
        for (let i = 0; i < this.registeredAnimationMixers.length; i++) {
            this.registeredAnimationMixers[i].update(dt);
        }

        window.requestAnimationFrame(this.tick.bind(this));
    }

    appendToActionHistory(action) {
        if (action.type == "set") {
            for (let i = 0; i < this.actionsHistory.length; i++) {
                let a = this.actionsHistory[i];
                if (a.type == action.type) {
                    if (a.data.field == action.data.field &&
                        a.data.target == action.data.target) {
                        a.data.value = action.data.value;
                        return;
                    }
                }
            }
            this.actionsHistory.push(action);
        }
        else if (action.type == "toggle") {
            for (let i = 0; i < this.actionsHistory.length; i++) {
                let a = this.actionsHistory[i];
                if (a.type == action.type) {
                    if (a.data.identifier == action.data.identifier) {
                        a.data.active = action.data.active;
                        return;
                    }
                }
            }
            this.actionsHistory.push(action);
        }
        else {
            this.actionsHistory.push(action);
        }
    }

    getToggle(toggleName) {
        for (let i = 0; i < this.actionsHistory.length; i++) {
            let a = this.actionsHistory[i];
            if (a.type == "toggle") {
                if (a.data.identifier == toggleName) {
                    return a;
                }
            } 
        }
        return null;
    }

    findExtraChildren(parent) {
        let tot = [];
        if (parent.name.endsWith("}")) {
            tot.push(parent);
        }
        for (let i = 0; i < parent.children.length; i++) {
          const c = parent.children[i];
          const r = this.findExtraChildren(c);
          tot = tot.concat(r);
        }
        return tot;
    }
  
    findEntityByName(name) {
        let root = document.getElementById("environment-scene");
        let res = this.findChildByName(root, name);
        return res;
    }
  
    findChildByName(parent, name) {
        let children = parent.querySelectorAll(":scope > a-entity"); // Immediate children
        for (let i = 0; i < children.length; i++) {
          const c = children[i];
          if (c.name == name) {
            return c;
          }
          else if (c.object3D && c.object3D.name == name) {
            return c;
          }
        }
        for (let i = 0; i < children.length; i++) {
          const c = children[i];
          const r = this.findChildByName(c, name);
          if (r !== null) {
            return r;
          }
        }
        return null;
    }

    breakdownName(obj) {
      let start = obj.name.indexOf("{");
      let end = obj.name.indexOf("}");
      if (start < 0 || end < 0) {
        return null;
      }
      let sub = obj.name.slice(start + 1, end);
      let fields = sub.split(",");
      let out = {};
      for (let i = 0; i < fields.length; i++) {
        let data = fields[i].split("=");
        if (data.length == 2) {
          out[data[0]] = data[1];
        }
      }
      return out;
    }

    setupModelClickAction(comp) {
        let that = this;
        comp.el.addEventListener("model-loaded", (data) => {
            console.log("MODEL LOADED");
            let models = that.findExtraChildren(comp.el.object3D);
            for (let i = 0; i < models.length; i++) {
                let mdl = models[i];
                mdl.el.classList.add("interactable");
                mdl.el.setAttribute("tags", "singleActionButton: true");
                mdl.el.setAttribute("is-remote-hover-target", "");
                AFRAME.scenes[0].systems["hubs-systems"].cursorTargettingSystem.targets.push(comp.el);

                //if (mdl.name.includes("2")) {
                if (mdl.el.components["loop-animation"]) {
                    mdl.el.components["loop-animation"].currentActions[0].stop();
                }
                //}
                /*
                const mixer = new THREE.AnimationMixer(mdl);
                const clips = mdl.animations;
                this.registeredAnimationMixers.push(mixer);
                */

                let actionFields = that.breakdownName(mdl);
                comp.onClick = () => {
                   that.dispatchAction("animate", { target: mdl.name });

                    if (actionFields.target) {
                        let target = that.findEntityByName(actionFields.target);

                        if (target) {
                            let mediaComponent = null;
                            if (target.components["media-video"]) {
                                mediaComponent = target.components["media-video"];
                            }

                            if (actionFields.action == "play") {
                                if (mediaComponent) {
                                    mediaComponent.togglePlaying();
                                    while (mediaComponent.video.currentTime > 0) {
                                        mediaComponent.seekBack();
                                    }
                                }
                            }
                            else if (actionFields.action == "switch-play") {
                                if (mediaComponent) {
                                    if (mediaComponent.video.paused) {
                                        mediaComponent.togglePlaying();
                                        while (mediaComponent.video.currentTime > 0) {
                                            mediaComponent.seekBack();
                                        }
                                    }
                                }
                                let toggle = this.getToggle(actionFields.id);
                                if (toggle) {
                                    let previousTarget = that.findEntityByName(toggle.active);
                                    if (previousTarget) {
                                        if (previousTarget.components["media-video"]) {
                                            if (!previousTarget.components["media-video"].video.paused) {
                                                previousTarget.components["media-video"].togglePlaying();
                                            }
                                        }
                                    }
                                }
                                if (toggle && toggle.data.active == actionFields.target) {
                                    that.dispatchToggle(actionFields.id, "null");
                                }
                                else {
                                    that.dispatchToggle(actionFields.id, actionFields.target);
                                }
                            }
                        }
                        if (actionFields.action == "info") {
                            that.openInfoPanel();
                        }
                    }
                };
                mdl.addEventListener("interact", comp.onClick);
            }
        });
    }

    sendMessage(txt) {
        console.log(txt);
        document.getElementById("avatar-rig").messageDispatch.dispatch(txt);
    }

    isActionMessage(msg) {
        if (msg.body.startsWith("*#@#*")) {
            return true;
        }
        return false;
    }

    handleActionMessage(msg) {
        if (msg.body.startsWith("*#@#*")) {
            let strAction = msg.body.substring(5);
            let obj = JSON.parse(strAction);
            this.onAction(obj.type, obj.data);
        }
    }

    dispatchAction(type, data) {
        let pckg = {
            type: type,
            data: data
        };
        this.sendMessage("*#@#*" + JSON.stringify(pckg));
        this.onAction(type, data);
    }

    dispatchSet(target, field, value) {
        this.dispatchAction("set", {
            target: target,
            field: field,
            value: value
        });
    }

    dispatchToggle(identifier, active) {
        this.dispatchAction("toggle", {
            identifier: identifier,
            active: active
        });
    }

    onAction(type, data) {
        if (type == "sync" && !this.synced) {
            if (this.actionsHistory.length == 0 && this.actionsHistory.length < data.length) {
                type = "multi";
                this.synced = true;
            }
            else {
                return;
            }
        }
        if (!this.synced) {
            this.synced = true;
        }
        if (type == "multi") {
            for (let i = 0; i < data.length; i++) {
                this.onAction(data[i].type, data[i].data);
            }
        }
        else {
            console.log("Received action: " + type);
            if (type == "set") {
                let target = this.findEntityByName(data.target);
                if (data.field = "visibility") {
                    target.object3D.visible = data.value == true;
                }
            }
            else if (type == "toggle") {
                let toggle = this.getToggle(data.identifier);
                console.log("toggle ID: " + data.identifier);
                if (toggle) {
                    console.log("active value: " + toggle.data.active);
                    if (toggle.data.active != "null") {
                        let target = this.findEntityByName(toggle.data.active);
                        target.object3D.visible = false;
                    }
                }
                if (data.active != "null") {
                    let target = this.findEntityByName(data.active);
                    target.object3D.visible = true;
                }
            }
            else if (type == "animate") {
                let target = this.findEntityByName(data.target);
                if (target.components["loop-animation"]) {
                    if (target.components["loop-animation"].currentActions[0]) {
                        target.components["loop-animation"].currentActions[0].stop();
                        target.components["loop-animation"].currentActions[0].setLoop(0, 1);
                        target.components["loop-animation"].currentActions[0].play();
                    }
                }
                return;
            }

            this.appendToActionHistory({
                type: type, 
                data: data
            });
        }
    }

    onUserJoined() {
        if (this.synced) {
            this.dispatchAction("sync", this.actionsHistory);
        }
    }

    openInfoPanel() {
        handleExitTo2DInterstitial();
        window.UIRootInstance.pushHistoryState("modal", "boldly_info_panel");
    }
}

window.BoldInteractions = new BoldInteractions();

export default window.BoldInteractions;