import React, { Component } from "react";
import PropTypes from "prop-types";
import { injectIntl, FormattedMessage } from "react-intl";

import DialogContainer from "../react-components/dialog-container.js";
import styles from "./info-panel.scss";
import { scaledThumbnailUrlFor } from "../utils/media-url-utils";
import { allowDisplayOfSceneLink } from "../utils/scene-url-utils";

class InfoPanel extends Component {
    render() {
        let url = window.BoldInteractions.infoPanelUrl;
        return (
        <DialogContainer wide={true} title="" className={styles.infoPanel} {...this.props}>
            <iframe
            id="20f4eacd-2b99-4d24-ab09-ec416dcf6eda"
            className={styles.formFrame}
            src={url}
            frameBorder="0"
            marginHeight="0"
            marginWidth="0"
            >
            Loading...
            </iframe>
        </DialogContainer>
        );
    }
}
export default injectIntl(InfoPanel);
