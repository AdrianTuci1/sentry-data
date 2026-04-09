import React from 'react';
import { useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useStore } from '../store/StoreProvider';
import ProjectCard from '../components/common/ProjectCard';
import './Home.css';

const Home = observer(() => {
    const navigate = useNavigate();
    const { projectStore, dockStore } = useStore();

    const projects = projectStore.projects;

    const handleProjectClick = (projectId) => {
        projectStore.selectProject(projectId);
        navigate(`/project/${projectId}?tab=insights`);
    };

    const openEditOverlay = (project) => {
        dockStore.openProjectEditor('edit', project);
    };

    const themes = ['weather', 'natural', 'wind', 'color', 'red', 'light'];

    return (
        <div className="home-container">
            <div className="home-content">

                {/* Projects Section */}
                <section className="home-section">
                    <div className="home-header">
                        <h1 className="home-title">Projects</h1>
                    </div>

                    <div className="projects-grid">
                        {projects.map((project, index) => {
                            const theme = themes[index % themes.length];
                            return (
                                <ProjectCard
                                    key={project.id}
                                    project={project}
                                    graphicType={theme}
                                    onClick={() => handleProjectClick(project.id)}
                                    onEdit={openEditOverlay}
                                />
                            );
                        })}
                    </div>
                </section>

            </div>
        </div>
    );
});

export default Home;
