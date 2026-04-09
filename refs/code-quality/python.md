# Python Structure Rules

## Type Hints — annotate all parameters and return types

```python
# Bad
def process(data, config): ...
# Good
type Config = dict[str, str | int]
def process(data: list[Record], config: Config) -> ProcessResult: ...
```

## Class Design — `@dataclass` for data, composition over inheritance

```python
# Bad — attributes scattered across methods
class User:
    def __init__(self): self.name = ""
    def load(self, data): self.email = data["email"]
# Good — explicit, immutable
@dataclass(frozen=True)
class User:
    name: str
    email: str
    role: str = "viewer"
```

## Dependency Injection — accept interfaces, not implementations

```python
# Bad — untestable
class OrderService:
    def __init__(self): self.db = PostgresConnection()
# Good
class OrderService:
    def __init__(self, db: DatabasePort) -> None: self.db = db
```

## Error Handling — specific exceptions, domain errors, context managers

```python
# Bad
try: result = service.call()
except: pass
# Good
try: result = service.call()
except ServiceTimeoutError: result = service.call(retry=True)
except ServiceError as e:
    raise ApplicationError(f"Service failed: {e}") from e
```

## Testing — mirror source layout, one behavior per test, mock at boundary

```python
# Bad — vague name, mocks internals
def test_order():
    with patch("orders.service._validate"): assert create_order({})
# Good
def test_create_order_missing_item_raises(fake_db: FakeDatabase):
    svc = OrderService(db=fake_db)
    with pytest.raises(ValidationError, match="item required"):
        svc.create_order(OrderInput(item=None))
```

## Modern Python 3.11/3.12

```python
# Bad — old TypeAlias
from typing import TypeAlias
UserMap: TypeAlias = dict[str, "User"]
# Good — 3.12 type statement
type UserMap = dict[str, User]

# Bad — isinstance chains
def handle(event):
    if isinstance(event, Click): return click(event)
    elif isinstance(event, Key): return key(event)
# Good — match statement
def handle(event: Event) -> Action:
    match event:
        case Click(x=x, y=y): return click_at(x, y)
        case Key(code=c) if c in HOTKEYS: return hotkey(c)
        case _: return ignore()

# Bad: def where(self, c) -> "Query"
# Good — Self type (3.11+)
from typing import Self
class Query:
    def where(self, c: str) -> Self:
        self._clauses.append(c); return self

# ExceptionGroup (3.11+)
try: results = run_validators(data)
except* ValueError as eg:
    for e in eg.exceptions: logger.error(f"Validation: {e}")

# Typed **kwargs (3.12)
class ConnectOpts(TypedDict, total=False):
    timeout: float
    retries: int
def connect(host: str, **kwargs: Unpack[ConnectOpts]) -> Connection: ...
```

## Async Patterns

Prefer `TaskGroup` over `gather`. Async context managers for resource lifecycle.

```python
# Bad — gather swallows errors
results = await asyncio.gather(fetch(a), fetch(b), return_exceptions=True)
# Good — TaskGroup, structured concurrency
async with asyncio.TaskGroup() as tg:
    ta = tg.create_task(fetch(a))
    tb = tg.create_task(fetch(b))
results = [ta.result(), tb.result()]

# Bad — manual start()/stop()    Good — async context manager
class Pool:
    async def __aenter__(self) -> Self:
        self._conn = await connect(); return self
    async def __aexit__(self, *exc) -> None:
        await self._conn.close()

# Good — async generator (vs loading all into memory)
async def read_all(paths: list[Path]) -> AsyncIterator[str]:
    for p in paths:
        async with aiofiles.open(p) as f: yield await f.read()
```

## Package Structure

Use src layout, `pyproject.toml`, explicit `__all__`, `_` prefix for internals.

```
src/mypackage/             # src layout (not flat)
    __init__.py            # explicit __all__, no wildcard imports
    _internal.py           # _ prefix = private module
    models.py
pyproject.toml             # replaces setup.py
tests/test_service.py
```

```python
# Bad: from .models import *
# Good — explicit public API in __init__.py
__all__ = ["User", "OrderService"]
from .models import User
from .service import OrderService
```

## Functional Patterns

Protocol over ABC. Frozen dataclasses for value objects. Composable validators.

```python
# Bad — ABC forces inheritance
class Repository(ABC):
    @abstractmethod
    def get(self, id: str) -> Entity: ...
class SqlRepo(Repository): ...   # must inherit
# Good — Protocol, structural subtyping
class Repository(Protocol):
    def get(self, id: str) -> Entity: ...
class SqlRepo:                    # no inheritance needed
    def get(self, id: str) -> Entity: ...

# Bad — mutable state
class Money:
    def __init__(self, amt, cur):
        self.amount = amt; self.currency = cur
# Good — frozen value object with content equality
@dataclass(frozen=True)
class Money:
    amount: Decimal
    currency: str
    def add(self, other: Self) -> Self:
        assert self.currency == other.currency
        return Money(self.amount + other.amount, self.currency)

# Bad — nested validation
def validate(order):
    if not order.items: raise ValueError()
    if order.total < 0: raise ValueError()
# Good — composable validators
type Validator[T] = Callable[[T], list[str]]
def non_empty(o: Order) -> list[str]:
    return ["items required"] if not o.items else []
def validate(order: Order, rules: list[Validator[Order]]) -> list[str]:
    return [e for r in rules for e in r(order)]
```

