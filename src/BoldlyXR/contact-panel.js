import React, { Component } from "react";
import { injectIntl, FormattedMessage } from "react-intl";

import DialogContainer from "./dialog-container.js";
import styles from "./info-panel.scss";

class ContactPanel extends Component {
    render() {
        let url = window.BoldInteractions.infoPanelUrl;
        return (
        <DialogContainer wide={true} title="" className={styles.infoPanel} {...this.props}>
            <iframe
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
export default injectIntl(ContactPanel);
