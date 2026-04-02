import { makeAutoObservable } from 'mobx';

const defaultState = {
    isOpen: false,
    nodeId: null,
    code: '',
    title: '',
    type: 'sql',
    recurrence: 'daily',
    view: 'code',
    payload: null,
    initialTab: 'overview'
};

export class EditorStore {
    rootStore;
    isOpen = defaultState.isOpen;
    nodeId = defaultState.nodeId;
    code = defaultState.code;
    title = defaultState.title;
    type = defaultState.type;
    recurrence = defaultState.recurrence;
    view = defaultState.view;
    payload = defaultState.payload;
    initialTab = defaultState.initialTab;

    constructor(rootStore) {
        this.rootStore = rootStore;
        makeAutoObservable(this);
    }

    setOpen(isOpen) {
        if (!isOpen) {
            this.close();
            return;
        }

        this.isOpen = true;
    }

    setState(state) {
        Object.assign(this, defaultState, state);
    }

    openCode(state) {
        this.setState({
            ...state,
            isOpen: true,
            view: 'code',
            payload: state.payload || null,
            initialTab: state.initialTab || 'overview'
        });
    }

    openInspector(state) {
        this.setState({
            ...state,
            isOpen: true,
            view: 'inspector',
            code: state.code || '',
            type: state.type || 'python',
            recurrence: state.recurrence || 'manual',
            initialTab: state.initialTab || 'overview'
        });
    }

    close() {
        Object.assign(this, defaultState);
    }

    setCode(code) {
        this.code = code;
    }

    setRecurrence(recurrence) {
        this.recurrence = recurrence;
    }
}
