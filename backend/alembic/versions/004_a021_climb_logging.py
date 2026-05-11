"""A021: climb_logs + user_climbs tables for logging and training history.

Two new tables:
  - climb_logs: append-mostly source of truth, one row per
    (user, climb, angle, local_date). result_type is one of
    flash/send/attempt; attempts_count tracks repeat taps the same day.
  - user_climbs: derived materialized state for fast Discovery rendering
    (is_project flag + best_result ever recorded for that climb+angle).
    Kept in sync by log_service on every write.

Both tables FK to users.id (String(36)) with ON DELETE CASCADE — when a
user is removed, their logs go with them.

Cross-database note: these tables live in the app DB (kilter.db,
DATABASE_URL=sqlite:///./kilter.db), NOT in the BoardLib DB
(data/kilter.db). Search overlay is done in Python (Option A from the
A021 Phase 0 audit), not via SQL JOIN.

Revision ID: 004
Revises: 003
Create Date: 2026-05-11
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "climb_logs",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("climb_uuid", sa.String(36), nullable=False),
        sa.Column("angle", sa.Integer(), nullable=False),
        sa.Column("local_date", sa.Date(), nullable=False),
        sa.Column("result_type", sa.String(8), nullable=False),
        sa.Column(
            "attempts_count", sa.Integer(), nullable=False, server_default="1"
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
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.CheckConstraint(
            "result_type IN ('flash', 'send', 'attempt')",
            name="ck_climb_logs_result_type",
        ),
        sa.UniqueConstraint(
            "user_id",
            "climb_uuid",
            "angle",
            "local_date",
            name="uq_climb_logs_user_climb_angle_date",
        ),
    )
    op.create_index(
        op.f("ix_climb_logs_user_date"),
        "climb_logs",
        ["user_id", sa.text("local_date DESC")],
        unique=False,
    )
    op.create_index(
        op.f("ix_climb_logs_user_climb"),
        "climb_logs",
        ["user_id", "climb_uuid"],
        unique=False,
    )

    op.create_table(
        "user_climbs",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("climb_uuid", sa.String(36), nullable=False),
        sa.Column("angle", sa.Integer(), nullable=False),
        sa.Column(
            "is_project", sa.Boolean(), nullable=False, server_default="0"
        ),
        sa.Column("best_result", sa.String(8), nullable=True),
        sa.Column("last_logged_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.CheckConstraint(
            "best_result IS NULL OR best_result IN ('flash', 'send')",
            name="ck_user_climbs_best_result",
        ),
        sa.UniqueConstraint(
            "user_id",
            "climb_uuid",
            "angle",
            name="uq_user_climbs_user_climb_angle",
        ),
    )
    op.create_index(
        op.f("ix_user_climbs_user"),
        "user_climbs",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_user_climbs_user_project"),
        "user_climbs",
        ["user_id", "is_project"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_user_climbs_user_project"), table_name="user_climbs")
    op.drop_index(op.f("ix_user_climbs_user"), table_name="user_climbs")
    op.drop_table("user_climbs")

    op.drop_index(op.f("ix_climb_logs_user_climb"), table_name="climb_logs")
    op.drop_index(op.f("ix_climb_logs_user_date"), table_name="climb_logs")
    op.drop_table("climb_logs")
