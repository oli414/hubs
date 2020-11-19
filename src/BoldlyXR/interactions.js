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
                if (a.data.field == action.data.field &&
                    a.data.target == action.data.target) {
                    a.data.value = action.data.value;
                    return;
                }
            }
            this.actionsHistory.push(action);
        }
        else {
            this.actionsHistory.push(action);
        }
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
                    if (mdl.el.components["loop-animation"]) {
                        mdl.el.components["loop-animation"].currentActions[0].stop();
                        mdl.el.components["loop-animation"].currentActions[0].setLoop(0, 1);
                        mdl.el.components["loop-animation"].currentActions[0].play();
                    }
                    /*
                    const clip = THREE.AnimationClip.findByName(clips, 'Press');
                    if (clip) {
                        const action = mixer.clipAction(clip);
                        action.stop();
                        action.setLoop(0, 1);
                        action.play();
                    }
                    */

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
                                console.log("Inside: " + actionFields.action);
                                if (mediaComponent) {
                                    console.log("Mediacomp: " + actionFields.action);
                                    mediaComponent.togglePlaying();
                                    while (mediaComponent.video.currentTime > 0) {
                                        mediaComponent.seekBack();
                                    }
                                }
                                that.dispatchSet(actionFields.play, "visibility", !target.object3D.visible);
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
    }

    dispatchSet(target, field, value) {
        this.dispatchAction("set", {
            target: target,
            field: field,
            value: value
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
                console.log(target);
                console.log(data.field);
                console.log(data.value);
                if (data.field = "visibility") {
                    target.object3D.visible = data.value;
                }
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