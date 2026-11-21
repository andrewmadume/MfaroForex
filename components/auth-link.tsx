import type { ReactNode } from 'react';

type Props={action:'signin'|'signout';children:ReactNode;className?:string};
// Full navigation keeps identity-provider redirects out of client-side routing.
// Sign-out changes server state and must be an origin-checked POST.
export default function AuthLink({action,children,className}:Props){
 if(action==='signout')return <form method="post" action="/auth/signout" target="_top"><button type="submit" className={className}>{children}</button></form>;
 const href='/auth/signin';
 return <a href={href} target="_top" className={className}>{children}</a>;
}
