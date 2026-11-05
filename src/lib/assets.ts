/**
 * Licensed audio can't live in the public repo, so it's hosted separately. Set NEXT_PUBLIC_ASSET_URL to that
 * address. Without it, the file loads from the local public folder, which is how development works.
 */
export const hostedAsset = (path: string) => `${process.env.NEXT_PUBLIC_ASSET_URL ?? ""}${path}`;
