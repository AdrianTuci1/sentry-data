import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { config } from "../src/config";

const ddbClient = new DynamoDBClient({
    region: config.aws.region,
    credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
    },
});

const docClient = DynamoDBDocumentClient.from(ddbClient);
const TABLE_NAME = config.aws.dynamoTable;

async function inspect(tenantId: string, projectId: string) {
    console.log(`--- Inspecting Project: ${projectId} for Tenant: ${tenantId} ---`);
    console.log(`Table: ${TABLE_NAME}, Region: ${config.aws.region}`);

    const result = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: {
            PK: `TENANT#${tenantId}`,
            SK: `PROJECT#${projectId}`
        }
    }));

    if (!result.Item) {
        console.log("Project not found.");
        return;
    }

    console.log("Status:", result.Item.status);
    console.log("Discovery Metadata Keys:", Object.keys(result.Item.discoveryMetadata || {}));
    if (result.Item.discoveryMetadata) {
        console.log("Discovery Metadata (Full):", JSON.stringify(result.Item.discoveryMetadata, null, 2));
    }
    console.log("Query Configs Count:", (result.Item.queryConfigs || []).length);
}

const tenantId = process.argv[2] || "test_tenant_1";
const projectId = process.argv[3] || "proj_ga4_demo";

inspect(tenantId, projectId).catch(console.error);
