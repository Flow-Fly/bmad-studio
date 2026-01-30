import { Signal } from 'signal-polyfill';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export const connectionState = new Signal.State<ConnectionStatus>('disconnected');
