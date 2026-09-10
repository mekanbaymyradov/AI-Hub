"""add attachments

Revision ID: f4a17c9be620
Revises: c2b82511f5ed
Create Date: 2026-09-10 00:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'f4a17c9be620'
down_revision: str | Sequence[str] | None = 'c2b82511f5ed'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('attachment',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('message_id', sa.Integer(), nullable=True),
    sa.Column('key', sa.String(length=255), nullable=False),
    sa.Column('filename', sa.String(length=255), nullable=False),
    sa.Column('media_type', sa.String(length=100), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['message_id'], ['message.id'], name=op.f('attachment_message_id_fkey'), ondelete='cascade'),
    sa.ForeignKeyConstraint(['user_id'], ['user.id'], name=op.f('attachment_user_id_fkey'), ondelete='cascade'),
    sa.PrimaryKeyConstraint('id', name=op.f('attachment_pkey'))
    )
    op.create_index(op.f('attachment_message_id_idx'), 'attachment', ['message_id'], unique=False)
    op.create_index(op.f('attachment_user_id_idx'), 'attachment', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('attachment_user_id_idx'), table_name='attachment')
    op.drop_index(op.f('attachment_message_id_idx'), table_name='attachment')
    op.drop_table('attachment')
