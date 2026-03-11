export interface UpdateUserRequest {
  name?: string;
  email?: string;
  password?: string | null;
  oldPassword?: string;
  anonymous_name?: string;
  profile?: string;
}