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
