"""Replace legacy custom-JWT users table with Clerk shadow row.

A019: Clerk owns email/password/MFA/OAuth from now on. The local users
table only needs (id, clerk_id, created_at, updated_at) so foreign keys
can still reference users.id. All legacy columns (email, username,
hashed_password, full_name, is_active) are dropped — they were always
ephemeral test data, no real users existed.

Migration strategy (SQLite, zero real users):
  1. DELETE FROM video_uploads — all rows are orphan dev data anyway.
  2. DROP legacy users table.
  3. CREATE new users with Clerk-shadow schema.
  4. The unnamed FK on video_uploads.user_id (introspected via
     PRAGMA foreign_key_list — no constraint name to drop) remains in
     place pointing at users.id, which is still present in the new table
     and still String(36), so FK validation will pass on future inserts.

Revision ID: 003
Revises: 002
Create Date: 2026-05-07
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    # SQLite-specific: temporarily disable FK enforcement so we can drop
    # the parent users table while the (unnamed) FK from video_uploads
    # still references it. Postgres would simply ignore this PRAGMA.
    if bind.dialect.name == "sqlite":
        op.execute("PRAGMA foreign_keys = OFF")

    # Zero real users in dev/prod (audited Phase 0). All current
    # video_uploads rows are orphan test data — wipe them so no row
    # references a non-existent user after the table swap.
    op.execute("DELETE FROM video_uploads")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_table("users")

    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("clerk_id", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_clerk_id", "users", ["clerk_id"], unique=True)

    if bind.dialect.name == "sqlite":
        op.execute("PRAGMA foreign_keys = ON")


def downgrade() -> None:
    raise NotImplementedError(
        "A019 migration is not reversible — bcrypt password hashes from the "
        "legacy users table are unrecoverable. To roll back, restore from a "
        "pre-A019 database backup."
    )
