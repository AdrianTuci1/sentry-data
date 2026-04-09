import { makeAutoObservable } from "mobx";

export class Project {
    id = '';
    name = '';
    status = 'active';
    lastActive = 'Just now';
    connectors = 0;
    models = 0;
    members = [];
    viewLink = '';

    constructor(data) {
        makeAutoObservable(this);
        this.update(data);
    }

    update(data) {
        if (!data) return;
        this.id = data.id || this.id;
        this.name = data.name || this.name;
        this.status = data.status || this.status;
        this.lastActive = data.lastActive || this.lastActive;
        this.connectors = data.connectors || this.connectors;
        this.models = data.models || this.models;
        this.members = Array.isArray(data.members)
            ? data.members.map((member, index) => ({
                id: member.id || `member_${index}_${Date.now()}`,
                account: member.account || '',
                access: member.access || 'viewer',
            }))
            : this.members;
        this.viewLink = data.viewLink || this.viewLink;
    }
}

export class Organization {
    id = '';
    name = '';

    constructor(data) {
        makeAutoObservable(this);
        this.update(data);
    }

    update(data) {
        if (!data) return;
        this.id = data.id || this.id;
        this.name = data.name || this.name;
    }
}
