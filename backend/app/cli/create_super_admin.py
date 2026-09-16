import getpass
from sqlalchemy import select
from app.db.session import Base,engine,SessionLocal
from app.models import Role,User,UserRole
from app.services.users import seed_roles
from app.core.security import hash_password
def main():
    Base.metadata.create_all(bind=engine); db=SessionLocal()
    try:
        seed_roles(db); role=db.scalar(select(Role).where(Role.name=="SUPER_ADMIN"))
        existing=db.scalar(select(User).join(UserRole,UserRole.user_id==User.id).where(UserRole.role_id==role.id))
        if existing: print("✗ Super Admin already exists."); return
        print("\nWave — Create the one and only Super Admin\n")
        name=input("Name: ").strip(); email=input("Email: ").strip().lower(); username=input("Username: ").strip(); mobile=input("Mobile (optional): ").strip()
        password=getpass.getpass("Password: "); confirm=getpass.getpass("Confirm Password: ")
        if password!=confirm: raise SystemExit("Passwords do not match.")
        if len(password)<8: raise SystemExit("Password must contain at least 8 characters.")
        if not name or not username or not email: raise SystemExit("Name, email and username are required.")
        if db.scalar(select(User).where((User.email==email)|(User.username==username)|(User.mobile==mobile))): raise SystemExit("Email, username or mobile already exists.")
        user=User(name=name,email=email,username=username,mobile=mobile,address=None,password_hash=hash_password(password)); db.add(user); db.flush(); db.add(UserRole(user_id=user.id,role_id=role.id)); db.commit(); print(f"✓ Super Admin '{username}' created successfully.")
    finally: db.close()
if __name__=="__main__": main()
