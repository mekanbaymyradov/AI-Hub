"""add chat messages

Revision ID: c2b82511f5ed
Revises: 88c89a18a6f9
Create Date: 2026-09-08 11:50:02.460036

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c2b82511f5ed'
down_revision: str | Sequence[str] | None = '88c89a18a6f9'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('chat',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['user.id'], name=op.f('chat_user_id_fkey'), ondelete='cascade'),
    sa.PrimaryKeyConstraint('id', name=op.f('chat_pkey'))
    )
    op.create_index(op.f('chat_user_id_idx'), 'chat', ['user_id'], unique=False)
    op.create_table('message',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('chat_id', sa.Integer(), nullable=False),
    sa.Column('content', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('model_id', sa.String(length=100), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['chat_id'], ['chat.id'], name=op.f('message_chat_id_fkey'), ondelete='cascade'),
    sa.PrimaryKeyConstraint('id', name=op.f('message_pkey'))
    )
    op.create_index(op.f('message_chat_id_idx'), 'message', ['chat_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('message_chat_id_idx'), table_name='message')
    op.drop_table('message')
    op.drop_index(op.f('chat_user_id_idx'), table_name='chat')
    op.drop_table('chat')
