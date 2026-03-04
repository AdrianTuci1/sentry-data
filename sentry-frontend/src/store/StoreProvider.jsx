import React, { createContext, useContext } from 'react';
import { rootStore } from './RootStore';

// Create the Context containing the rootStore instance
const StoreContext = createContext(rootStore);

// Provider Component to wrap the app
export const StoreProvider = ({ children }) => {
    return (
        <StoreContext.Provider value={rootStore}>
            {children}
        </StoreContext.Provider>
    );
};

// Custom Hook to access specific stores easily
export const useStore = () => {
    const store = useContext(StoreContext);
    if (!store) {
        throw new Error('useStore must be used within a StoreProvider.');
    }
    return store;
};
