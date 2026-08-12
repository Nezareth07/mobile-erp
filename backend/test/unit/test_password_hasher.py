"""Tests unitarios puros de PasswordHasher -- sin Postgres, sin app,
sin mocks: se ejercita directamente bcrypt via la clase real.

Comportamiento confirmado empiricamente contra bcrypt 5.0.0 antes de
escribir estas aserciones (no se adivino ningun mensaje/excepcion):
- bcrypt.hashpw() lanza ValueError si el password excede 72 bytes.
- bcrypt.checkpw() lanza ValueError si el hash no tiene formato bcrypt
  valido; PasswordHasher.verify() atrapa exactamente ese ValueError y
  devuelve False en su lugar.
"""
from app.modules.auth.security.password_hasher import PasswordHasher


def test_hash_returns_a_bcrypt_formatted_string():
    hashed = PasswordHasher.hash("correct horse battery staple")

    assert isinstance(hashed, str)
    assert hashed != "correct horse battery staple"
    assert hashed.startswith("$2b$")


def test_hash_is_salted_and_differs_for_the_same_password():
    password = "same-password-twice"

    first = PasswordHasher.hash(password)
    second = PasswordHasher.hash(password)

    assert first != second
    # pero ambos deben seguir verificando correctamente contra el mismo password
    assert PasswordHasher.verify(password, first) is True
    assert PasswordHasher.verify(password, second) is True


def test_verify_with_correct_password_returns_true():
    password = "MiPasswordSegura123"
    hashed = PasswordHasher.hash(password)

    assert PasswordHasher.verify(password, hashed) is True


def test_verify_with_incorrect_password_returns_false():
    hashed = PasswordHasher.hash("MiPasswordSegura123")

    assert PasswordHasher.verify("OtraPasswordDistinta", hashed) is False


def test_verify_with_corrupted_or_invalid_hash_returns_false_not_raise():
    # bcrypt.checkpw() lanza ValueError("Invalid salt") ante un hash con
    # formato invalido -- PasswordHasher.verify() debe atraparlo y
    # devolver False, nunca dejar propagar la excepcion.
    result = PasswordHasher.verify("cualquier-password", "not-a-valid-bcrypt-hash")

    assert result is False


def test_hash_and_verify_roundtrip_with_unicode_password():
    password = "contraseña-Ñoño-日本語-🔒"

    hashed = PasswordHasher.hash(password)

    assert PasswordHasher.verify(password, hashed) is True
    assert PasswordHasher.verify("contraseña-Ñoño-日本語-❌", hashed) is False


def test_hash_at_exactly_72_bytes_succeeds():
    password = "a" * 72
    assert len(password.encode("utf-8")) == 72

    hashed = PasswordHasher.hash(password)

    assert PasswordHasher.verify(password, hashed) is True


def test_hash_over_72_bytes_raises_value_error():
    # PasswordHasher.hash() no trunca ni atrapa este error -- lo deja
    # propagar tal cual lo lanza bcrypt. Documentamos ese comportamiento
    # real, no lo que "deberia" pasar.
    password = "a" * 73
    assert len(password.encode("utf-8")) == 73

    try:
        PasswordHasher.hash(password)
        assert False, "se esperaba ValueError para un password > 72 bytes"
    except ValueError as exc:
        assert "72 bytes" in str(exc)
