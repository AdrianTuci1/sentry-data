import React, { createContext, useContext, useEffect, useState, useRef } from 'react';

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
    const [lastMessage, setLastMessage] = useState(null);
    const [readyState, setReadyState] = useState(WebSocket.CONNECTING);
    const ws = useRef(null);

    // Generate a random session ID for now, or use a persistent one if available
    const [sessionId] = useState(() => 'session_' + Math.random().toString(36).substr(2, 9));

    useEffect(() => {
        const connect = () => {
            const socketUrl = `ws://localhost:8000/ws/${sessionId}`;
            // Note: Hardcoded localhost:8000 for now, should ideally be from env

            ws.current = new WebSocket(socketUrl);

            ws.current.onopen = () => {
                console.log('WebSocket Connected');
                setReadyState(WebSocket.OPEN);
            };

            ws.current.onclose = () => {
                console.log('WebSocket Disconnected');
                setReadyState(WebSocket.CLOSED);
                // Simple reconnect logic could go here
            };

            ws.current.onerror = (error) => {
                console.error('WebSocket Error:', error);
                setReadyState(WebSocket.CLOSED);
            };

            ws.current.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    setLastMessage(data);
                } catch (e) {
                    console.log("Received non-JSON message:", event.data);
                    setLastMessage({ type: 'text', content: event.data });
                }
            };
        };

        connect();

        return () => {
            if (ws.current) {
                ws.current.close();
            }
        };
    }, [sessionId]);

    const sendMessage = (message) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify(message));
        } else {
            console.warn('WebSocket is not open. Message not sent.');
        }
    };

    return (
        <WebSocketContext.Provider value={{ sendMessage, lastMessage, readyState, sessionId }}>
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocket = () => {
    return useContext(WebSocketContext);
};
