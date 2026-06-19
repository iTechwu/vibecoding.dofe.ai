import { DeterministicLoopsAgentAdapter } from '../apps/api/src/modules/loops/adapters/deterministic-loops-agent.adapter';
import { LoopsFileStoreService } from '../apps/api/src/modules/loops/loops-file-store.service';
import { LoopsRunnerService } from '../apps/api/src/modules/loops/loops-runner.service';
import { LoopsService } from '../apps/api/src/modules/loops/loops.service';

async function main() {
  const command = process.argv[2] ?? 'status';
  const store = new LoopsFileStoreService();
  const service = new LoopsService(
    store,
    new LoopsRunnerService(),
    new DeterministicLoopsAgentAdapter(),
  );

  if (command === 'status') {
    const data = await service.list();
    console.log(
      JSON.stringify(
        {
          issues: data.issues.length,
          loops: data.loops,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (command === 'doctor') {
    console.log(JSON.stringify(await service.doctor(), null, 2));
    return;
  }

  if (command === 'cost') {
    console.log(JSON.stringify(await service.cost(), null, 2));
    return;
  }

  if (command === 'logs') {
    const issueId = process.argv[3];
    const limit = Number(process.argv[4] ?? 50);
    console.log(
      JSON.stringify(
        await service.logs({
          issueId,
          limit: Number.isFinite(limit) ? limit : 50,
        }),
        null,
        2,
      ),
    );
    return;
  }

  if (command === 'resume') {
    console.log(JSON.stringify(await service.resume(), null, 2));
    return;
  }

  if (command === 'pause') {
    const issueId = process.argv[3];
    if (!issueId) {
      throw new Error('issueId is required for pause');
    }
    console.log(
      JSON.stringify(
        await service.intervene(issueId, {
          action: 'pause',
          actor: 'human-cli',
        }),
        null,
        2,
      ),
    );
    return;
  }

  if (command === 'resume-loop') {
    const issueId = process.argv[3];
    if (!issueId) {
      throw new Error('issueId is required for resume-loop');
    }
    console.log(
      JSON.stringify(
        await service.intervene(issueId, {
          action: 'resume',
          actor: 'human-cli',
        }),
        null,
        2,
      ),
    );
    return;
  }

  if (command === 'take') {
    const issueId = process.argv[3];
    const shardId = process.argv[4];
    const notes = process.argv.slice(5).join(' ').trim();
    if (!issueId || !shardId) {
      throw new Error('issueId and shardId are required for take');
    }
    console.log(
      JSON.stringify(
        await service.intervene(issueId, {
          action: 'take',
          actor: 'human-cli',
          shardId,
          notes: notes || undefined,
        }),
        null,
        2,
      ),
    );
    return;
  }

  console.error(`Unknown loops command: ${command}`);
  console.error(
    'Usage: pnpm loops:status | pnpm loops:doctor | pnpm loops:cost | pnpm loops:logs [issueId] [limit] | pnpm loops:resume | pnpm loops:pause <issueId> | pnpm loops:resume-loop <issueId> | pnpm loops:take <issueId> <shardId> [notes]',
  );
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
