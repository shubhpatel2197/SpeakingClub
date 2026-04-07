export const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? "";

export function getGoogleClientId() {
  return googleClientId;
}

