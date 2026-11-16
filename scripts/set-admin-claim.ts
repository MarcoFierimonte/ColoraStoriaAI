import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.resolve(__dirname, '../firebase-applet-config.json');

async function main() {
  const args = process.argv.slice(2);
  const revoke = args.includes('--revoke');
  const email = args.find((arg) => !arg.startsWith('--'));

  if (!email) {
    console.error(
      'Usage: npx tsx scripts/set-admin-claim.ts <user-email> [--revoke]'
    );
    process.exit(1);
  }

  let projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
  if (!projectId && fs.existsSync(CONFIG_PATH)) {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as {
      projectId?: string;
    };
    projectId = raw.projectId;
  }

  if (!projectId) {
    console.error('Could not determine Firebase projectId.');
    process.exit(1);
  }

  if (getApps().length === 0) {
    initializeApp({ projectId });
  }

  const auth = getAuth();
  const user = await auth.getUserByEmail(email.trim().toLowerCase());
  const existingClaims = user.customClaims ?? {};
  const nextClaims = revoke
    ? { ...existingClaims, admin: false }
    : { ...existingClaims, admin: true };

  await auth.setCustomUserClaims(user.uid, nextClaims);
  console.log(
    revoke
      ? `Revoked admin claim for ${user.email} (uid=${user.uid}).`
      : `Granted admin claim for ${user.email} (uid=${user.uid}). User must sign out and sign in again to refresh ID token.`
  );
}

main().catch((err) => {
  console.error('Failed to update custom claims:', err);
  process.exit(1);
});
