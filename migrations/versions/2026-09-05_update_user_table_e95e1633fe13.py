"""update user table

Revision ID: e95e1633fe13
Revises: a3b33552e7ed
Create Date: 2026-09-05 11:27:21.254904

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e95e1633fe13"
down_revision: str | Sequence[str] | None = "a3b33552e7ed"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("user", sa.Column("avatar_url", sa.String(length=255), nullable=True))
    op.alter_column("user", "name", existing_type=sa.VARCHAR(length=50), nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    # name is nullable going forward, so fill the gaps before restoring NOT NULL.
    # left(..., 50) because name is VARCHAR(50) but local-parts can be longer.
    op.execute(
        """UPDATE "user" SET name = left(split_part(email, '@', 1), 50) WHERE name IS NULL"""
    )
    op.alter_column("user", "name", existing_type=sa.VARCHAR(length=50), nullable=False)
    op.drop_column("user", "avatar_url")
