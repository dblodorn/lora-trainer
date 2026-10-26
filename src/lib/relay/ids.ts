/**
 * Record ids at the boundary between this app and the dmbk GraphQL API.
 *
 * The app addresses trainings by their raw id (32 hex characters): it is what
 * `/loras/<id>` links carry and what Spaces keys are built from. The API
 * addresses trainings and images by Relay global ID, Pothos' default encoding:
 * base64 of `<Type>:<id>` (dmbk-graphql-api, `builder.node` in
 * src/schema/types/lora.ts). The decode checks the type prefix, so a change in
 * the API's encoding fails loudly instead of addressing the wrong record.
 */

function encode(type: string, id: string): string {
  return btoa(`${type}:${id}`);
}

function decode(type: string, globalId: string): string {
  let decoded: string;
  try {
    decoded = atob(globalId);
  } catch {
    throw new Error(`Not a global ID: ${globalId}`);
  }
  if (!decoded.startsWith(`${type}:`)) {
    throw new Error(`Not a ${type} global ID: ${globalId}`);
  }
  return decoded.slice(type.length + 1);
}

export const toTrainingGlobalId = (id: string) => encode("LoraTraining", id);
export const fromTrainingGlobalId = (globalId: string) => decode("LoraTraining", globalId);
export const toImageGlobalId = (id: string) => encode("GeneratedImage", id);
export const fromImageGlobalId = (globalId: string) => decode("GeneratedImage", globalId);
