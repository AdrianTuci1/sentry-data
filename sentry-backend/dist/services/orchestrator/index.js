"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.orchestrator = void 0;
const client_eventbridge_1 = require("@aws-sdk/client-eventbridge");
const client_sfn_1 = require("@aws-sdk/client-sfn");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const ebClient = new client_eventbridge_1.EventBridgeClient({ region: process.env.AWS_REGION });
const sfnClient = new client_sfn_1.SFNClient({ region: process.env.AWS_REGION });
exports.orchestrator = {
    // Trigger an event to EventBridge
    triggerEvent: async (source, detailType, detail) => {
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
            const result = await ebClient.send(new client_eventbridge_1.PutEventsCommand(params));
            return result;
        }
        catch (e) {
            console.error("Error triggering eventbridge:", e);
            throw e;
        }
    },
    // Start a Step Function execution explicitly
    startWorkflow: async (stateMachineArn, input) => {
        const params = {
            stateMachineArn,
            input: JSON.stringify(input),
        };
        try {
            const result = await sfnClient.send(new client_sfn_1.StartExecutionCommand(params));
            return result;
        }
        catch (e) {
            console.error("Error starting step function:", e);
            throw e;
        }
    }
};
