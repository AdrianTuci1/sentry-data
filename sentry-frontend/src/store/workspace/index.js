import { makeAutoObservable } from 'mobx';
import { DataStore } from './DataStore';
import { UIStore } from './UIStore';
import { EditorStore } from './EditorStore';

export class WorkspaceRootStore {
    rootStore;
    data;
    ui;
    editor;

    constructor(rootStore) {
        this.rootStore = rootStore;
        this.data = new DataStore(this);
        this.ui = new UIStore(this);
        this.editor = new EditorStore(this);
        makeAutoObservable(this);
    }
}
