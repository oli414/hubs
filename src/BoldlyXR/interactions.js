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
        
        this.hasJoined = false;

        this.clientId = null;

        this.lastWaypoint = "";

        this.muteLocked = false;

        this.previousPlay = null;

        this.hideChatActions = true;

        this.registeredAnimationMixers = [];

        this.teleportLocations = [];

        this.triggerSpots = [];

        this.codePanelText = "";
        this.codePanelCode = "";
        this.codePanelResultAction = "";
        this.codePanelResultData = {};
        this.codePanelObj = null;

        this.lastUpdate = Date.now();
        this.tick();

        this.infoPanelUrl = "";

        this.finishedCode = false;
        this.finishedSit = false;
        this.finishedShare = false;
    }

    // Called externally every time a waypoint is loaded.
    registerWaypoint(el) {
        let identifier = "TPLoc_";
        let className = el.className;
        if (className.startsWith(identifier)) {
            console.log(el.object3D);
            let name = className.replace(identifier, "");
            name = name.replace("_", " ");
            this.teleportLocations.push({
                title: name,
                name: el.object3D.name
            });
        }
    }

    // Teleport all users to the location of this clients user.
    teleportAll() {
        this.dispatchAction("teleport", {matrixWorld: AFRAME.scenes[0].systems["hubs-systems"].characterController.avatarRig.object3D.matrixWorld}, false);
    }

    // Lock or unlock the mute button for this user.
    setMuteLock(lock) {
        if (lock && window.APP.hubChannel.can("mute_users"))
            return;
        this.muteLocked = lock;
    }

    // Set the client identifier for this client by which other clients can identify this client. 
    setClientId(id) {
        console.log(id + " client id has been set");
        this.clientId = id;
    }

    // Called every frame.
    tick() {
        var now = Date.now();
        var dt = (now - this.lastUpdate) / 1000;
        this.lastUpdate = now;
        
        for (let i = 0; i < this.registeredAnimationMixers.length; i++) {
            this.registeredAnimationMixers[i].update(dt);
        }

        // Collision check with the user for the trigger colliders.
        if (AFRAME.scenes[0] && this.hasJoined) {
            let playerPos = new THREE.Vector3();
            AFRAME.scenes[0].systems["hubs-systems"].characterController.avatarRig.object3D.getWorldPosition(playerPos);

            for (let i = 0; i < this.triggerSpots.length; i++) {
                if (!this.triggerSpots[i].active) {
                    continue;
                }

                let obj3d = this.triggerSpots[i].mdl;
                let worldPosObj = new THREE.Vector3();
                obj3d.getWorldPosition(worldPosObj);

                if (worldPosObj.distanceTo(playerPos) < obj3d.scale.x) {
                    this.triggerSpots[i].colliding = true;
                }
                else {
                    this.triggerSpots[i].colliding = false;
                }

                if (!this.triggerSpots[i].collidingPrevious && this.triggerSpots[i].colliding) {
                    console.log("Entering collider");
                    if (this.triggerSpots[i].singleUse) {
                        this.triggerSpots[i].active = false;
                    }
                    this.triggerSpots[i].onCollide();
                }
                if (this.triggerSpots[i].collidingPrevious && !this.triggerSpots[i].colliding) {
                    console.log("Leaving collider");
                }
                
                this.triggerSpots[i].collidingPrevious = this.triggerSpots[i].colliding;
            }
        }

        window.requestAnimationFrame(this.tick.bind(this));
    }

    // Store an action to the scene state that is synced with other users to allow new users to restore the state of the scene.
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

    // Toggle a value in the scene state.
    setToggle(toggleName, value) {
        for (let i = 0; i < this.actionsHistory.length; i++) {
            let a = this.actionsHistory[i];
            if (a.type == "toggle") {
                if (a.data.identifier == toggleName) {
                    a.data.active = value;
                    return;
                }
            } 
        }
        this.actionsHistory.push({
            type: "toggle",
            data: {
                identifier: toggleName,
                active: value
            }
        })
    }

    // Get the toggle value from the scene state.
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

    // Find all children within an object that have actions.
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
  
    // Find an object in the scene by a specific name.
    findEntityByName(name) {
        let root = document.getElementById("environment-scene");
        let res = this.findChildByName(root, name);
        return res;
    }
  
    // Find a child by its name.
    findChildByName(parent, name) {
        let children = parent.querySelectorAll(":scope > a-entity"); // Immediate children
        for (let i = 0; i < children.length; i++) {
          const c = children[i];
          if (c && c.name && (c.name == name || (c.name.startsWith && c.name.startsWith(name + "{")))) {
            return c;
          }
          else if (c && c.object3D && c.object3D.name && (c.object3D.name == name || (c.object3D.name.startsWith && c.object3D.name.startsWith(name + "{")))) {
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

    // Find multiple objects with the same name.
    findEntitiesByName(name) {
        let root = document.getElementById("environment-scene");
        let res = this.findChildrenByName(root, name);
        return res;
    }
  
    // Find all children with a certain name.
    findChildrenByName(parent, name) {
        let children = parent.querySelectorAll(":scope > a-entity"); // Immediate children
        let found = [];
        for (let i = 0; i < children.length; i++) {
          const c = children[i];
          if (c && c.name && (c.name == name || (c.name.startsWith && c.name.startsWith(name + "{")))) {
            found.push(c);
          }
          else if (c && c.object3D && c.object3D.name && (c.object3D.name == name || (c.object3D.name.startsWith && c.object3D.name.startsWith(name + "{")))) {
            found.push(c);
          }
        }
        for (let i = 0; i < children.length; i++) {
          const c = children[i];
          const r = this.findChildrenByName(c, name);
          if (r !== null) {
            found = found.concat(r);
          }
        }
        return found;
    }

    // Translate an action string to an object.
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

    // Perform an action. This is called whenever an object is interacted with, this function identifies the action that has to be performed, and performs it.
    performInteraction(object3D, actionFields) {
        let that = this;
        if (object3D.el) {
            if (object3D.el.components["loop-animation"]) { 
                that.dispatchAction("animate", { target: object3D.name });
            }
        }

        if (actionFields.range && actionFields.steps && object3D.type == "Group") {
            actionFields.rotationStep++;
            if (actionFields.rotationStep >= actionFields.steps) {
                actionFields.rotationStep = 0;
            }
            that.dispatchSet(object3D.name, "knob", actionFields.rotationStep);
        }

        if (actionFields.target) {
            let target = that.findEntityByName(actionFields.target);

            if (actionFields.action == "click") {
                let children = that.findEntitiesByName(actionFields.target)
                for (let i = 0; i < children.length; i++) {
                    let externalActionFields = that.breakdownName(children[i].object3D);
                    console.log(externalActionFields);
                    that.performInteraction(children[i].object3D, externalActionFields);
                }
            }

            if (target) {
                let mediaComponent = null;
                if (target.components["media-video"]) {
                    mediaComponent = target.components["media-video"];
                }

                if (actionFields.action == "hide") {
                    that.dispatchSet(actionFields.target, "visibility", false);
                }
                else if (actionFields.action == "show") {
                    that.dispatchSet(actionFields.target, "visibility", true);
                }
                else if (actionFields.action == "toggle") {
                    that.dispatchSet(actionFields.target, "visibility", !target.object3D.visible);
                }
                else if (actionFields.action == "play") {
                    if (mediaComponent) {
                        mediaComponent.togglePlaying();
                        while (mediaComponent.video.currentTime > 0) {
                            mediaComponent.seekBack();
                        }
                    }
                }
                else if (actionFields.action == "start-play") {
                    if (mediaComponent) {
                        if (mediaComponent.video.paused) {
                            if (that.previousPlay) {
                                if (!that.previousPlay.video.paused) {
                                    that.previousPlay.togglePlaying();
                                    while (that.previousPlay.video.currentTime > 0) {
                                        that.previousPlay.seekBack();
                                    }
                                }
                            }
                            mediaComponent.togglePlaying();
                            while (mediaComponent.video.currentTime > 0) {
                                mediaComponent.seekBack();
                            }
                            that.previousPlay = mediaComponent;
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
                    AFRAME.scenes[0].systems["hubs-systems"].waypointSystem.teleportToWaypoint(null, target.components["waypoint"])();
                }
            }
        }

        if (actionFields.action == "event") {
            that.dispatchAction("event", actionFields);
        }

        if (actionFields.action == "info") {
            that.openInfoPanel(actionFields.url, actionFields.type, actionFields.ext);
        }

        if (actionFields.action == "embed") {
            that.openEmbedPanel(actionFields.url);
        }

        if (actionFields.action == "code") {
            that.openCodePanel(actionFields.text.replaceAll("_", " "), actionFields.code, actionFields.resaction, actionFields, object3D);
        }
    }

    // Setup an object as a trigger volume. Not in use.
    setupTriggerVolume(comp) {
        let that = this;
        let mdl = comp.el.object3D;
        let actionFields = that.breakdownName(mdl);


        if (actionFields) {
            console.log("Setup trigger volume");
            comp.onBoldCollide = () => {
                console.log("Bold collision");
                that.performInteraction(mdl, actionFields);
            };
        }
    }

    // Setup the interactions for an object. This is called by the object loader and checks if an object has custom interactions, 
    // and applies the necessary values to make it clickable, and/or registers it as an interactible object.
    setupModelClickAction(comp) {
        let that = this;
        comp.el.addEventListener("model-loaded", (data) => {
            let models = that.findExtraChildren(comp.el.object3D);
            for (let i = 0; i < models.length; i++) {
                let mdl = models[i];

                let actionFields = that.breakdownName(mdl);
                if (actionFields == null) {
                    continue;
                }
                
                if (mdl.name.startsWith("trigger_")) {
                    console.log("Registering Trigger");
                    let collisionTrigger = {};
                    collisionTrigger.collidingPrevious = false;
                    collisionTrigger.colliding = false;
                    collisionTrigger.onCollide = () => {
                        that.performInteraction(mdl, actionFields);
                    };
                    collisionTrigger.mdl = mdl;
                    collisionTrigger.active = true;
                    collisionTrigger.singleUse = false;
                    if (mdl.name.startsWith("trigger_single_")) {
                        collisionTrigger.singleUse = true;
                    }
                    that.triggerSpots.push(collisionTrigger);
                    continue;
                }

                if (mdl.name != mdl.el.object3D.name) {
                    continue;
                }

                if (actionFields.noclick) {
                    continue;
                }

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
                
                if (actionFields.action == "switch-play") {
                    if (actionFields.target) {
                        if (actionFields.default) {
                            this.setToggle(actionFields.id, actionFields.target);
                        }
                    }
                }

                comp.onClick = () => {
                    that.performInteraction(mdl, actionFields);
                };
                mdl.addEventListener("interact", comp.onClick);
            }
        });
    }

    // Send a message in the chat.
    sendMessage(txt) {
        console.log(txt);
        document.getElementById("avatar-rig").messageDispatch.dispatch(txt);
    }

    // Check if a chat message is a data message.
    isActionMessage(msg) {
        if (msg.body.startsWith("*#@#*")) {
            return true;
        }
        return false;
    }

    // Parse a data chat message and perform the event.
    handleActionMessage(msg) {
        if (msg.body.startsWith("*#@#*")) {
            let strAction = msg.body.substring(5);
            let obj = JSON.parse(strAction);
            this.onAction(obj.type, obj.data, true);
        }
    }

    // Dispatch an event to all the clients.
    dispatchAction(type, data, toSelf = true) {
        let pckg = {
            type: type,
            data: data
        };
        this.sendMessage("*#@#*" + JSON.stringify(pckg));
        if (toSelf) {
            this.onAction(type, data, false);
        }
    }

    // Dispatch a set event to all clients for a global value.
    dispatchGlobalSet(field, value) {
        this.dispatchAction("set", {
            field: field,
            value: value
        });
    }
    
    // Get a value from the scene state.
    globalGet(field) {
        if (this.localStore[field] !== undefined) {
            return this.localStore[field];
        }
        return undefined;
    }

    // Dispatch a set event to all clients for a specific target object.
    dispatchSet(target, field, value) {
        this.dispatchAction("set", {
            target: target,
            field: field,
            value: value
        });
    }

    // Dispatch a toggle event to all clients.
    dispatchToggle(identifier, active) {
        this.dispatchAction("toggle", {
            identifier: identifier,
            active: active
        });
    }

    //Handles an event. Called when an event is received through the chat, and if a dispatched event needs to be performed by the sender client.
    onAction(type, data, isSecondHand = false) {
        let initiallySynced = this.synced;
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
            else if (type == "unmute") {
                if (data.target == "__all__" || data.target == this.clientId) {
                    this.setMuteLock(false);
                }
            }
            else if (type == "mute") {
                if (data.target == "__all__" || data.target == this.clientId) {
                    let canSkip = false;
                    if (data.exception) {
                        if (data.exception == this.clientId) {
                            canSkip = true;
                        }
                    }
                    if (!canSkip) {
                        window.muteMicrophone();
                        this.setMuteLock(true);
                    }
                }
            }
            else if (type == "teleport") {
                console.log("Teleporting!");
                if (data.matrixWorld) {
                    AFRAME.scenes[0].systems["hubs-systems"].characterController.enqueueWaypointTravelTo(
                        data.matrixWorld,
                        true,
                        {
                            willDisableMotion: false,
                            willDisableTeleporting: false,
                            willMaintainInitialOrientation: true,
                            snapToNavMesh: true
                        }
                    );
                }
            }

            this.appendToActionHistory({
                type: type, 
                data: data
            });
        }

        if (this.synced && !initiallySynced) {
            if (this.globalGet("mute_all")) {
                window.muteMicrophone();
                this.setMuteLock(true);
            }
        }
    }

    // Called when a user joins the scene.
    onUserJoined() {
        if (this.synced) {
            this.dispatchAction("sync", this.actionsHistory);
        }
    }

    // Open an info panel with embedded content. Allows you to load virtual tours, or hosted content from this projects "custom_assets" folder.
    openInfoPanel(url, type, ext) {
        this.mouse.buttonLeft = false;
        this.mouse.buttonRight = false;
        handleExitTo2DInterstitial();
        if (type == "tour") {
            this.infoPanelUrl = "https://boldlyxr-development.nl/kohler/hubs/tours/" + url + "/index.htm";
        }
        else if (type == "file") {
            this.infoPanelUrl = "https://vr-kohler-1-assets.vr-kohler.com/hubs/assets/custom/file/" + ext + "/" + url + "." + ext;
        }
        else {
            this.infoPanelUrl = "https://vr-kohler-1-assets.vr-kohler.com/hubs/assets/custom/" + type + "/" + url + "/index.htm";
        }
        console.log("open panel");
        window.UIRootInstance.pushHistoryState("modal", "boldly-info-panel");
    }

    // Open an embed panel with embedded content. Allows you to load anything from boldly-xr-development.nl/
    // urls are encoded using 1slash1 for a / and 1dot1 for a .
    openEmbedPanel(url) {
        this.mouse.buttonLeft = false;
        this.mouse.buttonRight = false;
        handleExitTo2DInterstitial();

        this.infoPanelUrl = "https://boldlyxr-development.nl/" + url.replaceAll("1slash1", "/").replaceAll("1dot1", ".");
        window.UIRootInstance.pushHistoryState("modal", "boldly-contact-panel");
    }

    // Open the teleportation panel.
    openTeleportPanel() {
        this.mouse.buttonLeft = false;
        this.mouse.buttonRight = false;
        handleExitTo2DInterstitial();
        window.UIRootInstance.pushHistoryState("modal", "boldly-teleport-panel");
    }

    // Open a code panel.
    openCodePanel(text, code, resultAction, resultData, obj) {
        this.mouse.buttonLeft = false;
        this.mouse.buttonRight = false;
        
        handleExitTo2DInterstitial();
        this.codePanelText = text;
        this.codePanelCode = code;
        this.codePanelResultAction = resultAction;
        this.codePanelResultData = resultData;
        this.codePanelObj = obj;
        window.UIRootInstance.pushHistoryState("modal", "boldly-code-panel");
    }

    // Check if a specific message has been send.
    checkChatSend(message) {
        if (!this.finishedCode) {
            if (message == "0581") {
                console.log("Entered secret code");

                let children = this.findEntitiesByName("commercialfinish")
                for (let i = 0; i < children.length; i++) {
                    let externalActionFields = this.breakdownName(children[i].object3D);
                    this.performInteraction(children[i].object3D, externalActionFields);
                }

                this.finishedCode = true;
            }

        }
    }

    // Called when the user clicks on a waypoint for the first time (since entering the scene).
    onSit() {
        if (!this.finishedSit && this.hasJoined) {
            console.log("User sit");

            let children = this.findEntitiesByName("boardroomsit")
            for (let i = 0; i < children.length; i++) {
                let externalActionFields = this.breakdownName(children[i].object3D);
                this.performInteraction(children[i].object3D, externalActionFields);
            }

            this.finishedSit = true;
        }
    }

    // Called when the user shares media for the first time (since entering the scene).
    onShare() {
        if (!this.finishedShare) {
            console.log("User shared media");

            let children = this.findEntitiesByName("boardroomshare")
            for (let i = 0; i < children.length; i++) {
                let externalActionFields = this.breakdownName(children[i].object3D);
                this.performInteraction(children[i].object3D, externalActionFields);
            }

            this.finishedShare = true;
        }
    }
}

window.BoldInteractions = new BoldInteractions();

export default window.BoldInteractions;
