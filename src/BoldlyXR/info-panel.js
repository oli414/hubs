import React, { Component } from "react";
import PropTypes from "prop-types";
import { injectIntl, FormattedMessage } from "react-intl";

import DialogContainer from "../react-components/dialog-container.js";
import styles from "../assets/stylesheets/room-info-dialog.scss";
import { scaledThumbnailUrlFor } from "../utils/media-url-utils";
import { allowDisplayOfSceneLink } from "../utils/scene-url-utils";

class InfoPanel extends Component {
    render() {
        return (
        <DialogContainer wide={true} title="" {...this.props}>
            <iframe
            className={styles.formFrame}
            src="https://www.youtube.com/embed/CC5ca6Hsb2Q"
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