## Reference Repos

| Repo | Stars | Learn |
|------|-------|-------|
| [cosmicpython/code](https://github.com/cosmicpython/code) | 2.6k | DDD, Clean Architecture, Unit of Work |
| [pydantic/pydantic](https://github.com/pydantic/pydantic) | 27k | Type system, validators, `model_validator` |
| [Textualize/textual](https://github.com/Textualize/textual) | 35k | Python 3.11+ idioms, async, `Self` |
| [litestar-org/litestar](https://github.com/litestar-org/litestar) | 8k | Protocol + DI + async patterns |
| [polarsource/polar](https://github.com/polarsource/polar) | 9.6k | Production Clean Architecture, FastAPI |

---

## Security (ECC-Insight)

Security-critical Python rules. Every violation is CRITICAL severity.

### SQL Injection — No f-strings in Queries

```python
# Bad — SQL injection
cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")
cursor.execute("SELECT * FROM users WHERE name = '" + name + "'")

# Good — parameterized (DB-API 2.0 style)
cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))

# Good — SQLAlchemy Core
stmt = select(User).where(User.id == user_id)
result = session.execute(stmt)

# Good — SQLAlchemy ORM
user = session.get(User, user_id)
```

### Shell Injection — No `shell=True` with User Input

```python
# Bad — shell interprets everything
import subprocess
subprocess.run(f"ls {user_input}", shell=True)
subprocess.run("ls " + user_input, shell=True)

# Good — list of arguments, no shell
subprocess.run(["ls", user_input], check=True)

# Good — when shell pipes are truly needed, validate first
import shlex
if not user_input.isalnum():
    raise ValueError("invalid input")
subprocess.run(["sh", "-c", f"ls {shlex.quote(user_input)} | wc -l"], check=True)
```

### Deserialization — pickle is Unsafe

```python
# Bad — arbitrary code execution on untrusted data
import pickle
with open("data.pkl", "rb") as f:
    obj = pickle.load(f)  # RCE if file is attacker-controlled

# Good — JSON for untrusted data
import json
with open("data.json") as f:
    obj = json.load(f)

# Good — MessagePack for binary
import msgpack
obj = msgpack.unpackb(data, raw=False)
```

pickle is only acceptable for data your own code wrote and never left a trusted boundary.

### Path Traversal

```python
# Bad — user controls path
from pathlib import Path
file = Path(base_dir) / user_input
content = file.read_text()

# Good — resolve and verify prefix
from pathlib import Path

def safe_path(base: Path, user_input: str) -> Path:
    base_real = base.resolve()
    requested = (base / user_input).resolve()
    try:
        requested.relative_to(base_real)
    except ValueError:
        raise PermissionError("path traversal detected")
    return requested

file = safe_path(Path(base_dir), user_input)
content = file.read_text()
```

### Secrets in Environment

```python
# Bad — hardcoded
API_KEY = "sk-abc123..."

# Good — environment variables with validation
import os
API_KEY = os.environ.get("API_KEY")
if not API_KEY:
    raise RuntimeError("API_KEY environment variable required")

# Good — pydantic-settings for typed config
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    api_key: str
    debug: bool = False

    class Config:
        env_file = ".env"
```

---

## Anti-patterns (ECC-Insight)

### Mutable Default Arguments — HIGH

```python
# Bad — list is shared across all calls
def append_item(item, items=[]):
    items.append(item)
    return items

# Good — None sentinel + create new list
def append_item(item, items=None):
    items = items if items is not None else []
    items.append(item)
    return items
```

Same applies to `{}`, `set()`, dataclass `field(default=[])`. Use `field(default_factory=list)` for dataclasses.

### `print` vs `logging`

```python
# Bad — production code
print(f"Processing user {user_id}")
print(f"Error: {e}")

# Good — structured logging
import logging
logger = logging.getLogger(__name__)

logger.info("Processing user", extra={"user_id": user_id})
logger.error("Processing failed", exc_info=True, extra={"user_id": user_id})
```

`print` is for CLI output. Everything else uses `logging`. Configure log levels per environment.

### Builtin Shadowing

```python
# Bad — shadows builtins
list = [1, 2, 3]       # breaks list() later
dict = {"a": 1}        # breaks dict() later
id = user.id           # breaks id() later
type = "admin"         # breaks type() later
input = request.body   # breaks input() later
```

Builtin names to avoid: `list`, `dict`, `set`, `tuple`, `str`, `int`, `float`, `bool`, `id`, `type`, `input`, `filter`, `map`, `open`, `file`, `hash`, `sum`, `max`, `min`, `len`.

Use descriptive alternatives: `items`, `mapping`, `user_id`, `user_type`, `request_body`.

### bare `except:` — Hides Everything

```python
# Bad — catches KeyboardInterrupt, SystemExit, everything
try:
    risky()
except:
    pass

# Bad — still too broad, swallows MemoryError etc.
try:
    risky()
except BaseException:
    pass

# Good — catch Exception or specific
try:
    risky()
except (ValueError, KeyError) as e:
    logger.warning("Expected failure", exc_info=True)
    raise DomainError("operation failed") from e
```

### Identity vs Equality

```python
# Bad — equality check for None/True/False
if x == None: ...
if flag == True: ...

# Good — identity check
if x is None: ...
if flag is True: ...
```

`None`, `True`, `False`, `NotImplemented`, `Ellipsis` are singletons — always use `is`.
