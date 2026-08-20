import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  // baseURL is automatically inferred in Next.js, but good practice to define it or let better-auth handle it
})
