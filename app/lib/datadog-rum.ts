let datadogRumInitPromise: Promise<void> | null = null;

interface DatadogDeferredRuntime {
  __RBSSR_DD_RUM_INIT__?: boolean;
}

declare global {
  interface Window extends DatadogDeferredRuntime {}
}

function resolveEnvName(): string {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'development';
  }
  return 'production';
}

export async function initDatadogRum(): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    return;
  }
  if (typeof window === 'undefined') {
    return;
  }

  if (window.__RBSSR_DD_RUM_INIT__) {
    return;
  }

  if (datadogRumInitPromise) {
    return datadogRumInitPromise;
  }

  datadogRumInitPromise = (async () => {
    const [{ datadogRum }, { reactPlugin }] = await Promise.all([
      import('@datadog/browser-rum'),
      import('@datadog/browser-rum-react'),
    ]);

    datadogRum.init({
      applicationId: 'bb71dcac-87aa-4799-9006-548e76b0e988',
      clientToken: 'pub485666bed1d6d33115b0a53ce3d315c2',
      site: 'datadoghq.eu',
      service: 'react-bun-ssr-docs',
      env: resolveEnvName(),
      version: '0.1.0',
      sessionSampleRate: 100,
      sessionReplaySampleRate: 20,
      trackResources: true,
      trackUserInteractions: true,
      trackLongTasks: true,
      plugins: [reactPlugin({ router: false })],
    });

    window.__RBSSR_DD_RUM_INIT__ = true;
  })().catch((error) => {
    datadogRumInitPromise = null;
    throw error;
  });

  return datadogRumInitPromise;
}
