export const AgentService = {
    async interact(sessionId, userInput, action = null, payload = {}) {
        try {
            const res = await fetch('http://localhost:8000/api/v1/agent/interact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    user_input: userInput,
                    action: action,
                    payload: payload
                })
            });

            if (!res.ok) {
                throw new Error(`API Error: ${res.status}`);
            }

            return await res.json();
        } catch (error) {
            console.error("Agent Service Error:", error);
            throw error;
        }
    }
};
