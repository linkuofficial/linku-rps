/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_WS_URL?: string;
    readonly VITE_GESTURE_MODE?: 'minimal' | 'off';
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
