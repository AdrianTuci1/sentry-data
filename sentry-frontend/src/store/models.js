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
        this.id = data.id ?? this.id;
        this.name = data.name ?? this.name;
        this.status = data.status ?? this.status;
        this.lastActive = data.lastActive ?? this.lastActive;
        this.connectors = data.connectors ?? this.connectors;
        this.models = data.models ?? this.models;
        this.members = Array.isArray(data.members)
            ? data.members.map((member, index) => ({
                id: member.id || `member_${index}_${Date.now()}`,
                account: member.account || '',
                access: member.access || 'viewer',
            }))
            : this.members;
        this.viewLink = data.viewLink ?? this.viewLink;
    }
}

export class Organization {
    id = '';
    name = '';
    slug = '';
    status = 'active';
    plan = 'free';
    limits = null;
    membershipRole = null;

    constructor(data) {
        makeAutoObservable(this);
        this.update(data);
    }

    update(data) {
        if (!data) return;
        this.id = data.id ?? data.workspaceId ?? this.id;
        this.name = data.name ?? this.name;
        this.slug = data.slug ?? this.slug;
        this.status = data.status ?? this.status;
        this.plan = data.plan ?? this.plan;
        this.limits = data.limits ?? this.limits;
        this.membershipRole = data.membershipRole ?? this.membershipRole;
    }
}

export class User {
    id = '';
    name = '';
    email = '';

    constructor(data) {
        makeAutoObservable(this);
        this.update(data);
    }

    update(data) {
        if (!data) return;
        this.id = data.id ?? data.userId ?? this.id;
        this.name = data.name ?? this.name;
        this.email = data.email ?? this.email;
    }
}
