"""add pickup and dropoff lat/lng to orders

Revision ID: 2f4cf34bdd69
Revises: 20c01150891b
Create Date: 2025-06-10 22:27:54.966361

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '2f4cf34bdd69'
down_revision: Union[str, None] = '20c01150891b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    """Upgrade schema."""
    # Only add columns to orders table
    op.add_column('orders', sa.Column('pickup_lat', sa.Float(), nullable=True))
    op.add_column('orders', sa.Column('pickup_lng', sa.Float(), nullable=True))
    op.add_column('orders', sa.Column('dropoff_lat', sa.Float(), nullable=True))
    op.add_column('orders', sa.Column('dropoff_lng', sa.Float(), nullable=True))

def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('orders', 'dropoff_lng')
    op.drop_column('orders', 'dropoff_lat')
    op.drop_column('orders', 'pickup_lng')
    op.drop_column('orders', 'pickup_lat')
