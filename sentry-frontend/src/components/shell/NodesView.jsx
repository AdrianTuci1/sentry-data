import React from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../store/StoreProvider';
import Workspace from '../visuals/Workspace';

const NodesView = observer(() => {
    const { projectStore } = useStore();
    const activeProject = projectStore.currentProject;

    return (
        <div className="h-full w-full bg-[#0B0D0E] overflow-hidden">
            {activeProject ? (
                <Workspace viewState="engineering" />
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-[#444746]">
                    <p className="text-lg mb-2">No project selected</p>
                    <p className="text-sm opacity-60">Select a project from the home page to view the node map</p>
                </div>
            )}
        </div>
    );
});

export default NodesView;
