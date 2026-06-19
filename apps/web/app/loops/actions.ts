'use server';

import { revalidatePath } from 'next/cache';
import { resumeLoops } from '@/lib/api/loops';

export async function resumeLoopsAction() {
  await resumeLoops();
  revalidatePath('/loops');
}
