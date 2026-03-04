import { makeAutoObservable } from 'mobx';

export class EditorStore {
    rootStore;
    isOpen = false;
    nodeId = null;
    code = '';
    title = '';
    type = 'sql';
    recurrence = 'daily';

    constructor(rootStore) {
        this.rootStore = rootStore;
        makeAutoObservable(this);
    }

    setOpen(isOpen) {
        this.isOpen = isOpen;
    }

    setState(state) {
        Object.assign(this, state);
    }

    setCode(code) {
        this.code = code;
    }

    setRecurrence(recurrence) {
        this.recurrence = recurrence;
    }
}
