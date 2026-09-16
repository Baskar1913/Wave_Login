export type Role = { id:number; name:string; description:string|null };
export type User = { id:number; name:string; email:string; username:string; mobile:string; address:string|null; is_active:boolean; created_at:string; roles:string[] };
export type AuthResponse = { access_token:string; token_type:string; user:User };
export type LoginAs = 'SUPER_ADMIN'|'ADMIN'|'USER';
