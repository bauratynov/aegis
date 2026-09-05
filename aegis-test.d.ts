/**
 * Aegis test utilities — `import { render, fire, waitFor, mockFetch, cleanup } from 'aegis/test'`
 */
import type { Component, ComponentContext } from './aegis.js';

export interface RenderHandle<A = unknown> {
    /** container the component was mounted into (a fresh <div> in document.body unless `el` was given) */
    el: HTMLElement;
    /** what the component returned when it is an API object (null when it returned a Node) */
    api: A | null;
    /** querySelector inside the container; throws a readable error when nothing matches */
    find<E extends Element = HTMLElement>(selector: string): E;
    findAll<E extends Element = HTMLElement>(selector: string): E[];
    /** textContent with collapsed whitespace */
    text(): string;
    html(): string;
    unmount(): void;
}
export interface RenderOptions<P> {
    props?: P;
    /** mount into an existing element instead of a fresh container */
    el?: Element;
    /** server markup to put into the container before mounting (adopt()/hydration tests) */
    html?: string;
}
/** Mount a component (the island()/mount() contract) into document.body and return a handle */
export function render<P = Record<string, unknown>, R = unknown>(Component: (ctx: ComponentContext & { props: P }) => R | Node | void, opts?: RenderOptions<P>): RenderHandle<R>;

export interface Fire {
    (el: Element | Document | Window, type: string, init?: EventInit & Record<string, unknown>): Event;
    click(el: Element, init?: MouseEventInit): MouseEvent;
    dblclick(el: Element, init?: MouseEventInit): MouseEvent;
    /** value + input + change, like a user (checkbox/radio: checked) */
    input(el: Element, value: string | number | boolean | null): void;
    change(el: Element, value?: string): Event;
    /** form.requestSubmit() — runs constraint validation and @submit handlers */
    submit(formOrChild: Element): Event | null;
    /** keydown → keypress → keyup */
    key(el: Element, key: string, init?: KeyboardEventInit): KeyboardEvent;
    focus(el: HTMLElement): FocusEvent;
    blur(el: HTMLElement): FocusEvent;
    scroll(el: Element, top?: number): Event;
}
export const fire: Fire;

/** Wait until pred() is truthy, draining effects, resources, mutations and microtasks between checks */
export function waitFor<T>(pred: () => T | Promise<T>, opts?: { timeout?: number; interval?: number }): Promise<T>;
/** Drain pending work once */
export function flushAll(): Promise<void>;

export interface MockRouteContext { url: URL; params: Record<string, string>; query: Record<string, string>; method: string; init: RequestInit }
export type MockRouteHandler = (body: any, ctx: MockRouteContext) => unknown | Response | { status: number; body?: unknown; data?: unknown } | Promise<unknown>;
export interface MockFetch {
    calls: Array<{ method: string; url: string; body: unknown; headers: HeadersInit | Record<string, string> }>;
    last(): MockFetch['calls'][number] | null;
    restore(): void;
}
/** Route table → fake network for request()/api/resource(): { 'GET /api/users/:id': (body, { params }) => … , '*': () => ({ status: 404 }) } */
export function mockFetch(routes?: Record<string, MockRouteHandler>, opts?: { latency?: number }): MockFetch;

/** Deterministic cache clock: staleTime, cacheTime and GC follow it, Date.now is untouched */
export function fakeClock(start?: number): { now(): number; /** advance, garbage-collect by the new time, drain pending work */ advance(ms: number): Promise<void>; set(ms: number): void; restore(): void };

/** Unmount everything rendered, restore fetch, reset engine singletons; call in afterEach */
export function cleanup(): void;
/** Run fn in a throwaway scope (signals/effects without a component) and dispose it afterwards */
export function withScope<T>(fn: () => T | Promise<T>): Promise<T>;
