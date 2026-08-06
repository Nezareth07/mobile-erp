from enum import Enum


class MovementType(str, Enum):
    PURCHASE_IN = "purchase_in"
    SALE_OUT = "sale_out"
    ADJUSTMENT_IN = "adjustment_in"
    ADJUSTMENT_OUT = "adjustment_out"
    RETURN_IN = "return_in"
    RETURN_OUT = "return_out"
    WARRANTY_OUT = "warranty_out"
    WARRANTY_IN = "warranty_in"
    TRANSFER_IN = "transfer_in"
    TRANSFER_OUT = "transfer_out"
