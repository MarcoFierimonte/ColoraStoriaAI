# Firestore Security Specification

## 1. Data Invariants
1. All collections deny read and write by default (`/{document=**}`).
2. Admin access requires `request.auth != null && request.auth.token.email_verified == true`.
3. Every `generation_logs/{logId}` document must belong to the authenticated admin (`adminUid == request.auth.uid`), contain only the exact 13 schema keys, use valid enums and bounded numeric/string types, and bind `createdAt == request.time`.
4. `generation_logs` documents are append-only/deletable by the verified admin (`allow update: if false`).
5. `allow list` on `generation_logs` never executes `get()` or `exists()`, checking `isBootstrappedAdmin()` and `resource.data.adminUid == request.auth.uid`.

## 2. Adversarial Test Vectors ("Dirty Dozen")
1. Unauthenticated read on `/generation_logs/{id}` -> `PERMISSION_DENIED`.
2. Non-admin authenticated user creates `/admins/{uid}` to escalate privileges -> `PERMISSION_DENIED`.
3. Spoofed admin email with `email_verified: false` reads `/generation_logs/{id}` -> `PERMISSION_DENIED`.
4. Admin creates `/generation_logs/{id}` with an extra ghost field (`isFree: true`) -> `PERMISSION_DENIED`.
5. Admin creates `/generation_logs/{id}` with `adminUid` set to another UID -> `PERMISSION_DENIED`.
6. Admin creates `/generation_logs/{id}` with client-forged `createdAt` instead of `request.time` -> `PERMISSION_DENIED`.
7. Admin creates `/generation_logs/{id}` with negative `estimatedCostUsd` -> `PERMISSION_DENIED`.
8. Admin creates `/generation_logs/{id}` with invalid `provider` (`"other"`) -> `PERMISSION_DENIED`.
9. Admin creates `/generation_logs/{id}` with oversized `model` string (> 80 chars) -> `PERMISSION_DENIED`.
10. Admin attempts to update an immutable `/generation_logs/{id}` record -> `PERMISSION_DENIED`.
11. Unauthenticated or non-admin client attempts `list` on `/generation_logs` -> `PERMISSION_DENIED`.
12. Malformed document ID (> 128 chars or invalid characters) on `/generation_logs/{id}` -> `PERMISSION_DENIED`.
