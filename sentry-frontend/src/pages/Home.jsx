import React from 'react';
import { useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useStore } from '../store/StoreProvider';
import { Folder, Plus, Users, Settings } from 'lucide-react';
import ProjectCard from '../components/common/ProjectCard';
import './Home.css';

const Home = observer(() => {
    const navigate = useNavigate();
    const { projectStore } = useStore();

    // Get projects from MobX
    const projects = projectStore.projects;

    const handleProjectClick = (projectId) => {
        projectStore.selectProject(projectId);
        navigate(`/project/${projectId}`);
    };

    const themes = ['weather', 'natural', 'wind', 'color', 'red', 'light'];

    return (
        <div className="home-container">
            <div className="home-content">

                {/* Projects Section */}
                <section className="home-section">
                    <div className="home-header">
                        <h2 className="home-title">
                            <Folder size={22} color="#A8C7FA" />
                            Projects
                        </h2>

                        <button className="btn-create">
                            <Plus size={18} />
                            Create Project
                        </button>
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
