# 0021 — React Native with Expo mobile client

- Status: Accepted
- Date: 2026-10-09
- Supersedes: ADR 0020

## Context

Stage 16 requires one Android/iOS mobile product with secure credential storage,
push notifications, deep links, offline recovery and background location. The team
selected React Native to continue using TypeScript and share reviewed API contracts
with the web client while keeping native mobile UI and lifecycle behavior.

## Decision

Build `apps/mobile` with React Native, Expo and TypeScript. Use Expo Development
Builds for development and EAS Build for Android/iOS artifacts. Expo Go is not an
acceptance environment for push, native authentication or background location.

Reuse `packages/api-client-ts` as the generated OpenAPI contract. Put mobile-specific
transport, authentication and storage adapters in `apps/mobile`. Share
platform-neutral design tokens and domain terminology, but do not reuse React DOM
components from `apps/web`.

Use maintained Expo modules for secure storage, notifications, deep links and
location/task execution. Introduce Kotlin or Swift only when a required capability
cannot be provided safely by the selected Expo/native module ecosystem, and record
that exception in a new ADR.

## Alternatives

- Flutter: superseded by ADR 0009 and not selected.
- Fully native Kotlin/Compose plus Swift/SwiftUI: superseded by this decision because
  it duplicates the mobile UI and application implementation.
- Expo Go only: rejected because required native integrations need Development
  Builds and real-device validation.
- WebView/PWA only: rejected because push, secure storage and controlled background
  location require native lifecycle integration.
- A separate mobile backend: rejected because business rules and authorization must
  remain centralized.

## Consequences

The team maintains one TypeScript mobile application and one shared generated API
contract. CI needs Expo/EAS validation and real-device Android/iOS tests. Store
signing and production submission remain Stage 17 responsibilities.

## Validation

Stage 16 must pass search, booking, active journey and review flows on real Android
and iOS devices using Development Builds. Background location must stop on every
booking, consent, session and account exit path.

## Revisit triggers

Revisit if an essential pilot capability cannot satisfy security, privacy,
reliability or store requirements with Expo Development Builds and maintained native
modules.
