from enum import Enum


class PurchaseStatus(str, Enum):
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
