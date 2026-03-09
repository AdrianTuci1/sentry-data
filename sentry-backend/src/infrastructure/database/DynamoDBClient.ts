import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { config } from '../../config/index';

// Basic configuration for the DynamoDB Client.
// We use explicit credentials from the config object.
const ddbClient = new DynamoDBClient({
    region: config.aws.region,
    credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey
    }
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
