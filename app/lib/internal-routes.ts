export function isFrameworkTestPath(pathname: string): boolean {
  return pathname === "/framework-test" || pathname.startsWith("/framework-test/");
}

