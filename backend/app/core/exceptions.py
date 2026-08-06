class AppException(Exception):
    pass


class NotFoundException(AppException):
    pass


class ConflictException(AppException):
    pass


class BadRequestException(AppException):
    pass