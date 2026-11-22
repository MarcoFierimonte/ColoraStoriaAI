import { betaAccessService } from '../backend/src/modules/beta-access/index.ts';

function readFlag(args: readonly string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === `--${name}` && args[i + 1]) {
      return args[i + 1];
    }
    if (arg.startsWith(prefix)) {
      return arg.slice(prefix.length);
    }
  }
  return undefined;
}

function printUsage() {
  console.log(`Usage:
  npx tsx scripts/manage-invites.ts create --label "Marco" [--code MARCO-BETA] [--max 50] [--days 30]
  npx tsx scripts/manage-invites.ts list
  npx tsx scripts/manage-invites.ts revoke <CODE>`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    printUsage();
    process.exit(1);
  }

  if (command === 'create') {
    const label = readFlag(args, 'label');
    if (!label) {
      console.error('Missing required --label argument.');
      printUsage();
      process.exit(1);
    }

    const code = readFlag(args, 'code');
    const maxRaw = readFlag(args, 'max');
    const daysRaw = readFlag(args, 'days');
    const maxGenerations = maxRaw ? Number(maxRaw) : 10;
    const expiresInDays = daysRaw ? Number(daysRaw) : null;

    const invite = await betaAccessService.createInvite(
      {
        label,
        code,
        maxGenerations,
        expiresInDays,
      },
      'cli-admin'
    );

    console.log('Created beta invite:');
    console.log(`  Code:  ${invite.code}`);
    console.log(`  Label: ${invite.label}`);
    console.log(`  Max:   ${invite.maxGenerations} generations`);
    console.log(
      `  Exp:   ${invite.expiresAtMs ? new Date(invite.expiresAtMs).toISOString() : 'Never'}`
    );
    console.log(
      `  Link:  https://colorastoria-ndqkmbrxia-ew.a.run.app/?invite=${invite.code}`
    );
    return;
  }

  if (command === 'list') {
    const invites = await betaAccessService.listInvites();
    if (invites.length === 0) {
      console.log('No invites found in Firestore.');
      return;
    }

    for (const inv of invites) {
      const status = !inv.active
        ? 'REVOKED'
        : inv.isExpired
          ? 'EXPIRED'
          : inv.isExhausted
            ? 'EXHAUSTED'
            : 'ACTIVE';
      const exp = inv.expiresAtMs
        ? new Date(inv.expiresAtMs).toISOString().slice(0, 10)
        : 'never';
      console.log(
        `${inv.code.padEnd(16)} [${status}] ${inv.usedGenerations}/${inv.maxGenerations} exp=${exp} label="${inv.label}"`
      );
    }
    return;
  }

  if (command === 'revoke') {
    const code = args[1];
    if (!code) {
      console.error('Missing invite <CODE> to revoke.');
      printUsage();
      process.exit(1);
    }
    const updated = await betaAccessService.updateInvite(code, { active: false });
    console.log(`Revoked invite ${updated.code} (${updated.label}).`);
    return;
  }

  console.error(`Unknown command "${command}".`);
  printUsage();
  process.exit(1);
}

main().catch((err) => {
  console.error('Invite management failed:', err);
  process.exit(1);
});
