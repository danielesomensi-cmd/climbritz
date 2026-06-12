"""A030: user_generated_climbs — saved AI-remixed problems (My Problems).

BoardLib-compatible storage: frames keeps the exact p{placement_id}r{role_id}
encoding; difficulty mirrors BoardLib's numeric scale next to the user-facing
grade label; is_listed (publishing, phase 3) and is_nomatch (A029 parity)
mirror the BoardLib climbs columns so publishing is a flag flip, not a data
migration.

Per-user content in the app DB; downgrade drops the table cleanly.

Revision ID: 006
Revises: 005
Create Date: 2026-06-12
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_generated_climbs",
        sa.Column("uuid", sa.String(36), nullable=False),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("frames", sa.Text(), nullable=False),
        sa.Column(
            "frames_count", sa.Integer(), nullable=False, server_default="1"
        ),
        sa.Column("angle", sa.Integer(), nullable=False),
        sa.Column("grade", sa.String(20), nullable=True),
        sa.Column("difficulty", sa.Integer(), nullable=True),
        sa.Column("seed_climb_uuid", sa.String(36), nullable=True),
        sa.Column(
            "is_listed", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column(
            "is_nomatch", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
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
        sa.PrimaryKeyConstraint("uuid"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index(
        op.f("ix_user_generated_climbs_user"),
        "user_generated_climbs",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_user_generated_climbs_user"),
        table_name="user_generated_climbs",
    )
    op.drop_table("user_generated_climbs")
