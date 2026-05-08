from sqlalchemy import Column, DateTime, String, func

from app.core.database import Base


class User(Base):
    """A019: shadow row for a Clerk subject.

    Clerk owns the user's email, password, name, MFA, OAuth providers, etc.
    This row exists only to give us a stable local user_id (UUID v4 string)
    that foreign keys can reference. We never write any PII here — `clerk_id`
    is the only link to Clerk and it's enough to fetch profile info on
    demand if we ever need to.
    """

    __tablename__ = "users"

    id = Column(String(36), primary_key=True)
    clerk_id = Column(String(255), nullable=False, unique=True, index=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} clerk_id={self.clerk_id}>"
