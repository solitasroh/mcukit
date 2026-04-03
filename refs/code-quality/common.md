# Code Structure Quality — Universal Guide

> Apply these rules whenever generating code, regardless of language or domain.
> AI-generated code introduces 1.7x more structural issues (CodeRabbit 2026)
> and 4x more duplication (GitClear 2025). These rules prevent that.

---

## 1. Clean Architecture — Layer Placement Guide

Dependencies always point inward. Never import outward.

```
[Presentation / UI / API]      ← Depends on Application
         ↓
[Application / Use Cases]      ← Depends on Domain
         ↓
[Domain / Business Logic]      ← Depends on nothing (pure)
         ↑
[Infrastructure / Data Access] ← Depends on Domain (implements interfaces)
```

### Where does this code belong?

| Code Type | Layer | Why |
|-----------|-------|-----|
| UI rendering, input handling, controllers | Presentation | User interaction boundary |
| Use case orchestration, "do X then Y" | Application | Business flow coordination |
| Core business rules, entities, value objects | Domain | Framework-independent truth |
| DB queries, HTTP clients, file I/O | Infrastructure | External world adapters |
| DTOs, request/response shapes | Presentation or Application | Transfer objects at boundaries |
| Interfaces/ports for external services | Domain | Abstractions owned by inner layer |

### Bad/Good: Layer Violation

```
// BAD — Domain depends on Infrastructure (outward dependency)
class Order {
  save() {
    const db = new PostgresDatabase();  // Domain knows about DB
    db.insert(this);
  }
}

// GOOD — Domain defines interface, Infrastructure implements
// Domain layer:
interface OrderRepository {
  save(order: Order): void;
}

// Infrastructure layer:
class PostgresOrderRepository implements OrderRepository {
  save(order: Order) { /* DB logic here */ }
}

// Application layer:
class CreateOrderUseCase {
  constructor(private repo: OrderRepository) {}  // injected
  execute(data: OrderData) {
    const order = Order.create(data);
    this.repo.save(order);
  }
}
```

---

## 2. OOP Principles — Practical Application

### 2.1 Composition Over Inheritance

Use inheritance only for genuine "is-a" relationships. Default to composition.

```
// BAD — Inheritance for code reuse (not is-a)
class EmailService extends Logger {
  send(email) { this.log("sending..."); /* send logic */ }
}

// GOOD — Composition
class EmailService {
  constructor(private logger: Logger) {}
  send(email) { this.logger.log("sending..."); /* send logic */ }
}
```

### 2.2 Interface Segregation

Many small interfaces > one fat interface.

```
// BAD — God interface
interface Worker {
  work(): void;
  eat(): void;
  sleep(): void;
  report(): void;
}

// GOOD — Segregated
interface Workable { work(): void; }
interface Feedable { eat(): void; }
interface Reportable { report(): void; }

class Robot implements Workable, Reportable {
  work() { /* ... */ }
  report() { /* ... */ }
  // No need to implement eat() or sleep()
}
```

### 2.3 Dependency Inversion

High-level modules depend on abstractions, not concrete implementations.

```
// BAD — High-level depends on low-level
class NotificationService {
  private mailer = new GmailSender();     // hard-wired
  private sms = new TwilioSender();       // hard-wired
}

// GOOD — Depend on abstraction, inject concrete
interface MessageSender {
  send(to: string, body: string): void;
}

class NotificationService {
  constructor(private senders: MessageSender[]) {}  // injected
}
```

---

## 3. Design Pattern Selection

Use a pattern when it eliminates a structural problem. Do NOT use one when a simple conditional suffices.

| Signal in Your Code | Pattern | Apply When |
|---------------------|---------|------------|
| 3+ branches on same axis (if/elif chain) | **Strategy** | Algorithm varies at runtime |
| Object type varies by input string/enum | **Factory Method** | Creator shouldn't know concrete types |
| Behavior changes with internal state | **State** | Replace state-checking if/else chains |
| One change must notify many listeners | **Observer** | Decouple publisher from subscribers |
| Constructor has 4+ params or optional combos | **Builder** | Complex object assembly |
| Need to wrap existing interface | **Adapter** | Integrate without modifying third-party |
| Add responsibility without subclassing | **Decorator** | Layer behaviors at runtime |
| 2 or fewer branches, unlikely to grow | **Keep the if** | Premature pattern adds complexity |

### Strategy Pattern — Multi-Language Skeleton

