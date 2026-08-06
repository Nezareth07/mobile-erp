from enum import Enum


class TrackingType(str, Enum):
    NONE = "none"
    SERIAL = "serial"
    BATCH = "batch"
