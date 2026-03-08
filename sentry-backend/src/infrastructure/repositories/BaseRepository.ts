import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

/**
 * Interface that all Entities must satisfy to be stored in DynamoDB
 */
export interface Entity {
    PK: string;
    SK: string;
    [key: string]: any;
}

/**
 * Base Abstract Repository implementing the Single Table Design
 */
export abstract class BaseRepository<T extends Entity> {
    protected readonly tableName: string;
    protected readonly docClient: DynamoDBDocumentClient;

    constructor(docClient: DynamoDBDocumentClient, tableName: string) {
        this.docClient = docClient;
        this.tableName = tableName;
    }

    // Must be implemented by specific repositories (e.g., TENANT#123)
    protected abstract getPartitionKey(id: string): string;

    // Must be implemented by specific repositories (e.g., PROFILE)
    protected abstract getSortKey(id?: string): string;


    public async get(pkId: string, skId?: string): Promise<T | null> {
        const command = new GetCommand({
            TableName: this.tableName,
            Key: {
                PK: this.getPartitionKey(pkId),
                SK: this.getSortKey(skId),
            },
        });

        const response = await this.docClient.send(command);
        return (response.Item as T) || null;
    }

    public async save(entity: T): Promise<void> {
        // Enforce setting timestamp fields on save
        const itemToSave = {
            ...entity,
            updatedAt: new Date().toISOString(),
            createdAt: entity.createdAt || new Date().toISOString()
        };

        const command = new PutCommand({
            TableName: this.tableName,
            Item: itemToSave,
        });

        await this.docClient.send(command);
    }

    public async delete(pkId: string, skId?: string): Promise<void> {
        const command = new DeleteCommand({
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
    public async queryByPrefix(pkId: string, skPrefix: string): Promise<T[]> {
        const command = new QueryCommand({
            TableName: this.tableName,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
            ExpressionAttributeValues: {
                ':pk': this.getPartitionKey(pkId),
                ':skPrefix': skPrefix,
            },
        });

        const response = await this.docClient.send(command);
        return (response.Items as T[]) || [];
    }
}
