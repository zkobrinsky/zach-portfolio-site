/**
 * Licensed audio and large image sets don't live in the public repo, so they're hosted separately. Set
 * NEXT_PUBLIC_ASSET_URL to that address. Without it, files load from the local public folder, which is how
 * development works.
 */
export const hostedAsset = (path: string) => `${process.env.NEXT_PUBLIC_ASSET_URL ?? ""}${path}`;
