"""Rate limiter configuration for the API.

Single Limiter instance shared by app.py and all route modules.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])
