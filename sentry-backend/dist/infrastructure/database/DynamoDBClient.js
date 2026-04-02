"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamoDbDocumentClient = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const index_1 = require("../../config/index");
// Basic configuration for the DynamoDB Client.
// We use explicit credentials from the config object.
const ddbClient = new client_dynamodb_1.DynamoDBClient({
    region: index_1.config.aws.region,
    credentials: {
        accessKeyId: index_1.config.aws.accessKeyId,
        secretAccessKey: index_1.config.aws.secretAccessKey
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
exports.dynamoDbDocumentClient = lib_dynamodb_1.DynamoDBDocumentClient.from(ddbClient, translateConfig);
