import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import dotenv from 'dotenv';

dotenv.config();

const ebClient = new EventBridgeClient({ region: process.env.AWS_REGION });
const sfnClient = new SFNClient({ region: process.env.AWS_REGION });

export const orchestrator = {
    // Trigger an event to EventBridge
    triggerEvent: async (source: string, detailType: string, detail: any) => {
        const params = {
            Entries: [
                {
                    Source: source,
                    DetailType: detailType,
                    Detail: JSON.stringify(detail),
                    EventBusName: 'default', // Or custom bus
                },
            ],
        };
        try {
            const result = await ebClient.send(new PutEventsCommand(params));
            return result;
        } catch (e) {
            console.error("Error triggering eventbridge:", e);
            throw e;
        }
    },

    // Start a Step Function execution explicitly
    startWorkflow: async (stateMachineArn: string, input: any) => {
        const params = {
            stateMachineArn,
            input: JSON.stringify(input),
        };
        try {
            const result = await sfnClient.send(new StartExecutionCommand(params));
            return result;
        } catch (e) {
            console.error("Error starting step function:", e);
            throw e;
        }
    }
};
