import { getServerConfig } from '../config/index.ts';
import type { BetaAccessService } from './betaAccess.interface.ts';
import { DefaultBetaAccessService } from './implementations/defaultBetaAccessService.ts';
import { FirestoreBetaInviteStore } from './implementations/firestoreBetaInviteStore.ts';

export {
  BetaAccessError,
  type BetaAccessReason,
  type BetaAccessService,
  type BetaInvitePatch,
  type BetaInviteRecord,
  type BetaInviteStore,
  type HttpCookieRequest,
  type InviteReservation,
} from './betaAccess.interface.ts';
export { DefaultBetaAccessService } from './implementations/defaultBetaAccessService.ts';
export { FirestoreBetaInviteStore } from './implementations/firestoreBetaInviteStore.ts';
export { InMemoryBetaInviteStore } from './implementations/inMemoryBetaInviteStore.ts';

export const firestoreBetaInviteStore = new FirestoreBetaInviteStore();

export const betaAccessService: BetaAccessService =
  new DefaultBetaAccessService(firestoreBetaInviteStore, getServerConfig());
