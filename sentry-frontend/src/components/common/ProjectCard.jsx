import React from 'react';
import './ProjectCard.css';
import { ChevronRight, Pencil, Users } from 'lucide-react';

const renderMicroGraphic = (type) => {
    switch (type) {
        case 'weather':
            return (
                <div className="micro-weather">
                    <span className="weather-temp">29&deg;</span>
                    <div className="weather-lines">
                        <span></span><span></span><span></span><span></span><span></span><span></span><span></span>
                    </div>
                </div>
            );
        case 'natural':
            return (
                <div className="micro-natural">
                    <span className="natural-val">75<small style={{ fontSize: '1.5rem' }}>%</small></span>
                    <div className="natural-slider"></div>
                </div>
            );
        case 'wind':
            return (
                <div className="micro-wind">
                    <span className="wind-val">07</span>
                    <div className="wind-orb"></div>
                </div>
            );
        case 'color':
            return (
                <div className="micro-color">
                    <div className="color-knob"></div>
                </div>
            );
        case 'red':
            return (
                <div className="micro-red">
                    <div className="bar"></div>
                </div>
            );
        case 'light':
            return (
                <div className="micro-light">
                    <span className="light-val">75 lx</span>
                </div>
            );
        default:
            return null;
    }
};

const ProjectCard = ({ project, onClick, onEdit, graphicType }) => {
    return (
        <div className={`project-card theme-${graphicType}`} onClick={onClick}>
            <div className="project-card-header">
                <div>
                    <span className="card-subtitle">{project.status}</span>
                    <h3 className="card-title">{project.name}</h3>
                </div>
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

            <div className="project-card-graphic">
                {renderMicroGraphic(graphicType)}
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
