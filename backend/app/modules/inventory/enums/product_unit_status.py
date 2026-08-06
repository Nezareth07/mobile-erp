from enum import Enum


class ProductUnitStatus(str, Enum):
    IN_STOCK = "in_stock"
    RESERVED = "reserved"
    SOLD = "sold"
    IN_WARRANTY = "in_warranty"
    DEFECTIVE = "defective"
    RETURNED_TO_SUPPLIER = "returned_to_supplier"
