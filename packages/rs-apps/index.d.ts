import type RemoteStorage from 'remotestoragejs';
import type { RSModule } from 'remotestoragejs/release/types/remotestorage';
export function scopedModule(name: string, methods: string[], types?: Record<string, object>): RSModule;
export function inspectionModule(rs: RemoteStorage): RSModule;
export function withChanges(original: RSModule, eventName?: string, path?: string): RSModule;
export function withPublicLinks(original: RSModule): RSModule;
export function attachSolid(rs: RemoteStorage): HTMLDetailsElement | undefined;
