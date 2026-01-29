"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamo = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const client = new client_dynamodb_1.DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'DataFortress_State';
exports.dynamo = {
    // Get Project State Tree
    getProjectState: async (tenantId, projectId) => {
        const params = {
            TableName: TABLE_NAME,
            Key: {
                PK: `TENANT#${tenantId}`,
                SK: `PROJ#${projectId}#TREE`,
            },
        };
        try {
            const result = await docClient.send(new lib_dynamodb_1.GetCommand(params));
            return result.Item;
        }
        catch (error) {
            console.error('Error fetching project state:', error);
            throw error;
        }
    },
    // Example: Update Cost
    updateProjectCost: async (tenantId, projectId, cost) => {
        const params = {
            TableName: TABLE_NAME,
            Key: {
                PK: `TENANT#${tenantId}`,
                SK: `PROJ#${projectId}#TREE`,
            },
            UpdateExpression: 'set billing_mtd = :c',
            ExpressionAttributeValues: {
                ':c': cost,
            },
            ReturnValues: 'ALL_NEW',
        };
        return docClient.send(new lib_dynamodb_1.UpdateCommand(params));
    },
    // Generic Query example
    queryItems: async (pk) => {
        const params = {
            TableName: TABLE_NAME,
            KeyConditionExpression: 'PK = :pk',
            ExpressionAttributeValues: {
                ':pk': pk
            }
        };
        return docClient.send(new lib_dynamodb_1.QueryCommand(params));
    }
};
