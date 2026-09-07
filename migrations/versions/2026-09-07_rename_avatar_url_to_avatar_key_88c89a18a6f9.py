"""rename avatar url to avatar key

Revision ID: 88c89a18a6f9
Revises: e95e1633fe13
Create Date: 2026-09-07 15:11:24.670288

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '88c89a18a6f9'
down_revision: str | Sequence[str] | None = 'e95e1633fe13'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column('user', 'avatar_url', new_column_name='avatar_key')


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('user', 'avatar_key', new_column_name='avatar_url')
