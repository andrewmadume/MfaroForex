import type { ComponentProps } from 'react';

const paths = { signin: '/auth/signin', signout: '/auth/signout' } as const;
type AuthLinkProps = Omit<ComponentProps<'a'>, 'href' | 'target'> & {
  action: keyof typeof paths;
};

// Auth endpoints set cookies and redirect outside the app. Always use a full
// top-level navigation rather than Next's client navigation or prefetching.
export default function AuthLink({ action, ...props }: AuthLinkProps) {
  return <a {...props} href={paths[action]} target="_top" />;
}
