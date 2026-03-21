
import { WidgetDataMapper } from './src/application/utils/WidgetDataMapper';

const sampleMetadata = {
    "M": {
        "insight": {
            "L": [
                {
                    "M": {
                        "id": { "S": "ins_1" },
                        "type": { "S": "chrono-dial" },
                        "grid_span": { "S": "col-span-2" }
                    }
                }
            ]
        }
    }
};

try {
    console.log("Testing unmarshall with DynamoDB format...");
    const unmarshalled = WidgetDataMapper.unmarshall(sampleMetadata);
    console.log("Unmarshalled:", JSON.stringify(unmarshalled, null, 2));

    const insights = unmarshalled.insight;
    console.log("Insights:", insights);
    
    // Simulate AnalyticsService loop
    insights.map((w: any) => {
        console.log("Mapping widget:", w.id);
        const type = w.type || w.widget_type || w.id;
        console.log("Type:", type);
    });

    console.log("SUCCESS");
} catch (err) {
    console.error("CRASH REPRODUCED:", err);
}