```
// Concept: extract varying algorithm into swappable objects

// C++
class Compressor {
public:
  virtual ~Compressor() = default;
  virtual std::vector<uint8_t> compress(std::span<const uint8_t> data) = 0;
};
class GzipCompressor : public Compressor { /* ... */ };
class LZ4Compressor : public Compressor { /* ... */ };

// C#
interface ICompressor {
  byte[] Compress(ReadOnlySpan<byte> data);
}
class GzipCompressor : ICompressor { /* ... */ }

// TypeScript
interface Compressor {
  compress(data: Uint8Array): Uint8Array;
}
const gzipCompressor: Compressor = { compress: (data) => /* ... */ };

// Python
class Compressor(Protocol):
    def compress(self, data: bytes) -> bytes: ...
class GzipCompressor:
    def compress(self, data: bytes) -> bytes: ...
```

---

## 4. Code Smells & Anti-Patterns

| Smell | Symptom | Fix |
|-------|---------|-----|
| **God Object** | Class with 10+ public methods, 500+ lines | Split by responsibility |
| **Feature Envy** | Method uses another class's data more than its own | Move method to that class |
| **Primitive Obsession** | Email as `string`, Money as `float` | Create value objects |
| **Shotgun Surgery** | One change requires editing 5+ files | Extract shared abstraction |
| **Long Parameter List** | Function with 4+ parameters | Introduce parameter object |
| **Deep Nesting** | 4+ levels of if/for/while | Early return, extract helpers |
| **Duplicate Code** | Same 3+ lines in 2+ places | Extract to shared function |
| **Dead Code** | Commented-out code, unreachable branches | Delete it entirely |

### Bad/Good: Primitive Obsession

```
// BAD — Money as float, email as string
function createOrder(price: number, currency: string, email: string) {
  if (price < 0) throw new Error("negative");
  if (!email.includes("@")) throw new Error("invalid");
  // Validation scattered everywhere this data is used
}

// GOOD — Value objects encapsulate validation
class Money {
  constructor(readonly amount: number, readonly currency: string) {
    if (amount < 0) throw new Error("negative");
  }
}
class Email {
  constructor(readonly value: string) {
    if (!value.includes("@")) throw new Error("invalid");
  }
}
function createOrder(price: Money, email: Email) {
  // Already validated by construction
}
```

---

## 5. Sizing Limits (Enforced by PostToolUse Hook)

| Metric | Limit | Action When Exceeded |
|--------|-------|---------------------|
| Function body | 40 lines | Extract semantic helper functions |
| Function parameters | 3 | Introduce parameter object or Builder |
| Nesting depth | 3 levels | Early return, guard clauses, extract |
| Class public methods | 7 | Split responsibilities into collaborators |
| File length | 300 lines | Split into modules by cohesion |

---

## 6. Self-Check (Run Before Completing Any Code Task)

1. Does each function/class have a single, nameable responsibility?
2. Could I add a new variant without editing existing code?
3. Are dependencies injected, not instantiated internally?
4. Did I check for existing code to reuse before writing new logic?
5. Did I refactor strained code before bolting on new features?
6. Is every function under 40 lines and under 3 params?
7. Are there 3+ branches on one axis that should be a pattern?

---

## 7. Reference Repositories

Study these repos for excellent code structure in each language:

### C++
- [fmtlib/fmt](https://github.com/fmtlib/fmt) (23k) — API design, constexpr, RAII
- [abseil/abseil-cpp](https://github.com/abseil/abseil-cpp) (17k) — Modular structure, StatusOr
- [TheLartians/ModernCppStarter](https://github.com/TheLartians/ModernCppStarter) (5k) — Project template

### C#
- [jasontaylordev/CleanArchitecture](https://github.com/jasontaylordev/CleanArchitecture) (20k) — 4-layer, MediatR CQRS
- [amantinband/clean-architecture](https://github.com/amantinband/clean-architecture) (1.9k) — ErrorOr Result pattern
- [dotnet/eShop](https://github.com/dotnet/eShop) (10k) — Production DDD/CQRS

### TypeScript
- [alan2207/bulletproof-react](https://github.com/alan2207/bulletproof-react) (35k) — Feature-based folders
- [supermacro/neverthrow](https://github.com/supermacro/neverthrow) (7k) — Result<T,E> monad
- [Effect-TS/effect](https://github.com/Effect-TS/effect) (14k) — Advanced type programming

### Python
- [cosmicpython/code](https://github.com/cosmicpython/code) (2.6k) — DDD/Clean Architecture textbook
- [pydantic/pydantic](https://github.com/pydantic/pydantic) (27k) — Type system mastery
- [Textualize/textual](https://github.com/Textualize/textual) (35k) — Modern Python 3.11+ idioms

### Multi-Language Patterns
- [RefactoringGuru](https://github.com/RefactoringGuru) — 23 GoF patterns in 8 languages
- [ryanmcdermott/clean-code-javascript](https://github.com/ryanmcdermott/clean-code-javascript) (94k) — Bad/Good pairs
