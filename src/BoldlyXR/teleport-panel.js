import React, { Component } from "react";
import PropTypes from "prop-types";
import { injectIntl, FormattedMessage } from "react-intl";

import DialogContainer from "./dialog-container.js";
import styles from "./teleport-panel.scss";
import { scaledThumbnailUrlFor } from "../utils/media-url-utils";
import { allowDisplayOfSceneLink } from "../utils/scene-url-utils";

class TeleportPanel extends Component {

    render() {
        let that = this;
        function teleport(i) {
            let target = window.BoldInteractions.findEntityByName(window.BoldInteractions.teleportLocations[i].name);
            AFRAME.scenes[0].systems["hubs-systems"].waypointSystem.teleportToWaypoint(null, target.components["waypoint"])();
            window.UIRootInstance.closeDialog();
        }

        let locations = [];
        for (let i = 0; i < window.BoldInteractions.teleportLocations.length; i++) {
            let title = window.BoldInteractions.teleportLocations[i].title;
            locations.push(<div onClick={() => teleport(i)} key={i} className="tp-button">{title}</div>);
        }
        return (
        <DialogContainer wide={true} title="" className={styles.teleportPanel} {...this.props}>
            <h1>Teleport Locations</h1>
            <p>
                Select a location to teleport to
            </p>
            <div>
                { locations }
            </div>
        </DialogContainer>
        );
    }
}
export default injectIntl(TeleportPanel);
