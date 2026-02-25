---
title: react-bun-ssr
description: Public runtime exports from the root package entrypoint.
section: API Reference
order: 2
tags: api,generated
---

# react-bun-ssr

Auto-generated from framework TypeScript exports. Do not edit manually.

## Action

- Kind: type
- Source: `framework/runtime/types.ts`

```ts
export type Action = (ctx: ActionContext) => Promise<ActionResult> | ActionResult;
```

## ActionContext

- Kind: interface
- Source: `framework/runtime/types.ts`

```ts
export interface ActionContext extends RequestContext {
```

## ActionResult

- Kind: type
- Source: `framework/runtime/types.ts`

```ts
export type ActionResult = LoaderResult | RedirectResult;
```

## ApiRouteModule

- Kind: interface
- Source: `framework/runtime/types.ts`

```ts
export interface ApiRouteModule {
```

## BuildManifest

- Kind: interface
- Source: `framework/runtime/types.ts`

```ts
export interface BuildManifest {
```

## BuildRouteAsset

- Kind: interface
- Source: `framework/runtime/types.ts`

```ts
export interface BuildRouteAsset {
```

## createServer

- Kind: function
- Source: `framework/runtime/server.ts`

```ts
createServer(config?: FrameworkConfig, runtimeOptions?: ServerRuntimeOptions): { fetch(req: Request): Promise<Response>; }
```

## defineConfig

- Kind: function
- Source: `framework/runtime/helpers.ts`

```ts
defineConfig(config: FrameworkConfig): FrameworkConfig
```

## FrameworkConfig

- Kind: interface
- Source: `framework/runtime/types.ts`

```ts
export interface FrameworkConfig {
```

## json

- Kind: function
- Source: `framework/runtime/helpers.ts`

```ts
json(data: unknown, init?: ResponseInit): Response
```

## Loader

- Kind: type
- Source: `framework/runtime/types.ts`

```ts
export type Loader = (ctx: LoaderContext) => Promise<LoaderResult> | LoaderResult;
```

## LoaderContext

- Kind: interface
- Source: `framework/runtime/types.ts`

```ts
export interface LoaderContext extends RequestContext {}
```

## LoaderResult

- Kind: type
- Source: `framework/runtime/types.ts`

```ts
export type LoaderResult =
```

## Middleware

- Kind: type
- Source: `framework/runtime/types.ts`

```ts
export type Middleware = (
```

## Outlet

- Kind: function
- Source: `framework/runtime/tree.tsx`

```ts
Outlet(): ReactElement<unknown, string | JSXElementConstructor<any>> | null
```

## Params

- Kind: type
- Source: `framework/runtime/types.ts`

```ts
export type Params = Record<string, string>;
```

## redirect

- Kind: function
- Source: `framework/runtime/helpers.ts`

```ts
redirect(location: string, status?: 301 | 302 | 303 | 307 | 308 | undefined): RedirectResult
```

## RedirectResult

- Kind: interface
- Source: `framework/runtime/types.ts`

```ts
export interface RedirectResult {
```

## RequestContext

- Kind: interface
- Source: `framework/runtime/types.ts`

```ts
export interface RequestContext {
```

## RouteModule

- Kind: interface
- Source: `framework/runtime/types.ts`

```ts
export interface RouteModule {
```

## startHttpServer

- Kind: function
- Source: `framework/runtime/server.ts`

```ts
startHttpServer(options: { config: FrameworkConfig; runtimeOptions?: ServerRuntimeOptions | undefined; }): void
```

## useLoaderData

- Kind: function
- Source: `framework/runtime/tree.tsx`

```ts
useLoaderData<T = unknown>(): T
```

## useParams

- Kind: function
- Source: `framework/runtime/tree.tsx`

```ts
useParams<T extends Params = Params>(): T
```

## useRequestUrl

- Kind: function
- Source: `framework/runtime/tree.tsx`

```ts
useRequestUrl(): URL
```

## useRouteError

- Kind: function
- Source: `framework/runtime/tree.tsx`

```ts
useRouteError(): unknown
```
