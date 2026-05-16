import { z } from 'zod'

export const credentialsSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'This field is required'),
})

export type CredentialsInput = z.infer<typeof credentialsSchema>
