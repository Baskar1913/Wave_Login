import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Logo } from '../components/Logo';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { Toast } from '../components/Toast';
import { api, isSessionError, setToken } from '../lib/api';
import type { Role, User } from '../types';

type View = 'overview' | 'admins' | 'users' | 'add-user' | 'assign-role' | 'roles';
type ModalType = 'user' | 'admin' | 'role' | null;
type Notice = { message: string; type: 'success' | 'error' } | null;

type FormState = {
  name: string; email: string; username: string; mobile: string; address: string; password: string; confirm: string;
};

const emptyForm: FormState = { name: '', email: '', username: '', mobile: '', address: '', password: '', confirm: '' };

export function AppShell({ initialUser, onLogout }: { initialUser: User; onLogout: () => void }) {
  const [user, setUser] = useState(initialUser);
  const [view, setView] = useState<View>('overview');
  const [users, setUsers] = useState<User[]>([]);
  const [admins, setAdmins] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<ModalType>(null);
  const [editing, setEditing] = useState<User | Role | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const isSuper = user.roles.includes('SUPER_ADMIN');
  const isAdmin = user.roles.includes('ADMIN');
  const canManage = isSuper || isAdmin;

  const notify = (message: string, type: 'success' | 'error' = 'success') => {
    setNotice({ message, type });
    window.setTimeout(() => setNotice(null), 3600);
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem('wave_user');
    onLogout();
  };

  const refresh = async () => {
    try {
      const me = await api.me();
      setUser(me);
      localStorage.setItem('wave_user', JSON.stringify(me));
      const superAdmin = me.roles.includes('SUPER_ADMIN');
      const manager = superAdmin || me.roles.includes('ADMIN');
      const [u, a, r] = await Promise.all([
        manager ? api.users() : Promise.resolve([]),
        superAdmin ? api.admins() : Promise.resolve([]),
        manager ? api.roles() : Promise.resolve([]),
      ]);
      setUsers(u as User[]);
      setAdmins(a as User[]);
      setRoles(r as Role[]);
    } catch (error: any) {
      if (isSessionError(error)) logout();
      else notify(error?.message || 'Unable to load workspace data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handler = () => logout();
    window.addEventListener('wave:session-expired', handler);
    void refresh();
    return () => window.removeEventListener('wave:session-expired', handler);
  }, []);

  const go = (next: View) => {
    setView(next);
    setSearch('');
    setMobileOpen(false);
  };

  const saveAccount = async (form: object) => {
    try {
      const editingNow = Boolean(editing);
      if (modal === 'admin') {
        if (editingNow) await api.updateAdmin((editing as User).id, form);
        else await api.createAdmin(form);
      } else {
        if (editingNow) await api.updateUser((editing as User).id, form);
        else await api.createUser(form);
      }
      setModal(null);
      setEditing(null);
      await refresh();
      notify(editingNow ? 'Changes saved successfully.' : modal === 'admin' ? 'Administrator created successfully.' : 'User created successfully.');
    } catch (error: any) {
      if (!isSessionError(error)) notify(error?.message || 'Unable to save account.', 'error');
    }
  };

  const saveRole = async (form: object) => {
    try {
      const editingNow = Boolean(editing);
      if (editingNow) await api.updateRole((editing as Role).id, form);
      else await api.createRole(form);
      setModal(null);
      setEditing(null);
      await refresh();
      notify(editingNow ? 'Role updated successfully.' : 'Role created successfully.');
    } catch (error: any) {
      if (!isSessionError(error)) notify(error?.message || 'Unable to save role.', 'error');
    }
  };

  const deleteAccount = async (item: User, admin = false) => {
    if (!window.confirm(`Delete ${item.name}?`)) return;
    try {
      if (admin) await api.deleteAdmin(item.id);
      else await api.deleteUser(item.id);
      await refresh();
      notify(`${admin ? 'Administrator' : 'User'} deleted successfully.`);
    } catch (error: any) {
      if (!isSessionError(error)) notify(error?.message || 'Delete failed.', 'error');
    }
  };

  const deleteRole = async (role: Role) => {
    if (!window.confirm(`Delete ${pretty(role.name)}?`)) return;
    try {
      await api.deleteRole(role.id);
      await refresh();
      notify('Role deleted successfully.');
    } catch (error: any) {
      if (!isSessionError(error)) notify(error?.message || 'Delete failed.', 'error');
    }
  };

  const filteredUsers = useMemo(() => filterUsers(users, search), [users, search]);
  const filteredAdmins = useMemo(() => filterUsers(admins, search), [admins, search]);

  return (
    <div className={`app-shell ${collapsed ? 'collapsed' : ''}`}>
      {mobileOpen && <button className="scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-top">
          <Logo />
          <button className="sidebar-toggle" onClick={() => setCollapsed((v) => !v)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <Icon name="menu" size={20} />
          </button>
        </div>

        {!collapsed && <div className="workspace-card"><span className="workspace-logo">W</span><div><strong>Wave Workspace</strong><small>{isSuper ? 'Super Admin' : isAdmin ? 'Admin' : 'User'}</small></div></div>}

        <nav className="side-nav" aria-label="Main navigation">
          <Nav icon="grid" text="Overview" active={view === 'overview'} collapsed={collapsed} onClick={() => go('overview')} />
          {isSuper && <Nav icon="shield" text="Administrators" active={view === 'admins'} collapsed={collapsed} onClick={() => go('admins')} />}
          {canManage && <>
            <div className="nav-section-label">USER MANAGEMENT</div>
            <Nav icon="users" text="Users List" active={view === 'users'} collapsed={collapsed} onClick={() => go('users')} />
            <Nav icon="plus" text="Add User" active={view === 'add-user'} collapsed={collapsed} onClick={() => go('add-user')} />
            <Nav icon="check" text="Assign Role" active={view === 'assign-role'} collapsed={collapsed} onClick={() => go('assign-role')} />
            <Nav icon="role" text="Role Management" active={view === 'roles'} collapsed={collapsed} onClick={() => go('roles')} />
          </>}
        </nav>

        <div className="sidebar-bottom">
          <div className={`identity ${collapsed ? 'identity-collapsed' : ''}`}>
            <span className="avatar large">{initials(user.name)}</span>
            {!collapsed && <div className="identity-copy"><strong>{user.name}</strong><small>{displayRole(user)}</small></div>}
            <button className="logout-button" onClick={logout} title="Logout"><Icon name="logout" size={18} />{!collapsed && <span>Logout</span>}</button>
          </div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Icon name="menu" size={22} /></button>
          <div className="breadcrumb"><span>Wave</span><Icon name="chevron" size={15} /><strong>{viewLabel(view)}</strong></div>
          <div className="topbar-right"><span className="api-status"><i />Connected</span><span className="top-user-name">{user.name}</span></div>
        </header>

        <main className="workspace-viewport" key={view}>
          {view === 'overview' && <Overview user={user} users={users} admins={admins} roles={roles} isSuper={isSuper} isAdmin={isAdmin} loading={loading} go={go} />}
          {view === 'admins' && isSuper && <Accounts title="Administrators" description="Manage administrator accounts. Only the Super Admin can access this area." items={filteredAdmins} total={admins.length} search={search} setSearch={setSearch} addLabel="Add Administrator" onAdd={() => { setEditing(null); setModal('admin'); }} onEdit={(item) => { setEditing(item); setModal('admin'); }} onDelete={(item) => void deleteAccount(item, true)} />}
          {view === 'users' && canManage && <UsersList users={filteredUsers} total={users.length} search={search} setSearch={setSearch} onAdd={() => go('add-user')} onAssign={() => go('assign-role')} onEdit={(item) => { setEditing(item); setModal('user'); }} onDelete={(item) => void deleteAccount(item)} />}
          {view === 'add-user' && canManage && <AddUserView onCreated={async () => { await refresh(); go('users'); notify('User created successfully.'); }} notify={notify} />}
          {view === 'assign-role' && canManage && <AssignRoleView users={users} roles={roles} onAssigned={async () => { await refresh(); notify('Role assigned successfully.'); }} notify={notify} />}
          {view === 'roles' && canManage && <RolesPage roles={roles} users={users} onAdd={() => { setEditing(null); setModal('role'); }} onEdit={(role) => { setEditing(role); setModal('role'); }} onDelete={(role) => void deleteRole(role)} />}
        </main>
      </section>

      {modal && <CrudModal type={modal} item={editing} onClose={() => { setModal(null); setEditing(null); }} onSave={modal === 'role' ? saveRole : saveAccount} />}
      {notice && <Toast {...notice} onClose={() => setNotice(null)} />}
    </div>
  );
}

function Overview({ user, users, admins, roles, isSuper, isAdmin, loading, go }: { user: User; users: User[]; admins: User[]; roles: Role[]; isSuper: boolean; isAdmin: boolean; loading: boolean; go: (v: View) => void }) {
  const businessRoles = roles.filter((r) => !['SUPER_ADMIN', 'ADMIN'].includes(r.name));
  const assignments = users.reduce((total, item) => total + item.roles.filter((r) => !['SUPER_ADMIN', 'ADMIN'].includes(r)).length, 0);
  return <div className="viewport-transition">
    <div className="page-heading">
      <div><span className="eyebrow">{isSuper ? 'SUPER ADMIN' : isAdmin ? 'ADMIN' : 'ACCOUNT'}</span><h1>{isSuper ? 'Workspace overview' : isAdmin ? 'User management workspace' : `Welcome, ${user.name}`}</h1><p>{isSuper ? 'Manage administrators, users and business roles from one workspace.' : isAdmin ? 'Manage users, create roles and assign business access.' : 'View your Wave account and currently assigned access.'}</p></div>
      {isSuper || isAdmin ? <button className="primary-btn" onClick={() => go('add-user')}><Icon name="plus" size={18} />Add User</button> : null}
    </div>
    {loading ? <div className="loading-card">Loading workspace data…</div> : isSuper || isAdmin ? <>
      <div className="stat-grid">
        <Stat label="Users" value={users.length} icon="users" onClick={() => go('users')} />
        {isSuper && <Stat label="Administrators" value={admins.length} icon="shield" onClick={() => go('admins')} />}
        <Stat label="Business Roles" value={businessRoles.length} icon="role" onClick={() => go('roles')} />
        <Stat label="Assignments" value={assignments} icon="check" onClick={() => go('assign-role')} />
      </div>
      <div className="overview-grid">
        <section className="surface-card quick-card"><div className="section-heading"><div><h2>Quick actions</h2><p>Jump directly to the operation you need.</p></div></div>
          <div className="quick-grid"><QuickAction icon="users" title="Users List" text="View and manage all user accounts." onClick={() => go('users')} /><QuickAction icon="plus" title="Add User" text="Create a new user without a role." onClick={() => go('add-user')} /><QuickAction icon="check" title="Assign Role" text="Give an existing user a business role." onClick={() => go('assign-role')} /><QuickAction icon="role" title="Role Management" text="Create, edit and remove business roles." onClick={() => go('roles')} /></div>
        </section>
        <section className="surface-card access-card"><div className="section-heading"><div><h2>Workspace access</h2><p>Management responsibilities</p></div></div>
          <div className="access-items"><AccessItem role="Super Admin" text="Administrators, users and roles" /><AccessItem role="Admin" text="Users and roles" /><AccessItem role="User" text="Own account" /></div>
        </section>
      </div>
    </> : <section className="surface-card account-card"><div className="account-avatar">{initials(user.name)}</div><div><span className="eyebrow">YOUR ACCOUNT</span><h2>{user.name}</h2><p>{user.email} · @{user.username}</p><div className="role-tags">{user.roles.length ? user.roles.map((role) => <span key={role}>{pretty(role)}</span>) : <span className="unassigned">No role assigned yet</span>}</div></div></section>}
  </div>;
}

function UsersList({ users, total, search, setSearch, onAdd, onAssign, onEdit, onDelete }: { users: User[]; total: number; search: string; setSearch: (v: string) => void; onAdd: () => void; onAssign: () => void; onEdit: (u: User) => void; onDelete: (u: User) => void }) {
  return <div className="viewport-transition full-width-view"><div className="page-heading"><div><span className="eyebrow">USER MANAGEMENT</span><h1>Users List</h1><p>{total} user account{total === 1 ? '' : 's'} available for management.</p></div><div className="heading-actions"><button className="secondary-btn" onClick={onAssign}><Icon name="check" size={18} />Assign Role</button><button className="primary-btn" onClick={onAdd}><Icon name="plus" size={18} />Add User</button></div></div>
    <section className="surface-card table-card"><div className="table-toolbar"><div className="search-box"><Icon name="search" size={19} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, username, mobile or role" /></div><span className="result-count">{users.length} shown</span></div>
      <div className="table-scroll"><table><thead><tr><th>ID</th><th>User</th><th>Email</th><th>Mobile</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>{users.map((item) => <tr key={item.id}><td><span className="id-badge">#{item.id}</span></td><td><div className="person"><span className="avatar">{initials(item.name)}</span><div><strong>{item.name}</strong><small>@{item.username}</small></div></div></td><td>{item.email}</td><td>{item.mobile}</td><td><div className="role-tags table-roles">{item.roles.length ? item.roles.filter((r) => !['SUPER_ADMIN', 'ADMIN'].includes(r)).map((r) => <span key={r}>{pretty(r)}</span>) : <span className="unassigned">Unassigned</span>}</div></td><td><span className="status active">Active</span></td><td><div className="row-actions"><button onClick={() => onEdit(item)} title="Edit user"><Icon name="edit" size={17} /></button><button onClick={() => onDelete(item)} title="Delete user"><Icon name="trash" size={17} /></button></div></td></tr>)}{!users.length && <tr><td colSpan={7}><EmptyState icon="users" title={total ? 'No matching users' : 'No users yet'} text={total ? 'Try a different search.' : 'Create the first user account.'} /></td></tr>}</tbody></table></div>
    </section></div>;
}

function AddUserView({ onCreated, notify }: { onCreated: () => Promise<void>; notify: (message: string, type?: 'success' | 'error') => void }) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const set = (key: keyof FormState) => (value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: string[] = [];
    if (form.password.length < 8) nextErrors.push('Password must contain at least 8 characters.');
    if (form.password !== form.confirm) nextErrors.push('Passwords do not match.');
    if (!/^\d{10}$/.test(form.mobile)) nextErrors.push('Mobile number must contain exactly 10 digits.');
    setErrors(nextErrors);
    if (nextErrors.length) return;
    setBusy(true);
    try {
      const payload = { name: form.name.trim(), email: form.email.trim(), username: form.username.trim(), mobile: form.mobile.trim(), address: form.address.trim(), password: form.password };
      await api.createUser(payload);
      setForm(emptyForm);
      setErrors([]);
      await onCreated();
    } catch (error: any) {
      if (!isSessionError(error)) notify(error?.message || 'Unable to create user.', 'error');
    } finally { setBusy(false); }
  };
  return <div className="viewport-transition dedicated-view"><div className="dedicated-intro"><span className="eyebrow">USER MANAGEMENT / ADD USER</span><h1>Create a user</h1><p>Register an account first. Business roles are assigned separately after creation.</p></div>
    <form className="surface-card dedicated-form" onSubmit={submit} noValidate><div className="form-grid"><Field label="Name" value={form.name} setValue={set('name')} placeholder="Enter full name" required /><Field label="Mobile" value={form.mobile} setValue={set('mobile')} placeholder="10-digit mobile number" required inputMode="numeric" /><Field label="Email" value={form.email} setValue={set('email')} placeholder="name@example.com" type="email" required /><Field label="Username" value={form.username} setValue={set('username')} placeholder="Choose a username" required /><Field label="Password" value={form.password} setValue={set('password')} placeholder="Minimum 8 characters" type="password" required /><Field label="Confirm password" value={form.confirm} setValue={set('confirm')} placeholder="Repeat password" type="password" required /></div><Field label="Address" value={form.address} setValue={set('address')} placeholder="Optional address" /><div className="form-note"><Icon name="info" size={18} /><span>The new account will appear immediately in <strong>Users List</strong> and can be assigned a business role from <strong>Assign Role</strong>.</span></div>{errors.length > 0 && <div className="inline-errors">{errors.map((error) => <div key={error}><Icon name="x" size={16} />{error}</div>)}</div>}<button className="primary-btn form-submit" disabled={busy}>{busy ? 'Creating user…' : 'Register User'}<Icon name="arrow" size={18} /></button></form></div>;
}

function AssignRoleView({ users, roles, onAssigned, notify }: { users: User[]; roles: Role[]; onAssigned: () => Promise<void>; notify: (message: string, type?: 'success' | 'error') => void }) {
  const businessRoles = roles.filter((role) => !['SUPER_ADMIN', 'ADMIN'].includes(role.name));
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const user = users.find((item) => String(item.id) === selectedUser);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: string[] = [];
    if (!selectedUser) next.push('Select a user.');
    if (!selectedRole) next.push('Select a role.');
    if (user && user.roles.includes(selectedRole)) next.push('This role is already assigned to the selected user.');
    setErrors(next);
    if (next.length) return;
    setBusy(true);
    try {
      await api.assignRole(Number(selectedUser), selectedRole);
      setSelectedUser(''); setSelectedRole(''); setErrors([]);
      await onAssigned();
    } catch (error: any) {
      if (!isSessionError(error)) notify(error?.message || 'Unable to assign role.', 'error');
    } finally { setBusy(false); }
  };
  return <div className="viewport-transition dedicated-view"><div className="dedicated-intro"><span className="eyebrow">ROLE ASSIGNMENT</span><h1>Assign a role</h1><p>Select an existing user and business role. Both lists are live and update after new records are created.</p></div>
    <form className="surface-card assignment-form" onSubmit={submit}>
      <Combo label="User" value={selectedUser} onChange={setSelectedUser} placeholder="Search or select a user" options={users.map((item) => ({ value: String(item.id), label: item.name, meta: `@${item.username} · ${item.email}` }))} />
      <Combo label="Role" value={selectedRole} onChange={setSelectedRole} placeholder="Search or select a role" options={businessRoles.map((role) => ({ value: role.name, label: pretty(role.name), meta: `#${role.id}${role.description ? ` · ${role.description}` : ''}` }))} />
      {user && <div className="selected-summary"><div className="person"><span className="avatar">{initials(user.name)}</span><div><strong>{user.name}</strong><small>{user.roles.length ? user.roles.filter((r) => !['SUPER_ADMIN', 'ADMIN'].includes(r)).map(pretty).join(', ') : 'No roles assigned'}</small></div></div></div>}
      {errors.length > 0 && <div className="inline-errors">{errors.map((error) => <div key={error}><Icon name="x" size={16} />{error}</div>)}</div>}
      <button className="primary-btn form-submit" disabled={busy || !users.length || !businessRoles.length}>{busy ? 'Assigning role…' : 'Assign Role'}<Icon name="check" size={18} /></button>
      {!users.length && <p className="empty-hint">No users are available yet. Create a user first.</p>}
      {!!users.length && !businessRoles.length && <p className="empty-hint">No business roles are available yet. Create a role first.</p>}
    </form></div>;
}

function Combo({ label, value, onChange, placeholder, options }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; options: { value: string; label: string; meta: string }[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((option) => option.value === value);
  const filtered = options.filter((option) => `${option.label} ${option.meta}`.toLowerCase().includes(query.toLowerCase().trim()));
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!(event.target as HTMLElement).closest('.combo')) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return <div className="combo-field"><span className="field-label-text">{label}</span><div className={`combo ${open ? 'open' : ''}`}>
    <button type="button" className="combo-trigger" onClick={() => setOpen((current) => !current)}><Icon name="search" size={18} /><span className={selected ? 'chosen' : ''}>{selected ? selected.label : placeholder}{selected && <small>{selected.meta}</small>}</span><Icon name="chevron" size={18} /></button>
    {open && <div className="combo-menu"><div className="combo-search"><Icon name="search" size={17} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${label.toLowerCase()}…`} /></div>{filtered.length ? filtered.map((option) => <button type="button" key={option.value} className={option.value === value ? 'picked' : ''} onClick={() => { onChange(option.value); setQuery(''); setOpen(false); }}><span>{option.label}</span><small>{option.meta}</small></button>) : <div className="combo-empty">No matches found</div>}</div>}
  </div></div>;
}

function Accounts({ title, description, items, total, search, setSearch, addLabel, onAdd, onEdit, onDelete }: { title: string; description: string; items: User[]; total: number; search: string; setSearch: (v: string) => void; addLabel: string; onAdd: () => void; onEdit: (u: User) => void; onDelete: (u: User) => void }) {
  return <div className="viewport-transition full-width-view"><div className="page-heading"><div><span className="eyebrow">ADMINISTRATOR MANAGEMENT</span><h1>{title}</h1><p>{description}</p></div><button className="primary-btn" onClick={onAdd}><Icon name="plus" size={18} />{addLabel}</button></div><section className="surface-card table-card"><div className="table-toolbar"><div className="search-box"><Icon name="search" size={19} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search administrators" /></div><span className="result-count">{items.length} shown</span></div><div className="table-scroll"><table><thead><tr><th>ID</th><th>Administrator</th><th>Email</th><th>Mobile</th><th>Status</th><th>Actions</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><span className="id-badge">#{item.id}</span></td><td><div className="person"><span className="avatar">{initials(item.name)}</span><div><strong>{item.name}</strong><small>@{item.username}</small></div></div></td><td>{item.email}</td><td>{item.mobile}</td><td><span className="status active">Active</span></td><td><div className="row-actions"><button onClick={() => onEdit(item)} title="Edit"><Icon name="edit" size={17} /></button><button onClick={() => onDelete(item)} title="Delete"><Icon name="trash" size={17} /></button></div></td></tr>)}{!items.length && <tr><td colSpan={6}><EmptyState icon="shield" title={total ? 'No matching administrators' : 'No administrators yet'} text={total ? 'Try another search.' : 'Create an administrator account.'} /></td></tr>}</tbody></table></div></section></div>;
}

function RolesPage({ roles, users, onAdd, onEdit, onDelete }: { roles: Role[]; users: User[]; onAdd: () => void; onEdit: (r: Role) => void; onDelete: (r: Role) => void }) {
  const business = roles.filter((role) => !['SUPER_ADMIN', 'ADMIN'].includes(role.name));
  return <div className="viewport-transition full-width-view"><div className="page-heading"><div><span className="eyebrow">BUSINESS ACCESS</span><h1>Role Management</h1><p>Create and maintain business roles that can be assigned to users.</p></div><button className="primary-btn" onClick={onAdd}><Icon name="plus" size={18} />Create Role</button></div><div className="role-grid">{business.map((role) => { const count = users.filter((item) => item.roles.includes(role.name)).length; return <section className="surface-card role-card" key={role.id}><div className="role-top"><span className="role-icon"><Icon name="role" size={21} /></span><span className="id-badge">#{role.id}</span></div><h2>{pretty(role.name)}</h2><p>{role.description || 'No description provided.'}</p><div className="role-footer"><span>{count} assignment{count === 1 ? '' : 's'}</span><div className="row-actions"><button onClick={() => onEdit(role)} title="Edit role"><Icon name="edit" size={17} /></button><button onClick={() => onDelete(role)} title="Delete role"><Icon name="trash" size={17} /></button></div></div></section>; })}{!business.length && <EmptyState icon="role" title="No business roles yet" text="Create a role to make it available for assignment." />}</div></div>;
}

function CrudModal({ type, item, onClose, onSave }: { type: Exclude<ModalType, null>; item: User | Role | null; onClose: () => void; onSave: (form: object) => void }) {
  const isRole = type === 'role';
  const existingUser = !isRole && item ? item as User : null;
  const existingRole = isRole && item ? item as Role : null;
  const [form, setForm] = useState(isRole ? { name: existingRole?.name || '', description: existingRole?.description || '' } : { name: existingUser?.name || '', email: existingUser?.email || '', username: existingUser?.username || '', mobile: existingUser?.mobile || '', address: existingUser?.address || '', password: '', confirm: '' });
  const [errors, setErrors] = useState<string[]>([]);
  const set = (key: string) => (value: string) => setForm((current: any) => ({ ...current, [key]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next: string[] = [];
    if (!isRole) {
      const f = form as FormState;
      if (!existingUser && f.password.length < 8) next.push('Password must contain at least 8 characters.');
      if ((f.password || f.confirm) && f.password !== f.confirm) next.push('Passwords do not match.');
      if (!/^\d{10}$/.test(f.mobile)) next.push('Mobile number must contain exactly 10 digits.');
    }
    setErrors(next);
    if (next.length) return;
    const payload: any = { ...form };
    delete payload.confirm;
    if (existingUser && !payload.password) delete payload.password;
    onSave(payload);
  };
  return <Modal title={item ? `Edit ${isRole ? 'Role' : type === 'admin' ? 'Administrator' : 'User'}` : `Create ${isRole ? 'Role' : type === 'admin' ? 'Administrator' : 'User'}`} subtitle={isRole ? 'Business roles are available for normal user assignment.' : type === 'admin' ? 'Administrator accounts can only be managed by the Super Admin.' : 'User accounts are created without an automatic business role.'} onClose={onClose}><form className="crud-form" onSubmit={submit} noValidate>{isRole ? <><Field label="Role name" value={(form as any).name} setValue={set('name')} placeholder="DELIVERY_MANAGER" required /><Field label="Description" value={(form as any).description} setValue={set('description')} placeholder="Describe what this role is used for" /></> : <><div className="form-grid"><Field label="Name" value={(form as any).name} setValue={set('name')} placeholder="Full name" required /><Field label="Mobile" value={(form as any).mobile} setValue={set('mobile')} placeholder="10-digit mobile" required inputMode="numeric" /><Field label="Email" value={(form as any).email} setValue={set('email')} placeholder="name@example.com" type="email" required /><Field label="Username" value={(form as any).username} setValue={set('username')} placeholder="Username" required /><Field label={existingUser ? 'New password (optional)' : 'Password'} value={(form as any).password} setValue={set('password')} placeholder="Minimum 8 characters" type="password" required={!existingUser} /><Field label="Confirm password" value={(form as any).confirm} setValue={set('confirm')} placeholder="Repeat password" type="password" required={!existingUser} /></div><Field label="Address" value={(form as any).address} setValue={set('address')} placeholder="Optional address" /></>}{errors.length > 0 && <div className="inline-errors">{errors.map((error) => <div key={error}><Icon name="x" size={16} />{error}</div>)}</div>}<button className="primary-btn form-submit">{item ? 'Save Changes' : `Create ${isRole ? 'Role' : type === 'admin' ? 'Administrator' : 'User'}`}<Icon name="arrow" size={18} /></button></form></Modal>;
}

function Field({ label, value, setValue, placeholder, type = 'text', required = false, inputMode }: { label: string; value: string; setValue: (v: string) => void; placeholder?: string; type?: string; required?: boolean; inputMode?: 'numeric' | 'text' | 'email' | 'tel' | 'url' | 'search' }) { return <label className="field-label">{label}<input type={type} value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} required={required} inputMode={inputMode} /></label>; }
function QuickAction({ icon, title, text, onClick }: { icon: string; title: string; text: string; onClick: () => void }) { return <button className="quick-action" onClick={onClick}><span><Icon name={icon} size={21} /></span><div><strong>{title}</strong><small>{text}</small></div><Icon name="arrow" size={17} /></button>; }
function AccessItem({ role, text }: { role: string; text: string }) { return <div className="access-item"><span className="access-mark"><Icon name="check" size={16} /></span><div><strong>{role}</strong><small>{text}</small></div></div>; }
function Stat({ label, value, icon, onClick }: { label: string; value: number; icon: string; onClick: () => void }) { return <button className="stat-card" onClick={onClick}><span className="stat-icon"><Icon name={icon} size={21} /></span><div><small>{label}</small><strong>{value}</strong></div><Icon name="arrow" size={17} /></button>; }
function Nav({ icon, text, active, collapsed, onClick }: { icon: string; text: string; active: boolean; collapsed: boolean; onClick: () => void }) { return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick} title={collapsed ? text : undefined}><Icon name={icon} size={19} />{!collapsed && <span>{text}</span>}{active && <i />}</button>; }
function EmptyState({ icon, title, text }: { icon: string; title: string; text: string }) { return <div className="empty-state"><span><Icon name={icon} size={34} /></span><strong>{title}</strong><small>{text}</small></div>; }
function filterUsers(items: User[], query: string) { const q = query.toLowerCase().trim(); return q ? items.filter((u) => `${u.name} ${u.email} ${u.username} ${u.mobile} ${u.roles.join(' ')}`.toLowerCase().includes(q)) : items; }
function initials(name: string) { return name.split(' ').filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'W'; }
function pretty(value: string) { return value.toLowerCase().split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' '); }
function displayRole(user: User) { return user.roles.includes('SUPER_ADMIN') ? 'Super Admin' : user.roles.includes('ADMIN') ? 'Admin' : user.roles.length ? pretty(user.roles[0]) : 'No role assigned'; }
function viewLabel(view: View) { const labels: Record<View, string> = { overview: 'Overview', admins: 'Administrators', users: 'Users List', 'add-user': 'Add User', 'assign-role': 'Assign Role', roles: 'Role Management' }; return labels[view]; }
