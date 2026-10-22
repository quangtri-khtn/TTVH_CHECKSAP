import { z } from 'zod';
import { CreateUserDtoRole } from '@/lib/api/generated/model';

const ROLE_VALUES = [CreateUserDtoRole.ADMIN, CreateUserDtoRole.EMPLOYEE] as const;

// One shared schema for both modes: password is validated as optional here
// and the create-mode "required" rule is enforced by the form/page (empty
// password on edit means "keep current password", matching UpdateUserDto's
// documented behavior) rather than by two divergent zod schemas.
export const userSchema = z.object({
  email: z.string().min(1, 'Bắt buộc').email('Email không hợp lệ'),
  password: z.string(),
  name: z.string().min(1, 'Bắt buộc'),
  role: z.enum(ROLE_VALUES),
  customPermissions: z.array(z.string()),
});

export type UserFormValues = z.infer<typeof userSchema>;
