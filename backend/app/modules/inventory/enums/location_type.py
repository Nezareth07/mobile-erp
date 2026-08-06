from enum import Enum


class LocationType(str, Enum):
    STORE = "store"
    WAREHOUSE = "warehouse"
    ONLINE = "online"
