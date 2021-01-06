
import BoldInteractions from "./interactions.js";

class KeyList {
    constructor(list) {
        for (let i = 0; i < list.length; i++) {
            this[list[i]] = list[i];
        }
    }
}

class PgenWall {
    constructor() {
        this.targets = new KeyList([
            "engineLightA",
            "engineLightB",
            "acChillerLightA",
            "acChillerLightB",
            "acChillerGateLightA",
            "acChillerGateLightB",
            "waterHeaterLightA",
            "waterHeaterLightB",
            "waterHeaterGateLightA",
            "waterHeaterGateLightB",
            "acFansLight",
            "lightingLight",
            "thrusterLight"
        ]);
 
        this.switches = {

        };

        this.engineState = 0;

        window.addEventListener("pgen-set-switch", this.setSwitchEvent.bind(this));
    }

    update() {
        let engineState = BoldInteractions.globalGet("pgen.engineState");
        if (engineState == 1) {
            let target = BoldInteractions.findEntityByName(this.targets.engineLightB);
            BoldInteractions.dispatchSet(this.targets.engineLightB, "visibility", !target.object3D.visible);

            window.setTimeout(this.update.bind(this), 500);
        }
    }

    setSwitchEvent(evt) {
        let actionFields = evt.detail.data;
        this.switches[actionFields.switchKey] = actionFields.rotationStep;
        if (evt.detail.isSecondHand)
            return;
        this.updateState();
    }

    updateState() {
        // Calculate load using the state of the switches
        // Set the component lights based on their state
        
        let totalLoad = 0;

        const chillerLoad = 30;
        switch (this.switches.ac) {
            case 0:
                BoldInteractions.dispatchSet(this.targets.acFansLight, "visibility", false);
                break;
            case 1:
                BoldInteractions.dispatchSet(this.targets.acFansLight, "visibility", true);
                totalLoad += chillerLoad;
                break;
        }
        
        const heaterLoad = 30;
        switch (this.switches.heater) {
            case 1:
                totalLoad += heaterLoad;
                break;
        }
        
        const lightsLoad = 10;
        switch (this.switches.lights) {
            case 0:
                BoldInteractions.dispatchSet(this.targets.lightingLight, "visibility", false);
                break;
            case 1:
                BoldInteractions.dispatchSet(this.targets.lightingLight, "visibility", true);
                totalLoad += lightsLoad;
                break;
        }
        
        const thrusterLoad = 40;
        switch (this.switches.thrusters) {
            case 0:
                BoldInteractions.dispatchSet(this.targets.thrusterLight, "visibility", false);
                break;
            case 1:
                BoldInteractions.dispatchSet(this.targets.thrusterLight, "visibility", true);
                totalLoad += thrusterLoad;
                break;
        }

        // Set the engine lights accordingly

        BoldInteractions.dispatchSet(this.targets.engineLightA, "visibility", true);

        let engineMaxLoad = 100;
        let engineState = BoldInteractions.globalGet("pgen.engineState");
        if (engineState == 2) {
            engineMaxLoad = 200;
            BoldInteractions.dispatchSet(this.targets.engineLightB, "visibility", true);
        }

        if (totalLoad > engineMaxLoad) {
            // Boot up second engine
            if (engineState === undefined || engineState == 0) {
                BoldInteractions.dispatchGlobalSet("pgen.engineState", 1);
                engineState = 1;
                this.update();
                window.setTimeout(() => {
                    let engineState = BoldInteractions.globalGet("pgen.engineState");
                    if (engineState == 1) {
                        BoldInteractions.dispatchGlobalSet("pgen.engineState", 2);
                        this.updateState();
                    }
                }, 5000);
            }
        }
        else if (totalLoad <= 60 && engineState == 2 || engineState == 1) {
            BoldInteractions.dispatchGlobalSet("pgen.engineState", 0);
            engineState = 0;
            BoldInteractions.dispatchSet(this.targets.engineLightB, "visibility", false);
        }

        if (engineState == 1) {
            // Load shedding until the second motor is on since the total load exceeds the engine load capacity 
            if (this.switches.ac == 1) {
                BoldInteractions.dispatchSet(this.targets.acChillerLightA, "visibility", false);
                BoldInteractions.dispatchSet(this.targets.acChillerLightB, "visibility", false);
                
                BoldInteractions.dispatchSet(this.targets.acChillerGateLightA, "visibility", true);
                BoldInteractions.dispatchSet(this.targets.acChillerGateLightB, "visibility", true);
            }
            if (this.switches.heater == 1) {
                BoldInteractions.dispatchSet(this.targets.waterHeaterLightA, "visibility", false);
                BoldInteractions.dispatchSet(this.targets.waterHeaterLightB, "visibility", false);
                
                BoldInteractions.dispatchSet(this.targets.waterHeaterGateLightA, "visibility", true);
                BoldInteractions.dispatchSet(this.targets.waterHeaterGateLightB, "visibility", true);
            }
        }
        else {
            BoldInteractions.dispatchSet(this.targets.waterHeaterGateLightA, "visibility", false);
            BoldInteractions.dispatchSet(this.targets.waterHeaterGateLightB, "visibility", false);

            BoldInteractions.dispatchSet(this.targets.acChillerGateLightA, "visibility", false);
            BoldInteractions.dispatchSet(this.targets.acChillerGateLightB, "visibility", false);

            switch (this.switches.ac) {
                case 0:
                    BoldInteractions.dispatchSet(this.targets.acChillerLightA, "visibility", false);
                    BoldInteractions.dispatchSet(this.targets.acChillerLightB, "visibility", false);
                    break;
                case 1:
                    BoldInteractions.dispatchSet(this.targets.acChillerLightA, "visibility", true);
                    BoldInteractions.dispatchSet(this.targets.acChillerLightB, "visibility", true);
                    break;
            }
            
            const heaterLoad = 30;
            switch (this.switches.heater) {
                case 0:
                    BoldInteractions.dispatchSet(this.targets.waterHeaterLightA, "visibility", false);
                    BoldInteractions.dispatchSet(this.targets.waterHeaterLightB, "visibility", false);
                    break;
                case 1:
                    BoldInteractions.dispatchSet(this.targets.waterHeaterLightA, "visibility", true);
                    BoldInteractions.dispatchSet(this.targets.waterHeaterLightB, "visibility", true);
                    break;
            }
        }
    }
}

class BoldGame {
    constructor() {
        this.pgenWall = new PgenWall();
    }
}


window.BoldGame = new BoldGame();

export default window.BoldGame;