"""Bootstrap del primer usuario ADMIN de una instalacion.

Uso:
    python -m app.cli.bootstrap_admin

Email y nombre pueden proveerse por argumento o variable de entorno (no
son secretos). El password SIEMPRE se pide de forma interactiva sin eco
en pantalla (getpass, con confirmacion), salvo que se provea
explicitamente via la variable de entorno BOOTSTRAP_ADMIN_PASSWORD --
documentado como menos seguro, pensado unicamente para automatizacion
que ya maneja secretos de forma segura por su cuenta (CI/CD, orquestador
con su propio sistema de secrets).

Idempotente: si ya existe un ADMIN activo, no crea ni modifica nada y
termina con exit code 0. No es un mecanismo de reset de contraseña.
"""
import argparse
import asyncio
import getpass
import os
import sys

from pydantic import ValidationError

from app.core.database.engine import engine
from app.core.database.session import SessionFactory
from app.core.exceptions import AppException
from app.modules.auth.schemas.user_create import UserCreate
from app.modules.auth.services.user_service import UserService


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Bootstrap the first ADMIN user for a new installation.",
    )
    parser.add_argument(
        "--email",
        default=None,
        help="Admin email (or BOOTSTRAP_ADMIN_EMAIL env var).",
    )
    parser.add_argument(
        "--full-name",
        default=None,
        help="Admin full name (or BOOTSTRAP_ADMIN_FULL_NAME env var).",
    )
    return parser.parse_args()


def _resolve_email(args: argparse.Namespace) -> str:
    return (
        args.email
        or os.environ.get("BOOTSTRAP_ADMIN_EMAIL")
        or input("Email: ").strip()
    )


def _resolve_full_name(args: argparse.Namespace) -> str:
    return (
        args.full_name
        or os.environ.get("BOOTSTRAP_ADMIN_FULL_NAME")
        or input("Full name: ").strip()
    )


def _resolve_password() -> str:
    env_password = os.environ.get("BOOTSTRAP_ADMIN_PASSWORD")

    if env_password:
        print(
            "WARNING: reading the password from BOOTSTRAP_ADMIN_PASSWORD "
            "is less secure than the interactive prompt (visible in this "
            "process's environment while it runs). Prefer the "
            "interactive prompt when possible.",
            file=sys.stderr,
        )
        return env_password

    password = getpass.getpass("Password: ")
    confirm = getpass.getpass("Confirm password: ")

    if password != confirm:
        print("Passwords do not match.", file=sys.stderr)
        sys.exit(1)

    return password


async def _bootstrap(email: str, full_name: str, password: str) -> int:
    # DATABASE__ECHO (config de desarrollo, fuera del alcance de este
    # comando) hace que SQLAlchemy loguee el SQL completo -- incluido
    # password_hash como parametro literal del INSERT. Este CLI maneja
    # credenciales explicitamente, asi que desactiva el echo en su propio
    # proceso sin importar el valor ambiente de esa config.
    engine.sync_engine.echo = False

    try:
        async with SessionFactory() as session:
            service = UserService(session)

            try:
                user, created = await service.bootstrap_admin(
                    email,
                    full_name,
                    password,
                )
            except AppException as exc:
                print(f"Error: {exc}", file=sys.stderr)
                return 1

        if created:
            print(f"ADMIN user created: {user.email}")
        else:
            print(
                f"An active ADMIN user already exists: {user.email}. "
                "Nothing was changed."
            )

        return 0
    finally:
        await engine.dispose()


def main() -> int:
    args = _parse_args()

    email = _resolve_email(args)
    full_name = _resolve_full_name(args)
    password = _resolve_password()

    try:
        data = UserCreate(email=email, full_name=full_name, password=password)
    except ValidationError as exc:
        print(f"Invalid input: {exc}", file=sys.stderr)
        return 1

    return asyncio.run(_bootstrap(data.email, data.full_name, data.password))


if __name__ == "__main__":
    sys.exit(main())
