import { Euler } from "three";
import {
    isIn2DInterstitial,
    handleExitTo2DInterstitial,
    exit2DInterstitialAndEnterVR,
    forceExitFrom2DInterstitial
  } from "../utils/vr-interstitial";
  import { pushHistoryState } from "../utils/history";

class BoldInteractions {
    constructor() {
        this.actionsHistory = [];
        this.synced = false;
        this.localStore = {};

        this.hideChatActions = true;

        this.registeredAnimationMixers = [];

        this.lastUpdate = Date.now();
        this.tick();

        this.infoPanelUrl = "";
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
                    if (a.data.target) {
                        if (a.data.field == action.data.field &&
                            a.data.target == action.data.target) {
                            a.data.value = action.data.value;
                            return;
                        }
                    }
                    else {
                        if (a.data.field == action.data.field) {
                            a.data.value = action.data.value;
                            return;
                        }
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

    radiansToDegrees(radians) {
        return radians * 57.2957795;
    }

    setupModelClickAction(comp) {
        let that = this;
        comp.el.addEventListener("model-loaded", (data) => {
            let models = that.findExtraChildren(comp.el.object3D);
            for (let i = 0; i < models.length; i++) {
                let mdl = models[i];
                let actionFields = that.breakdownName(mdl);
                mdl.actionFields = actionFields;

                mdl.el.classList.add("interactable");
                mdl.el.setAttribute("tags", "singleActionButton: true");
                mdl.el.setAttribute("is-remote-hover-target", "");
                AFRAME.scenes[0].systems["hubs-systems"].cursorTargettingSystem.targets.push(comp.el);

                if (mdl.el.components["loop-animation"]) { 
                    mdl.el.components["loop-animation"].currentActions[0].stop();
                }
                
                let baseRotation = new THREE.Quaternion();
                baseRotation.setFromEuler(mdl.rotation);
                actionFields.baseRotation = baseRotation;
                actionFields.rotationStep = 0;
                if (actionFields.range && actionFields.steps && mdl.type == "Group") {
                    let up = new THREE.Vector3(0, 1, 0);
                    up.applyQuaternion(baseRotation);
                    let turnAngle = actionFields.range / 2;
                    let quaternion = new THREE.Quaternion().setFromAxisAngle(up, turnAngle * 0.0174532925);
                    let euler = new THREE.Euler().setFromQuaternion(quaternion.multiply(baseRotation), "YXZ");
                    mdl.el.setAttribute("rotation", that.radiansToDegrees(euler.x) + " " + that.radiansToDegrees(euler.y) + " " + that.radiansToDegrees(euler.z));
                }

                comp.onClick = () => {
                    if (mdl.el.components["loop-animation"]) { 
                        that.dispatchAction("animate", { target: mdl.name });
                    }

                    if (actionFields.range && actionFields.steps && mdl.type == "Group") {
                        actionFields.rotationStep++;
                        if (actionFields.rotationStep >= actionFields.steps) {
                            actionFields.rotationStep = 0;
                        }
                        that.dispatchSet(mdl.name, "knob", actionFields.rotationStep);
                    }

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
                                    if (mediaComponent.video) {
                                        if (mediaComponent.video.paused) {
                                            mediaComponent.togglePlaying();
                                            while (mediaComponent.video.currentTime > 0) {
                                                mediaComponent.seekBack();
                                            }
                                        }
                                    }
                                }
                                let toggle = this.getToggle(actionFields.id);
                                if (toggle) {
                                    if (toggle.data.active != "null") {
                                        let previousTarget = that.findEntityByName(toggle.data.active);
                                        if (previousTarget) {
                                            if (previousTarget.components["media-video"]) {
                                                if (previousTarget.components["media-video"].video) {
                                                    if (!previousTarget.components["media-video"].video.paused) {
                                                        previousTarget.components["media-video"].togglePlaying();
                                                    }
                                                }
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
                            else if (actionFields.action == "teleport") {
                                console.log("teleport");
                                console.log(target);
                                console.log(target.components);
                                console.log(AFRAME.scenes[0].systems["hubs-systems"].waypointSystem);
                                AFRAME.scenes[0].systems["hubs-systems"].waypointSystem.teleportToWaypoint(target, target.components["waypoint"])();
                            }
                        }
                    }

                    if (actionFields.action == "event") {
                        that.dispatchAction("event", actionFields);
                    }

                    if (actionFields.action == "info") {
                        that.openInfoPanel(actionFields.url);
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
            this.onAction(obj.type, obj.data, true);
        }
    }

    dispatchAction(type, data) {
        let pckg = {
            type: type,
            data: data
        };
        this.sendMessage("*#@#*" + JSON.stringify(pckg));
        this.onAction(type, data, false);
    }

    dispatchGlobalSet(field, value) {
        this.dispatchAction("set", {
            field: field,
            value: value
        });
    }

    globalGet(field) {
        if (this.localStore[field] !== undefined) {
            return this.localStore[field];
        }
        return undefined;
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

    onAction(type, data, isSecondHand = false) {
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
                this.onAction(data[i].type, data[i].data, isSecondHand);
            }
        }
        else {
            if (type == "set") {
                if (data.target) {
                    let target = this.findEntityByName(data.target);
                    if (target) {
                        if (data.field == "visibility") {
                            target.object3D.visible = data.value == true;
                        }
                        if (data.field == "knob") {
                            let mdl = target.object3D;
                            let actionFields = mdl.actionFields;
                            actionFields.rotationStep = Number(data.value);
                            let up = new THREE.Vector3(0, 1, 0);
                            up.applyQuaternion(actionFields.baseRotation);
                            let turnAngle = actionFields.range / 2;
                            turnAngle -= actionFields.range / (actionFields.steps - 1) * actionFields.rotationStep;
                            let quaternion = new THREE.Quaternion().setFromAxisAngle(up, turnAngle * 0.0174532925);
                            let euler = new THREE.Euler().setFromQuaternion(quaternion.multiply(actionFields.baseRotation), "YXZ");
                            mdl.el.setAttribute("rotation", this.radiansToDegrees(euler.x) + " " + this.radiansToDegrees(euler.y) + " " + this.radiansToDegrees(euler.z));

                            /*
                            if (actionFields.action == "event") {
                                let eventName = actionFields.event;
                                target.dispatchEvent(new CustomEvent(eventName, { detail: {data: actionFields, isSecondHand: isSecondHand } }));
                            }*/
                        }
                    }
                }
                else {
                    // Global synced variable
                    this.localStore[data.field] = data.value;
                }
            }
            else if (type == "event") {
                let eventName = data.event;
                if (data.target) {
                    let target = that.findEntityByName(data.target);
                    target.dispatchEvent(new CustomEvent(eventName, { detail: {data: data, isSecondHand: isSecondHand } }));
                }
                else {
                    window.dispatchEvent(new CustomEvent(eventName, { detail: {data: data, isSecondHand: isSecondHand } }));
                }
            }
            else if (type == "toggle") {
                let toggle = this.getToggle(data.identifier);
                if (toggle) {
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

    openInfoPanel(url) {
        handleExitTo2DInterstitial();
        this.infoPanelUrl = url;
        window.UIRootInstance.pushHistoryState("modal", "boldly-info-panel");
    }
}

window.BoldInteractions = new BoldInteractions();

export default window.BoldInteractions;