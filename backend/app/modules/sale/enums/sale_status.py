from enum import Enum


class SaleStatus(str, Enum):
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
