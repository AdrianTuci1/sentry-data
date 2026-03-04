import React from 'react';
import './ProjectCard.css';
import { Database, Server, ChevronRight, Plus } from 'lucide-react';

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

const ProjectCard = ({ project, onClick, graphicType, isEmpty }) => {
    if (isEmpty) {
        return (
            <div className="project-card project-card-empty" onClick={onClick}>
                <div className="empty-icon">
                    <Plus size={24} />
                </div>
                <span style={{ fontWeight: 500 }}>Add New Project</span>
            </div>
        );
    }

    return (
        <div className={`project-card theme-${graphicType}`} onClick={onClick}>
            <div className="project-card-header">
                <div>
                    <span className="card-subtitle">{project.status}</span>
                    <h3 className="card-title">{project.name}</h3>
                </div>
            </div>

            <div className="project-card-graphic">
                {renderMicroGraphic(graphicType)}
            </div>

            <div className="project-card-footer">
                <div className="footer-action">
                    <ChevronRight size={18} />
                </div>
            </div>
        </div>
    );
};

export default ProjectCard;
