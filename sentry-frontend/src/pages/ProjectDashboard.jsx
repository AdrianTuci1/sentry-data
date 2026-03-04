import React, { useEffect } from 'react';
import { Database, Layers, Folder } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useStore } from '../store/StoreProvider';
import Workspace from '../components/visuals/Workspace';
import projectData from '../data/projectData.json';

const ProjectDashboard = observer(() => {
    const { projectId } = useParams();
    const { projectStore, workspaceStore } = useStore();

    // Ensure the project store has the correct active project selected
    useEffect(() => {
        if (projectId && projectStore.currentProjectId !== projectId) {
            projectStore.selectProject(projectId);
        }
    }, [projectId, projectStore]);

    const activeProject = projectStore.currentProject;

    // Use mock data from JSON and initialize store
    useEffect(() => {
        if (projectData.workspaceData) {
            workspaceStore.data.setData(projectData.workspaceData);
        }
    }, [workspaceStore]);

    return (
        <div className="flex flex-col h-full w-full bg-[#0B0D0E]">
            {/* Main Workspace Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#131314] relative">

                {/* Workspace Content */}
                <div className="flex-1 overflow-hidden relative">
                    {activeProject ? (
                        <Workspace viewState="engineering" />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-[#444746]">
                            <Folder size={64} className="mb-4 opacity-20" />
                            <p>Project not found</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

export default ProjectDashboard;
