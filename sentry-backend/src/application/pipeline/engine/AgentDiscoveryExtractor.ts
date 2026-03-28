export class AgentDiscoveryExtractor {
    public static extract(logs: string, stdout: string): any {
        let discovery = {};
        
        // 1. LLM-generated (Reasoning Phase)
        const llmMatch = [...logs.matchAll(/--- AGENT_DISCOVERY_METADATA ---\n([\s\S]*?)(\n---|$)/g)];
        llmMatch.forEach(m => {
            try { 
                Object.assign(discovery, JSON.parse(m[1].trim())); 
            } catch (e) { 
                console.warn('[AgentDiscoveryExtractor] Error parsing LLM discovery metadata:', e);
            }
        });

        // 2. Code-generated (Execution Phase)
        const codeMatch = [...stdout.matchAll(/AGENT_DISCOVERY:(.*?)(?=\nAGENT_|$)/gs)];
        codeMatch.forEach(m => {
            const raw = m[1].trim();
            try {
                Object.assign(discovery, JSON.parse(raw));
            } catch (e) {
                const json = raw.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
                if (json) {
                    try { 
                        Object.assign(discovery, JSON.parse(json[0])); 
                    } catch (e2: any) { 
                        console.warn('[AgentDiscoveryExtractor] Error parsing code discovery metadata (JSON match):', e2.message);
                    }
                }
            }
        });

        return discovery;
    }
}
