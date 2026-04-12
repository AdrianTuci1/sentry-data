import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AccountService } from '../api/core';
import { useStore } from '../store/StoreProvider';

const InvitationAcceptPage = () => {
    const navigate = useNavigate();
    const { tenantId, workspaceId, inviteToken } = useParams();
    const { organizationStore } = useStore();
    const [preview, setPreview] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAccepting, setIsAccepting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const loadPreview = async () => {
            try {
                setIsLoading(true);
                const res = await AccountService.previewInvitation(tenantId, workspaceId, inviteToken);
                setPreview(res.data);
            } catch (previewError) {
                console.error('[InvitationAcceptPage] Failed to preview invitation:', previewError);
                setError('This invitation is no longer available.');
            } finally {
                setIsLoading(false);
            }
        };

        loadPreview();
    }, [tenantId, workspaceId, inviteToken]);

    const handleAccept = async () => {
        try {
            setIsAccepting(true);
            setError('');
            await organizationStore.acceptInvitation(tenantId, workspaceId, inviteToken);
            navigate('/settings?tab=team');
        } catch (acceptError) {
            console.error('[InvitationAcceptPage] Failed to accept invitation:', acceptError);
            setError('The invite could not be accepted for the current account.');
        } finally {
            setIsAccepting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0b0d0e] text-[#e3e3e3] px-6 py-10">
            <div className="mx-auto max-w-2xl rounded-[28px] border border-[#2c2d2f] bg-[#141619] p-8 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
                <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-[#8e918f]">Workspace invitation</p>
                <h1 className="m-0 text-[2rem] leading-tight">Join this workspace</h1>

                {isLoading ? (
                    <p className="mt-5 text-[#9aa0a6]">Loading invitation details...</p>
                ) : error ? (
                    <div className="mt-5 rounded-2xl border border-[rgba(255,107,107,0.25)] bg-[rgba(255,107,107,0.08)] px-4 py-3 text-[#ffb3b3]">
                        {error}
                    </div>
                ) : (
                    <>
                        <div className="mt-6 grid gap-4 rounded-[22px] border border-[#2c2d2f] bg-[#101214] p-5">
                            <div>
                                <span className="block text-sm text-[#8e918f]">Workspace</span>
                                <strong className="text-lg">{preview?.workspace?.name}</strong>
                            </div>
                            <div>
                                <span className="block text-sm text-[#8e918f]">Invited as</span>
                                <strong className="capitalize">{preview?.invitation?.role}</strong>
                            </div>
                            <div>
                                <span className="block text-sm text-[#8e918f]">Email</span>
                                <strong>{preview?.invitation?.email}</strong>
                            </div>
                        </div>

                        <div className="mt-6 flex gap-3">
                            <button
                                type="button"
                                onClick={handleAccept}
                                disabled={isAccepting}
                                className="inline-flex min-h-[46px] items-center justify-center rounded-full border border-[#a8c7fa] bg-[#a8c7fa] px-5 text-sm font-semibold text-[#111416]"
                            >
                                {isAccepting ? 'Accepting...' : 'Accept invitation'}
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/')}
                                className="inline-flex min-h-[46px] items-center justify-center rounded-full border border-[#2c2d2f] bg-transparent px-5 text-sm text-[#c4c7c5]"
                            >
                                Back to app
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default InvitationAcceptPage;
