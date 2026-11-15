import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Request } from 'express';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getServerConfig } from '../config/env.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIREBASE_CONFIG_PATH = path.resolve(
  __dirname,
  '../../../firebase-applet-config.json'
);

let firebaseInitialized = false;

function ensureFirebaseAdmin(): boolean {
  if (firebaseInitialized || getApps().length > 0) {
    firebaseInitialized = true;
    return true;
  }

  try {
    if (!fs.existsSync(FIREBASE_CONFIG_PATH)) {
      return false;
    }
    const raw = fs.readFileSync(FIREBASE_CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw) as { projectId?: string };
    if (!parsed.projectId) {
      return false;
    }
    initializeApp({ projectId: parsed.projectId });
    firebaseInitialized = true;
    return true;
  } catch (err) {
    console.error('Failed to initialize firebase-admin:', err);
    return false;
  }
}

export interface AdminContext {
  authenticated: boolean;
  isAdmin: boolean;
  uid?: string;
  email?: string;
}

export async function verifyOptionalAdmin(req: Request): Promise<AdminContext> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authenticated: false, isAdmin: false };
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return { authenticated: false, isAdmin: false };
  }

  if (!ensureFirebaseAdmin()) {
    return { authenticated: false, isAdmin: false };
  }

  try {
    const decoded = await getAuth().verifyIdToken(token);
    const email = decoded.email?.toLowerCase();
    const emailVerified = decoded.email_verified === true;
    const { adminEmails } = getServerConfig();

    const isAdmin = Boolean(
      email && emailVerified && adminEmails.includes(email)
    );

    return {
      authenticated: true,
      isAdmin,
      uid: decoded.uid,
      email: decoded.email,
    };
  } catch {
    return { authenticated: false, isAdmin: false };
  }
}
