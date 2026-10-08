# 0009 — Flutter mobile

- Status: Superseded by ADR 0020
- Date: 2026-10-05

## Context

Mobile needs native secure storage, push notifications and background location after web/backend stabilizes. The selected client technology is Flutter/Dart, not the historical React Native/Expo proposal.

## Decision

Build `apps/mobile` with Flutter/Dart in Stage 16. Generate `packages/api-client-dart` from the same backend OpenAPI document used for `api-client-ts`. Share platform-neutral design tokens and contracts, but do not share React UI components with Flutter.

## Alternatives

- React Native/Expo: retained only as a historical proposal and not selected.
- WebView/PWA only: rejected because reliable native secure storage, push and background location need native integration.
- Separate mobile backend: rejected because web and mobile use the same domain and authorization policies.

## Consequences

The team maintains Dart and TypeScript clients with one API source of truth. Mobile-specific session, offline and device testing are required.

## Validation

Stage 16 generates the Dart client reproducibly and passes Android/iOS flows for search, booking, active trip and review on real devices.

## Revisit triggers

Review only if staffing, platform constraints or measured delivery risk makes Flutter unable to meet pilot requirements.

## Superseded

ADR 0020 replaces Flutter with native Kotlin/Jetpack Compose and Swift/SwiftUI clients.
