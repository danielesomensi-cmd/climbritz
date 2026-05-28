"""A023: user_hold_classifications table for cloud-synced hold classification.

One row per (user, placement_id): the user's grip-type verdict for a hold.
Coordinates (x/y) are NOT stored — the frontend joins them from
placements_12x12.json at export time, same as the pre-A023 localStorage flow.

Per-user only. Lives in the app DB (DATABASE_URL), not the BoardLib DB.
This is opt-in user-generated content, so downgrade drops the table cleanly.

Revision ID: 005
Revises: 004
Create Date: 2026-05-28
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_hold_classifications",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("placement_id", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(20), nullable=False),
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
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.UniqueConstraint(
            "user_id",
            "placement_id",
            name="uq_user_hold_classifications_user_placement",
        ),
    )
    op.create_index(
        op.f("ix_user_hold_classifications_user"),
        "user_hold_classifications",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_user_hold_classifications_user"),
        table_name="user_hold_classifications",
    )
    op.drop_table("user_hold_classifications")
