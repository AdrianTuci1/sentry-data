"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModalInferenceProvider = void 0;
const config_1 = require("../../config");
class ModalInferenceProvider {
    constructor() {
        if (!config_1.config.providers.modalApiKey) {
            console.warn('[ModalInference] Warning: MODAL_API_KEY is not defined.');
        }
    }
    /**
     * Call a deployed ML model endpoint on Modal directly.
     */
    async runModelInference(modelName, inputs) {
        console.log(`[ModalInference] Triggering inference for model: ${modelName}`);
        try {
            const req = await fetch(`https://your-modal-workspace.modal.run/${modelName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config_1.config.providers.modalApiKey}`
                },
                body: JSON.stringify({ inputs })
            });
            if (!req.ok) {
                throw new Error(`Inference returned status ${req.status}`);
            }
            return await req.json();
        }
        catch (error) {
            console.error(`[ModalInference] Error:`, error.message);
            throw new Error(`Inference failed: ${error.message}`);
        }
    }
}
exports.ModalInferenceProvider = ModalInferenceProvider;
