"""add screenshot_url to applications

Revision ID: f6d18fe980bd
Revises: 1801fb5a7069
Create Date: 2026-08-08 17:11:50.394893

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f6d18fe980bd'
down_revision: Union[str, Sequence[str], None] = '1801fb5a7069'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("applications", sa.Column("screenshot_url", sa.String(1024), nullable=True))


def downgrade() -> None:
    op.drop_column("applications", "screenshot_url")
