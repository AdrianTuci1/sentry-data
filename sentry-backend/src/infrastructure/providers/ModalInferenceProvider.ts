import { config } from '../../config';

export class ModalInferenceProvider {
    constructor() {
        if (!config.providers.modalTokenId || !config.providers.modalTokenSecret) {
            console.warn('[ModalInference] Warning: MODAL_TOKEN_ID or MODAL_TOKEN_SECRET is not defined.');
        }
    }

    /**
     * Call a deployed ML model endpoint on Modal directly.
     */
    public async runModelInference(modelName: string, inputs: any): Promise<any> {
        console.log(`[ModalInference] Triggering inference for model: ${modelName}`);

        try {
            // Using the adrian-tucicovenco workspace as seen in ModalSandboxProvider
            const req = await fetch(`https://adrian-tucicovenco--${modelName}.modal.run`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.providers.modalTokenId}:${config.providers.modalTokenSecret}`
                },
                body: JSON.stringify({ inputs })
            });

            if (!req.ok) {
                throw new Error(`Inference returned status ${req.status}`);
            }

            return await req.json();

        } catch (error: any) {
            console.error(`[ModalInference] Error:`, error.message);
            throw new Error(`Inference failed: ${error.message}`);
        }
    }
}
