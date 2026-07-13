import { redirect } from 'next/navigation';

export default function AgentRuntimePage() {
  redirect('/loops?view=operations#agent-runtime');
}
