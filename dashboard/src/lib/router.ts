import { useEffect, useState } from 'react';

function currentRoute(): string {
  const hash = window.location.hash;
  return hash ? hash.slice(1) : '/';
}

export function navigate(to: string): void {
  if (currentRoute() === to) return;
  window.location.hash = to;
}

export function useRoute(): string {
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => {
    const onChange = () => setRoute(currentRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
