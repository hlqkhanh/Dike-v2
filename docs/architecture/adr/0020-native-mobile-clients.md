# 0020 — Native Android and iOS clients

- Status: Superseded by ADR 0021
- Date: 2026-10-08
- Supersedes: ADR 0009

## Context

Stage 16 requires secure credential storage, push notifications, deep links,
background location and platform-specific lifecycle control. The product owner has
chosen fully native clients instead of Flutter.

## Decision

Build two mobile applications:

- `apps/mobile-android` with Kotlin and Jetpack Compose.
- `apps/mobile-ios` with Swift and SwiftUI.

Generate `packages/api-client-kotlin` and `packages/api-client-swift` from the same
reviewed OpenAPI document used by the TypeScript web client. Share API contracts,
domain terminology and platform-neutral design tokens, but do not share UI/runtime
code between Android and iOS. Both clients call the same Spring Boot backend and use
backend-owned opaque mobile sessions stored with Android Keystore-backed storage or
iOS Keychain.

## Alternatives

- Flutter: superseded by this decision.
- React Native/Expo: rejected because the selected direction is platform-native.
- WebView/PWA only: rejected because background location, push and secure storage
  require reliable native lifecycle integration.
- A separate backend per platform: rejected because authorization and business
  rules must remain centralized.

## Consequences

The team maintains Kotlin and Swift applications plus two generated API clients.
Platform behavior can be implemented and tested directly, at the cost of duplicated
presentation work and separate Android/iOS CI and release pipelines.

## Validation

Stage 16 must generate both clients reproducibly and pass search, booking, active
journey and review flows on real Android and iOS devices. Background location must
stop on every booking, consent, session and account exit path.

## Revisit triggers

Revisit only if measured delivery or maintenance cost prevents pilot requirements;
do not introduce a cross-platform runtime without a new ADR.

## Superseded

ADR 0021 replaces the two native applications with one React Native + Expo client.
