import { config } from '../../config';

export class ModalInferenceProvider {
    constructor() {
        if (!config.providers.modalApiKey) {
            console.warn('[ModalInference] Warning: MODAL_API_KEY is not defined.');
        }
    }

    /**
     * Call a deployed ML model endpoint on Modal directly.
     */
    public async runModelInference(modelName: string, inputs: any): Promise<any> {
        console.log(`[ModalInference] Triggering inference for model: ${modelName}`);

        try {
            const req = await fetch(`https://your-modal-workspace.modal.run/${modelName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.providers.modalApiKey}`
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
