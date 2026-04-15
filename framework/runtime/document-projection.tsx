import { Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  collectHeadElements,
  createManagedHeadMarkup,
} from "./render";
import type {
  HydrationDocumentAssets,
  Params,
  RenderPayload,
  RouteModuleBundle,
} from "./types";

export interface RouteDocumentProjection {
  renderPayload: RenderPayload;
  clientPayload: RenderPayload;
  headElements: ReactNode[];
  managedHeadMarkup: string;
  assets: HydrationDocumentAssets;
}

export function projectRouteDocument(options: {
  modules: RouteModuleBundle;
  routeId: string;
  params: Params;
  url: string;
  loaderDataForRender: unknown;
  loaderDataForClient: unknown;
  error?: RenderPayload["error"];
  assets: HydrationDocumentAssets;
}): RouteDocumentProjection {
  const renderPayload: RenderPayload = {
    routeId: options.routeId,
    loaderData: options.loaderDataForRender,
    params: options.params,
    url: options.url,
    ...(options.error === undefined ? {} : { error: options.error }),
  };
  const clientPayload: RenderPayload = {
    ...renderPayload,
    loaderData: options.loaderDataForClient,
  };
  const headElements = collectHeadElements(options.modules, renderPayload);
  const headMarkup = renderToStaticMarkup(<Fragment>{headElements}</Fragment>);

  return {
    renderPayload,
    clientPayload,
    headElements,
    managedHeadMarkup: createManagedHeadMarkup({
      headMarkup,
      assets: options.assets,
    }),
    assets: options.assets,
  };
}
