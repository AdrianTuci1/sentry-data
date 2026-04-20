import React from 'react';
import './ProjectCard.css';
import { ChevronRight, Pencil, Share2, Users } from 'lucide-react';
import { ProjectCardWidget } from './ProjectCardWidget';

const ProjectCard = ({ project, onClick, onEdit, onShare, graphicType }) => {
    return (
        <div className={`project-card theme-${graphicType}`} onClick={onClick}>
            <div className="project-card-header">
                <div>
                    <span className="card-subtitle">{project.status}</span>
                    <h3 className="card-title">{project.name}</h3>
                </div>
                <div className="project-card-actions">
                    <button
                        type="button"
                        className="project-card-edit"
                        onClick={(event) => {
                            event.stopPropagation();
                            onShare?.(project);
                        }}
                        aria-label={`Share ${project.name}`}
                    >
                        <Share2 size={16} />
                    </button>
                    <button
                        type="button"
                        className="project-card-edit"
                        onClick={(event) => {
                            event.stopPropagation();
                            onEdit?.(project);
                        }}
                        aria-label={`Edit ${project.name}`}
                    >
                        <Pencil size={16} />
                    </button>
                </div>
            </div>

            <div className="project-card-graphic">
                <ProjectCardWidget
                    projectId={project.id}
                    widgetId={project.cardWidgetId}
                />
            </div>

            <div className="project-card-footer">
                <div className="footer-stats">
                    <div className="stat-item">
                        <Users size={14} />
                        <span>{project.members?.length || 0} members</span>
                    </div>
                </div>
                <div className="footer-action">
                    <ChevronRight size={18} />
                </div>
            </div>
        </div>
    );
};

export default ProjectCard;
