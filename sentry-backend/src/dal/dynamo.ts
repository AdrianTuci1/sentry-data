import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import dotenv from 'dotenv';

dotenv.config();

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'DataFortress_State';

export const dynamo = {
    // Get Project State Tree
    getProjectState: async (tenantId: string, projectId: string) => {
        const params = {
            TableName: TABLE_NAME,
            Key: {
                PK: `TENANT#${tenantId}`,
                SK: `PROJ#${projectId}#TREE`,
            },
        };
        try {
            const result = await docClient.send(new GetCommand(params));
            return result.Item;
        } catch (error) {
            console.error('Error fetching project state:', error);
            throw error;
        }
    },

    // Example: Update Cost
    updateProjectCost: async (tenantId: string, projectId: string, cost: number) => {
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
            ReturnValues: 'ALL_NEW' as const,
        };
        return docClient.send(new UpdateCommand(params));
    },

    // Generic Query example
    queryItems: async (pk: string) => {
        const params = {
            TableName: TABLE_NAME,
            KeyConditionExpression: 'PK = :pk',
            ExpressionAttributeValues: {
                ':pk': pk
            }
        };
        return docClient.send(new QueryCommand(params));
    }
};
