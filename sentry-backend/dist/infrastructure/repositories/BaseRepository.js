"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseRepository = void 0;
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
/**
 * Base Abstract Repository implementing the Single Table Design
 */
class BaseRepository {
    constructor(docClient, tableName) {
        this.docClient = docClient;
        this.tableName = tableName;
    }
    async get(pkId, skId) {
        const command = new lib_dynamodb_1.GetCommand({
            TableName: this.tableName,
            Key: {
                PK: this.getPartitionKey(pkId),
                SK: this.getSortKey(skId),
            },
        });
        const response = await this.docClient.send(command);
        return response.Item || null;
    }
    async save(entity) {
        // Enforce setting timestamp fields on save
        const itemToSave = {
            ...entity,
            updatedAt: new Date().toISOString(),
            createdAt: entity.createdAt || new Date().toISOString()
        };
        const command = new lib_dynamodb_1.PutCommand({
            TableName: this.tableName,
            Item: itemToSave,
        });
        await this.docClient.send(command);
    }
    async delete(pkId, skId) {
        const command = new lib_dynamodb_1.DeleteCommand({
            TableName: this.tableName,
            Key: {
                PK: this.getPartitionKey(pkId),
                SK: this.getSortKey(skId),
            },
        });
        await this.docClient.send(command);
    }
    /**
     * Standard query to fetch multiple items in a Partition.
     * Often used to get all projects for a tenant, or all configs for a project.
     * Uses `begins_with` if an SK Prefix is provided.
     */
    async queryByPrefix(pkId, skPrefix) {
        const command = new lib_dynamodb_1.QueryCommand({
            TableName: this.tableName,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
            ExpressionAttributeValues: {
                ':pk': this.getPartitionKey(pkId),
                ':skPrefix': skPrefix,
            },
        });
        const response = await this.docClient.send(command);
        return response.Items || [];
    }
}
exports.BaseRepository = BaseRepository;
