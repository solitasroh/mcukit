# Python Structure Rules

---

## Type Hints

Python's dynamic typing is a feature, but untyped function
signatures in a growing codebase become a maintenance burden.
Type hints serve as executable documentation and enable static
analysis with mypy or pyright.

- Annotate all function parameters and return types.
- Use `TypeAlias` for complex types to keep signatures readable.
- `Optional[T]` means `T | None` — always guard against `None`
  before using the value.
- Use `Protocol` (structural subtyping) over `ABC` when you
  only need to verify that an object has certain methods,
  without requiring an inheritance relationship.

```python
# Bad — caller has no idea what goes in or comes out
def process(data, config):
    ...

# Good
from typing import TypeAlias

Config: TypeAlias = dict[str, str | int]

def process(data: list[Record], config: Config) -> ProcessResult:
    ...
```

## Class Design

- Use `@dataclass` for data-holding classes. It eliminates
  `__init__`, `__repr__`, `__eq__` boilerplate and makes
  the field list the single source of truth.
- Use `@dataclass(frozen=True)` for immutable value objects.
- Declare all instance attributes in `__init__` (or as dataclass
  fields). Adding attributes in random methods makes the class
  shape unpredictable.
- Prefer composition over inheritance. Multiple inheritance
  is acceptable only through mixin classes with no state.
- Use `ABC` and `@abstractmethod` to define interfaces that
  subclasses must implement.

```python
# Bad — fragile mutable bag of attributes
class User:
    def __init__(self):
        self.name = ""
    def load(self, data):
        self.email = data["email"]   # attribute appears here, not in __init__
        self.role = data.get("role")  # and here

# Good — explicit, immutable, self-documenting
@dataclass(frozen=True)
class User:
    name: str
    email: str
    role: str = "viewer"
```

## Dependency Injection

- Functions and classes receive their dependencies as parameters.
  Do not import and call a global database connection directly.
- For services, accept an interface (Protocol or ABC) in the
  constructor. This makes tests trivial — inject a fake.

```python
# Bad — hard-wired to a real database
class OrderService:
    def __init__(self):
        self.db = PostgresConnection()  # untestable

# Good
class OrderService:
    def __init__(self, db: IDatabase):
        self.db = db
```

## Project Layout

- One class or one coherent group of functions per module (file).
- Use `__init__.py` exports to define the package's public API.
  Internal modules are prefixed with `_` or excluded from exports.
- Zero circular imports. If two modules import each other,
  extract the shared definition into a third module.

## Error Handling

- Catch specific exception types. Bare `except:` or
  `except Exception:` with no re-raise is forbidden.
- Define custom exception classes for domain errors.
  Group them in an `exceptions.py` module.
- Use context managers (`with` statements) for any resource
  that has a cleanup step (files, connections, locks).

```python
# Bad
try:
    result = service.call()
except:      # catches KeyboardInterrupt, SystemExit, everything
    pass     # silently swallowed

# Good
try:
    result = service.call()
except ServiceTimeoutError:
    logger.warning("Service timed out, retrying")
    result = service.call(retry=True)
except ServiceError as e:
    raise ApplicationError(f"Service failed: {e}") from e
```

## Testing Conventions

- Test files mirror source layout: `src/orders/service.py` →
  `tests/orders/test_service.py`.
- Each test function tests one behavior. Name it
  `test_<action>_<condition>_<expected>`.
- Use `pytest` fixtures for setup/teardown. Avoid test
  inheritance hierarchies.
- Mock external dependencies (DB, HTTP, file I/O) at the
  interface boundary, not deep inside implementation.
