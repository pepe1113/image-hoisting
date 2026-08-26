import type { Env, ImageProfileDefinition, ResolvedImageProfile } from "./types";

const DEFAULT_PROFILE_ID = "default";
const PROFILE_ID = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/u;
const BINDING_NAME = /^[A-Za-z_$][A-Za-z0-9_$]*$/u;

interface ProfileInput {
  id?: unknown;
  label?: unknown;
  binding?: unknown;
  publicBaseUrl?: unknown;
}

function validPublicBaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function configuredProfiles(env: Env): ImageProfileDefinition[] {
  if (!env.IMAGE_PROFILES) return [];

  let inputs: unknown = env.IMAGE_PROFILES;
  if (typeof inputs === "string") {
    try {
      inputs = JSON.parse(inputs);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(inputs)) return [];

  const profiles: ImageProfileDefinition[] = [];
  const ids = new Set<string>();
  for (const value of inputs) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const input = value as ProfileInput;
    if (
      typeof input.id !== "string" ||
      !PROFILE_ID.test(input.id) ||
      ids.has(input.id) ||
      typeof input.label !== "string" ||
      !input.label.trim() ||
      input.label.length > 60 ||
      typeof input.binding !== "string" ||
      !BINDING_NAME.test(input.binding) ||
      typeof input.publicBaseUrl !== "string" ||
      !validPublicBaseUrl(input.publicBaseUrl)
    ) {
      continue;
    }

    ids.add(input.id);
    profiles.push({
      id: input.id,
      label: input.label.trim(),
      binding: input.binding,
      publicBaseUrl: input.publicBaseUrl,
      isDefault: input.id === DEFAULT_PROFILE_ID,
    });
  }
  return profiles;
}

export function imageProfileDefinitions(env: Env): ImageProfileDefinition[] {
  const profiles = configuredProfiles(env);
  const configuredDefault = profiles.find((profile) => profile.isDefault);
  if (configuredDefault) {
    return [
      {
        ...configuredDefault,
        publicBaseUrl: env.PUBLIC_BASE_URL ?? configuredDefault.publicBaseUrl,
      },
      ...profiles.filter((profile) => !profile.isDefault),
    ];
  }

  return [{
    id: DEFAULT_PROFILE_ID,
    label: env.DEFAULT_PROFILE_LABEL?.trim() || "Default",
    binding: "IMAGES",
    publicBaseUrl: env.PUBLIC_BASE_URL ?? "",
    isDefault: true,
  }, ...profiles];
}

export function resolveImageProfile(
  env: Env,
  requestedId = DEFAULT_PROFILE_ID,
): ResolvedImageProfile | null {
  const definition = imageProfileDefinitions(env).find((profile) => profile.id === requestedId);
  if (!definition) return null;

  const bucket = env[definition.binding];
  if (
    !bucket ||
    typeof bucket !== "object" ||
    Array.isArray(bucket) ||
    typeof (bucket as R2Bucket).get !== "function"
  ) return null;
  return { ...definition, bucket: bucket as R2Bucket };
}

export function requestProfileId(request: Request): string {
  return new URL(request.url).searchParams.get("profile") || DEFAULT_PROFILE_ID;
}

export function publicImageProfiles(env: Env): Array<Pick<ImageProfileDefinition, "id" | "label" | "isDefault">> {
  return imageProfileDefinitions(env)
    .filter((profile) => resolveImageProfile(env, profile.id))
    .map(({ id, label, isDefault }) => ({ id, label, isDefault }));
}
