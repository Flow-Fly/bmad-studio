# Non-Functional Requirements

## Performance

- **NFR1:** OpenCode chat UI begins displaying the first streamed message within 1 second of session launch, as measured by UI performance testing
- **NFR2:** UI interactions (clicks, navigation, stream switching) respond within 100ms, as measured by UI event profiling
- **NFR3:** Per-stream phase graph renders within 1 second of stream selection, as measured by component mount timing
- **NFR4:** Multi-stream dashboard loads all stream statuses within 2 seconds regardless of stream count, as measured by page load timing

## Security

- **NFR5:** API keys are stored encrypted in OS keychain (macOS Keychain, Linux Secret Service)
- **NFR6:** API keys are never logged or exposed in UI
- **NFR7:** No telemetry or data leaves the local machine without explicit user action

## Integration

- **NFR8:** When an OpenCode process fails, system displays an error message identifying the failure reason and offers a retry option within 2 seconds
- **NFR9:** OpenCode session timeouts are configurable (default: 120 seconds for long-running workflow steps)
- **NFR10:** Provider switching through OpenCode configuration does not require application restart

## Reliability

- **NFR11:** Stream metadata persists immediately upon creation or state change (no batching)
- **NFR12:** Application crash does not corrupt stream state or artifact data in the central store
- **NFR13:** Corrupted stream data does not prevent application startup; system skips the corrupted stream, loads remaining streams, and displays a warning identifying the affected stream
