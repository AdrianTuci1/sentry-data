import React, { useState } from 'react';
import { Database, Plus, Check, X, Shield, Lock, Loader2, RefreshCw, Cloud, Server, Globe } from 'lucide-react';
import { clsx } from 'clsx';

// Mock Config for Connectors
const CONNECTOR_CATALOG = [
    { id: 'tap-google-ads', name: 'Google Ads', category: 'Marketing', icon: Globe, description: 'Campaign performance & spend data' },
    { id: 'tap-facebook', name: 'Facebook Ads', category: 'Marketing', icon: Globe, description: 'Ad insights and audience stats' },
    { id: 'tap-shopify', name: 'Shopify', category: 'E-commerce', icon: Cloud, description: 'Orders, products, and customers' },
    { id: 'tap-postgres', name: 'PostgreSQL', category: 'Database', icon: Database, description: 'Production database replication' },
    { id: 'tap-google-analytics', name: 'Google Analytics 4', category: 'Analytics', icon: Globe, description: 'Web traffic and events' },
    { id: 'tap-salesforce', name: 'Salesforce', category: 'CRM', icon: Cloud, description: 'Leads, opportunities, and accounts' },
];

const AuthorizationWizard = ({ connector, onClose, onComplete }) => {
    const [step, setStep] = useState(1); // 1: Info, 2: Auth, 3: Success
    const [isAuthorizing, setIsAuthorizing] = useState(false);

    const handleAuthorize = () => {
        setIsAuthorizing(true);
        // Simulate API/OAuth delay
        setTimeout(() => {
            setIsAuthorizing(false);
            setStep(3);
        }, 2000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-[#1E1F20] border border-[#444746] rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-[#444746]/50 flex justify-between items-center bg-[#1E1F20]">
                    <h3 className="text-lg font-semibold text-[#E3E3E3] flex items-center gap-2">
                        <connector.icon size={20} className="text-[#A8C7FA]" />
                        Connect {connector.name}
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-[#333537] rounded-full text-[#C4C7C5]">
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto">
                    {step === 1 && (
                        <div className="space-y-6">
                            <div className="p-4 bg-[#A8C7FA]/10 border border-[#A8C7FA]/20 rounded-xl flex gap-3 text-sm text-[#A8C7FA]">
                                <Shield size={20} className="shrink-0" />
                                <div>
                                    <div className="font-semibold mb-1">Data Collection Authorization</div>
                                    <p className="opacity-80">Sentry Data will collect read-only data from your {connector.name} account to power Lakehouse analytics.</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-sm font-medium text-[#E3E3E3]">Permissions Required:</h4>
                                <ul className="space-y-2 text-sm text-[#C4C7C5]">
                                    <li className="flex items-center gap-2"><Check size={14} className="text-green-400" /> Read account information</li>
                                    <li className="flex items-center gap-2"><Check size={14} className="text-green-400" /> Read campaign performance metrics</li>
                                    <li className="flex items-center gap-2"><Check size={14} className="text-green-400" /> Read historical data (up to 2 years)</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="flex flex-col items-center justify-center py-8 space-y-6 text-center">
                            <div className="relative">
                                <div className="w-16 h-16 rounded-2xl bg-[#333537] flex items-center justify-center text-[#E3E3E3]">
                                    <connector.icon size={32} />
                                </div>
                                {isAuthorizing && (
                                    <div className="absolute -bottom-2 -right-2">
                                        <Loader2 size={24} className="animate-spin text-[#A8C7FA]" />
                                    </div>
                                )}
                            </div>

                            <div>
                                <h4 className="text-[#E3E3E3] font-medium mb-2">{isAuthorizing ? 'Authorizing...' : 'Authenticate with Provider'}</h4>
                                <p className="text-sm text-[#80868B] max-w-xs mx-auto">
                                    {isAuthorizing
                                        ? "Verifying credentials and exchanging tokens secure..."
                                        : "We will redirect you to the provider's login page to grant access."}
                                </p>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="flex flex-col items-center justify-center py-8 space-y-4 text-center">
                            <div className="w-16 h-16 rounded-full bg-green-400/20 flex items-center justify-center text-green-400 mb-2">
                                <Check size={32} strokeWidth={3} />
                            </div>
                            <h4 className="text-xl font-bold text-[#E3E3E3]">Connection Successful!</h4>
                            <p className="text-sm text-[#C4C7C5]">Data ingestion has been scheduled. Your first sync will start in a few minutes.</p>
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="p-6 border-t border-[#444746]/50 bg-[#1e1f20] flex justify-end gap-3">
                    {step === 1 && (
                        <>
                            <button onClick={onClose} className="px-4 py-2 rounded-xl text-[#C4C7C5] hover:bg-[#333537] font-medium transition-colors">Cancel</button>
                            <button onClick={() => setStep(2)} className="px-4 py-2 rounded-xl bg-[#A8C7FA] text-[#0B0D0E] font-bold hover:bg-[#8AB4F8] transition-colors shadow-[0_0_15px_rgba(168,199,250,0.3)]">Continue to Auth</button>
                        </>
                    )}
                    {step === 2 && (
                        <button
                            onClick={handleAuthorize}
                            disabled={isAuthorizing}
                            className="w-full px-4 py-3 rounded-xl bg-[#E3E3E3] text-[#0B0D0E] font-bold hover:bg-white transition-colors flex items-center justify-center gap-2"
                        >
                            {isAuthorizing ? 'Connecting...' : <><Lock size={16} /> Authorize Access</>}
                        </button>
                    )}
                    {step === 3 && (
                        <button onClick={() => onComplete(connector)} className="w-full px-4 py-2 rounded-xl bg-[#A8C7FA] text-[#0B0D0E] font-bold hover:bg-[#8AB4F8] transition-colors">
                            Done
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const MeltanoConnectorConfig = () => {
    const [myConnectors, setMyConnectors] = useState([]); // List of installed IDs
    const [wizardConnector, setWizardConnector] = useState(null);

    const handleConnect = (connector) => {
        setWizardConnector(connector);
    };

    const handleWizardComplete = (connector) => {
        setMyConnectors(prev => [...prev, connector.id]);
        setWizardConnector(null);
    };

    return (
        <div className="h-full w-full bg-[#131314] text-[#E3E3E3] p-8 overflow-y-auto">
            <div className="max-w-6xl mx-auto">
                <div className="mb-10">
                    <h1 className="text-3xl font-bold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-[#E3E3E3] to-[#A8C7FA]">
                        Data Connections
                    </h1>
                    <p className="text-[#C4C7C5] text-lg max-w-2xl">
                        Authorize and configure data sources for your Marketing Lakehouse. Secure, read-only access is used for ingestion.
                    </p>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {CONNECTOR_CATALOG.map((connector) => {
                        const isConnected = myConnectors.includes(connector.id);
                        return (
                            <div
                                key={connector.id}
                                className={clsx(
                                    "relative bg-[#1E1F20] rounded-2xl border transition-all duration-300 p-6 flex flex-col h-64",
                                    isConnected
                                        ? "border-green-500/30 shadow-[0_0_20px_rgba(74,222,128,0.05)]"
                                        : "border-[#444746]/50 hover:border-[#A8C7FA]/50 hover:shadow-lg hover:-translate-y-1"
                                )}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className={clsx("p-3 rounded-xl", isConnected ? "bg-green-500/10 text-green-400" : "bg-[#333537] text-[#A8C7FA]")}>
                                        <connector.icon size={26} />
                                    </div>
                                    {isConnected ? (
                                        <div className="px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                                            Active
                                        </div>
                                    ) : (
                                        <div className="px-2.5 py-1 rounded-full bg-[#333537] text-[#80868B] text-xs font-medium uppercase tracking-wider">
                                            Available
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-[#E3E3E3] mb-1">{connector.name}</h3>
                                    <p className="text-sm text-[#80868B]">{connector.description}</p>
                                </div>

                                <div className="mt-4 pt-4 border-t border-[#444746]/30 flex items-center justify-between">
                                    <span className="text-xs text-[#555] font-mono">{connector.category}</span>

                                    {isConnected ? (
                                        <button className="text-sm font-medium text-[#C4C7C5] hover:text-[#E3E3E3] px-3 py-1.5 rounded-lg hover:bg-[#333537] transition-colors">
                                            Configure
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleConnect(connector)}
                                            className="px-4 py-2 rounded-lg bg-[#A8C7FA]/10 text-[#A8C7FA] hover:bg-[#A8C7FA] hover:text-[#0B0D0E] text-sm font-bold transition-all flex items-center gap-2"
                                        >
                                            <Plus size={16} /> Connect
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Wizard Modal */}
            {wizardConnector && (
                <AuthorizationWizard
                    connector={wizardConnector}
                    onClose={() => setWizardConnector(null)}
                    onComplete={handleWizardComplete}
                />
            )}
        </div>
    );
};

export default MeltanoConnectorConfig;
