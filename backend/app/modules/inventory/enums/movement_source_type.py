from enum import Enum


class MovementSourceType(str, Enum):
    MANUAL = "manual"
    PURCHASE = "purchase"
    SALE = "sale"
    WARRANTY = "warranty"
    TRANSFER = "transfer"
