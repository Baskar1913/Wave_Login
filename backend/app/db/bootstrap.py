from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def ensure_schema_compatibility(engine: Engine) -> None:
    """Create missing columns used by the current Wave build in an existing local DB.

    The project intentionally keeps startup setup simple for local development.  This
    compatibility step prevents an older Wave database from breaking the UI after an
    application update (for example, when role descriptions were introduced).
    """
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    # Base.metadata.create_all() is responsible for new tables.
    if "roles" in tables:
        columns = {c["name"] for c in inspector.get_columns("roles")}
        if "description" not in columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE roles ADD COLUMN description VARCHAR(255)"))

    if "user_roles" in tables:
        columns = {c["name"] for c in inspector.get_columns("user_roles")}
        if "assigned_by" not in columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE user_roles ADD COLUMN assigned_by INTEGER"))

    if "users" in tables:
        columns = {c["name"] for c in inspector.get_columns("users")}
        # Very early Wave builds used phone instead of mobile.  Copy it forward when
        # possible rather than losing existing accounts.
        if "mobile" not in columns and "phone" in columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN mobile VARCHAR(30)"))
                conn.execute(text("UPDATE users SET mobile = phone WHERE mobile IS NULL"))
