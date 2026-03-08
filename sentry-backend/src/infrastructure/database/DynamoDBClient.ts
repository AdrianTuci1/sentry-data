import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Basic configuration for the DynamoDB Client.
// In production, roles/credentials will be picked up from the AWS Environment.
const ddbClient = new DynamoDBClient({
    region: process.env.AWS_REGION || 'eu-central-1',
    // ... Any explicit credentials or endpoint configurations (e.g. for local-dynamodb) goes here
});

// The DocumentClient abstracts away explicit type mappings (e.g., {"S": "String"})
const marshallOptions = {
    convertEmptyValues: false, // false, by default.
    removeUndefinedValues: true, // false, by default.
    convertClassInstanceToMap: false, // false, by default.
};

const unmarshallOptions = {
    wrapNumbers: false, // false, by default.
};

const translateConfig = { marshallOptions, unmarshallOptions };

// We export a singleton instance of the Document Client to be used by all Repositories
export const dynamoDbDocumentClient = DynamoDBDocumentClient.from(ddbClient, translateConfig);
