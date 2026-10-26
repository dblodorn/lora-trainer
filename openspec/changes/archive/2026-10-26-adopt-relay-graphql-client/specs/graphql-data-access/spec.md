# Spec Delta

## Purpose

Defines how lora-trainer reaches its persistent data. Every LoRA training and generated-image record is read and written through dmbk-graphql-api. The browser reaches that API only through a same-origin proxy that holds the secrets. FAL.ai work stays local to the app and persists its results through the API.

## ADDED Requirements

### Requirement: The API is the only path to persistent data
lora-trainer SHALL NOT connect to MongoDB or any other database. Every read and write of LoRA trainings and generated images SHALL go through dmbk-graphql-api. The API's ownership and visibility rules are the only ones applied.

#### Scenario: App runs without database credentials
- **WHEN** the app is deployed with no `MONGODB_URI` set
- **THEN** listing, viewing, training, completing, generating, hiding and the slideshow all work as before

#### Scenario: Visibility comes from the API
- **WHEN** a viewer who is not the owner requests a hidden training or image
- **THEN** the app shows it as unavailable, matching the API's response, and applies no visibility rule of its own

### Requirement: Browser GraphQL traffic goes through a same-origin proxy
The browser SHALL send API operations only to an app-hosted proxy route, never directly to the API. The proxy SHALL attach the viewer's session (from the HTTP-only session cookie) as a bearer token and the app's API key before forwarding. The session token and API key SHALL NOT be readable by page scripts or appear in any response sent to the browser.

#### Scenario: Signed-in request is forwarded with credentials
- **WHEN** a signed-in viewer's page sends an operation to the proxy
- **THEN** the API receives it with `Authorization: Bearer <session>` and `X-API-Key: <app key>`, and the page receives the API's result

#### Scenario: Signed-out request is forwarded without a session
- **WHEN** a page with no session cookie sends a public read through the proxy
- **THEN** the API receives it with the API key and no `Authorization` header, and owner-only fields come back null

#### Scenario: Secrets stay server-side
- **WHEN** a page's network traffic and scripts are inspected
- **THEN** neither the session token nor the API key appears in them

### Requirement: The proxy accepts only this app's persisted operations from its own origin
The proxy SHALL forward only operations whose identifier is in the app's build-time persisted-operations set. It SHALL reject arbitrary query text and unknown identifiers without contacting the API. It SHALL reject requests whose origin is not the app's own.

#### Scenario: Unknown operation id
- **WHEN** a request names an operation id that is not in the persisted set
- **THEN** the proxy responds with a client error and the API is not called

#### Scenario: Raw query text
- **WHEN** a request carries a GraphQL query string instead of a persisted id
- **THEN** the proxy rejects it and the API is not called

#### Scenario: Cross-origin request
- **WHEN** a request to the proxy comes from another origin
- **THEN** the proxy rejects it, even if it carries a valid session cookie

### Requirement: Training records are created and completed through the API
Submitting a training SHALL create a pending training record, owned by the viewer, through the API. Completing it SHALL store the weights URL and mark it completed through the API. Only the owner SHALL be able to complete a training. Completing an already-completed training SHALL succeed without changing it.

#### Scenario: Submit creates a pending record
- **WHEN** a signed-in viewer submits a training from an Are.na channel
- **THEN** the FAL job is queued and a pending training owned by that viewer exists in the API, with the trigger word, steps, source image URLs and channel

#### Scenario: Record creation fails
- **WHEN** the FAL job is queued but the API fails to create the pending record
- **THEN** the submission still returns the FAL request id and the failure is logged

#### Scenario: Non-owner tries to complete
- **WHEN** a viewer completes a training they don't own
- **THEN** the request is refused as not found, as if no training existed for that request id, and the record is unchanged

#### Scenario: Repeat completion
- **WHEN** the owner completes a training that is already completed
- **THEN** the request succeeds and the stored weights URL is unchanged

### Requirement: Generated images are recorded through the API
Generating images SHALL require a signed-in viewer and a completed LoRA that the viewer can see through the API. Each generated image SHALL be recorded through the API, owned by the viewer and linked to the LoRA.

#### Scenario: Generate with a completed LoRA
- **WHEN** a signed-in viewer generates with a completed, visible LoRA
- **THEN** each returned image is recorded in the API with its prompt, size, seed and LoRA scale, owned by the viewer

#### Scenario: LoRA not ready or not visible
- **WHEN** a viewer generates with a LoRA that is pending, failed, hidden from them or missing
- **THEN** the request fails with a clear error and FAL is not called

### Requirement: Storage mirroring stays best-effort
Copying training images, the training zip, LoRA weights and generated images to object storage SHALL NOT fail the request it belongs to. If a mirror fails, the record SHALL keep the original FAL URL and the failure SHALL be logged.

#### Scenario: Weights mirror fails
- **WHEN** completing a training and copying the weights to storage fails
- **THEN** the training is marked completed with the FAL weights URL

#### Scenario: Generated image mirror fails
- **WHEN** an image is generated and copying it to storage fails
- **THEN** the image is recorded with no CDN URL and is served from its FAL URL

### Requirement: Owners can hide and unhide their records
Owners SHALL be able to hide and unhide their trainings and generated images, and list their hidden ones, through the API. Hidden records SHALL be left out of public lists and the slideshow.

#### Scenario: Owner hides an image
- **WHEN** the owner hides one of their generated images
- **THEN** it disappears from the LoRA's public image list and the slideshow, and appears in the owner's hidden list

#### Scenario: Non-owner tries to hide
- **WHEN** a viewer hides a record they don't own
- **THEN** the request is refused and the record stays visible

### Requirement: API failures degrade per feature
If the API is unreachable or returns an error, only the features that depend on that operation SHALL fail. Each SHALL show an error state, and the rest of the app SHALL keep working.

#### Scenario: API down on the gallery
- **WHEN** the API is unreachable while the trainings list loads
- **THEN** the list shows an error state and the page shell and navigation still render
