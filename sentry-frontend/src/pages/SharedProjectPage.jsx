import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AccountService } from '../api/core';
import { useStore } from '../store/StoreProvider';
import Workspace from '../components/visuals/Workspace';

const SharedProjectPage = () => {
    const { tenantId, projectId, shareToken } = useParams();
    const { workspaceStore } = useStore();
    const [sharedProject, setSharedProject] = useState(null);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadSharedProject = async () => {
            try {
                setIsLoading(true);
                const res = await AccountService.getSharedProject(tenantId, projectId, shareToken);
                setSharedProject(res.data);
                workspaceStore.data.setData(res.data.project.discoveryMetadata || null);
            } catch (sharedError) {
                console.error('[SharedProjectPage] Failed to load shared project:', sharedError);
                setError('This share link is invalid or has expired.');
            } finally {
                setIsLoading(false);
            }
        };

        loadSharedProject();
    }, [tenantId, projectId, shareToken, workspaceStore]);

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#0b0d0e] text-[#9aa0a6]">
                Loading shared project...
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#0b0d0e] px-6 text-[#e3e3e3]">
                <div className="max-w-xl rounded-[24px] border border-[#2c2d2f] bg-[#141619] p-8">
                    <h1 className="mt-0 text-[1.8rem]">Shared project unavailable</h1>
                    <p className="m-0 text-[#9aa0a6]">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col bg-[#0b0d0e]">
            <div className="border-b border-[#2c2d2f] px-6 py-4 text-[#e3e3e3]">
                <p className="m-0 text-[11px] uppercase tracking-[0.18em] text-[#8e918f]">
                    Shared project view
                </p>
                <h1 className="m-0 mt-2 text-[1.8rem]">{sharedProject?.project?.name}</h1>
                <p className="m-0 mt-1 text-sm text-[#9aa0a6]">
                    {sharedProject?.workspace?.name}
                    {sharedProject?.share?.expiresAt ? ` • Expires ${new Date(sharedProject.share.expiresAt).toLocaleDateString()}` : ''}
                </p>
            </div>
            <div className="flex-1 overflow-hidden">
                <Workspace viewState="engineering" />
            </div>
        </div>
    );
};

export default SharedProjectPage;
