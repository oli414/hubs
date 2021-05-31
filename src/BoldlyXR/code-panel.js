import React, { Component } from "react";
import PropTypes from "prop-types";
import { injectIntl, FormattedMessage } from "react-intl";

import DialogContainer from "../react-components/dialog-container.js";
import styles from "./code-panel.scss";
import { scaledThumbnailUrlFor } from "../utils/media-url-utils";
import { allowDisplayOfSceneLink } from "../utils/scene-url-utils";

class CodePanel extends Component {
    render() {
        let code = window.BoldInteractions.codePanelCode;

        let resultAction = window.BoldInteractions.codePanelResultAction;
        let resultData = window.BoldInteractions.codePanelResultData;
        let resultObj = window.BoldInteractions.codePanelObj;

        function submitCode() {
            let value = document.getElementById("code-panel-code").value;
            if (code == value) {
                document.getElementById("code-panel-code").style.borderColor = "#5cd138";
                document.getElementById("code-panel-code").style.color = "#5cd138";
                document.getElementById("code-text").style.color = "#5cd138";

                window.setTimeout(() => {
                    window.UIRootInstance.closeDialog();
                    if (resultAction) {
                        let ogAction = resultData.action;
                        resultData.action = resultAction;
                        window.BoldInteractions.performInteraction(resultObj, resultData);
                        resultData.action = ogAction;
                        //window.BoldInteractions.dispatchAction(resultAction, resultData);
                    }
                }, 500);
            }
            else {
                document.getElementById("code-panel-code").style.borderColor = "red";
                document.getElementById("code-panel-code").style.color = "red";
                document.getElementById("code-text").style.color = "red";
            }
        }

        function resetCode() {
            document.getElementById("code-panel-code").style.borderColor = "grey";
            document.getElementById("code-panel-code").style.color = "black";
            document.getElementById("code-text").style.color = "black";
        }

        let text = window.BoldInteractions.codePanelText;
        return (
        <DialogContainer wide={false} title="" className={styles.codePanel} {...this.props}>
            <p id="code-text">{ text }</p>
            <input id="code-panel-code" onChange={() => resetCode()} type="text"></input>
            <div className="code-submit" onClick={() => submitCode()}>Submit</div>
        </DialogContainer>
        );
    }
}
export default injectIntl(CodePanel);
