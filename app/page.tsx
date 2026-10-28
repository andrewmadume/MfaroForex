import Terminal from './terminal';
import { getChatGPTUser } from './chatgpt-auth';
export const dynamic = 'force-dynamic';
export default async function Home() { const user = await getChatGPTUser(); return <Terminal user={user ? {name:user.fullName || 'Trader',email:user.email} : null}/>; }
