# Provider sync architecture

Every external provider follows the same lifecycle:

1. OAuth connection is created and tokens are encrypted.
2. `/sync/:provider` creates a durable `sync_runs` record.
3. The sync worker claims queued runs and refreshes tokens when needed.
4. A provider adapter imports normalized metadata into LIFEOS.
5. The run records imported count and an actionable error message.

Google Calendar, Drive and Gmail are enabled in V1.6. Google Photos and Contacts remain explicit adapter slots until their production API access and verification requirements are configured.

This boundary keeps provider-specific API changes out of the core timeline, inbox and finance domain models.
