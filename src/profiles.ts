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

function additionalProfiles(env: Env): ImageProfileDefinition[] {
  if (!env.IMAGE_PROFILES) return [];

  let inputs: unknown;
  try {
    inputs = JSON.parse(env.IMAGE_PROFILES);
  } catch {
    return [];
  }
  if (!Array.isArray(inputs)) return [];

  const profiles: ImageProfileDefinition[] = [];
  const ids = new Set([DEFAULT_PROFILE_ID]);
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
      isDefault: false,
    });
  }
  return profiles;
}

export function imageProfileDefinitions(env: Env): ImageProfileDefinition[] {
  return [
    {
      id: DEFAULT_PROFILE_ID,
      label: "Default",
      binding: "IMAGES",
      publicBaseUrl: env.PUBLIC_BASE_URL ?? "",
      isDefault: true,
    },
    ...additionalProfiles(env),
  ];
}

export function resolveImageProfile(
  env: Env,
  requestedId = DEFAULT_PROFILE_ID,
): ResolvedImageProfile | null {
  const definition = imageProfileDefinitions(env).find((profile) => profile.id === requestedId);
  if (!definition) return null;

  const bucket = env[definition.binding];
  if (!bucket || typeof bucket === "string") return null;
  return { ...definition, bucket };
}

export function requestProfileId(request: Request): string {
  return new URL(request.url).searchParams.get("profile") || DEFAULT_PROFILE_ID;
}

export function publicImageProfiles(env: Env): Array<Pick<ImageProfileDefinition, "id" | "label" | "isDefault">> {
  return imageProfileDefinitions(env)
    .filter((profile) => resolveImageProfile(env, profile.id))
    .map(({ id, label, isDefault }) => ({ id, label, isDefault }));
}
